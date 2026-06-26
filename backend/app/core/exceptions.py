from fastapi import Request
from fastapi.responses import JSONResponse
from app.main import app

class AppError(Exception):
    def __init__(self, message: str, status_code: int = 400, code: str = "BAD_REQUEST"):
        self.message = message
        self.status_code = status_code
        self.code = code

class NotFoundError(AppError):
    def __init__(self, message: str = "Resource not found"):
        super().__init__(message, 404, "NOT_FOUND")

class DuplicateError(AppError):
    def __init__(self, message: str = "Resource already exists"):
        super().__init__(message, 409, "DUPLICATE_RESOURCE")

class PermissionError(AppError):
    def __init__(self, message: str = "Permission denied"):
        super().__init__(message, 403, "PERMISSION_DENIED")

class ValidationError(AppError):
    def __init__(self, message: str = "Validation failed"):
        super().__init__(message, 422, "VALIDATION_ERROR")

class ExternalServiceError(AppError):
    def __init__(self, message: str = "External service failed"):
        super().__init__(message, 502, "EXTERNAL_SERVICE_ERROR")

@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message
            }
        }
    )
