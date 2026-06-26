from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
import uuid
from typing import List

from app.db.session import get_db
from app.core.dependencies import get_current_user, require_permissions
from app.models.user import User
from app.schemas.product import BarcodeCreate, BarcodeResponse, ProductResponse
from app.repositories.barcode_repo import BarcodeRepository
from app.repositories.product_repo import ProductRepository
from app.repositories.unknown_barcode_repo import UnknownBarcodeRepository

router = APIRouter()

@router.post("/products/{id}/barcodes", response_model=BarcodeResponse, status_code=status.HTTP_201_CREATED)
async def map_barcode(
    id: uuid.UUID,
    data: BarcodeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("products.edit"))
):
    product_repo = ProductRepository(db, current_user.business_id)
    barcode_repo = BarcodeRepository(db, current_user.business_id)
    
    product = await product_repo.get_by_id(id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    # Check if barcode is already mapped globally for this business
    existing = await barcode_repo.lookup(data.barcode_value)
    if existing:
        raise HTTPException(status_code=409, detail="Barcode already mapped")
        
    barcode_data = data.model_dump()
    barcode_data["product_id"] = id
    barcode = await barcode_repo.create(barcode_data)
    await db.commit()
    return barcode

@router.get("/products/{id}/barcodes", response_model=List[BarcodeResponse])
async def list_barcodes(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("products.view"))
):
    repo = BarcodeRepository(db, current_user.business_id)
    barcodes = await repo.get_by_product(id)
    return barcodes

@router.delete("/barcodes/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_barcode(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("products.edit"))
):
    repo = BarcodeRepository(db, current_user.business_id)
    barcode = await repo.deactivate(id)
    if not barcode:
        raise HTTPException(status_code=404, detail="Barcode not found")
    await db.commit()
    return None

@router.get("/barcodes/lookup", response_model=ProductResponse)
async def lookup_barcode(
    value: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("products.view"))
):
    repo = BarcodeRepository(db, current_user.business_id)
    product = await repo.lookup(value)
    if not product:
        # Auto-capture unknown barcode
        unknown_repo = UnknownBarcodeRepository(db, current_user.business_id)
        await unknown_repo.log_unknown(value, current_user.id)
        raise HTTPException(status_code=404, detail="Product not found for barcode")
    return product
