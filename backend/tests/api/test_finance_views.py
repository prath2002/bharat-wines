import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_finance_view_endpoints_require_auth(client: AsyncClient):
    assert (await client.get("/api/v1/finance/pending-bills")).status_code == 401
    assert (await client.get("/api/v1/finance/overdue-bills")).status_code == 401
    assert (await client.get("/api/v1/finance/payment-calendar")).status_code == 401
    assert (await client.get("/api/v1/finance/payment-history")).status_code == 401
