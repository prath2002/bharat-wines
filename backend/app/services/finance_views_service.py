import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.bill import Bill, BillStatus, PaymentStatus
from app.models.payment_approval import ApprovalStatus, PaymentApproval
from app.models.payment_schedule import PaymentSchedule, PaymentScheduleStatus


def _d(value) -> Decimal:
    return Decimal(str(value)) if value is not None else Decimal("0")

async def _unsettled_bills(
    db: AsyncSession, business_id: uuid.UUID, vendor_id: uuid.UUID | None = None
) -> list[Bill]:
    stmt = (
        select(Bill)
        .options(selectinload(Bill.settlements), selectinload(Bill.vendor))
        .where(
            Bill.business_id == business_id,
            Bill.status == BillStatus.VERIFIED,
            Bill.payment_status != PaymentStatus.PAID,
        )
    )
    if vendor_id:
        stmt = stmt.where(Bill.vendor_id == vendor_id)
    result = await db.execute(stmt)
    return result.scalars().all()

async def get_pending_bills(db: AsyncSession, business_id: uuid.UUID, vendor_id: uuid.UUID | None = None) -> list[dict]:
    today = datetime.now(UTC).date()
    bills = await _unsettled_bills(db, business_id, vendor_id)
    items = []
    for bill in bills:
        outstanding = _d(bill.total_amount) - sum(_d(s.amount) for s in bill.settlements)
        items.append({
            "id": bill.id,
            "vendor_id": bill.vendor_id,
            "vendor_name": bill.vendor.name if bill.vendor else None,
            "bill_number": bill.bill_number,
            "total_amount": float(_d(bill.total_amount)),
            "outstanding": float(outstanding),
            "due_date": bill.due_date,
            "days_remaining": (bill.due_date - today).days if bill.due_date else None,
            "payment_status": bill.payment_status,
        })
    items.sort(key=lambda i: (i["due_date"] is None, i["due_date"]))
    return items

async def get_overdue_bills(db: AsyncSession, business_id: uuid.UUID, vendor_id: uuid.UUID | None = None) -> list[dict]:
    today = datetime.now(UTC).date()
    bills = await _unsettled_bills(db, business_id, vendor_id)
    items = []
    for bill in bills:
        if not bill.due_date or bill.due_date >= today:
            continue
        outstanding = _d(bill.total_amount) - sum(_d(s.amount) for s in bill.settlements)
        items.append({
            "id": bill.id,
            "vendor_id": bill.vendor_id,
            "vendor_name": bill.vendor.name if bill.vendor else None,
            "bill_number": bill.bill_number,
            "total_amount": float(_d(bill.total_amount)),
            "outstanding": float(outstanding),
            "due_date": bill.due_date,
            "days_overdue": (today - bill.due_date).days,
            "payment_status": bill.payment_status,
        })
    items.sort(key=lambda i: i["days_overdue"], reverse=True)
    return items

async def get_payment_calendar(
    db: AsyncSession, business_id: uuid.UUID, date_from: date | None = None, date_to: date | None = None,
    vendor_id: uuid.UUID | None = None,
) -> list[dict]:
    stmt = (
        select(PaymentSchedule)
        .join(Bill, PaymentSchedule.bill_id == Bill.id)
        .options(selectinload(PaymentSchedule.bill).selectinload(Bill.vendor))
        .where(
            PaymentSchedule.business_id == business_id,
            PaymentSchedule.status.in_(
                [PaymentScheduleStatus.SCHEDULED, PaymentScheduleStatus.APPROVAL_PENDING,
                 PaymentScheduleStatus.APPROVED]
            ),
        )
    )
    if date_from:
        stmt = stmt.where(PaymentSchedule.scheduled_date >= date_from)
    if date_to:
        stmt = stmt.where(PaymentSchedule.scheduled_date <= date_to)
    if vendor_id:
        stmt = stmt.where(Bill.vendor_id == vendor_id)
    result = await db.execute(stmt)
    schedules = result.scalars().all()

    days: dict[date, dict] = {}
    for schedule in schedules:
        day = days.setdefault(schedule.scheduled_date, {"scheduled_date": schedule.scheduled_date,
                                                          "total": Decimal("0"), "items": []})
        day["total"] += _d(schedule.amount)
        day["items"].append({
            "payment_schedule_id": schedule.id,
            "bill_id": schedule.bill_id,
            "vendor_name": schedule.bill.vendor.name if schedule.bill and schedule.bill.vendor else None,
            "bill_number": schedule.bill.bill_number if schedule.bill else None,
            "amount": float(_d(schedule.amount)),
            "status": schedule.status.value,
        })

    return [
        {**day, "total": float(day["total"])}
        for day in sorted(days.values(), key=lambda d: d["scheduled_date"])
    ]

async def get_payment_history(
    db: AsyncSession, business_id: uuid.UUID, date_from: date | None = None, date_to: date | None = None,
    vendor_id: uuid.UUID | None = None,
) -> list[dict]:
    from app.models.bill_settlement import BillSettlement

    stmt = (
        select(BillSettlement)
        .join(Bill, BillSettlement.bill_id == Bill.id)
        .options(selectinload(BillSettlement.bill).selectinload(Bill.vendor))
        .where(BillSettlement.business_id == business_id)
    )
    if date_from:
        stmt = stmt.where(BillSettlement.paid_on >= date_from)
    if date_to:
        stmt = stmt.where(BillSettlement.paid_on <= date_to)
    if vendor_id:
        stmt = stmt.where(Bill.vendor_id == vendor_id)
    stmt = stmt.order_by(BillSettlement.paid_on.desc())
    result = await db.execute(stmt)
    settlements = result.scalars().all()

    schedule_ids = [s.payment_schedule_id for s in settlements if s.payment_schedule_id]
    approved_by_schedule: dict[uuid.UUID, uuid.UUID] = {}
    if schedule_ids:
        approvals_result = await db.execute(
            select(PaymentApproval).where(
                PaymentApproval.payment_schedule_id.in_(schedule_ids),
                PaymentApproval.status == ApprovalStatus.APPROVED,
            )
        )
        for approval in approvals_result.scalars().all():
            approved_by_schedule[approval.payment_schedule_id] = approval.decided_by

    items = []
    for s in settlements:
        items.append({
            "settlement_id": s.id,
            "bill_id": s.bill_id,
            "bill_number": s.bill.bill_number if s.bill else None,
            "vendor_id": s.bill.vendor_id if s.bill else None,
            "vendor_name": s.bill.vendor.name if s.bill and s.bill.vendor else None,
            "amount": float(_d(s.amount)),
            "paid_on": s.paid_on,
            "method": s.method,
            "reference": s.reference,
            "approved_by": approved_by_schedule.get(s.payment_schedule_id),
        })
    return items
