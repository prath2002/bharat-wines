from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import uuid
from typing import Dict, Any, List

from app.db.session import get_db
from app.core.dependencies import get_current_user, require_permissions
from app.models.user import User
from app.models.import_job import ImportJob, ImportJobStatus
from app.services.import_service import create_import_job
from app.services.opening_import_service import preview
from app.integrations.s3 import get_file_path
from app.workers.tasks.process_opening_import import process_opening_import_task
from fastapi.responses import FileResponse
import os

router = APIRouter()

@router.get("/template")
async def get_import_template():
    file_path = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "sample_opening_inventory.xlsx")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Template not found")
    return FileResponse(path=file_path, filename="sample_opening_inventory.xlsx", media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

@router.post("/opening-inventory")
async def upload_opening_inventory(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("imports.create"))
) -> Dict[str, Any]:
    job = await create_import_job(
        db=db,
        file=file,
        import_type="OPENING_INVENTORY",
        business_id=current_user.business_id,
        user_id=current_user.id
    )
    return {"import_job_id": str(job.id), "status": job.status}

@router.get("/{id}/preview")
async def preview_import(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    result = await db.execute(select(ImportJob).where(ImportJob.id == id, ImportJob.business_id == current_user.business_id))
    job = result.scalars().first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")
        
    try:
        file_path = get_file_path(job.file_key)
        return preview(file_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{id}/process")
async def process_import(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("imports.create"))
) -> Dict[str, Any]:
    result = await db.execute(select(ImportJob).where(ImportJob.id == id, ImportJob.business_id == current_user.business_id))
    job = result.scalars().first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")
        
    if job.status not in (ImportJobStatus.UPLOADED, ImportJobStatus.ERROR):
        raise HTTPException(status_code=400, detail=f"Cannot process job in status {job.status}")
        
    # Start celery task
    process_opening_import_task.delay(str(job.id))
    
    return {"message": "Processing started", "job_id": str(job.id)}

@router.get("/{id}/status")
async def get_import_status(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    result = await db.execute(select(ImportJob).where(ImportJob.id == id, ImportJob.business_id == current_user.business_id))
    job = result.scalars().first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")
        
    return {
        "id": str(job.id),
        "status": job.status,
        "import_type": job.import_type,
        "summary": job.summary,
        "created_at": job.created_at
    }
