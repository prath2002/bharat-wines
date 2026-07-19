from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
import jwt
from typing import Callable, List
import uuid

from app.core.config import settings
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User, Role
from sqlalchemy import select

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")

ROLE_PERMISSIONS = {
    "ADMIN": ["products.*", "movements.*", "tp.*", "mrp.approve", "scm.*", "reports.*", "users.*", "imports.*", "bills.*", "vendors.*", "finance.*"],
    "STOCK_MANAGER": ["products.create", "products.edit", "products.view", "movements.*", "tp.upload", "tp.approve", "reports.view"],
    "STAFF": ["products.view", "movements.create", "bills.upload", "bills.view_own"],
    "FINANCE": ["bills.*", "vendors.*", "finance.*", "products.view", "reports.view"],
}

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise credentials_exception

    stmt = select(User).where(User.id == uuid.UUID(user_id), User.is_active == True)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if user is None:
        raise credentials_exception
    return user

def require_role(*allowed_roles: Role) -> Callable:
    async def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Operation not permitted"
            )
        return current_user
    return role_checker

def require_permissions(*required_permissions: str) -> Callable:
    async def permission_checker(current_user: User = Depends(get_current_user)):
        user_perms = ROLE_PERMISSIONS.get(current_user.role.value, [])
        for req_perm in required_permissions:
            # Simple wildcard check: if "products.*" is in user_perms and we need "products.create"
            has_perm = False
            if req_perm in user_perms:
                has_perm = True
            else:
                prefix = req_perm.split(".")[0] + ".*"
                if prefix in user_perms:
                    has_perm = True
            
            if not has_perm:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Missing permission: {req_perm}"
                )
        return current_user
    return permission_checker
