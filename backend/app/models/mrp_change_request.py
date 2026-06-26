import enum
import uuid
from datetime import datetime
from sqlalchemy import Enum, ForeignKey, Numeric, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import TenantModel

class MRPChangeStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class MRPChangeRequest(TenantModel):
    __tablename__ = "mrp_change_requests"

    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id"), nullable=False)
    tp_receipt_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tp_receipts.id"), nullable=False)
    old_mrp: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    new_mrp: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    status: Mapped[MRPChangeStatus] = mapped_column(Enum(MRPChangeStatus, native_enum=True), default=MRPChangeStatus.PENDING)
    
    decided_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    product: Mapped["Product"] = relationship("Product")
    tp_receipt: Mapped["TPReceipt"] = relationship("TPReceipt")
    user: Mapped["User"] = relationship("User")
