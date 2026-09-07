from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.services import auth_service
from app.services.auth_service import IssuedTokens

router = APIRouter()

REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_COOKIE_PATH = "/api/v1/auth"


def _set_refresh_cookie(response: Response, tokens: IssuedTokens) -> None:
    # SameSite=None is required for cross-site cookies (e.g. Vercel frontend
    # calling a Render backend) and mandates Secure. In dev, frontend and
    # backend share the "localhost" site (only ports differ), so Lax + no
    # Secure works over plain HTTP.
    secure = settings.APP_ENV != "dev"
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=tokens.refresh_token,
        max_age=settings.REFRESH_TOKEN_DAYS * 24 * 60 * 60,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=secure,
        samesite="none" if secure else "lax",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(key=REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_PATH)


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(data: RegisterRequest, response: Response, db: AsyncSession = Depends(get_db)):
    """Register a new business and admin user."""
    tokens = await auth_service.register_business_and_user(db, data)
    _set_refresh_cookie(response, tokens)
    return tokens.response

@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    """Authenticate user and return tokens (used by frontend)."""
    tokens = await auth_service.authenticate_user(db, data)
    _set_refresh_cookie(response, tokens)
    return tokens.response

@router.post("/token", response_model=TokenResponse)
async def swagger_login(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Authenticate user and return tokens (used by Swagger UI)."""
    # Map the form_data.username to email since OAuth2PasswordRequestForm hardcodes the field as 'username'
    data = LoginRequest(email=form_data.username, password=form_data.password)
    tokens = await auth_service.authenticate_user(db, data)
    _set_refresh_cookie(response, tokens)
    return tokens.response

@router.post("/refresh", response_model=TokenResponse)
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    """Refresh access token using the refresh token cookie."""
    refresh_token_str = request.cookies.get(REFRESH_COOKIE_NAME)
    if not refresh_token_str:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh token")
    tokens = await auth_service.refresh_tokens(db, refresh_token_str)
    _set_refresh_cookie(response, tokens)
    return tokens.response

@router.post("/logout", status_code=204)
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    """Revoke the refresh token cookie, if any, and clear it."""
    refresh_token_str = request.cookies.get(REFRESH_COOKIE_NAME)
    if refresh_token_str:
        await auth_service.logout_user(db, refresh_token_str)
    _clear_refresh_cookie(response)
