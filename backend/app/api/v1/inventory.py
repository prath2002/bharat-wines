import uuid
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.dependencies import get_current_user, require_permissions
from app.models.user import User
from app.services.inventory_service import InventoryService
from app.repositories.product_repo import ProductRepository
from app.repositories.movement_repo import MovementRepository
from app.utils.excel_export import generate_excel
from fastapi.responses import Response
from datetime import datetime

router = APIRouter()

@router.get("")
async def get_inventory(
    category: Optional[str] = None,
    min_stock: Optional[int] = None,
    max_stock: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("products.view"))
) -> Dict[str, Any]:
    inventory_service = InventoryService(db, current_user.business_id)
    product_repo = ProductRepository(db, current_user.business_id)
    
    # Get all products
    products = await product_repo.get_all(skip=0, limit=10000) # Fetch all active
    
    if category:
        products = [p for p in products if p.category == category]
        
    stock_map = await inventory_service.get_current_stock()
    
    result = []
    for p in products:
        pid = str(p.id)
        current_stock = stock_map.get(pid, 0)
        
        if min_stock is not None and current_stock < min_stock:
            continue
        if max_stock is not None and current_stock > max_stock:
            continue
            
        result.append({
            "product_id": pid,
            "product_name": p.name,
            "category": p.category,
            "size_ml": p.size_ml,
            "current_stock": current_stock,
            "mrp": float(p.mrp),
            "scm_code": p.scm_code
        })
        
    # Apply pagination
    paginated = result[skip : skip + limit]
    
    return {
        "data": paginated,
        "total": len(result),
        "has_more": skip + limit < len(result)
    }

@router.get("/export")
async def export_inventory(
    category: Optional[str] = None,
    min_stock: Optional[int] = None,
    max_stock: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("products.view"))
):
    # Reuse the same logic as get_inventory but without pagination
    inventory_service = InventoryService(db, current_user.business_id)
    product_repo = ProductRepository(db, current_user.business_id)
    
    products = await product_repo.get_all(skip=0, limit=10000)
    if category:
        products = [p for p in products if p.category == category]
        
    stock_map = await inventory_service.get_current_stock()
    
    headers = ["Product Name", "Category", "Size (ml)", "MRP", "SCM Code", "Current Stock"]
    rows = []
    
    for p in products:
        pid = str(p.id)
        current_stock = stock_map.get(pid, 0)
        
        if min_stock is not None and current_stock < min_stock:
            continue
        if max_stock is not None and current_stock > max_stock:
            continue
            
        rows.append([
            p.name,
            p.category,
            p.size_ml,
            float(p.mrp),
            p.scm_code or "",
            current_stock
        ])
        
    excel_bytes = generate_excel(headers, rows, sheet_name="Inventory Report")
    
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=Inventory_Report_{datetime.now().strftime('%Y%m%d')}.xlsx"
        }
    )

@router.get("/{product_id}")
async def get_product_inventory(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("products.view"))
) -> Dict[str, Any]:
    inventory_service = InventoryService(db, current_user.business_id)
    product_repo = ProductRepository(db, current_user.business_id)
    movement_repo = MovementRepository(db, current_user.business_id)
    
    product = await product_repo.get_by_id(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    stock_map = await inventory_service.get_current_stock(product_id)
    current_stock = stock_map.get(str(product_id), 0)
    
    # Get recent movements
    recent_movements = await movement_repo.get_all_with_joins(
        product_id=product_id,
        limit=10
    )
    
    def _format_movement(m):
        return {
            "id": str(m.id),
            "movement_type": m.movement_type.value,
            "quantity": m.quantity,
            "created_at": m.created_at,
            "user_name": m.user.name if m.user else None,
            "notes": m.notes
        }
    
    return {
        "product_id": str(product.id),
        "product_name": product.name,
        "category": product.category,
        "size_ml": product.size_ml,
        "current_stock": current_stock,
        "mrp": float(product.mrp),
        "recent_movements": [_format_movement(m) for m in recent_movements]
    }
