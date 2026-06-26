# Bharat Wines — Architecture-First Development Roadmap

---

# Core Architectural Principles

## Inventory Strategy

Inventory is never directly modified. It is always derived from the stock movement ledger.

```text
Current Stock = Opening + Purchases + Returns - Sales - Damage + Adjustments
```

Stock movements are **append-only**. No updates. No deletes. Corrections are made via reversal entries.

---

## Product Strategy

Each product is a unique combination of **name + size**. Each size is a separate product.

```text
"Royal Stag 750ml"  → Product A (MRP: ₹650, SCM Code: RS750)
"Royal Stag 180ml"  → Product B (MRP: ₹170, SCM Code: RS180)
```

A product may have multiple barcodes:

```text
Product A
  ├── Barcode: 8901234567890 (old packaging)
  ├── Barcode: 8901234567891 (new packaging)
  └── Barcode: 8901234567892 (MRP revision)
```

---

## Multi-Tenant Strategy

```text
Platform
  └── Business (tenant boundary)
        ├── Users (Admin, Stock Manager, Staff)
        └── All Data (scoped by business_id)
```

Every database record belongs to a Business. Cross-tenant data access is impossible by design.

---

## Unit of Measure

All stock quantities are tracked in **bottles**. TPs may have case quantities — these are converted to bottles during import.

---

# Stage 0 — Architecture Decisions

## Goal

Freeze all major architectural decisions before writing code.

## Prerequisites

None — this is the starting point.

## Decisions to Finalize

### Roles

| Role | Capabilities |
|---|---|
| Admin (Owner) | Full access. Approvals. User management. Reports. SCM. MRP changes. |
| Stock Manager | TP upload & review. Product management. Inventory views. |
| Staff | Sale/Return/Damage scans. Manual quantity entry. |
| Financial Manager | Deferred to future (financial module). |

### Inventory Rules

- Ledger-based inventory (derived, never stored directly).
- Immutable stock movements (append-only).
- Corrections via reversal movements.

### License Scope

- FL-2 only for V1.
- Single state.

### Product Categories

| Code | Category |
|---|---|
| IMFL | Indian Made Foreign Liquor |
| MML | Medium Made Liquor |
| CL | Country Liquor |
| WINE | Wine |
| BEER | Beer |

### Infrastructure

- AWS (ECS/EC2, S3, RDS for PostgreSQL)
- Redis (ElastiCache)
- Docker + Docker Compose
- GitHub Actions CI/CD

## Deliverables

- Architecture Decision Records (ADR) document.
- Entity Relationship Diagram (ERD).
- API contract outline.

## Verification

All team members aligned on decisions. No ambiguity.

---

# Stage 1 — Project Skeleton

## Goal

Create a deployable project structure with all tooling configured.

## Prerequisites

Stage 0 complete.

## Backend Structure

```text
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── auth.py
│   │       ├── products.py
│   │       ├── barcodes.py
│   │       ├── inventory.py
│   │       ├── movements.py
│   │       ├── tp.py
│   │       ├── scm.py
│   │       ├── reports.py
│   │       └── imports.py
│   ├── core/
│   │   ├── config.py
│   │   ├── security.py
│   │   ├── dependencies.py
│   │   └── exceptions.py
│   ├── db/
│   │   ├── base.py
│   │   ├── session.py
│   │   └── migrations/
│   ├── models/
│   │   ├── business.py
│   │   ├── user.py
│   │   ├── product.py
│   │   ├── barcode.py
│   │   ├── stock_movement.py
│   │   ├── tp_receipt.py
│   │   ├── mrp_change_request.py
│   │   └── audit_log.py
│   ├── schemas/
│   │   ├── auth.py
│   │   ├── product.py
│   │   ├── movement.py
│   │   ├── tp.py
│   │   └── scm.py
│   ├── repositories/
│   │   ├── base.py
│   │   ├── product_repo.py
│   │   ├── movement_repo.py
│   │   ├── barcode_repo.py
│   │   └── tp_repo.py
│   ├── services/
│   │   ├── auth_service.py
│   │   ├── product_service.py
│   │   ├── inventory_service.py
│   │   ├── movement_service.py
│   │   ├── barcode_service.py
│   │   ├── tp_service.py
│   │   ├── scm_service.py
│   │   ├── import_service.py
│   │   └── mrp_service.py
│   ├── integrations/
│   │   ├── s3.py
│   │   ├── redis.py
│   │   └── ai/
│   │       ├── ocr_interface.py
│   │       ├── extraction_interface.py
│   │       ├── matching_interface.py
│   │       └── prompts/
│   ├── workers/
│   │   ├── celery_app.py
│   │   ├── tp_processing.py
│   │   └── scm_aggregation.py
│   └── main.py
├── tests/
│   ├── conftest.py
│   ├── test_auth.py
│   ├── test_products.py
│   ├── test_inventory.py
│   ├── test_tp.py
│   └── test_scm.py
├── alembic/
│   └── versions/
├── alembic.ini
├── requirements.txt
├── Dockerfile
└── pyproject.toml
```

## Frontend Structure

```text
frontend/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    ← Dashboard home
│   │   ├── sale/page.tsx               ← Sale scanner
│   │   ├── return/page.tsx             ← Return scanner
│   │   ├── damage/page.tsx             ← Damage scanner
│   │   ├── products/
│   │   │   ├── page.tsx                ← Product catalog
│   │   │   └── [id]/page.tsx           ← Product detail
│   │   ├── inventory/page.tsx          ← Current stock view
│   │   ├── tp/
│   │   │   ├── page.tsx                ← TP list
│   │   │   ├── upload/page.tsx         ← TP upload
│   │   │   └── [id]/review/page.tsx    ← TP review & approve
│   │   ├── scm/page.tsx               ← SCM reports & export
│   │   ├── reports/page.tsx            ← Reports hub
│   │   ├── imports/page.tsx            ← Opening inventory import
│   │   └── settings/
│   │       ├── page.tsx                ← Business settings
│   │       └── users/page.tsx          ← User management
│   └── globals.css
├── components/
│   ├── ui/                             ← ShadCN components
│   ├── scanner/
│   │   ├── barcode-scanner.tsx         ← Camera-based scanner
│   │   ├── product-resolver.tsx        ← Barcode → product
│   │   └── quantity-input.tsx          ← Qty entry (default=1)
│   ├── products/
│   │   ├── product-card.tsx
│   │   ├── product-search.tsx
│   │   └── barcode-mapper.tsx
│   ├── tp/
│   │   ├── tp-upload-form.tsx
│   │   ├── tp-review-table.tsx
│   │   ├── mrp-mismatch-alert.tsx
│   │   └── tp-duplicate-warning.tsx
│   ├── scm/
│   │   └── scm-table.tsx
│   └── layout/
│       ├── sidebar.tsx
│       ├── header.tsx
│       └── mobile-nav.tsx
├── services/
│   ├── api-client.ts                   ← Axios/fetch wrapper
│   ├── auth-service.ts
│   ├── product-service.ts
│   ├── inventory-service.ts
│   ├── tp-service.ts
│   └── scm-service.ts
├── hooks/
│   ├── use-auth.ts
│   ├── use-scanner.ts
│   ├── use-products.ts
│   └── use-inventory.ts
├── store/
│   ├── auth-store.ts                   ← Zustand
│   └── scanner-store.ts
├── types/
│   ├── product.ts
│   ├── movement.ts
│   ├── tp.ts
│   └── scm.ts
├── utils/
│   ├── format.ts
│   ├── validators.ts
│   └── constants.ts
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── Dockerfile
```

## Infrastructure

```text
infra/
├── docker/
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   └── Dockerfile.worker
├── docker-compose.yml
├── docker-compose.prod.yml
├── nginx/
│   └── nginx.conf
└── github-actions/
    ├── ci.yml
    └── deploy.yml
```

## Deliverables

- Local development environment (single `docker compose up`).
- CI pipeline (lint, type-check, test on every push).
- Database migration framework (Alembic) ready.
- Linting and formatting configured (Ruff for Python, ESLint + Prettier for TS).

## Verification

```bash
docker compose up
# Frontend: http://localhost:3000
# Backend: http://localhost:8000/docs (Swagger)
# PostgreSQL: localhost:5432
# Redis: localhost:6379
```

---

# Stage 2 — Platform Layer

## Goal

Build reusable platform capabilities: auth, tenant isolation, RBAC, audit.

## Prerequisites

Stage 1 complete.

## Components

### Authentication Service

| Feature | Details |
|---|---|
| Register | Create business + admin user. Hash password with bcrypt. |
| Login | Verify credentials → issue JWT (15 min) + refresh token (30 days). |
| Refresh | Rotate refresh token. Issue new JWT. |
| Logout | Invalidate refresh token. |

### Authorization (RBAC)

| Feature | Details |
|---|---|
| Role assignment | Admin assigns roles to users. |
| Permission middleware | FastAPI dependency that checks `user.role.permissions` against endpoint requirement. |
| Permission matrix | Defined per endpoint (see TRD for full matrix). |

### Tenant Context Middleware

| Feature | Details |
|---|---|
| Business extraction | JWT → user_id → user.business_id → inject into DB session. |
| Query scoping | All SQLAlchemy queries automatically filtered by business_id. |
| Cross-tenant prevention | No endpoint accepts business_id as parameter. |

### Audit Log Service

| Feature | Details |
|---|---|
| Auto-logging | Middleware logs all state-changing API calls. |
| Data captured | user_id, action, entity_type, entity_id, old/new values, timestamp, IP. |
| Read API | Admin can query audit logs with filters. |

## Deliverables

- Production-ready auth with JWT + refresh tokens.
- RBAC middleware enforcing permissions on all endpoints.
- Tenant isolation verified.
- Audit logging on all write operations.

## Verification

- Business A user cannot access Business B data (return 403/404).
- Staff cannot access admin endpoints.
- All write operations appear in audit logs.

---

# Stage 3 — Domain Layer

## Goal

Define core business entities with full attributes and relationships.

## Prerequisites

Stage 2 complete.

## Entities

### Business

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| name | VARCHAR(255) | Business/shop name |
| license_type | VARCHAR(50) | "FL-2" for V1 |
| license_number | VARCHAR(100) | Excise license number |
| address | TEXT | Shop address |
| state | VARCHAR(100) | Operating state |
| is_active | BOOLEAN | Soft disable |
| created_at | TIMESTAMP | |

### User

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| business_id | UUID | FK → Business |
| email | VARCHAR(255) | UNIQUE |
| password_hash | VARCHAR(255) | bcrypt |
| name | VARCHAR(255) | Display name |
| role | ENUM | ADMIN, STOCK_MANAGER, STAFF |
| is_active | BOOLEAN | |
| created_at | TIMESTAMP | |

### Product

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| business_id | UUID | FK → Business |
| name | VARCHAR(255) | Brand + bottle name |
| category | ENUM | IMFL, MML, CL, WINE, BEER |
| size_ml | INTEGER | 750, 375, 180, 90, etc. |
| mrp | DECIMAL(10,2) | Current MRP |
| scm_code | VARCHAR(50) | State excise code |
| case_size | INTEGER | Bottles per case (nullable, for TP conversion) |
| status | ENUM | ACTIVE, INACTIVE |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

Unique: `(business_id, name, size_ml)`, `(business_id, scm_code)`

### Barcode

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| business_id | UUID | FK → Business |
| product_id | UUID | FK → Product |
| barcode_value | VARCHAR(100) | The barcode string |
| barcode_format | ENUM | EAN13, EAN8, CODE128, QR |
| is_active | BOOLEAN | |
| created_at | TIMESTAMP | |

Unique: `(business_id, barcode_value)`

### StockMovement

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| business_id | UUID | FK → Business |
| product_id | UUID | FK → Product |
| movement_type | ENUM | OPENING, PURCHASE, SALE, RETURN, DAMAGE, ADJUSTMENT |
| quantity | INTEGER | Always positive |
| batch_number | VARCHAR(100) | Nullable. From TP |
| reference_id | UUID | Nullable. FK to TP receipt or import batch |
| reference_type | VARCHAR(50) | TP_RECEIPT, OPENING_IMPORT, MANUAL |
| created_by | UUID | FK → User |
| notes | TEXT | Nullable. Damage reason, reversal note, etc. |
| created_at | TIMESTAMP | Immutable |

**No update. No delete. Append-only.**

### TPReceipt

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| business_id | UUID | FK → Business |
| tp_number | VARCHAR(100) | Extracted from TP |
| supplier_name | VARCHAR(255) | Extracted from TP |
| tp_date | DATE | Date on the TP |
| file_url | VARCHAR(500) | S3 URL of uploaded TP image/PDF |
| ocr_raw_text | TEXT | Raw OCR output |
| extracted_data | JSONB | Structured extraction result |
| status | ENUM | PROCESSING, DRAFT, APPROVED, REJECTED |
| processed_by | UUID | FK → User (who uploaded) |
| approved_by | UUID | FK → User (who approved) |
| approved_at | TIMESTAMP | |
| created_at | TIMESTAMP | |

### TPReceiptLine

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| tp_receipt_id | UUID | FK → TPReceipt |
| product_id | UUID | FK → Product (after matching) |
| extracted_name | VARCHAR(255) | Raw name from AI |
| quantity_cases | INTEGER | Cases from TP |
| quantity_bottles | INTEGER | Loose bottles from TP |
| total_bottles | INTEGER | Computed: (cases × case_size) + bottles |
| extracted_mrp | DECIMAL(10,2) | MRP from TP |
| batch_number | VARCHAR(100) | |
| match_confidence | FLOAT | Fuzzy match score (0-1) |
| is_matched | BOOLEAN | Product successfully matched |

### MRPChangeRequest

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| business_id | UUID | FK → Business |
| product_id | UUID | FK → Product |
| tp_receipt_id | UUID | FK → TPReceipt (source) |
| old_mrp | DECIMAL(10,2) | Current DB MRP |
| new_mrp | DECIMAL(10,2) | MRP from TP |
| status | ENUM | PENDING, APPROVED, REJECTED |
| decided_by | UUID | FK → User |
| decided_at | TIMESTAMP | |
| created_at | TIMESTAMP | |

### MRPHistory

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| product_id | UUID | FK → Product |
| old_mrp | DECIMAL(10,2) | |
| new_mrp | DECIMAL(10,2) | |
| change_source | ENUM | TP_DETECTION, MANUAL |
| changed_by | UUID | FK → User |
| created_at | TIMESTAMP | |

### AuditLog

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| business_id | UUID | FK → Business |
| user_id | UUID | FK → User |
| action | VARCHAR(50) | CREATE, UPDATE, DELETE, APPROVE, REJECT |
| entity_type | VARCHAR(100) | Product, StockMovement, TPReceipt, etc. |
| entity_id | UUID | |
| changes | JSONB | {field: {old, new}} |
| ip_address | VARCHAR(45) | |
| created_at | TIMESTAMP | |

### UnknownBarcode (Queue)

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| business_id | UUID | FK → Business |
| barcode_value | VARCHAR(100) | |
| scanned_by | UUID | FK → User |
| scanned_at | TIMESTAMP | |
| status | ENUM | PENDING, MAPPED, IGNORED |
| mapped_product_id | UUID | Nullable. Set when resolved |

## Deliverables

- All database tables created via Alembic migrations.
- CRUD APIs for all entities.
- Pydantic schemas for all request/response models.
- Repository layer with tenant-scoped queries.

## Verification

- All entities persist correctly with proper constraints.
- Unique constraints enforced (duplicate SCM code, duplicate barcode).
- Cascade deletes handled (soft delete only).

---

# Stage 4 — Inventory Engine

## Goal

Build the core inventory calculation engine and stock movement service.

## Prerequisites

Domain entities (Stage 3) complete.

## Components

### Stock Movement Service

**Responsibilities**:
- Create stock movements for all types (OPENING, PURCHASE, SALE, RETURN, DAMAGE, ADJUSTMENT).
- Validate product exists and is active.
- Validate quantity > 0.
- Set `created_by` from authenticated user.
- Invalidate Redis inventory cache on every movement.

**Movement creation rules**:

| Type | Who Can Create | Approval Required | Direction |
|---|---|---|---|
| OPENING | Admin (via import) | No | + |
| PURCHASE | System (via TP approval) | TP approval | + |
| SALE | Staff, Manager, Admin | No | - |
| RETURN | Staff, Manager, Admin | No | + |
| DAMAGE | Staff, Manager, Admin | No | - |
| ADJUSTMENT | Admin (future) | Yes (future) | +/- |

### Inventory Calculation Service

**Real-time inventory query**:

```sql
SELECT 
  product_id,
  SUM(CASE WHEN movement_type IN ('OPENING', 'PURCHASE', 'RETURN') THEN quantity ELSE 0 END)
  - SUM(CASE WHEN movement_type IN ('SALE', 'DAMAGE') THEN quantity ELSE 0 END)
  + SUM(CASE WHEN movement_type = 'ADJUSTMENT' THEN quantity ELSE 0 END)
  AS current_stock
FROM stock_movements
WHERE business_id = :business_id
GROUP BY product_id;
```

**With caching**:
- On first query → compute from DB → cache in Redis (TTL: 5 min).
- On stock movement create → invalidate cache for that product.

### Revenue Calculation Service

**Retroactive revenue for a date range**:

```sql
SELECT 
  sm.product_id,
  p.name,
  p.size_ml,
  SUM(sm.quantity) as total_sold,
  p.mrp,
  SUM(sm.quantity) * p.mrp as revenue
FROM stock_movements sm
JOIN products p ON sm.product_id = p.id
WHERE sm.business_id = :business_id
  AND sm.movement_type = 'SALE'
  AND sm.created_at BETWEEN :start_date AND :end_date
GROUP BY sm.product_id, p.name, p.size_ml, p.mrp;
```

> [!NOTE]
> When MRP changes are implemented, revenue calculation should use MRP history to apply the correct MRP for each time period. For V1, current MRP is used as an approximation.

### Low Stock Detection

- Configurable threshold per product (default: 10 bottles).
- Query: products where `current_stock < threshold`.
- Exposed via API for dashboard display.

## Deliverables

- Stock Movement CRUD API.
- Inventory query API (real-time, cached).
- Revenue calculation API (date range input).
- Low stock query API.

## Verification

- Create movements → query inventory → totals match manual calculation.
- Cache invalidation works correctly.
- Revenue = Σ(qty × MRP) for date range.

---

# Stage 5 — Generic Import Framework

## Goal

Create a reusable file ingestion framework for Excel/CSV uploads.

## Prerequisites

Inventory engine (Stage 4) complete.

## Components

### Upload Service

| Feature | Details |
|---|---|
| Supported formats | .xlsx, .csv |
| Max file size | 10MB |
| Storage | Upload to S3 → store URL in DB |
| Pre-signed URLs | Used for client-side direct upload to S3 |

### Validation Service

| Feature | Details |
|---|---|
| Schema validation | Required columns, data types, value ranges |
| Row-level errors | Return line-by-line error report |
| Duplicate detection | Flag duplicate entries within the file |
| Preview | Show first 10 rows parsed before processing |

### Processing Queue

| Feature | Details |
|---|---|
| Async processing | Large files processed via Celery background task |
| Progress tracking | Store processing status (UPLOADED → VALIDATING → PROCESSING → DONE/ERROR) |
| Idempotency | Same file re-uploaded → warn and prevent duplicate processing |

### Import Types (V1)

| Import Type | Purpose | Destination |
|---|---|---|
| Opening Inventory | Initial stock + product catalog setup | Products + OPENING movements |
| Barcode Mapping | Bulk barcode-to-product mapping | Barcodes table |

## Deliverables

- Generic upload → validate → process pipeline.
- Opening inventory import fully functional.
- Error reporting for failed rows.

## Verification

- Upload valid Excel → products created, opening stock recorded.
- Upload invalid Excel → clear error report returned.
- Large file (1000+ rows) → processes without timeout.

---

# Stage 6 — Product Catalog

## Goal

Manage products, barcode relationships, and unknown barcode resolution.

## Prerequisites

Import framework (Stage 5) complete.

## Components

### Product Service

| Feature | Details |
|---|---|
| Create Product | Manual creation with all required fields |
| Update Product | Edit name, category, size, status. MRP changes go through MRP flow. |
| Search Product | Full-text search on name, filter by category/size/status |
| Product Detail | View product with all barcodes, current stock, movement history |
| Deactivate Product | Soft disable (preserves history) |

### Barcode Service

| Feature | Details |
|---|---|
| Map Barcode | Scan (or type) barcode → assign to product |
| Lookup Barcode | Barcode → Product (Redis cached, < 200ms) |
| Multiple Barcodes | One product can have N barcodes |
| Deactivate Barcode | Soft disable (old packaging retired) |

### Unknown Barcode Queue

| Feature | Details |
|---|---|
| Auto-capture | When a scanned barcode has no mapping → add to queue |
| Review screen | Manager sees list of unmapped barcodes |
| Resolve | Assign to existing product or create new product |
| Ignore | Mark barcode as ignored (junk scan) |

## Deliverables

- Product CRUD with search and filters.
- Barcode mapping with cache.
- Unknown barcode review queue.

## Verification

- Create product → map barcode → scan barcode → correct product returned.
- Scan unknown barcode → appears in review queue.
- Cache invalidation works on barcode changes.

---

# Stage 7 — Scanner Integration (Web-Based)

## Goal

Connect web-based camera barcode scanner with the inventory system for Sale, Return, and Damage workflows.

## Prerequisites

- Barcode service (Stage 6) complete.
- ZXing-js / QuaggaJS library integrated in frontend.

## Components

### Barcode Scanner Component

| Feature | Details |
|---|---|
| Camera activation | Use rear camera on mobile, any camera on desktop |
| Format support | EAN-13, EAN-8, Code-128, QR Code |
| Continuous mode | Camera stays active between scans for speed |
| Feedback | Audio beep + visual flash on successful scan |
| Fallback | Manual product search with autocomplete |

### Sale Screen

```text
1. Staff opens Sale page
2. Camera activates (or staff searches manually)
3. Scan barcode → resolve product
4. Show: product name, size, MRP, current stock
5. Quantity input (default = 1, editable for multiples)
6. Tap "Confirm Sale"
7. SALE movement created
8. Success feedback → camera ready for next scan
```

### Return Screen

```text
Same flow as Sale, but creates RETURN movement.
No approval needed.
```

### Damage Screen

```text
Same flow as Sale, but creates DAMAGE movement.
Optional: notes/reason field.
No approval needed.
```

### Movement History on Scan Screens

- Show last 10 movements for the current session at the bottom.
- Quick undo: tap a recent entry to create a reversal (SALE → RETURN of same qty with "reversal" note).

## Deliverables

- Working barcode scanner on mobile and desktop browsers.
- Sale, Return, Damage screens with scan + manual entry.
- Quick undo for accidental scans.
- Quantity input with default = 1.

## Verification

- Scan on Android Chrome → product resolved → movement created.
- Scan on iPhone Safari → product resolved → movement created.
- Desktop webcam → product resolved → movement created.
- Manual search → product selected → movement created.
- Unknown barcode → added to unknown queue + user notified.

---

# Stage 8 — Reporting Layer

## Goal

Build read-optimized reporting services for the dashboard.

## Prerequisites

Inventory engine (Stage 4) stable.

## Components

### Dashboard (Home Screen)

| Widget | Data |
|---|---|
| Today's Summary | Sales count, purchases count, returns, damage |
| Low Stock Alerts | Products below threshold |
| Pending TP Approvals | Count of draft TPs awaiting approval |
| Pending MRP Changes | Count of MRP mismatch alerts |

### Inventory Summary Report

- Full product list with current stock.
- Filterable by category, size, stock range.
- Sortable by name, stock level, last movement date.
- Exportable to Excel.

### Product Summary Report

- Per-product view: all movements, stock timeline, MRP history.

### Movement Summary Report

- All movements with filters: date range, type, product, user.
- Grouped views: by day, by product, by type.

### Revenue Report

- Date range input.
- Per-product: quantity sold × MRP = revenue.
- Total revenue for period.
- Exportable to Excel.

### Low Stock Report

- Products below configurable threshold.
- Shows: product name, current stock, threshold, last purchase date.

## Deliverables

- Dashboard APIs for all widgets.
- Report APIs with filters and pagination.
- Excel export for key reports.

## Verification

- Reports match manual ledger calculation.
- Exports contain correct data.
- Dashboard loads in < 2s.

---

# Stage 9 — AI Foundation

## Goal

Build the AI abstraction layer so OCR, LLM, and matching providers can be swapped independently.

## Prerequisites

Reporting (Stage 8) complete.

## Structure

```text
app/integrations/ai/
├── __init__.py
├── ocr_interface.py          ← Abstract base class
├── ocr_textract.py           ← AWS Textract implementation
├── ocr_google_vision.py      ← Google Vision implementation
├── extraction_interface.py   ← Abstract base class
├── extraction_openai.py      ← GPT-4o implementation
├── extraction_claude.py      ← Claude implementation
├── matching_interface.py     ← Abstract base class
├── matching_fuzzy.py         ← rapidfuzz implementation
└── prompts/
    ├── tp_extraction.txt     ← LLM prompt template
    └── tp_extraction_v2.txt  ← Versioned prompts
```

## Interfaces

### OCR Interface

```python
class OCRInterface(ABC):
    async def extract_text(self, file_url: str) -> OCRResult:
        """Returns raw text + confidence score from image/PDF."""
```

### Extraction Interface

```python
class ExtractionInterface(ABC):
    async def extract_structured(self, raw_text: str) -> TPExtractionResult:
        """Returns structured TP data from raw text.
        Result: {tp_number, supplier, date, products: [{name, qty_cases, qty_bottles, mrp, batch_number}]}
        """
```

### Matching Interface

```python
class MatchingInterface(ABC):
    async def match_products(self, extracted_names: list[str], catalog: list[Product]) -> list[MatchResult]:
        """Returns matched product_ids with confidence scores."""
```

## Configuration

- Provider selection via environment variable (`OCR_PROVIDER=textract`, `LLM_PROVIDER=openai`).
- Dependency injection in FastAPI.

## Deliverables

- All three interfaces defined.
- At least one implementation per interface.
- Unit tests with mock data.

## Verification

- Swap OCR provider → system still works.
- Swap LLM provider → system still works.
- Matching returns correct products for known names.

---

# Stage 10 — TP Processing

## Goal

Automate TP ingestion with AI, MRP mismatch detection, and duplicate warning.

## Prerequisites

- AI Foundation (Stage 9) complete.
- Sample TP files available for testing.

## Flow

```text
TP Image/PDF Upload
      ↓
Store in S3 → Create TPReceipt (status: PROCESSING)
      ↓
Celery Task: OCR
      ↓
Celery Task: LLM Structured Extraction
      ↓
Celery Task: Product Matching (fuzzy)
      ↓
System Checks:
  ├── TP Number → Query DB → WARN if duplicate
  ├── Per product: Compare extracted_mrp vs product.mrp
  │    └── If mismatch → Create MRPChangeRequest (PENDING)
  └── Case → Bottle conversion (qty_cases × case_size + qty_bottles)
      ↓
Update TPReceipt (status: DRAFT) with extracted data
      ↓
Manager/Owner opens Review Screen:
  ├── See all extracted products, quantities, batch numbers
  ├── See MRP mismatch alerts (highlighted)
  ├── See TP duplicate warning (if applicable)
  ├── Edit/correct any extraction errors
  └── Confirm product matches (especially low-confidence ones)
      ↓
Owner handles MRP changes:
  ├── Approve → update product.mrp, log in MRPHistory
  └── Reject → keep existing MRP
      ↓
Approve TP Receipt
      ↓
System creates PURCHASE stock movements (one per product line)
TPReceipt status → APPROVED
```

## Components

### TP Upload

- Accept JPG, PNG, PDF.
- Max file size: 20MB.
- Upload to S3 with pre-signed URL.
- Create TPReceipt record.

### OCR Processing (Celery Task)

- Send file to OCR provider.
- Store raw text in `tp_receipts.ocr_raw_text`.
- Handle OCR failures gracefully (retry 3x, then mark FAILED).

### AI Extraction (Celery Task)

- Send OCR text to LLM with extraction prompt.
- Parse JSON response into structured data.
- Store in `tp_receipts.extracted_data` (JSONB).

### Product Matching

- For each extracted product name → fuzzy match against business product catalog.
- Store match confidence.
- Products with confidence < 0.7 → flag for manual review.
- Unmatched products → option to create new product.

### MRP Mismatch Detection

- For each matched product → compare extracted MRP vs DB MRP.
- If different → create `MRPChangeRequest` with PENDING status.
- Show as alert on review screen.

### TP Duplicate Detection

- Query `tp_receipts` WHERE `tp_number = :extracted_tp_number AND business_id = :bid`.
- If found → show warning (not blocking, just informational).

### Receipt Approval

- Manager or Admin reviews the draft.
- Can edit quantities, product matches, batch numbers.
- Approves → creates PURCHASE movements.
- Rejects → marks TPReceipt as REJECTED.

## Deliverables

- End-to-end TP upload → AI extraction → review → approval → ledger entry.
- MRP mismatch alert + approval flow.
- TP duplicate warning.
- Case-to-bottle conversion.

## Verification

- Upload sample TP → AI extracts correct data.
- MRP mismatch → alert shown → approve → MRP updated.
- Duplicate TP number → warning displayed.
- Approve → PURCHASE movements created → inventory increases.

---

# Stage 11 — SCM Engine

## Goal

Generate SCM-ready records using state excise codes.

## Prerequisites

Inventory engine and TP processing complete.

## Components

### Daily Aggregator (Celery Scheduled Task)

Runs nightly (or on-demand). For each product, for each day:

```text
Opening Stock = Previous day's Closing Stock
              (Day 1: use OPENING movements)

Purchases   = SUM(PURCHASE movements for the day)
Sales       = SUM(SALE movements for the day)
Returns     = SUM(RETURN movements for the day)
Damage      = SUM(DAMAGE movements for the day)

Closing Stock = Opening + Purchases + Returns - Sales - Damage
```

### SCM Summary Table

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| business_id | UUID | FK → Business |
| product_id | UUID | FK → Product |
| scm_code | VARCHAR(50) | Copied from product at time of generation |
| date | DATE | |
| opening | INTEGER | Bottles |
| purchases | INTEGER | Bottles |
| sales | INTEGER | Bottles |
| returns | INTEGER | Bottles |
| damage | INTEGER | Bottles |
| closing | INTEGER | Bottles |
| created_at | TIMESTAMP | |

Unique: `(business_id, product_id, date)`

### SCM Summary Generator

- API endpoint: generate SCM for a date or date range.
- Fills any gaps (days with no movements → opening = closing, everything else = 0).

### SCM Export Service

- Export as **Excel** — formatted for excise submission.
- Export as **PDF** — printable register format.
- Columns: SCM Code, Product Name, Category, Size, Opening, Purchase, Sale, Return, Damage, Closing.
- Grouped by category (IMFL, MML, CL, Wine, Beer).
- Sorted by SCM code within each category.

## Deliverables

- Nightly SCM aggregation.
- SCM view screen with date picker.
- Excel and PDF export.

## Verification

- SCM closing stock = inventory engine current stock (for today).
- SCM opening of Day N+1 = SCM closing of Day N.
- Export file contains all products with correct totals.

---

# Stage 12 — PWA & Mobile Optimization

## Goal

Provide seamless mobile access without native apps. Scanning, viewing, and all workflows must work on a phone browser.

## Prerequisites

Core platform (Stages 1–11) stable.

## Components

### Responsive UI

- Mobile-first design (primary users are on phones).
- Touch-optimized buttons (min 44px tap targets).
- Bottom navigation bar on mobile.
- Sidebar navigation on desktop/tablet.

### PWA Installation

- `manifest.json` with app name, icons, theme.
- Service worker for asset caching.
- "Add to Home Screen" prompt.
- Full-screen mode when launched from home screen.

### Offline Support (Limited)

- Cache product catalog locally for barcode lookup.
- Queue stock movements offline → sync when online.
- Show clear "offline" indicator.
- **Full offline-first architecture is future scope** — V1 focuses on graceful degradation.

### Dashboard Access

- Mobile dashboard with key metrics.
- Pull-to-refresh.
- Quick action buttons: Sale, Return, Damage, TP Upload.

## Deliverables

- Single application works on Desktop, Tablet, and Mobile.
- PWA installable on Android and iOS.
- Scanning works on phone camera via browser.
- Basic offline tolerance (queued movements).

## Verification

- Install PWA on Android → works from home screen.
- Install PWA on iOS → works from home screen.
- Scan barcode on phone → product resolved → movement created.
- Lose network briefly → queued movement syncs when back online.

---

# Dependency Graph

```text
Stage 0: Architecture Decisions
    ↓
Stage 1: Project Skeleton
    ↓
Stage 2: Platform Layer (Auth, RBAC, Tenant, Audit)
    ↓
Stage 3: Domain Layer (Entities, Migrations, CRUD)
    ↓
Stage 4: Inventory Engine (Movements, Calculations, Revenue)
    ↓
Stage 5: Import Framework (Excel Upload, Validation)
    ↓
Stage 6: Product Catalog (Products, Barcodes, Unknown Queue)
    ↓
Stage 7: Scanner Integration (Web Camera, Sale/Return/Damage)
    ↓
Stage 8: Reporting Layer (Dashboard, Reports, Exports)
    ↓
Stage 9: AI Foundation (OCR, LLM, Matching Interfaces)
    ↓
Stage 10: TP Processing (Upload → AI → Review → Approve → Ledger)
    ↓
Stage 11: SCM Engine (Daily Aggregation, Exports)
    ↓
Stage 12: PWA & Mobile (Responsive, Installable, Offline)
```

---

## Golden Rules

1. **Build capabilities first. Build business features second.** The Inventory Engine is the core. Everything else depends on it.

2. **Stock movements are sacred.** Append-only. Never update. Never delete. If you need to correct, create a reversal.

3. **MRP is government-controlled.** Changes only via TP detection + owner approval, or manual change by owner. Every change is logged.

4. **All quantities are in bottles.** Cases are converted to bottles at the point of TP import. The rest of the system knows nothing about cases.

5. **SCM codes are the language of excise.** Every product has a state excise code. SCM exports are organized by these codes.

6. **Every query is tenant-scoped.** No exceptions. No shortcuts. Business A never sees Business B's data.
