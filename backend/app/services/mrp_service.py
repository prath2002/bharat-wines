from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import Optional
from datetime import datetime
import uuid

from app.models.tp_receipt import TPReceipt
from app.models.mrp_change_request import MRPChangeRequest, MRPChangeStatus
from app.models.mrp_history import MRPHistory
from app.models.product import Product

async def detect_mismatches(receipt_id: uuid.UUID, db: AsyncSession, business_id: uuid.UUID):
    """
    Called after TP processing or during review to flag MRP mismatches.
    """
    stmt = select(TPReceipt).options(selectinload(TPReceipt.lines)).where(TPReceipt.id == receipt_id)
    result = await db.execute(stmt)
    receipt = result.scalar_one_or_none()
    if not receipt:
        return
        
    for line in receipt.lines:
        if not line.product_id or not line.extracted_mrp:
            continue
            
        prod_result = await db.execute(select(Product).where(Product.id == line.product_id))
        product = prod_result.scalar_one_or_none()
        
        if product and product.mrp != line.extracted_mrp:
            # Check if there's already a pending request for this product from this receipt
            existing_req = await db.execute(
                select(MRPChangeRequest).where(
                    MRPChangeRequest.tp_receipt_id == receipt.id,
                    MRPChangeRequest.product_id == product.id,
                    MRPChangeRequest.status == MRPChangeStatus.PENDING
                )
            )
            if not existing_req.scalar_one_or_none():
                req = MRPChangeRequest(
                    business_id=business_id,
                    product_id=product.id,
                    tp_receipt_id=receipt.id,
                    old_mrp=product.mrp,
                    new_mrp=line.extracted_mrp,
                    status=MRPChangeStatus.PENDING
                )
                db.add(req)
                
    await db.commit()

async def approve_mrp_change(request_id: uuid.UUID, db: AsyncSession, user_id: uuid.UUID) -> MRPChangeRequest:
    stmt = select(MRPChangeRequest).where(MRPChangeRequest.id == request_id)
    result = await db.execute(stmt)
    req = result.scalar_one_or_none()
    
    if not req or req.status != MRPChangeStatus.PENDING:
        raise ValueError("Invalid MRP Change Request")
        
    # Update Product
    prod_result = await db.execute(select(Product).where(Product.id == req.product_id))
    product = prod_result.scalar_one()
    product.mrp = req.new_mrp
    
    # Create History
    history = MRPHistory(
        product_id=product.id,
        business_id=req.business_id,
        old_mrp=req.old_mrp,
        new_mrp=req.new_mrp,
        changed_by_id=user_id,
        reason=f"TP Receipt {req.tp_receipt_id} MRP Update"
    )
    db.add(history)
    
    req.status = MRPChangeStatus.APPROVED
    req.resolved_by_id = user_id
    req.resolved_at = datetime.utcnow()
    
    await db.commit()
    return req

async def reject_mrp_change(request_id: uuid.UUID, db: AsyncSession, user_id: uuid.UUID) -> MRPChangeRequest:
    stmt = select(MRPChangeRequest).where(MRPChangeRequest.id == request_id)
    result = await db.execute(stmt)
    req = result.scalar_one_or_none()
    
    if not req or req.status != MRPChangeStatus.PENDING:
        raise ValueError("Invalid MRP Change Request")
        
    req.status = MRPChangeStatus.REJECTED
    req.resolved_by_id = user_id
    req.resolved_at = datetime.utcnow()
    
    await db.commit()
    return req
