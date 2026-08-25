import enum
import uuid
from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, Index, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import TenantModel


class PaymentScheduleStatus(str, enum.Enum):
    PENDING = "PENDING"
    SCHEDULED = "SCHEDULED"
    APPROVAL_PENDING = "APPROVAL_PENDING"
    APPROVED = "APPROVED"
    PAID = "PAID"
    ON_HOLD = "ON_HOLD"
    CANCELLED = "CANCELLED"
    FAILED = "FAILED"

class PaymentSchedule(TenantModel):
    __tablename__ = "payment_schedules"

    bill_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("bills.id"), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    scheduled_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[PaymentScheduleStatus] = mapped_column(
        Enum(PaymentScheduleStatus, name="payment_schedule_status_enum", native_enum=True),
        nullable=False, default=PaymentScheduleStatus.PENDING,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)

    bill: Mapped["Bill"] = relationship("Bill", back_populates="payment_schedules")
    approvals: Mapped[list["PaymentApproval"]] = relationship(
        "PaymentApproval", back_populates="payment_schedule", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_payment_schedules_business_status", "business_id", "status"),
    )
