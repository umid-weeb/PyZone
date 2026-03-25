from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.routes.auth import get_current_user
from app.models.schemas import SubmissionCreated, SubmissionRequest, SubmissionStatus
from app.models.user import User
from app.services.submission_service import SubmissionService, get_submission_service


router = APIRouter(tags=["submissions"])


@router.post("/run", response_model=SubmissionCreated, status_code=status.HTTP_202_ACCEPTED)
async def run_solution(
    payload: SubmissionRequest,
    service: SubmissionService = Depends(get_submission_service),
) -> SubmissionCreated:
    if not payload.code.strip():
        raise HTTPException(status_code=400, detail="Kod bo'sh bo'lishi mumkin emas.")
    submission_id = service.create_submission(payload, mode="run")
    service.enqueue_submission(submission_id)
    return SubmissionCreated(submission_id=submission_id, status="queued")


@router.post("/submit", response_model=SubmissionCreated, status_code=status.HTTP_202_ACCEPTED)
async def submit_solution(
    payload: SubmissionRequest,
    user: User = Depends(get_current_user),
    service: SubmissionService = Depends(get_submission_service),
) -> SubmissionCreated:
    if not payload.code.strip():
        raise HTTPException(status_code=400, detail="Kod bo'sh bo'lishi mumkin emas.")
    submission_id = service.create_submission(payload, mode="submit", user_id=user.id)
    service.enqueue_submission(submission_id)
    return SubmissionCreated(submission_id=submission_id, status="queued")


@router.get("/submission/{submission_id}", response_model=SubmissionStatus)
async def get_submission(
    submission_id: str,
    service: SubmissionService = Depends(get_submission_service),
) -> SubmissionStatus:
    submission = service.get_submission(submission_id)
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission topilmadi.")

    return SubmissionStatus(
        submission_id=submission["submission_id"],
        problem_id=submission["problem_id"],
        mode=submission["mode"],
        language=submission["language"],
        status=submission["status"],
        verdict=submission["verdict"],
        runtime_ms=submission["runtime_ms"],
        memory_kb=submission["memory_kb"],
        passed_count=submission["passed_count"],
        total_count=submission["total_count"],
        created_at=datetime.fromisoformat(submission["created_at"]),
        updated_at=datetime.fromisoformat(submission["updated_at"]),
        error_text=submission["error_text"],
        case_results=submission["case_results"],
    )
