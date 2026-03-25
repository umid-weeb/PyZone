from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    app_name: str
    api_prefix: str
    backend_root: Path
    data_dir: Path
    cache_dir: Path
    local_problem_repo: Path
    hidden_test_root: Path
    submissions_db_path: Path
    github_owner: str
    github_repo: str
    github_branch: str
    github_token: str
    github_problem_root: str
    hidden_github_owner: str
    hidden_github_repo: str
    hidden_github_branch: str
    hidden_github_token: str
    hidden_github_problem_root: str
    redis_url: str
    use_inline_execution: bool
    judge_use_docker: bool
    judge_docker_image: str
    judge_cpu_limit: float
    judge_pids_limit: int
    cache_ttl_seconds: int
    frontend_api_base: str
    log_level: str
    cors_allow_origins: list[str]
    jwt_secret: str

    @property
    def github_enabled(self) -> bool:
        return bool(self.github_owner and self.github_repo)

    @property
    def hidden_github_enabled(self) -> bool:
        return bool(self.hidden_github_owner and self.hidden_github_repo)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    backend_root = Path(__file__).resolve().parents[2]
    data_dir = backend_root / ".data"
    cache_dir = backend_root / ".cache" / "problems"
    local_problem_repo = backend_root / "examples" / "problem_repo"
    hidden_test_root = Path(
        os.getenv(
            "ARENA_HIDDEN_TEST_ROOT",
            str(data_dir / "secure_problem_store" / "problems"),
        )
    )
    submissions_db_path = data_dir / "submissions.sqlite3"

    data_dir.mkdir(parents=True, exist_ok=True)
    cache_dir.mkdir(parents=True, exist_ok=True)
    hidden_test_root.mkdir(parents=True, exist_ok=True)

    cors_raw = os.getenv("ARENA_CORS_ALLOW_ORIGINS", "*")
    cors_allow_origins = [item.strip() for item in cors_raw.split(",") if item.strip()]

    return Settings(
        app_name=os.getenv("ARENA_APP_NAME", "Pyzone Arena Backend"),
        api_prefix=os.getenv("ARENA_API_PREFIX", "/api"),
        backend_root=backend_root,
        data_dir=data_dir,
        cache_dir=cache_dir,
        local_problem_repo=local_problem_repo,
        hidden_test_root=hidden_test_root,
        submissions_db_path=submissions_db_path,
        github_owner=os.getenv("ARENA_GITHUB_OWNER", ""),
        github_repo=os.getenv("ARENA_GITHUB_REPO", ""),
        github_branch=os.getenv("ARENA_GITHUB_BRANCH", "main"),
        github_token=os.getenv("ARENA_GITHUB_TOKEN", ""),
        github_problem_root=os.getenv("ARENA_GITHUB_PROBLEM_ROOT", "problems").strip("/"),
        hidden_github_owner=os.getenv("ARENA_HIDDEN_GITHUB_OWNER", ""),
        hidden_github_repo=os.getenv("ARENA_HIDDEN_GITHUB_REPO", ""),
        hidden_github_branch=os.getenv("ARENA_HIDDEN_GITHUB_BRANCH", "main"),
        hidden_github_token=os.getenv("ARENA_HIDDEN_GITHUB_TOKEN", ""),
        hidden_github_problem_root=os.getenv(
            "ARENA_HIDDEN_GITHUB_PROBLEM_ROOT",
            "problems",
        ).strip("/"),
        redis_url=os.getenv("ARENA_REDIS_URL", "redis://localhost:6379/0"),
        use_inline_execution=_env_bool("ARENA_USE_INLINE_EXECUTION", True),
        judge_use_docker=_env_bool("ARENA_JUDGE_USE_DOCKER", False),
        judge_docker_image=os.getenv("ARENA_JUDGE_DOCKER_IMAGE", "python:3.11-slim"),
        judge_cpu_limit=float(os.getenv("ARENA_JUDGE_CPU_LIMIT", "1")),
        judge_pids_limit=int(os.getenv("ARENA_JUDGE_PIDS_LIMIT", "64")),
        cache_ttl_seconds=int(os.getenv("ARENA_CACHE_TTL_SECONDS", "300")),
        frontend_api_base=os.getenv("ARENA_FRONTEND_API_BASE", "/api"),
        log_level=os.getenv("ARENA_LOG_LEVEL", "INFO").upper(),
        jwt_secret=os.getenv("ARENA_JWT_SECRET", "dev-secret-change-me"),
        cors_allow_origins=cors_allow_origins or ["*"],
    )
