import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.bill import BillStatus, DueDateSource, PaymentStatus
from app.models.bill_settlement import SettlementMethod


class ChargeItem(BaseModel):
    label: str
    amount: float

class DueDateRecommendationResponse(BaseModel):
    due_date: date | None = None
    source: DueDateSource | None = None
    payment_terms_days: int | None = None

class SettlementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    bill_id: uuid.UUID
    amount: float
    paid_on: date
    method: SettlementMethod
    reference: str | None = None
    notes: str | None = None
    created_at: datetime

class SettlementCreateRequest(BaseModel):
    amount: float
    paid_on: date
    method: SettlementMethod
    reference: str | None = None
    notes: str | None = None

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("amount must be positive")
        return v

class BillUpdateRequest(BaseModel):
    bill_number: str | None = None
    bill_date: date | None = None
    vendor_id: uuid.UUID | None = None
    extracted_vendor_name: str | None = None
    subtotal: float | None = None
    discounts: list[ChargeItem] | None = None
    charges: list[ChargeItem] | None = None
    due_date: date | None = None
    due_date_source: DueDateSource | None = None
    notes: str | None = None

class VerifyRequest(BaseModel):
    vendor_name: str | None = None

class BillManualCreateRequest(BaseModel):
    bill_number: str | None = None
    bill_date: date | None = None
    vendor_id: uuid.UUID | None = None
    vendor_name: str | None = None
    subtotal: float
    discounts: list[ChargeItem] = []
    charges: list[ChargeItem] | None = None
    due_date: date | None = None
    due_date_source: DueDateSource | None = None
    notes: str | None = None

    @field_validator("subtotal")
    @classmethod
    def subtotal_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("subtotal must be positive")
        return v

class BillResponse(BaseModel):
    """Full projection for FINANCE / ADMIN."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    vendor_id: uuid.UUID | None = None
    vendor_name: str | None = None
    extracted_vendor_name: str | None = None
    uploaded_by: uuid.UUID
    file_url: str | None = None
    bill_number: str | None = None
    bill_date: date | None = None
    subtotal: float | None = None
    discounts: list[ChargeItem] = []
    charges: list[ChargeItem] | None = None
    total_amount: float | None = None
    has_total_mismatch: bool = False
    status: BillStatus
    payment_status: PaymentStatus
    amount_paid: float = 0
    due_date: date | None = None
    due_date_source: DueDateSource | None = None
    notes: str | None = None
    verified_at: datetime | None = None
    created_at: datetime

class BillDetailResponse(BillResponse):
    ocr_raw_text: str | None = None
    extracted_data: dict | None = None
    settlements: list[SettlementResponse] = []

class BillLimitedResponse(BaseModel):
    """Restricted projection for STAFF (own uploads, no financial data)."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    file_url: str | None = None
    status: BillStatus
    created_at: datetime
