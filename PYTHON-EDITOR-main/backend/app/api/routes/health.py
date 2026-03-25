from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.config import get_settings
from app.repositories.submissions import SubmissionRepository
from app.services.problem_service import ProblemService, get_problem_service


router = APIRouter(tags=["health"])


@router.get("/health")
async def health(
    service: ProblemService = Depends(get_problem_service),
) -> dict:
    settings = get_settings()
    repository = SubmissionRepository(settings.submissions_db_path)
    return {
        "status": "ok",
        "api_prefix": settings.api_prefix,
        "problem_source": service.source_label,
        "hidden_source": (
            f"local:{settings.hidden_test_root}"
            if settings.hidden_test_root.exists()
            else (
                f"github:{settings.hidden_github_owner}/{settings.hidden_github_repo}"
                if settings.hidden_github_enabled
                else "fallback-public"
            )
        ),
        "db": repository.ping(),
        "cache": service.cache.status(),
    }


@router.get("/health/db")
async def health_db() -> dict:
    settings = get_settings()
    repository = SubmissionRepository(settings.submissions_db_path)
    return repository.ping()


@router.get("/health/cache")
async def health_cache(
    service: ProblemService = Depends(get_problem_service),
) -> dict:
    return {
        "status": "ok",
        **service.cache.status(),
    }
