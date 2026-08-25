from app.models.payment_schedule import PaymentScheduleStatus
from app.services.payment_schedule_service import _committed_amount


class FakeSettlement:
    def __init__(self, amount):
        self.amount = amount

class FakeSchedule:
    _counter = 0

    def __init__(self, amount, status, id_=None):
        FakeSchedule._counter += 1
        self.amount = amount
        self.status = status
        self.id = id_ if id_ is not None else f"fake-{FakeSchedule._counter}"

class FakeBill:
    def __init__(self, settlements=None, payment_schedules=None):
        self.settlements = settlements or []
        self.payment_schedules = payment_schedules or []

def test_committed_amount_sums_settlements_and_active_schedules():
    bill = FakeBill(
        settlements=[FakeSettlement(200.0)],
        payment_schedules=[
            FakeSchedule(300.0, PaymentScheduleStatus.SCHEDULED),
            FakeSchedule(100.0, PaymentScheduleStatus.CANCELLED),  # excluded
        ],
    )
    assert _committed_amount(bill) == 500.0

def test_committed_amount_excludes_given_schedule():
    schedule = FakeSchedule(300.0, PaymentScheduleStatus.SCHEDULED, id_="s1")
    bill = FakeBill(settlements=[], payment_schedules=[schedule])
    assert _committed_amount(bill, exclude_schedule_id="s1") == 0

def test_committed_amount_excludes_terminal_statuses():
    bill = FakeBill(payment_schedules=[
        FakeSchedule(100.0, PaymentScheduleStatus.PAID),
        FakeSchedule(100.0, PaymentScheduleStatus.FAILED),
    ])
    assert _committed_amount(bill) == 0
