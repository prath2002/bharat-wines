import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.bill import Bill, BillStatus
from app.models.bill_settlement import BillSettlement
from app.models.payment_schedule import PaymentSchedule, PaymentScheduleStatus
from app.services.bill_service import derive_payment_status

ACTIVE_SCHEDULE_STATUSES = (
    PaymentScheduleStatus.PENDING, PaymentScheduleStatus.SCHEDULED,
    PaymentScheduleStatus.APPROVAL_PENDING, PaymentScheduleStatus.APPROVED,
)
EDITABLE_STATUSES = (PaymentScheduleStatus.PENDING, PaymentScheduleStatus.SCHEDULED)

def _d(value) -> Decimal:
    return Decimal(str(value)) if value is not None else Decimal("0")

async def _get_bill(bill_id: uuid.UUID, db: AsyncSession, business_id: uuid.UUID) -> Bill:
    result = await db.execute(
        select(Bill)
        .options(selectinload(Bill.settlements), selectinload(Bill.payment_schedules))
        .where(Bill.id == bill_id, Bill.business_id == business_id)
    )
    bill = result.scalar_one_or_none()
    if not bill:
        raise ValueError("Bill not found")
    return bill

async def get_schedule(schedule_id: uuid.UUID, db: AsyncSession, business_id: uuid.UUID) -> PaymentSchedule:
    result = await db.execute(
        select(PaymentSchedule).where(
            PaymentSchedule.id == schedule_id, PaymentSchedule.business_id == business_id
        )
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise ValueError("Payment schedule not found")
    return schedule

def _committed_amount(bill: Bill, exclude_schedule_id: uuid.UUID | None = None) -> Decimal:
    paid = sum(_d(s.amount) for s in bill.settlements)
    scheduled = sum(
        _d(s.amount) for s in bill.payment_schedules
        if s.status in ACTIVE_SCHEDULE_STATUSES and s.id != exclude_schedule_id
    )
    return paid + scheduled

async def create_schedule(
    bill_id: uuid.UUID, data: dict, db: AsyncSession, business_id: uuid.UUID, user_id: uuid.UUID
) -> PaymentSchedule:
    """No partial payments: a bill is paid in full or not at all, so exactly
    one active schedule/payment can exist per bill, always for the full
    amount."""
    bill = await _get_bill(bill_id, db, business_id)
    if bill.status != BillStatus.VERIFIED:
        raise ValueError("Payments can only be scheduled against verified bills")

    if _committed_amount(bill) > 0:
        raise ValueError("This bill already has a payment scheduled or paid")

    amount = _d(data["amount"])
    if bill.total_amount is not None and amount != _d(bill.total_amount):
        raise ValueError(f"Scheduled amount must be the full bill amount: {bill.total_amount}")

    schedule = PaymentSchedule(
        business_id=business_id,
        bill_id=bill.id,
        amount=amount,
        scheduled_date=data["scheduled_date"],
        status=PaymentScheduleStatus.SCHEDULED,
        notes=data.get("notes"),
        created_by=user_id,
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    return schedule

async def update_schedule(
    schedule_id: uuid.UUID, data: dict, db: AsyncSession, business_id: uuid.UUID
) -> PaymentSchedule:
    schedule = await get_schedule(schedule_id, db, business_id)
    if schedule.status not in EDITABLE_STATUSES:
        raise ValueError(f"Cannot edit a schedule in {schedule.status.name} status")

    bill = await _get_bill(schedule.bill_id, db, business_id)
    new_amount = _d(data["amount"]) if data.get("amount") is not None else _d(schedule.amount)
    if data.get("amount") is not None and bill.total_amount is not None and new_amount != _d(bill.total_amount):
        raise ValueError(f"Scheduled amount must be the full bill amount: {bill.total_amount}")

    if data.get("amount") is not None:
        schedule.amount = new_amount
    if data.get("scheduled_date") is not None:
        schedule.scheduled_date = data["scheduled_date"]
    if "notes" in data:
        schedule.notes = data["notes"]

    await db.commit()
    await db.refresh(schedule)
    return schedule

async def cancel_schedule(schedule_id: uuid.UUID, db: AsyncSession, business_id: uuid.UUID) -> PaymentSchedule:
    schedule = await get_schedule(schedule_id, db, business_id)
    if schedule.status == PaymentScheduleStatus.PAID:
        raise ValueError("Cannot cancel a schedule that has already been paid")
    schedule.status = PaymentScheduleStatus.CANCELLED
    await db.commit()
    await db.refresh(schedule)
    return schedule

COMPLETABLE_STATUSES = (PaymentScheduleStatus.SCHEDULED, PaymentScheduleStatus.APPROVED)

async def complete_schedule(
    schedule_id: uuid.UUID, data: dict, db: AsyncSession, business_id: uuid.UUID, user_id: uuid.UUID
) -> BillSettlement:
    """Turns a SCHEDULED (or, if it went through approval, APPROVED) schedule
    into an actual completed payment. The payment amount is always the
    schedule's amount — completion fulfills what was scheduled, it doesn't
    renegotiate it. Approval is optional, not required: a schedule can be
    marked paid directly once it's due."""
    schedule = await get_schedule(schedule_id, db, business_id)
    if schedule.status not in COMPLETABLE_STATUSES:
        raise ValueError(f"Cannot complete a schedule in {schedule.status.name} status")

    bill = await _get_bill(schedule.bill_id, db, business_id)

    settlement = BillSettlement(
        business_id=business_id,
        bill_id=bill.id,
        payment_schedule_id=schedule.id,
        amount=schedule.amount,
        paid_on=data["paid_on"],
        method=data["method"],
        reference=data.get("reference"),
        notes=data.get("notes"),
        created_by=user_id,
    )
    db.add(settlement)
    schedule.status = PaymentScheduleStatus.PAID
    bill.payment_status = derive_payment_status(bill.total_amount, list(bill.settlements) + [settlement])

    await db.commit()
    await db.refresh(settlement)
    return settlement
