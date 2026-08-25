import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permissions
from app.db.session import get_db
from app.models.audit_log import ActionEnum
from app.models.user import User
from app.models.vendor import Vendor
from app.schemas.vendor import VendorCreateRequest, VendorResponse, VendorStatementResponse, VendorUpdateRequest
from app.services import audit_service, vendor_service
from app.services.bill_service import get_or_create_vendor

router = APIRouter()

@router.get("", response_model=list[VendorResponse])
async def list_vendors(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("vendors.view"))
):
    result = await db.execute(
        select(Vendor).where(Vendor.business_id == current_user.business_id).order_by(Vendor.name)
    )
    return result.scalars().all()

@router.post("", response_model=VendorResponse, status_code=status.HTTP_201_CREATED)
async def create_vendor(
    payload: VendorCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("vendors.manage"))
):
    try:
        vendor = await get_or_create_vendor(payload.name, db, current_user.business_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    data = payload.model_dump(exclude_unset=True, exclude={"name"})
    for field in vendor_service.VENDOR_EDITABLE_FIELDS & data.keys():
        setattr(vendor, field, data[field])

    await db.commit()
    await db.refresh(vendor)
    await audit_service.record(db, current_user.id, current_user.business_id, ActionEnum.CREATE, "vendor", vendor.id)
    return vendor

@router.get("/{vendor_id}", response_model=VendorResponse)
async def get_vendor(
    vendor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("vendors.view"))
):
    try:
        return await vendor_service.get_vendor(vendor_id, db, current_user.business_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

@router.get("/{vendor_id}/statement", response_model=VendorStatementResponse)
async def get_vendor_statement(
    vendor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("vendors.view"))
):
    try:
        return await vendor_service.get_vendor_statement(vendor_id, db, current_user.business_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

@router.put("/{vendor_id}", response_model=VendorResponse)
async def update_vendor(
    vendor_id: uuid.UUID,
    payload: VendorUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("vendors.manage"))
):
    data = payload.model_dump(exclude_unset=True)
    try:
        vendor = await vendor_service.update_vendor_fields(vendor_id, data, db, current_user.business_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    await audit_service.record(
        db, current_user.id, current_user.business_id, ActionEnum.UPDATE, "vendor", vendor.id, data
    )
    return vendor
