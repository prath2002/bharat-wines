import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class VendorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    gstin: str | None = None
    payment_terms_days: int | None = None
    credit_period_days: int | None = None
    contact_person: str | None = None
    phone: str | None = None
    email: str | None = None
    bank_account_holder: str | None = None
    bank_account_number: str | None = None
    bank_ifsc: str | None = None
    bank_name: str | None = None
    upi_id: str | None = None
    notes: str | None = None
    created_at: datetime

class VendorCreateRequest(BaseModel):
    name: str
    gstin: str | None = None
    payment_terms_days: int | None = None
    credit_period_days: int | None = None
    contact_person: str | None = None
    phone: str | None = None
    email: str | None = None
    bank_account_holder: str | None = None
    bank_account_number: str | None = None
    bank_ifsc: str | None = None
    bank_name: str | None = None
    upi_id: str | None = None
    notes: str | None = None

class VendorUpdateRequest(BaseModel):
    name: str | None = None
    gstin: str | None = None
    payment_terms_days: int | None = None
    credit_period_days: int | None = None
    contact_person: str | None = None
    phone: str | None = None
    email: str | None = None
    bank_account_holder: str | None = None
    bank_account_number: str | None = None
    bank_ifsc: str | None = None
    bank_name: str | None = None
    upi_id: str | None = None
    notes: str | None = None

class VendorPaymentHistoryItem(BaseModel):
    bill_id: uuid.UUID
    bill_number: str | None = None
    settlement_id: uuid.UUID
    amount: float
    paid_on: date
    method: str
    reference: str | None = None

class VendorUpcomingPayment(BaseModel):
    payment_schedule_id: uuid.UUID
    bill_id: uuid.UUID
    bill_number: str | None = None
    amount: float
    scheduled_date: date
    status: str

class VendorStatementResponse(BaseModel):
    vendor_id: uuid.UUID
    vendor_name: str
    total_bills: int
    total_billed: float
    total_paid: float
    outstanding_amount: float
    overdue_amount: float
    upcoming_payments: list[VendorUpcomingPayment]
    payment_history: list[VendorPaymentHistoryItem]
