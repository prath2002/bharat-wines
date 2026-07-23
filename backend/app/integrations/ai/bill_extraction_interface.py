from abc import ABC, abstractmethod
from datetime import date

from pydantic import BaseModel


class BillChargeItem(BaseModel):
    label: str
    amount: float

class BillExtractionResult(BaseModel):
    bill_number: str | None = None
    vendor_name: str
    bill_date: date | None = None
    subtotal: float | None = None
    discount_amount: float = 0.0
    charges: list[BillChargeItem] = []
    total_amount: float | None = None

class BillExtractionInterface(ABC):
    @abstractmethod
    async def extract_structured(self, raw_text: str) -> BillExtractionResult:
        """
        Extract structured totals from the raw OCR text (or image path) of a purchase bill/invoice.
        """
        pass
