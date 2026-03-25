from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class SubmissionRepository:
    def __init__(self, database_path: Path) -> None:
        self.database_path = Path(database_path)
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self._ensure_schema()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _ensure_schema(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS submissions (
                    submission_id TEXT PRIMARY KEY,
                    problem_id TEXT NOT NULL,
                    mode TEXT NOT NULL,
                    code TEXT NOT NULL,
                    language TEXT NOT NULL,
                    status TEXT NOT NULL,
                    verdict TEXT,
                    runtime_ms INTEGER,
                    memory_kb INTEGER,
                    passed_count INTEGER,
                    total_count INTEGER,
                    error_text TEXT,
                    case_results_json TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            connection.commit()

    def create(self, problem_id: str, code: str, language: str, mode: str) -> str:
        submission_id = uuid.uuid4().hex
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO submissions (
                    submission_id, problem_id, mode, code, language, status,
                    created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, 'queued', ?, ?)
                """,
                (submission_id, problem_id, mode, code, language, now, now),
            )
            connection.commit()
        return submission_id

    def mark_running(self, submission_id: str) -> None:
        self._update_status(submission_id, "running")

    def mark_failed(self, submission_id: str, error_text: str) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as connection:
            connection.execute(
                """
                UPDATE submissions
                SET status = 'completed',
                    verdict = 'Runtime Error',
                    error_text = ?,
                    updated_at = ?
                WHERE submission_id = ?
                """,
                (error_text, now, submission_id),
            )
            connection.commit()

    def complete(self, submission_id: str, result: dict[str, Any]) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as connection:
            connection.execute(
                """
                UPDATE submissions
                SET status = 'completed',
                    verdict = ?,
                    runtime_ms = ?,
                    memory_kb = ?,
                    passed_count = ?,
                    total_count = ?,
                    error_text = ?,
                    case_results_json = ?,
                    updated_at = ?
                WHERE submission_id = ?
                """,
                (
                    result.get("verdict"),
                    result.get("runtime_ms"),
                    result.get("memory_kb"),
                    result.get("passed_count"),
                    result.get("total_count"),
                    result.get("error_text"),
                    json.dumps(result.get("case_results", [])),
                    now,
                    submission_id,
                ),
            )
            connection.commit()

    def get(self, submission_id: str) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM submissions WHERE submission_id = ?",
                (submission_id,),
            ).fetchone()

        if row is None:
            return None

        payload = dict(row)
        payload["case_results"] = json.loads(payload.pop("case_results_json") or "[]")
        return payload

    def ping(self) -> dict[str, Any]:
        with self._connect() as connection:
            connection.execute("SELECT 1").fetchone()
        return {
            "status": "ok",
            "database": str(self.database_path),
        }

    def _update_status(self, submission_id: str, status: str) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as connection:
            connection.execute(
                "UPDATE submissions SET status = ?, updated_at = ? WHERE submission_id = ?",
                (status, now, submission_id),
            )
            connection.commit()
