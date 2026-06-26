import contextvars
import uuid
from typing import Optional

# This context variable will hold the current business ID for the request
current_business_id: contextvars.ContextVar[Optional[uuid.UUID]] = contextvars.ContextVar(
    "current_business_id", default=None
)

def set_tenant(business_id: uuid.UUID):
    return current_business_id.set(business_id)

def get_tenant() -> Optional[uuid.UUID]:
    return current_business_id.get()
