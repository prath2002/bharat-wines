from datetime import date

from app.models.bill import PaymentStatus
from app.services.bill_service import EDITABLE_FIELDS, derive_payment_status, due_date_from_terms


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
