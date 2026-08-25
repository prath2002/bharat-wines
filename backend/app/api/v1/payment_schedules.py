import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import require_permissions
from app.db.session import get_db
from app.models.audit_log import ActionEnum
from app.models.bill import Bill
from app.models.payment_schedule import PaymentSchedule, PaymentScheduleStatus
from app.models.user import User
from app.schemas.payment import (
    PaymentApprovalResponse,
    PaymentCompleteRequest,
    PaymentScheduleCreateRequest,
    PaymentScheduleResponse,
    PaymentScheduleUpdateRequest,
)
from app.schemas.bill import SettlementResponse
from app.services import audit_service, payment_approval_service, payment_schedule_service

router = APIRouter()

def _to_response(schedule: PaymentSchedule) -> PaymentScheduleResponse:
    resp = PaymentScheduleResponse.model_validate(schedule)
    resp.vendor_name = schedule.bill.vendor.name if schedule.bill and schedule.bill.vendor else None
    return resp

@router.post("/bills/{bill_id}/payment-schedules", response_model=PaymentScheduleResponse,
             status_code=status.HTTP_201_CREATED)
async def create_payment_schedule(
    bill_id: uuid.UUID,
    payload: PaymentScheduleCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("finance.payments.schedule"))
):
    try:
        schedule = await payment_schedule_service.create_schedule(
            bill_id, payload.model_dump(), db, current_user.business_id, current_user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    await db.refresh(schedule, ["bill"])
    await db.refresh(schedule.bill, ["vendor"])
    await audit_service.record(
        db, current_user.id, current_user.business_id, ActionEnum.CREATE, "payment_schedule", schedule.id
    )
    return _to_response(schedule)

@router.get("/payment-schedules", response_model=list[PaymentScheduleResponse])
async def list_payment_schedules(
    bill_status: PaymentScheduleStatus | None = Query(None, alias="status"),
    vendor_id: uuid.UUID | None = Query(None),
    bill_id: uuid.UUID | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("finance.payments.schedule"))
):
    stmt = (
        select(PaymentSchedule)
        .join(Bill, PaymentSchedule.bill_id == Bill.id)
        .options(selectinload(PaymentSchedule.bill).selectinload(Bill.vendor))
        .where(PaymentSchedule.business_id == current_user.business_id)
    )
    if bill_status:
        stmt = stmt.where(PaymentSchedule.status == bill_status)
    if bill_id:
        stmt = stmt.where(PaymentSchedule.bill_id == bill_id)
    if vendor_id:
        stmt = stmt.where(Bill.vendor_id == vendor_id)
    if date_from:
        stmt = stmt.where(PaymentSchedule.scheduled_date >= date_from)
    if date_to:
        stmt = stmt.where(PaymentSchedule.scheduled_date <= date_to)
    stmt = stmt.order_by(PaymentSchedule.scheduled_date)

    result = await db.execute(stmt)
    return [_to_response(s) for s in result.scalars().all()]

@router.put("/payment-schedules/{schedule_id}", response_model=PaymentScheduleResponse)
async def update_payment_schedule(
    schedule_id: uuid.UUID,
    payload: PaymentScheduleUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("finance.payments.schedule"))
):
    data = payload.model_dump(exclude_unset=True)
    try:
        schedule = await payment_schedule_service.update_schedule(
            schedule_id, data, db, current_user.business_id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    await db.refresh(schedule, ["bill"])
    await db.refresh(schedule.bill, ["vendor"])
    await audit_service.record(
        db, current_user.id, current_user.business_id, ActionEnum.UPDATE, "payment_schedule", schedule.id, data
    )
    return _to_response(schedule)

@router.delete("/payment-schedules/{schedule_id}", response_model=PaymentScheduleResponse)
async def cancel_payment_schedule(
    schedule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("finance.payments.schedule"))
):
    try:
        schedule = await payment_schedule_service.cancel_schedule(schedule_id, db, current_user.business_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    await db.refresh(schedule, ["bill"])
    await db.refresh(schedule.bill, ["vendor"])
    await audit_service.record(
        db, current_user.id, current_user.business_id, ActionEnum.DELETE, "payment_schedule", schedule.id
    )
    return _to_response(schedule)

@router.post("/payment-schedules/{schedule_id}/submit-for-approval", response_model=PaymentApprovalResponse,
             status_code=status.HTTP_201_CREATED)
async def submit_for_approval(
    schedule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("finance.payments.schedule"))
):
    try:
        approval = await payment_approval_service.submit_for_approval(
            schedule_id, db, current_user.business_id, current_user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    await audit_service.record(
        db, current_user.id, current_user.business_id, ActionEnum.UPDATE, "payment_approval", approval.id,
        {"status": "PENDING"}
    )
    return approval

@router.post("/payment-schedules/{schedule_id}/complete", response_model=SettlementResponse,
             status_code=status.HTTP_201_CREATED)
async def complete_payment_schedule(
    schedule_id: uuid.UUID,
    payload: PaymentCompleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("finance.payments.complete"))
):
    try:
        settlement = await payment_schedule_service.complete_schedule(
            schedule_id, payload.model_dump(), db, current_user.business_id, current_user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    await audit_service.record(
        db, current_user.id, current_user.business_id, ActionEnum.CREATE, "payment", settlement.id
    )
    return settlement
