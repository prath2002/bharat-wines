import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permissions
from app.db.session import get_db
from app.models.user import User
from app.models.vendor import Vendor
from app.schemas.bill import VendorCreateRequest, VendorResponse, VendorUpdateRequest
from app.services.bill_service import get_or_create_vendor
from app.workers.bill_processing import normalize_vendor_name

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
    if payload.gstin:
        vendor.gstin = payload.gstin
    await db.commit()
    await db.refresh(vendor)
    return vendor

@router.put("/{vendor_id}", response_model=VendorResponse)
async def update_vendor(
    vendor_id: uuid.UUID,
    payload: VendorUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("vendors.manage"))
):
    result = await db.execute(
        select(Vendor).where(Vendor.id == vendor_id, Vendor.business_id == current_user.business_id)
    )
    vendor = result.scalar_one_or_none()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    if payload.name:
        vendor.name = payload.name.strip()
        vendor.normalized_name = normalize_vendor_name(payload.name)
    if payload.gstin is not None:
        vendor.gstin = payload.gstin

    await db.commit()
    await db.refresh(vendor)
    return vendor
