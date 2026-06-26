#!/bin/bash
# Exit immediately if a command exits with a non-zero status
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Starting Celery background worker..."
# We use '&' to run Celery in the background so the script continues
celery -A app.workers.celery_app worker --loglevel=info &

echo "Starting FastAPI server..."
# We run uvicorn in the foreground to keep the container alive
uvicorn app.main:app --host 0.0.0.0 --port 10000
