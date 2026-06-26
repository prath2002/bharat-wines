import enum
import uuid
from sqlalchemy import String, Boolean, Enum, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import TenantModel

class BarcodeFormat(str, enum.Enum):
    EAN13 = "EAN13"
    EAN8 = "EAN8"
    CODE128 = "CODE128"
    QR = "QR"

class Barcode(TenantModel):
    __tablename__ = "barcodes"

    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id"), nullable=False)
    barcode_value: Mapped[str] = mapped_column(String(100), nullable=False)
    barcode_format: Mapped[BarcodeFormat] = mapped_column(Enum(BarcodeFormat, native_enum=True), default=BarcodeFormat.EAN13)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    product: Mapped["Product"] = relationship("Product", back_populates="barcodes")

    __table_args__ = (
        UniqueConstraint("business_id", "barcode_value", name="uq_business_barcode_value"),
    )
