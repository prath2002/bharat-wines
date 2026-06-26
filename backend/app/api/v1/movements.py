import uuid
from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, Query, Request, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.dependencies import get_current_user, require_permissions
from app.models.user import User
from app.models.stock_movement import MovementType
from app.schemas.movement import MovementCreate, MovementResponse, MovementListResponse
from app.services.movement_service import create_movement
from app.repositories.movement_repo import MovementRepository
from app.utils.excel_export import generate_excel
from fastapi.responses import Response

router = APIRouter()

def _format_movement_response(movement) -> dict:
    data = movement.__dict__.copy()
    if movement.product:
        data["product_name"] = movement.product.name
    if movement.user:
        data["user_name"] = movement.user.name
    return data

@router.post("", response_model=MovementResponse, status_code=status.HTTP_201_CREATED)
async def api_create_movement(
    request: Request,
    data: MovementCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("movements.create"))
):
    ip_address = request.client.host if request.client else "unknown"
    
    movement = await create_movement(
        db=db,
        business_id=current_user.business_id,
        user_id=current_user.id,
        product_id=data.product_id,
        movement_type=data.movement_type,
        quantity=data.quantity,
        notes=data.notes,
        ip_address=ip_address,
        is_system=False
    )
    
    # Needs a commit because create_movement does a flush
    await db.commit()
    
    # We refetch the movement with joins to get product_name and user_name
    repo = MovementRepository(db, current_user.business_id)
    movement = await repo.get_by_id(movement.id)
    return _format_movement_response(movement)

@router.get("", response_model=MovementListResponse)
async def list_movements(
    product_id: Optional[uuid.UUID] = None,
    movement_type: Optional[MovementType] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("movements.view"))
):
    repo = MovementRepository(db, current_user.business_id)
    
    movements = await repo.get_all_with_joins(product_id, movement_type, start_date, end_date, limit)
    
    formatted = [_format_movement_response(m) for m in movements]
    return {
        "data": formatted,
        "total": len(formatted),
        "has_more": len(formatted) == limit
    }

@router.get("/export")
async def export_movements(
    product_id: Optional[uuid.UUID] = None,
    movement_type: Optional[MovementType] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("movements.view"))
):
    repo = MovementRepository(db, current_user.business_id)
    # Fetch all matching movements (up to a reasonable limit for export, like 10000)
    movements = await repo.get_all_with_joins(product_id, movement_type, start_date, end_date, limit=10000)
    
    headers = ["Date", "Type", "Product", "Quantity", "User", "Notes"]
    rows = []
    
    for m in movements:
        formatted = _format_movement_response(m)
        rows.append([
            formatted.get("created_at").strftime("%Y-%m-%d %H:%M:%S") if formatted.get("created_at") else "",
            formatted.get("movement_type", ""),
            formatted.get("product_name", ""),
            formatted.get("quantity", 0),
            formatted.get("user_name", "System"),
            formatted.get("notes", "")
        ])
        
    excel_bytes = generate_excel(headers, rows, sheet_name="Movements History")
    
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=Movements_{datetime.now().strftime('%Y%m%d')}.xlsx"
        }
    )

@router.get("/{id}", response_model=MovementResponse)
async def get_movement(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("movements.view"))
):
    repo = MovementRepository(db, current_user.business_id)
    movement = await repo.get_by_id(id)
    if not movement:
        raise HTTPException(status_code=404, detail="Movement not found")
    return _format_movement_response(movement)
