import asyncio
import logging
import re
from decimal import Decimal

from sqlalchemy.future import select
from celery import shared_task
from rapidfuzz import process, fuzz

from app.db.session import AsyncSessionLocal, engine
from app.models.bill import Bill, BillStatus
from app.models.vendor import Vendor
from app.integrations.ai import get_ocr_client, get_bill_extraction_client

logger = logging.getLogger(__name__)

VENDOR_MATCH_THRESHOLD = 85.0
TOTAL_MISMATCH_TOLERANCE = 1.0  # rupees; absorbs round-off

def normalize_vendor_name(name: str) -> str:
    """Lowercase, collapse whitespace, strip common company suffixes for matching."""
    n = re.sub(r"\s+", " ", (name or "").strip().lower())
    n = re.sub(r"[.,]", "", n)
    n = re.sub(r"\b(pvt|private|ltd|limited|llp|co|company|corp|corporation)\b", "", n)
    return re.sub(r"\s+", " ", n).strip()

def compute_total_check(subtotal, discount_amount, charges, total_amount):
    """
    Returns (computed_total, has_mismatch).
    If subtotal is missing, no computation is possible -> (None, False).
    If total is missing, the computed total should be used as the total.
    """
    if subtotal is None:
        return None, False
    charges_sum = sum(Decimal(str(c.get("amount", 0))) for c in (charges or []))
    computed = Decimal(str(subtotal)) - Decimal(str(discount_amount or 0)) + charges_sum
    if total_amount is None:
        return computed, False
    mismatch = abs(computed - Decimal(str(total_amount))) > Decimal(str(TOTAL_MISMATCH_TOLERANCE))
    return computed, mismatch

def match_vendor(extracted_name: str, vendors: list) -> tuple:
    """Fuzzy match an extracted vendor name against the vendor catalog.
    Returns (vendor_id | None, confidence 0-100)."""
    if not extracted_name or not vendors:
        return None, 0.0
    choices = {v.id: normalize_vendor_name(v.name) for v in vendors}
    result = process.extractOne(
        normalize_vendor_name(extracted_name),
        choices,
        scorer=fuzz.token_sort_ratio,
        score_cutoff=VENDOR_MATCH_THRESHOLD,
    )
    if result is None:
        return None, 0.0
    _, score, vendor_id = result
    return vendor_id, score

async def process_bill_async(bill_id: str, file_url: str, business_id: str):
    logger.info(f"Starting background processing for Bill {bill_id}")

    ocr_client = get_ocr_client()
    extraction_client = get_bill_extraction_client()

    try:
        # 1. OCR (vision provider passes the file path straight through)
        ocr_result = await ocr_client.extract_text(file_url)

        # 2. Structured extraction via LLM
        extraction = await extraction_client.extract_structured(ocr_result.raw_text)

        async with AsyncSessionLocal() as db:
            bill_result = await db.execute(select(Bill).where(Bill.id == bill_id))
            bill = bill_result.scalar_one_or_none()
            if not bill:
                logger.error(f"Bill {bill_id} not found in DB")
                return

            # 3. Fuzzy match vendor against catalog
            vendors_result = await db.execute(select(Vendor).where(Vendor.business_id == business_id))
            vendors = vendors_result.scalars().all()
            vendor_id, confidence = match_vendor(extraction.vendor_name, vendors)
            if vendor_id:
                logger.info(f"Matched vendor '{extraction.vendor_name}' with confidence {confidence:.1f}")

            # 4. Persist extracted fields
            charges = [c.model_dump() for c in extraction.charges]
            computed, mismatch = compute_total_check(
                extraction.subtotal, extraction.discount_amount, charges, extraction.total_amount
            )

            bill.bill_number = extraction.bill_number
            bill.bill_date = extraction.bill_date
            bill.extracted_vendor_name = extraction.vendor_name
            bill.vendor_id = vendor_id
            bill.subtotal = extraction.subtotal
            bill.discount_amount = extraction.discount_amount or 0
            bill.charges = charges
            bill.total_amount = extraction.total_amount if extraction.total_amount is not None else (
                float(computed) if computed is not None else None
            )
            bill.has_total_mismatch = mismatch
            bill.ocr_raw_text = ocr_result.raw_text
            bill.extracted_data = extraction.model_dump(mode="json")
            bill.status = BillStatus.DRAFT

            await db.commit()
            logger.info(f"Successfully processed Bill {bill_id}")

    except Exception as e:
        logger.exception(f"Failed to process Bill {bill_id}: {e}")
        async with AsyncSessionLocal() as db:
            bill_result = await db.execute(select(Bill).where(Bill.id == bill_id))
            bill = bill_result.scalar_one_or_none()
            if bill:
                bill.status = BillStatus.REJECTED
                await db.commit()

async def _run_and_dispose(bill_id: str, file_url: str, business_id: str):
    try:
        await process_bill_async(bill_id, file_url, business_id)
    finally:
        # Same loop-affinity fix as tp_processing: asyncpg connections are bound
        # to the event loop they were opened on, and each Celery run gets a new
        # loop via asyncio.run(), so the pool must be dropped before loop close.
        await engine.dispose()

@shared_task
def process_bill_task(bill_id: str, file_url: str, business_id: str):
    """Celery task entrypoint."""
    asyncio.run(_run_and_dispose(bill_id, file_url, business_id))
