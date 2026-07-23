import uuid
from decimal import Decimal

from app.workers.bill_processing import compute_total_check, match_vendor, normalize_vendor_name


class FakeVendor:
    def __init__(self, name):
        self.id = uuid.uuid4()
        self.name = name

def test_normalize_vendor_name_strips_suffixes():
    assert normalize_vendor_name("Allied Blenders and Distillers Pvt. Ltd.") == "allied blenders and distillers"
    assert normalize_vendor_name("  UNITED  SPIRITS LIMITED ") == "united spirits"
    assert normalize_vendor_name("") == ""

def test_compute_total_check_consistent():
    computed, mismatch = compute_total_check(125000.0, 3500.0, [{"amount": 1200.0}, {"amount": 250.0}], 122950.0)
    assert computed == Decimal("122950.0")
    assert mismatch is False

def test_compute_total_check_mismatch():
    _, mismatch = compute_total_check(100000.0, 0.0, [], 98000.0)
    assert mismatch is True

def test_compute_total_check_roundoff_tolerated():
    _, mismatch = compute_total_check(1000.6, 0.0, [], 1000.0)
    assert mismatch is False

def test_compute_total_check_missing_subtotal():
    computed, mismatch = compute_total_check(None, 0.0, [], 5000.0)
    assert computed is None and mismatch is False

def test_compute_total_check_missing_total_uses_computed():
    computed, mismatch = compute_total_check(5000.0, 500.0, [{"amount": 100.0}], None)
    assert computed == Decimal("4600.0") and mismatch is False

def test_match_vendor_fuzzy_hit_and_miss():
    vendors = [FakeVendor("Allied Blenders and Distillers Pvt. Ltd."), FakeVendor("United Spirits Limited")]
    vid, score = match_vendor("ALLIED BLENDERS & DISTILLERS PVT LTD", vendors)
    assert vid == vendors[0].id
    assert score >= 85.0

    vid, score = match_vendor("Radico Khaitan Ltd", vendors)
    assert vid is None and score == 0.0

def test_match_vendor_empty_inputs():
    assert match_vendor("", []) == (None, 0.0)
    assert match_vendor("Someone", []) == (None, 0.0)
