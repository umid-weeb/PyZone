from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.models.schemas import ProblemDetail, ProblemListResponse
from app.services.problem_service import (
    ProblemNotFoundError,
    ProblemService,
    get_problem_service,
)


router = APIRouter(tags=["problems"])


@router.get("/problems", response_model=ProblemListResponse)
async def list_problems(
    refresh: bool = False,
    service: ProblemService = Depends(get_problem_service),
) -> ProblemListResponse:
    items = await service.list_problems(force_refresh=refresh)
    return ProblemListResponse(
        items=items,
        total=len(items),
        source=service.source_label,
        easy_only=True,
    )


@router.get("/problem/{problem_id}", response_model=ProblemDetail)
async def get_problem(
    problem_id: str,
    refresh: bool = False,
    service: ProblemService = Depends(get_problem_service),
) -> ProblemDetail:
    try:
        return await service.get_problem(problem_id, force_refresh=refresh)
    except ProblemNotFoundError as error:
        raise HTTPException(status_code=404, detail="Problem topilmadi.") from error
