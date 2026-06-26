import pytest
import asyncio
from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool

from app.main import app
from app.db.base import Base
from app.db.session import get_db

# Use an in-memory SQLite database for testing, or a dedicated postgres test DB.
# For simplicity in testing async FastAPI, we'll assume a test postgres DB or sqlite.
# Note: asyncpg doesn't support sqlite, so we'd need aiosqlite or to mock it.
# To keep this simple and functional without spinning up a new container,
# we will just mock the database session for auth tests where needed, or provide a basic structure.

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="module")
async def client() -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
