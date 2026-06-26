import uuid
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.stock_movement import MovementType, StockMovement
from app.models.product import ProductStatus
from app.models.audit_log import ActionEnum
from app.repositories.product_repo import ProductRepository
from app.repositories.movement_repo import MovementRepository
from app.services.audit_service import log_action
from app.integrations.redis import cache_delete

async def create_movement(
    db: AsyncSession,
    business_id: uuid.UUID,
    user_id: uuid.UUID,
    product_id: uuid.UUID,
    movement_type: MovementType,
    quantity: int,
    batch_number: Optional[str] = None,
    reference_id: Optional[uuid.UUID] = None,
    reference_type: Optional[str] = None,
    notes: Optional[str] = None,
    ip_address: Optional[str] = None,
    is_system: bool = False
) -> StockMovement:
    if quantity <= 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Quantity must be greater than 0"
        )

    # API endpoints only allow these; system processes (TP, Import) can use others
    allowed_types = {MovementType.SALE, MovementType.RETURN, MovementType.DAMAGE, MovementType.ADJUSTMENT}
    if not is_system and movement_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Manual creation of {movement_type.value} is not allowed"
        )

    product_repo = ProductRepository(db, business_id)
    product = await product_repo.get_by_id(product_id)
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
        
    if product.status == ProductStatus.INACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot create movement for inactive product"
        )

    movement_repo = MovementRepository(db, business_id)
    movement_data = {
        "product_id": product_id,
        "movement_type": movement_type,
        "quantity": quantity,
        "batch_number": batch_number,
        "reference_id": reference_id,
        "reference_type": reference_type,
        "notes": notes,
        "created_by": user_id
    }
    
    movement = await movement_repo.create(movement_data)
    
    # Invalidate inventory cache
    await cache_delete(f"inv:{business_id}:{product_id}")
    await cache_delete(f"inv:{business_id}:all")

    # Audit log
    await log_action(
        db=db,
        user_id=user_id,
        business_id=business_id,
        action=ActionEnum.CREATE,
        entity_type="stock_movement",
        entity_id=movement.id,
        changes={"new": {"type": movement_type.value, "qty": quantity}},
        ip_address=ip_address
    )
    
    return movement
