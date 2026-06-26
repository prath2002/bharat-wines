import pytest
from httpx import AsyncClient
import uuid
from app.models.stock_movement import MovementType
from sqlalchemy import text

@pytest.fixture
async def setup_product(db_session, auth_headers):
    # Get business ID from admin headers (we need to fetch it or just use the DB to insert directly)
    # For simplicity, let's insert a product using a raw SQL or repo
    # Assuming tests use an existing test DB with a business and admin
    pass

@pytest.mark.asyncio
async def test_create_sale_movement(async_client: AsyncClient, admin_token_headers, db_session):
    # 1. Create a product first
    product_data = {
        "name": "Test Wine",
        "category": "WINE",
        "size_ml": 750,
        "mrp": 1000.00,
        "scm_code": "TEST-WINE-750"
    }
    prod_resp = await async_client.post("/api/v1/products", json=product_data, headers=admin_token_headers)
    assert prod_resp.status_code == 201
    product_id = prod_resp.json()["id"]

    # 2. Create SALE movement
    movement_data = {
        "product_id": product_id,
        "movement_type": MovementType.SALE.value,
        "quantity": 2,
        "notes": "Test sale"
    }
    
    resp = await async_client.post("/api/v1/movements", json=movement_data, headers=admin_token_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["quantity"] == 2
    assert data["movement_type"] == MovementType.SALE.value
    
    # 3. Check inventory
    inv_resp = await async_client.get(f"/api/v1/inventory/{product_id}", headers=admin_token_headers)
    assert inv_resp.status_code == 200
    inv_data = inv_resp.json()
    # Since opening was 0, it should be -2
    assert inv_data["current_stock"] == -2

@pytest.mark.asyncio
async def test_create_purchase_movement_forbidden(async_client: AsyncClient, admin_token_headers):
    # 1. Create a product first
    product_data = {
        "name": "Test Beer",
        "category": "BEER",
        "size_ml": 500,
        "mrp": 200.00,
        "scm_code": "TEST-BEER-500"
    }
    prod_resp = await async_client.post("/api/v1/products", json=product_data, headers=admin_token_headers)
    product_id = prod_resp.json()["id"]

    # 2. Try to create PURCHASE movement
    movement_data = {
        "product_id": product_id,
        "movement_type": MovementType.PURCHASE.value,
        "quantity": 10
    }
    
    resp = await async_client.post("/api/v1/movements", json=movement_data, headers=admin_token_headers)
    assert resp.status_code == 403
    assert "not allowed" in resp.json()["detail"]

@pytest.mark.asyncio
async def test_zero_quantity_validation(async_client: AsyncClient, admin_token_headers):
    movement_data = {
        "product_id": str(uuid.uuid4()),
        "movement_type": MovementType.SALE.value,
        "quantity": 0
    }
    
    resp = await async_client.post("/api/v1/movements", json=movement_data, headers=admin_token_headers)
    assert resp.status_code == 422
