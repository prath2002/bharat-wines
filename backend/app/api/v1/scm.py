from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from datetime import date
import uuid

from app.core.dependencies import get_current_user, require_role
from app.db.session import get_db
from app.models.user import User, Role
from app.schemas.scm import SCMReportResponse
from app.services.scm_service import get_scm_report
from fastapi.responses import StreamingResponse
import io
from app.utils.excel_export import generate_excel

router = APIRouter()

@router.get("/report", response_model=SCMReportResponse)
async def api_get_scm_report(
    start_date: date = Query(...),
    end_date: date = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.ADMIN, Role.STOCK_MANAGER))
):
    if not current_user.business_id:
        raise HTTPException(status_code=400, detail="User not associated with a business")
        
    records = await get_scm_report(db, current_user.business_id, start_date, end_date)
    return SCMReportResponse(start_date=start_date, end_date=end_date, records=records)

@router.get("/export")
async def api_export_scm_report(
    start_date: date = Query(...),
    end_date: date = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.ADMIN, Role.STOCK_MANAGER))
):
    if not current_user.business_id:
        raise HTTPException(status_code=400, detail="User not associated with a business")
        
    records = await get_scm_report(db, current_user.business_id, start_date, end_date)
    
    headers = [
        "SCM Code", 
        "Product Name", 
        "Category", 
        "Size (ml)", 
        "Opening", 
        "Purchases", 
        "Sales", 
        "Returns", 
        "Damage", 
        "Closing"
    ]
    
    rows = []
    for r in records:
        rows.append([
            r.scm_code,
            r.product_name,
            r.category.name,
            r.size_ml,
            r.opening,
            r.purchases,
            r.sales,
            r.returns,
            r.damage,
            r.closing
        ])
        
    file_bytes = generate_excel(headers, rows, sheet_name=f"SCM_{start_date}_to_{end_date}")
    
    return StreamingResponse(
        io.BytesIO(file_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=scm_report_{start_date}_to_{end_date}.xlsx"
        }
    )
