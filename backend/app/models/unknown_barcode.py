import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Enum, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import TenantModel

class UnknownBarcodeStatus(str, enum.Enum):
    PENDING = "PENDING"
    MAPPED = "MAPPED"
    IGNORED = "IGNORED"

class UnknownBarcode(TenantModel):
    __tablename__ = "unknown_barcodes"

    barcode_value: Mapped[str] = mapped_column(String(100), nullable=False)
    scanned_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    scanned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    status: Mapped[UnknownBarcodeStatus] = mapped_column(Enum(UnknownBarcodeStatus, native_enum=True), default=UnknownBarcodeStatus.PENDING)
    mapped_product_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("products.id"), nullable=True)

    user: Mapped["User"] = relationship("User")
    mapped_product: Mapped["Product"] = relationship("Product")
