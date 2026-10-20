from collections.abc import AsyncGenerator

import pytest_asyncio
import uuid6
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.api.deps import get_db
from app.config import settings
from app.infrastructure.db.models import (
    ClubModel,
    CourtModel,
)
from app.main import app


@pytest_asyncio.fixture
async def api_client() -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        yield client


@pytest_asyncio.fixture(scope="session")
def test_engine():
    # Use NullPool for tests to ensure clean asyncpg connections per test
    engine = create_async_engine(settings.DATABASE_URL, echo=False, poolclass=NullPool)
    yield engine


@pytest_asyncio.fixture(autouse=True)
def override_api_db(test_engine):
    async def _get_test_db() -> AsyncGenerator[AsyncSession, None]:
        async_session = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)
        async with async_session() as session:
            try:
                yield session
            finally:
                await session.close()

    app.dependency_overrides[get_db] = _get_test_db
    yield
    app.dependency_overrides.pop(get_db, None)


@pytest_asyncio.fixture
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    async_session = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)
    async with async_session() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def seed_club_and_court(test_engine) -> AsyncGenerator[tuple[ClubModel, CourtModel, CourtModel], None]:
    """Creates a test club with two courts using an independent session and cleans them up."""
    async_session = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)
    async with async_session() as session:
        club_id = uuid6.uuid7()
        club = ClubModel(
            id=club_id,
            slug=f"test-club-{club_id.hex}",
            name="Club El Campín Test",
            timezone="America/Bogota",
            is_published=True,
            subscription_status="active",
            settings={"deposit_percentage": 0, "payment_mode": "on_site"},
        )
        court_1 = CourtModel(
            id=uuid6.uuid7(),
            club_id=club_id,
            name="Cancha 1 Pádel",
            sport="padel",
            surface="synthetic_grass",
            player_format="doubles",
            is_active=True,
            position=1,
        )
        court_2 = CourtModel(
            id=uuid6.uuid7(),
            club_id=club_id,
            name="Cancha 2 Pádel",
            sport="padel",
            surface="synthetic_grass",
            player_format="doubles",
            is_active=True,
            position=2,
        )
        session.add_all([club, court_1, court_2])
        await session.commit()
        await session.refresh(club)
        await session.refresh(court_1)
        await session.refresh(court_2)
        try:
            yield club, court_1, court_2
        finally:
            await session.delete(court_1)
            await session.delete(court_2)
            await session.delete(club)
            await session.commit()
