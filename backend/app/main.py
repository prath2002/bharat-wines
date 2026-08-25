from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from app.integrations.redis import init_redis, close_redis

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic here
    await init_redis()
    yield
    # Shutdown logic here
    await close_redis()

app = FastAPI(
    title="Bharat Wines API",
    version="0.1.0",
    lifespan=lifespan,
)

from app.api.v1 import auth, audit_logs, products, barcodes, movements, inventory, reports, imports, unknown_barcodes, tp, mrp, scm, users, bills, vendors, payment_schedules, payment_approvals, documents, finance

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # TODO: Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(audit_logs.router, prefix="/api/v1/audit-logs", tags=["Audit Logs"])
app.include_router(products.router, prefix="/api/v1/products", tags=["Products"])
app.include_router(barcodes.router, prefix="/api/v1", tags=["Barcodes"])
app.include_router(movements.router, prefix="/api/v1/movements", tags=["Movements"])
app.include_router(inventory.router, prefix="/api/v1/inventory", tags=["Inventory"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["Reports"])
app.include_router(imports.router, prefix="/api/v1/imports", tags=["Imports"])
app.include_router(unknown_barcodes.router, prefix="/api/v1/unknown-barcodes", tags=["Unknown Barcodes"])
app.include_router(tp.router, prefix="/api/v1/tp", tags=["Transport Permits"])
app.include_router(mrp.router, prefix="/api/v1/mrp", tags=["MRP Changes"])
app.include_router(scm.router, prefix="/api/v1/scm", tags=["SCM"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(bills.router, prefix="/api/v1/bills", tags=["Bills"])
app.include_router(vendors.router, prefix="/api/v1/vendors", tags=["Vendors"])
app.include_router(payment_schedules.router, prefix="/api/v1", tags=["Payment Schedules"])
app.include_router(payment_approvals.router, prefix="/api/v1", tags=["Payment Approvals"])
app.include_router(documents.router, prefix="/api/v1", tags=["Documents"])
app.include_router(finance.router, prefix="/api/v1/finance", tags=["Finance Views"])

import os
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok"}

@app.get("/ready", tags=["Health"])
async def ready_check():
    # TODO: Add DB and Redis checks
    return {"status": "ready"}
