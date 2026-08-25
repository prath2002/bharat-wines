import pytest
from pydantic import ValidationError

from app.schemas.bill import BillManualCreateRequest


def test_total_amount_required():
    with pytest.raises(ValidationError):
        BillManualCreateRequest()

def test_total_amount_must_be_positive():
    with pytest.raises(ValidationError):
        BillManualCreateRequest(total_amount=0)

def test_valid_minimal_payload():
    req = BillManualCreateRequest(total_amount=1000)
    assert req.total_amount == 1000
    assert req.vendor_id is None
    assert req.vendor_name is None
