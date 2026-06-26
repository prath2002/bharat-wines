import asyncio
from app.integrations.ai.ocr_interface import OCRInterface, OCRResult

class MockOCRClient(OCRInterface):
    async def extract_text(self, file_path_or_url: str) -> OCRResult:
        # Simulate network latency
        await asyncio.sleep(2)
        
        # Return a fake extracted raw text
        raw_text = """
        TRANSPORT PERMIT
        Permit No: TP-98234-2026
        Date: 2026-06-25
        Supplier: Allied Blenders and Distillers Pvt. Ltd.
        
        Items:
        1. Officer's Choice Blue 750ml - 10 Cases (120 Bottles) - MRP: 850
        2. Sterling Reserve B7 375ml - 5 Cases (120 Bottles) - MRP: 400
        """
        
        return OCRResult(
            raw_text=raw_text.strip(),
            confidence=0.98,
            provider_metadata={"provider": "MockOCR"}
        )
