from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional
import uuid
from datetime import datetime
from app.models.stock_movement import MovementType

class MovementBase(BaseModel):
    product_id: uuid.UUID
    movement_type: MovementType
    quantity: int = Field(default=1, gt=0)
    notes: Optional[str] = None

class MovementCreate(MovementBase):
    pass

class MovementResponse(MovementBase):
    id: uuid.UUID
    business_id: uuid.UUID
    batch_number: Optional[str] = None
    reference_id: Optional[uuid.UUID] = None
    reference_type: Optional[str] = None
    created_by: uuid.UUID
    created_at: datetime
    
    product_name: Optional[str] = None
    user_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class MovementListResponse(BaseModel):
    data: List[MovementResponse]
    total: int
    has_more: bool
