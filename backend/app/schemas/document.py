import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.document import DocumentOwnerType, DocumentType


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    owner_type: DocumentOwnerType
    owner_id: uuid.UUID
    doc_type: DocumentType
    file_url: str
    uploaded_by: uuid.UUID
    created_at: datetime
