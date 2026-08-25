import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Request

from app.models.audit_log import AuditLog, ActionEnum

def _json_safe(value: Any) -> Any:
    """AuditLog.changes is JSONB — UUID/date/Decimal values (common in our
    payloads) aren't JSON-serializable as-is, so normalize them recursively."""
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_json_safe(v) for v in value]
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value

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

async def record(
    db: AsyncSession, user_id: uuid.UUID, business_id: uuid.UUID, action: ActionEnum,
    entity_type: str, entity_id: uuid.UUID, changes: Optional[Dict[str, Any]] = None,
) -> None:
    """Log + commit in one call, for routes that already committed their
    primary mutation and just need the audit row persisted alongside it."""
    await log_action(db, user_id, business_id, action, entity_type, entity_id, _json_safe(changes))
    await db.commit()

def get_client_ip(request: Request) -> str:
    """Extract client IP from FastAPI request."""
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0]
    return request.client.host if request.client else "unknown"
