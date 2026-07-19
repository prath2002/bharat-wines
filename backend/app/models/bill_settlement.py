import enum
import uuid
from datetime import date
from sqlalchemy import String, Date, Enum, ForeignKey, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import TenantModel

class SettlementMethod(str, enum.Enum):
    BANK_TRANSFER = "BANK_TRANSFER"
    UPI = "UPI"
    CASH = "CASH"
    CHEQUE = "CHEQUE"
    OTHER = "OTHER"

class BillSettlement(TenantModel):
    __tablename__ = "bill_settlements"

    bill_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("bills.id"), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    paid_on: Mapped[date] = mapped_column(Date, nullable=False)
    method: Mapped[SettlementMethod] = mapped_column(
        Enum(SettlementMethod, name="settlement_method_enum", native_enum=True), nullable=False
    )
    # Bank UTR / cheque number / UPI transaction id
    reference: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)

    bill: Mapped["Bill"] = relationship("Bill", back_populates="settlements")
