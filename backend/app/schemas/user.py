import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.user import Role


class UserCreateRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Role = Role.STAFF

class UserUpdateRequest(BaseModel):
    name: str | None = None
    role: Role | None = None
    is_active: bool | None = None

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    business_id: uuid.UUID
    name: str
    email: EmailStr
    role: Role
    is_active: bool
    created_at: datetime
