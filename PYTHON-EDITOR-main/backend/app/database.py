from __future__ import annotations

import logging
import os
from pathlib import Path
from urllib.parse import quote_plus, urlparse, urlunparse

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.engine.url import make_url
from sqlalchemy.exc import ArgumentError
from sqlalchemy.orm import declarative_base, sessionmaker

# Load environment variables from .env if present (useful for local dev)
load_dotenv()

_default_sqlite_path = Path(__file__).resolve().parents[1] / ".data" / "app.db"
_default_sqlite_path.parent.mkdir(parents=True, exist_ok=True)

raw_db_url = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{_default_sqlite_path.as_posix()}",
)


def _sanitize_db_url(url: str) -> str:
    """
    Ensure the database URL is valid and that special characters in the password
    (e.g. % or @ from Supabase) are URL-encoded to prevent 500s on Render.
    """
    try:
        # If this succeeds, URL is already valid/encoded.
        make_url(url)
        return url
    except ArgumentError:
        pass

    # Try to percent-encode the password part
    parsed = urlparse(url)
    if parsed.scheme.startswith("postgres"):
        username = parsed.username or ""
        password = quote_plus(parsed.password or "")
        netloc = parsed.hostname or ""
        if parsed.port:
            netloc += f":{parsed.port}"
        if username:
            netloc = f"{username}:{password}@{netloc}"
        sanitized = urlunparse(
            (
                parsed.scheme,
                netloc,
                parsed.path or "",
                parsed.params or "",
                parsed.query or "",
                parsed.fragment or "",
            )
        )
        try:
            make_url(sanitized)
            logging.getLogger(__name__).info("DATABASE_URL sanitized for special characters.")
            return sanitized
        except ArgumentError as exc:
            logging.getLogger(__name__).error("Invalid DATABASE_URL after sanitization: %s", exc)
            raise
    return url


DATABASE_URL = _sanitize_db_url(raw_db_url)

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
