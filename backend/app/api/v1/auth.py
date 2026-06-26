from fastapi import APIRouter, Depends, Response, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, RefreshRequest
from app.services import auth_service
from fastapi.security import OAuth2PasswordRequestForm

router = APIRouter()

@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new business and admin user."""
    return await auth_service.register_business_and_user(db, data)

@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate user and return tokens (used by frontend)."""
    return await auth_service.authenticate_user(db, data)

@router.post("/token", response_model=TokenResponse)
async def swagger_login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    """Authenticate user and return tokens (used by Swagger UI)."""
    # Map the form_data.username to email since OAuth2PasswordRequestForm hardcodes the field as 'username'
    data = LoginRequest(email=form_data.username, password=form_data.password)
    return await auth_service.authenticate_user(db, data)

@router.post("/refresh", response_model=TokenResponse)
async def refresh(data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Refresh access token using refresh token."""
    return await auth_service.refresh_tokens(db, data.refresh_token)

@router.post("/logout", status_code=204)
async def logout(data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Revoke refresh token."""
    await auth_service.logout_user(db, data.refresh_token)
