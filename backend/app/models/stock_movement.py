import enum
import uuid
from sqlalchemy import String, Integer, Enum, ForeignKey, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import TenantModel

class MovementType(str, enum.Enum):
    OPENING = "OPENING"
    PURCHASE = "PURCHASE"
    SALE = "SALE"
    RETURN = "RETURN"
    DAMAGE = "DAMAGE"
    ADJUSTMENT = "ADJUSTMENT"

class StockMovement(TenantModel):
    __tablename__ = "stock_movements"

    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id"), nullable=False)
    movement_type: Mapped[MovementType] = mapped_column(Enum(MovementType, native_enum=True), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    batch_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    reference_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tp_receipts.id"), nullable=True)
    reference_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    product: Mapped["Product"] = relationship("Product")
    user: Mapped["User"] = relationship("User")

    __table_args__ = (
        Index("ix_stock_movements_business_product_date", "business_id", "product_id", "created_at"),
        Index("ix_stock_movements_business_type_date", "business_id", "movement_type", "created_at"),
        Index("ix_stock_movements_business_date", "business_id", "created_at"),
    )
