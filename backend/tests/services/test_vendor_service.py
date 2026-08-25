from app.services.vendor_service import VENDOR_EDITABLE_FIELDS


def test_vendor_editable_fields_covers_terms_and_bank_details():
    assert {"payment_terms_days", "credit_period_days", "bank_account_number", "bank_ifsc", "upi_id"} <= \
        VENDOR_EDITABLE_FIELDS
    # name is handled separately (needs re-normalization), never via plain setattr
    assert "name" not in VENDOR_EDITABLE_FIELDS
