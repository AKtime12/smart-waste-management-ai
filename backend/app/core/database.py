# backend/app/core/database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import NullPool
import os
from dotenv import load_dotenv

load_dotenv()

# Use SQLite for simplicity (change to PostgreSQL for production)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./waste_management.db")

engine = create_async_engine(
    DATABASE_URL,
    echo=True,
    poolclass=NullPool
)

AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session