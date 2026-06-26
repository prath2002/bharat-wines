# PRODUCT REQUIREMENTS DOCUMENT (PRD)

## Product Name

Bharat Wines — Liquor Inventory & SCM Automation Platform

---

## Vision

Enable FL-2 liquor retailers in India to manage inventory using barcode scanning (web-based), automate TP ingestion using AI, generate SCM-ready stock records with state excise codes, and provide real-time inventory visibility — all accessible from a phone browser.

---

## Scope — V1

| In Scope | Out of Scope (Future) |
|---|---|
| FL-2 license type only | Other license types (FL-3, CL-2, etc.) |
| Single-state operation | Multi-state support |
| Inventory tracking (bottles) | Financial module (VAT, P&L, supplier ledger) |
| Retroactive revenue calculation | Real-time billing / invoice generation |
| Web-based barcode scanning | Hardware scanner integration |
| TP processing with AI | Bill photo upload & cost extraction |
| SCM export | Reconciliation engine |
| MRP tracking & mismatch alerts | Customer loyalty / CRM |
| Batch number tracking | Notification system (WhatsApp, etc.) |

---

## Core Problems

| # | Problem | Impact |
|---|---|---|
| 1 | Manual stock entry in registers | Hours of daily effort, human errors |
| 2 | Manual TP processing | Slow purchase recording, missed entries |
| 3 | SCM reporting done by hand | Risk of excise compliance violations |
| 4 | Inventory mismatches go undetected | Financial loss, excise audit risk |
| 5 | No audit trail for stock movements | Cannot trace discrepancies |
| 6 | Owner has no real-time visibility | Must be physically present to know stock status |

---

## Primary Goals

1. Track all stock movements using barcode scans (web camera or manual entry).
2. Maintain real-time inventory derived from an immutable stock ledger.
3. Automate TP data extraction using AI (OCR + LLM).
4. Detect MRP changes from TPs and alert owner for approval.
5. Generate SCM-ready daily records using state excise codes.
6. Provide owner visibility via mobile-responsive web app (PWA).
7. Convert TP case quantities to bottle quantities automatically.

---

## User Types & Permissions

### Admin (Owner)

| Capability | Details |
|---|---|
| Business management | Full system access |
| User management | Create/disable users, assign roles |
| Approvals | TP receipt approval, MRP change approval |
| Reports | All reports, SCM exports, revenue calculations |
| Product management | Create, edit, delete products |

### Stock Manager

| Capability | Details |
|---|---|
| TP processing | Upload TP, review AI extraction, submit for approval |
| Product mapping | Map barcodes to products, manage unknown barcodes |
| Inventory views | View current stock, movement history |

### Staff

| Capability | Details |
|---|---|
| Sale scans | Scan barcode or enter manually to record SALE |
| Return scans | Scan barcode or enter manually to record RETURN |
| Damage entries | Scan barcode or enter manually to record DAMAGE |
| Quantity entry | Enter quantity (default = 1), supports multiples |

> [!NOTE]
> **Financial Manager** role is defined but deferred to the financial module in a future iteration.

---

## Product Model

Each product is a **unique combination of brand name + size**. There are no parent-child or variant relationships.

Example: "Royal Stag 750ml" and "Royal Stag 180ml" are **two separate products**.

### Product Attributes

| Attribute | Required | Source | Notes |
|---|---|---|---|
| Product Name (Brand + Bottle Name) | ✅ | Manual / TP / Opening File | Combined field |
| Category | ✅ | Manual / Opening File | IMFL, MML, CL, Wine, Beer |
| Size / Volume | ✅ | Manual / Opening File | 750ml, 375ml, 180ml, 90ml, etc. |
| MRP | ✅ | Opening File / TP (with alert) | Government-controlled, per bottle per size |
| SCM Code (State Excise Code) | ✅ | Opening File | Official state excise product code, used in SCM reporting |
| Barcode(s) | Optional | Barcode scan | One product → multiple barcodes |
| Batch Number(s) | Via TP | TP extraction | Same product can have multiple batch numbers |
| Status | ✅ | System | Active / Inactive |

### Barcode Rules

- One product can have **multiple barcodes** (packaging changes, MRP changes, manufacturer codes).
- Barcode → Product lookup must be fast (< 200ms).
- Unknown barcodes go to a **review queue** for manual mapping.

### Category Hierarchy

```text
Category (Level 1)
├── IMFL (Indian Made Foreign Liquor)
├── MML (Medium Made Liquor)  
├── CL (Country Liquor)
├── Wine
└── Beer
```

Sub-categories (Whiskey, Vodka, Rum, Gin, etc.) can be added later as an optional field.

---

## Core Workflows

### 1. Business Registration

**Trigger**: New business signs up.

**Output**:
- Business workspace created
- Admin user created
- Default roles provisioned (Admin, Stock Manager, Staff)

---

### 2. Opening Inventory Import

**Trigger**: First-time setup or new fiscal period.

**Input**: Excel file containing:

| Column | Description |
|---|---|
| Product Name | Brand + bottle name |
| Category | IMFL / MML / CL / Wine / Beer |
| Size | Volume in ml |
| MRP | Current MRP per bottle |
| SCM Code | State excise product code |
| Opening Quantity | Stock count in bottles |

**Process**:
1. Upload Excel file.
2. System validates format and required columns.
3. System creates products (or matches to existing).
4. System creates OPENING stock movements for each product.
5. Inventory is initialized.

**Output**:
- Product catalog populated with SCM codes and MRPs
- Opening inventory recorded in ledger

---

### 3. Product Master Creation

**Sources** (in order of typical usage):
1. Opening Inventory Excel (bulk)
2. TP Processing (auto-discovery of new products)
3. Manual Product Creation (one-off)

**Output**: Product Catalog with all required attributes.

---

### 4. Barcode Mapping

**Input**: Product + Barcode scan (via web camera or manual entry)

**Process**:
1. Staff/Manager scans a barcode.
2. System checks if barcode is already mapped.
3. If unmapped → prompt to select product from catalog.
4. Save Product ↔ Barcode relationship.

**Rules**:
- Multiple barcodes per product: ✅
- Same barcode on multiple products: ❌ (must be unique)

**Output**: Product ↔ Barcode mapping stored.

---

### 5. Sale Workflow

**Trigger**: Customer purchases bottles.

**Process**:
1. Staff opens Sale Screen.
2. Staff scans barcode (web camera) OR searches product manually.
3. System resolves product from barcode.
4. Staff confirms quantity (default = 1, can enter multiples).
5. System creates SALE stock movement.
6. Inventory updates in real-time (derived from ledger).

**Data Recorded**:
- Product ID
- Quantity (bottles)
- Timestamp
- User (staff) who recorded it
- Movement type: SALE

**Revenue Calculation** (retroactive, not per-transaction):
> "Show me revenue for last 10 days" → System calculates: `Σ (quantity sold × MRP at time of sale)` for each product in the date range.

**Output**: Stock Movement (SALE) in ledger.

---

### 6. Return Workflow

**Trigger**: Customer returns bottles.

**Process**: Same as Sale Workflow but movement type = RETURN.

**Rules**:
- Staff can record directly — **no approval needed**.
- Return increases inventory.

**Output**: Stock Movement (RETURN) in ledger.

---

### 7. Damage Workflow

**Trigger**: Bottle damaged on premises.

**Process**: Same as Sale Workflow but movement type = DAMAGE.

**Rules**:
- Staff can record directly — **no approval needed**.
- Damage decreases inventory.
- Optional: Reason/notes field for damage.

**Output**: Stock Movement (DAMAGE) in ledger.

---

### 8. TP Processing Workflow

**Trigger**: New Transport Permit received with goods delivery.

> [!IMPORTANT]
> Upload implies goods have been **physically verified**. No separate verification step in the system.

**Process**:

```text
Step 1: Upload TP (image/PDF)
         ↓
Step 2: AI Pipeline
         ├── OCR → raw text
         ├── LLM Extraction → structured data
         └── Product Matching → map to catalog
         ↓
Step 3: System Checks
         ├── TP Number Duplicate Check
         │    └── ⚠️ WARN if TP number already exists in DB
         ├── MRP Mismatch Check (per product)
         │    └── 🔔 ALERT if extracted MRP ≠ DB MRP
         └── Case-to-Bottle Conversion
              └── Convert case quantities to bottles
         ↓
Step 4: Draft Purchase Receipt
         ├── Products with quantities (in bottles)
         ├── Batch numbers per product
         ├── MRP mismatch flags (if any)
         └── TP metadata (number, supplier, date)
         ↓
Step 5: MRP Change Resolution (if applicable)
         ├── Owner reviews MRP changes
         ├── Approve → system updates MRP in product master
         └── Reject → keep existing MRP
         ↓
Step 6: Approval (by Stock Manager or Owner)
         ↓
Step 7: Ledger Entry
         └── Create PURCHASE stock movements for each product
```

**AI Extraction Fields**:

| Field | Description |
|---|---|
| TP Number | Unique identifier |
| Supplier Name | Source of goods |
| Date | TP date |
| Products | List of product names |
| Quantities | Cases and/or bottles per product |
| MRP | Per product (compared against DB) |
| Batch Numbers | Per product line (multiple batches possible for same product) |

**Key Rules**:
- TPs processed **one at a time**.
- TP number must trigger **warning** (not block) if duplicate found.
- Case quantities **auto-converted** to bottles.
- Same product can appear with **different batch numbers** in one TP.

**Output**:
- Purchase receipt record
- PURCHASE stock movements in ledger
- MRP updates (if approved)

---

### 9. SCM Workflow

**Trigger**: Nightly aggregation (automated) or on-demand.

**Calculation per product per day**:

```text
Opening Stock (previous day's closing)
+ Purchases (from approved TPs)
+ Returns
- Sales
- Damage
+ Adjustments
= Closing Stock
```

**Output Format**:

| Column | Description |
|---|---|
| SCM Code | State excise product code |
| Product Name | Brand + bottle name |
| Category | IMFL / MML / CL / Wine / Beer |
| Size | Volume |
| Opening | Opening stock (bottles) |
| Purchase | Purchases (bottles) |
| Sale | Sales (bottles) |
| Return | Returns (bottles) |
| Damage | Damage (bottles) |
| Closing | Closing stock (bottles) |

**Export**: Downloadable Excel/PDF, formatted for excise submission.

---

## Reports (V1)

| Report | Description | Audience |
|---|---|---|
| Current Inventory | Real-time stock per product | All roles |
| Movement History | All stock movements with filters (date, type, product) | Manager, Owner |
| Daily Summary | Day's sales, purchases, returns, damage | Owner |
| Revenue Report | Retroactive: quantity × MRP for a date range | Owner |
| Low Stock Alert | Products below a configurable threshold | Manager, Owner |
| SCM Report | Daily opening/closing with excise codes | Owner |
| Product Catalog | All products with attributes, barcodes, MRPs | Manager, Owner |

---

## Future Scope (Not in V1)

| Feature | Notes |
|---|---|
| Financial Module | VAT, bill photo upload, cost extraction, supplier ledger, P&L |
| Reconciliation Engine | Physical vs system stock comparison |
| Hardware Scanner Support | Dedicated barcode scanner devices |
| Multi-State / Multi-License | Support beyond FL-2 |
| Notification System | In-app, push, WhatsApp alerts |
| Multi-Language (i18n) | Hindi, regional languages |
| Customer Tracking | CRM, loyalty |
| Expense Tracking | Rent, salary, operational costs |
| Sub-Categories | Whiskey, Vodka, Rum, Gin, etc. |
