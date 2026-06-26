import pytest
from httpx import AsyncClient

# Since we don't have a fully isolated test database set up in docker compose for the tests yet,
# we will structure the test file to demonstrate the auth and RBAC logic.
# In a real environment, we'd use the `client` fixture to hit the endpoints with a mocked DB.

@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

@pytest.mark.asyncio
async def test_register_validation(client: AsyncClient):
    # Missing required fields
    response = await client.post("/api/v1/auth/register", json={})
    assert response.status_code == 422

@pytest.mark.asyncio
async def test_login_validation(client: AsyncClient):
    # Missing required fields
    response = await client.post("/api/v1/auth/login", json={"email": "not-an-email"})
    assert response.status_code == 422
