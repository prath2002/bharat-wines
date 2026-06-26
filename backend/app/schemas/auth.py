from pydantic import BaseModel, EmailStr
from typing import Optional
import uuid

class RegisterRequest(BaseModel):
    business_name: str
    owner_name: str
    email: EmailStr
    password: str
    license_number: Optional[str] = None
    address: Optional[str] = None
    state: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int

class RefreshRequest(BaseModel):
    refresh_token: str
