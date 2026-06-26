import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status

from app.core.security import hash_password, verify_password, create_access_token, generate_refresh_token
from app.core.config import settings
from app.models.business import Business
from app.models.user import User, Role
from app.models.refresh_token import RefreshToken
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse

async def register_business_and_user(db: AsyncSession, data: RegisterRequest) -> TokenResponse:
    # Check if email already exists
    stmt = select(User).where(User.email == data.email)
    result = await db.execute(stmt)
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    # Create Business
    business = Business(
        name=data.business_name,
        license_number=data.license_number,
        address=data.address,
        state=data.state
    )
    db.add(business)
    await db.flush() # To get business.id

    # Create Admin User
    user = User(
        business_id=business.id,
        email=data.email,
        password_hash=hash_password(data.password),
        name=data.owner_name,
        role=Role.ADMIN
    )
    db.add(user)
    await db.flush()

    return await _issue_tokens(db, user)

async def authenticate_user(db: AsyncSession, data: LoginRequest) -> TokenResponse:
    stmt = select(User).where(User.email == data.email, User.is_active == True)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    return await _issue_tokens(db, user)

async def refresh_tokens(db: AsyncSession, refresh_token_str: str) -> TokenResponse:
    stmt = select(RefreshToken).where(
        RefreshToken.token_hash == refresh_token_str,
        RefreshToken.is_revoked == False,
        RefreshToken.expires_at > datetime.now(timezone.utc)
    )
    result = await db.execute(stmt)
    token_record = result.scalar_one_or_none()

    if not token_record:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")

    # Get User
    user_stmt = select(User).where(User.id == token_record.user_id, User.is_active == True)
    user_result = await db.execute(user_stmt)
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not active")

    # Revoke old refresh token (rotate)
    token_record.is_revoked = True
    
    return await _issue_tokens(db, user)

async def logout_user(db: AsyncSession, refresh_token_str: str) -> None:
    stmt = select(RefreshToken).where(RefreshToken.token_hash == refresh_token_str)
    result = await db.execute(stmt)
    token_record = result.scalar_one_or_none()

    if token_record:
        token_record.is_revoked = True
        await db.commit()

async def _issue_tokens(db: AsyncSession, user: User) -> TokenResponse:
    access_token = create_access_token(user.id, user.business_id, user.role)
    refresh_token_str = generate_refresh_token()
    
    # Store refresh token
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_DAYS)
    db_refresh_token = RefreshToken(
        user_id=user.id,
        token_hash=refresh_token_str,
        expires_at=expires_at
    )
    db.add(db_refresh_token)
    await db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token_str,
        expires_in=settings.JWT_EXPIRY_MINUTES * 60
    )
