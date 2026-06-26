from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
import uuid
from typing import List, Optional

from app.db.session import get_db
from app.core.dependencies import get_current_user, require_permissions
from app.models.user import User
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse, ProductListResponse
from app.repositories.product_repo import ProductRepository
from app.repositories.barcode_repo import BarcodeRepository
from app.repositories.movement_repo import MovementRepository

router = APIRouter()

@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    data: ProductCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("products.create"))
):
    repo = ProductRepository(db, current_user.business_id)
    
    # Check duplicate scm_code
    existing_scm = await repo.get_by_scm_code(data.scm_code)
    if existing_scm:
        raise HTTPException(status_code=409, detail="SCM code already exists")
    
    product = await repo.create(data.model_dump())
    await db.commit()
    return product

@router.get("", response_model=ProductListResponse)
async def list_products(
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("products.view"))
):
    repo = ProductRepository(db, current_user.business_id)
    
    if search:
        products = await repo.search_by_name(search, limit=limit)
    else:
        products = await repo.get_all(skip=skip, limit=limit)
        
    # We should get total count but simplified for V1
    return {
        "data": products,
        "total": len(products),
        "has_more": len(products) == limit
    }

@router.get("/{id}", response_model=ProductResponse)
async def get_product(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("products.view"))
):
    product_repo = ProductRepository(db, current_user.business_id)
    barcode_repo = BarcodeRepository(db, current_user.business_id)
    movement_repo = MovementRepository(db, current_user.business_id)
    
    product = await product_repo.get_by_id(id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    barcodes = await barcode_repo.get_by_product(id)
    inventory = await movement_repo.aggregate_inventory(id)
    
    product_dict = {
        **product.__dict__,
        "barcodes": barcodes,
        "current_stock": inventory.get(id, 0)
    }
    return product_dict

@router.put("/{id}", response_model=ProductResponse)
async def update_product(
    id: uuid.UUID,
    data: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("products.edit"))
):
    repo = ProductRepository(db, current_user.business_id)
    product = await repo.get_by_id(id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    updated = await repo.update(product, data.model_dump(exclude_unset=True))
    await db.commit()
    return updated

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_product(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("products.delete"))
):
    repo = ProductRepository(db, current_user.business_id)
    product = await repo.deactivate(id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    await db.commit()
    return None
