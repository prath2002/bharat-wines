from datetime import date

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Dict, Any
import uuid

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.tp_receipt import TPReceipt, TPStatus
from app.models.tp_receipt_line import TPReceiptLine
from app.services.tp_service import upload_tp, approve_receipt, reject_receipt

router = APIRouter()

@router.post("/upload")
async def api_upload_tp(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.business_id:
        raise HTTPException(status_code=400, detail="User not associated with a business")
        
    try:
        receipt = await upload_tp(file, db, current_user.business_id, current_user.id)
        return {"id": receipt.id, "status": receipt.status.name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/receipts")
async def list_receipts(
    tp_status: TPStatus | None = Query(None, alias="status"),
    supplier_name: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(TPReceipt).where(TPReceipt.business_id == current_user.business_id)

    if tp_status:
        stmt = stmt.where(TPReceipt.status == tp_status)
    if supplier_name:
        stmt = stmt.where(TPReceipt.supplier_name == supplier_name)
    if date_from:
        stmt = stmt.where(TPReceipt.tp_date >= date_from)
    if date_to:
        stmt = stmt.where(TPReceipt.tp_date <= date_to)

    count_result = await db.execute(select(func.count()).select_from(stmt.subquery()))
    total = count_result.scalar_one()

    stmt = stmt.order_by(TPReceipt.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(stmt)
    receipts = result.scalars().all()

    items = [
        {
            "id": r.id,
            "tp_number": r.tp_number,
            "supplier_name": r.supplier_name,
            "tp_date": r.tp_date,
            "status": r.status.name,
            "created_at": r.created_at
        } for r in receipts
    ]
    return {"items": items, "total": total, "limit": limit, "offset": offset}

@router.get("/receipts/suppliers")
async def list_receipt_suppliers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = (
        select(TPReceipt.supplier_name)
        .where(
            TPReceipt.business_id == current_user.business_id,
            TPReceipt.supplier_name.is_not(None),
        )
        .distinct()
        .order_by(TPReceipt.supplier_name)
    )
    result = await db.execute(stmt)
    return [name for name in result.scalars().all() if name]

@router.get("/receipts/{receipt_id}")
async def get_receipt(
    receipt_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(TPReceipt).options(selectinload(TPReceipt.lines)).where(
        TPReceipt.id == receipt_id,
        TPReceipt.business_id == current_user.business_id
    )
    result = await db.execute(stmt)
    receipt = result.scalar_one_or_none()
    
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
        
    lines = []
    for line in receipt.lines:
        lines.append({
            "id": line.id,
            "extracted_product_name": line.extracted_name,
            "extracted_scm_code": line.extracted_scm_code,
            "product_id": line.product_id,
            "match_confidence": line.match_confidence,
            "extracted_size": line.extracted_size,
            "quantity_bottles": line.quantity_bottles,
            "total_bottles": line.total_bottles,
            "extracted_mrp": line.extracted_mrp,
            "batch_number": line.batch_number
        })
        
    return {
        "id": receipt.id,
        "tp_number": receipt.tp_number,
        "supplier_name": receipt.supplier_name,
        "tp_date": receipt.tp_date,
        "status": receipt.status.name,
        "file_url": receipt.file_url,
        "extracted_data": receipt.extracted_data,
        "lines": lines
    }

@router.post("/receipts/{receipt_id}/approve")
async def api_approve_receipt(
    receipt_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        receipt = await approve_receipt(receipt_id, db, current_user.id)
        return {"status": "success", "receipt_id": receipt.id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/receipts/{receipt_id}/reject")
async def api_reject_receipt(
    receipt_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        receipt = await reject_receipt(receipt_id, db, current_user.id)
        return {"status": "success", "receipt_id": receipt.id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/receipts/{receipt_id}/lines/{line_id}")
async def edit_line(
    receipt_id: uuid.UUID,
    line_id: uuid.UUID,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(TPReceiptLine).where(TPReceiptLine.id == line_id, TPReceiptLine.tp_receipt_id == receipt_id)
    result = await db.execute(stmt)
    line = result.scalar_one_or_none()
    
    if not line:
        raise HTTPException(status_code=404, detail="Line not found")
        
    if "product_id" in payload:
        line.product_id = payload["product_id"] if payload["product_id"] else None
        line.match_confidence = 1.0 # Manual map is 100% confidence
        
    if "total_bottles" in payload:
        line.total_bottles = int(payload["total_bottles"])
        line.quantity_bottles = int(payload["total_bottles"])
        
    if "batch_number" in payload:
        line.batch_number = payload["batch_number"]
        
    if "extracted_mrp" in payload:
        line.extracted_mrp = float(payload["extracted_mrp"])
        
    await db.commit()
    return {"status": "success"}
