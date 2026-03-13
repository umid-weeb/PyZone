from __future__ import annotations

import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Load environment variables from .env if present (useful for local dev)
load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    # Safe fallback for local development if not provided
    "sqlite:///./.data/app.db",
)

# Engine with pre_ping to recover stale connections; Render/Supabase friendly
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    future=True,
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)

# Base class for declarative models
Base = declarative_base()


def get_db():
    """
    FastAPI dependency that yields a database session and ensures cleanup.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
