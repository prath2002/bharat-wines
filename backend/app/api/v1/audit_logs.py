from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
import uuid
from typing import Optional

from app.db.session import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import User, Role
from app.models.audit_log import AuditLog

router = APIRouter()

@router.get("/")
async def get_audit_logs(
    entity_type: Optional[str] = None,
    user_id: Optional[uuid.UUID] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Get audit logs with pagination and optional filters. Admin only."""
    stmt = select(AuditLog).where(AuditLog.business_id == current_user.business_id)
    
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
    if user_id:
        stmt = stmt.where(AuditLog.user_id == user_id)
        
    stmt = stmt.order_by(desc(AuditLog.created_at)).offset(skip).limit(limit)
    
    result = await db.execute(stmt)
    logs = result.scalars().all()
    
    return {"data": logs}
