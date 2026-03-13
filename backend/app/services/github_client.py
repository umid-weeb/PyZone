from __future__ import annotations

import base64
from pathlib import Path
from typing import Any

import httpx

from app.core.config import Settings, get_settings


class ProblemSourceClient:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    @property
    def source_label(self) -> str:
        if self.settings.github_enabled:
            return f"github:{self.settings.github_owner}/{self.settings.github_repo}@{self.settings.github_branch}"
        return f"local:{self.settings.local_problem_repo}"

    async def list_directory(self, path: str) -> list[dict[str, str]]:
        if self.settings.github_enabled:
            return await self._github_list_directory(path)
        return self._local_list_directory(path)

    async def read_text(self, path: str) -> str:
        if self.settings.github_enabled:
            return await self._github_read_text(path)
        return self._local_read_text(path)

    async def _github_list_directory(self, path: str) -> list[dict[str, str]]:
        url = (
            f"https://api.github.com/repos/"
            f"{self.settings.github_owner}/{self.settings.github_repo}/contents/{path}"
        )
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(
                url,
                params={"ref": self.settings.github_branch},
                headers=self._github_headers(),
            )
            if response.status_code == 404:
                return []
            response.raise_for_status()
            payload = response.json()

        return [
            {
                "name": item["name"],
                "path": item["path"],
                "type": item["type"],
            }
            for item in payload
        ]

    async def _github_read_text(self, path: str) -> str:
        url = (
            f"https://api.github.com/repos/"
            f"{self.settings.github_owner}/{self.settings.github_repo}/contents/{path}"
        )
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(
                url,
                params={"ref": self.settings.github_branch},
                headers=self._github_headers(),
            )
            if response.status_code == 404:
                raise FileNotFoundError(path)
            response.raise_for_status()
            payload = response.json()

        if payload.get("encoding") == "base64":
            return base64.b64decode(payload["content"]).decode("utf-8")
        return payload.get("content", "")

    def _local_list_directory(self, path: str) -> list[dict[str, str]]:
        directory = self._resolve_local(path)
        if not directory.exists():
            return []

        return [
            {
                "name": child.name,
                "path": child.relative_to(self.settings.local_problem_repo).as_posix(),
                "type": "dir" if child.is_dir() else "file",
            }
            for child in sorted(directory.iterdir(), key=lambda item: item.name.lower())
        ]

    def _local_read_text(self, path: str) -> str:
        target = self._resolve_local(path)
        return target.read_text(encoding="utf-8")

    def _resolve_local(self, path: str) -> Path:
        root = self.settings.local_problem_repo.resolve()
        target = (root / path).resolve()
        if root != target and root not in target.parents:
            raise ValueError("Local problem repo path traversal is not allowed.")
        return target

    def _github_headers(self) -> dict[str, str]:
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if self.settings.github_token:
            headers["Authorization"] = f"Bearer {self.settings.github_token}"
        return headers
