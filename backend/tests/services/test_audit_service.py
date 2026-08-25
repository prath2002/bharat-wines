import uuid
from datetime import date
from decimal import Decimal

from app.services.audit_service import _json_safe


def test_json_safe_converts_uuid_date_decimal_recursively():
    payload = {
        "vendor_id": uuid.UUID("12345678-1234-5678-1234-567812345678"),
        "bill_date": date(2026, 8, 1),
        "total_amount": Decimal("1000.50"),
        "charges": [{"label": "Freight", "amount": Decimal("50.0")}],
        "notes": "plain string",
        "count": 3,
    }
    result = _json_safe(payload)
    assert result["vendor_id"] == "12345678-1234-5678-1234-567812345678"
    assert result["bill_date"] == "2026-08-01"
    assert result["total_amount"] == 1000.5
    assert result["charges"][0]["amount"] == 50.0
    assert result["notes"] == "plain string"
    assert result["count"] == 3

def test_json_safe_handles_none():
    assert _json_safe(None) is None
