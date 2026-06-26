from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    APP_ENV: str = "dev"
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@db:5432/bharat_wines"
    REDIS_URL: str = "redis://redis:6379/0"
    
    JWT_SECRET: str = "supersecretkey" # Change in production
    JWT_EXPIRY_MINUTES: int = 15
    REFRESH_TOKEN_DAYS: int = 30
    
    S3_BUCKET: str | None = None
    AWS_REGION: str | None = None
    
    OCR_PROVIDER: str = "textract"
    LLM_PROVIDER: str = "openai"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()
