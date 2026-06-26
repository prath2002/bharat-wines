# TECHNICAL REQUIREMENTS DOCUMENT (TRD)

## Product

Bharat Wines — Liquor Inventory & SCM Automation Platform

---

## Technology Stack

### Frontend

| Technology | Purpose |
|---|---|
| Next.js 15 | React framework with App Router, SSR, and API routes |
| TypeScript | Type safety across the frontend |
| Tailwind CSS | Utility-first styling |
| ShadCN/ui | Accessible component library |
| Zustand | Lightweight client-side state management |
| React Query (TanStack Query) | Server state, caching, and real-time sync |
| QuaggaJS / ZXing-js | Web-based barcode scanning via camera API |

### Backend

| Technology | Purpose |
|---|---|
| FastAPI | Async Python API framework |
| SQLAlchemy 2.0 | ORM with async support |
| Pydantic v2 | Request/response validation and serialization |
| Alembic | Database migration management |
| Celery | Distributed task queue for background jobs (OCR, AI) |
| Python 3.12+ | Runtime |

### Database

| Technology | Purpose |
|---|---|
| PostgreSQL 16 | Primary relational database |
| Redis 7 | Cache layer, Celery broker, session store |

### Storage

| Technology | Purpose |
|---|---|
| AWS S3 | TP images/PDFs, Excel uploads, SCM exports |

### AI Layer

| Technology | Purpose |
|---|---|
| AWS Textract OR Google Vision | OCR — extract raw text from TP images |
| OpenAI GPT-4o / Claude | LLM — structured extraction from OCR text |
| Fuzzy Matching (rapidfuzz) | Product name matching against catalog |

> [!NOTE]
> OCR and LLM providers are abstracted behind interfaces so they can be swapped without code changes. Provider selection should be based on accuracy testing with real TP samples.

### Authentication

| Technology | Purpose |
|---|---|
| JWT (access tokens) | Stateless API authentication, 15-minute expiry |
| Refresh Tokens | Stored in DB, 30-day expiry, rotation on use |
| bcrypt | Password hashing |

### Deployment

| Technology | Purpose |
|---|---|
| Docker | Containerization for all services |
| Docker Compose | Local development orchestration |
| AWS ECS / EC2 | Production deployment |
| Nginx | Reverse proxy, SSL termination |
| GitHub Actions | CI/CD pipeline |

---

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │Sale Screen│ │TP Upload │ │SCM Export│ │ Dashboard  │ │
│  └──────┬───┘ └────┬─────┘ └────┬─────┘ └─────┬──────┘ │
│         │          │            │              │         │
│  ┌──────┴──────────┴────────────┴──────────────┴──────┐ │
│  │            API Client (React Query)                │ │
│  └──────────────────────┬─────────────────────────────┘ │
│                         │                               │
│  ┌──────────────────────┴─────────────────────────────┐ │
│  │         Web Barcode Scanner (ZXing/Quagga)         │ │
│  └────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────┘
                             │ HTTPS / JWT
┌────────────────────────────┴────────────────────────────┐
│                   API GATEWAY (Nginx)                    │
│              Rate Limiting · SSL · CORS                  │
└────────────────────────────┬────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────┐
│                  BACKEND (FastAPI)                        │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │                   API Layer (v1/)                    │ │
│  │  auth/ · products/ · inventory/ · tp/ · scm/ · ...  │ │
│  └──────────────────────┬──────────────────────────────┘ │
│                         │                                │
│  ┌──────────────────────┴──────────────────────────────┐ │
│  │                 Service Layer                        │ │
│  │  AuthService · InventoryService · TPService · ...    │ │
│  └──────────────────────┬──────────────────────────────┘ │
│                         │                                │
│  ┌──────────────────────┴──────────────────────────────┐ │
│  │               Repository Layer                       │ │
│  │  ProductRepo · MovementRepo · TPRepo · ...           │ │
│  └──────────────────────┬──────────────────────────────┘ │
│                         │                                │
│  ┌──────────────────────┴──────────────────────────────┐ │
│  │              Domain Models (SQLAlchemy)               │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐   │
│  │           Background Workers (Celery)              │   │
│  │  OCR Task · LLM Extraction · SCM Aggregation       │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────┬──────────────┬──────────────┬─────────────┘
              │              │              │
     ┌────────┴───┐  ┌──────┴──────┐  ┌───┴────┐
     │ PostgreSQL │  │    Redis    │  │  AWS S3 │
     │  (Primary) │  │ Cache+Queue │  │ Storage │
     └────────────┘  └─────────────┘  └────────┘
```

---

## Multi-Tenant Architecture

### Tenant Model

```text
Platform
  └── Business (tenant boundary)
        ├── Users
        │     └── Roles (Admin, Stock Manager, Staff)
        └── All Data (products, movements, TPs, etc.)
```

### Data Isolation Rules

- **Every table** contains a `business_id` column (foreign key to `businesses` table).
- **Every query** is automatically scoped to the current business via middleware.
- **Row-Level Security (RLS)** enforced at the application layer via a `TenantMiddleware` that injects `business_id` into the SQLAlchemy session.
- **No cross-tenant joins** are ever permitted.
- **API endpoints** never accept `business_id` as a parameter — it is always derived from the authenticated user's JWT.

---

## Core Architectural Principle — Ledger-Based Inventory

> [!IMPORTANT]
> Inventory is **NEVER updated directly**. There is no `inventory.quantity` column that gets incremented or decremented. Inventory is always **derived** from the stock movement ledger.

### Inventory Formula

```text
Current Stock = Opening
              + Purchases (from approved TPs)
              + Returns
              - Sales
              - Damage
              + Adjustments
```

### Stock Movement Types

| Type | Effect | Trigger | Approval |
|---|---|---|---|
| OPENING | + | Opening inventory import | Admin |
| PURCHASE | + | TP approved | Stock Manager / Admin |
| SALE | - | Staff barcode scan | None (direct) |
| RETURN | + | Staff barcode scan | None (direct) |
| DAMAGE | - | Staff barcode scan | None (direct) |
| ADJUSTMENT | +/- | Reconciliation (future) | Admin |

### Stock Movement Record

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| business_id | UUID | Tenant isolation |
| product_id | UUID | FK to products |
| movement_type | ENUM | OPENING, PURCHASE, SALE, RETURN, DAMAGE, ADJUSTMENT |
| quantity | INTEGER | Always positive. Direction determined by type |
| batch_number | VARCHAR | Nullable. From TP extraction |
| reference_id | UUID | Nullable. Links to TP receipt or import batch |
| reference_type | VARCHAR | Nullable. "TP_RECEIPT", "OPENING_IMPORT", etc. |
| created_by | UUID | FK to users (who recorded it) |
| created_at | TIMESTAMP | Immutable creation time |
| notes | TEXT | Optional. Damage reason, etc. |

> [!CAUTION]
> Stock movements are **append-only**. No updates. No deletes. To correct a mistake, create a **reversal movement** (e.g., accidental SALE → create a RETURN of same quantity with a note "reversal").

---

## Product & Barcode Design

### Product Entity

```text
Product
  ├── id (UUID)
  ├── business_id (UUID)
  ├── name (VARCHAR) ← Brand + Bottle Name combined
  ├── category (ENUM: IMFL, MML, CL, WINE, BEER)
  ├── size_ml (INTEGER) ← 750, 375, 180, 90, etc.
  ├── mrp (DECIMAL 10,2) ← Current MRP
  ├── scm_code (VARCHAR) ← State excise code
  ├── status (ENUM: ACTIVE, INACTIVE)
  ├── created_at (TIMESTAMP)
  ├── updated_at (TIMESTAMP)
  │
  └── Barcodes[] (one-to-many)
        ├── id (UUID)
        ├── product_id (UUID)
        ├── barcode_value (VARCHAR, UNIQUE per business)
        ├── barcode_format (ENUM: EAN13, EAN8, CODE128, QR)
        ├── is_active (BOOLEAN)
        └── created_at (TIMESTAMP)
```

### Key Constraints

- `(business_id, scm_code)` → UNIQUE — no two products in the same business share an SCM code.
- `(business_id, barcode_value)` → UNIQUE — barcodes are unique within a business.
- `(business_id, name, size_ml)` → UNIQUE — product name + size combination is unique.

### Barcode Lookup Flow

```text
Barcode Scan
    ↓
Redis Cache Lookup (barcode → product_id)
    ↓ cache miss
DB Lookup (barcodes table)
    ↓ found
Cache & Return Product
    ↓ not found
Unknown Barcode Queue → Manual Review
```

**Target latency**: Barcode → Product resolution in **< 200ms** (cache hit < 5ms).

---

## MRP Management

### MRP Change Detection (from TP)

```text
TP AI Extraction
    ↓
For each product line:
    Extract MRP from TP
    Compare with product.mrp in DB
    ↓
    Match → proceed normally
    ↓
    Mismatch → Create MRP_CHANGE_REQUEST
        ├── product_id
        ├── current_mrp (from DB)
        ├── new_mrp (from TP)
        ├── tp_receipt_id (reference)
        ├── status: PENDING
        └── Notify Owner
    ↓
    Owner Approves → Update product.mrp, log in audit
    Owner Rejects → Keep existing MRP, log rejection
```

### MRP History Table

| Field | Type |
|---|---|
| id | UUID |
| product_id | UUID |
| old_mrp | DECIMAL |
| new_mrp | DECIMAL |
| changed_by | UUID |
| change_source | ENUM (TP_DETECTION, MANUAL) |
| tp_receipt_id | UUID (nullable) |
| created_at | TIMESTAMP |

This enables accurate retroactive revenue calculation: `Σ(quantity × MRP at time of sale)`.

---

## AI TP Processing Pipeline

### Pipeline Architecture

```text
┌──────────────┐
│  TP Upload   │  Image (JPG/PNG) or PDF
│  (S3 Store)  │
└──────┬───────┘
       │ Celery Task
┌──────┴───────┐
│     OCR      │  AWS Textract / Google Vision
│  (Extract    │  → Raw text output
│   raw text)  │
└──────┬───────┘
       │
┌──────┴───────┐
│     LLM      │  GPT-4o / Claude
│ (Structured  │  → JSON: {tp_number, supplier, date,
│  Extraction) │     products: [{name, qty_cases, qty_bottles,
└──────┬───────┘       mrp, batch_number}]}
       │
┌──────┴───────┐
│   Product    │  rapidfuzz fuzzy matching
│   Matching   │  → Map extracted names to product catalog
└──────┬───────┘
       │
┌──────┴───────┐
│  Validation  │  TP duplicate check (warn if exists)
│  & Checks    │  MRP mismatch detection
│              │  Case → Bottle conversion
└──────┬───────┘
       │
┌──────┴───────┐
│    Draft     │  Human review screen
│   Receipt    │  Shows: products, quantities, MRP flags
└──────┬───────┘
       │
┌──────┴───────┐
│   Approval   │  Stock Manager or Owner
└──────┬───────┘
       │
┌──────┴───────┐
│   Ledger     │  Create PURCHASE movements
│   Entry      │  Update MRP if approved
└──────────────┘
```

### Case-to-Bottle Conversion

The TP may contain quantities in cases, bottles, or both. The system normalizes everything to **bottles**.

```text
If TP says: "10 cases, 6 bottles" and case_size = 12
Then: total_bottles = (10 × 12) + 6 = 126 bottles
```

**Case size** is determined by:
1. Product-level `case_size` attribute (if configured).
2. AI extraction from TP (if case size is mentioned).
3. Manual input during review (fallback).

### Batch Number Handling

- A single product line in a TP can have **multiple batch numbers**.
- Each batch is stored as metadata on the stock movement.
- Stock movements are created **per product** (not per batch) — batch number is an informational field.

---

## Web-Based Barcode Scanning

### Technical Approach

| Component | Technology |
|---|---|
| Camera Access | `navigator.mediaDevices.getUserMedia()` (MediaStream API) |
| Barcode Decoding | ZXing-js library (supports EAN-13, EAN-8, Code-128, QR) |
| Fallback | Manual product search + quantity entry |

### Scanning UX Flow

```text
1. Staff opens Sale/Return/Damage screen
2. Camera activates (rear camera preferred on mobile)
3. Staff points camera at barcode
4. System decodes barcode → resolves product
5. Product details shown (name, size, MRP, current stock)
6. Quantity input field (default = 1, editable)
7. Confirm button → creates stock movement
8. Camera stays active for next scan (continuous mode)
```

### Manual Entry Fallback

- Search product by name (with autocomplete).
- Enter quantity.
- No barcode required.

---

## API Design

### Versioning Strategy

All APIs are versioned under `/api/v1/`. Breaking changes require a new version.

```text
/api/v1/auth/login
/api/v1/auth/register
/api/v1/auth/refresh
/api/v1/products/
/api/v1/products/{id}/barcodes
/api/v1/inventory/
/api/v1/inventory/movements
/api/v1/tp/upload
/api/v1/tp/receipts
/api/v1/tp/receipts/{id}/approve
/api/v1/scm/daily
/api/v1/scm/export
/api/v1/reports/revenue
/api/v1/reports/low-stock
/api/v1/imports/opening-inventory
```

### Rate Limiting

| Endpoint Type | Limit |
|---|---|
| Auth (login/register) | 10 requests/minute per IP |
| Barcode lookup | 120 requests/minute per user |
| TP upload | 10 requests/minute per business |
| General API | 60 requests/minute per user |
| SCM export | 5 requests/minute per business |

### Pagination

All list endpoints use cursor-based pagination:

```json
{
  "data": [...],
  "next_cursor": "abc123",
  "has_more": true
}
```

### Error Response Format

```json
{
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "No product found for barcode 8901234567890",
    "details": {}
  }
}
```

---

## Security

### Authentication Flow

```text
Login (email + password)
    ↓
Verify password (bcrypt)
    ↓
Issue JWT access token (15 min) + Refresh token (30 days)
    ↓
Client stores access token in memory, refresh token in httpOnly cookie
    ↓
On 401 → use refresh token to get new access token
    ↓
On refresh failure → redirect to login
```

### Authorization (RBAC)

```text
Permission Check:
    JWT → user_id → user.role → role.permissions
    ↓
    Check if permission matches endpoint requirement
    ↓
    Check if user.business_id matches requested resource.business_id
```

| Permission | Admin | Stock Manager | Staff |
|---|---|---|---|
| products.create | ✅ | ✅ | ❌ |
| products.edit | ✅ | ✅ | ❌ |
| products.view | ✅ | ✅ | ✅ |
| movements.create | ✅ | ✅ | ✅ |
| tp.upload | ✅ | ✅ | ❌ |
| tp.approve | ✅ | ✅ | ❌ |
| mrp.approve | ✅ | ❌ | ❌ |
| scm.export | ✅ | ❌ | ❌ |
| reports.view | ✅ | ✅ | ❌ |
| users.manage | ✅ | ❌ | ❌ |

### Data Protection

- All data encrypted in transit (TLS 1.3).
- Passwords hashed with bcrypt (cost factor 12).
- Sensitive fields (refresh tokens) encrypted at rest.
- Soft deletion on all entities (no hard deletes).
- Immutable stock ledger (append-only, no UPDATE/DELETE).

### Audit Logging

Every state-changing operation is logged:

| Field | Description |
|---|---|
| user_id | Who performed the action |
| action | CREATE, UPDATE, DELETE, APPROVE, REJECT |
| entity_type | Product, StockMovement, TPReceipt, etc. |
| entity_id | ID of the affected record |
| changes | JSON diff of old → new values |
| ip_address | Client IP |
| timestamp | When it happened |

---

## Database Design

### Partitioning Strategy

The `stock_movements` table will grow rapidly. Strategy:

- **Partition by `created_at`** (monthly range partitions).
- Auto-create new partitions via a scheduled job.
- Old partitions (> 2 years) can be moved to cold storage.

### Indexing Strategy

| Table | Index | Purpose |
|---|---|---|
| stock_movements | `(business_id, product_id, created_at)` | Inventory calculation |
| stock_movements | `(business_id, movement_type, created_at)` | SCM aggregation |
| stock_movements | `(business_id, created_at)` | Date range queries |
| barcodes | `(business_id, barcode_value)` UNIQUE | Barcode lookup |
| products | `(business_id, scm_code)` UNIQUE | SCM reporting |
| products | `(business_id, name, size_ml)` UNIQUE | Dedup |

### Backup & Recovery

| Aspect | Strategy |
|---|---|
| Automated Backups | Daily PostgreSQL pg_dump to S3 |
| Point-in-Time Recovery | PostgreSQL WAL archiving (up to 7 days) |
| RTO | < 1 hour |
| RPO | < 5 minutes |
| Backup Testing | Monthly restore drill |

---

## Caching Strategy

| Data | Cache Type | TTL | Invalidation |
|---|---|---|---|
| Barcode → Product mapping | Redis Hash | 24 hours | On barcode create/update |
| Product catalog (per business) | Redis Hash | 1 hour | On product create/update |
| Current inventory snapshot | Redis Hash | 5 minutes | On any stock movement |
| User session / permissions | Redis String | 15 minutes | On role change |

---

## Scalability

| Aspect | Strategy |
|---|---|
| Stateless APIs | No server-side session state; JWT-based auth |
| Horizontal scaling | Multiple FastAPI instances behind Nginx load balancer |
| Read replicas | PostgreSQL read replicas for reporting queries |
| Background processing | Celery workers scale independently from API servers |
| File processing | S3 for storage, pre-signed URLs for uploads |
| Cache layer | Redis for hot data, reduces DB load |

---

## Observability

| Aspect | Tool |
|---|---|
| Application Logging | Structured JSON logs (Python `structlog`) |
| Error Tracking | Sentry |
| Metrics | Prometheus + Grafana (or CloudWatch) |
| API Monitoring | Request latency, error rates, throughput |
| Database Monitoring | Connection pool usage, slow query log |
| Audit History | Custom audit_logs table |
| Health Checks | `/health` and `/ready` endpoints |

---

## Performance Targets

| Operation | Target Latency |
|---|---|
| Barcode lookup (cache hit) | < 5ms |
| Barcode lookup (cache miss) | < 200ms |
| Stock movement creation | < 300ms |
| Inventory query (single product) | < 500ms |
| Inventory query (full catalog) | < 2s |
| TP OCR + Extraction | < 30s |
| SCM daily aggregation | < 60s |
| Page load (frontend) | < 2s |
