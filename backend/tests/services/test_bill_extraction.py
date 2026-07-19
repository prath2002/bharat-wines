import pytest

from app.integrations.ai import get_bill_extraction_client
from app.integrations.ai.bill_extraction_interface import BillExtractionResult
from app.integrations.ai.bill_extraction_mock import MockBillExtractionClient
from app.integrations.ai.bill_extraction_openrouter import _to_float


@pytest.mark.asyncio
async def test_mock_bill_extraction_returns_valid_result(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "mock")
    client = get_bill_extraction_client()
    assert isinstance(client, MockBillExtractionClient)

    result = await client.extract_structured("dummy text")
    assert isinstance(result, BillExtractionResult)
    assert result.vendor_name
    assert result.total_amount is not None
    # Mock is internally consistent: subtotal - discount + charges == total
    computed = result.subtotal - result.discount_amount + sum(c.amount for c in result.charges)
    assert abs(computed - result.total_amount) < 0.01

def test_to_float_handles_indian_formats():
    assert _to_float("1,25,000.00") == 125000.0
    assert _to_float("₹ 3,500") == 3500.0
    assert _to_float(None) is None
    assert _to_float("n/a", default=0.0) == 0.0
