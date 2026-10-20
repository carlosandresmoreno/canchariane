import urllib.parse
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # Database connection parameters
    DB_HOST: str | None = "arianedevs-db.c4xiqgaau7tv.us-east-1.rds.amazonaws.com"
    DB_PORT: int = 5432
    DB_USER: str | None = "postgres"
    DB_PASSWORD: str | None = "vlf1v1(3cX9pN|Z.yb350K~MX?Lq"
    DB_NAME: str = "canchariane_db"

    # Database URLs
    DATABASE_URL: str = (
        "postgresql+asyncpg://postgres:vlf1v1%283cX9pN%7CZ.yb350K%7EMX%3FLq@arianedevs-db.c4xiqgaau7tv.us-east-1.rds.amazonaws.com:5432/canchariane_db"
    )
    SYNC_DATABASE_URL: str = (
        "postgresql+psycopg://postgres:vlf1v1%283cX9pN%7CZ.yb350K%7EMX%3FLq@arianedevs-db.c4xiqgaau7tv.us-east-1.rds.amazonaws.com:5432/canchariane_db"
    )

    @model_validator(mode="after")
    def assemble_db_urls(self) -> "Settings":
        if self.DB_HOST and self.DB_USER and self.DB_PASSWORD:
            encoded_password = urllib.parse.quote_plus(self.DB_PASSWORD)
            self.DATABASE_URL = (
                f"postgresql+asyncpg://{self.DB_USER}:{encoded_password}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
            )
            self.SYNC_DATABASE_URL = (
                f"postgresql+psycopg://{self.DB_USER}:{encoded_password}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
            )
        return self

    # Security
    JWT_SECRET: str = "canchariane_super_secret_key_minimum_32_bytes_secure_token"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Business Defaults
    DEFAULT_TIMEZONE: str = "America/Bogota"
    HOLD_EXPIRATION_MINUTES: int = 10
    MIN_LEAD_TIME_MINUTES: int = 30

    # CORS
    CORS_ORIGINS: list[str] = ["*"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
