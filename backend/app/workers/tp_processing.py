import asyncio
import logging
from sqlalchemy.future import select
from celery import shared_task

from app.db.session import AsyncSessionLocal, engine
from app.models.tp_receipt import TPReceipt, TPStatus
from app.models.tp_receipt_line import TPReceiptLine
from app.models.product import Product
from app.integrations.ai import get_ocr_client, get_extraction_client, get_matching_client
from app.services.mrp_service import detect_mismatches

logger = logging.getLogger(__name__)

async def process_tp_async(receipt_id: str, file_url: str, business_id: str):
    logger.info(f"Starting background processing for TPReceipt {receipt_id}")
    
    ocr_client = get_ocr_client()
    extraction_client = get_extraction_client()
    matching_client = get_matching_client()
    
    try:
        # 1. OCR
        logger.info(f"Extracting text via OCR for {receipt_id}")
        ocr_result = await ocr_client.extract_text(file_url)
        
        # 2. Extract structured JSON via LLM
        logger.info(f"Extracting structured JSON via LLM for {receipt_id}")
        extraction_result = await extraction_client.extract_structured(ocr_result.raw_text)
        
        async with AsyncSessionLocal() as db:
            # 3. Fuzzy Match against catalog
            # First, fetch all products for this business
            result = await db.execute(select(Product).where(Product.business_id == business_id).order_by(Product.name))
            catalog = result.scalars().all()
            
            extracted_names = [p.name for p in extraction_result.products]
            extracted_sizes = [p.size for p in extraction_result.products]
            logger.info(f"Matching {len(extracted_names)} products against catalog of {len(catalog)} items")

            match_results = matching_client.match_products(extracted_names, catalog, extracted_sizes)
            
            # Fetch the receipt to update
            receipt_result = await db.execute(select(TPReceipt).where(TPReceipt.id == receipt_id))
            receipt = receipt_result.scalar_one_or_none()
            if not receipt:
                logger.error(f"TPReceipt {receipt_id} not found in DB")
                return
                
            # 4. Check for duplicates
            duplicate_receipt = await db.execute(
                select(TPReceipt).where(
                    TPReceipt.tp_number == extraction_result.tp_number,
                    TPReceipt.business_id == business_id,
                    TPReceipt.id != receipt_id,
                    TPReceipt.status.in_([TPStatus.APPROVED, TPStatus.DRAFT])
                )
            )
            if duplicate_receipt.scalar_one_or_none():
                logger.warning(f"Duplicate TP Number found: {extraction_result.tp_number}")
                receipt.status = TPStatus.REJECTED
                await db.commit()
                return

            # Update receipt metadata
            receipt.tp_number = extraction_result.tp_number
            receipt.supplier_name = extraction_result.supplier_name
            receipt.tp_date = extraction_result.tp_date
            receipt.ocr_raw_text = ocr_result.raw_text
            
            # 5. Create TPReceiptLine records
            for i, p in enumerate(extraction_result.products):
                match = match_results[i]
                
                matched_product_id = match.matched_product_id
                match_confidence = match.confidence
                
                # Check for exact SCM code match first
                if p.scm_code:
                    exact_match = next((cp for cp in catalog if cp.scm_code == p.scm_code or p.scm_code in cp.additional_scm_codes), None)
                    if exact_match:
                        matched_product_id = exact_match.id
                        match_confidence = 1.0
                
                total_bottles = p.qty_bottles
                    
                line = TPReceiptLine(
                    tp_receipt_id=receipt.id,
                    business_id=business_id,
                    extracted_name=p.name,
                    extracted_scm_code=p.scm_code,
                    extracted_size=p.size,
                    product_id=matched_product_id,
                    match_confidence=match_confidence,
                    quantity_bottles=p.qty_bottles,
                    total_bottles=total_bottles,
                    extracted_mrp=p.mrp,
                    batch_number=p.batch_number
                )
                db.add(line)
                
            receipt.status = TPStatus.DRAFT
            await db.commit()
            logger.info(f"Successfully processed TPReceipt {receipt_id}")
            
        # 6. Detect MRP Mismatches outside the main transaction to avoid locking issues
        async with AsyncSessionLocal() as db_mrp:
            await detect_mismatches(receipt.id, db_mrp, business_id)
            logger.info(f"Finished MRP mismatch detection for TPReceipt {receipt_id}")
            
    except Exception as e:
        logger.exception(f"Failed to process TPReceipt {receipt_id}: {e}")
        async with AsyncSessionLocal() as db:
            receipt_result = await db.execute(select(TPReceipt).where(TPReceipt.id == receipt_id))
            receipt = receipt_result.scalar_one_or_none()
            if receipt:
                receipt.status = TPStatus.REJECTED
                await db.commit()

async def _run_and_dispose(receipt_id: str, file_url: str, business_id: str):
    try:
        await process_tp_async(receipt_id, file_url, business_id)
    finally:
        # The engine's connection pool is created once at import time, but each
        # Celery task run gets its own event loop via asyncio.run(). asyncpg
        # connections are bound to the loop they were opened on, so pooled
        # connections must be dropped before this loop closes, or the next
        # task run fails with "attached to a different loop".
        await engine.dispose()

@shared_task
def process_tp_receipt_task(receipt_id: str, file_url: str, business_id: str):
    """Celery task entrypoint."""
    asyncio.run(_run_and_dispose(receipt_id, file_url, business_id))
