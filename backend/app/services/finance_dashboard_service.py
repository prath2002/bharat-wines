import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.bill import Bill, BillStatus
from app.models.payment_approval import ApprovalStatus, PaymentApproval
from app.models.payment_schedule import PaymentSchedule, PaymentScheduleStatus


def _d(value) -> Decimal:
    return Decimal(str(value)) if value is not None else Decimal("0")

def _month_key(d) -> str:
    return f"{d.year:04d}-{d.month:02d}"

def _bill_effective_date(bill: Bill) -> date:
    return bill.bill_date or bill.created_at.date()

def _in_range(d: date, date_from: date | None, date_to: date | None) -> bool:
    if date_from and d < date_from:
        return False
    return not (date_to and d > date_to)

async def get_finance_summary(
    db: AsyncSession,
    business_id: uuid.UUID,
    date_from: date | None = None,
    date_to: date | None = None,
    vendor_id: uuid.UUID | None = None,
) -> dict:
    """
    Aggregates verified bills + settlements for the finance dashboard.
    Computed in Python over one eager-loaded query: bill volumes per business
    are small (hundreds/month), and this keeps Decimal math exact and the
    grouping logic (per-vendor + per-month + attention lists) in one pass.
    """
    stmt = (
        select(Bill)
        .options(selectinload(Bill.settlements), selectinload(Bill.vendor))
        .where(Bill.business_id == business_id, Bill.status != BillStatus.REJECTED)
    )
    if vendor_id:
        stmt = stmt.where(Bill.vendor_id == vendor_id)
    result = await db.execute(stmt)
    bills = result.scalars().all()
    summary = summarize_bills(bills, date_from, date_to)

    scheduled_stmt = select(func.count(), func.coalesce(func.sum(PaymentSchedule.amount), 0)).where(
        PaymentSchedule.business_id == business_id,
        PaymentSchedule.status.in_([PaymentScheduleStatus.SCHEDULED, PaymentScheduleStatus.APPROVED]),
    )
    approval_pending_stmt = select(func.count(), func.coalesce(func.sum(PaymentSchedule.amount), 0)).select_from(
        PaymentApproval
    ).join(PaymentSchedule, PaymentApproval.payment_schedule_id == PaymentSchedule.id).where(
        PaymentApproval.business_id == business_id, PaymentApproval.status == ApprovalStatus.PENDING
    )
    scheduled_count, scheduled_amount = (await db.execute(scheduled_stmt)).one()
    approval_pending_count, approval_pending_amount = (await db.execute(approval_pending_stmt)).one()

    summary["totals"]["scheduled_count"] = scheduled_count
    summary["totals"]["scheduled_amount"] = float(scheduled_amount)
    summary["totals"]["approval_pending_count"] = approval_pending_count
    summary["totals"]["approval_pending_amount"] = float(approval_pending_amount)
    return summary

def summarize_bills(bills, date_from: date | None = None, date_to: date | None = None) -> dict:
    """Pure aggregation over already-loaded bills (settlements + vendor eager-loaded)."""
    today = datetime.now(UTC).date()

    totals = {
        "billed": Decimal("0"), "paid": Decimal("0"), "outstanding": Decimal("0"), "payable": Decimal("0"),
        "discounts": Decimal("0"), "charges": Decimal("0"),
        "bill_count": 0, "awaiting_review": 0,
        "due_today": Decimal("0"), "due_this_week": Decimal("0"), "due_this_month": Decimal("0"),
    }
    payment_breakdown = {
        s: {"count": 0, "amount": Decimal("0")} for s in ("PAID", "PARTIALLY_PAID", "UNPAID")
    }
    aging = {"0-30": Decimal("0"), "31-60": Decimal("0"), "61-90": Decimal("0"), "90+": Decimal("0")}
    monthly: dict = {}
    vendors: dict = {}
    drafts = []
    overdue = []

    for bill in bills:
        if bill.status in (BillStatus.DRAFT, BillStatus.PROCESSING):
            totals["awaiting_review"] += 1
            if bill.status == BillStatus.DRAFT:
                drafts.append({
                    "id": str(bill.id),
                    "extracted_vendor_name": bill.extracted_vendor_name,
                    "total_amount": float(_d(bill.total_amount)),
                    "has_total_mismatch": bill.has_total_mismatch,
                    "created_at": bill.created_at.isoformat(),
                })
            continue

        # VERIFIED bills below
        eff_date = _bill_effective_date(bill)
        total = _d(bill.total_amount)
        paid_all_time = sum(_d(s.amount) for s in bill.settlements)
        outstanding = max(total - paid_all_time, Decimal("0"))

        # Range filters: "billed" series follows the bill date;
        # "paid" series follows each settlement's paid_on date.
        bill_in_range = _in_range(eff_date, date_from, date_to)
        settlements_in_range = [s for s in bill.settlements if _in_range(s.paid_on, date_from, date_to)]
        paid_in_range = sum(_d(s.amount) for s in settlements_in_range)

        if bill_in_range:
            totals["billed"] += total
            totals["discounts"] += sum(_d(d.get("amount", 0)) for d in (bill.discounts or []))
            totals["charges"] += sum(_d(c.get("amount", 0)) for c in (bill.charges or []))
            totals["bill_count"] += 1

            status_key = bill.payment_status.value
            payment_breakdown[status_key]["count"] += 1
            payment_breakdown[status_key]["amount"] += total

            month = _month_key(eff_date)
            monthly.setdefault(month, {"billed": Decimal("0"), "paid": Decimal("0")})
            monthly[month]["billed"] += total

        totals["paid"] += paid_in_range
        for s in settlements_in_range:
            month = _month_key(s.paid_on)
            monthly.setdefault(month, {"billed": Decimal("0"), "paid": Decimal("0")})
            monthly[month]["paid"] += _d(s.amount)

        # Outstanding is a point-in-time figure, not range-scoped
        totals["outstanding"] += outstanding
        totals["payable"] += outstanding

        if outstanding > 0 and bill.due_date:
            days_until_due = (bill.due_date - today).days
            if 0 <= days_until_due < 1:
                totals["due_today"] += outstanding
            if 0 <= days_until_due < 7:
                totals["due_this_week"] += outstanding
            if 0 <= days_until_due < 30:
                totals["due_this_month"] += outstanding

            if days_until_due < 0:
                days_overdue = -days_until_due
                if days_overdue <= 30:
                    aging["0-30"] += outstanding
                elif days_overdue <= 60:
                    aging["31-60"] += outstanding
                elif days_overdue <= 90:
                    aging["61-90"] += outstanding
                else:
                    aging["90+"] += outstanding

        # Vendor aggregation (bill-date scoped for billed, all-time for outstanding)
        vname = bill.vendor.name if bill.vendor else (bill.extracted_vendor_name or "Unknown")
        vkey = str(bill.vendor_id) if bill.vendor_id else f"unmatched:{vname}"
        v = vendors.setdefault(vkey, {
            "vendor_id": str(bill.vendor_id) if bill.vendor_id else None,
            "name": vname,
            "billed": Decimal("0"), "paid": Decimal("0"), "outstanding": Decimal("0"),
            "bill_count": 0, "last_bill_date": None, "oldest_unpaid_days": 0,
        })
        if bill_in_range:
            v["billed"] += total
            v["bill_count"] += 1
        v["paid"] += paid_in_range
        v["outstanding"] += outstanding
        if v["last_bill_date"] is None or eff_date.isoformat() > v["last_bill_date"]:
            v["last_bill_date"] = eff_date.isoformat()
        if outstanding > 0:
            age = (today - eff_date).days
            v["oldest_unpaid_days"] = max(v["oldest_unpaid_days"], age)

        if outstanding > 0 and bill.due_date and bill.due_date < today:
            overdue.append({
                "id": str(bill.id),
                "vendor_name": vname,
                "total_amount": float(total),
                "outstanding": float(outstanding),
                "due_date": bill.due_date.isoformat(),
                "days_overdue": (today - bill.due_date).days,
            })

    vendor_rows = sorted(
        (
            {**v, "billed": float(v["billed"]), "paid": float(v["paid"]), "outstanding": float(v["outstanding"])}
            for v in vendors.values()
        ),
        key=lambda v: v["outstanding"],
        reverse=True,
    )
    overdue.sort(key=lambda o: o["days_overdue"], reverse=True)
    drafts.sort(key=lambda d: d["created_at"], reverse=True)

    return {
        "totals": {
            "billed": float(totals["billed"]),
            "paid": float(totals["paid"]),
            "outstanding": float(totals["outstanding"]),
            "payable": float(totals["payable"]),
            "discounts": float(totals["discounts"]),
            "charges": float(totals["charges"]),
            "bill_count": totals["bill_count"],
            "awaiting_review": totals["awaiting_review"],
            "due_today": float(totals["due_today"]),
            "due_this_week": float(totals["due_this_week"]),
            "due_this_month": float(totals["due_this_month"]),
        },
        "payment_breakdown": {
            k: {"count": v["count"], "amount": float(v["amount"])} for k, v in payment_breakdown.items()
        },
        "aging": {k: float(v) for k, v in aging.items()},
        "monthly": [
            {"month": m, "billed": float(v["billed"]), "paid": float(v["paid"])}
            for m, v in sorted(monthly.items())
        ],
        "vendors": vendor_rows,
        "attention": {"drafts": drafts[:10], "overdue": overdue[:10]},
    }
