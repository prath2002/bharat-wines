import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permissions
from app.db.session import get_db
from app.models.user import User
from app.schemas.finance_views import CalendarDay, OverdueBillItem, PaymentHistoryItem, PendingBillItem
from app.services import finance_views_service
from app.services.finance_dashboard_service import get_finance_summary
from app.utils.excel_export import generate_excel

router = APIRouter()

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

def _xlsx_response(headers: list[str], rows: list[list], sheet_name: str, filename: str) -> Response:
    return Response(
        content=generate_excel(headers, rows, sheet_name=sheet_name),
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )

@router.get("/pending-bills", response_model=list[PendingBillItem])
async def pending_bills(
    vendor_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("finance.dashboard"))
):
    return await finance_views_service.get_pending_bills(db, current_user.business_id, vendor_id)

@router.get("/overdue-bills", response_model=list[OverdueBillItem])
async def overdue_bills(
    vendor_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("finance.dashboard"))
):
    return await finance_views_service.get_overdue_bills(db, current_user.business_id, vendor_id)

@router.get("/payment-calendar", response_model=list[CalendarDay])
async def payment_calendar(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    vendor_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("finance.dashboard"))
):
    return await finance_views_service.get_payment_calendar(db, current_user.business_id, date_from, date_to, vendor_id)

@router.get("/payment-history", response_model=list[PaymentHistoryItem])
async def payment_history(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    vendor_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("finance.dashboard"))
):
    return await finance_views_service.get_payment_history(db, current_user.business_id, date_from, date_to, vendor_id)

@router.get("/reports/pending-bills/export")
async def export_pending_bills(
    vendor_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("finance.dashboard"))
):
    items = await finance_views_service.get_pending_bills(db, current_user.business_id, vendor_id)
    headers = ["Bill Number", "Vendor", "Total Amount", "Outstanding", "Due Date", "Days Remaining", "Status"]
    rows = [[i["bill_number"], i["vendor_name"], i["total_amount"], i["outstanding"],
             i["due_date"].isoformat() if i["due_date"] else "", i["days_remaining"], i["payment_status"].value]
            for i in items]
    return _xlsx_response(headers, rows, "Pending Bills", "pending_bills.xlsx")

@router.get("/reports/overdue-bills/export")
async def export_overdue_bills(
    vendor_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("finance.dashboard"))
):
    items = await finance_views_service.get_overdue_bills(db, current_user.business_id, vendor_id)
    headers = ["Bill Number", "Vendor", "Total Amount", "Outstanding", "Due Date", "Days Overdue", "Status"]
    rows = [[i["bill_number"], i["vendor_name"], i["total_amount"], i["outstanding"],
             i["due_date"].isoformat(), i["days_overdue"], i["payment_status"].value]
            for i in items]
    return _xlsx_response(headers, rows, "Overdue Bills", "overdue_bills.xlsx")

@router.get("/reports/payment-history/export")
async def export_payment_history(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    vendor_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("finance.dashboard"))
):
    items = await finance_views_service.get_payment_history(db, current_user.business_id, date_from, date_to, vendor_id)
    headers = ["Bill Number", "Vendor", "Amount", "Paid On", "Method", "Reference"]
    rows = [[i["bill_number"], i["vendor_name"], i["amount"], i["paid_on"].isoformat(),
             i["method"].value, i["reference"] or ""]
            for i in items]
    return _xlsx_response(headers, rows, "Payment History", "payment_history.xlsx")

@router.get("/reports/scheduled-payments/export")
async def export_scheduled_payments(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    vendor_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("finance.dashboard"))
):
    days = await finance_views_service.get_payment_calendar(db, current_user.business_id, date_from, date_to, vendor_id)
    headers = ["Scheduled Date", "Bill Number", "Vendor", "Amount", "Status"]
    rows = [[day["scheduled_date"].isoformat(), item["bill_number"], item["vendor_name"], item["amount"], item["status"]]
            for day in days for item in day["items"]]
    return _xlsx_response(headers, rows, "Scheduled Payments", "scheduled_payments.xlsx")

@router.get("/reports/vendor-wise/export")
async def export_vendor_wise(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("finance.dashboard"))
):
    summary = await get_finance_summary(db, current_user.business_id, date_from, date_to)
    headers = ["Vendor", "Billed", "Paid", "Outstanding", "Bill Count", "Last Bill Date", "Oldest Unpaid Days"]
    rows = [[v["name"], v["billed"], v["paid"], v["outstanding"], v["bill_count"],
             v["last_bill_date"] or "", v["oldest_unpaid_days"]]
            for v in summary["vendors"]]
    return _xlsx_response(headers, rows, "Vendor-wise Payments", "vendor_wise_payments.xlsx")

@router.get("/reports/monthly/export")
async def export_monthly(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("finance.dashboard"))
):
    summary = await get_finance_summary(db, current_user.business_id, date_from, date_to)
    headers = ["Month", "Billed", "Paid"]
    rows = [[m["month"], m["billed"], m["paid"]] for m in summary["monthly"]]
    return _xlsx_response(headers, rows, "Monthly Payments", "monthly_payments.xlsx")

@router.get("/reports/aging/export")
async def export_aging(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("finance.dashboard"))
):
    summary = await get_finance_summary(db, current_user.business_id)
    headers = ["Bucket", "Outstanding Amount"]
    rows = [[bucket, amount] for bucket, amount in summary["aging"].items()]
    return _xlsx_response(headers, rows, "Payables Aging", "payables_aging.xlsx")
