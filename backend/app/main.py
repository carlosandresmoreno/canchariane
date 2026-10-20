from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.errors import register_error_handlers
from app.api.v1.router import api_v1_router, v1_router
from app.config import settings
from app.infrastructure.db.session import engine


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Startup: ensure db connectivity
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    yield
    # Shutdown: dispose db pool
    await engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Canchariane API",
        version="2.0.0",
        description="Sistema multi-tenant de reserva de canchas deportivas",
        lifespan=lifespan,
    )

    # CORS configuration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Global domain exception to RFC 9457 Problem Details
    register_error_handlers(app)

    # Include API Routers:
    # 1. /api/v1 prefix for direct calls & frontends
    # 2. /v1 prefix for reverse proxies that strip /api/ (e.g. proxy_pass http://...:8004/)
    app.include_router(api_v1_router)
    app.include_router(v1_router)

    @app.get("/", status_code=status.HTTP_200_OK, tags=["Health"], include_in_schema=False)
    async def root() -> dict[str, str]:
        return {"status": "healthy", "service": "canchariane-api"}

    @app.get("/health", status_code=status.HTTP_200_OK, tags=["Health"])
    async def health() -> dict[str, str]:
        return {"status": "healthy"}

    @app.get("/health/ready", status_code=status.HTTP_200_OK, tags=["Health"])
    async def health_ready() -> dict[str, str]:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "ready", "database": "connected"}

    return app


app = create_app()
