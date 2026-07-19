import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict

from app.models.user import Role

class UserCreateRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Role = Role.STAFF

class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    role: Optional[Role] = None
    is_active: Optional[bool] = None

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    business_id: uuid.UUID
    name: str
    email: EmailStr
    role: Role
    is_active: bool
    created_at: datetime
