import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_payment_schedule_endpoints_require_auth(client: AsyncClient):
    bill_id = "00000000-0000-0000-0000-000000000000"
    schedule_id = "00000000-0000-0000-0000-000000000000"
    assert (await client.post(f"/api/v1/bills/{bill_id}/payment-schedules")).status_code == 401
    assert (await client.get("/api/v1/payment-schedules")).status_code == 401
    assert (await client.put(f"/api/v1/payment-schedules/{schedule_id}")).status_code == 401
    assert (await client.delete(f"/api/v1/payment-schedules/{schedule_id}")).status_code == 401
    assert (await client.post(f"/api/v1/payment-schedules/{schedule_id}/submit-for-approval")).status_code == 401
    assert (await client.post(f"/api/v1/payment-schedules/{schedule_id}/complete")).status_code == 401

@pytest.mark.asyncio
async def test_payment_approval_endpoints_require_auth(client: AsyncClient):
    approval_id = "00000000-0000-0000-0000-000000000000"
    assert (await client.get("/api/v1/payment-approvals")).status_code == 401
    assert (await client.post(f"/api/v1/payment-approvals/{approval_id}/approve")).status_code == 401
    assert (await client.post(f"/api/v1/payment-approvals/{approval_id}/reject")).status_code == 401
    assert (await client.post(f"/api/v1/payment-approvals/{approval_id}/hold")).status_code == 401
