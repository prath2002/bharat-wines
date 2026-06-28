import enum
import uuid
from typing import List
from sqlalchemy import String, Integer, Numeric, Enum, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import ARRAY

from app.db.base import TenantModel

class ProductCategory(str, enum.Enum):
    IMFL = "IMFL"
    MML = "MML"
    CL = "CL"
    WINE = "WINE"
    BEER = "BEER"

class ProductStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"

class Product(TenantModel):
    __tablename__ = "products"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[ProductCategory] = mapped_column(Enum(ProductCategory, native_enum=True), nullable=False)
    size_ml: Mapped[int] = mapped_column(Integer, nullable=False)
    mrp: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    scm_code: Mapped[str] = mapped_column(String(50), nullable=False)
    additional_scm_codes: Mapped[list[str]] = mapped_column(ARRAY(String), server_default='{}', nullable=False)
    purchase_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, server_default="0")
    case_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[ProductStatus] = mapped_column(Enum(ProductStatus, native_enum=True), default=ProductStatus.ACTIVE)

    barcodes: Mapped[List["Barcode"]] = relationship(
        "Barcode", back_populates="product", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("business_id", "name", "size_ml", name="uq_business_name_size"),
    )
