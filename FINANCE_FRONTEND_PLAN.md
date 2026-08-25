# Finance Frontend Completion — Dashboard Redesign + Remaining Pages

## Context

The backend for the full finance/payment-workflow module (vendor payment terms, categories/departments, payment scheduling, approvals, payment completion, documents, dashboard aggregates, views, reports, audit) is complete and verified (Phases 1–9, all live-tested against the running stack). The frontend has only caught up partially: Manual Bill Entry, and a dashboard with `DueSoonStrip` + `UpcomingPayments` bolted onto the existing `StatStrip`/`CashoutChart`/`PaymentBreakdown`/`VendorTable`/`AttentionRail` stack. That dashboard is now overloaded — six stacked panels on one page — and a large chunk of the backend (payment scheduling, approvals, documents, vendor management, category/department admin, dedicated pending/overdue/history/reports views) has **no UI at all**, reachable only via direct API calls.

This plan does two things: **(1) declutters the dashboard** into a lean overview that links out instead of cramming everything in, and **(2) builds every remaining page** so the finance module is fully usable from the browser. Confirmed with the user: add a shared tab-style sub-navigation across all `/finance/*` pages, and introduce a lightweight toast system (replacing bare inline-error-only feedback) since this adds many new mutating actions (approve/reject/hold/schedule/complete/upload/vendor-update/category-create).

---

## A. Dashboard Redesign (declutter)

**Problem:** `frontend/src/app/(dashboard)/finance/page.tsx` currently stacks: header+filters → `StatStrip` (4 stats) → `DueSoonStrip` (5 stats) → `UpcomingPayments` (full date list) → `CashoutChart` + `PaymentBreakdown` (2-col) → `VendorTable` + `AttentionRail` (2-col). That's 6 blocks of dense data on first paint.

**Fix — merge and trim, push detail to dedicated pages:**
- Merge `StatStrip` + `DueSoonStrip` into **one** compact KPI strip (reuse the existing `Stat`/`DueStat` pattern from `components/finance/stat-strip.tsx` and `due-soon-strip.tsx`, consolidate into one row): Outstanding, Due today, Approval pending, Awaiting review — the four numbers that actually demand attention today. Move Paid/Billed/Scheduled-amount/Due-this-week/Due-this-month into the charts/detail pages below, not the headline strip.
- `UpcomingPayments` shrinks to a **7-day preview** (3–4 rows max) with a "View full calendar →" link to the new `/finance/calendar` page, instead of rendering 14 days of detail inline.
- `CashoutChart` + `PaymentBreakdown` stay (they're the one visual/trend element worth keeping on a dashboard) but move to a single row under the KPI strip.
- `VendorTable` shrinks to **top 5 by outstanding** with a "View all vendors →" link to the new `/finance/vendors` page — the full sortable table doesn't belong on a landing page.
- `AttentionRail` (drafts + overdue) stays as-is — it's already compact and it's the highest-signal actionable panel.
- Add a **quick-links row** (icon + label cards) to Payment Schedules, Approvals, Vendors, Calendar, History, Reports — this is what replaces "everything crammed into one page" with "one glance, then drill in."

Net result: dashboard goes from 6 stacked data blocks to KPI strip → quick links → trend chart row → attention rail + top vendors. Everything else lives on its own page, reachable via the new sub-nav.

## B. Shared Infrastructure (build first, everything else depends on it)

1. **`frontend/src/app/(dashboard)/finance/layout.tsx`** (new) — shared layout wrapping all `/finance/*` routes with a horizontal tab bar: Dashboard · Bills · Vendors · Schedules · Approvals · Calendar · History · Reports · Settings (gear icon). Active tab highlighted via `usePathname()`. Role-gated the same way `finance/page.tsx` already gates itself (ADMIN/FINANCE only; redirect otherwise) — move that guard into the layout so every child page inherits it instead of re-implementing the `useEffect` redirect per page.
2. **Toast system** — add `sonner` (`npm install sonner`), mount `<Toaster />` once in `frontend/src/app/providers.tsx` (or wherever the root providers live — check current file), theme-aware to match the existing dark/light setup. Replace the bare `alert()` in `tp/[id]/review/page.tsx` while touching that pattern, and use `toast.success`/`toast.error` in every new mutation below instead of (or alongside) the existing inline-error-banner convention — keep inline banners for form-blocking validation errors, use toasts for action confirmations (approve, complete, upload, delete).
3. **`components/finance/badges.tsx`** — extend with `ScheduleStatusBadge` (PENDING/SCHEDULED/APPROVAL_PENDING/APPROVED/PAID/ON_HOLD/CANCELLED/FAILED) and `ApprovalStatusBadge` (PENDING/APPROVED/REJECTED/ON_HOLD), same variant-mapping pattern as the existing `BillStatusBadge`/`PaymentBadge`.
4. **`services/vendors.ts`** (new) — `updateVendor`, `getVendor`, `getVendorStatement`, `createVendor` (full-field version; supersedes the implicit vendor-name-only creation path).
5. **`services/payment-schedules.ts`** (new) — `createPaymentSchedule`, `listPaymentSchedules`, `updatePaymentSchedule`, `cancelPaymentSchedule`, `submitForApproval`, `completePaymentSchedule`.
6. **`services/payment-approvals.ts`** (new) — `listPaymentApprovals`, `approvePayment`, `rejectPayment`, `holdPayment`.
7. **`services/documents.ts`** (new) — `uploadBillDocument`, `listBillDocuments`, `uploadPaymentDocument`, `listPaymentDocuments`, `deleteDocument`.
8. **`services/finance-config.ts`** (exists, list-only) — extend with `createBillCategory`, `updateBillCategory`, `createDepartment`, `updateDepartment`.
9. **`services/finance.ts`** (exists) — extend with `getPaymentHistory`, and export-download helper (`downloadReport(path, filename)` — hits the `/finance/reports/*/export` endpoints, response type `blob`, triggers a browser download via an object URL).
10. **Types** — `types/vendor.ts` (new, full Vendor with terms/bank fields — today's `Vendor` in `types/bill.ts` is the lean list-shape; keep that for dropdowns, add the full shape here), `types/payment.ts` (new — `PaymentSchedule`, `PaymentApproval`).

## C. New Pages

Each row: route, what it does, backend it wires to, files touched.

| Page | Purpose | Endpoints | Key files |
|---|---|---|---|
| `/finance/vendors` | Vendor list — table (name, GSTIN, payment terms, outstanding, last bill), "Add vendor" dialog, row → detail | `GET/POST /vendors` | new page; `components/finance/vendor-form.tsx` (dialog, reused for create+edit) |
| `/finance/vendors/[id]` | Vendor detail: editable terms/contact/bank-details form + statement (total billed/paid/outstanding/overdue, upcoming payments, payment history table) | `GET/PUT /vendors/{id}`, `GET /vendors/{id}/statement` | new page |
| `/finance/schedules` | Payment schedules list — filters (status, vendor, date range), table with amount/date/status, row actions: edit, cancel, submit-for-approval | `GET /payment-schedules`, `PUT/DELETE /payment-schedules/{id}`, `POST .../submit-for-approval` | new page |
| `/finance/approvals` | Approval queue — pending approvals list, each with approve/reject/hold + notes (pattern-match `tp/[id]/review/page.tsx`'s approve/reject UX, but as a list not a single-item review) | `GET /payment-approvals`, `POST .../approve|reject|hold` | new page |
| `/finance/calendar` | Full payment calendar — date-grouped list (reuse `UpcomingPayments`' grouping logic, generalized to accept a date range + navigation prev/next 14-day window), vendor filter | `GET /finance/payment-calendar` | new page; refactor `UpcomingPayments` into a shared `PaymentCalendarList` component used by both the dashboard preview and this full page |
| `/finance/history` | Payment history — completed payments table (vendor, invoice, amount, paid on, method, reference, approved by), filters (date range, vendor) | `GET /finance/payment-history` | new page |
| `/finance/pending` | Dedicated pending-bills view (vendor grouping toggle) — the dashboard's `AttentionRail`/`UpcomingPayments` only show a slice; this is the full sortable list | `GET /finance/pending-bills` | new page |
| `/finance/overdue` | Dedicated overdue-bills view, same shape as pending | `GET /finance/overdue-bills` | new page |
| `/finance/reports` | Report picker — one card per report type (Pending, Overdue, Payment History, Scheduled, Vendor-wise, Monthly, Aging), each with an optional date-range filter and a "Download .xlsx" button | `GET /finance/reports/*/export` | new page |
| `/finance/settings` | Categories & Departments admin — two simple tables (name, active toggle, add-new inline form) | `GET/POST/PUT /bill-categories`, `GET/POST/PUT /departments` | new page |

## D. Extend Existing Pages

- **`finance/bills/page.tsx`** — extend `FinanceFilters` with Category, Department, Amount range (min/max), and an "Overdue only" checkbox, wired to the `GET /bills` params already supported backend-side (`category_id`, `department_id`, `amount_min`, `amount_max`, `overdue`).
- **`finance/bills/[id]/page.tsx`** — three additions:
  1. Category/department selects on the edit form (mirroring the vendor select), wired into `buildPayload()`/`updateBill`.
  2. A **Documents** section (list + upload button with doc-type select, delete) using the new `services/documents.ts`, for both the bill itself (`BILL` owner) and, once payments exist, a small documents sub-list per payment row.
  3. A **Payment Schedules** section (parallel to the existing Payments/Settlements card): list schedules for this bill, "Schedule a payment" dialog (amount + date), and per-schedule actions (submit for approval / cancel / complete-when-approved) — this is how scheduling actually gets used day-to-day, not just from the standalone `/finance/schedules` page.
- **`components/layout/sidebar.tsx`** — the existing single `Finance` link stays as the entry point (it already routes to `/finance`, which now has the sub-nav layout); no sidebar changes needed beyond that, since sub-navigation lives in the new finance layout instead of flattening everything into the global sidebar.

## E. Reference Mockups (one per new/redesigned page)

Per the user's request for images alongside the plan: during implementation, generate one reference mockup per page using the `design` skill (Claude Design canvas — produces `.dc.html` artboards, right tool for app screen/wireframe mockups, as opposed to the landing-page-oriented image-gen skills). Not generated during planning (plan mode is read-only); this is the brief for each artboard to produce as the first step of building that page:

1. **Dashboard (redesigned)** — compact 4-stat KPI row, quick-link icon cards (6), trend chart + payment-breakdown donut side by side, attention rail + top-5 vendor table side by side. Emphasize whitespace vs. today's dense stack.
2. **Vendors list** — table with inline outstanding-amount badges, "Add vendor" primary button top-right, empty state for zero vendors.
3. **Vendor detail** — two-column: left = editable terms/contact/bank-details form, right = statement summary cards + payment history table.
4. **Payment Schedules list** — filter bar (status/vendor/date), table with status badges, row-level action menu (edit/cancel/submit).
5. **Approvals queue** — card-per-approval layout (not dense table — this is a review workflow), each card: bill/vendor/amount, approve/reject/hold buttons, notes field.
6. **Payment Calendar (full page)** — date-grouped list with prev/next week navigation, today highlighted, matching the dashboard preview's visual language but denser.
7. **Payment History** — straightforward filterable table, export button top-right.
8. **Pending / Overdue Bills** — shared layout: vendor-group toggle, table with days-remaining/days-overdue column emphasized via color.
9. **Reports** — grid of report cards, each with a small icon, title, one-line description, date-range mini-filter, download button.
10. **Settings (Categories & Departments)** — two side-by-side simple list-with-inline-add panels.
11. **Bill detail (extended)** — same layout as today plus the new Documents and Payment Schedules cards stacked below Payments.

## F. Task List / Sequencing

1. **Infra first** (Section B): layout + tab nav, toast, badges, all new service files + types. Nothing else can be demoed without this.
2. **Dashboard redesign** (Section A) — do this early since it's the page users see first and the user explicitly called it out as crowded now.
3. **Vendors** (list + detail) — needed by nearly everything else (bill forms, schedules, approvals all reference vendor names).
4. **Bill detail extensions** (Documents + Payment Schedules cards) — this is where scheduling actually gets used; build before the standalone `/finance/schedules` page since it's the primary entry point.
5. **Schedules + Approvals standalone pages** — the cross-bill management views.
6. **Calendar (full page)**, refactoring `UpcomingPayments` into the shared `PaymentCalendarList` component in the process.
7. **History, Pending, Overdue pages** — straightforward list pages, same shape, can be built in parallel/back-to-back.
8. **Reports page** — depends on nothing new, purely additive.
9. **Settings (Categories & Departments)**.
10. **Bills list filter extension** — small, do last as polish.

## Verification

- `npx tsc --noEmit` and `npx eslint` clean after each page (established pattern this session).
- For each new mutating flow, a live smoke test against the running docker stack (`docker compose up -d`, hit the route via `curl`/direct API calls as done throughout this session) before considering it done — especially payment scheduling → submit → approve → complete, since that's the highest-value new flow.
- Manually click through each new page once implemented (browser, or `chromium-cli`/Playwright-based check if available in the execution environment) to confirm no console errors and that empty/loading/error states render sensibly.
- Confirm the dashboard redesign doesn't regress existing data — same `FinanceSummary` shape, just re-laid-out.
