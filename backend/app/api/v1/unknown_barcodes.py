from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
import uuid
from typing import List, Any, Dict
from pydantic import BaseModel

from app.db.session import get_db
from app.core.dependencies import get_current_user, require_permissions
from app.models.user import User
from app.repositories.unknown_barcode_repo import UnknownBarcodeRepository
from app.repositories.barcode_repo import BarcodeRepository
from app.repositories.product_repo import ProductRepository

router = APIRouter()

class MapUnknownBarcodeRequest(BaseModel):
    product_id: uuid.UUID

@router.get("", response_model=Dict[str, Any])
async def list_unknown_barcodes(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("products.view"))
):
    repo = UnknownBarcodeRepository(db, current_user.business_id)
    records = await repo.get_pending(skip=skip, limit=limit)
    
    return {
        "data": [
            {
                "id": str(r.id),
                "barcode_value": r.barcode_value,
                "scanned_at": r.scanned_at,
                "status": r.status
            }
            for r in records
        ],
        "total": len(records),
        "has_more": len(records) == limit
    }

@router.post("/{id}/map", status_code=status.HTTP_200_OK)
async def map_unknown_barcode(
    id: uuid.UUID,
    data: MapUnknownBarcodeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("products.edit"))
):
    repo = UnknownBarcodeRepository(db, current_user.business_id)
    barcode_repo = BarcodeRepository(db, current_user.business_id)
    product_repo = ProductRepository(db, current_user.business_id)
    
    record = await repo.get_by_id(id)
    if not record:
        raise HTTPException(status_code=404, detail="Unknown barcode record not found")
        
    product = await product_repo.get_by_id(data.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    # Check if already globally mapped
    existing = await barcode_repo.lookup(record.barcode_value)
    if existing:
        # It's already mapped now (maybe by someone else), so just mark this ignored/mapped
        await repo.mark_ignored(id)
        await db.commit()
        raise HTTPException(status_code=409, detail="Barcode is already mapped to a product")
        
    # Add mapping
    await barcode_repo.create({
        "product_id": data.product_id,
        "barcode_value": record.barcode_value,
        "barcode_format": "EAN13" # Using a valid enum value
    })
    
    await repo.mark_mapped(id, data.product_id)
    await db.commit()
    
    return {"message": "Barcode successfully mapped"}

@router.post("/{id}/ignore", status_code=status.HTTP_200_OK)
async def ignore_unknown_barcode(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("products.edit"))
):
    repo = UnknownBarcodeRepository(db, current_user.business_id)
    record = await repo.mark_ignored(id)
    if not record:
        raise HTTPException(status_code=404, detail="Unknown barcode record not found")
        
    await db.commit()
    return {"message": "Barcode ignored"}
