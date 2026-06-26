from pydantic import BaseModel, ConfigDict
from typing import List, Optional
import uuid
from datetime import date, datetime
from app.models.tp_receipt import TPStatus

class TPUploadResponse(BaseModel):
    tp_receipt_id: uuid.UUID
    status: TPStatus

class TPReceiptLineResponse(BaseModel):
    id: uuid.UUID
    product_id: Optional[uuid.UUID] = None
    extracted_name: str
    quantity_cases: int
    quantity_bottles: int
    total_bottles: int
    extracted_mrp: float
    batch_number: Optional[str] = None
    match_confidence: float
    is_matched: bool

    model_config = ConfigDict(from_attributes=True)

class TPReceiptResponse(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID
    tp_number: str
    supplier_name: str
    tp_date: date
    file_url: str
    status: TPStatus
    processed_by: uuid.UUID
    approved_by: Optional[uuid.UUID] = None
    approved_at: Optional[datetime] = None
    created_at: datetime

    lines: List[TPReceiptLineResponse] = []

    model_config = ConfigDict(from_attributes=True)

class TPDraftResponse(TPReceiptResponse):
    mrp_mismatches: List[dict] = []
    duplicate_warning: bool = False

class TPApproveLineRequest(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    total_bottles: int

class TPApproveRequest(BaseModel):
    lines: Optional[List[TPApproveLineRequest]] = None
