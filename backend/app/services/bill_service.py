import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.models.bill import Bill, BillStatus, DueDateSource, PaymentStatus
from app.models.bill_settlement import BillSettlement
from app.models.vendor import Vendor
from app.services.file_service import upload_file
from app.workers.bill_processing import (
    normalize_vendor_name,
    process_bill_task,
)

EDITABLE_FIELDS = {"bill_number", "bill_date", "vendor_id", "subtotal", "discounts",
                   "charges", "due_date", "due_date_source", "notes",
                   "extracted_vendor_name"}

def normalize_editable_payload(payload: dict) -> dict:
    """Coerce an explicit JSON `null` for list-shaped editable fields into `[]`.

    `discounts`/`charges` are optional on the request schemas (so we can tell
    "not provided" from "provided") but non-optional on `BillResponse`. An
    explicit `null` survives `model_dump(exclude_unset=True)` and, applied
    as-is, writes SQL NULL into the column -- which then fails Pydantic
    validation on every subsequent read of that bill (GET by id, the PUT's
    own response, and GET /bills for the whole tenant). Normalize before it
    ever reaches the model.
    """
    normalized = dict(payload)
    for field in ("discounts", "charges"):
        if field in normalized and normalized[field] is None:
            normalized[field] = []
    return normalized

def recompute_total(bill: Bill) -> None:
    """Grand total is always derived from subtotal - discounts + charges --
    never client-supplied."""
    if bill.subtotal is None:
        bill.total_amount = None
        return
    discounts_sum = sum(Decimal(str(d.get("amount", 0))) for d in (bill.discounts or []))
    charges_sum = sum(Decimal(str(c.get("amount", 0))) for c in (bill.charges or []))
    bill.total_amount = float(Decimal(str(bill.subtotal)) - discounts_sum + charges_sum)

def derive_payment_status(total_amount, settlements: list) -> PaymentStatus:
    paid = sum(Decimal(str(s.amount)) for s in settlements)
    if paid <= 0:
        return PaymentStatus.UNPAID
    if total_amount is not None and paid >= Decimal(str(total_amount)):
        return PaymentStatus.PAID
    return PaymentStatus.PARTIALLY_PAID

async def _get_bill(bill_id: uuid.UUID, db: AsyncSession, business_id: uuid.UUID, with_settlements: bool = False) -> Bill:
    stmt = select(Bill).where(Bill.id == bill_id, Bill.business_id == business_id)
    if with_settlements:
        stmt = stmt.options(selectinload(Bill.settlements))
    result = await db.execute(stmt)
    bill = result.scalar_one_or_none()
    if not bill:
        raise ValueError("Bill not found")
    return bill

async def upload_bill(file, db: AsyncSession, business_id: uuid.UUID, user_id: uuid.UUID) -> Bill:
    file_url = await upload_file(file)

    bill = Bill(
        business_id=business_id,
        uploaded_by=user_id,
        file_url=file_url,
        status=BillStatus.PROCESSING,
    )
    db.add(bill)
    await db.commit()
    await db.refresh(bill)

    process_bill_task.delay(str(bill.id), file_url, str(business_id))
    return bill

async def update_bill_fields(bill_id: uuid.UUID, payload: dict, db: AsyncSession, business_id: uuid.UUID) -> Bill:
    bill = await _get_bill(bill_id, db, business_id, with_settlements=True)

    if bill.status not in (BillStatus.DRAFT, BillStatus.VERIFIED):
        raise ValueError(f"Cannot edit a bill in {bill.status.name} status")

    payload = normalize_editable_payload(payload)
    for field in EDITABLE_FIELDS & payload.keys():
        setattr(bill, field, payload[field])

    recompute_total(bill)
    bill.has_total_mismatch = False
    # Total may have changed; re-derive payment status
    bill.payment_status = derive_payment_status(bill.total_amount, bill.settlements)

    await db.commit()
    await db.refresh(bill)
    return bill

def due_date_from_terms(bill_date: date, payment_terms_days: int) -> date:
    return bill_date + timedelta(days=payment_terms_days)

async def recommend_due_date(
    vendor_id: uuid.UUID | None, bill_date: date, db: AsyncSession, business_id: uuid.UUID
) -> dict:
    """Suggest a due date from the vendor's default payment terms. Returns
    an empty recommendation if no vendor is given or the vendor has no
    payment_terms_days set — the caller decides the fallback (usually MANUAL)."""
    if vendor_id:
        result = await db.execute(
            select(Vendor).where(Vendor.id == vendor_id, Vendor.business_id == business_id)
        )
        vendor = result.scalar_one_or_none()
        if vendor and vendor.payment_terms_days is not None:
            return {
                "due_date": due_date_from_terms(bill_date, vendor.payment_terms_days),
                "source": DueDateSource.VENDOR_DEFAULT,
                "payment_terms_days": vendor.payment_terms_days,
            }
    return {"due_date": None, "source": None, "payment_terms_days": None}

async def create_manual_bill(
    payload: dict, db: AsyncSession, business_id: uuid.UUID, user_id: uuid.UUID, file_url: str | None = None
) -> Bill:
    """Finance/Admin-entered bill with no OCR step. Lands directly as VERIFIED
    (no separate verify click) — Finance typed the numbers deliberately, so
    there's nothing left to review. Applies the same checks the verify step
    used to enforce (vendor required, total required, no mismatch), since
    that step no longer runs for these bills."""
    bill = Bill(
        business_id=business_id,
        uploaded_by=user_id,
        file_url=file_url,
        status=BillStatus.DRAFT,
    )

    vendor_name = payload.pop("vendor_name", None)
    payload = normalize_editable_payload(payload)
    for field in EDITABLE_FIELDS & payload.keys():
        setattr(bill, field, payload[field])

    if vendor_name and not bill.vendor_id:
        vendor = await get_or_create_vendor(vendor_name, db, business_id)
        bill.vendor_id = vendor.id

    if not bill.vendor_id:
        raise ValueError("Bill must have a vendor")

    recompute_total(bill)
    bill.has_total_mismatch = False

    bill.status = BillStatus.VERIFIED
    bill.verified_by = user_id
    bill.verified_at = datetime.now(UTC)
    bill.payment_status = derive_payment_status(bill.total_amount, [])

    db.add(bill)
    await db.commit()
    await db.refresh(bill)
    return bill

async def get_or_create_vendor(name: str, db: AsyncSession, business_id: uuid.UUID) -> Vendor:
    normalized = normalize_vendor_name(name)
    if not normalized:
        raise ValueError("Vendor name cannot be empty")
    result = await db.execute(
        select(Vendor).where(Vendor.business_id == business_id, Vendor.normalized_name == normalized)
    )
    vendor = result.scalar_one_or_none()
    if vendor:
        return vendor
    vendor = Vendor(business_id=business_id, name=name.strip(), normalized_name=normalized)
    db.add(vendor)
    await db.flush()
    return vendor

async def verify_bill(bill_id: uuid.UUID, db: AsyncSession, business_id: uuid.UUID, user_id: uuid.UUID,
                      vendor_name: str | None = None) -> Bill:
    bill = await _get_bill(bill_id, db, business_id)

    if bill.status != BillStatus.DRAFT:
        raise ValueError(f"Cannot verify a bill in {bill.status.name} status")

    if vendor_name:
        vendor = await get_or_create_vendor(vendor_name, db, business_id)
        bill.vendor_id = vendor.id
    elif not bill.vendor_id and bill.extracted_vendor_name:
        vendor = await get_or_create_vendor(bill.extracted_vendor_name, db, business_id)
        bill.vendor_id = vendor.id

    if not bill.vendor_id:
        raise ValueError("Bill must have a vendor before verification")
    if bill.total_amount is None:
        raise ValueError("Bill must have a total amount before verification")
    if bill.has_total_mismatch:
        raise ValueError("Extracted total does not match computed total; fix the amounts before verifying")

    bill.status = BillStatus.VERIFIED
    bill.verified_by = user_id
    bill.verified_at = datetime.now(UTC)

    await db.commit()
    await db.refresh(bill)
    return bill

async def reject_bill(bill_id: uuid.UUID, db: AsyncSession, business_id: uuid.UUID, user_id: uuid.UUID) -> Bill:
    bill = await _get_bill(bill_id, db, business_id)
    bill.status = BillStatus.REJECTED
    await db.commit()
    await db.refresh(bill)
    return bill

async def add_settlement(bill_id: uuid.UUID, data: dict, db: AsyncSession, business_id: uuid.UUID,
                         user_id: uuid.UUID) -> BillSettlement:
    bill = await _get_bill(bill_id, db, business_id, with_settlements=True)

    if bill.status != BillStatus.VERIFIED:
        raise ValueError("Payments can only be recorded against verified bills")

    # No partial payments: a bill is paid in full or not at all.
    amount = Decimal(str(data["amount"]))
    if amount <= 0:
        raise ValueError("Payment amount must be positive")

    already_paid = sum(Decimal(str(s.amount)) for s in bill.settlements)
    if already_paid > 0:
        raise ValueError("This bill has already been paid")
    if bill.total_amount is not None and amount != Decimal(str(bill.total_amount)):
        raise ValueError(f"Payment amount must be the full bill amount: {bill.total_amount}")

    settlement = BillSettlement(
        business_id=business_id,
        bill_id=bill.id,
        amount=amount,
        paid_on=data["paid_on"],
        method=data["method"],
        reference=data.get("reference"),
        notes=data.get("notes"),
        created_by=user_id,
    )
    db.add(settlement)

    bill.payment_status = derive_payment_status(bill.total_amount, list(bill.settlements) + [settlement])
    await db.commit()
    await db.refresh(settlement)
    return settlement

async def delete_settlement(settlement_id: uuid.UUID, db: AsyncSession, business_id: uuid.UUID) -> None:
    result = await db.execute(
        select(BillSettlement).where(BillSettlement.id == settlement_id, BillSettlement.business_id == business_id)
    )
    settlement = result.scalar_one_or_none()
    if not settlement:
        raise ValueError("Settlement not found")

    bill = await _get_bill(settlement.bill_id, db, business_id, with_settlements=True)
    remaining = [s for s in bill.settlements if s.id != settlement.id]
    bill.payment_status = derive_payment_status(bill.total_amount, remaining)

    await db.delete(settlement)
    await db.commit()
