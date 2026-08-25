import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bill import Bill
from app.models.bill_settlement import BillSettlement
from app.models.document import Document, DocumentOwnerType, DocumentType

async def _assert_owner_exists(
    owner_type: DocumentOwnerType, owner_id: uuid.UUID, db: AsyncSession, business_id: uuid.UUID
) -> None:
    model = Bill if owner_type == DocumentOwnerType.BILL else BillSettlement
    result = await db.execute(
        select(model.id).where(model.id == owner_id, model.business_id == business_id)
    )
    if result.scalar_one_or_none() is None:
        raise ValueError(f"{owner_type.value.title()} not found")

async def create_document(
    owner_type: DocumentOwnerType, owner_id: uuid.UUID, doc_type: DocumentType, file_url: str,
    db: AsyncSession, business_id: uuid.UUID, user_id: uuid.UUID,
) -> Document:
    await _assert_owner_exists(owner_type, owner_id, db, business_id)
    document = Document(
        business_id=business_id,
        owner_type=owner_type,
        owner_id=owner_id,
        doc_type=doc_type,
        file_url=file_url,
        uploaded_by=user_id,
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)
    return document

async def list_documents(
    owner_type: DocumentOwnerType, owner_id: uuid.UUID, db: AsyncSession, business_id: uuid.UUID
) -> list[Document]:
    result = await db.execute(
        select(Document)
        .where(
            Document.business_id == business_id,
            Document.owner_type == owner_type,
            Document.owner_id == owner_id,
        )
        .order_by(Document.created_at.desc())
    )
    return result.scalars().all()

async def delete_document(document_id: uuid.UUID, db: AsyncSession, business_id: uuid.UUID) -> None:
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.business_id == business_id)
    )
    document = result.scalar_one_or_none()
    if not document:
        raise ValueError("Document not found")
    await db.delete(document)
    await db.commit()
