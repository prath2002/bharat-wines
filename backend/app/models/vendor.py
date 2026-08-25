from sqlalchemy import String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TenantModel


class Vendor(TenantModel):
    __tablename__ = "vendors"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # Lowercased, whitespace-collapsed form used for dedupe and fuzzy matching
    normalized_name: Mapped[str] = mapped_column(String(255), nullable=False)
    gstin: Mapped[str | None] = mapped_column(String(20), nullable=True)

    payment_terms_days: Mapped[int | None] = mapped_column(nullable=True)
    credit_period_days: Mapped[int | None] = mapped_column(nullable=True)

    contact_person: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    bank_account_holder: Mapped[str | None] = mapped_column(String(255), nullable=True)
    bank_account_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    bank_ifsc: Mapped[str | None] = mapped_column(String(20), nullable=True)
    bank_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    upi_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("business_id", "normalized_name", name="uq_vendor_business_normalized_name"),
    )
