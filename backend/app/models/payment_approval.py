import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import TenantModel


class ApprovalStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    ON_HOLD = "ON_HOLD"

class PaymentApproval(TenantModel):
    __tablename__ = "payment_approvals"

    payment_schedule_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("payment_schedules.id"), nullable=False, index=True
    )
    status: Mapped[ApprovalStatus] = mapped_column(
        Enum(ApprovalStatus, name="approval_status_enum", native_enum=True),
        nullable=False, default=ApprovalStatus.PENDING,
    )
    requested_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    decided_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    approval_rule_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("approval_rules.id"), nullable=True)

    payment_schedule: Mapped["PaymentSchedule"] = relationship("PaymentSchedule", back_populates="approvals")
