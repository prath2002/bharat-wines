import enum
import uuid
from sqlalchemy import Enum, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import TenantModel

class MRPChangeSource(str, enum.Enum):
    TP_DETECTION = "TP_DETECTION"
    MANUAL = "MANUAL"

class MRPHistory(TenantModel):
    __tablename__ = "mrp_history"

    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id"), nullable=False)
    old_mrp: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    new_mrp: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    change_source: Mapped[MRPChangeSource] = mapped_column(Enum(MRPChangeSource, native_enum=True), nullable=False)
    changed_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    tp_receipt_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tp_receipts.id"), nullable=True)

    product: Mapped["Product"] = relationship("Product")
    user: Mapped["User"] = relationship("User")
