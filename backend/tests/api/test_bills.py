import pytest
from httpx import AsyncClient

from app.models.user import User, Role
from app.api.v1.bills import _can_view_all
from app.schemas.bill import BillLimitedResponse, BillResponse

def _user(role: Role) -> User:
    u = User()
    u.role = role
    return u

def test_can_view_all_by_role():
    assert _can_view_all(_user(Role.ADMIN)) is True
    assert _can_view_all(_user(Role.FINANCE)) is True
    assert _can_view_all(_user(Role.STAFF)) is False
    assert _can_view_all(_user(Role.STOCK_MANAGER)) is False

def test_limited_projection_has_no_financial_fields():
    # The staff-facing schema must not leak amounts or vendor info
    fields = set(BillLimitedResponse.model_fields.keys())
    assert fields == {"id", "file_url", "status", "created_at"}
    forbidden = {"total_amount", "subtotal", "discount_amount", "charges",
                 "vendor_id", "vendor_name", "payment_status", "amount_paid"}
    assert not (fields & forbidden)
    # ...while the full projection has them
    assert forbidden <= set(BillResponse.model_fields.keys())

@pytest.mark.asyncio
async def test_bills_endpoints_require_auth(client: AsyncClient):
    assert (await client.get("/api/v1/bills")).status_code == 401
    assert (await client.get("/api/v1/bills/summary")).status_code == 401
    assert (await client.post("/api/v1/bills/upload")).status_code == 401
    assert (await client.get("/api/v1/vendors")).status_code == 401
