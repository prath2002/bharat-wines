import uuid
from sqlalchemy import String, Integer, Numeric, Boolean, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import TenantModel

class TPReceiptLine(TenantModel):
    __tablename__ = "tp_receipt_lines"

    tp_receipt_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tp_receipts.id"), nullable=False)
    product_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("products.id"), nullable=True)
    extracted_name: Mapped[str] = mapped_column(String(255), nullable=False)
    extracted_scm_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    extracted_size: Mapped[str | None] = mapped_column(String(50), nullable=True)
    quantity_bottles: Mapped[int] = mapped_column(Integer, default=0)
    total_bottles: Mapped[int] = mapped_column(Integer, default=0)
    extracted_mrp: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    batch_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    match_confidence: Mapped[float] = mapped_column(Float, default=0.0)
    is_matched: Mapped[bool] = mapped_column(Boolean, default=False)

    receipt: Mapped["TPReceipt"] = relationship("TPReceipt", back_populates="lines")
    product: Mapped["Product"] = relationship("Product")
