import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.models.bill import Bill, BillStatus
from app.models.payment_schedule import PaymentSchedule, PaymentScheduleStatus
from app.models.vendor import Vendor
from app.workers.bill_processing import normalize_vendor_name

VENDOR_EDITABLE_FIELDS = {
    "gstin", "payment_terms_days", "credit_period_days", "contact_person", "phone", "email",
    "bank_account_holder", "bank_account_number", "bank_ifsc", "bank_name", "upi_id", "notes",
}

def _d(value) -> Decimal:
    return Decimal(str(value)) if value is not None else Decimal("0")

async def get_vendor(vendor_id: uuid.UUID, db: AsyncSession, business_id: uuid.UUID) -> Vendor:
    result = await db.execute(
        select(Vendor).where(Vendor.id == vendor_id, Vendor.business_id == business_id)
    )
    vendor = result.scalar_one_or_none()
    if not vendor:
        raise ValueError("Vendor not found")
    return vendor

async def update_vendor_fields(vendor_id: uuid.UUID, payload: dict, db: AsyncSession, business_id: uuid.UUID) -> Vendor:
    vendor = await get_vendor(vendor_id, db, business_id)

    if "name" in payload and payload["name"]:
        vendor.name = payload["name"].strip()
        vendor.normalized_name = normalize_vendor_name(payload["name"])

    for field in VENDOR_EDITABLE_FIELDS & payload.keys():
        setattr(vendor, field, payload[field])

    await db.commit()
    await db.refresh(vendor)
    return vendor

async def get_vendor_statement(vendor_id: uuid.UUID, db: AsyncSession, business_id: uuid.UUID) -> dict:
    vendor = await get_vendor(vendor_id, db, business_id)
    today = datetime.now(UTC).date()

    bills_result = await db.execute(
        select(Bill)
        .options(selectinload(Bill.settlements))
        .where(Bill.business_id == business_id, Bill.vendor_id == vendor_id, Bill.status != BillStatus.REJECTED)
    )
    bills = bills_result.scalars().all()

    total_billed = Decimal("0")
    total_paid = Decimal("0")
    outstanding = Decimal("0")
    overdue_amount = Decimal("0")
    payment_history = []
    bill_numbers_by_id: dict[uuid.UUID, str | None] = {}

    for bill in bills:
        bill_numbers_by_id[bill.id] = bill.bill_number
        if bill.status not in (BillStatus.DRAFT, BillStatus.PROCESSING):
            total = _d(bill.total_amount)
            paid = sum(_d(s.amount) for s in bill.settlements)
            bill_outstanding = max(total - paid, Decimal("0"))
            total_billed += total
            total_paid += paid
            outstanding += bill_outstanding
            if bill_outstanding > 0 and bill.due_date and bill.due_date < today:
                overdue_amount += bill_outstanding

        for settlement in bill.settlements:
            payment_history.append({
                "bill_id": bill.id,
                "bill_number": bill.bill_number,
                "settlement_id": settlement.id,
                "amount": float(_d(settlement.amount)),
                "paid_on": settlement.paid_on,
                "method": settlement.method.value,
                "reference": settlement.reference,
            })

    payment_history.sort(key=lambda p: p["paid_on"], reverse=True)

    bill_ids = list(bill_numbers_by_id.keys())
    upcoming_payments = []
    if bill_ids:
        schedules_result = await db.execute(
            select(PaymentSchedule).where(
                PaymentSchedule.business_id == business_id,
                PaymentSchedule.bill_id.in_(bill_ids),
                PaymentSchedule.status.notin_(
                    [PaymentScheduleStatus.PAID, PaymentScheduleStatus.CANCELLED, PaymentScheduleStatus.FAILED]
                ),
            )
        )
        for schedule in schedules_result.scalars().all():
            upcoming_payments.append({
                "payment_schedule_id": schedule.id,
                "bill_id": schedule.bill_id,
                "bill_number": bill_numbers_by_id.get(schedule.bill_id),
                "amount": float(_d(schedule.amount)),
                "scheduled_date": schedule.scheduled_date,
                "status": schedule.status.value,
            })
        upcoming_payments.sort(key=lambda p: p["scheduled_date"])

    return {
        "vendor_id": vendor.id,
        "vendor_name": vendor.name,
        "total_bills": len(bills),
        "total_billed": float(total_billed),
        "total_paid": float(total_paid),
        "outstanding_amount": float(outstanding),
        "overdue_amount": float(overdue_amount),
        "upcoming_payments": upcoming_payments,
        "payment_history": payment_history,
    }
