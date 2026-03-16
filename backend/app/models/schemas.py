from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ProblemSummary(BaseModel):
    id: str
    slug: str
    title: str
    difficulty: str
    tags: list[str] = Field(default_factory=list)
    preview: str | None = None
    acceptance_rate: int | None = None
    is_solved: bool = False
    time_limit_seconds: float | None = None
    memory_limit_mb: int | None = None


class VisibleTestcase(BaseModel):
    name: str
    input: str
    expected_output: str


class ProblemDetail(ProblemSummary):
    description: str
    starter_code: str
    function_name: str
    input_format: str | None = None
    output_format: str | None = None
    constraints: list[str] = Field(default_factory=list)
    visible_testcases: list[VisibleTestcase] = Field(default_factory=list)
    hidden_testcase_count: int = 0


class ProblemListResponse(BaseModel):
    items: list[ProblemSummary]
    total: int
    page: int
    per_page: int
    total_pages: int
    query: str | None = None
    selected_tags: list[str] = Field(default_factory=list)
    available_tags: list[str] = Field(default_factory=list)
    source: str
    easy_only: bool = False


class SubmissionRequest(BaseModel):
    problem_id: str
    code: str
    language: Literal["python", "javascript", "cpp"] = "python"
    contest_id: str | None = None


class SubmissionCreated(BaseModel):
    submission_id: str
    status: str


class CaseResult(BaseModel):
    name: str
    verdict: str
    passed: bool
    runtime_ms: int | None = None
    memory_kb: int | None = None
    input: str | None = None
    expected_output: str | None = None
    actual_output: str | None = None
    hidden: bool = False
    error: str | None = None


class SubmissionStatus(BaseModel):
    submission_id: str
    problem_id: str
    mode: Literal["run", "submit"]
    language: str
    status: str
    verdict: str | None = None
    runtime_ms: int | None = None
    memory_kb: int | None = None
    passed_count: int | None = None
    total_count: int | None = None
    created_at: datetime
    updated_at: datetime
    error_text: str | None = None
    case_results: list[CaseResult] = Field(default_factory=list)
