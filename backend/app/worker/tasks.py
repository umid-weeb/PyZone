from __future__ import annotations

from app.services.submission_service import get_submission_service
from app.worker.celery_app import celery_app


@celery_app.task(name="arena.process_submission")
def process_submission_task(submission_id: str) -> None:
    service = get_submission_service()
    service.process_submission(submission_id)
