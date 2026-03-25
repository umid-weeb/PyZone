from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes.health import router as health_router
from app.api.routes.auth import router as auth_router
from app.api.routes.users import router as user_router, account_router
from app.api.routes.problems import router as problem_router
from app.api.routes.submissions import router as submission_router
from app.api.routes.contests import router as contest_router
from app.core.config import get_settings
from app.repositories.submissions import SubmissionRepository
from app.database import Base, engine
from app.database import SessionLocal
from app import models as _models  # noqa: F401
from app.services.problem_catalog import ensure_problem_catalog_seeded


settings = get_settings()
logging.basicConfig(
    level=getattr(logging, settings.log_level, logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    SubmissionRepository(settings.submissions_db_path)
    # Ensure SQLAlchemy models are created (Supabase/Postgres or fallback SQLite)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        ensure_problem_catalog_seeded(db)
    yield


app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins
    or ["https://pyzone.uz", "https://www.pyzone.uz", "http://localhost", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(problem_router, prefix=settings.api_prefix)
app.include_router(submission_router, prefix=settings.api_prefix)
app.include_router(contest_router, prefix=settings.api_prefix)
app.include_router(health_router)
app.include_router(auth_router, prefix=settings.api_prefix)
app.include_router(user_router, prefix=settings.api_prefix)
app.include_router(account_router, prefix=settings.api_prefix)

# Serve uploaded avatars
uploads_root = settings.backend_root / "uploads"
uploads_root.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_root), name="uploads")


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "name": settings.app_name,
        "status": "ok",
        "api_prefix": settings.api_prefix,
    }
