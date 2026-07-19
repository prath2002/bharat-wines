from sqlalchemy import String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TenantModel


class Vendor(TenantModel):
    __tablename__ = "vendors"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # Lowercased, whitespace-collapsed form used for dedupe and fuzzy matching
    normalized_name: Mapped[str] = mapped_column(String(255), nullable=False)
    gstin: Mapped[str | None] = mapped_column(String(20), nullable=True)

    __table_args__ = (
        UniqueConstraint("business_id", "normalized_name", name="uq_vendor_business_normalized_name"),
    )
