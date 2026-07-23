import asyncio
from datetime import date
from app.integrations.ai.extraction_interface import ExtractionInterface, TPExtractionResult, TPProductItem

class MockExtractionClient(ExtractionInterface):
    async def extract_structured(self, raw_text: str) -> TPExtractionResult:
        # Simulate processing time
        await asyncio.sleep(2)
        
        # We ignore raw_text and just return a static valid result for UI testing
        return TPExtractionResult(
            tp_number="TP-98234-2026",
            supplier_name="Allied Blenders and Distillers Pvt. Ltd.",
            tp_date=date(2026, 6, 25),
            products=[
                TPProductItem(
                    name="Officer's Choice Blue",
                    qty_bottles=120,
                    mrp=850.0,
                    batch_number="B-12345"
                ),
                TPProductItem(
                    name="Sterling Reserve B7",
                    qty_bottles=120,
                    mrp=400.0,
                    batch_number="B-98765"
                )
            ]
        )
