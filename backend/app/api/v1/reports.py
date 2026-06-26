import uuid
from typing import Optional, Dict, Any, List
from datetime import datetime
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.dependencies import get_current_user, require_permissions
from app.models.user import User
from app.services.inventory_service import InventoryService
from app.services.dashboard_service import DashboardService
from app.utils.excel_export import generate_excel
from fastapi.responses import Response

router = APIRouter()

@router.get("/dashboard-summary")
async def get_dashboard_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("reports.view"))
) -> Dict[str, Any]:
    dashboard_service = DashboardService(db, current_user.business_id)
    return await dashboard_service.get_summary_stats()

@router.get("/revenue")
async def get_revenue_report(
    start_date: datetime = Query(..., description="Start date for revenue calculation"),
    end_date: datetime = Query(..., description="End date for revenue calculation"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("reports.view"))
) -> Dict[str, Any]:
    if start_date > end_date:
        raise HTTPException(status_code=400, detail="start_date must be before end_date")
        
    inventory_service = InventoryService(db, current_user.business_id)
    report = await inventory_service.calculate_revenue(start_date, end_date)
    return report

@router.get("/revenue/export")
async def export_revenue_report(
    start_date: datetime = Query(..., description="Start date for revenue calculation"),
    end_date: datetime = Query(..., description="End date for revenue calculation"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("reports.view"))
):
    if start_date > end_date:
        raise HTTPException(status_code=400, detail="start_date must be before end_date")
        
    inventory_service = InventoryService(db, current_user.business_id)
    report = await inventory_service.calculate_revenue(start_date, end_date)
    
    headers = ["Product Name", "Category", "Size (ml)", "Qty Sold", "MRP", "Revenue"]
    rows = []
    
    # Process product revenue rows
    for item in report.get("breakdown", []):
        rows.append([
            item.get("product_name"),
            item.get("category", ""),
            item.get("size_ml"),
            item.get("quantity_sold"),
            item.get("mrp"),
            item.get("revenue")
        ])
    
    # Add Total row at the bottom
    rows.append(["", "", "", "TOTAL REVENUE:", "", report.get("total_revenue", 0)])
    
    excel_bytes = generate_excel(headers, rows, sheet_name="Revenue Report")
    
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=Revenue_{start_date.strftime('%Y-%m-%d')}_to_{end_date.strftime('%Y-%m-%d')}.xlsx"
        }
    )

@router.get("/low-stock")
async def get_low_stock_report(
    threshold: int = Query(10, description="Threshold below which stock is considered low"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("reports.view"))
) -> List[Dict[str, Any]]:
    if threshold <= 0:
        raise HTTPException(status_code=400, detail="Threshold must be positive")
        
    inventory_service = InventoryService(db, current_user.business_id)
    return await inventory_service.get_low_stock(threshold=threshold)
