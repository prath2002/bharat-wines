import asyncio
from datetime import date

from app.integrations.ai.bill_extraction_interface import (
    BillExtractionInterface,
    BillExtractionResult,
    BillChargeItem,
)

class MockBillExtractionClient(BillExtractionInterface):
    async def extract_structured(self, raw_text: str) -> BillExtractionResult:
        # Simulate processing time
        await asyncio.sleep(2)

        return BillExtractionResult(
            bill_number="INV-2026-04581",
            vendor_name="Allied Blenders and Distillers Pvt. Ltd.",
            bill_date=date(2026, 7, 10),
            subtotal=125000.0,
            discount_amount=3500.0,
            charges=[
                BillChargeItem(label="Freight", amount=1200.0),
                BillChargeItem(label="TCS", amount=250.0),
            ],
            total_amount=122950.0,
        )
