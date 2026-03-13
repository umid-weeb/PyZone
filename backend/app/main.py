from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.problems import router as problem_router
from app.api.routes.submissions import router as submission_router
from app.core.config import get_settings
from app.repositories.submissions import SubmissionRepository


settings = get_settings()
app = FastAPI(title=settings.app_name, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(problem_router, prefix=settings.api_prefix)
app.include_router(submission_router, prefix=settings.api_prefix)


@app.on_event("startup")
async def on_startup() -> None:
    SubmissionRepository(settings.submissions_db_path)


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "name": settings.app_name,
        "status": "ok",
        "api_prefix": settings.api_prefix,
    }
