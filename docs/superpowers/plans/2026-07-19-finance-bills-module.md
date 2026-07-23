# Finance Module (AI Bill Ingestion + Finance Dashboard) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Design work (Tasks 10–12) MUST load `/impeccable` (product register) and the `dataviz` skill before writing any chart code.**

**Goal:** Add a role-gated Finance module: staff/finance/admin photograph purchase bills, AI extracts totals/discounts/charges (same pipeline shape as TP), finance reviews + verifies, records bank settlements (paid/partial/unpaid), and a vendor-segregated finance dashboard shows the complete money picture.

**Architecture:** Mirror the proven TP pipeline: upload → Celery task (OCR → LLM extraction → fuzzy vendor match) → DRAFT → human review → VERIFIED. New `FINANCE` role slots into the existing `ROLE_PERMISSIONS` map. Payment state is derived from settlement rows, denormalized onto the bill for filtering. Dashboard aggregates are computed on the fly from verified bills (same philosophy as `scm_service`).

**Tech Stack:** FastAPI + SQLAlchemy async + Alembic + Celery (existing), OpenRouter vision extraction (existing pattern), RapidFuzz vendor matching, Next.js App Router + shadcn tokens + TanStack Query (existing), **recharts** (new dependency) for dashboard charts.

## Global Constraints

- All new tables extend `TenantModel` (`app/db/base.py`) — every query filters by `business_id`.
- All money columns are `Numeric(12, 2)`; never float in the DB.
- Role capabilities (confirmed by user):
  - **STAFF**: upload bill photos + view own uploads (file, date, status only — **no financial fields**).
  - **FINANCE**: upload, view everything, review/verify bills, add settlements, mark paid, use dashboard + filters.
  - **ADMIN**: everything.
  - STOCK_MANAGER: no bill access (per user's spec).
- Follow existing code style: services as module-level async functions, routers thin, `require_permissions` for RBAC.
- Existing enum `user_role_enum` is a native PG enum → adding FINANCE needs `ALTER TYPE ... ADD VALUE` (must run outside transaction block in Alembic: use `op.execute` with `connection.execute(text(...))` + autocommit, see Task 1).
- Frontend: reuse existing tokens in `globals.css` (violet primary, `--chart-1..5`), Inter/Sora, existing `Card/Button/Badge/Select/Dialog/Skeleton` components. No new design system.
- Design guardrails (impeccable): no side-stripe borders, no gradient text, no identical KPI card grids, ≥4.5:1 body text contrast, skeletons not spinners, 150–250ms motion, `prefers-reduced-motion` respected.

## Design Brief (impeccable shape — product register)

- **Surface:** `/finance` dashboard + `/finance/bills` list/review flow inside the existing dashboard shell.
- **Primary user action:** Finance answers "how much do we owe, to whom, and what came in this month" in <10 seconds, then drills into a vendor or an unpaid bill.
- **Color strategy:** Restrained base (existing slate surfaces + violet primary), with a committed semantic trio for payment state used ONLY on data: paid = `--chart-2` (emerald), partial = `--chart-1` (amber), unpaid = `--chart-5` (rose). Charts draw from existing `--chart-*` tokens.
- **Scene sentence:** A finance person at a desk after close, laptop under shop tube-light, reconciling the day — calm, light-first UI matching the rest of the app (dark mode inherits existing `.dark` tokens).
- **Layout strategy:** (1) compact stat strip (outstanding / paid this period / total billed / bills awaiting review) as a single bordered strip with dividers — NOT four identical cards; (2) monthly cash-out bar chart + payment-status breakdown side by side; (3) vendor table (billed, paid, outstanding, aging, last bill) as the workhorse — dense, sortable, row-click drills to filtered bill list; (4) "needs attention" rail: drafts to review + overdue unpaid.
- **Key states:** empty (no bills yet → teach upload), processing (bill card with pulse skeleton), draft-with-mismatch (extraction total ≠ computed total → amber callout), verified, rejected, partially paid (progress of amount_paid/total), staff-restricted view.
- **Anchor references:** Linear's dashboard density, Stripe's balance/payouts clarity.

---

### Task 0: Impeccable project context (PRODUCT.md)

**Files:**
- Create: `PRODUCT.md`

The impeccable skill requires PRODUCT.md at repo root. Content confirmed against README/PRD:

- [ ] **Step 1: Write PRODUCT.md**

```markdown
# Product

## Register

product

## Users
FL-2 liquor retail owners (admin), stock managers, shop staff, and finance staff in India. Mobile-first for staff on the shop floor (scanning, photographing bills); desktop for finance/admin reviewing and reporting. Users are often non-technical, working in a busy retail environment.

## Product Purpose
Automate liquor retail back-office: barcode-driven stock movements, AI ingestion of Transport Passes and purchase bills, excise-ready SCM reports, and financial visibility (vendor dues, settlements). Success = daily register work drops from hours to minutes and compliance reports are one click.

## Brand Personality
Dependable, fast, unfussy. The tool disappears into the task. Confidence through clarity, not decoration.

## Anti-references
Consumer fintech gradients and glassmorphism; dashboard templates with rows of identical stat cards; anything that hides numbers behind decoration.

## Design Principles
- Numbers first: financial and stock figures are the content; chrome stays quiet.
- Familiar affordances: standard tables, forms, nav — earned familiarity over novelty.
- Every AI output is reviewable: extraction is a draft until a human verifies.
- Role-appropriate disclosure: staff see what they need, never more.

## Accessibility & Inclusion
WCAG AA. ≥4.5:1 body contrast, keyboard-reachable tables and dialogs, reduced-motion alternatives, works on low-end Android browsers.
```

- [ ] **Step 2: Commit**

```bash
git add PRODUCT.md && git commit -m "docs: add PRODUCT.md (impeccable project context)"
```

---

### Task 1: FINANCE role + migration for vendors/bills/settlements

**Files:**
- Modify: `backend/app/models/user.py` (add `FINANCE` to `Role`)
- Modify: `backend/app/core/dependencies.py` (ROLE_PERMISSIONS)
- Create: `backend/app/models/vendor.py`, `backend/app/models/bill.py`, `backend/app/models/bill_settlement.py`
- Modify: `backend/app/models/__init__.py` (export new models)
- Create: alembic migration `backend/alembic/versions/xxxx_add_finance_module.py` (via `alembic revision --autogenerate -m "add finance module"`, then hand-edit enum ALTER)

**Interfaces (produces):**
- `Role.FINANCE`
- `Vendor(TenantModel)`: `name: str`, `normalized_name: str` (unique per business), `gstin: str | None`
- `BillStatus`: PROCESSING | DRAFT | VERIFIED | REJECTED
- `PaymentStatus`: UNPAID | PARTIALLY_PAID | PAID
- `Bill(TenantModel)`: `vendor_id: UUID|None`, `uploaded_by: UUID`, `file_url: str`, `bill_number: str|None`, `bill_date: date|None`, `extracted_vendor_name: str|None`, `subtotal: Numeric|None`, `discount_amount: Numeric` (default 0), `charges: JSONB` (list of `{"label": str, "amount": float}`), `total_amount: Numeric|None`, `has_total_mismatch: bool`, `ocr_raw_text: Text|None`, `extracted_data: JSONB|None`, `status: BillStatus`, `payment_status: PaymentStatus` (default UNPAID), `due_date: date|None`, `verified_by: UUID|None`, `verified_at: datetime|None`, `notes: Text|None`, relationship `settlements`
- `SettlementMethod`: BANK_TRANSFER | UPI | CASH | CHEQUE | OTHER
- `BillSettlement(TenantModel)`: `bill_id: UUID`, `amount: Numeric`, `paid_on: date`, `method: SettlementMethod`, `reference: str|None` (UTR/cheque no.), `notes: str|None`, `created_by: UUID`

- [ ] **Step 1: Models** — write the three model files following `tp_receipt.py` style (native enums, `Mapped[]` columns, `Index("ix_bills_business_status", "business_id", "status")`, `Index("ix_bills_business_vendor", "business_id", "vendor_id")`, `UniqueConstraint("business_id", "normalized_name")` on vendors). Add `FINANCE = "FINANCE"` to `Role`.
- [ ] **Step 2: Permissions map** in `dependencies.py`:

```python
ROLE_PERMISSIONS = {
    "ADMIN": ["products.*", "movements.*", "tp.*", "mrp.approve", "scm.*", "reports.*", "users.*", "imports.*", "bills.*", "vendors.*", "finance.*"],
    "STOCK_MANAGER": ["products.create", "products.edit", "products.view", "movements.*", "tp.upload", "tp.approve", "reports.view"],
    "STAFF": ["products.view", "movements.create", "bills.upload", "bills.view_own"],
    "FINANCE": ["bills.*", "vendors.*", "finance.*", "products.view", "reports.view"],
}
```

- [ ] **Step 3: Migration** — autogenerate, then prepend the enum value add (PG can't add enum values in a transaction on older versions; use the autocommit block):

```python
def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'FINANCE'")
    # ... autogenerated create_table for vendors, bills, bill_settlements ...
```

- [ ] **Step 4: Run `alembic upgrade head` against local DB; verify tables exist** (`\dt` via psql or a quick script).
- [ ] **Step 5: Commit** `feat: add FINANCE role, vendor/bill/settlement models + migration`

---

### Task 2: Admin user management (enabler — FINANCE users must be creatable)

**Files:**
- Create: `backend/app/api/v1/users.py`, `backend/app/schemas/user.py`
- Modify: `backend/app/main.py` (include router, prefix `/api/v1/users`)
- Test: `backend/tests/api/test_users.py`

**Endpoints:** `POST /api/v1/users` (create user with role, `require_permissions("users.manage")`), `GET /api/v1/users` (list business users, `users.view` — ADMIN wildcard covers both), `PUT /api/v1/users/{id}` (change role / deactivate). Reuse `hash_password`. Email uniqueness → 409.

- [ ] Step 1: failing tests (create finance user as admin → 201; as staff → 403; duplicate email → 409)
- [ ] Step 2: implement schema + router; register in `main.py`
- [ ] Step 3: `pytest backend/tests/api/test_users.py -v` → PASS
- [ ] Step 4: Commit `feat: admin user management endpoints (create staff/finance users)`

---

### Task 3: Bill AI extraction (interface, mock, OpenRouter, prompt)

**Files:**
- Create: `backend/app/integrations/ai/bill_extraction_interface.py`, `bill_extraction_mock.py`, `bill_extraction_openrouter.py`, `prompts/bill_extraction.txt`
- Modify: `backend/app/integrations/ai/__init__.py` (add `get_bill_extraction_client()`, keyed off `LLM_PROVIDER` like `get_extraction_client`)

**Interfaces (produces):**

```python
class BillChargeItem(BaseModel):
    label: str          # e.g. "Freight", "Handling", "TCS"
    amount: float

class BillExtractionResult(BaseModel):
    bill_number: Optional[str] = None
    vendor_name: str
    bill_date: Optional[date] = None
    subtotal: Optional[float] = None
    discount_amount: float = 0.0
    charges: List[BillChargeItem] = []
    total_amount: Optional[float] = None

class BillExtractionInterface(ABC):
    @abstractmethod
    async def extract_structured(self, raw_text: str) -> BillExtractionResult: ...
```

- [ ] Step 1: interface + mock (static plausible bill, `await asyncio.sleep(2)` like the TP mock)
- [ ] Step 2: `bill_extraction.txt` prompt — strict JSON schema mirroring the model above; instructions for Indian liquor wholesale invoices: GST invoice layouts, "Scheme Discount"/"CD" rows count as discount, freight/TCS/bardana as charges, grand total. Vision passthrough handling identical to `extraction_openrouter.py` (base64 image branch when `raw_text` startswith `/uploads/`).
- [ ] Step 3: OpenRouter client — copy `extraction_openrouter.py` structure, swap prompt + result parsing (safe date parse, default missing discount to 0, coerce charges list).
- [ ] Step 4: quick self-test via existing `test_ai_foundation.py` pattern (mock returns valid `BillExtractionResult`); run pytest.
- [ ] Step 5: Commit `feat: bill AI extraction clients (mock + openrouter vision)`

---

### Task 4: Bill processing Celery task

**Files:**
- Create: `backend/app/workers/bill_processing.py`
- Modify: `backend/app/workers/celery_app.py` if tasks are explicitly imported/registered there (check `include`/autodiscover; follow how `tp_processing` is registered)

**Logic (mirror `tp_processing.py` including the `engine.dispose()` loop fix):**
1. OCR via `get_ocr_client()` (reuses vision passthrough).
2. `get_bill_extraction_client().extract_structured(...)`.
3. Vendor fuzzy match: load business vendors, `rapidfuzz.process.extractOne(normalized(vendor_name), choices, score_cutoff=85)` → set `vendor_id` if hit; always store `extracted_vendor_name`.
4. Total sanity: `computed = subtotal - discount + sum(charges)`; `has_total_mismatch = total_amount is not None and abs(computed - total_amount) > 1.0` (when subtotal present). If `total_amount` missing, set it to `computed`.
5. Persist fields, `status = DRAFT`, commit. On exception → `REJECTED` (same as TP).
6. `@shared_task def process_bill_task(bill_id, file_url, business_id)` entrypoint with `asyncio.run(_run_and_dispose(...))`.

- [ ] Step 1: write task; Step 2: unit test the pure helpers (`_normalize_vendor_name`, mismatch calc) in `backend/tests/services/test_bill_processing.py`; Step 3: pytest PASS; Step 4: Commit `feat: bill processing worker (ocr → extract → vendor match)`

---

### Task 5: Bill service (upload, review edits, verify/reject, settlements)

**Files:**
- Create: `backend/app/services/bill_service.py`
- Test: `backend/tests/services/test_bill_service.py`

**Interfaces (produces):**

```python
async def upload_bill(file, db, business_id, user_id) -> Bill              # save file via file_service.upload_file, create PROCESSING bill, enqueue process_bill_task
async def update_bill_fields(bill_id, payload: dict, db, business_id) -> Bill   # DRAFT/VERIFIED only; editable: bill_number, bill_date, vendor_id, subtotal, discount_amount, charges, total_amount, due_date, notes; recompute has_total_mismatch
async def verify_bill(bill_id, db, business_id, user_id) -> Bill           # DRAFT only; requires vendor_id set (create-or-pick vendor first); sets VERIFIED, verified_by/at
async def reject_bill(bill_id, db, business_id, user_id) -> Bill
async def add_settlement(bill_id, data, db, business_id, user_id) -> BillSettlement
    # VERIFIED bills only; reject overpayment (sum > total_amount); then recompute payment_status:
    # paid = sum(settlements); UNPAID if 0, PAID if >= total, else PARTIALLY_PAID
async def delete_settlement(settlement_id, db, business_id) -> None        # recompute payment_status after
async def get_or_create_vendor(name: str, db, business_id) -> Vendor      # normalized-name lookup, create on miss (used by verify flow + vendors API)
```

- [ ] Step 1: failing tests — settlement math (0 → UNPAID, partial → PARTIALLY_PAID, full → PAID, overpay → ValueError), verify without vendor → ValueError, mismatch recompute on edit.
- [ ] Step 2: implement; Step 3: pytest PASS; Step 4: Commit `feat: bill service with settlement-derived payment status`

---

### Task 6: Bills + vendors API routers

**Files:**
- Create: `backend/app/api/v1/bills.py`, `backend/app/api/v1/vendors.py`, `backend/app/schemas/bill.py`
- Modify: `backend/app/main.py` (register `/api/v1/bills`, `/api/v1/vendors`)
- Test: `backend/tests/api/test_bills.py`

**Endpoints:**

| Route | Permission | Notes |
|---|---|---|
| `POST /bills/upload` | `bills.upload` | multipart file → `upload_bill` |
| `GET /bills` | `bills.view` OR `bills.view_own` | Filters: `status`, `payment_status`, `vendor_id`, `date_from`, `date_to`, `uploaded_by`, pagination. **If user only has `bills.view_own`**: force `uploaded_by = current_user.id` and serialize the limited projection `{id, file_url, status, created_at}` — no amounts, no vendor. |
| `GET /bills/{id}` | same dual rule | staff: own bills, limited projection |
| `PUT /bills/{id}` | `bills.review` | → `update_bill_fields` |
| `POST /bills/{id}/verify` | `bills.review` | body may include `vendor_name` → `get_or_create_vendor` first |
| `POST /bills/{id}/reject` | `bills.review` | |
| `POST /bills/{id}/settlements` | `bills.pay` | body: amount, paid_on, method, reference, notes |
| `DELETE /bills/settlements/{id}` | `bills.pay` | |
| `GET /vendors` | `vendors.view` | with computed `total_billed`, `outstanding` (optional `?include_totals=true`) |
| `POST /vendors`, `PUT /vendors/{id}` | `vendors.manage` | |

Implement the dual-permission check as a small helper in `bills.py`:

```python
def _can_view_all(user: User) -> bool:
    perms = ROLE_PERMISSIONS.get(user.role.value, [])
    return "bills.*" in perms or "bills.view" in perms
```

- [ ] Step 1: failing API tests — staff list omits `total_amount` and only own rows; finance sees all; staff verify → 403; settlement → payment_status transitions in response.
- [ ] Step 2: implement schemas + routers, register in `main.py`; Step 3: pytest PASS; Step 4: Commit `feat: bills and vendors API with staff-restricted projection`

---

### Task 7: Finance summary endpoint (dashboard data)

**Files:**
- Create: `backend/app/services/finance_dashboard_service.py`
- Add to: `backend/app/api/v1/bills.py` → `GET /bills/summary` (`finance.dashboard`), params `date_from`, `date_to`, optional `vendor_id`
- Test: `backend/tests/services/test_finance_dashboard.py`

**Response shape (produces — frontend contract):**

```json
{
  "totals": {"billed": 0, "paid": 0, "outstanding": 0, "discounts": 0, "charges": 0, "bill_count": 0, "awaiting_review": 0},
  "payment_breakdown": {"PAID": {"count": 0, "amount": 0}, "PARTIALLY_PAID": {...}, "UNPAID": {...}},
  "monthly": [{"month": "2026-01", "billed": 0, "paid": 0}],
  "vendors": [{"vendor_id": "...", "name": "...", "billed": 0, "paid": 0, "outstanding": 0, "bill_count": 0, "last_bill_date": "...", "oldest_unpaid_days": 42}],
  "attention": {"drafts": [{"id": "...", "extracted_vendor_name": "...", "created_at": "..."}], "overdue": [{"id": "...", "vendor_name": "...", "total_amount": 0, "due_date": "...", "days_overdue": 0}]}
}
```

Only VERIFIED bills count in totals/monthly/vendors (drafts appear solely in `attention`). Paid amounts come from `BillSettlement` joined within range (settlement `paid_on` drives the "paid" series; bill `bill_date` (fallback `created_at`) drives "billed"). Single-query aggregates with `case()` like `scm_service.get_scm_report`.

- [ ] Step 1: failing test with seeded bills/settlements asserting totals + vendor outstanding + monthly buckets; Step 2: implement; Step 3: pytest PASS; Step 4: Commit `feat: finance dashboard summary aggregation`

---

### Task 8: Frontend — real role from JWT + role-gated navigation

**Files:**
- Modify: `frontend/src/hooks/use-auth.ts` (decode JWT payload instead of hardcoded ADMIN mock: `JSON.parse(atob(token.split('.')[1]))` → `{sub, business_id, role}`)
- Modify: `frontend/src/types/auth.ts` (add `FINANCE` to Role enum)
- Modify: `frontend/src/store/auth-store.ts` (persist decoded user)
- Modify: `frontend/src/components/layout/sidebar.tsx` + `mobile-nav.tsx`: links gain optional `roles: Role[]`; add **Bills** (`/finance/bills`, all roles incl. STAFF) and **Finance** (`/finance`, ADMIN+FINANCE only); filter list by current role.

- [ ] Step 1: implement decode helper `decodeUser(accessToken): User` in `use-auth.ts`, use in login/register/refresh success paths
- [ ] Step 2: gate sidebar/mobile-nav links; hide financial nav from STAFF/STOCK_MANAGER
- [ ] Step 3: `npm run build` in `frontend/` → succeeds; manual check: staff token sees only Bills
- [ ] Step 4: Commit `feat: decode role from JWT and role-gate navigation`

---

### Task 9: Frontend — types + API service for bills

**Files:**
- Create: `frontend/src/types/bill.ts` (Bill, BillLimited, BillSettlement, Vendor, FinanceSummary — mirror Task 6/7 contracts)
- Create: `frontend/src/services/bills.ts` (typed wrappers over `apiClient`: uploadBill(FormData), listBills(filters), getBill, updateBill, verifyBill, rejectBill, addSettlement, deleteSettlement, listVendors, getFinanceSummary)

- [ ] Step 1: write types + service; Step 2: `npm run build` passes; Step 3: Commit `feat: bill types and API service`

---

### Task 10: Frontend — bill upload + list pages (staff-safe)

> Load `/impeccable` product-register guidance before building. Reuse the TP upload page's camera/take-photo pattern (`frontend/src/app/(dashboard)/tp/upload/page.tsx`).

**Files:**
- Create: `frontend/src/app/(dashboard)/finance/bills/page.tsx` (list)
- Create: `frontend/src/app/(dashboard)/finance/bills/upload/page.tsx` (photo/file upload, `capture="environment"` input like TP upload)

**List page behavior:**
- FINANCE/ADMIN: filter bar (status, payment status, vendor select, date range, uploaded-by), table rows: thumbnail, vendor (or extracted name + "unmatched" badge), bill no., date, total, payment badge (emerald/amber/rose from `--chart-2/1/5`), status. Row → review page.
- STAFF (role from store): heading "My bill uploads"; card grid of own uploads: thumbnail, uploaded date, status badge. No amounts, no filters beyond date. Upload CTA prominent.
- States: skeleton rows while loading; empty state teaches ("Photograph a purchase bill — AI reads the totals for you") with upload button; PROCESSING rows pulse.
- Poll with TanStack Query `refetchInterval: 5000` while any bill is PROCESSING (same pattern as TP list if present).

- [ ] Step 1: upload page; Step 2: list page with role branch; Step 3: `npm run build` + manual browser check both roles; Step 4: Commit `feat: bill upload and role-aware bill list pages`

---

### Task 11: Frontend — bill review page

**Files:**
- Create: `frontend/src/app/(dashboard)/finance/bills/[id]/page.tsx`

Two-pane on desktop (image left with zoom, extracted form right), stacked on mobile — same skeleton as `tp/[id]/review/page.tsx`:
- Editable fields: bill number, date, vendor (combobox over `listVendors` + "create '<typed name>'" option), subtotal, discount, charges (dynamic label+amount rows, add/remove), total, due date, notes.
- Live computed check: `subtotal − discount + Σcharges` vs total; mismatch → amber inline callout "Extracted total ₹X doesn't match computed ₹Y — fix before verifying" (bordered tint, no side-stripe).
- Actions: Save, Verify (disabled until vendor chosen + no mismatch), Reject.
- **Settlements section** (VERIFIED only, FINANCE/ADMIN): paid-so-far progress (`amount_paid/total`, semantic color), settlement timeline rows (date, method icon, amount, reference), "Record payment" inline form in a Dialog: amount (prefilled with balance), date, method select, reference/UTR, notes. Payment status badge updates from response.
- STAFF hitting this route: redirect to `/finance/bills` (they get 403/limited payload anyway; guard client-side too).

- [ ] Step 1: build page; Step 2: build + browser test full flow (upload → draft → edit → verify → settle to PAID); Step 3: Commit `feat: bill review page with settlements`

---

### Task 12: Frontend — Finance dashboard `/finance`

> **Before any chart code: load the `dataviz` skill.** Install recharts: `cd frontend && npm i recharts`.

**Files:**
- Create: `frontend/src/app/(dashboard)/finance/page.tsx`
- Create: `frontend/src/components/finance/stat-strip.tsx`, `cashout-chart.tsx`, `payment-donut.tsx`, `vendor-table.tsx`, `attention-rail.tsx`

Layout (from the design brief, top to bottom):
1. **Header row:** "Finance" + date-range picker (presets: This month / Last month / Quarter / FY / custom) + vendor filter; filters drive one `getFinanceSummary` query.
2. **Stat strip:** single bordered container, 4 figures divided by rules (not cards): Outstanding (rose ink), Paid in period (emerald), Total billed, Awaiting review (links to drafts). Tabular-nums, animated with existing `animated-counter.tsx`.
3. **Charts row** (2-col desktop, stacked mobile): monthly billed-vs-paid grouped bar (recharts, `--chart-3`/`--chart-2`, tooltip with ₹ formatting); payment-status breakdown as a slim horizontal stacked bar with legend + counts (clearer than a donut at 3 categories).
4. **Vendor table** (the workhorse): name, bills, billed, paid, outstanding (semantic color), oldest unpaid (days, amber >30, rose >60), last bill. Sortable by outstanding default desc. Row click → `/finance/bills?vendor_id=...`.
5. **Attention rail** (right column on wide screens, bottom on mobile): "To review" draft bills + "Overdue" unpaid past due_date, each row linking to the bill.
- Access: FINANCE/ADMIN only — client guard redirects others; server enforces via `finance.dashboard`.
- States: full-page skeleton mirroring layout; empty (no verified bills) → onboarding panel pointing to upload; error → retry alert.
- Motion: counters + 200ms fade on data swap only; charts animate once, disabled under reduced motion.
- ₹ formatting helper: `Intl.NumberFormat('en-IN', {style:'currency', currency:'INR', maximumFractionDigits:0})` — shared in `frontend/src/utils/currency.ts` (create).

- [ ] Step 1: `npm i recharts`; Step 2: components + page; Step 3: build + browser screenshot pass at 375px / 768px / 1440px, light + dark; Step 4: Commit `feat: finance dashboard`

---

### Task 13: Verification pass

- [ ] `cd backend && pytest -v` → all pass
- [ ] `cd backend && ruff check app && mypy app` (match CI)
- [ ] `cd frontend && npm run lint && npm run build` → clean
- [ ] End-to-end with mock providers (`LLM_PROVIDER=mock`): create finance user via new users API → login → upload bill → worker drafts it → review, verify, settle → dashboard reflects totals; staff account confirms restricted list.
- [ ] Commit any fixes; final commit `feat: finance module complete`

---

## Explicitly out of scope (noted, not built)

- Gating existing TP/MRP endpoints (RBAC gaps found earlier) — separate fix, recommend doing right after.
- Bank-feed integration/reconciliation; bill line-items (only totals/discounts/charges per requirement); notifications.

## Self-review notes

- Spec coverage: photo upload by staff/finance/admin ✓ (Task 6 perms), AI reading ✓ (T3–4), totals/discounts/charges ✓ (T3 schema, T11 editing), company-wise segregation ✓ (vendor master T1/T4/T7), paid/unpaid by finance ✓ (T5/T6/T11), staff limited to own uploads without financials ✓ (T6 projection + T10 branch), admin full access ✓ (wildcards), dashboard with filters ✓ (T7/T12).
- Type consistency: `payment_status` values UNPAID/PARTIALLY_PAID/PAID used identically in T1, T5, T7, T9; summary JSON in T7 matches `FinanceSummary` consumed in T12.
