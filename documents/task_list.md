# 📋 Bharat Wines — Developer Task List

> **How to use**: Work through tasks top-to-bottom. Each task has a checkbox — mark `[x]` when done, `[/]` when in progress. Do NOT skip ahead — tasks have sequential dependencies.
>
> **Key**: `[ ]` = Todo · `[/]` = In Progress · `[x]` = Done · `[!]` = Blocked

---

# Stage 0 — Architecture Decisions

> **Goal**: Finalize all decisions before writing a single line of code.

## 0.1 Documentation & Setup

- [ ] **T-001**: Read PRD, TRD, and Component List end-to-end. Confirm understanding of all domain terms (TP, SCM, MRP, FL-2, IMFL, MML, CL).
- [ ] **T-002**: Create Architecture Decision Records (ADR) document summarizing:
  - Ledger-based inventory (append-only stock movements)
  - FL-2 single license scope
  - 5 product categories (IMFL, MML, CL, Wine, Beer)
  - Each size = separate product
  - All quantities in bottles
  - MRP change requires owner approval
  - Web-based barcode scanning (no hardware scanner)
- [ ] **T-003**: Create Entity Relationship Diagram (ERD) covering all entities:
  - Business, User, Product, Barcode, StockMovement, TPReceipt, TPReceiptLine, MRPChangeRequest, MRPHistory, AuditLog, UnknownBarcode
  - Mark all PKs, FKs, unique constraints, and indexes
- [ ] **T-004**: Create API contract outline — list all endpoints with HTTP method, path, request/response shape, and required role.
- [ ] **T-005**: Get sign-off from product owner on ADR, ERD, and API contract.

**✅ Stage 0 Exit Criteria**: ADR signed off, ERD reviewed, API contract approved.

---

# Stage 1 — Project Skeleton

> **Goal**: Deployable project structure with all tooling. `docker compose up` works.

## 1.1 Backend Skeleton

- [x] **T-010**: Initialize Python project with `pyproject.toml`. Configure:
  - Python 3.12+
  - Dependencies: fastapi, uvicorn, sqlalchemy[asyncio], pydantic, alembic, celery, redis, boto3, bcrypt, pyjwt, python-multipart, rapidfuzz
  - Dev dependencies: pytest, pytest-asyncio, httpx, ruff, mypy
- [x] **T-011**: Create backend directory structure:
  ```
  backend/app/{api/v1, core, db, models, schemas, repositories, services, integrations/ai, workers}
  ```
- [x] **T-012**: Create `backend/app/main.py` — FastAPI app instance with:
  - CORS middleware
  - Lifespan handler (startup/shutdown)
  - Health check endpoint: `GET /health` → `{"status": "ok"}`
  - Ready check endpoint: `GET /ready` → checks DB + Redis connectivity
- [x] **T-013**: Create `backend/app/core/config.py` — Pydantic Settings class loading from env vars:
  - DATABASE_URL, REDIS_URL, S3_BUCKET, JWT_SECRET, JWT_EXPIRY_MINUTES, REFRESH_TOKEN_DAYS
  - OCR_PROVIDER, LLM_PROVIDER
  - APP_ENV (dev/staging/prod)
- [x] **T-014**: Create `backend/app/core/exceptions.py` — Custom exception classes:
  - `NotFoundError`, `DuplicateError`, `PermissionError`, `ValidationError`, `ExternalServiceError`
  - Global exception handler middleware that returns standardized error JSON.
- [x] **T-015**: Set up Ruff for linting + formatting. Create `ruff.toml` with:
  - Line length: 100
  - Rules: E, W, F, I (isort), UP, B, SIM
- [x] **T-016**: Create `backend/Dockerfile`:
  - Base: `python:3.12-slim`
  - Install dependencies, copy code, run uvicorn
  - Non-root user for security

## 1.2 Frontend Skeleton

- [x] **T-020**: Initialize Next.js 15 project with TypeScript, Tailwind CSS, App Router. Run from the **project root** (`bharat_wines_2/`):
  ```bash
  npx -y create-next-app@latest ./frontend --typescript --tailwind --app --eslint --src-dir --no-import-alias
  ```
  > This creates the `frontend/` directory automatically with the default Next.js scaffold (`app/`, `public/`, `src/`, `package.json`, `tsconfig.json`, `tailwind.config.ts`, etc.). Do NOT create the `frontend/` directory beforehand.
- [x] **T-021**: Install frontend dependencies. Run from inside `frontend/`:
  ```bash
  cd frontend
  npx shadcn@latest init
  npm install zustand @tanstack/react-query axios @zxing/browser @zxing/library date-fns lucide-react xlsx
  ```
- [x] **T-022**: Create **additional custom directories** inside `frontend/src/` (these are NOT created by `create-next-app` — they are project-specific):
  ```bash
  mkdir -p src/components/{scanner,products,tp,scm,layout}
  mkdir -p src/{services,hooks,store,types,utils}
  ```
  Final structure (★ = created by create-next-app, ✚ = created manually):
  ```
  frontend/
  ├── src/
  │   ├── app/              ★ (Next.js App Router — already exists)
  │   ├── components/
  │   │   ├── ui/           ★ (created by ShadCN init)
  │   │   ├── scanner/      ✚
  │   │   ├── products/     ✚
  │   │   ├── tp/           ✚
  │   │   ├── scm/          ✚
  │   │   └── layout/       ✚
  │   ├── services/         ✚
  │   ├── hooks/            ✚
  │   ├── store/            ✚
  │   ├── types/            ✚
  │   └── utils/            ✚
  ├── public/               ★
  ├── package.json          ★
  ├── tsconfig.json         ★
  └── tailwind.config.ts    ★
  ```
- [x] **T-023**: Create `frontend/src/services/api-client.ts`:
  - Axios instance with base URL from env
  - Request interceptor: attach JWT from memory
  - Response interceptor: on 401 → attempt refresh → retry
  - On refresh failure → redirect to `/login`
- [x] **T-024**: Create `frontend/src/types/` — TypeScript interfaces for all entities:
  - `product.ts`: Product, Barcode, ProductCategory enum
  - `movement.ts`: StockMovement, MovementType enum
  - `tp.ts`: TPReceipt, TPReceiptLine, MRPChangeRequest
  - `scm.ts`: SCMRecord
  - `auth.ts`: User, Role, LoginRequest, LoginResponse
- [x] **T-025**: Create basic layout components:
  - `frontend/src/components/layout/sidebar.tsx` — Desktop sidebar nav
  - `frontend/src/components/layout/mobile-nav.tsx` — Bottom tab bar for mobile
  - `frontend/src/components/layout/header.tsx` — Top bar with user menu
- [x] **T-026**: Create `frontend/src/app/(dashboard)/layout.tsx` — Dashboard layout wrapper:
  - Sidebar on desktop, bottom nav on mobile
  - Auth guard (redirect to login if no token)
- [x] **T-027**: Create `frontend/Dockerfile`:
  - Multi-stage build (deps → build → prod)
  - Use `node:20-alpine`
  - Output: standalone Next.js server

## 1.3 Infrastructure

- [x] **T-030**: Create `docker-compose.yml` with services:
  - `backend` (FastAPI, port 8000)
  - `frontend` (Next.js, port 3000)
  - `db` (PostgreSQL 16, port 5432, volume for persistence)
  - `redis` (Redis 7, port 6379)
  - `worker` (Celery worker, same backend image, different command)
  - Network: all services on same Docker network
- [x] **T-031**: Create `infra/nginx/nginx.conf`:
  - Reverse proxy: `/api` → backend:8000, `/` → frontend:3000
  - SSL termination placeholder
  - Rate limiting zones (see TRD)
  - Gzip compression
- [x] **T-032**: Create `infra/github-actions/ci.yml`:
  - Trigger on push to main and PRs
  - Jobs: lint backend (ruff), lint frontend (eslint), type check (mypy + tsc), test backend (pytest), test frontend (jest)
- [x] **T-033**: Create `.env.example` with all required environment variables documented.

## 1.4 Database Setup

- [x] **T-035**: Create `backend/app/db/session.py`:
  - Async SQLAlchemy engine factory
  - Async session factory
  - `get_db()` dependency for FastAPI
- [x] **T-036**: Create `backend/app/db/base.py`:
  - Base model class with common fields: `id` (UUID), `created_at`, `updated_at`
  - `business_id` mixin for tenant-scoped models
  - Soft-delete mixin (`is_deleted`, `deleted_at`)
- [x] **T-037**: Initialize Alembic:
  ```bash
  alembic init alembic
  ```
  Configure `alembic/env.py` to use async engine and auto-detect model changes.
- [x] **T-038**: Verify: Run `docker compose up` — all services start, health check passes, Swagger UI accessible at `localhost:8000/docs`.

**✅ Stage 1 Exit Criteria**: `docker compose up` → Frontend loads at `:3000`, Backend Swagger at `:8000/docs`, PostgreSQL + Redis healthy.

---

# ✅ Stage 2 — Platform Layer (COMPLETED)

> **Goal**: Auth, RBAC, tenant isolation, and audit logging — production-ready.

## 2.1 Database Models (Auth & Tenant)

- [x] **T-040**: Create `backend/app/models/business.py` — Business model:
  - Fields: id, name, license_type ("FL-2"), license_number, address, state, is_active, created_at
- [x] **T-041**: Create `backend/app/models/user.py` — User model:
  - Fields: id, business_id (FK), email (unique), password_hash, name, role (ENUM: ADMIN, STOCK_MANAGER, STAFF), is_active, created_at
  - Role stored as PostgreSQL ENUM type
- [x] **T-042**: Create `backend/app/models/refresh_token.py` — RefreshToken model:
  - Fields: id, user_id (FK), token_hash, expires_at, is_revoked, created_at
- [x] **T-043**: Create Alembic migration for Business, User, RefreshToken tables. Run migration.

## 2.2 Authentication Service

- [x] **T-045**: Create `backend/app/core/security.py`:
  - `hash_password(plain)` → bcrypt hash (cost 12)
  - `verify_password(plain, hash)` → bool
  - `create_access_token(user_id, business_id, role)` → JWT (15 min expiry)
  - `decode_access_token(token)` → payload or raise
  - `generate_refresh_token()` → random 64-char string
- [x] **T-046**: Create `backend/app/services/auth_service.py`:
  - `register(business_name, email, password, ...)` → create Business + Admin User + return tokens
  - `login(email, password)` → verify → issue JWT + refresh token
  - `refresh(refresh_token)` → validate → rotate → issue new JWT + new refresh token
  - `logout(refresh_token)` → revoke refresh token
- [x] **T-047**: Create `backend/app/schemas/auth.py` — Pydantic models:
  - `RegisterRequest`: business_name, email, password, name, license_number, address, state
  - `LoginRequest`: email, password
  - `TokenResponse`: access_token, refresh_token, token_type, expires_in
  - `RefreshRequest`: refresh_token
- [x] **T-048**: Create `backend/app/api/v1/auth.py` — Auth router:
  - `POST /api/v1/auth/register` → register
  - `POST /api/v1/auth/login` → login
  - `POST /api/v1/auth/refresh` → refresh
  - `POST /api/v1/auth/logout` → logout
- [x] **T-049**: Write tests for auth:
  - Register → success → tokens returned
  - Register → duplicate email → 409
  - Login → correct creds → tokens
  - Login → wrong password → 401
  - Refresh → valid token → new tokens
  - Refresh → expired/revoked token → 401

## 2.3 Authorization (RBAC)

- [x] **T-050**: Create `backend/app/core/dependencies.py`:
  - `get_current_user(token)` — FastAPI dependency: decode JWT → load user → return
  - `require_role(*roles)` — dependency factory: check `user.role in roles`, else 403
  - `require_permissions(*permissions)` — finer-grained permission check
- [x] **T-051**: Define permission matrix as a Python dict/config:
  ```python
  ROLE_PERMISSIONS = {
      "ADMIN": ["products.*", "movements.*", "tp.*", "mrp.approve", "scm.*", "reports.*", "users.*"],
      "STOCK_MANAGER": ["products.create", "products.edit", "products.view", "movements.*", "tp.upload", "tp.approve", "reports.view"],
      "STAFF": ["products.view", "movements.create"],
  }
  ```
- [x] **T-052**: Write tests for RBAC:
  - Admin can access all endpoints
  - Staff cannot access product create
  - Staff cannot access TP upload
  - Staff can create movements
  - Unauthenticated request → 401

## 2.4 Tenant Context Middleware

- [x] **T-055**: Create `backend/app/core/tenant.py` — TenantMiddleware:
  - Extract `business_id` from JWT payload
  - Inject into SQLAlchemy session (session-level filter or manual scope)
  - All repository queries auto-filter by `business_id`
- [x] **T-056**: Create `backend/app/repositories/base.py` — Base repository class:
  - Accept `db_session` and `business_id` in constructor
  - All query methods auto-add `WHERE business_id = :bid`
  - Methods: `get_by_id()`, `get_all()`, `create()`, `update()`, `soft_delete()`
- [x] **T-057**: Write tests for tenant isolation:
  - Create two businesses (A and B) with users
  - User from A queries → only sees A's data
  - User from A cannot access B's resource by ID → 404

## 2.5 Audit Logging

- [x] **T-060**: Create `backend/app/models/audit_log.py` — AuditLog model:
  - Fields: id, business_id, user_id, action (CREATE/UPDATE/DELETE/APPROVE/REJECT), entity_type, entity_id, changes (JSONB), ip_address, created_at
- [x] **T-061**: Create Alembic migration for AuditLog table.
- [x] **T-062**: Create `backend/app/services/audit_service.py`:
  - `log_action(user_id, business_id, action, entity_type, entity_id, changes, ip)` → create log entry
  - Helper: `diff_changes(old_dict, new_dict)` → returns `{field: {old, new}}`
- [x] **T-063**: Create audit middleware or decorator that auto-logs on POST/PUT/PATCH/DELETE endpoints.
- [x] **T-064**: Create `GET /api/v1/audit-logs` — Admin only, with filters: entity_type, user_id, date range. Paginated.
- [x] **T-065**: Write test: Create a product → audit log entry exists with correct data.

## 2.6 Frontend Auth

- [x] **T-070**: Create `frontend/src/store/auth-store.ts` — Zustand store:
  - State: user, accessToken, isAuthenticated
  - Actions: setAuth, clearAuth
  - Token stored in memory (NOT localStorage for security)
- [x] **T-071**: Create `frontend/src/hooks/use-auth.ts`:
  - `useAuth()` → returns user, login(), logout(), register(), isLoading
  - Uses React Query for API calls
  - On login success → store token in Zustand, refresh token in httpOnly cookie (set by backend)
- [x] **T-072**: Create `frontend/src/app/(auth)/login/page.tsx`:
  - Email + password form
  - Validation (required fields, email format)
  - Error display
  - Submit → login → redirect to dashboard
  - Link to register page
- [x] **T-073**: Create `frontend/src/app/(auth)/register/page.tsx`:
  - Fields: business name, owner name, email, password, confirm password, license number, address, state
  - Validation
  - Submit → register → redirect to dashboard
- [x] **T-074**: Create auth guard in dashboard layout:
  - Check if authenticated → if not → redirect to `/login`
  - Show loading spinner while checking
- [x] **T-075**: Write E2E test (or manual test): Register → login → see dashboard → logout → redirected to login.

**✅ Stage 2 Exit Criteria**: Register, login, refresh, logout all work. RBAC enforced. Tenant isolation verified. Audit logs captured.

---

# ✅ Stage 3 — Domain Layer (COMPLETED)

> **Goal**: All business entities with CRUD APIs, migrations, and proper constraints.

## 3.1 Product & Barcode Models

- [x] **T-080**: Create `backend/app/models/product.py` — Product model:
  - Fields: id (UUID), business_id (FK), name (VARCHAR 255), category (ENUM: IMFL, MML, CL, WINE, BEER), size_ml (INT), mrp (DECIMAL 10,2), scm_code (VARCHAR 50), case_size (INT, nullable), status (ENUM: ACTIVE, INACTIVE), created_at, updated_at
  - Unique constraints: `(business_id, scm_code)`, `(business_id, name, size_ml)`
- [x] **T-081**: Create `backend/app/models/barcode.py` — Barcode model:
  - Fields: id (UUID), business_id (FK), product_id (FK → Product), barcode_value (VARCHAR 100), barcode_format (ENUM: EAN13, EAN8, CODE128, QR), is_active (BOOLEAN), created_at
  - Unique constraint: `(business_id, barcode_value)`
- [x] **T-082**: Create Alembic migration for Product and Barcode tables with all indexes.

## 3.2 Stock Movement Model

- [x] **T-083**: Create `backend/app/models/stock_movement.py`:
  - Fields: id (UUID), business_id (FK), product_id (FK → Product), movement_type (ENUM: OPENING, PURCHASE, SALE, RETURN, DAMAGE, ADJUSTMENT), quantity (INT, > 0), batch_number (VARCHAR 100, nullable), reference_id (UUID, nullable), reference_type (VARCHAR 50, nullable), created_by (FK → User), notes (TEXT, nullable), created_at (TIMESTAMP)
  - Indexes: `(business_id, product_id, created_at)`, `(business_id, movement_type, created_at)`, `(business_id, created_at)`
  - **No update trigger. No delete trigger. Append-only enforced at application layer.**
- [x] **T-084**: Create Alembic migration for StockMovement table with partitioning by `created_at` (monthly).

## 3.3 TP Models

- [x] **T-085**: Create `backend/app/models/tp_receipt.py` — TPReceipt model:
  - Fields: id, business_id, tp_number (VARCHAR 100), supplier_name (VARCHAR 255), tp_date (DATE), file_url (VARCHAR 500), ocr_raw_text (TEXT), extracted_data (JSONB), status (ENUM: PROCESSING, DRAFT, APPROVED, REJECTED), processed_by (FK → User), approved_by (FK → User, nullable), approved_at (TIMESTAMP, nullable), created_at
- [x] **T-086**: Create `backend/app/models/tp_receipt_line.py` — TPReceiptLine model:
  - Fields: id, tp_receipt_id (FK), product_id (FK, nullable), extracted_name (VARCHAR 255), quantity_cases (INT), quantity_bottles (INT), total_bottles (INT), extracted_mrp (DECIMAL 10,2), batch_number (VARCHAR 100), match_confidence (FLOAT), is_matched (BOOLEAN)
- [x] **T-087**: Create `backend/app/models/mrp_change_request.py`:
  - Fields: id, business_id, product_id (FK), tp_receipt_id (FK), old_mrp (DECIMAL), new_mrp (DECIMAL), status (ENUM: PENDING, APPROVED, REJECTED), decided_by (FK → User, nullable), decided_at (TIMESTAMP, nullable), created_at
- [x] **T-088**: Create `backend/app/models/mrp_history.py`:
  - Fields: id, product_id (FK), old_mrp, new_mrp, change_source (ENUM: TP_DETECTION, MANUAL), changed_by (FK → User), created_at
- [x] **T-089**: Create `backend/app/models/unknown_barcode.py`:
  - Fields: id, business_id, barcode_value, scanned_by (FK → User), scanned_at, status (ENUM: PENDING, MAPPED, IGNORED), mapped_product_id (FK, nullable)
- [x] **T-090**: Create Alembic migration for all TP-related tables.

## 3.4 Schemas (Pydantic)

- [x] **T-091**: Create `backend/app/schemas/product.py`:
  - `ProductCreate`: name, category, size_ml, mrp, scm_code, case_size (optional)
  - `ProductUpdate`: name (opt), category (opt), size_ml (opt), status (opt), case_size (opt)
  - `ProductResponse`: all fields + current_stock (computed)
  - `ProductListResponse`: paginated list
  - `BarcodeCreate`: barcode_value, barcode_format
  - `BarcodeResponse`: all barcode fields
- [x] **T-092**: Create `backend/app/schemas/movement.py`:
  - `MovementCreate`: product_id, movement_type, quantity (default=1), notes (optional)
  - `MovementResponse`: all fields + product name + user name
  - `MovementListResponse`: paginated, filterable
- [x] **T-093**: Create `backend/app/schemas/tp.py`:
  - `TPUploadResponse`: tp_receipt_id, status
  - `TPDraftResponse`: full receipt with lines, MRP flags, duplicate warning
  - `TPApproveRequest`: optional edits to lines before approval
  - `TPReceiptResponse`: all fields
- [x] **T-094**: Create `backend/app/schemas/scm.py`:
  - `SCMRecord`: scm_code, product_name, category, size_ml, opening, purchases, sales, returns, damage, closing
  - `SCMResponse`: date, list of SCMRecords, totals

## 3.5 Repositories

- [x] **T-095**: Create `backend/app/repositories/product_repo.py`:
  - `get_by_id(product_id)` → Product
  - `get_all(filters, pagination)` → list
  - `search_by_name(query)` → list (ILIKE search)
  - `get_by_scm_code(scm_code)` → Product
  - `create(data)` → Product
  - `update(product_id, data)` → Product
  - `deactivate(product_id)` → soft status change
- [x] **T-096**: Create `backend/app/repositories/barcode_repo.py`:
  - `lookup(barcode_value)` → Product (via join) — critical for scan performance
  - `get_by_product(product_id)` → list of Barcodes
  - `create(data)` → Barcode
  - `deactivate(barcode_id)`
- [x] **T-097**: Create `backend/app/repositories/movement_repo.py`:
  - `create(data)` → StockMovement
  - `get_by_product(product_id, date_range)` → list
  - `get_by_type(movement_type, date_range)` → list
  - `aggregate_inventory(product_id=None)` → current stock per product
  - `aggregate_by_day(product_id, date_range)` → daily breakdown
- [x] **T-098**: Create `backend/app/repositories/tp_repo.py`:
  - `create(data)` → TPReceipt
  - `get_by_id(id)` → TPReceipt with lines
  - `check_duplicate_tp_number(tp_number)` → bool
  - `update_status(id, status)`
  - `get_drafts()` → list of DRAFT receipts
  - `get_all(filters, pagination)` → list

## 3.6 CRUD API Endpoints

- [x] **T-100**: Create `backend/app/api/v1/products.py`:
  - `POST /api/v1/products` — Create product (Manager, Admin)
  - `GET /api/v1/products` — List products with search, filters, pagination (All roles)
  - `GET /api/v1/products/{id}` — Get product detail with barcodes, current stock (All roles)
  - `PUT /api/v1/products/{id}` — Update product (Manager, Admin)
  - `DELETE /api/v1/products/{id}` — Deactivate product (Admin)
- [x] **T-101**: Create `backend/app/api/v1/barcodes.py`:
  - `POST /api/v1/products/{id}/barcodes` — Map barcode to product (Manager, Admin)
  - `GET /api/v1/products/{id}/barcodes` — List barcodes for product (All roles)
  - `DELETE /api/v1/barcodes/{id}` — Deactivate barcode (Manager, Admin)
  - `GET /api/v1/barcodes/lookup?value={barcode}` — Lookup product by barcode (All roles)
- [x] **T-102**: Write tests for all Product + Barcode CRUD endpoints:
  - Create product → 201 + correct data
  - Create duplicate (same name+size) → 409
  - Create duplicate SCM code → 409
  - Search products by name → results
  - Map barcode → lookup barcode → correct product
  - Duplicate barcode → 409
  - Tenant isolation: business A product not visible to business B

**✅ Stage 3 Exit Criteria**: All tables migrated. CRUD APIs working. Constraints enforced. Tests passing.

---

# ✅ Stage 4 — Inventory Engine (COMPLETED)

> **Goal**: Stock movement creation, inventory calculation, revenue calculation, low stock detection.

## 4.1 Movement Service

- [x] **T-110**: Create `backend/app/services/movement_service.py`:
  - `create_movement(product_id, movement_type, quantity, batch_number, reference_id, reference_type, notes, user)`:
    - Validate product exists and is ACTIVE
    - Validate quantity > 0
    - Validate movement_type is allowed
    - Create StockMovement record
    - Invalidate Redis cache for product inventory
    - Log audit entry
    - Return created movement
- [x] **T-111**: Create `backend/app/api/v1/movements.py`:
  - `POST /api/v1/movements` — Create movement (Staff, Manager, Admin)
    - Request body: `{product_id, movement_type, quantity (default 1), notes}`
    - Only allow SALE, RETURN, DAMAGE from this endpoint (PURCHASE comes from TP, OPENING from import)
  - `GET /api/v1/movements` — List movements with filters (date_range, type, product_id, user_id). Paginated. (Manager, Admin)
  - `GET /api/v1/movements/{id}` — Get single movement detail (Manager, Admin)
- [x] **T-112**: Write tests for movement creation:
  - Create SALE → stock decreases
  - Create RETURN → stock increases
  - Create DAMAGE → stock decreases
  - Quantity = 0 → 422 validation error
  - Inactive product → 400 error
  - Staff creating PURCHASE directly → 403

## 4.2 Inventory Calculation Service

- [x] **T-115**: Create `backend/app/services/inventory_service.py`:
  - `get_current_stock(product_id=None)`:
    - If product_id: return stock for single product
    - If None: return stock for all products in business
    - Check Redis cache first (key: `inv:{business_id}:{product_id}`)
    - Cache miss → aggregate from stock_movements table → cache result (TTL 5 min)
  - `invalidate_cache(business_id, product_id)`:
    - Delete Redis key for the product
    - Called by movement_service after every movement
- [x] **T-116**: Create `backend/app/api/v1/inventory.py`:
  - `GET /api/v1/inventory` — Current stock for all products. Filterable by category, min/max stock. Sortable. Paginated. (All roles)
  - `GET /api/v1/inventory/{product_id}` — Current stock for single product + recent movements. (All roles)
- [x] **T-117**: Set up Redis integration in `backend/app/integrations/redis.py`:
  - Redis client factory
  - `get_redis()` dependency
  - Helper methods: `cache_get()`, `cache_set()`, `cache_delete()`, `cache_delete_pattern()`
- [x] **T-118**: Write tests for inventory calculation:
  - Opening (100) + Purchase (50) + Return (5) - Sale (30) - Damage (3) = 122
  - Multiple products → each calculated independently
  - Cache hit → returns same value without DB query
  - Cache invalidation → next query hits DB

## 4.3 Revenue Calculation Service

- [x] **T-120**: Add to `inventory_service.py`:
  - `calculate_revenue(start_date, end_date)`:
    - Query SALE movements in date range
    - Group by product
    - Calculate: quantity × product.mrp for each product
    - Return per-product breakdown + total
- [x] **T-121**: Create `backend/app/api/v1/reports.py`:
  - `GET /api/v1/reports/revenue?start_date=X&end_date=Y` — Revenue report (Admin)
    - Response: list of `{product_name, size_ml, quantity_sold, mrp, revenue}` + `total_revenue`
- [x] **T-122**: Write tests for revenue calculation:
  - Sell 10 bottles at MRP 500 → revenue = 5000
  - Multiple products → correct per-product totals
  - Date filtering works correctly

## 4.4 Low Stock Detection

- [x] **T-125**: Add to `inventory_service.py`:
  - `get_low_stock(threshold=10)`:
    - Return products where current_stock < threshold
    - Include: product name, current stock, threshold, last movement date
- [x] **T-126**: Add to reports API:
  - `GET /api/v1/reports/low-stock?threshold=10` — Low stock report (Manager, Admin)
- [x] **T-127**: Write test: Create product, sell below threshold, appears in low stock report.

**✅ Stage 4 Exit Criteria**: Movements create correctly. Inventory derived from ledger matches manual calculation. Revenue and low stock reports work. Cache working.

---

# Stage 5 — Generic Import Framework

> **Goal**: Reusable Excel/CSV upload → validate → process pipeline.

## 5.1 Upload Infrastructure

- [x] **T-130**: Create `backend/app/integrations/s3.py`:
  - `generate_presigned_upload_url(filename, content_type)` → URL (for client-side upload)
  - `generate_presigned_download_url(file_key)` → URL
  - `upload_file(file_bytes, key)` → S3 URL
  - For local dev: use MinIO or local filesystem fallback
- [x] **T-131**: Create `backend/app/services/import_service.py`:
  - `upload_file(file, import_type)`:
    - Validate file extension (.xlsx, .csv)
    - Validate file size (< 10MB)
    - Upload to S3
    - Create ImportJob record (status: UPLOADED)
    - Return import_job_id

## 5.2 Opening Inventory Import

- [x] **T-132**: Define opening inventory Excel template:
  - Columns: Product Name, Category (IMFL/MML/CL/WINE/BEER), Size (ml), MRP, SCM Code, Opening Quantity, Case Size (optional)
  - Create sample template file for documentation
- [x] **T-133**: Create `backend/app/services/opening_import_service.py`:
  - `validate_file(file_path)`:
    - Check required columns present
    - Validate each row: name not empty, category valid, size > 0, mrp > 0, scm_code not empty, quantity >= 0
    - Return: list of valid rows + list of errors with line numbers
  - `preview(file_path)`:
    - Parse first 10 rows → return as JSON for frontend preview
  - `process(file_path, business_id, user_id)`:
    - For each valid row:
      1. Check if product exists (match by name + size_ml)
      2. If not → create product with all attributes
      3. Create OPENING stock movement with the quantity
    - Return: summary (products created, products updated, movements created, errors)
- [x] **T-134**: Create `backend/app/api/v1/imports.py`:
  - `POST /api/v1/imports/opening-inventory` — Upload file (Admin)
  - `GET /api/v1/imports/{id}/preview` — Preview parsed data (Admin)
  - `POST /api/v1/imports/{id}/process` — Execute import (Admin)
  - `GET /api/v1/imports/{id}/status` — Check processing status (Admin)
- [x] **T-135**: Create Celery task for async processing:
  - `tasks/process_opening_import.py`
  - Process large files in background
  - Update ImportJob status: UPLOADED → VALIDATING → PROCESSING → DONE/ERROR
- [x] **T-136**: Write tests:
  - Valid Excel → products created, OPENING movements recorded, inventory correct
  - Invalid rows → error report with line numbers
  - Duplicate product (same name+size) → updates existing, doesn't duplicate
  - Duplicate SCM code → error reported

## 5.3 Frontend — Import Screen

- [x] **T-140**: Create `frontend/src/app/(dashboard)/imports/page.tsx`:
  - File upload dropzone (drag & drop + click to browse)
  - Accept .xlsx and .csv only
  - Show upload progress
  - After upload → show preview table (first 10 rows)
  - Validate button → show validation results (errors highlighted)
  - Process button → trigger import → show progress → show summary
- [x] **T-141**: Create sample Opening Inventory Excel template → downloadable from the import page.

**✅ Stage 5 Exit Criteria**: Upload Excel → validate → preview → process → products + opening stock created. Error reporting works.

---

# Stage 6 — Product Catalog

> **Goal**: Full product management UI, barcode mapping, unknown barcode queue.

## 6.1 Product Management Frontend

- [x] **T-150**: Create `frontend/src/app/(dashboard)/products/page.tsx`:
  - Product list table: name, category, size, MRP, SCM code, stock, status
  - Search bar (searches by name)
  - Filters: category dropdown, status dropdown
  - Sort: by name, stock, MRP
  - Pagination
  - "Add Product" button (Manager, Admin only)
- [x] **T-151**: Create product creation modal/page:
  - Form fields: name, category (dropdown), size_ml (dropdown: 90, 180, 375, 750 + custom), MRP, SCM code, case_size (optional)
  - Validation: all required fields, MRP > 0, size > 0
  - Submit → create product → refresh list
- [x] **T-152**: Create `frontend/src/app/(dashboard)/products/[id]/page.tsx`:
  - Product detail view:
    - All attributes
    - List of mapped barcodes (with "Add Barcode" button)
    - Current stock
    - Recent movement history (last 20)
    - MRP history
  - Edit button → inline edit form (Manager, Admin)
  - Deactivate button (Admin)

## 6.2 Barcode Mapping Frontend

- [x] **T-155**: Create `frontend/src/components/products/barcode-mapper.tsx`:
  - On product detail page → "Add Barcode" button
  - Opens camera scanner OR manual entry field
  - Scan/enter barcode → check if already mapped
  - If unmapped → confirm mapping → save
  - If already mapped to another product → show error
- [x] **T-156**: Create `frontend/src/hooks/use-scanner.ts`:
  - Initialize ZXing browser scanner
  - Handle camera permissions
  - Start/stop scanning
  - Return decoded barcode value
  - Handle errors (camera denied, no camera available)

## 6.3 Unknown Barcode Queue

- [x] **T-160**: Create API endpoint: `GET /api/v1/barcodes/unknown` — List unknown barcodes (Manager, Admin)
- [x] **T-161**: Create API endpoint: `POST /api/v1/barcodes/unknown/{id}/map` — Map unknown barcode to product
- [x] **T-162**: Create API endpoint: `POST /api/v1/barcodes/unknown/{id}/ignore` — Mark as ignored
- [x] **T-163**: Create `frontend/src/app/(dashboard)/products/unknown-barcodes/page.tsx`:
  - Table: barcode value, scanned by, scanned at, status
  - For each PENDING barcode: "Map to Product" button → product search → confirm
  - "Ignore" button for junk scans
- [x] **T-164**: Update barcode lookup service: when barcode not found → auto-create UnknownBarcode record.

**✅ Stage 6 Exit Criteria**: Product CRUD UI works. Barcodes can be mapped via scan or manual. Unknown barcodes are captured and reviewable.

---

# Stage 7 — Scanner Integration

> **Goal**: Working Sale, Return, Damage screens with web camera scanning + manual entry.

## 7.1 Barcode Scanner Component

- [x] **T-170**: Create `frontend/src/components/scanner/barcode-scanner.tsx`:
  - Use `@zxing/browser` to access camera
  - Prefer rear camera on mobile
  - Live viewfinder with scan region overlay
  - On decode → emit barcode value
  - Audio beep on successful scan (use Web Audio API)
  - Visual flash/border color change on scan
  - Continuous mode: stays active after each scan
  - "Switch Camera" button (front/rear toggle)
  - Error states: camera permission denied, no camera available

- [x] **T-171**: Create `frontend/src/components/scanner/product-resolver.tsx`:
  - Takes barcode value → calls `GET /api/v1/barcodes/lookup?value={barcode}`
  - On success → display product card: name, size, MRP, current stock, category
  - On not found → show "Unknown Barcode" message + option to map it
  - Loading state while resolving

- [x] **T-172**: Create `frontend/src/components/scanner/quantity-input.tsx`:
  - Numeric input field, default value = 1
  - +/- stepper buttons for easy increment/decrement
  - Min value = 1
  - Large, touch-friendly design for phone use

## 7.2 Sale Screen

- [x] **T-175**: Create `frontend/src/app/(dashboard)/sale/page.tsx`:
  - Full-screen scan mode on mobile
  - Top: camera viewfinder (barcode scanner component)
  - Below camera: manual search fallback (product name autocomplete)
  - On product resolved:
    - Show product card (name, size, MRP, stock)
    - Quantity input (default = 1)
    - "Confirm Sale" button (large, green, prominent)
  - On confirm:
    - POST /api/v1/movements {product_id, type: SALE, quantity}
    - Success toast: "Sold 2x Royal Stag 750ml"
    - Camera reactivates for next scan
  - Bottom: session history (last 10 sales in this session)
    - Each entry shows product, quantity, time
    - "Undo" button on each → creates RETURN reversal with note "Reversal: accidental sale"

## 7.3 Return Screen

- [x] **T-178**: Create `frontend/src/app/(dashboard)/return/page.tsx`:
  - Same layout as Sale screen
  - Creates RETURN movements instead of SALE
  - "Confirm Return" button (blue)
  - Success toast: "Returned 1x Blenders Pride 375ml"
  - Session history with undo (SALE reversal)

## 7.4 Damage Screen

- [x] **T-180**: Create `frontend/src/app/(dashboard)/damage/page.tsx`:
  - Same layout as Sale screen
  - Creates DAMAGE movements
  - Additional: optional "Reason" text field (e.g., "Dropped during stocking")
  - "Record Damage" button (red/orange)
  - Success toast: "Recorded damage: 1x Kingfisher Premium 650ml"
  - Session history with undo (reversal ADJUSTMENT)

## 7.5 Integration Testing

- [x] **T-185**: Test on Android Chrome: scan barcode → product resolved → sale created → inventory decreases
- [x] **T-186**: Test on iPhone Safari: same flow
- [x] **T-187**: Test manual entry: search product → select → enter quantity 5 → confirm → 5 units sold
- [x] **T-188**: Test unknown barcode: scan unmapped barcode → "Unknown" shown → appears in unknown queue
- [x] **T-189**: Test undo: sell product → tap undo → return created → stock restored

**✅ Stage 7 Exit Criteria**: Scanning works on phone browsers. Sale/Return/Damage flows complete. Manual entry works. Undo works.

---

# Stage 8 — Reporting Layer

> **Goal**: Dashboard with widgets and exportable reports.

## 8.1 Dashboard Home

- [ ] **T-200**: Create `frontend/src/app/(dashboard)/page.tsx` — Dashboard home:
  - **Today's Summary Card**: total sales count, total purchases, returns, damage (numbers)
  - **Low Stock Alert Card**: count of products below threshold, "View All" link
  - **Pending Actions Card**: count of draft TPs awaiting approval, count of pending MRP changes
  - **Quick Action Buttons**: Sale, Return, Damage, Upload TP (large, touch-friendly)
- [ ] **T-201**: Create `GET /api/v1/reports/dashboard-summary` — Backend API:
  - Returns: today's sales count, purchase count, return count, damage count, low stock count, pending TP count, pending MRP count
  - Single aggregation query for performance
- [ ] **T-202**: Style dashboard: cards with subtle shadows, color-coded (green for sales, blue for purchases, yellow for low stock, red for pending approvals). Mobile responsive grid.

## 8.2 Inventory Report Screen

- [ ] **T-205**: Create `frontend/src/app/(dashboard)/inventory/page.tsx`:
  - Table: Product Name, Category, Size, MRP, SCM Code, Current Stock
  - Filters: category, stock range (in stock / low stock / out of stock)
  - Sort: by name, stock level, category
  - Pagination
  - "Export to Excel" button → download .xlsx
- [ ] **T-206**: Create `GET /api/v1/inventory/export` — Returns Excel file (Manager, Admin).

## 8.3 Movement History Screen

- [x] **T-208**: Add movement history to existing movements API with frontend:
  - Table: Date/Time, Product, Type (color-coded badge), Quantity, User, Notes
  - Filters: date range picker, movement type multi-select, product search
  - Grouped view toggle: by day / by product
  - "Export to Excel" button

## 8.4 Revenue Report Screen

- [x] **T-210**: Create `frontend/src/app/(dashboard)/reports/page.tsx` — Reports hub:
  - Revenue report section:
    - Date range picker (start date, end date, quick presets: Today, Last 7 Days, Last 30 Days, This Month)
    - Table: Product Name, Size, Qty Sold, MRP, Revenue
    - Total revenue at bottom (highlighted)
    - "Export to Excel" button
  - Low stock report section
  - Link to movement history

## 8.5 Excel Export Utility

- [x] **T-215**: Create `backend/app/utils/excel_export.py`:
  - Generic function: `generate_excel(headers, rows, sheet_name)` → bytes
  - Use `openpyxl` library
  - Support: column widths auto-fit, header styling (bold, background color), number formatting

**✅ Stage 8 Exit Criteria**: Dashboard loads with real data. All reports filterable and exportable. Mobile responsive.

---

# Stage 9 — AI Foundation

> **Goal**: Abstraction layer for OCR, LLM, and product matching — providers swappable.

## 9.1 Interfaces

- [x] **T-220**: Create `backend/app/integrations/ai/ocr_interface.py`:
  - Abstract class `OCRInterface` with method: `extract_text(file_url: str) -> OCRResult`
  - `OCRResult`: raw_text, confidence, provider_metadata
- [x] **T-221**: Create `backend/app/integrations/ai/extraction_interface.py`:
  - Abstract class `ExtractionInterface` with method: `extract_structured(raw_text: str) -> TPExtractionResult`
  - `TPExtractionResult`: tp_number, supplier_name, tp_date, products (list of {name, qty_cases, qty_bottles, mrp, batch_number})
- [x] **T-222**: Create `backend/app/integrations/ai/matching_interface.py`:
  - Abstract class `MatchingInterface` with method: `match_products(extracted_names: list[str], catalog: list[Product]) -> list[MatchResult]`
  - `MatchResult`: extracted_name, matched_product_id, confidence, is_matched

## 9.2 Implementations

- [x] **T-225**: Create `backend/app/integrations/ai/ocr_textract.py`:
  - AWS Textract implementation of OCRInterface
  - Handle image and PDF inputs
  - Error handling: retry on throttle, timeout after 60s
- [ ] **T-226**: Create alternative: `backend/app/integrations/ai/ocr_google_vision.py` (optional, for flexibility):
  - Google Vision API implementation
- [x] **T-227**: Create `backend/app/integrations/ai/extraction_openai.py`:
  - GPT-4o implementation of ExtractionInterface
  - Prompt template in `prompts/tp_extraction.txt`
  - Parse JSON response from LLM
  - Handle malformed responses gracefully (retry once)
- [x] **T-228**: Create prompt template `backend/app/integrations/ai/prompts/tp_extraction.txt`:
  - System prompt: "You are a data extraction assistant for Indian liquor Transport Permits..."
  - Define exact JSON output schema
  - Include examples of TP text → expected output
  - Handle edge cases: missing fields, multiple batch numbers
- [x] **T-229**: Create `backend/app/integrations/ai/matching_fuzzy.py`:
  - Implementation using `rapidfuzz` library
  - `process.extractOne()` for each extracted name against catalog
  - Threshold: confidence >= 0.7 → auto-match, < 0.7 → flag for review
  - Normalize names before matching (lowercase, remove extra spaces, remove common suffixes)

## 9.3 Provider Configuration

- [x] **T-230**: Create AI provider factory in `backend/app/integrations/ai/__init__.py`:
  - Read `OCR_PROVIDER` and `LLM_PROVIDER` from config
  - Return correct implementation instance
  - FastAPI dependency: `get_ocr()`, `get_extractor()`, `get_matcher()`
- [x] **T-231**: Write tests:
  - Mock OCR → feed real TP text → extraction returns correct JSON
  - Fuzzy matching: "Royal Stag Whisky 750ml" matches "Royal Stag 750" with high confidence
  - Provider swap: change env var → different implementation used

**✅ Stage 9 Exit Criteria**: All three interfaces defined with at least one implementation each. Tests pass with mock data. Providers swappable via config.

---

# Stage 10 — TP Processing

> **Goal**: End-to-end TP upload → AI → review → approve → ledger.

## 10.1 TP Upload

- [x] **T-240**: Create `backend/app/services/tp_service.py`:
  - `upload_tp(file, user)`:
    1. Validate file type (JPG, PNG, PDF) and size (< 20MB)
    2. Upload to S3 → get URL
    3. Create TPReceipt (status: PROCESSING)
    4. Enqueue Celery task for OCR + extraction
    5. Return tp_receipt_id
- [x] **T-241**: Create `backend/app/api/v1/tp.py`:
  - `POST /api/v1/tp/upload` — Upload TP file (Manager, Admin)
  - `GET /api/v1/tp/receipts` — List all TP receipts with filters (status, date range). Paginated. (Manager, Admin)
  - `GET /api/v1/tp/receipts/{id}` — Get single TP receipt with lines, MRP flags, duplicate warning (Manager, Admin)
  - `PUT /api/v1/tp/receipts/{id}/lines` — Edit lines before approval (Manager, Admin)
  - `POST /api/v1/tp/receipts/{id}/approve` — Approve and create movements (Manager, Admin)
  - `POST /api/v1/tp/receipts/{id}/reject` — Reject TP (Manager, Admin)

## 10.2 Background Processing Pipeline

- [x] **T-245**: Create `backend/app/workers/tp_processing.py` — Celery task chain:
  - **Task 1: OCR** — Download file from S3 → send to OCR provider → store raw text in tp_receipts.ocr_raw_text → update status
  - **Task 2: Extraction** — Send raw text to LLM → parse structured JSON → store in tp_receipts.extracted_data
  - **Task 3: Product Matching** — For each extracted product name → fuzzy match against catalog → create TPReceiptLine records
  - **Task 4: Validation** — Check TP number duplicate → set flag. Compare MRPs → create MRPChangeRequests for mismatches. Convert case quantities to bottles.
  - **Final**: Update TPReceipt status → DRAFT
  - **Error handling**: On any task failure → update status to FAILED with error message → log error
- [x] **T-246**: Implement case-to-bottle conversion logic:
  - For each TPReceiptLine: `total_bottles = (quantity_cases × product.case_size) + quantity_bottles`
  - If case_size not set on product → flag for manual input during review

## 10.3 MRP Mismatch Handling

- [x] **T-250**: Create `backend/app/services/mrp_service.py`:
  - `detect_mismatches(tp_receipt_id)`:
    - For each matched line: compare extracted_mrp vs product.mrp
    - If different → create MRPChangeRequest (PENDING)
  - `approve_mrp_change(request_id, user)`:
    - Update product.mrp to new_mrp
    - Create MRPHistory record
    - Update MRPChangeRequest status → APPROVED
    - Log audit
  - `reject_mrp_change(request_id, user)`:
    - Update MRPChangeRequest status → REJECTED
    - Log audit
- `[x]` **T-251**: Create API endpoints:
  - `GET /api/v1/mrp/pending` — List pending MRP change requests (Admin)
  - `POST /api/v1/mrp/{id}/approve` — Approve MRP change (Admin)
  - `POST /api/v1/mrp/{id}/reject` — Reject MRP change (Admin)

## 10.4 TP Approval & Ledger Entry

- [x] **T-255**: In `tp_service.py` — `approve_receipt(tp_receipt_id, user)`:
  1. Validate all lines have matched products (or manually assigned)
  2. Validate no unresolved issues (e.g., unknown products without mapping)
  3. For each TPReceiptLine:
     - Create PURCHASE StockMovement: product_id, quantity = total_bottles, batch_number, reference_id = tp_receipt_id
  4. Update TPReceipt: status → APPROVED, approved_by, approved_at
  5. Invalidate inventory cache for all affected products
  6. Log audit
- `[x]` **T-256**: TP duplicate check:
  - In tp_service.py: query `tp_receipts` WHERE tp_number = X AND business_id = Y AND status != REJECTED
  - If found → add `duplicate_warning: true` flag + link to existing receipt
  - Warning only, not blocking

## 10.5 Frontend — TP Screens

- `[x]` **T-260**: Create `frontend/src/app/(dashboard)/tp/upload/page.tsx`:
  - File upload area (drag & drop, click to browse)
  - Accept: .jpg, .png, .pdf
  - Show upload progress
  - After upload → show "Processing..." with spinner
  - When done → redirect to review page
- `[x]` **T-261**: Create `frontend/src/app/(dashboard)/tp/[id]/review/page.tsx`:
  - Show TP metadata: TP number, supplier, date, file preview (thumbnail)
  - **Duplicate TP Warning**: yellow banner at top if TP number exists (link to previous)
  - **Products Table**: extracted_name → matched product → confidence badge (green/yellow/red) → quantity (cases/bottles/total) → batch number → extracted MRP
  - **MRP Mismatch Alerts**: highlighted rows where extracted MRP ≠ DB MRP. Show old vs new. Approve/Reject buttons per row.
  - **Unmatched Products**: rows with low confidence → product search dropdown to manually assign
  - **Edit**: all fields editable (quantity, product match, batch number)
  - **Approve Button**: big green button at bottom → confirm dialog → approve → redirect to receipt list
  - **Reject Button**: red text button → confirm → reject
- `[x]` **T-262**: Create `frontend/src/app/(dashboard)/tp/page.tsx`:
  - TP receipt list: TP Number, Supplier, Date, Status (badge: Processing/Draft/Approved/Rejected), Products Count
  - Filters: status, date range
  - Click row → navigate to review page
  - "Upload TP" button at top
- `[x]` **T-263**: Create `frontend/src/components/tp/mrp-mismatch-alert.tsx`:
  - Alert component: shows product name, current MRP, new MRP, difference
  - Approve / Reject buttons
  - Updates immediately on click
- `[x]` **T-264**: Create `frontend/src/components/tp/tp-duplicate-warning.tsx`:
  - Yellow warning banner: "TP Number {X} was previously processed on {date}. Click to view."
  - Link to previous TP receipt

## 10.6 Testing

- `[x]` **T-270**: Write integration test: Upload sample TP → OCR mock → extraction mock → product matching → draft created with correct lines
- `[x]` **T-271**: Test MRP mismatch: product MRP = 500, TP MRP = 550 → MRPChangeRequest created → approve → product MRP = 550
- `[x]` **T-272**: Test duplicate TP: upload same TP number twice → warning shown on second
- `[x]` **T-273**: Test approval: approve draft → PURCHASE movements created → inventory increases by correct amounts
- `[x]` **T-274**: Test case conversion: TP says "5 cases" + product case_size = 12 → total_bottles = 60

**✅ Stage 10 Exit Criteria**: TP upload → AI processing → review screen → MRP alerts → approve → inventory updated. All flows work end-to-end.

---

# Stage 11 — SCM Engine

> **Goal**: Generate SCM-ready records with state excise codes, exportable.

## 11.1 SCM Summary Table & Aggregator

- `[-]` **T-280**: Create `backend/app/models/scm_summary.py`: (SKIPPED: Generated dynamically on the fly for better accuracy and speed)
- `[-]` **T-281**: Create Alembic migration for scm_summary table. (SKIPPED)
- `[x]` **T-282**: Create `backend/app/services/scm_service.py`:
  - `get_scm_report(start_date, end_date, business_id)`: Generates full Opening, Purchases, Sales, Returns, Damage, and Closing dynamically via single SQL aggregate query on the stock ledger.

## 11.2 SCM Celery Job

- `[-]` **T-285**: Create `backend/app/workers/scm_aggregation.py`: (SKIPPED by user request - kept for future scope)

## 11.3 SCM Export

- `[x]` **T-288**: Create `backend/app/services/scm_export_service.py`:
  - Utilized existing `excel_export.py` to generate styled Excel with grouped categories.

## 11.4 SCM API

- `[x]` **T-290**: Create `backend/app/api/v1/scm.py`:
  - `GET /api/v1/scm/report?start_date=X&end_date=Y` — Get SCM summary for date range (Admin)
  - `GET /api/v1/scm/export?start_date=X&end_date=Y` — Download Excel (Admin)

## 11.5 SCM Frontend

- `[x]` **T-295**: Create `frontend/src/app/(dashboard)/scm/page.tsx`:
  - Date picker (single date or date range)
  - Category filter (dropdown)
  - SCM table: SCM Code, Product Name, Category, Size, Opening, Purchase, Sale, Return, Damage, Closing
  - Grouped by category with subtotals
  - "Export Excel" button → downloads file
- `[x]` **T-296**: Create `frontend/src/components/scm/scm-table.tsx`: (Integrated directly into page.tsx)

## 11.6 Testing

- `[x]` **T-298**: Write test: Create opening (100) → sell 10 → purchase 50 → damage 2 → generate SCM for date → verify: opening=100, purchase=50, sale=10, damage=2, return=0, closing=138
- `[x]` **T-299**: Write test: Day 1 closing = Day 2 opening
- `[x]` **T-300**: Write test: Export Excel → open file → data matches SCM table

**✅ Stage 11 Exit Criteria**: Dynamic SCM aggregation works. SCM view shows correct data grouped by category. Excel export downloadable and perfectly formatted.

---

# Stage 12 — PWA & Mobile Optimization

> **Goal**: App installable on phone, responsive design, basic offline tolerance.

## 12.1 Responsive Design Polish

- [ ] **T-310**: Audit all screens for mobile responsiveness:
  - Dashboard → single column on mobile, cards stack vertically
  - Product list → responsive table or card layout on mobile
  - TP review → scrollable table with sticky first column
  - SCM table → horizontal scroll with sticky first column
  - Sale/Return/Damage → full-screen camera, bottom sheet for product card
- [ ] **T-311**: Implement mobile bottom navigation bar:
  - 4 tabs: Dashboard, Sale, TP, More (Settings, Reports, SCM, etc.)
  - Active tab highlighted
  - Hides on desktop (sidebar used instead)
- [ ] **T-312**: Touch optimization:
  - All buttons minimum 44px tap target
  - Adequate spacing between interactive elements
  - Pull-to-refresh on list screens
  - Swipe gestures where appropriate

## 12.2 PWA Setup

- [ ] **T-315**: Create `frontend/public/manifest.json`:
  - App name: "Bharat Wines"
  - Short name: "BW"
  - Theme color, background color
  - Icons: 192x192, 512x512
  - Display: standalone
  - Start URL: /
- [ ] **T-316**: Create service worker (via `next-pwa` or custom):
  - Cache static assets (JS, CSS, fonts, images)
  - Cache API responses for product catalog (stale-while-revalidate)
  - Network-first strategy for stock movements and TP
- [ ] **T-317**: Add "Install App" prompt:
  - Show banner on first 3 visits: "Install Bharat Wines for faster access"
  - "Install" button triggers `beforeinstallprompt`
  - Dismiss button hides for 7 days
- [ ] **T-318**: Generate PWA icons (192x192, 512x512) with Bharat Wines branding.

## 12.3 Offline Tolerance

- [ ] **T-320**: Cache product catalog locally (IndexedDB or service worker cache):
  - Barcode → product mapping available offline
  - Product search works offline (searches local cache)
- [ ] **T-321**: Queue stock movements when offline:
  - If POST /movements fails due to network → store in IndexedDB queue
  - Show "Offline — movement queued" toast
  - When back online → sync queue → POST each movement → clear queue
  - Show "Synced X movements" toast on success
- [ ] **T-322**: Show offline indicator:
  - Banner at top: "You are offline. Changes will sync when connected."
  - Color: yellow/amber

## 12.4 Final Testing

- [ ] **T-325**: Test PWA install on Android Chrome → launches from home screen → full screen
- [ ] **T-326**: Test PWA install on iOS Safari → launches from home screen → full screen
- [ ] **T-327**: Test offline: turn off network → scan barcode → movement queued → turn on network → movement synced
- [ ] **T-328**: Test all screens on phone (375px width) → no horizontal overflow, usable UI
- [ ] **T-329**: Test all screens on tablet (768px width) → proper layout
- [ ] **T-330**: Performance audit: Lighthouse score > 90 for Performance, Accessibility, Best Practices, PWA

**✅ Stage 12 Exit Criteria**: PWA installable. All screens responsive. Offline scanning queues and syncs. Lighthouse score > 90.

---

# Stage 13 — Final Polish & Deployment

> **Goal**: Production deployment, final QA, documentation.

## 13.1 Production Deployment

- [ ] **T-340**: Set up production AWS infrastructure:
  - RDS PostgreSQL (db.t3.medium or equivalent)
  - ElastiCache Redis
  - S3 bucket for file storage
  - ECS or EC2 for backend + worker
  - Vercel or ECS for frontend (or serve via Nginx)
- [ ] **T-341**: Configure production environment variables (.env.production)
- [ ] **T-342**: Set up SSL/TLS certificate (Let's Encrypt or ACM)
- [ ] **T-343**: Configure domain and DNS
- [ ] **T-344**: Set up GitHub Actions deploy pipeline (deploy on merge to main)
- [ ] **T-345**: Configure database backups:
  - Daily pg_dump to S3
  - WAL archiving for point-in-time recovery
  - Test restore from backup

## 13.2 Monitoring & Observability

- [ ] **T-348**: Set up Sentry for error tracking (backend + frontend)
- [ ] **T-349**: Add structured logging (structlog) to all services
- [ ] **T-350**: Create health check dashboard / monitoring alerts:
  - API response time > 5s → alert
  - Error rate > 5% → alert
  - Database connections exhausted → alert
  - Celery queue backlog > 10 → alert

## 13.3 Documentation

- [ ] **T-355**: Write API documentation (auto-generated from FastAPI + manual notes)
- [ ] **T-356**: Write user guide: Getting Started (register, import opening stock, first sale)
- [ ] **T-357**: Write admin guide: User management, TP processing, SCM export

## 13.4 Final QA

- [ ] **T-360**: End-to-end happy path test:
  1. Register business
  2. Import opening inventory from Excel
  3. Map barcodes to products
  4. Scan sale → inventory decreases
  5. Scan return → inventory increases
  6. Upload TP → AI processes → review → handle MRP mismatch → approve → inventory increases
  7. Generate SCM → export Excel → verify totals
  8. View dashboard → all widgets show correct data
  9. View revenue report → totals match
- [ ] **T-361**: Edge case testing:
  - Sell more than available stock (should it allow or block?) — document decision
  - Upload empty Excel → proper error
  - Upload TP with no recognizable products → all flagged for manual review
  - Extremely long product name → UI handles gracefully
  - Concurrent sales from two devices → inventory stays consistent
- [ ] **T-362**: Security testing:
  - SQL injection attempts → blocked
  - JWT manipulation → rejected
  - CORS violations → blocked
  - Rate limiting → enforced
- [ ] **T-363**: Performance testing:
  - 1000 products, 100K movements → inventory query < 2s
  - 50 concurrent scan requests → all succeed < 500ms
  - SCM generation for 1000 products → < 60s

**✅ Stage 13 Exit Criteria**: Production deployed. Monitoring active. Documentation complete. Full QA passed.

---

# 📊 Task Summary

| Stage | Tasks | Description |
|---|---|---|
| Stage 0 | T-001 → T-005 | Architecture Decisions |
| Stage 1 | T-010 → T-038 | Project Skeleton |
| Stage 2 | T-040 → T-075 | Platform Layer (Auth, RBAC, Tenant, Audit) |
| Stage 3 | T-080 → T-102 | Domain Layer (Entities, CRUD APIs) |
| Stage 4 | T-110 → T-127 | Inventory Engine |
| Stage 5 | T-130 → T-141 | Import Framework |
| Stage 6 | T-150 → T-164 | Product Catalog |
| Stage 7 | T-170 → T-189 | Scanner Integration |
| Stage 8 | T-200 → T-215 | Reporting Layer |
| Stage 9 | T-220 → T-231 | AI Foundation |
| Stage 10 | T-240 → T-274 | TP Processing |
| Stage 11 | T-280 → T-300 | SCM Engine |
| Stage 12 | T-310 → T-330 | PWA & Mobile |
| Stage 13 | T-340 → T-363 | Polish & Deployment |

**Total: ~150 tasks across 14 stages**

---

# 🏷️ Task Tracking Legend

```
[ ] — Not started
[/] — In progress
[x] — Completed
[!] — Blocked (add reason in notes)
```

> **Rule**: Complete ALL tasks in a stage before moving to the next stage. The exit criteria at the end of each stage must be verified before proceeding.
