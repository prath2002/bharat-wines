from app.services.bill_service import derive_payment_status
from app.models.bill import PaymentStatus

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
