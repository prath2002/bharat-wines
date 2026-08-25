import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permissions
from app.db.session import get_db
from app.models.audit_log import ActionEnum
from app.models.payment_approval import ApprovalStatus, PaymentApproval
from app.models.user import User
from app.schemas.payment import ApprovalDecisionRequest, PaymentApprovalResponse
from app.services import audit_service, payment_approval_service

router = APIRouter()

@router.get("/payment-approvals", response_model=list[PaymentApprovalResponse])
async def list_payment_approvals(
    approval_status: ApprovalStatus | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("finance.payments.approve"))
):
    stmt = select(PaymentApproval).where(PaymentApproval.business_id == current_user.business_id)
    if approval_status:
        stmt = stmt.where(PaymentApproval.status == approval_status)
    stmt = stmt.order_by(PaymentApproval.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/payment-approvals/{approval_id}/approve", response_model=PaymentApprovalResponse)
async def approve_payment(
    approval_id: uuid.UUID,
    payload: ApprovalDecisionRequest | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("finance.payments.approve"))
):
    try:
        approval = await payment_approval_service.approve(
            approval_id, payload.notes if payload else None, db, current_user.business_id, current_user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    await audit_service.record(
        db, current_user.id, current_user.business_id, ActionEnum.APPROVE, "payment_approval", approval.id
    )
    return approval

@router.post("/payment-approvals/{approval_id}/reject", response_model=PaymentApprovalResponse)
async def reject_payment(
    approval_id: uuid.UUID,
    payload: ApprovalDecisionRequest | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("finance.payments.approve"))
):
    try:
        approval = await payment_approval_service.reject(
            approval_id, payload.notes if payload else None, db, current_user.business_id, current_user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    await audit_service.record(
        db, current_user.id, current_user.business_id, ActionEnum.REJECT, "payment_approval", approval.id
    )
    return approval

@router.post("/payment-approvals/{approval_id}/hold", response_model=PaymentApprovalResponse)
async def hold_payment(
    approval_id: uuid.UUID,
    payload: ApprovalDecisionRequest | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("finance.payments.approve"))
):
    try:
        approval = await payment_approval_service.hold(
            approval_id, payload.notes if payload else None, db, current_user.business_id, current_user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    await audit_service.record(
        db, current_user.id, current_user.business_id, ActionEnum.UPDATE, "payment_approval", approval.id,
        {"status": "ON_HOLD"}
    )
    return approval
