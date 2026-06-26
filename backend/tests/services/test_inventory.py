import pytest
from datetime import datetime, timedelta
import uuid

@pytest.mark.asyncio
async def test_inventory_calculations(async_client, admin_token_headers):
    # Create product
    prod_resp = await async_client.post("/api/v1/products", json={
        "name": "Math Wine",
        "category": "WINE",
        "size_ml": 750,
        "mrp": 100.00,
        "scm_code": "MATH-WINE"
    }, headers=admin_token_headers)
    product_id = prod_resp.json()["id"]

    # We cannot create opening/purchase via API currently, so we'll test with adjustments, sales, returns, damages
    
    # 1. Adjustment (+100)
    await async_client.post("/api/v1/movements", json={
        "product_id": product_id,
        "movement_type": "ADJUSTMENT",
        "quantity": 100
    }, headers=admin_token_headers)
    
    # 2. Return (+5)
    await async_client.post("/api/v1/movements", json={
        "product_id": product_id,
        "movement_type": "RETURN",
        "quantity": 5
    }, headers=admin_token_headers)
    
    # 3. Sale (-30)
    await async_client.post("/api/v1/movements", json={
        "product_id": product_id,
        "movement_type": "SALE",
        "quantity": 30
    }, headers=admin_token_headers)
    
    # 4. Damage (-3)
    await async_client.post("/api/v1/movements", json={
        "product_id": product_id,
        "movement_type": "DAMAGE",
        "quantity": 3
    }, headers=admin_token_headers)
    
    # Check inventory
    inv_resp = await async_client.get(f"/api/v1/inventory/{product_id}", headers=admin_token_headers)
    assert inv_resp.status_code == 200
    inv_data = inv_resp.json()
    # 100 + 5 - 30 - 3 = 72
    assert inv_data["current_stock"] == 72

@pytest.mark.asyncio
async def test_revenue_report(async_client, admin_token_headers):
    # Setup dates
    end_date = datetime.utcnow() + timedelta(days=1)
    start_date = datetime.utcnow() - timedelta(days=1)
    
    resp = await async_client.get(f"/api/v1/reports/revenue?start_date={start_date.isoformat()}Z&end_date={end_date.isoformat()}Z", headers=admin_token_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "total_revenue" in data
    assert "breakdown" in data

@pytest.mark.asyncio
async def test_low_stock_report(async_client, admin_token_headers):
    resp = await async_client.get(f"/api/v1/reports/low-stock?threshold=1000", headers=admin_token_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    # The Math Wine should be in there since its stock is 72, which is < 1000
    assert any(item["product_name"] == "Math Wine" for item in data)
