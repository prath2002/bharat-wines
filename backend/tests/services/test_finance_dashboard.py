import uuid
from datetime import date, datetime, timezone, timedelta
from types import SimpleNamespace

from app.models.bill import BillStatus, PaymentStatus
from app.services.finance_dashboard_service import summarize_bills

def _vendor(name):
    return SimpleNamespace(id=uuid.uuid4(), name=name)

def _settlement(amount, paid_on):
    return SimpleNamespace(amount=amount, paid_on=paid_on)

def _bill(vendor=None, status=BillStatus.VERIFIED, payment_status=PaymentStatus.UNPAID,
          total=1000.0, discount=0.0, charges=None, bill_date=None, due_date=None,
          settlements=None, extracted_vendor_name=None, has_total_mismatch=False):
    return SimpleNamespace(
        id=uuid.uuid4(),
        vendor=vendor,
        vendor_id=vendor.id if vendor else None,
        extracted_vendor_name=extracted_vendor_name or (vendor.name if vendor else None),
        status=status,
        payment_status=payment_status,
        total_amount=total,
        discount_amount=discount,
        charges=charges or [],
        bill_date=bill_date or date(2026, 7, 5),
        due_date=due_date,
        created_at=datetime(2026, 7, 5, tzinfo=timezone.utc),
        settlements=settlements or [],
        has_total_mismatch=has_total_mismatch,
    )

def test_summary_totals_and_vendor_rows():
    abd = _vendor("Allied Blenders")
    usl = _vendor("United Spirits")
    bills = [
        _bill(vendor=abd, total=100000.0, discount=2000.0,
              charges=[{"label": "Freight", "amount": 500.0}],
              payment_status=PaymentStatus.PARTIALLY_PAID,
              settlements=[_settlement(40000.0, date(2026, 7, 10))]),
        _bill(vendor=usl, total=50000.0, payment_status=PaymentStatus.PAID,
              settlements=[_settlement(50000.0, date(2026, 7, 12))]),
        _bill(vendor=abd, status=BillStatus.DRAFT, total=9999.0),
    ]
    summary = summarize_bills(bills)

    assert summary["totals"]["billed"] == 150000.0        # drafts excluded
    assert summary["totals"]["paid"] == 90000.0
    assert summary["totals"]["outstanding"] == 60000.0
    assert summary["totals"]["discounts"] == 2000.0
    assert summary["totals"]["charges"] == 500.0
    assert summary["totals"]["bill_count"] == 2
    assert summary["totals"]["awaiting_review"] == 1

    # Vendor rows sorted by outstanding desc; ABD owes 60k
    assert summary["vendors"][0]["name"] == "Allied Blenders"
    assert summary["vendors"][0]["outstanding"] == 60000.0
    assert summary["vendors"][1]["outstanding"] == 0.0

    assert summary["payment_breakdown"]["PAID"]["count"] == 1
    assert summary["payment_breakdown"]["PARTIALLY_PAID"]["amount"] == 100000.0

    # Draft shows up in attention rail
    assert len(summary["attention"]["drafts"]) == 1

def test_monthly_buckets_split_billed_and_paid_dates():
    v = _vendor("Radico")
    bills = [
        _bill(vendor=v, total=10000.0, bill_date=date(2026, 6, 20),
              payment_status=PaymentStatus.PAID,
              settlements=[_settlement(10000.0, date(2026, 7, 2))]),
    ]
    summary = summarize_bills(bills)
    months = {m["month"]: m for m in summary["monthly"]}
    assert months["2026-06"]["billed"] == 10000.0
    assert months["2026-06"]["paid"] == 0.0
    assert months["2026-07"]["paid"] == 10000.0

def test_date_range_filters_billed_but_keeps_outstanding():
    v = _vendor("Old Vendor")
    bills = [_bill(vendor=v, total=5000.0, bill_date=date(2026, 1, 10))]
    summary = summarize_bills(bills, date_from=date(2026, 7, 1), date_to=date(2026, 7, 31))
    assert summary["totals"]["billed"] == 0.0
    assert summary["totals"]["outstanding"] == 5000.0  # dues don't vanish with the filter

def test_overdue_detection():
    v = _vendor("Slow Payer")
    past_due = date.today() - timedelta(days=15)
    bills = [_bill(vendor=v, total=8000.0, due_date=past_due)]
    summary = summarize_bills(bills)
    assert len(summary["attention"]["overdue"]) == 1
    assert summary["attention"]["overdue"][0]["days_overdue"] == 15
