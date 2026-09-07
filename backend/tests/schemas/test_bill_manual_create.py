import pytest
from pydantic import ValidationError

from app.schemas.bill import BillManualCreateRequest


def test_subtotal_required():
    with pytest.raises(ValidationError):
        BillManualCreateRequest()

def test_subtotal_must_be_positive():
    with pytest.raises(ValidationError):
        BillManualCreateRequest(subtotal=0)

def test_valid_minimal_payload():
    req = BillManualCreateRequest(subtotal=1000)
    assert req.subtotal == 1000
    assert req.vendor_id is None
    assert req.vendor_name is None
    assert req.discounts == []

def test_discounts_accept_label_and_amount():
    req = BillManualCreateRequest(subtotal=1000, discounts=[{"label": "Scheme discount", "amount": 50}])
    assert req.discounts[0].label == "Scheme discount"
    assert req.discounts[0].amount == 50

def test_total_amount_is_not_an_accepted_field():
    # total_amount is always server-derived; extra client input for it must not
    # silently change behavior, so pydantic's default of ignoring unknown
    # fields is fine here -- this test documents that it has no effect.
    req = BillManualCreateRequest(subtotal=1000, total_amount=99999)
    assert not hasattr(req, "total_amount")
