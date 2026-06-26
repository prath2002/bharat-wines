from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from datetime import date

class TPProductItem(BaseModel):
    name: str
    scm_code: Optional[str] = None
    size: Optional[str] = None
    qty_bottles: int
    mrp: float
    batch_number: Optional[str] = None

class TPExtractionResult(BaseModel):
    tp_number: str
    supplier_name: str
    tp_date: Optional[date] = None
    products: List[TPProductItem]

class ExtractionInterface(ABC):
    @abstractmethod
    async def extract_structured(self, raw_text: str) -> TPExtractionResult:
        """
        Extract structured JSON from the raw OCR text of a Transport Permit.
        """
        pass
