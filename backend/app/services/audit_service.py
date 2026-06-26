import uuid
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Request

from app.models.audit_log import AuditLog, ActionEnum

def diff_changes(old_dict: Dict[str, Any], new_dict: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """Compare two dictionaries and return a diff of changes."""
    changes = {}
    
    # Check for modified or new keys
    for key, new_val in new_dict.items():
        if key not in old_dict:
            changes[key] = {"old": None, "new": new_val}
        elif old_dict[key] != new_val:
            changes[key] = {"old": old_dict[key], "new": new_val}
            
    # Check for removed keys
    for key in old_dict:
        if key not in new_dict:
            changes[key] = {"old": old_dict[key], "new": None}
            
    return changes

async def log_action(
    db: AsyncSession,
    user_id: uuid.UUID,
    business_id: uuid.UUID,
    action: ActionEnum,
    entity_type: str,
    entity_id: uuid.UUID,
    changes: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None
) -> AuditLog:
    """Create an audit log entry."""
    audit_log = AuditLog(
        business_id=business_id,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        changes=changes,
        ip_address=ip_address
    )
    db.add(audit_log)
    await db.flush()
    return audit_log

def get_client_ip(request: Request) -> str:
    """Extract client IP from FastAPI request."""
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0]
    return request.client.host if request.client else "unknown"
