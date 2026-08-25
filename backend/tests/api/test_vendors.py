import pytest
from httpx import AsyncClient

from app.schemas.vendor import VendorResponse


def test_vendor_response_has_payment_terms_and_bank_fields():
    fields = set(VendorResponse.model_fields.keys())
    assert {"payment_terms_days", "credit_period_days", "bank_account_number", "bank_ifsc", "upi_id"} <= fields

@pytest.mark.asyncio
async def test_vendors_endpoints_require_auth(client: AsyncClient):
    assert (await client.get("/api/v1/vendors")).status_code == 401
    assert (await client.post("/api/v1/vendors", json={"name": "ABC"})).status_code == 401
    assert (await client.get("/api/v1/vendors/00000000-0000-0000-0000-000000000000")).status_code == 401
    assert (await client.get("/api/v1/vendors/00000000-0000-0000-0000-000000000000/statement")).status_code == 401
    assert (await client.put(
        "/api/v1/vendors/00000000-0000-0000-0000-000000000000", json={"name": "ABC"}
    )).status_code == 401
