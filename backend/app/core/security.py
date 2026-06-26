import uuid
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.models.user import Role

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def create_access_token(user_id: uuid.UUID, business_id: uuid.UUID, role: Role) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRY_MINUTES)
    to_encode = {
        "sub": str(user_id),
        "business_id": str(business_id),
        "role": role.value,
        "exp": expire,
    }
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm="HS256")
    return encoded_jwt

def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])

def generate_refresh_token() -> str:
    import secrets
    return secrets.token_urlsafe(64)
