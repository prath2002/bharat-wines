import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_document_endpoints_require_auth(client: AsyncClient):
    bill_id = "00000000-0000-0000-0000-000000000000"
    payment_id = "00000000-0000-0000-0000-000000000000"
    document_id = "00000000-0000-0000-0000-000000000000"
    assert (await client.post(f"/api/v1/bills/{bill_id}/documents")).status_code == 401
    assert (await client.get(f"/api/v1/bills/{bill_id}/documents")).status_code == 401
    assert (await client.post(f"/api/v1/payments/{payment_id}/documents")).status_code == 401
    assert (await client.get(f"/api/v1/payments/{payment_id}/documents")).status_code == 401
    assert (await client.delete(f"/api/v1/documents/{document_id}")).status_code == 401
