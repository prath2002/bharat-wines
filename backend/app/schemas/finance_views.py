import uuid
from datetime import date

from pydantic import BaseModel

from app.models.bill import PaymentStatus
from app.models.bill_settlement import SettlementMethod


class PendingBillItem(BaseModel):
    id: uuid.UUID
    vendor_id: uuid.UUID | None = None
    vendor_name: str | None = None
    bill_number: str | None = None
    total_amount: float
    outstanding: float
    due_date: date | None = None
    days_remaining: int | None = None
    payment_status: PaymentStatus

class OverdueBillItem(BaseModel):
    id: uuid.UUID
    vendor_id: uuid.UUID | None = None
    vendor_name: str | None = None
    bill_number: str | None = None
    total_amount: float
    outstanding: float
    due_date: date
    days_overdue: int
    payment_status: PaymentStatus

class CalendarPaymentItem(BaseModel):
    payment_schedule_id: uuid.UUID
    bill_id: uuid.UUID
    vendor_name: str | None = None
    bill_number: str | None = None
    amount: float
    status: str

class CalendarDay(BaseModel):
    scheduled_date: date
    total: float
    items: list[CalendarPaymentItem]

class PaymentHistoryItem(BaseModel):
    settlement_id: uuid.UUID
    bill_id: uuid.UUID
    bill_number: str | None = None
    vendor_id: uuid.UUID | None = None
    vendor_name: str | None = None
    amount: float
    paid_on: date
    method: SettlementMethod
    reference: str | None = None
    approved_by: uuid.UUID | None = None
