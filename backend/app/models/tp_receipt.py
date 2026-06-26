import enum
import uuid
from datetime import date, datetime
from sqlalchemy import String, Date, Text, Enum, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import TenantModel

class TPStatus(str, enum.Enum):
    PROCESSING = "PROCESSING"
    DRAFT = "DRAFT"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class TPReceipt(TenantModel):
    __tablename__ = "tp_receipts"

    tp_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    supplier_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    tp_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    ocr_raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    extracted_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[TPStatus] = mapped_column(Enum(TPStatus, native_enum=True), default=TPStatus.PROCESSING)
    
    processed_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    approved_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    lines: Mapped[list["TPReceiptLine"]] = relationship(
        "TPReceiptLine", back_populates="receipt", cascade="all, delete-orphan"
    )
