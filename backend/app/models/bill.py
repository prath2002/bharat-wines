import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import TenantModel


class BillStatus(str, enum.Enum):
    PROCESSING = "PROCESSING"
    DRAFT = "DRAFT"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"

class PaymentStatus(str, enum.Enum):
    UNPAID = "UNPAID"
    PARTIALLY_PAID = "PARTIALLY_PAID"
    PAID = "PAID"

class Bill(TenantModel):
    __tablename__ = "bills"

    vendor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("vendors.id"), nullable=True)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)

    bill_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    bill_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    extracted_vendor_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    subtotal: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    discount_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, server_default="0")
    # List of {"label": str, "amount": float} e.g. freight, TCS, bardana
    charges: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    total_amount: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    has_total_mismatch: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")

    ocr_raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    extracted_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    status: Mapped[BillStatus] = mapped_column(
        Enum(BillStatus, name="bill_status_enum", native_enum=True), default=BillStatus.PROCESSING
    )
    payment_status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, name="payment_status_enum", native_enum=True), default=PaymentStatus.UNPAID
    )
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    verified_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    vendor: Mapped["Vendor"] = relationship("Vendor")
    settlements: Mapped[list["BillSettlement"]] = relationship(
        "BillSettlement", back_populates="bill", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_bills_business_status", "business_id", "status"),
        Index("ix_bills_business_vendor", "business_id", "vendor_id"),
        Index("ix_bills_business_payment_status", "business_id", "payment_status"),
    )
