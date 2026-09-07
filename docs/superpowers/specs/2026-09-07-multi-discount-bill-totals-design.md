# Multiple discounts, multiple charges, auto-calculated grand total

## Problem

Bharat Wines bills can have several distinct discounts (e.g. "Scheme
discount", "Cash discount") and several additional charges (freight, TCS,
bardana). Today:

- `Bill.discount_amount` is a single float — only one discount can be
  recorded, with no label/reason.
- `charges` already supports multiple `{label, amount}` items — this is the
  pattern discounts should follow.
- "Grand total" is a field the user types by hand, then compared against a
  computed value (`subtotal − discount + charges`); a mismatch blocks
  saving/verifying with an error banner.

This applies to both places bill totals are entered: the **Manual Bill
Entry** form and the **Verify** page for AI-scanned bills.

## Goals

1. Support multiple discounts per bill, each with a label and amount
   (mirrors `charges` exactly — no separate "note" field, per user decision:
   label doubles as the reason).
2. Grand total is always server-computed from `subtotal − Σ(discounts) +
   Σ(charges)` — never typed by a human, never disagrees with itself.
3. Same behavior on both the Manual Entry and Verify pages.
4. On the Verify page, the AI's originally-extracted total (if present) is
   shown as a non-blocking reference hint, not a blocking mismatch check —
   OCR misreads are still visible, just don't block the user.

## Data model

`Bill.discount_amount: Numeric` → `Bill.discounts: JSONB`, list of
`{label: str, amount: float}` — identical shape and identical Pydantic
schema (`ChargeItem`, already defined in `app/schemas/bill.py`) as the
existing `charges` field. No new schema needed; reuse `ChargeItem` for both.

`Bill.total_amount` remains a stored column, but stops being client-settable.
It is computed and overwritten server-side any time `subtotal`, `discounts`,
or `charges` change.

`Bill.subtotal` becomes **required** on manual entry (was optional) — a
total cannot be derived without it.

### Migration

Alembic migration: add `discounts` JSONB column (nullable, `server_default
'[]'`), drop `discount_amount` column. The target Supabase database
currently has zero bill rows, so no backfill logic is needed. (If bills
exist by the time this ships, that's a pre-condition to re-check before
running the migration — not expected here.)

## Backend behavior

### `app/workers/bill_processing.py`

`compute_total_check(subtotal, discounts: list, charges: list,
total_amount)` — same shape as today but sums a list of discount items
instead of one scalar:

```python
computed = subtotal - sum(d["amount"] for d in discounts) + sum(c["amount"] for c in charges)
```

Still used only at OCR-extraction time (`process_bill_task`), to set
`has_total_mismatch` by comparing the AI's own extracted total against what
the AI's own extracted subtotal/discount/charges compute to. This is an
informational quality signal that feeds the finance "attention" dashboard
(bills whose OCR read looks internally inconsistent, worth a closer look) —
it does not block saving or verifying.

`BillExtractionResult.discount_amount: float` (from OCR) is wrapped into a
single-item `discounts` list (`[{"label": "Discount", "amount": X}]` if
non-zero, else `[]`) when populating the freshly-extracted `Bill` row.

### `app/services/bill_service.py`

- New helper `recompute_total(bill)`: sets
  `bill.total_amount = subtotal - Σ(discounts) + Σ(charges)` if `subtotal`
  is set, else `None`. Called at the end of:
  - `create_manual_bill` (after applying the payload)
  - `update_bill_fields` (after applying the payload) — this covers the
    Verify page's "save edits" step too, since it PATCHes before calling
    `/verify`.
- `EDITABLE_FIELDS`: replace `"discount_amount"` with `"discounts"`; remove
  `"total_amount"` — it's never client-settable, only server-derived.
- `create_manual_bill`: drop the mismatch-check/raise (total can't mismatch
  itself anymore); still requires a vendor. `subtotal` is required by the
  request schema, so total is always computable.
- `verify_bill`: unchanged in spirit — still requires vendor and a
  non-null `total_amount`; the `has_total_mismatch` check stays as a
  defensive no-op (it will always be `False` coming out of `update_bill_fields`
  under the new flow, since total is derived, not independently entered).

### `app/schemas/bill.py`

- `BillManualCreateRequest`: `discount_amount: float = 0` →
  `discounts: list[ChargeItem] = []`; `subtotal: float | None` →
  `subtotal: float` (required, must be > 0); remove `total_amount` field
  entirely (no longer client-supplied).
- `BillUpdateRequest`: `discount_amount` → `discounts: list[ChargeItem] |
  None`; remove `total_amount` (not client-settable).
- `BillResponse` / `BillDetailResponse`: `discount_amount: float` →
  `discounts: list[ChargeItem]` (server continues to return the computed
  `total_amount` as before — this doesn't change, only how it's produced).

### `app/services/finance_dashboard_service.py`

Line 116 aggregate: `totals["discounts"] += _d(bill.discount_amount)` →
sum across `bill.discounts` (`sum(d["amount"] for d in (bill.discounts or
[]))`).

## Frontend

### `types/bill.ts`

- `Bill.discount_amount: number` → `Bill.discounts: ChargeItem[]`.
- `BillDetail`/response types follow the same rename.

### `services/bills.ts`

- `BillManualCreatePayload` / update payload types: `discount_amount` →
  `discounts: ChargeItem[]`; drop `total_amount` from the outgoing payload
  types (still present on the read-side response types).

### `finance/bills/manual/page.tsx` and `finance/bills/[id]/page.tsx`

Both pages get the identical treatment (they already share near-identical
form logic today):

- Replace the single "Discount (₹)" input with a **Discounts** repeatable
  list, visually and behaviorally identical to the existing "Additional
  charges" list directly below it: label input + ₹ amount input + remove
  (X) button per row, plus an "Add discount" button. Placeholder text on
  the label input: e.g. `"Label (Scheme, Cash discount…)"`.
- "Grand total (₹)" field stays in its current position but becomes
  **read-only** (disabled input, kept visually distinct/bold as today),
  live-recomputed from `subtotal − Σ(discounts) + Σ(charges)` on every
  keystroke in any of those three groups.
- Remove the mismatch banner and its blocking logic entirely on both pages
  (no longer applicable — total can't disagree with its inputs).
- **Verify page only**: if `bill.extracted_data?.total_amount` is present
  and differs from the live computed total by more than the existing
  tolerance, show a small muted, non-blocking hint below the Grand total
  field: *"AI originally read ₹X — worth a second look"*. `extracted_data`
  is stored on the model but **not currently exposed** by
  `BillDetailResponse` — add `extracted_data: dict | None = None` to that
  schema (detail view only, not the list-view `BillResponse`) so the
  frontend can read `extracted_data.total_amount`.
- Manual Entry: `subtotal` becomes a required field for submission
  (`canSubmit` requires a valid positive subtotal instead of a valid
  total_amount).
- Outgoing payloads on both pages drop `total_amount` entirely and send
  `discounts: [{label, amount}]` alongside `charges`.

## Out of scope / explicitly deferred

- No separate "note" field on discounts (label serves that purpose, per
  user decision).
- No note field added to charges (kept as-is: label + amount).
- No backfill/migration path for existing bills with the old single
  `discount_amount` — none exist in the target database.
- The Bills list page (`finance/bills/page.tsx`) only references discounts
  in static marketing copy — no data-shape change needed there.
