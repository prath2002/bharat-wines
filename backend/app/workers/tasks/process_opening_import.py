import asyncio
import uuid
import logging
from sqlalchemy.future import select

from app.workers.celery_app import celery_app
from app.db.session import AsyncSessionLocal, engine
from app.models.import_job import ImportJob, ImportJobStatus
from app.services.opening_import_service import process
from app.integrations.s3 import get_file_path
from app.integrations.redis import init_redis, close_redis

logger = logging.getLogger(__name__)

async def run_import_async(job_id: str):
    try:
        # Celery workers never run FastAPI's startup event, so the global
        # redis client is uninitialized here; create one scoped to this
        # task's event loop (see engine.dispose() note below for why).
        await init_redis()
        async with AsyncSessionLocal() as db:
            # Fetch job
            job_uuid = uuid.UUID(job_id)
            result = await db.execute(select(ImportJob).where(ImportJob.id == job_uuid))
            job = result.scalars().first()

            if not job:
                logger.error(f"ImportJob {job_id} not found")
                return

            # Update status
            job.status = ImportJobStatus.PROCESSING
            await db.commit()

            try:
                # Process the file
                file_path = get_file_path(job.file_key)
                summary = await process(file_path, job.business_id, job.user_id)

                # If there were errors returning in summary, maybe it's DONE but with errors.
                job.summary = summary
                job.status = ImportJobStatus.DONE
                await db.commit()

            except Exception as e:
                logger.exception(f"Failed to process ImportJob {job_id}")
                job.status = ImportJobStatus.ERROR
                job.summary = {"error": str(e)}
                await db.commit()
    finally:
        # The engine's connection pool is created once at import time, but each
        # Celery task run gets its own event loop via asyncio.run(). asyncpg
        # connections are bound to the loop they were opened on, so pooled
        # connections must be dropped before this loop closes, or the next
        # task run fails with "attached to a different loop".
        await engine.dispose()
        await close_redis()

@celery_app.task(name="app.workers.tasks.process_opening_import.process_opening_import_task")
def process_opening_import_task(job_id: str):
    """
    Celery wrapper to run the async database operations.
    """
    logger.info(f"Starting process_opening_import_task for job {job_id}")
    asyncio.run(run_import_async(job_id))
    logger.info(f"Finished process_opening_import_task for job {job_id}")
