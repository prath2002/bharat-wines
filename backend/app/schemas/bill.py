import uuid
from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, field_validator

from app.models.bill import BillStatus, PaymentStatus
from app.models.bill_settlement import SettlementMethod

class ChargeItem(BaseModel):
    label: str
    amount: float

class VendorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    gstin: Optional[str] = None
    created_at: datetime

class VendorCreateRequest(BaseModel):
    name: str
    gstin: Optional[str] = None

class VendorUpdateRequest(BaseModel):
    name: Optional[str] = None
    gstin: Optional[str] = None

class SettlementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    bill_id: uuid.UUID
    amount: float
    paid_on: date
    method: SettlementMethod
    reference: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

class SettlementCreateRequest(BaseModel):
    amount: float
    paid_on: date
    method: SettlementMethod
    reference: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("amount must be positive")
        return v

class BillUpdateRequest(BaseModel):
    bill_number: Optional[str] = None
    bill_date: Optional[date] = None
    vendor_id: Optional[uuid.UUID] = None
    extracted_vendor_name: Optional[str] = None
    subtotal: Optional[float] = None
    discount_amount: Optional[float] = None
    charges: Optional[List[ChargeItem]] = None
    total_amount: Optional[float] = None
    due_date: Optional[date] = None
    notes: Optional[str] = None

class VerifyRequest(BaseModel):
    vendor_name: Optional[str] = None

class BillResponse(BaseModel):
    """Full projection for FINANCE / ADMIN."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    vendor_id: Optional[uuid.UUID] = None
    vendor_name: Optional[str] = None
    extracted_vendor_name: Optional[str] = None
    uploaded_by: uuid.UUID
    file_url: str
    bill_number: Optional[str] = None
    bill_date: Optional[date] = None
    subtotal: Optional[float] = None
    discount_amount: float = 0
    charges: Optional[List[ChargeItem]] = None
    total_amount: Optional[float] = None
    has_total_mismatch: bool = False
    status: BillStatus
    payment_status: PaymentStatus
    amount_paid: float = 0
    due_date: Optional[date] = None
    notes: Optional[str] = None
    verified_at: Optional[datetime] = None
    created_at: datetime

class BillDetailResponse(BillResponse):
    ocr_raw_text: Optional[str] = None
    settlements: List[SettlementResponse] = []

class BillLimitedResponse(BaseModel):
    """Restricted projection for STAFF (own uploads, no financial data)."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    file_url: str
    status: BillStatus
    created_at: datetime
