import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.stock_movement import StockMovement as Movement, MovementType
from app.services.inventory_service import InventoryService

class DashboardService:
    def __init__(self, db: AsyncSession, business_id: uuid.UUID):
        self.db = db
        self.business_id = business_id
        self.inventory_service = InventoryService(db, business_id)

    async def get_summary_stats(self) -> dict:
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Count movements today by type
        stmt = select(Movement.movement_type, func.count(Movement.id)).where(
            Movement.business_id == self.business_id,
            Movement.created_at >= today
        ).group_by(Movement.movement_type)
        
        result = await self.db.execute(stmt)
        counts_by_type = dict(result.all())
        
        # Calculate derived counts
        sales_count = counts_by_type.get(MovementType.SALE, 0)
        returns_count = counts_by_type.get(MovementType.RETURN, 0)
        damage_count = counts_by_type.get(MovementType.DAMAGE, 0)
        purchase_count = counts_by_type.get(MovementType.PURCHASE, 0) + counts_by_type.get(MovementType.OPENING, 0)
        
        # Low stock count
        low_stock_items = await self.inventory_service.get_low_stock(threshold=10)
        low_stock_count = len(low_stock_items)
        
        # Mocking TPs and MRPs since they aren't built yet
        pending_tp_count = 0
        pending_mrp_count = 0
        
        return {
            "today_sales": sales_count,
            "today_purchases": purchase_count,
            "today_returns": returns_count,
            "today_damage": damage_count,
            "low_stock_count": low_stock_count,
            "pending_tp_count": pending_tp_count,
            "pending_mrp_count": pending_mrp_count
        }
