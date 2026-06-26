from fastapi import UploadFile, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.models.import_job import ImportJob, ImportJobStatus
from app.integrations.s3 import upload_file

ALLOWED_EXTENSIONS = {".csv", ".xlsx"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

async def create_import_job(
    db: AsyncSession,
    file: UploadFile,
    import_type: str,
    business_id: uuid.UUID,
    user_id: uuid.UUID
) -> ImportJob:
    # Validate extension
    import os
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Invalid file type. Allowed: {ALLOWED_EXTENSIONS}")
    
    # Read first bytes to calculate size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds 10MB limit")
        
    # Reset file cursor so upload_file can read it again
    await file.seek(0)
    
    # Upload file
    file_key = await upload_file(file)
    
    # Create Job
    job = ImportJob(
        business_id=business_id,
        user_id=user_id,
        import_type=import_type,
        status=ImportJobStatus.UPLOADED,
        file_key=file_key
    )
    
    db.add(job)
    await db.commit()
    await db.refresh(job)
    
    return job
