from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = (
        "postgresql+asyncpg://canchariane:canchariane_password@localhost:5432/canchariane_db"
    )
    SYNC_DATABASE_URL: str = (
        "postgresql+psycopg://canchariane:canchariane_password@localhost:5432/canchariane_db"
    )

    # Security
    JWT_SECRET: str = "canchariane_super_secret_key_minimum_32_bytes_secure_token"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Business Defaults
    DEFAULT_TIMEZONE: str = "America/Bogota"
    HOLD_EXPIRATION_MINUTES: int = 10
    MIN_LEAD_TIME_MINUTES: int = 30

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
