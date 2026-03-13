from __future__ import annotations

import asyncio
import threading
from functools import lru_cache

from app.core.config import get_settings
from app.judge.runner import JudgeRunner
from app.models.schemas import SubmissionRequest
from app.repositories.submissions import SubmissionRepository
from app.services.problem_service import ProblemService, get_problem_service


class SubmissionService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.repository = SubmissionRepository(self.settings.submissions_db_path)
        self.problem_service: ProblemService = get_problem_service()
        self.judge = JudgeRunner(self.settings)

    def create_submission(self, payload: SubmissionRequest, mode: str) -> str:
        return self.repository.create(
            problem_id=payload.problem_id,
            code=payload.code,
            language=payload.language,
            mode=mode,
        )

    def enqueue_submission(self, submission_id: str) -> None:
        if self.settings.use_inline_execution:
            worker = threading.Thread(
                target=self.process_submission,
                args=(submission_id,),
                daemon=True,
            )
            worker.start()
            return

        try:
            from app.worker.tasks import process_submission_task

            process_submission_task.delay(submission_id)
        except Exception:
            worker = threading.Thread(
                target=self.process_submission,
                args=(submission_id,),
                daemon=True,
            )
            worker.start()

    def process_submission(self, submission_id: str) -> None:
        submission = self.repository.get(submission_id)
        if submission is None:
            return

        self.repository.mark_running(submission_id)
        try:
            problem_bundle = asyncio.run(
                self.problem_service.get_problem_bundle(submission["problem_id"])
            )
            result = self.judge.run_submission(
                problem=problem_bundle,
                code=submission["code"],
                mode=submission["mode"],
            )
            self.repository.complete(submission_id, result)
        except Exception as error:
            self.repository.mark_failed(submission_id, str(error))

    def get_submission(self, submission_id: str) -> dict | None:
        return self.repository.get(submission_id)


@lru_cache(maxsize=1)
def get_submission_service() -> SubmissionService:
    return SubmissionService()
