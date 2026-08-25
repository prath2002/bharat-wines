import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.bill_settlement import SettlementMethod
from app.models.payment_approval import ApprovalStatus
from app.models.payment_schedule import PaymentScheduleStatus


class PaymentScheduleCreateRequest(BaseModel):
    amount: float
    scheduled_date: date
    notes: str | None = None

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("amount must be positive")
        return v

class PaymentScheduleUpdateRequest(BaseModel):
    amount: float | None = None
    scheduled_date: date | None = None
    notes: str | None = None

class PaymentScheduleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    bill_id: uuid.UUID
    vendor_name: str | None = None
    amount: float
    scheduled_date: date
    status: PaymentScheduleStatus
    notes: str | None = None
    created_by: uuid.UUID
    created_at: datetime

class PaymentApprovalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    payment_schedule_id: uuid.UUID
    status: ApprovalStatus
    requested_by: uuid.UUID
    decided_by: uuid.UUID | None = None
    decided_at: datetime | None = None
    notes: str | None = None
    approval_rule_id: uuid.UUID | None = None
    created_at: datetime

class ApprovalDecisionRequest(BaseModel):
    notes: str | None = None

class PaymentCompleteRequest(BaseModel):
    """Amount is not accepted here — completion fulfills the schedule's
    already-approved amount, it doesn't renegotiate it."""
    paid_on: date
    method: SettlementMethod
    reference: str | None = None
    notes: str | None = None
