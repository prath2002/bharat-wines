
from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    business_name: str
    owner_name: str
    email: EmailStr
    password: str
    license_number: str | None = None
    address: str | None = None
    state: str | None = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
