from __future__ import annotations

import logging
from time import perf_counter

from fastapi import APIRouter, Depends, HTTPException

from app.models.schemas import ProblemDetail, ProblemListResponse
from app.services.problem_service import (
    ProblemNotFoundError,
    ProblemService,
    get_problem_service,
)


router = APIRouter(tags=["problems"])
logger = logging.getLogger("pyzone.arena.problems")


@router.get("/problems", response_model=ProblemListResponse)
async def list_problems(
    page: int = 1,
    per_page: int = 200,
    q: str = "",
    tags: str = "",
    difficulty: str = "",
    refresh: bool = False,
    service: ProblemService = Depends(get_problem_service),
) -> ProblemListResponse:
    started_at = perf_counter()
    cache_hit = False
    if not refresh:
        try:
            cache_hit = service.cache.load_index() is not None
        except Exception:
            cache_hit = False

    tag_items = [item.strip() for item in tags.split(",") if item.strip()]
    payload = await service.list_problem_page(
        page=page,
        per_page=per_page,
        query=q,
        tags=tag_items,
        difficulty=difficulty,
        force_refresh=refresh,
    )

    logger.info(
        "problems.list source=%s refresh=%s cache=%s page=%s per_page=%s query=%r tags=%s loaded=%s total=%s latency_ms=%.2f",
        service.source_label,
        refresh,
        "hit" if cache_hit else "miss",
        payload["page"],
        payload["per_page"],
        q,
        payload["selected_tags"],
        len(payload["items"]),
        payload["total"],
        (perf_counter() - started_at) * 1000,
    )

    return ProblemListResponse(
        items=payload["items"],
        total=payload["total"],
        page=payload["page"],
        per_page=payload["per_page"],
        total_pages=payload["total_pages"],
        query=payload["query"],
        selected_tags=payload["selected_tags"],
        available_tags=payload["available_tags"],
        source=service.source_label,
        easy_only=False,
    )


@router.get("/search", response_model=ProblemListResponse)
async def search_problems(
    q: str,
    page: int = 1,
    per_page: int = 200,
    tags: str = "",
    difficulty: str = "",
    service: ProblemService = Depends(get_problem_service),
) -> ProblemListResponse:
    """Enhanced search endpoint for problems with better query handling"""
    if not q.strip():
        raise HTTPException(status_code=400, detail="Search query cannot be empty")
    
    tag_items = [item.strip() for item in tags.split(",") if item.strip()]
    payload = await service.list_problem_page(
        page=page,
        per_page=per_page,
        query=q.strip(),
        tags=tag_items,
        difficulty=difficulty,
        force_refresh=False,
    )
    
    return ProblemListResponse(
        items=payload["items"],
        total=payload["total"],
        page=payload["page"],
        per_page=payload["per_page"],
        total_pages=payload["total_pages"],
        query=payload["query"],
        selected_tags=payload["selected_tags"],
        available_tags=payload["available_tags"],
        source=service.source_label,
        easy_only=False,
    )


@router.get("/problems/{problem_slug}", response_model=ProblemDetail)
async def get_problem(
    problem_slug: str,
    refresh: bool = False,
    service: ProblemService = Depends(get_problem_service),
) -> ProblemDetail:
    started_at = perf_counter()
    cache_hit = False
    if not refresh:
        try:
            cache_hit = service.cache.load_problem(problem_slug) is not None
        except Exception:
            cache_hit = False

    try:
        problem = await service.get_problem(problem_slug, force_refresh=refresh)
        logger.info(
            "problems.detail problem=%s source=%s refresh=%s cache=%s visible=%s hidden=%s latency_ms=%.2f",
            problem_slug,
            service.source_label,
            refresh,
            "hit" if cache_hit else "miss",
            len(problem.visible_testcases),
            problem.hidden_testcase_count,
            (perf_counter() - started_at) * 1000,
        )
        return problem
    except ProblemNotFoundError as error:
        logger.warning(
            "problems.detail.not_found problem=%s source=%s refresh=%s cache=%s",
            problem_slug,
            service.source_label,
            refresh,
            "hit" if cache_hit else "miss",
        )
        raise HTTPException(status_code=404, detail="Problem topilmadi.") from error


@router.get("/problem/{problem_key}", response_model=ProblemDetail)
async def get_problem_legacy(
    problem_key: str,
    refresh: bool = False,
    service: ProblemService = Depends(get_problem_service),
) -> ProblemDetail:
    return await get_problem(problem_slug=problem_key, refresh=refresh, service=service)
