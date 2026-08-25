import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.approval_rule import ApprovalRule
from app.models.payment_approval import ApprovalStatus, PaymentApproval
from app.models.payment_schedule import PaymentScheduleStatus
from app.services.payment_schedule_service import EDITABLE_STATUSES, get_schedule

async def _resolve_rule(amount: Decimal, db: AsyncSession, business_id: uuid.UUID) -> ApprovalRule | None:
    result = await db.execute(
        select(ApprovalRule).where(
            ApprovalRule.business_id == business_id,
            ApprovalRule.is_active.is_(True),
            ApprovalRule.min_amount <= amount,
        )
    )
    candidates = result.scalars().all()
    matches = [r for r in candidates if r.max_amount is None or Decimal(str(r.max_amount)) >= amount]
    # Prefer the narrowest band (smallest range) if multiple rules match.
    matches.sort(key=lambda r: (Decimal(str(r.max_amount)) if r.max_amount is not None else Decimal("Infinity")) - Decimal(str(r.min_amount)))
    return matches[0] if matches else None

async def get_approval(approval_id: uuid.UUID, db: AsyncSession, business_id: uuid.UUID) -> PaymentApproval:
    result = await db.execute(
        select(PaymentApproval).where(
            PaymentApproval.id == approval_id, PaymentApproval.business_id == business_id
        )
    )
    approval = result.scalar_one_or_none()
    if not approval:
        raise ValueError("Payment approval not found")
    return approval

async def submit_for_approval(
    schedule_id: uuid.UUID, db: AsyncSession, business_id: uuid.UUID, user_id: uuid.UUID
) -> PaymentApproval:
    schedule = await get_schedule(schedule_id, db, business_id)
    if schedule.status not in EDITABLE_STATUSES:
        raise ValueError(f"Cannot submit a schedule in {schedule.status.name} status for approval")

    rule = await _resolve_rule(Decimal(str(schedule.amount)), db, business_id)
    approval = PaymentApproval(
        business_id=business_id,
        payment_schedule_id=schedule.id,
        status=ApprovalStatus.PENDING,
        requested_by=user_id,
        approval_rule_id=rule.id if rule else None,
    )
    db.add(approval)
    schedule.status = PaymentScheduleStatus.APPROVAL_PENDING
    await db.commit()
    await db.refresh(approval)
    return approval

async def _decide(
    approval_id: uuid.UUID, new_status: ApprovalStatus, schedule_status: PaymentScheduleStatus,
    notes: str | None, db: AsyncSession, business_id: uuid.UUID, user_id: uuid.UUID
) -> PaymentApproval:
    approval = await get_approval(approval_id, db, business_id)
    if approval.status != ApprovalStatus.PENDING:
        raise ValueError(f"Cannot decide an approval in {approval.status.name} status")

    schedule = await get_schedule(approval.payment_schedule_id, db, business_id)

    approval.status = new_status
    approval.decided_by = user_id
    approval.decided_at = datetime.now(UTC)
    if notes is not None:
        approval.notes = notes
    schedule.status = schedule_status

    await db.commit()
    await db.refresh(approval)
    return approval

async def approve(
    approval_id: uuid.UUID, notes: str | None, db: AsyncSession, business_id: uuid.UUID, user_id: uuid.UUID
) -> PaymentApproval:
    return await _decide(
        approval_id, ApprovalStatus.APPROVED, PaymentScheduleStatus.APPROVED, notes, db, business_id, user_id
    )

async def reject(
    approval_id: uuid.UUID, notes: str | None, db: AsyncSession, business_id: uuid.UUID, user_id: uuid.UUID
) -> PaymentApproval:
    return await _decide(
        approval_id, ApprovalStatus.REJECTED, PaymentScheduleStatus.CANCELLED, notes, db, business_id, user_id
    )

async def hold(
    approval_id: uuid.UUID, notes: str | None, db: AsyncSession, business_id: uuid.UUID, user_id: uuid.UUID
) -> PaymentApproval:
    return await _decide(
        approval_id, ApprovalStatus.ON_HOLD, PaymentScheduleStatus.ON_HOLD, notes, db, business_id, user_id
    )
