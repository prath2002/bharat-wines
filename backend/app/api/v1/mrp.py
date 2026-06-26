from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import uuid

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.mrp_change_request import MRPChangeRequest, MRPChangeStatus
from app.services.mrp_service import approve_mrp_change, reject_mrp_change

router = APIRouter()

@router.get("/pending")
async def get_pending_mrps(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(MRPChangeRequest).where(
        MRPChangeRequest.business_id == current_user.business_id,
        MRPChangeRequest.status == MRPChangeStatus.PENDING
    ).order_by(MRPChangeRequest.created_at.desc())
    
    result = await db.execute(stmt)
    requests = result.scalars().all()
    
    return [
        {
            "id": r.id,
            "product_id": r.product_id,
            "tp_receipt_id": r.tp_receipt_id,
            "old_mrp": r.old_mrp,
            "new_mrp": r.new_mrp,
            "created_at": r.created_at
        } for r in requests
    ]

@router.post("/{request_id}/approve")
async def api_approve_mrp(
    request_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        req = await approve_mrp_change(request_id, db, current_user.id)
        return {"status": "success", "request_id": req.id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{request_id}/reject")
async def api_reject_mrp(
    request_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        req = await reject_mrp_change(request_id, db, current_user.id)
        return {"status": "success", "request_id": req.id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
