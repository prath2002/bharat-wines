import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_create_product_unauthenticated(client: AsyncClient):
    response = await client.post("/api/v1/products", json={
        "name": "Test Wine",
        "category": "WINE",
        "size_ml": 750,
        "mrp": 500.00,
        "scm_code": "TEST-WINE-750"
    })
    # Should be 401 because no token
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_list_products_unauthenticated(client: AsyncClient):
    response = await client.get("/api/v1/products")
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_barcode_lookup_validation(client: AsyncClient):
    # Missing value param
    response = await client.get("/api/v1/barcodes/lookup")
    assert response.status_code == 401 # Auth checked first
