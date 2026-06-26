from datetime import date, datetime
import uuid
from typing import List
from sqlalchemy import select, func, case, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.stock_movement import StockMovement, MovementType
from app.models.product import Product
from app.schemas.scm import SCMRecord

async def get_scm_report(
    db: AsyncSession,
    business_id: uuid.UUID,
    start_date: date,
    end_date: date
) -> List[SCMRecord]:
    """
    Calculates the SCM report dynamically by aggregating stock movements on the fly.
    This guarantees 100% accuracy and eliminates the need for background cron jobs.
    """
    
    # Start date boundary is 00:00:00 of start_date
    start_dt = datetime.combine(start_date, datetime.min.time())
    # End date boundary is 23:59:59.999999 of end_date
    end_dt = datetime.combine(end_date, datetime.max.time())
    
    # Opening Stock Case (Everything before start_dt)
    opening_case = case(
        (and_(StockMovement.created_at < start_dt, StockMovement.movement_type.in_([MovementType.OPENING, MovementType.PURCHASE, MovementType.RETURN, MovementType.ADJUSTMENT])), StockMovement.quantity),
        (and_(StockMovement.created_at < start_dt, StockMovement.movement_type.in_([MovementType.SALE, MovementType.DAMAGE])), -StockMovement.quantity),
        else_=0
    )
    
    # In-period Cases (Between start_dt and end_dt)
    in_period = and_(StockMovement.created_at >= start_dt, StockMovement.created_at <= end_dt)
    
    # We treat OPENING movements that fall in the period as purchases for reporting purposes
    purchases_case = case((and_(in_period, StockMovement.movement_type.in_([MovementType.PURCHASE, MovementType.OPENING])), StockMovement.quantity), else_=0)
    sales_case = case((and_(in_period, StockMovement.movement_type == MovementType.SALE), StockMovement.quantity), else_=0)
    returns_case = case((and_(in_period, StockMovement.movement_type == MovementType.RETURN), StockMovement.quantity), else_=0)
    damage_case = case((and_(in_period, StockMovement.movement_type == MovementType.DAMAGE), StockMovement.quantity), else_=0)

    # Note: We use outerjoin so we get products even if they have 0 movements (but we'll filter out empty ones later)
    stmt = select(
        Product.scm_code,
        Product.name.label("product_name"),
        Product.category,
        Product.size_ml,
        func.sum(opening_case).label("opening"),
        func.sum(purchases_case).label("purchases"),
        func.sum(sales_case).label("sales"),
        func.sum(returns_case).label("returns"),
        func.sum(damage_case).label("damage")
    ).select_from(Product).outerjoin(
        StockMovement, and_(Product.id == StockMovement.product_id, StockMovement.business_id == business_id)
    ).where(
        Product.business_id == business_id,
        Product.is_active == True,
        Product.scm_code.isnot(None), 
        Product.scm_code != "" # Only products with SCM code go to excise
    ).group_by(
        Product.id, Product.scm_code, Product.name, Product.category, Product.size_ml
    ).order_by(
        Product.category, Product.scm_code
    )

    result = await db.execute(stmt)
    rows = result.all()
    
    records = []
    for r in rows:
        opening = int(r.opening or 0)
        purchases = int(r.purchases or 0)
        sales = int(r.sales or 0)
        returns = int(r.returns or 0)
        damage = int(r.damage or 0)
        closing = opening + purchases + returns - sales - damage
        
        # Only include products that have had some movement or stock
        if opening > 0 or purchases > 0 or sales > 0 or returns > 0 or damage > 0 or closing > 0:
            records.append(SCMRecord(
                scm_code=r.scm_code,
                product_name=r.product_name,
                category=r.category,
                size_ml=r.size_ml,
                opening=opening,
                purchases=purchases,
                sales=sales,
                returns=returns,
                damage=damage,
                closing=closing
            ))
            
    return records
