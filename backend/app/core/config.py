from pydantic_settings import BaseSettings, SettingsConfigDict

_INSECURE_JWT_SECRETS = {"supersecretkey", "supersecretkey_change_me_in_production"}

class Settings(BaseSettings):
    APP_ENV: str = "dev"
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@db:5432/bharat_wines"
    REDIS_URL: str = "redis://redis:6379/0"

    JWT_SECRET: str = "supersecretkey" # Change in production
    JWT_EXPIRY_MINUTES: int = 15
    REFRESH_TOKEN_DAYS: int = 30

    # Comma-separated list of origins allowed to call the API with credentials
    # (browser cookies). Must be explicit origins, not "*", since the API sets
    # a credentialed (cookie-based) refresh token.
    CORS_ORIGINS: str = "http://localhost:3000"

    S3_BUCKET: str | None = None
    AWS_REGION: str | None = None

    OCR_PROVIDER: str = "textract"
    LLM_PROVIDER: str = "openai"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    def model_post_init(self, __context) -> None:
        if self.APP_ENV == "prod" and self.JWT_SECRET in _INSECURE_JWT_SECRETS:
            raise RuntimeError(
                "JWT_SECRET is set to a known insecure default. "
                "Set a strong, unique JWT_SECRET before running with APP_ENV=prod."
            )

settings = Settings()
