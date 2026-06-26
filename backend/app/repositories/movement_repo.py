from typing import Optional, Sequence, Dict
import uuid
from datetime import datetime
from sqlalchemy import select, func, case, desc
from sqlalchemy.orm import joinedload
from app.repositories.base import BaseRepository
from app.models.stock_movement import StockMovement, MovementType
from app.models.product import Product

class MovementRepository(BaseRepository[StockMovement]):
    def __init__(self, db_session, business_id: uuid.UUID):
        super().__init__(StockMovement, db_session, business_id)

    async def get_by_id(self, id: uuid.UUID) -> Optional[StockMovement]:
        stmt = select(self.model).options(
            joinedload(self.model.product),
            joinedload(self.model.user)
        ).where(
            self.model.id == id,
            self.model.business_id == self.business_id
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all_with_joins(
        self,
        product_id: Optional[uuid.UUID] = None,
        movement_type: Optional[MovementType] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100
    ) -> Sequence[StockMovement]:
        stmt = select(self.model).options(
            joinedload(self.model.product),
            joinedload(self.model.user)
        ).where(self.model.business_id == self.business_id)

        if product_id:
            stmt = stmt.where(self.model.product_id == product_id)
        if movement_type:
            stmt = stmt.where(self.model.movement_type == movement_type)
        if start_date:
            stmt = stmt.where(self.model.created_at >= start_date)
        if end_date:
            stmt = stmt.where(self.model.created_at <= end_date)

        stmt = stmt.order_by(desc(self.model.created_at)).limit(limit)
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_by_product(self, product_id: uuid.UUID, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None, limit: int = 100) -> Sequence[StockMovement]:
        stmt = select(self.model).options(joinedload(self.model.user)).where(
            self.model.business_id == self.business_id,
            self.model.product_id == product_id
        ).order_by(desc(self.model.created_at)).limit(limit)
        
        if start_date:
            stmt = stmt.where(self.model.created_at >= start_date)
        if end_date:
            stmt = stmt.where(self.model.created_at <= end_date)
            
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_by_type(self, movement_type: MovementType, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None, limit: int = 100) -> Sequence[StockMovement]:
        stmt = select(self.model).options(joinedload(self.model.product), joinedload(self.model.user)).where(
            self.model.business_id == self.business_id,
            self.model.movement_type == movement_type
        ).order_by(desc(self.model.created_at)).limit(limit)
        
        if start_date:
            stmt = stmt.where(self.model.created_at >= start_date)
        if end_date:
            stmt = stmt.where(self.model.created_at <= end_date)
            
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def aggregate_inventory(self, product_id: Optional[uuid.UUID] = None) -> Dict[uuid.UUID, int]:
        """
        Current Stock = Opening + Purchases + Returns - Sales - Damage + Adjustments
        """
        stock_case = case(
            (self.model.movement_type.in_([MovementType.OPENING, MovementType.PURCHASE, MovementType.RETURN]), self.model.quantity),
            (self.model.movement_type.in_([MovementType.SALE, MovementType.DAMAGE]), -self.model.quantity),
            (self.model.movement_type == MovementType.ADJUSTMENT, self.model.quantity),
            else_=0
        )
        
        stmt = select(
            self.model.product_id,
            func.sum(stock_case).label("current_stock")
        ).where(
            self.model.business_id == self.business_id
        ).group_by(self.model.product_id)

        if product_id:
            stmt = stmt.where(self.model.product_id == product_id)
            
        result = await self.db.execute(stmt)
        return {row.product_id: int(row.current_stock or 0) for row in result.all()}
