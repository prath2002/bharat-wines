from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import Optional
from datetime import datetime
import uuid

from app.models.tp_receipt import TPReceipt, TPStatus
from app.models.tp_receipt_line import TPReceiptLine
from app.models.stock_movement import StockMovement, MovementType
from app.models.product import Product
from app.services.inventory_service import invalidate_inventory_cache
from app.services.file_service import upload_file
from app.workers.tp_processing import process_tp_receipt_task

async def upload_tp(file, db: AsyncSession, business_id: uuid.UUID, user_id: uuid.UUID) -> TPReceipt:
    # 1. Upload file (Mocked to local storage)
    file_url = await upload_file(file)
    
    # 2. Create TPReceipt in PROCESSING status
    receipt = TPReceipt(
        business_id=business_id,
        processed_by=user_id,
        file_url=file_url,
        status=TPStatus.PROCESSING
    )
    db.add(receipt)
    await db.commit()
    await db.refresh(receipt)
    
    # 3. Enqueue celery task
    # Note: We pass the receipt ID to the worker. Celery runs synchronously in development by default if eager is set, 
    # but we will call it asynchronously.
    process_tp_receipt_task.delay(str(receipt.id), file_url, str(business_id))
    
    return receipt

async def approve_receipt(receipt_id: uuid.UUID, db: AsyncSession, user_id: uuid.UUID) -> TPReceipt:
    stmt = select(TPReceipt).options(selectinload(TPReceipt.lines)).where(TPReceipt.id == receipt_id)
    result = await db.execute(stmt)
    receipt = result.scalar_one_or_none()
    
    if not receipt:
        raise ValueError("Receipt not found")
        
    if receipt.status != TPStatus.DRAFT:
        raise ValueError(f"Cannot approve receipt in {receipt.status.name} status")
        
    # 1. Validate all lines have a matched product
    for line in receipt.lines:
        if not line.product_id:
            raise ValueError(f"Line {line.extracted_product_name} is missing a matched product. Please map it manually first.")
            
    # 2. Create movements
    for line in receipt.lines:
        movement = StockMovement(
            product_id=line.product_id,
            business_id=receipt.business_id,
            movement_type=MovementType.PURCHASE,
            quantity=line.total_bottles,
            created_by=user_id,
            reference_id=receipt.id,
            reference_type="TP_RECEIPT",
            batch_number=line.batch_number
        )
        db.add(movement)
        
    # 3. Update receipt status
    receipt.status = TPStatus.APPROVED
    receipt.approved_by_id = user_id
    receipt.approved_at = datetime.utcnow()
    
    await db.commit()
    
    # Invalidate cache for inventory
    for line in receipt.lines:
        await invalidate_inventory_cache(receipt.business_id, line.product_id)
        
    return receipt

async def reject_receipt(receipt_id: uuid.UUID, db: AsyncSession, user_id: uuid.UUID) -> TPReceipt:
    stmt = select(TPReceipt).where(TPReceipt.id == receipt_id)
    result = await db.execute(stmt)
    receipt = result.scalar_one_or_none()
    
    if not receipt:
        raise ValueError("Receipt not found")
        
    receipt.status = TPStatus.REJECTED
    await db.commit()
    return receipt
