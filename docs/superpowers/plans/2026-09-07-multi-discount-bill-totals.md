# Multiple Discounts, Multiple Charges, Auto-Calculated Grand Total Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single `discount_amount` field on a Bill with a repeatable list of `{label, amount}` discounts (mirroring the existing `charges` field), and make the bill's grand total always server-computed (`subtotal − Σdiscounts + Σcharges`) instead of a value typed by a human.

**Architecture:** `Bill.discount_amount: float` becomes `Bill.discounts: JSONB` (list of `{label, amount}`, reusing the existing `ChargeItem` schema). `total_amount` stays a stored column but is never accepted from the client anymore — it's recomputed server-side in one shared helper (`recompute_total`) every time subtotal/discounts/charges change, whether via manual bill creation or the existing PATCH-then-verify flow. Both the Manual Bill Entry and AI-Scan Verify pages get the same UI treatment: a repeatable Discounts list (identical pattern to the existing Additional Charges list) and a read-only, live-computed Grand Total field.

**Tech Stack:** FastAPI + SQLAlchemy (async) + Alembic + Pydantic v2 on the backend; Next.js + React Query + TypeScript on the frontend. No frontend test runner is configured in this repo — frontend changes are verified with `tsc --noEmit` plus manual verification against the running dev stack, matching existing project practice.

## Global Constraints

- Reuse the existing `ChargeItem` Pydantic schema (`{label: str, amount: float}`) for discounts — do not create a new schema class.
- Discounts get **no separate note field** — the label is the note (explicit user decision during design).
- Charges are **unchanged** — still just `{label, amount}`, no note field added there either.
- `total_amount` must never be accepted as client input again, on any bill-writing endpoint (manual create, PATCH update). It is always derived.
- No data backfill logic — the target database has zero bill rows today. Do not write migration code that tries to convert old `discount_amount` values into the new `discounts` list.
- All existing backend tests that reference the old `discount_amount` shape must be updated in the same task that changes the underlying code, so the suite stays green after every task.
- Every backend task must end with the relevant test file(s) passing via `docker compose exec backend python -m pytest <path> -v`. Assume the Docker stack (`docker compose up -d`) is already running against the project's configured database — do not start/stop it as part of these tasks.

---

### Task 1: Data model — replace `discount_amount` with `discounts`

**Files:**
- Modify: `backend/app/models/bill.py:43`
- Create: `backend/alembic/versions/e5f6a7b8c9d0_replace_discount_amount_with_discounts.py`

**Interfaces:**
- Produces: `Bill.discounts: list | None` (JSONB column, same shape convention as `Bill.charges` — list of dicts, may be `None`), replacing `Bill.discount_amount: float`.

- [ ] **Step 1: Change the model column**

In `backend/app/models/bill.py`, replace line 43:

```python
    discount_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, server_default="0")
```

with:

```python
    # List of {"label": str, "amount": float}, e.g. scheme discount, cash discount.
    discounts: Mapped[list | None] = mapped_column(JSONB, nullable=True)
```

(This sits right next to the existing `charges` field, which already uses `JSONB` and is imported at the top of the file — no new import needed.)

- [ ] **Step 2: Write the migration**

Create `backend/alembic/versions/e5f6a7b8c9d0_replace_discount_amount_with_discounts.py`:

```python
"""replace discount_amount with discounts (supports multiple discounts)

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-09-07
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'bills',
        sa.Column('discounts', postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default='[]'),
    )
    op.drop_column('bills', 'discount_amount')


def downgrade() -> None:
    op.add_column(
        'bills',
        sa.Column('discount_amount', sa.Numeric(12, 2), nullable=False, server_default='0'),
    )
    op.drop_column('bills', 'discounts')
```

- [ ] **Step 3: Apply the migration and verify**

Run: `docker compose exec backend alembic upgrade head`
Expected: Output ends with `Running upgrade d4e5f6a7b8c9 -> e5f6a7b8c9d0, replace discount_amount with discounts (supports multiple discounts)` and no errors.

Verify the column actually changed:

Run:
```bash
docker compose exec -T db psql -U postgres -d bharat_wines -c "\d bills" 2>&1 | grep -E "discount|^$" || true
```
(If the backend is wired to a non-local database, as it may be in this project, connect with whatever client/credentials reach that database instead — the goal is just to confirm the `bills` table has a `discounts` column and no `discount_amount` column.)
Expected: a `discounts` row (type `jsonb`), no `discount_amount` row.

- [ ] **Step 4: Commit**

```bash
git add backend/app/models/bill.py backend/alembic/versions/e5f6a7b8c9d0_replace_discount_amount_with_discounts.py
git commit -m "$(cat <<'EOF'
feat(bills): replace single discount_amount with a discounts list

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Schemas — `discounts`, required `subtotal`, drop client-supplied `total_amount`, expose `extracted_data`

**Files:**
- Modify: `backend/app/schemas/bill.py`
- Modify (rewrite): `backend/tests/schemas/test_bill_manual_create.py`
- Modify: `backend/tests/api/test_bills.py:24`

**Interfaces:**
- Consumes: `ChargeItem` (already defined in this file, unchanged: `{label: str, amount: float}`)
- Produces: `BillManualCreateRequest.discounts: list[ChargeItem]`, `.subtotal: float` (required, must be > 0); `BillUpdateRequest.discounts: list[ChargeItem] | None`; `BillResponse.discounts: list[ChargeItem]`; `BillDetailResponse.extracted_data: dict | None`.

- [ ] **Step 1: Write the failing schema tests**

Replace the full contents of `backend/tests/schemas/test_bill_manual_create.py`:

```python
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
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `docker compose exec backend python -m pytest tests/schemas/test_bill_manual_create.py -v`
Expected: FAIL — `BillManualCreateRequest()` currently succeeds (subtotal is optional today) and `req.discounts` doesn't exist yet.

- [ ] **Step 3: Update the schemas**

In `backend/app/schemas/bill.py`, replace `BillUpdateRequest`, `BillManualCreateRequest`, `BillResponse`, and `BillDetailResponse` with:

```python
class BillUpdateRequest(BaseModel):
    bill_number: str | None = None
    bill_date: date | None = None
    vendor_id: uuid.UUID | None = None
    extracted_vendor_name: str | None = None
    subtotal: float | None = None
    discounts: list[ChargeItem] | None = None
    charges: list[ChargeItem] | None = None
    due_date: date | None = None
    due_date_source: DueDateSource | None = None
    notes: str | None = None

class VerifyRequest(BaseModel):
    vendor_name: str | None = None

class BillManualCreateRequest(BaseModel):
    bill_number: str | None = None
    bill_date: date | None = None
    vendor_id: uuid.UUID | None = None
    vendor_name: str | None = None
    subtotal: float
    discounts: list[ChargeItem] = []
    charges: list[ChargeItem] | None = None
    due_date: date | None = None
    due_date_source: DueDateSource | None = None
    notes: str | None = None

    @field_validator("subtotal")
    @classmethod
    def subtotal_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("subtotal must be positive")
        return v

class BillResponse(BaseModel):
    """Full projection for FINANCE / ADMIN."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    vendor_id: uuid.UUID | None = None
    vendor_name: str | None = None
    extracted_vendor_name: str | None = None
    uploaded_by: uuid.UUID
    file_url: str | None = None
    bill_number: str | None = None
    bill_date: date | None = None
    subtotal: float | None = None
    discounts: list[ChargeItem] = []
    charges: list[ChargeItem] | None = None
    total_amount: float | None = None
    has_total_mismatch: bool = False
    status: BillStatus
    payment_status: PaymentStatus
    amount_paid: float = 0
    due_date: date | None = None
    due_date_source: DueDateSource | None = None
    notes: str | None = None
    verified_at: datetime | None = None
    created_at: datetime

class BillDetailResponse(BillResponse):
    ocr_raw_text: str | None = None
    extracted_data: dict | None = None
    settlements: list[SettlementResponse] = []
```

(Everything above `BillUpdateRequest` — `ChargeItem`, `DueDateRecommendationResponse`, `SettlementResponse`, `SettlementCreateRequest` — is unchanged; only the four classes shown are replaced. `BillLimitedResponse` at the bottom of the file is also unchanged.)

- [ ] **Step 4: Run the schema tests again to verify they pass**

Run: `docker compose exec backend python -m pytest tests/schemas/test_bill_manual_create.py -v`
Expected: PASS (5 tests)

- [ ] **Step 5: Fix the API test that checks the forbidden-fields list**

In `backend/tests/api/test_bills.py`, line 24, replace:

```python
    forbidden = {"total_amount", "subtotal", "discount_amount", "charges",
                 "vendor_id", "vendor_name", "payment_status", "amount_paid"}
```

with:

```python
    forbidden = {"total_amount", "subtotal", "discounts", "charges",
                 "vendor_id", "vendor_name", "payment_status", "amount_paid"}
```

- [ ] **Step 6: Run the full bills API test file**

Run: `docker compose exec backend python -m pytest tests/api/test_bills.py -v`
Expected: PASS (all tests, including `test_limited_projection_has_no_financial_fields`)

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/bill.py backend/tests/schemas/test_bill_manual_create.py backend/tests/api/test_bills.py
git commit -m "$(cat <<'EOF'
feat(bills): schemas support multiple discounts, require subtotal, drop client-set total

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: OCR extraction pipeline — sum a list of discounts

**Files:**
- Modify: `backend/app/workers/bill_processing.py:27-40, 86-101`
- Modify (rewrite parts): `backend/tests/services/test_bill_processing.py`

**Interfaces:**
- Consumes: `BillExtractionResult.discount_amount: float` (unchanged — the AI extraction interface still reads one discount; this task wraps it into a list when writing to the `Bill` row).
- Produces: `compute_total_check(subtotal, discounts: list[dict], charges: list[dict], total_amount) -> (Decimal | None, bool)` — same return shape as before, `discounts` param is now a list of `{"amount": float, ...}` dicts instead of a scalar.

- [ ] **Step 1: Write the failing tests**

Replace the `compute_total_check` tests in `backend/tests/services/test_bill_processing.py` (keep `normalize_vendor_name`, `match_vendor`, and `FakeVendor` as-is; only replace the `compute_total_check` test functions):

```python
def test_compute_total_check_consistent():
    computed, mismatch = compute_total_check(
        125000.0, [{"amount": 3500.0}], [{"amount": 1200.0}, {"amount": 250.0}], 122950.0
    )
    assert computed == Decimal("122950.0")
    assert mismatch is False

def test_compute_total_check_multiple_discounts():
    computed, mismatch = compute_total_check(
        125000.0, [{"amount": 2000.0}, {"amount": 1500.0}], [{"amount": 1200.0}, {"amount": 250.0}], 122950.0
    )
    assert computed == Decimal("122950.0")
    assert mismatch is False

def test_compute_total_check_mismatch():
    _, mismatch = compute_total_check(100000.0, [], [], 98000.0)
    assert mismatch is True

def test_compute_total_check_roundoff_tolerated():
    _, mismatch = compute_total_check(1000.6, [], [], 1000.0)
    assert mismatch is False

def test_compute_total_check_missing_subtotal():
    computed, mismatch = compute_total_check(None, [], [], 5000.0)
    assert computed is None and mismatch is False

def test_compute_total_check_missing_total_uses_computed():
    computed, mismatch = compute_total_check(5000.0, [{"amount": 500.0}], [{"amount": 100.0}], None)
    assert computed == Decimal("4600.0") and mismatch is False
```

- [ ] **Step 2: Run to verify failure**

Run: `docker compose exec backend python -m pytest tests/services/test_bill_processing.py -v`
Expected: FAIL — `compute_total_check` still treats the second argument as a scalar (`Decimal(str(discount_amount or 0))` on a list raises a `TypeError`/`InvalidOperation`).

- [ ] **Step 3: Update `compute_total_check` and the extraction write-back**

In `backend/app/workers/bill_processing.py`, replace lines 27-40:

```python
def compute_total_check(subtotal, discount_amount, charges, total_amount):
    """
    Returns (computed_total, has_mismatch).
    If subtotal is missing, no computation is possible -> (None, False).
    If total is missing, the computed total should be used as the total.
    """
    if subtotal is None:
        return None, False
    charges_sum = sum(Decimal(str(c.get("amount", 0))) for c in (charges or []))
    computed = Decimal(str(subtotal)) - Decimal(str(discount_amount or 0)) + charges_sum
    if total_amount is None:
        return computed, False
    mismatch = abs(computed - Decimal(str(total_amount))) > Decimal(str(TOTAL_MISMATCH_TOLERANCE))
    return computed, mismatch
```

with:

```python
def compute_total_check(subtotal, discounts, charges, total_amount):
    """
    Returns (computed_total, has_mismatch).
    If subtotal is missing, no computation is possible -> (None, False).
    If total is missing, the computed total should be used as the total.
    """
    if subtotal is None:
        return None, False
    discounts_sum = sum(Decimal(str(d.get("amount", 0))) for d in (discounts or []))
    charges_sum = sum(Decimal(str(c.get("amount", 0))) for c in (charges or []))
    computed = Decimal(str(subtotal)) - discounts_sum + charges_sum
    if total_amount is None:
        return computed, False
    mismatch = abs(computed - Decimal(str(total_amount))) > Decimal(str(TOTAL_MISMATCH_TOLERANCE))
    return computed, mismatch
```

Then in the same file, inside `process_bill_async`, replace lines 86-101:

```python
            # 4. Persist extracted fields
            charges = [c.model_dump() for c in extraction.charges]
            computed, mismatch = compute_total_check(
                extraction.subtotal, extraction.discount_amount, charges, extraction.total_amount
            )

            bill.bill_number = extraction.bill_number
            bill.bill_date = extraction.bill_date
            bill.extracted_vendor_name = extraction.vendor_name
            bill.vendor_id = vendor_id
            bill.subtotal = extraction.subtotal
            bill.discount_amount = extraction.discount_amount or 0
            bill.charges = charges
            bill.total_amount = extraction.total_amount if extraction.total_amount is not None else (
                float(computed) if computed is not None else None
            )
```

with:

```python
            # 4. Persist extracted fields
            charges = [c.model_dump() for c in extraction.charges]
            # The AI extraction interface still reads a single discount off the
            # document; wrap it into the new discounts-list shape.
            discounts = [{"label": "Discount", "amount": extraction.discount_amount}] if extraction.discount_amount else []
            computed, mismatch = compute_total_check(
                extraction.subtotal, discounts, charges, extraction.total_amount
            )

            bill.bill_number = extraction.bill_number
            bill.bill_date = extraction.bill_date
            bill.extracted_vendor_name = extraction.vendor_name
            bill.vendor_id = vendor_id
            bill.subtotal = extraction.subtotal
            bill.discounts = discounts
            bill.charges = charges
            bill.total_amount = extraction.total_amount if extraction.total_amount is not None else (
                float(computed) if computed is not None else None
            )
```

(The rest of `process_bill_async` — `bill.has_total_mismatch = mismatch`, `bill.ocr_raw_text`, `bill.extracted_data`, `bill.status` — is unchanged.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `docker compose exec backend python -m pytest tests/services/test_bill_processing.py -v`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/workers/bill_processing.py backend/tests/services/test_bill_processing.py
git commit -m "$(cat <<'EOF'
feat(bills): compute_total_check sums a list of discounts

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Bill service — server-owned total, drop mismatch-blocking, update EDITABLE_FIELDS

**Files:**
- Modify: `backend/app/services/bill_service.py`
- Modify (rewrite parts): `backend/tests/services/test_bill_service.py`

**Interfaces:**
- Consumes: `Bill.discounts`, `Bill.charges`, `Bill.subtotal` (from Task 1/3)
- Produces: `recompute_total(bill: Bill) -> None` (sets `bill.total_amount` in place); `EDITABLE_FIELDS` no longer contains `"total_amount"` or `"discount_amount"`, now contains `"discounts"`.

- [ ] **Step 1: Write the failing tests**

In `backend/tests/services/test_bill_service.py`, add `Bill` to the imports and add `recompute_total` to the `bill_service` import, then add new test functions. Replace the import line:

```python
from app.services.bill_service import EDITABLE_FIELDS, derive_payment_status, due_date_from_terms
```

with:

```python
from app.models.bill import Bill
from app.services.bill_service import EDITABLE_FIELDS, derive_payment_status, due_date_from_terms, recompute_total
```

Then append these tests at the end of the file:

```python
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
```

- [ ] **Step 2: Run to verify failure**

Run: `docker compose exec backend python -m pytest tests/services/test_bill_service.py -v`
Expected: FAIL — `recompute_total` doesn't exist yet, and `Bill(...)` construction with `discounts=` fails until Task 1's model change is in place (it already is, from Task 1) but `recompute_total` import will raise `ImportError`.

- [ ] **Step 3: Add `recompute_total` and update the service**

In `backend/app/services/bill_service.py`, replace the imports and `EDITABLE_FIELDS`:

```python
from app.workers.bill_processing import (
    compute_total_check,
    normalize_vendor_name,
    process_bill_task,
)

EDITABLE_FIELDS = {"bill_number", "bill_date", "vendor_id", "subtotal", "discount_amount",
                   "charges", "total_amount", "due_date", "due_date_source", "notes",
                   "extracted_vendor_name"}
```

with:

```python
from app.workers.bill_processing import (
    normalize_vendor_name,
    process_bill_task,
)

EDITABLE_FIELDS = {"bill_number", "bill_date", "vendor_id", "subtotal", "discounts",
                   "charges", "due_date", "due_date_source", "notes",
                   "extracted_vendor_name"}

def recompute_total(bill: Bill) -> None:
    """Grand total is always derived from subtotal - discounts + charges --
    never client-supplied."""
    if bill.subtotal is None:
        bill.total_amount = None
        return
    discounts_sum = sum(Decimal(str(d.get("amount", 0))) for d in (bill.discounts or []))
    charges_sum = sum(Decimal(str(c.get("amount", 0))) for c in (bill.charges or []))
    bill.total_amount = float(Decimal(str(bill.subtotal)) - discounts_sum + charges_sum)
```

(`compute_total_check` is no longer used in this file — it's dropped from the import — but stays in `bill_processing.py` for the OCR-extraction quality check from Task 3.)

Now replace `update_bill_fields` (currently ends with the mismatch check):

```python
async def update_bill_fields(bill_id: uuid.UUID, payload: dict, db: AsyncSession, business_id: uuid.UUID) -> Bill:
    bill = await _get_bill(bill_id, db, business_id, with_settlements=True)

    if bill.status not in (BillStatus.DRAFT, BillStatus.VERIFIED):
        raise ValueError(f"Cannot edit a bill in {bill.status.name} status")

    for field in EDITABLE_FIELDS & payload.keys():
        setattr(bill, field, payload[field])

    _, mismatch = compute_total_check(bill.subtotal, bill.discount_amount, bill.charges, bill.total_amount)
    bill.has_total_mismatch = mismatch
    # Total may have changed; re-derive payment status
    bill.payment_status = derive_payment_status(bill.total_amount, bill.settlements)

    await db.commit()
    await db.refresh(bill)
    return bill
```

with:

```python
async def update_bill_fields(bill_id: uuid.UUID, payload: dict, db: AsyncSession, business_id: uuid.UUID) -> Bill:
    bill = await _get_bill(bill_id, db, business_id, with_settlements=True)

    if bill.status not in (BillStatus.DRAFT, BillStatus.VERIFIED):
        raise ValueError(f"Cannot edit a bill in {bill.status.name} status")

    for field in EDITABLE_FIELDS & payload.keys():
        setattr(bill, field, payload[field])

    recompute_total(bill)
    bill.has_total_mismatch = False
    # Total may have changed; re-derive payment status
    bill.payment_status = derive_payment_status(bill.total_amount, bill.settlements)

    await db.commit()
    await db.refresh(bill)
    return bill
```

And replace `create_manual_bill`'s body from `if not bill.vendor_id:` onward:

```python
    if not bill.vendor_id:
        raise ValueError("Bill must have a vendor")

    _, mismatch = compute_total_check(bill.subtotal, bill.discount_amount, bill.charges, bill.total_amount)
    bill.has_total_mismatch = mismatch
    if mismatch:
        raise ValueError("Extracted total does not match computed total; fix the amounts before saving")

    bill.status = BillStatus.VERIFIED
```

with:

```python
    if not bill.vendor_id:
        raise ValueError("Bill must have a vendor")

    recompute_total(bill)
    bill.has_total_mismatch = False

    bill.status = BillStatus.VERIFIED
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `docker compose exec backend python -m pytest tests/services/test_bill_service.py -v`
Expected: PASS (all tests, including the 5 new ones)

- [ ] **Step 5: Run the full backend suite to catch any other breakage**

Run: `docker compose exec backend python -m pytest tests/ -v`
Expected: same pre-existing failures as before this plan started (the unrelated `async_client` fixture errors in `tests/api/test_movements.py` and `tests/services/test_inventory.py` — confirmed pre-existing, not caused by this change), and otherwise all green.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/bill_service.py backend/tests/services/test_bill_service.py
git commit -m "$(cat <<'EOF'
feat(bills): total_amount is always server-computed via recompute_total

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Finance dashboard — sum the discounts list

**Files:**
- Modify: `backend/app/services/finance_dashboard_service.py:116`
- Modify: `backend/tests/services/test_finance_dashboard.py:15-33`

**Interfaces:**
- Consumes: `Bill.discounts: list[dict] | None` (from Task 1)

- [ ] **Step 1: Update the test fixture to use the new field**

In `backend/tests/services/test_finance_dashboard.py`, replace the `_bill` helper (lines 15-33):

```python
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
        created_at=datetime(2026, 7, 5, tzinfo=UTC),
        settlements=settlements or [],
        has_total_mismatch=has_total_mismatch,
    )
```

with:

```python
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
        discounts=[{"label": "Discount", "amount": discount}] if discount else [],
        charges=charges or [],
        bill_date=bill_date or date(2026, 7, 5),
        due_date=due_date,
        created_at=datetime(2026, 7, 5, tzinfo=UTC),
        settlements=settlements or [],
        has_total_mismatch=has_total_mismatch,
    )
```

(The `discount=2000.0` call site in `test_summary_totals_and_vendor_rows`, which asserts `summary["totals"]["discounts"] == 2000.0`, stays unchanged — this is purely an internal representation change.)

- [ ] **Step 2: Run to verify failure**

Run: `docker compose exec backend python -m pytest tests/services/test_finance_dashboard.py -v`
Expected: FAIL on `test_summary_totals_and_vendor_rows` — `summarize_bills` still reads `bill.discount_amount`, which no longer exists on the fake bill object (`AttributeError`).

- [ ] **Step 3: Update the service**

In `backend/app/services/finance_dashboard_service.py`, replace line 116:

```python
            totals["discounts"] += _d(bill.discount_amount)
```

with:

```python
            totals["discounts"] += sum(_d(d.get("amount", 0)) for d in (bill.discounts or []))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `docker compose exec backend python -m pytest tests/services/test_finance_dashboard.py -v`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/finance_dashboard_service.py backend/tests/services/test_finance_dashboard.py
git commit -m "$(cat <<'EOF'
feat(bills): finance dashboard sums the discounts list

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Frontend types and API service layer

**Files:**
- Modify: `frontend/src/types/bill.ts`
- Modify: `frontend/src/services/bills.ts`

**Interfaces:**
- Consumes: `ChargeItem` (already defined in `types/bill.ts`, unchanged)
- Produces: `Bill.discounts: ChargeItem[]`; `BillDetail.extracted_data?: { total_amount?: number | null } & Record<string, unknown> | null`; `BillManualCreatePayload` and `BillUpdatePayload` with `discounts` instead of `discount_amount`, no `total_amount` field.

- [ ] **Step 1: Update `types/bill.ts`**

Replace the `Bill` interface's `discount_amount: number;` line with `discounts: ChargeItem[];`:

```typescript
export interface Bill {
  id: string;
  vendor_id?: string | null;
  vendor_name?: string | null;
  extracted_vendor_name?: string | null;
  uploaded_by: string;
  file_url?: string | null;
  bill_number?: string | null;
  bill_date?: string | null;
  subtotal?: number | null;
  discounts: ChargeItem[];
  charges?: ChargeItem[] | null;
  total_amount?: number | null;
  has_total_mismatch: boolean;
  status: BillStatus;
  payment_status: PaymentStatus;
  amount_paid: number;
  due_date?: string | null;
  due_date_source?: DueDateSource | null;
  notes?: string | null;
  verified_at?: string | null;
  created_at: string;
}

export interface BillDetail extends Bill {
  ocr_raw_text?: string | null;
  extracted_data?: ({ total_amount?: number | null } & Record<string, unknown>) | null;
  settlements: BillSettlement[];
}
```

- [ ] **Step 2: Update `services/bills.ts`**

Replace `BillUpdatePayload`:

```typescript
export interface BillUpdatePayload {
  bill_number?: string | null;
  bill_date?: string | null;
  vendor_id?: string | null;
  extracted_vendor_name?: string | null;
  subtotal?: number | null;
  discount_amount?: number;
  charges?: ChargeItem[];
  total_amount?: number | null;
  due_date?: string | null;
  due_date_source?: DueDateSource | null;
  notes?: string | null;
}
```

with:

```typescript
export interface BillUpdatePayload {
  bill_number?: string | null;
  bill_date?: string | null;
  vendor_id?: string | null;
  extracted_vendor_name?: string | null;
  subtotal?: number | null;
  discounts?: ChargeItem[];
  charges?: ChargeItem[];
  due_date?: string | null;
  due_date_source?: DueDateSource | null;
  notes?: string | null;
}
```

Replace `BillManualCreatePayload`:

```typescript
export interface BillManualCreatePayload {
  bill_number?: string | null;
  bill_date?: string | null;
  vendor_id?: string | null;
  vendor_name?: string | null;
  subtotal?: number | null;
  discount_amount?: number;
  charges?: ChargeItem[];
  total_amount: number;
  due_date?: string | null;
  due_date_source?: DueDateSource | null;
  notes?: string | null;
}
```

with:

```typescript
export interface BillManualCreatePayload {
  bill_number?: string | null;
  bill_date?: string | null;
  vendor_id?: string | null;
  vendor_name?: string | null;
  subtotal: number;
  discounts?: ChargeItem[];
  charges?: ChargeItem[];
  due_date?: string | null;
  due_date_source?: DueDateSource | null;
  notes?: string | null;
}
```

- [ ] **Step 3: Type-check**

Run: `docker compose exec frontend npx tsc --noEmit`
Expected: errors in `finance/bills/manual/page.tsx` and `finance/bills/[id]/page.tsx` referencing `discount_amount`/`total_amount` — this is expected until Tasks 7 and 8 update those files. Confirm the errors are confined to those two files and are about the fields you just renamed (not something else broken).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/bill.ts frontend/src/services/bills.ts
git commit -m "$(cat <<'EOF'
feat(bills): frontend types/services use discounts list, drop client total_amount

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Manual Bill Entry page — discounts list + read-only computed total

**Files:**
- Modify: `frontend/src/app/(dashboard)/finance/bills/manual/page.tsx`

**Interfaces:**
- Consumes: `BillManualCreatePayload` (from Task 6), `ChargeItem` (from `types/bill.ts`)

- [ ] **Step 1: Drop the now-unused `Check` icon import**

Replace:

```typescript
import { AlertCircle, ArrowLeft, Check, FileUp, Loader2, Plus, Sparkles, X } from "lucide-react";
```

with:

```typescript
import { AlertCircle, ArrowLeft, FileUp, Loader2, Plus, Sparkles, X } from "lucide-react";
```

- [ ] **Step 2: Update `FormState` and `emptyForm`**

Replace:

```typescript
interface FormState {
  bill_number: string;
  bill_date: string;
  vendor_id: string;
  vendor_name_new: string;
  subtotal: string;
  discount_amount: string;
  charges: { label: string; amount: string }[];
  total_amount: string;
  due_date: string;
  due_date_source: "VENDOR_DEFAULT" | "MANUAL" | "";
  notes: string;
}

const emptyForm: FormState = {
  bill_number: "",
  bill_date: "",
  vendor_id: "",
  vendor_name_new: "",
  subtotal: "",
  discount_amount: "",
  charges: [],
  total_amount: "",
  due_date: "",
  due_date_source: "",
  notes: "",
};
```

with:

```typescript
interface FormState {
  bill_number: string;
  bill_date: string;
  vendor_id: string;
  vendor_name_new: string;
  subtotal: string;
  discounts: { label: string; amount: string }[];
  charges: { label: string; amount: string }[];
  due_date: string;
  due_date_source: "VENDOR_DEFAULT" | "MANUAL" | "";
  notes: string;
}

const emptyForm: FormState = {
  bill_number: "",
  bill_date: "",
  vendor_id: "",
  vendor_name_new: "",
  subtotal: "",
  discounts: [],
  charges: [],
  due_date: "",
  due_date_source: "",
  notes: "",
};
```

- [ ] **Step 3: Replace the computed-total logic**

Replace:

```typescript
  const computed = useMemo(() => {
    const subtotal = parseFloat(form.subtotal);
    if (Number.isNaN(subtotal)) return null;
    const discount = parseFloat(form.discount_amount) || 0;
    const charges = form.charges.reduce((acc, c) => acc + (parseFloat(c.amount) || 0), 0);
    return subtotal - discount + charges;
  }, [form.subtotal, form.discount_amount, form.charges]);

  const total = parseFloat(form.total_amount);
  const hasMismatch = computed !== null && !Number.isNaN(total) && Math.abs(computed - total) > 1;
```

with:

```typescript
  const grandTotal = useMemo(() => {
    const subtotal = parseFloat(form.subtotal);
    if (Number.isNaN(subtotal)) return null;
    const discounts = form.discounts.reduce((acc, d) => acc + (parseFloat(d.amount) || 0), 0);
    const charges = form.charges.reduce((acc, c) => acc + (parseFloat(c.amount) || 0), 0);
    return subtotal - discounts + charges;
  }, [form.subtotal, form.discounts, form.charges]);
```

- [ ] **Step 4: Update the create mutation payload and `canSubmit`**

Replace:

```typescript
  const createMutation = useMutation({
    mutationFn: () => {
      const payload: BillManualCreatePayload = {
        bill_number: form.bill_number || null,
        bill_date: form.bill_date || null,
        vendor_id: form.vendor_id || null,
        vendor_name: !form.vendor_id ? form.vendor_name_new || null : null,
        subtotal: form.subtotal ? parseFloat(form.subtotal) : null,
        discount_amount: parseFloat(form.discount_amount) || 0,
        charges: form.charges
          .filter((c) => c.label || c.amount)
          .map((c): ChargeItem => ({ label: c.label || "Charge", amount: parseFloat(c.amount) || 0 })),
        total_amount: parseFloat(form.total_amount),
        due_date: form.due_date || null,
        due_date_source: form.due_date_source || null,
        notes: form.notes || null,
      };
      return createManualBill(payload, file);
    },
    onSuccess: (bill) => router.push(`/finance/bills/${bill.id}`),
    onError: (e: unknown) => setError(apiErrorDetail(e, "Failed to create the bill")),
  });

  if (!canReview) return null;

  const canSubmit =
    !!form.total_amount && parseFloat(form.total_amount) > 0 && !hasMismatch && !createMutation.isPending;
```

with:

```typescript
  const createMutation = useMutation({
    mutationFn: () => {
      const payload: BillManualCreatePayload = {
        bill_number: form.bill_number || null,
        bill_date: form.bill_date || null,
        vendor_id: form.vendor_id || null,
        vendor_name: !form.vendor_id ? form.vendor_name_new || null : null,
        subtotal: parseFloat(form.subtotal),
        discounts: form.discounts
          .filter((d) => d.label || d.amount)
          .map((d): ChargeItem => ({ label: d.label || "Discount", amount: parseFloat(d.amount) || 0 })),
        charges: form.charges
          .filter((c) => c.label || c.amount)
          .map((c): ChargeItem => ({ label: c.label || "Charge", amount: parseFloat(c.amount) || 0 })),
        due_date: form.due_date || null,
        due_date_source: form.due_date_source || null,
        notes: form.notes || null,
      };
      return createManualBill(payload, file);
    },
    onSuccess: (bill) => router.push(`/finance/bills/${bill.id}`),
    onError: (e: unknown) => setError(apiErrorDetail(e, "Failed to create the bill")),
  });

  if (!canReview) return null;

  const canSubmit = !!form.subtotal && parseFloat(form.subtotal) > 0 && !createMutation.isPending;
```

- [ ] **Step 5: Replace the Subtotal/Discount grid, add a Discounts list, and make Grand Total read-only**

Replace the whole block from the `<div className="grid grid-cols-2 gap-4">` that holds Subtotal/Discount through the end of the mismatch banner (i.e. everything between the "Vendor" block above it and the "Due date" block below it):

```tsx
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="subtotal">Subtotal (₹)</Label>
              <Input id="subtotal" type="number" inputMode="decimal" value={form.subtotal}
                onChange={(e) => setForm({ ...form, subtotal: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="discount">Discount (₹)</Label>
              <Input id="discount" type="number" inputMode="decimal" value={form.discount_amount}
                onChange={(e) => setForm({ ...form, discount_amount: e.target.value })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Additional charges</Label>
            {form.charges.length === 0 && (
              <p className="text-sm text-muted-foreground">No extra charges on this bill.</p>
            )}
            {form.charges.map((charge, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder="Label (Freight, TCS…)"
                  value={charge.label}
                  onChange={(e) => {
                    const charges = [...form.charges];
                    charges[i] = { ...charges[i], label: e.target.value };
                    setForm({ ...form, charges });
                  }}
                />
                <Input
                  className="w-32"
                  type="number"
                  inputMode="decimal"
                  placeholder="₹"
                  value={charge.amount}
                  onChange={(e) => {
                    const charges = [...form.charges];
                    charges[i] = { ...charges[i], amount: e.target.value };
                    setForm({ ...form, charges });
                  }}
                />
                <Button variant="ghost" size="icon" aria-label="Remove charge"
                  onClick={() => setForm({ ...form, charges: form.charges.filter((_, j) => j !== i) })}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm"
              onClick={() => setForm({ ...form, charges: [...form.charges, { label: "", amount: "" }] })}>
              <Plus className="h-4 w-4 mr-1" /> Add charge
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="total">Grand total (₹)</Label>
            <Input id="total" type="number" inputMode="decimal" value={form.total_amount} className="font-semibold"
              onChange={(e) => setForm({ ...form, total_amount: e.target.value })} />
          </div>

          {computed !== null && (
            hasMismatch ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 flex gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Grand total doesn&apos;t match subtotal − discount + charges. Fix the amounts to continue.</span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Amounts add up
              </p>
            )
          )}
```

with:

```tsx
          <div className="space-y-1.5">
            <Label htmlFor="subtotal">Subtotal (₹)</Label>
            <Input id="subtotal" type="number" inputMode="decimal" value={form.subtotal}
              onChange={(e) => setForm({ ...form, subtotal: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label>Discounts</Label>
            {form.discounts.length === 0 && (
              <p className="text-sm text-muted-foreground">No discounts on this bill.</p>
            )}
            {form.discounts.map((discount, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder="Label (Scheme, Cash discount…)"
                  value={discount.label}
                  onChange={(e) => {
                    const discounts = [...form.discounts];
                    discounts[i] = { ...discounts[i], label: e.target.value };
                    setForm({ ...form, discounts });
                  }}
                />
                <Input
                  className="w-32"
                  type="number"
                  inputMode="decimal"
                  placeholder="₹"
                  value={discount.amount}
                  onChange={(e) => {
                    const discounts = [...form.discounts];
                    discounts[i] = { ...discounts[i], amount: e.target.value };
                    setForm({ ...form, discounts });
                  }}
                />
                <Button variant="ghost" size="icon" aria-label="Remove discount"
                  onClick={() => setForm({ ...form, discounts: form.discounts.filter((_, j) => j !== i) })}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm"
              onClick={() => setForm({ ...form, discounts: [...form.discounts, { label: "", amount: "" }] })}>
              <Plus className="h-4 w-4 mr-1" /> Add discount
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Additional charges</Label>
            {form.charges.length === 0 && (
              <p className="text-sm text-muted-foreground">No extra charges on this bill.</p>
            )}
            {form.charges.map((charge, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder="Label (Freight, TCS…)"
                  value={charge.label}
                  onChange={(e) => {
                    const charges = [...form.charges];
                    charges[i] = { ...charges[i], label: e.target.value };
                    setForm({ ...form, charges });
                  }}
                />
                <Input
                  className="w-32"
                  type="number"
                  inputMode="decimal"
                  placeholder="₹"
                  value={charge.amount}
                  onChange={(e) => {
                    const charges = [...form.charges];
                    charges[i] = { ...charges[i], amount: e.target.value };
                    setForm({ ...form, charges });
                  }}
                />
                <Button variant="ghost" size="icon" aria-label="Remove charge"
                  onClick={() => setForm({ ...form, charges: form.charges.filter((_, j) => j !== i) })}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm"
              onClick={() => setForm({ ...form, charges: [...form.charges, { label: "", amount: "" }] })}>
              <Plus className="h-4 w-4 mr-1" /> Add charge
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="total">Grand total (₹)</Label>
            <Input
              id="total"
              type="number"
              value={grandTotal !== null ? grandTotal.toFixed(2) : ""}
              className="font-semibold"
              disabled
              readOnly
            />
          </div>
```

- [ ] **Step 6: Type-check**

Run: `docker compose exec frontend npx tsc --noEmit`
Expected: no errors referencing `manual/page.tsx` (errors may remain in `[id]/page.tsx` until Task 8).

- [ ] **Step 7: Manual verification against the running app**

With the stack up (`docker compose up -d`) and logged in as a FINANCE/ADMIN user, open `/finance/bills/manual` in the browser and confirm:
- The page loads with no console errors.
- Adding two discounts and two charges updates "Grand total" live as you type, correctly as `subtotal − Σdiscounts + Σcharges`.
- The Grand Total input cannot be typed into (it's read-only).
- Submitting with a valid vendor, subtotal, one discount, and one charge creates a bill and redirects to its detail page; the created bill's total matches what was shown in the form.

- [ ] **Step 8: Commit**

```bash
git add "frontend/src/app/(dashboard)/finance/bills/manual/page.tsx"
git commit -m "$(cat <<'EOF'
feat(bills): manual entry supports multiple discounts, auto-computed total

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Verify page (AI-scanned bills) — discounts list + read-only computed total + AI-total hint

**Files:**
- Modify: `frontend/src/app/(dashboard)/finance/bills/[id]/page.tsx`

**Interfaces:**
- Consumes: `BillDetail.extracted_data` (from Task 6), `BillUpdatePayload` (from Task 6)

- [ ] **Step 1: Update `FormState`**

Replace:

```typescript
interface FormState {
  bill_number: string;
  bill_date: string;
  vendor_id: string;
  vendor_name_new: string;
  subtotal: string;
  discount_amount: string;
  charges: { label: string; amount: string }[];
  total_amount: string;
  due_date: string;
  notes: string;
}
```

with:

```typescript
interface FormState {
  bill_number: string;
  bill_date: string;
  vendor_id: string;
  vendor_name_new: string;
  subtotal: string;
  discounts: { label: string; amount: string }[];
  charges: { label: string; amount: string }[];
  due_date: string;
  notes: string;
}
```

- [ ] **Step 2: Update form seeding from the loaded bill**

Replace:

```tsx
  if (bill && bill.status !== "PROCESSING" && form === null) {
    setForm({
      bill_number: bill.bill_number ?? "",
      bill_date: bill.bill_date ?? "",
      vendor_id: bill.vendor_id ?? "",
      vendor_name_new: "",
      subtotal: bill.subtotal != null ? String(bill.subtotal) : "",
      discount_amount: String(bill.discount_amount ?? 0),
      charges: (bill.charges ?? []).map((c) => ({ label: c.label, amount: String(c.amount) })),
      total_amount: bill.total_amount != null ? String(bill.total_amount) : "",
      due_date: bill.due_date ?? "",
      notes: bill.notes ?? "",
    });
  }
```

with:

```tsx
  if (bill && bill.status !== "PROCESSING" && form === null) {
    setForm({
      bill_number: bill.bill_number ?? "",
      bill_date: bill.bill_date ?? "",
      vendor_id: bill.vendor_id ?? "",
      vendor_name_new: "",
      subtotal: bill.subtotal != null ? String(bill.subtotal) : "",
      discounts: (bill.discounts ?? []).map((d) => ({ label: d.label, amount: String(d.amount) })),
      charges: (bill.charges ?? []).map((c) => ({ label: c.label, amount: String(c.amount) })),
      due_date: bill.due_date ?? "",
      notes: bill.notes ?? "",
    });
  }
```

- [ ] **Step 3: Replace the computed-total logic and payload builder**

Replace:

```tsx
  const computed = useMemo(() => {
    if (!form) return null;
    const subtotal = parseFloat(form.subtotal);
    if (Number.isNaN(subtotal)) return null;
    const discount = parseFloat(form.discount_amount) || 0;
    const charges = form.charges.reduce((acc, c) => acc + (parseFloat(c.amount) || 0), 0);
    return subtotal - discount + charges;
  }, [form]);

  const total = form ? parseFloat(form.total_amount) : NaN;
  const hasMismatch =
    computed !== null && !Number.isNaN(total) && Math.abs(computed - total) > 1;

  const buildPayload = () => ({
    bill_number: form!.bill_number || null,
    bill_date: form!.bill_date || null,
    vendor_id: form!.vendor_id || null,
    subtotal: form!.subtotal ? parseFloat(form!.subtotal) : null,
    discount_amount: parseFloat(form!.discount_amount) || 0,
    charges: form!.charges
      .filter((c) => c.label || c.amount)
      .map((c): ChargeItem => ({ label: c.label || "Charge", amount: parseFloat(c.amount) || 0 })),
    total_amount: form!.total_amount ? parseFloat(form!.total_amount) : null,
    due_date: form!.due_date || null,
    notes: form!.notes || null,
  });
```

with:

```tsx
  const grandTotal = useMemo(() => {
    if (!form) return null;
    const subtotal = parseFloat(form.subtotal);
    if (Number.isNaN(subtotal)) return null;
    const discounts = form.discounts.reduce((acc, d) => acc + (parseFloat(d.amount) || 0), 0);
    const charges = form.charges.reduce((acc, c) => acc + (parseFloat(c.amount) || 0), 0);
    return subtotal - discounts + charges;
  }, [form]);

  // The AI's originally-extracted total is a non-blocking reference only, to
  // flag a possible OCR misread -- it never blocks saving or verifying.
  const extractedTotal = bill?.extracted_data?.total_amount ?? null;
  const showExtractedHint =
    typeof extractedTotal === "number" && grandTotal !== null && Math.abs(extractedTotal - grandTotal) > 1;

  const buildPayload = () => ({
    bill_number: form!.bill_number || null,
    bill_date: form!.bill_date || null,
    vendor_id: form!.vendor_id || null,
    subtotal: form!.subtotal ? parseFloat(form!.subtotal) : null,
    discounts: form!.discounts
      .filter((d) => d.label || d.amount)
      .map((d): ChargeItem => ({ label: d.label || "Discount", amount: parseFloat(d.amount) || 0 })),
    charges: form!.charges
      .filter((c) => c.label || c.amount)
      .map((c): ChargeItem => ({ label: c.label || "Charge", amount: parseFloat(c.amount) || 0 })),
    due_date: form!.due_date || null,
    notes: form!.notes || null,
  });
```

- [ ] **Step 4: Replace the Subtotal/Discount grid, add a Discounts list, make Grand Total read-only, and swap the mismatch banner for the AI-hint**

Replace the block from the Subtotal/Discount grid through the mismatch banner:

```tsx
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="subtotal">Subtotal (₹)</Label>
                    <Input id="subtotal" type="number" inputMode="decimal" value={form.subtotal} disabled={!editable}
                      onChange={(e) => setForm({ ...form, subtotal: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="discount">Discount (₹)</Label>
                    <Input id="discount" type="number" inputMode="decimal" value={form.discount_amount} disabled={!editable}
                      onChange={(e) => setForm({ ...form, discount_amount: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Additional charges</Label>
                  {form.charges.length === 0 && (
                    <p className="text-sm text-muted-foreground">No extra charges on this bill.</p>
                  )}
                  {form.charges.map((charge, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        placeholder="Label (Freight, TCS…)"
                        value={charge.label}
                        disabled={!editable}
                        onChange={(e) => {
                          const charges = [...form.charges];
                          charges[i] = { ...charges[i], label: e.target.value };
                          setForm({ ...form, charges });
                        }}
                      />
                      <Input
                        className="w-32"
                        type="number"
                        inputMode="decimal"
                        placeholder="₹"
                        value={charge.amount}
                        disabled={!editable}
                        onChange={(e) => {
                          const charges = [...form.charges];
                          charges[i] = { ...charges[i], amount: e.target.value };
                          setForm({ ...form, charges });
                        }}
                      />
                      {editable && (
                        <Button
                          variant="ghost" size="icon" aria-label="Remove charge"
                          onClick={() => setForm({ ...form, charges: form.charges.filter((_, j) => j !== i) })}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {editable && (
                    <Button
                      variant="outline" size="sm"
                      onClick={() => setForm({ ...form, charges: [...form.charges, { label: "", amount: "" }] })}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add charge
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="total">Grand total (₹)</Label>
                    <Input id="total" type="number" inputMode="decimal" value={form.total_amount} disabled={!editable}
                      className="font-semibold"
                      onChange={(e) => setForm({ ...form, total_amount: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="due">Due date</Label>
                    <Input id="due" type="date" value={form.due_date} disabled={!editable}
                      onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                  </div>
                </div>

                {computed !== null && (
                  hasMismatch ? (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 flex gap-2">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>
                        Grand total {formatINRPrecise(total)} doesn&apos;t match the computed{" "}
                        <strong>{formatINRPrecise(computed)}</strong> (subtotal − discount + charges). Fix the amounts before verifying.
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      Amounts add up: {formatINRPrecise(computed)}
                    </p>
                  )
                )}
```

with:

```tsx
                <div className="space-y-1.5">
                  <Label htmlFor="subtotal">Subtotal (₹)</Label>
                  <Input id="subtotal" type="number" inputMode="decimal" value={form.subtotal} disabled={!editable}
                    onChange={(e) => setForm({ ...form, subtotal: e.target.value })} />
                </div>

                <div className="space-y-2">
                  <Label>Discounts</Label>
                  {form.discounts.length === 0 && (
                    <p className="text-sm text-muted-foreground">No discounts on this bill.</p>
                  )}
                  {form.discounts.map((discount, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        placeholder="Label (Scheme, Cash discount…)"
                        value={discount.label}
                        disabled={!editable}
                        onChange={(e) => {
                          const discounts = [...form.discounts];
                          discounts[i] = { ...discounts[i], label: e.target.value };
                          setForm({ ...form, discounts });
                        }}
                      />
                      <Input
                        className="w-32"
                        type="number"
                        inputMode="decimal"
                        placeholder="₹"
                        value={discount.amount}
                        disabled={!editable}
                        onChange={(e) => {
                          const discounts = [...form.discounts];
                          discounts[i] = { ...discounts[i], amount: e.target.value };
                          setForm({ ...form, discounts });
                        }}
                      />
                      {editable && (
                        <Button
                          variant="ghost" size="icon" aria-label="Remove discount"
                          onClick={() => setForm({ ...form, discounts: form.discounts.filter((_, j) => j !== i) })}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {editable && (
                    <Button
                      variant="outline" size="sm"
                      onClick={() => setForm({ ...form, discounts: [...form.discounts, { label: "", amount: "" }] })}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add discount
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Additional charges</Label>
                  {form.charges.length === 0 && (
                    <p className="text-sm text-muted-foreground">No extra charges on this bill.</p>
                  )}
                  {form.charges.map((charge, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        placeholder="Label (Freight, TCS…)"
                        value={charge.label}
                        disabled={!editable}
                        onChange={(e) => {
                          const charges = [...form.charges];
                          charges[i] = { ...charges[i], label: e.target.value };
                          setForm({ ...form, charges });
                        }}
                      />
                      <Input
                        className="w-32"
                        type="number"
                        inputMode="decimal"
                        placeholder="₹"
                        value={charge.amount}
                        disabled={!editable}
                        onChange={(e) => {
                          const charges = [...form.charges];
                          charges[i] = { ...charges[i], amount: e.target.value };
                          setForm({ ...form, charges });
                        }}
                      />
                      {editable && (
                        <Button
                          variant="ghost" size="icon" aria-label="Remove charge"
                          onClick={() => setForm({ ...form, charges: form.charges.filter((_, j) => j !== i) })}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {editable && (
                    <Button
                      variant="outline" size="sm"
                      onClick={() => setForm({ ...form, charges: [...form.charges, { label: "", amount: "" }] })}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add charge
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="total">Grand total (₹)</Label>
                    <Input
                      id="total"
                      type="number"
                      value={grandTotal !== null ? grandTotal.toFixed(2) : ""}
                      className="font-semibold"
                      disabled
                      readOnly
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="due">Due date</Label>
                    <Input id="due" type="date" value={form.due_date} disabled={!editable}
                      onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                  </div>
                </div>

                {showExtractedHint && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    AI originally read {formatINRPrecise(extractedTotal!)} — worth a second look.
                  </p>
                )}
```

- [ ] **Step 5: Remove the mismatch-blocking on the Verify button**

Replace:

```tsx
                    <Button
                      onClick={() => verifyMutation.mutate()}
                      disabled={verifyMutation.isPending || hasMismatch || (!form.vendor_id && !form.vendor_name_new)}
                      className="bg-gradient-to-r from-primary to-primary/80"
                      title={
                        hasMismatch ? "Fix the total mismatch first"
                        : !form.vendor_id && !form.vendor_name_new ? "Pick or create a company first"
                        : undefined
                      }
                    >
```

with:

```tsx
                    <Button
                      onClick={() => verifyMutation.mutate()}
                      disabled={verifyMutation.isPending || (!form.vendor_id && !form.vendor_name_new)}
                      className="bg-gradient-to-r from-primary to-primary/80"
                      title={!form.vendor_id && !form.vendor_name_new ? "Pick or create a company first" : undefined}
                    >
```

- [ ] **Step 6: Type-check**

Run: `docker compose exec frontend npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Manual verification against the running app**

With the stack up and logged in as FINANCE/ADMIN, either upload a bill for OCR processing or open an existing DRAFT bill's detail page (`/finance/bills/<id>`) and confirm:
- Discounts render as a repeatable list (label + ₹ + remove), matching the Additional Charges list's look and behavior.
- Grand Total is read-only and updates live as Subtotal/Discounts/Charges change.
- "Save draft" and "Verify bill" both work without any mismatch-blocking error appearing.
- After verifying, the bill detail view shows the correct total (subtotal − discounts + charges).

- [ ] **Step 8: Commit**

```bash
git add "frontend/src/app/(dashboard)/finance/bills/[id]/page.tsx"
git commit -m "$(cat <<'EOF'
feat(bills): verify page supports multiple discounts, auto-computed total

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
