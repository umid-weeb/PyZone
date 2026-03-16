from __future__ import annotations

import asyncio
import threading
from functools import lru_cache
import logging

from app.core.config import get_settings
from app.judge.runner import JudgeRunner
from app.models.schemas import SubmissionRequest
from app.models.submission_stats import UserSubmission
from app.models.contest import ContestEntry, ContestSubmission
from app.repositories.submissions import SubmissionRepository
from app.services.problem_service import ProblemService, get_problem_service
from app.database import SessionLocal
from app.services.rating_service import rating_service


class SubmissionService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.repository = SubmissionRepository(self.settings.submissions_db_path)
        self.problem_service: ProblemService = get_problem_service()
        self.judge = JudgeRunner(self.settings)
        self.logger = logging.getLogger("pyzone.arena.submission")

    def create_submission(self, payload: SubmissionRequest, mode: str, user_id: int | None = None) -> str:
        submission_id = self.repository.create(
            problem_id=payload.problem_id,
            code=payload.code,
            language=payload.language,
            mode=mode,
        )
        self.logger.info(
            "submission.created id=%s problem=%s mode=%s inline=%s",
            submission_id,
            payload.problem_id,
            mode,
            self.settings.use_inline_execution,
        )
        if user_id is not None and mode == "submit":
            with SessionLocal() as db:
                record = UserSubmission(
                    user_id=user_id,
                    problem_id=payload.problem_id,
                    submission_id=submission_id,
                    language=payload.language,
                    verdict=None,
                    runtime_ms=None,
                    memory_kb=None,
                )
                db.add(record)
                if payload.contest_id:
                    # Ensure the user is registered as a contest entry.
                    exists = (
                        db.query(ContestEntry.id)
                        .filter(ContestEntry.contest_id == payload.contest_id, ContestEntry.user_id == user_id)
                        .first()
                    )
                    if not exists:
                        db.add(ContestEntry(contest_id=payload.contest_id, user_id=user_id))
                    db.add(
                        ContestSubmission(
                            contest_id=payload.contest_id,
                            user_id=user_id,
                            problem_id=payload.problem_id,
                            submission_id=submission_id,
                            verdict=None,
                            runtime_ms=None,
                            memory_kb=None,
                        )
                    )
                db.commit()
        return submission_id

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
            self.logger.info("submission.enqueued id=%s backend=celery", submission_id)
        except Exception:
            worker = threading.Thread(
                target=self.process_submission,
                args=(submission_id,),
                daemon=True,
            )
            worker.start()
            self.logger.warning("submission.celery_fallback id=%s running_inline", submission_id)

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
            self.logger.info(
                "submission.completed id=%s verdict=%s runtime_ms=%s memory_kb=%s passed=%s/%s",
                submission_id,
                result.get("verdict"),
                result.get("runtime_ms"),
                result.get("memory_kb"),
                result.get("passed_count"),
                result.get("total_count"),
            )
            if submission.get("mode") == "submit":
                with SessionLocal() as db:
                    record = (
                        db.query(UserSubmission)
                        .filter(UserSubmission.submission_id == submission_id)
                        .first()
                    )
                    if record:
                        record.verdict = result.get("verdict")
                        record.runtime_ms = result.get("runtime_ms")
                        record.memory_kb = result.get("memory_kb")
                        contest_row = (
                            db.query(ContestSubmission)
                            .filter(ContestSubmission.submission_id == submission_id)
                            .first()
                        )
                        if contest_row:
                            contest_row.verdict = record.verdict
                            contest_row.runtime_ms = record.runtime_ms
                            contest_row.memory_kb = record.memory_kb
                        rating_service.on_submission_result(
                            db,
                            user_id=record.user_id,
                            problem_id=record.problem_id,
                            submission_id=record.submission_id,
                            verdict=record.verdict,
                        )
                        db.commit()
        except Exception as error:
            self.repository.mark_failed(submission_id, str(error))
            self.logger.exception("submission.failed id=%s error=%s", submission_id, error)
            if submission.get("mode") == "submit":
                with SessionLocal() as db:
                    record = (
                        db.query(UserSubmission)
                        .filter(UserSubmission.submission_id == submission_id)
                        .first()
                    )
                    if record:
                        record.verdict = "Runtime Error"
                        record.runtime_ms = None
                        record.memory_kb = None
                        contest_row = (
                            db.query(ContestSubmission)
                            .filter(ContestSubmission.submission_id == submission_id)
                            .first()
                        )
                        if contest_row:
                            contest_row.verdict = "Runtime Error"
                            contest_row.runtime_ms = None
                            contest_row.memory_kb = None
                        db.commit()

    def get_submission(self, submission_id: str) -> dict | None:
        return self.repository.get(submission_id)


@lru_cache(maxsize=1)
def get_submission_service() -> SubmissionService:
    return SubmissionService()
