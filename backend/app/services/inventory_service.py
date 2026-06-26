import uuid
from typing import Dict, List, Optional, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.stock_movement import MovementType
from app.repositories.movement_repo import MovementRepository
from app.repositories.product_repo import ProductRepository
from app.integrations.redis import cache_get, cache_set, cache_delete

CACHE_TTL_SECONDS = 300  # 5 minutes

async def invalidate_inventory_cache(business_id: uuid.UUID, product_id: Optional[uuid.UUID] = None):
    if product_id:
        await cache_delete(f"inv:{business_id}:{product_id}")
    await cache_delete(f"inv:{business_id}:all")

class InventoryService:
    def __init__(self, db: AsyncSession, business_id: uuid.UUID):
        self.db = db
        self.business_id = business_id
        self.movement_repo = MovementRepository(db, business_id)
        self.product_repo = ProductRepository(db, business_id)

    async def get_current_stock(self, product_id: Optional[uuid.UUID] = None) -> Dict[str, int]:
        """
        Get current stock for a specific product or all products.
        Returns a dict mapping product_id (as string) to stock quantity.
        """
        cache_key = f"inv:{self.business_id}:{product_id}" if product_id else f"inv:{self.business_id}:all"
        
        # Try cache first
        cached_data = await cache_get(cache_key)
        if cached_data is not None:
            return cached_data

        # Cache miss, calculate from DB
        inventory = await self.movement_repo.aggregate_inventory(product_id)
        
        # Convert UUID keys to strings for JSON serialization in cache
        str_inventory = {str(k): v for k, v in inventory.items()}
        
        # Cache the result
        await cache_set(cache_key, str_inventory, expire_secs=CACHE_TTL_SECONDS)
        
        return str_inventory

    async def calculate_revenue(self, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """
        Calculate revenue from SALE movements between start_date and end_date.
        """
        sales = await self.movement_repo.get_by_type(
            movement_type=MovementType.SALE,
            start_date=start_date,
            end_date=end_date,
            limit=10000
        )
        
        returns = await self.movement_repo.get_by_type(
            movement_type=MovementType.RETURN,
            start_date=start_date,
            end_date=end_date,
            limit=10000
        )
        
        movements = sales + returns

        product_totals = {}
        total_revenue = 0.0

        for movement in movements:
            if not movement.product:
                continue
                
            pid = str(movement.product.id)
            if pid not in product_totals:
                product_totals[pid] = {
                    "product_name": movement.product.name,
                    "size_ml": movement.product.size_ml,
                    "quantity_sold": 0,
                    "mrp": float(movement.product.mrp),
                    "revenue": 0.0
                }
            
            qty = movement.quantity
            if movement.movement_type == MovementType.RETURN:
                qty = -qty
                
            revenue = qty * float(movement.product.mrp)
            
            product_totals[pid]["quantity_sold"] += qty
            product_totals[pid]["revenue"] += revenue
            total_revenue += revenue
            
        # Filter out products that have exactly 0 net sales, but keep positive and negative
        final_breakdown = [p for p in product_totals.values() if p["quantity_sold"] != 0]

        return {
            "breakdown": final_breakdown,
            "total_revenue": total_revenue
        }

    async def get_low_stock(self, threshold: int = 10) -> List[Dict[str, Any]]:
        """
        Get products with current stock strictly below the given threshold.
        """
        # Get all stock
        all_stock = await self.get_current_stock()
        
        low_stock_items = []
        # Get all active products to match against
        products = await self.product_repo.get_all(limit=10000)
        
        for product in products:
            pid = str(product.id)
            stock = all_stock.get(pid, 0)
            if stock < threshold:
                low_stock_items.append({
                    "product_id": pid,
                    "product_name": product.name,
                    "category": product.category,
                    "size_ml": product.size_ml,
                    "current_stock": stock,
                    "threshold": threshold
                })
                
        return low_stock_items
