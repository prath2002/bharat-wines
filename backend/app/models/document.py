import enum
import uuid

from sqlalchemy import Enum, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TenantModel


class DocumentOwnerType(str, enum.Enum):
    BILL = "BILL"
    PAYMENT = "PAYMENT"

class DocumentType(str, enum.Enum):
    INVOICE = "INVOICE"
    PURCHASE_ORDER = "PURCHASE_ORDER"
    PAYMENT_PROOF = "PAYMENT_PROOF"
    RECEIPT = "RECEIPT"
    SUPPORTING = "SUPPORTING"

class Document(TenantModel):
    """Polymorphic attachment: owner_type + owner_id points at a Bill or a
    Payment (BillSettlement) row. Bill.file_url remains the primary OCR-scanned
    image for backward compatibility; this table covers additional bill docs
    and all payment documents.
    """
    __tablename__ = "documents"

    owner_type: Mapped[DocumentOwnerType] = mapped_column(
        Enum(DocumentOwnerType, name="document_owner_type_enum", native_enum=True), nullable=False
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    doc_type: Mapped[DocumentType] = mapped_column(
        Enum(DocumentType, name="document_type_enum", native_enum=True), nullable=False
    )
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)

    __table_args__ = (
        Index("ix_documents_owner", "owner_type", "owner_id"),
    )
