from abc import ABC, abstractmethod
from typing import List, Optional
from datetime import date
from pydantic import BaseModel

class BillChargeItem(BaseModel):
    label: str
    amount: float

class BillExtractionResult(BaseModel):
    bill_number: Optional[str] = None
    vendor_name: str
    bill_date: Optional[date] = None
    subtotal: Optional[float] = None
    discount_amount: float = 0.0
    charges: List[BillChargeItem] = []
    total_amount: Optional[float] = None

class BillExtractionInterface(ABC):
    @abstractmethod
    async def extract_structured(self, raw_text: str) -> BillExtractionResult:
        """
        Extract structured totals from the raw OCR text (or image path) of a purchase bill/invoice.
        """
        pass
