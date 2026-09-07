from datetime import date

from app.models.bill import Bill, PaymentStatus
from app.services.bill_service import (
    EDITABLE_FIELDS,
    derive_payment_status,
    due_date_from_terms,
    normalize_editable_payload,
    recompute_total,
)


class FakeSettlement:
    def __init__(self, amount):
        self.amount = amount

def test_no_settlements_is_unpaid():
    assert derive_payment_status(1000.0, []) == PaymentStatus.UNPAID

def test_partial_settlement():
    assert derive_payment_status(1000.0, [FakeSettlement(400.0)]) == PaymentStatus.PARTIALLY_PAID

def test_multiple_settlements_reach_paid():
    settlements = [FakeSettlement(400.0), FakeSettlement(600.0)]
    assert derive_payment_status(1000.0, settlements) == PaymentStatus.PAID

def test_exact_decimal_sum_is_paid():
    # 0.1 + 0.2 style float traps must not leave a paid bill as partial
    settlements = [FakeSettlement(333.33), FakeSettlement(333.33), FakeSettlement(333.34)]
    assert derive_payment_status(1000.0, settlements) == PaymentStatus.PAID

def test_missing_total_with_payments_is_partial():
    assert derive_payment_status(None, [FakeSettlement(100.0)]) == PaymentStatus.PARTIALLY_PAID

def test_due_date_from_terms_adds_days():
    assert due_date_from_terms(date(2026, 8, 1), 30) == date(2026, 8, 31)

def test_due_date_from_terms_zero_days_is_bill_date():
    assert due_date_from_terms(date(2026, 8, 1), 0) == date(2026, 8, 1)

def test_editable_fields_covers_due_date_source():
    assert "due_date_source" in EDITABLE_FIELDS

def test_recompute_total_single_discount_and_charge():
    bill = Bill(subtotal=1000.0, discounts=[{"label": "Scheme", "amount": 100.0}], charges=[{"label": "Freight", "amount": 50.0}])
    recompute_total(bill)
    assert bill.total_amount == 950.0

def test_recompute_total_multiple_discounts_and_charges():
    bill = Bill(
        subtotal=10000.0,
        discounts=[{"label": "Scheme", "amount": 500.0}, {"label": "Cash", "amount": 200.0}],
        charges=[{"label": "Freight", "amount": 150.0}, {"label": "TCS", "amount": 100.0}],
    )
    recompute_total(bill)
    assert bill.total_amount == 9550.0

def test_recompute_total_no_subtotal_is_none():
    bill = Bill(subtotal=None, discounts=[], charges=[])
    recompute_total(bill)
    assert bill.total_amount is None

def test_recompute_total_treats_missing_discounts_and_charges_as_empty():
    bill = Bill(subtotal=1000.0, discounts=None, charges=None)
    recompute_total(bill)
    assert bill.total_amount == 1000.0

def test_editable_fields_no_longer_includes_total_amount_or_old_discount_field():
    assert "total_amount" not in EDITABLE_FIELDS
    assert "discount_amount" not in EDITABLE_FIELDS
    assert "discounts" in EDITABLE_FIELDS

def test_normalize_editable_payload_coerces_null_discounts_and_charges_to_empty_list():
    payload = {"subtotal": 1000.0, "discounts": None, "charges": None}
    assert normalize_editable_payload(payload) == {"subtotal": 1000.0, "discounts": [], "charges": []}

def test_normalize_editable_payload_leaves_provided_lists_untouched():
    payload = {"discounts": [{"label": "Scheme", "amount": 100.0}]}
    assert normalize_editable_payload(payload) == {"discounts": [{"label": "Scheme", "amount": 100.0}]}

def test_normalize_editable_payload_ignores_fields_not_present():
    payload = {"notes": "hello"}
    assert normalize_editable_payload(payload) == {"notes": "hello"}
