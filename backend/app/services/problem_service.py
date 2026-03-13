from __future__ import annotations

import re
from functools import lru_cache
from typing import Any

import yaml

from app.core.config import get_settings
from app.judge.parser import parse_memory_limit_mb, parse_time_limit_seconds
from app.models.schemas import ProblemDetail, ProblemSummary
from app.services.github_client import ProblemSourceClient
from app.services.problem_cache import ProblemCache


class ProblemNotFoundError(Exception):
    """Raised when a problem cannot be located in the source repository."""


class ProblemService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.source = ProblemSourceClient(self.settings)
        self.cache = ProblemCache(self.settings.cache_dir)

    @property
    def source_label(self) -> str:
        return self.source.source_label

    async def list_problems(self, force_refresh: bool = False) -> list[ProblemSummary]:
        if not force_refresh:
            cached = self.cache.load_index()
            if cached is not None:
                return [ProblemSummary.model_validate(item) for item in cached]

        entries = await self.source.list_directory(self.settings.github_problem_root)
        problems: list[ProblemSummary] = []

        for entry in entries:
            if entry["type"] != "dir":
                continue

            summary = await self._load_problem_summary(entry["name"])
            if summary is not None and summary.difficulty.lower() == "easy":
                problems.append(summary)

        problems.sort(key=lambda item: item.title.lower())
        self.cache.save_index([item.model_dump() for item in problems])
        return problems

    async def get_problem(self, problem_id: str, force_refresh: bool = False) -> ProblemDetail:
        bundle = await self.get_problem_bundle(problem_id, force_refresh=force_refresh)
        public_payload = dict(bundle)
        public_payload.pop("hidden_testcases", None)
        return ProblemDetail.model_validate(public_payload)

    async def get_problem_bundle(
        self,
        problem_id: str,
        force_refresh: bool = False,
    ) -> dict[str, Any]:
        if not force_refresh:
            cached = self.cache.load_problem(problem_id)
            if cached is not None:
                return cached

        base_path = f"{self.settings.github_problem_root}/{problem_id}"

        try:
            metadata_text = await self.source.read_text(f"{base_path}/metadata.yaml")
            description = await self.source.read_text(f"{base_path}/problem.md")
            starter_code = await self.source.read_text(f"{base_path}/starter_code.py")
        except FileNotFoundError as error:
            raise ProblemNotFoundError(problem_id) from error

        metadata = yaml.safe_load(metadata_text) or {}
        visible_testcases = await self._load_testcases(problem_id, "visible")
        hidden_testcases = await self._load_testcases(problem_id, "hidden")

        bundle = {
            "id": problem_id,
            "title": metadata.get("title") or self._humanize(problem_id),
            "difficulty": str(metadata.get("difficulty", "easy")).lower(),
            "description": description,
            "starter_code": starter_code,
            "function_name": metadata.get("function_name", "solve"),
            "input_format": metadata.get("input_format"),
            "output_format": metadata.get("output_format"),
            "constraints": self._normalize_list(metadata.get("constraints")),
            "tags": self._normalize_list(metadata.get("tags")),
            "time_limit_seconds": parse_time_limit_seconds(metadata.get("time_limit")),
            "memory_limit_mb": parse_memory_limit_mb(metadata.get("memory_limit")),
            "visible_testcases": visible_testcases,
            "hidden_testcases": hidden_testcases,
            "hidden_testcase_count": len(hidden_testcases),
        }

        self.cache.save_problem(problem_id, bundle)
        return bundle

    async def _load_problem_summary(self, problem_id: str) -> ProblemSummary | None:
        base_path = f"{self.settings.github_problem_root}/{problem_id}"
        try:
            metadata_text = await self.source.read_text(f"{base_path}/metadata.yaml")
        except FileNotFoundError:
            return None

        metadata = yaml.safe_load(metadata_text) or {}
        return ProblemSummary(
            id=problem_id,
            title=metadata.get("title") or self._humanize(problem_id),
            difficulty=str(metadata.get("difficulty", "easy")).lower(),
            tags=self._normalize_list(metadata.get("tags")),
            time_limit_seconds=parse_time_limit_seconds(metadata.get("time_limit")),
            memory_limit_mb=parse_memory_limit_mb(metadata.get("memory_limit")),
        )

    async def _load_testcases(self, problem_id: str, visibility: str) -> list[dict[str, Any]]:
        directory = (
            f"{self.settings.github_problem_root}/{problem_id}/tests/{visibility}"
        )
        entries = await self.source.list_directory(directory)
        input_files: dict[str, str] = {}
        output_files: dict[str, str] = {}

        for entry in entries:
            if entry["type"] != "file":
                continue
            name = entry["name"]
            if name.startswith("input"):
                input_files[self._suffix(name, "input")] = entry["path"]
            if name.startswith("output"):
                output_files[self._suffix(name, "output")] = entry["path"]

        testcase_keys = sorted(
            set(input_files) & set(output_files),
            key=self._sort_suffix,
        )

        testcases: list[dict[str, Any]] = []
        for index, key in enumerate(testcase_keys, start=1):
            testcases.append(
                {
                    "name": f"Case {index}",
                    "input": (await self.source.read_text(input_files[key])).strip(),
                    "expected_output": (
                        await self.source.read_text(output_files[key])
                    ).strip(),
                    "hidden": visibility == "hidden",
                }
            )

        return testcases

    def _suffix(self, filename: str, prefix: str) -> str:
        return filename[len(prefix) :]

    def _sort_suffix(self, value: str) -> tuple[int, str]:
        match = re.search(r"(\d+)", value)
        return (int(match.group(1)) if match else 0, value)

    def _humanize(self, problem_id: str) -> str:
        return problem_id.replace("_", " ").replace("-", " ").title()

    def _normalize_list(self, value: Any) -> list[str]:
        if value is None:
            return []
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return [str(item).strip() for item in value if str(item).strip()]


@lru_cache(maxsize=1)
def get_problem_service() -> ProblemService:
    return ProblemService()
