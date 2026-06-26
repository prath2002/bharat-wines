import os
import shutil
import uuid
from fastapi import UploadFile

# Use the backend root's /uploads directory which is mounted by StaticFiles
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")

async def upload_file(file: UploadFile) -> str:
    """
    Simulates uploading a file to S3 by saving it locally and returning a local URL.
    """
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    
    # Generate a unique filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    unique_filename = f"{uuid.uuid4()}.{ext}"
    
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # In a real app this would be an S3 URL. Here we return the local URL accessible via FastAPI static files.
    # We return the absolute URL path assuming it's accessed via localhost:8000
    # Or just the path, and the frontend prefixes the API URL.
    return f"/uploads/{unique_filename}"
