from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

import redis
from sqlalchemy import or_
from sqlalchemy.orm import joinedload

from app.core.config import get_settings
from app.database import SessionLocal
from app.models.problem import Problem
from app.models.schemas import ProblemDetail, ProblemSummary
from app.services.problem_cache import ProblemCache


class ProblemNotFoundError(Exception):
    """Raised when a problem cannot be located."""


class ProblemService:
    def __init__(self) -> None:
        self.settings = get_settings()
        redis_client = None
        try:
            if self.settings.redis_url:
                candidate = redis.from_url(self.settings.redis_url, decode_responses=True)
                candidate.ping()
                redis_client = candidate
        except Exception:
            redis_client = None

        self.cache = ProblemCache(
            self.settings.cache_dir,
            ttl_seconds=self.settings.cache_ttl_seconds,
            redis_client=redis_client,
        )
        self._source_label = "database"

    @property
    def source_label(self) -> str:
        return self._source_label

    async def list_problems(self, force_refresh: bool = False) -> list[ProblemSummary]:
        if not force_refresh:
            cached = self.cache.load_index()
            if cached is not None and all(isinstance(item, dict) and item.get("slug") for item in cached):
                return [ProblemSummary.model_validate(item) for item in cached]

        with SessionLocal() as db:
            problems = (
                db.query(Problem)
                .order_by(Problem.title.asc())
                .all()
            )

        items = [self._build_summary(problem) for problem in problems]
        self.cache.save_index([item.model_dump() for item in items])
        return items

    async def list_problem_page(
        self,
        *,
        page: int = 1,
        per_page: int = 200,
        query: str = "",
        tags: list[str] | None = None,
        difficulty: str | None = None,
        force_refresh: bool = False,
    ) -> dict[str, Any]:
        all_items = await self.list_problems(force_refresh=force_refresh)
        normalized_query = query.strip().lower()
        normalized_tags = [tag.strip().lower() for tag in (tags or []) if tag.strip()]
        normalized_difficulty = (difficulty or "").strip().lower()

        filtered = []
        for item in all_items:
            haystack = " ".join(
                [
                    item.id,
                    item.slug,
                    item.title,
                    item.preview or "",
                    *item.tags,
                ]
            ).lower()
            matches_query = not normalized_query or normalized_query in haystack
            matches_tags = not normalized_tags or all(
                tag in [problem_tag.lower() for problem_tag in item.tags]
                for tag in normalized_tags
            )
            matches_difficulty = (
                not normalized_difficulty
                or str(item.difficulty or "").strip().lower() == normalized_difficulty
            )
            if matches_query and matches_tags and matches_difficulty:
                filtered.append(item)

        total = len(filtered)
        safe_per_page = max(1, min(per_page, 500))
        total_pages = max(1, (total + safe_per_page - 1) // safe_per_page)
        safe_page = min(max(1, page), total_pages)
        start = (safe_page - 1) * safe_per_page
        end = start + safe_per_page

        available_tags = sorted({tag for item in all_items for tag in item.tags if tag})

        return {
            "items": filtered[start:end],
            "total": total,
            "page": safe_page,
            "per_page": safe_per_page,
            "total_pages": total_pages,
            "query": query or None,
            "selected_tags": normalized_tags,
            "available_tags": available_tags,
        }

    async def get_problem(self, problem_key: str, force_refresh: bool = False) -> ProblemDetail:
        bundle = await self.get_problem_bundle(problem_key, force_refresh=force_refresh)
        public_payload = dict(bundle)
        public_payload.pop("hidden_testcases", None)
        return ProblemDetail.model_validate(public_payload)

    async def get_problem_bundle(self, problem_key: str, force_refresh: bool = False) -> dict[str, Any]:
        if not force_refresh:
            cached = self.cache.load_problem(problem_key)
            if cached is not None and cached.get("slug"):
                return cached

        with SessionLocal() as db:
            problem = (
                db.query(Problem)
                .options(joinedload(Problem.test_cases))
                .filter(or_(Problem.slug == problem_key, Problem.id == problem_key))
                .first()
            )

        if problem is None:
            raise ProblemNotFoundError(problem_key)

        bundle = self._build_problem_bundle(problem)
        self.cache.save_problem(problem.slug, bundle)
        if problem.slug != problem_key:
            self.cache.save_problem(problem_key, bundle)
        return bundle

    def _build_summary(self, problem: Problem) -> ProblemSummary:
        constraints = self._split_constraints(problem.constraints_text)
        tags = self._load_tags(problem.tags_json)
        preview = constraints[0] if constraints else (problem.input_format or None)

        return ProblemSummary(
            id=problem.id,
            slug=problem.slug,
            title=problem.title,
            difficulty=problem.difficulty.lower(),
            tags=tags,
            preview=preview,
            acceptance_rate=None,
            is_solved=False,
            time_limit_seconds=2.0,
            memory_limit_mb=256,
        )

    def _build_problem_bundle(self, problem: Problem) -> dict[str, Any]:
        visible_testcases = []
        hidden_testcases = []

        for index, test_case in enumerate(problem.test_cases, start=1):
            payload = {
                "name": f"Case {index}",
                "input": test_case.input.strip(),
                "expected_output": test_case.expected_output.strip(),
                "hidden": bool(test_case.is_hidden),
            }
            if test_case.is_hidden:
                hidden_testcases.append(payload)
            else:
                visible_testcases.append(payload)

        constraints = self._split_constraints(problem.constraints_text)
        tags = self._load_tags(problem.tags_json)

        return {
            "id": problem.id,
            "slug": problem.slug,
            "title": problem.title,
            "difficulty": problem.difficulty.lower(),
            "description": problem.description,
            "starter_code": problem.starter_code,
            "function_name": problem.function_name or "solve",
            "input_format": problem.input_format,
            "output_format": problem.output_format,
            "constraints": constraints,
            "tags": tags,
            "time_limit_seconds": 2.0,
            "memory_limit_mb": 256,
            "visible_testcases": visible_testcases,
            "hidden_testcases": hidden_testcases,
            "hidden_testcase_count": len(hidden_testcases),
        }

    def _split_constraints(self, raw_value: str | None) -> list[str]:
        if not raw_value:
            return []
        return [line.strip() for line in str(raw_value).splitlines() if line.strip()]

    def _load_tags(self, raw_value: str | None) -> list[str]:
        if not raw_value:
            return []
        try:
            payload = json.loads(raw_value)
            if isinstance(payload, list):
                return [str(item).strip() for item in payload if str(item).strip()]
        except json.JSONDecodeError:
            pass
        return [item.strip() for item in str(raw_value).split(",") if item.strip()]


@lru_cache(maxsize=1)
def get_problem_service() -> ProblemService:
    return ProblemService()
