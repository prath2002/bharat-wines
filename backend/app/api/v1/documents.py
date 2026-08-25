import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permissions
from app.db.session import get_db
from app.models.audit_log import ActionEnum
from app.models.document import DocumentOwnerType, DocumentType
from app.models.user import User
from app.schemas.document import DocumentResponse
from app.services import audit_service, document_service, file_service

router = APIRouter()

@router.post("/bills/{bill_id}/documents", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_bill_document(
    bill_id: uuid.UUID,
    doc_type: DocumentType = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("bills.review"))
):
    file_url = await file_service.upload_file(file)
    try:
        document = await document_service.create_document(
            DocumentOwnerType.BILL, bill_id, doc_type, file_url, db, current_user.business_id, current_user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    await audit_service.record(
        db, current_user.id, current_user.business_id, ActionEnum.CREATE, "document", document.id
    )
    return document

@router.get("/bills/{bill_id}/documents", response_model=list[DocumentResponse])
async def list_bill_documents(
    bill_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("bills.review"))
):
    return await document_service.list_documents(DocumentOwnerType.BILL, bill_id, db, current_user.business_id)

@router.post("/payments/{payment_id}/documents", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_payment_document(
    payment_id: uuid.UUID,
    doc_type: DocumentType = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("bills.pay"))
):
    file_url = await file_service.upload_file(file)
    try:
        document = await document_service.create_document(
            DocumentOwnerType.PAYMENT, payment_id, doc_type, file_url, db, current_user.business_id, current_user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    await audit_service.record(
        db, current_user.id, current_user.business_id, ActionEnum.CREATE, "document", document.id
    )
    return document

@router.get("/payments/{payment_id}/documents", response_model=list[DocumentResponse])
async def list_payment_documents(
    payment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("bills.pay"))
):
    return await document_service.list_documents(DocumentOwnerType.PAYMENT, payment_id, db, current_user.business_id)

@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("bills.review"))
):
    try:
        await document_service.delete_document(document_id, db, current_user.business_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    await audit_service.record(
        db, current_user.id, current_user.business_id, ActionEnum.DELETE, "document", document_id
    )
