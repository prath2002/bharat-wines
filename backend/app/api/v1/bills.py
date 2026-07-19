import uuid
from datetime import date
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_current_user, require_permissions, ROLE_PERMISSIONS
from app.db.session import get_db
from app.models.user import User
from app.models.bill import Bill, BillStatus, PaymentStatus
from app.models.bill_settlement import BillSettlement
from app.models.vendor import Vendor
from app.schemas.bill import (
    BillResponse, BillDetailResponse, BillLimitedResponse, BillUpdateRequest,
    VerifyRequest, SettlementCreateRequest, SettlementResponse,
)
from app.services import bill_service
from app.services.finance_dashboard_service import get_finance_summary

router = APIRouter()

def _can_view_all(user: User) -> bool:
    perms = ROLE_PERMISSIONS.get(user.role.value, [])
    return "bills.*" in perms or "bills.view" in perms

def _require_any_bill_view(current_user: User = Depends(get_current_user)) -> User:
    perms = ROLE_PERMISSIONS.get(current_user.role.value, [])
    if not ("bills.*" in perms or "bills.view" in perms or "bills.view_own" in perms):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Operation not permitted")
    return current_user

def _paid_amount(bill: Bill) -> float:
    return float(sum(Decimal(str(s.amount)) for s in bill.settlements))

def _full_response(bill: Bill) -> BillResponse:
    resp = BillResponse.model_validate(bill)
    resp.vendor_name = bill.vendor.name if bill.vendor else None
    resp.amount_paid = _paid_amount(bill)
    return resp

@router.post("/upload")
async def upload_bill(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("bills.upload"))
):
    if not current_user.business_id:
        raise HTTPException(status_code=400, detail="User not associated with a business")
    try:
        bill = await bill_service.upload_bill(file, db, current_user.business_id, current_user.id)
        return {"id": bill.id, "status": bill.status.name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/summary")
async def finance_summary(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    vendor_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("finance.dashboard"))
):
    return await get_finance_summary(db, current_user.business_id, date_from, date_to, vendor_id)

@router.get("")
async def list_bills(
    bill_status: Optional[BillStatus] = Query(None, alias="status"),
    payment_status: Optional[PaymentStatus] = Query(None),
    vendor_id: Optional[uuid.UUID] = Query(None),
    uploaded_by: Optional[uuid.UUID] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_require_any_bill_view)
):
    view_all = _can_view_all(current_user)

    stmt = select(Bill).where(Bill.business_id == current_user.business_id)

    if not view_all:
        # STAFF: own uploads only
        stmt = stmt.where(Bill.uploaded_by == current_user.id)
    else:
        if vendor_id:
            stmt = stmt.where(Bill.vendor_id == vendor_id)
        if payment_status:
            stmt = stmt.where(Bill.payment_status == payment_status)
        if uploaded_by:
            stmt = stmt.where(Bill.uploaded_by == uploaded_by)

    if bill_status:
        stmt = stmt.where(Bill.status == bill_status)
    if date_from:
        stmt = stmt.where(Bill.created_at >= date_from)
    if date_to:
        stmt = stmt.where(func.date(Bill.created_at) <= date_to)

    count_result = await db.execute(select(func.count()).select_from(stmt.subquery()))
    total = count_result.scalar_one()

    stmt = stmt.order_by(Bill.created_at.desc()).limit(limit).offset(offset)
    if view_all:
        stmt = stmt.options(selectinload(Bill.settlements), selectinload(Bill.vendor))

    result = await db.execute(stmt)
    bills = result.scalars().all()

    if view_all:
        items = [_full_response(b) for b in bills]
    else:
        items = [BillLimitedResponse.model_validate(b) for b in bills]

    return {"items": items, "total": total, "limit": limit, "offset": offset}

@router.get("/{bill_id}")
async def get_bill(
    bill_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_require_any_bill_view)
):
    stmt = (
        select(Bill)
        .options(selectinload(Bill.settlements), selectinload(Bill.vendor))
        .where(Bill.id == bill_id, Bill.business_id == current_user.business_id)
    )
    result = await db.execute(stmt)
    bill = result.scalar_one_or_none()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    if not _can_view_all(current_user):
        if bill.uploaded_by != current_user.id:
            raise HTTPException(status_code=404, detail="Bill not found")
        return BillLimitedResponse.model_validate(bill)

    resp = BillDetailResponse.model_validate(bill)
    resp.vendor_name = bill.vendor.name if bill.vendor else None
    resp.amount_paid = _paid_amount(bill)
    return resp

@router.put("/{bill_id}", response_model=BillResponse)
async def update_bill(
    bill_id: uuid.UUID,
    payload: BillUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("bills.review"))
):
    data = payload.model_dump(exclude_unset=True)
    if "charges" in data and data["charges"] is not None:
        data["charges"] = [c if isinstance(c, dict) else c for c in data["charges"]]
    try:
        bill = await bill_service.update_bill_fields(bill_id, data, db, current_user.business_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await db.refresh(bill, ["settlements", "vendor"])
    return _full_response(bill)

@router.post("/{bill_id}/verify", response_model=BillResponse)
async def verify_bill(
    bill_id: uuid.UUID,
    payload: VerifyRequest | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("bills.review"))
):
    vendor_name = payload.vendor_name if payload else None
    try:
        bill = await bill_service.verify_bill(bill_id, db, current_user.business_id, current_user.id, vendor_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await db.refresh(bill, ["settlements", "vendor"])
    return _full_response(bill)

@router.post("/{bill_id}/reject", response_model=BillResponse)
async def reject_bill(
    bill_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("bills.review"))
):
    try:
        bill = await bill_service.reject_bill(bill_id, db, current_user.business_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    await db.refresh(bill, ["settlements", "vendor"])
    return _full_response(bill)

@router.post("/{bill_id}/settlements", response_model=SettlementResponse, status_code=status.HTTP_201_CREATED)
async def add_settlement(
    bill_id: uuid.UUID,
    payload: SettlementCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("bills.pay"))
):
    try:
        settlement = await bill_service.add_settlement(
            bill_id, payload.model_dump(), db, current_user.business_id, current_user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return settlement

@router.delete("/settlements/{settlement_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_settlement(
    settlement_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("bills.pay"))
):
    try:
        await bill_service.delete_settlement(settlement_id, db, current_user.business_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
