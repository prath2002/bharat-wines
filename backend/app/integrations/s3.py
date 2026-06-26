import os
import uuid

from fastapi import UploadFile

# Use local storage for dev. In production, this would use boto3 and S3.
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")

# Ensure the upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)

async def upload_file(file: UploadFile) -> str:
    """
    Saves the uploaded file locally and returns a unique file_key.
    In production, this would upload to S3 and return the S3 object key.
    """
    # Generate a unique key to prevent collisions
    file_ext = os.path.splitext(file.filename)[1] if file.filename else ""
    file_key = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, file_key)

    with open(file_path, 'wb') as out_file:
        content = await file.read()  # read all contents
        out_file.write(content)

    return file_key

def get_file_path(file_key: str) -> str:
    """
    Returns the absolute path to the file on disk.
    In production, this might download the file from S3 to a temp file,
    or return a presigned URL if the client needs to download it.
    """
    return os.path.join(UPLOAD_DIR, file_key)
