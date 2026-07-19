import pytest
from httpx import AsyncClient

from app.core.dependencies import ROLE_PERMISSIONS


@pytest.mark.asyncio
async def test_create_user_unauthenticated(client: AsyncClient):
    response = await client.post("/api/v1/users", json={
        "name": "Finance Person",
        "email": "finance@example.com",
        "password": "secret123",
        "role": "FINANCE",
    })
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_list_users_unauthenticated(client: AsyncClient):
    response = await client.get("/api/v1/users")
    assert response.status_code == 401

def test_role_permission_matrix():
    # ADMIN manages users; nobody else does
    assert "users.*" in ROLE_PERMISSIONS["ADMIN"]
    for role in ("STAFF", "STOCK_MANAGER", "FINANCE"):
        assert not any(p.startswith("users.") for p in ROLE_PERMISSIONS[role])

def test_finance_and_staff_bill_permissions():
    assert "bills.*" in ROLE_PERMISSIONS["FINANCE"]
    assert "finance.*" in ROLE_PERMISSIONS["FINANCE"]
    assert "bills.upload" in ROLE_PERMISSIONS["STAFF"]
    assert "bills.view_own" in ROLE_PERMISSIONS["STAFF"]
    # Staff must NOT see all bills or the finance dashboard
    assert "bills.view" not in ROLE_PERMISSIONS["STAFF"]
    assert not any(p.startswith("finance.") for p in ROLE_PERMISSIONS["STAFF"])
    assert not any(p.startswith("bills.") for p in ROLE_PERMISSIONS["STOCK_MANAGER"])
