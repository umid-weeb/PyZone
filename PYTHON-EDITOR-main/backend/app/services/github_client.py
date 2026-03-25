from __future__ import annotations

import asyncio
import base64
import logging
from pathlib import Path
from typing import Any

import httpx

from app.core.config import Settings, get_settings


class ProblemSourceClient:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.logger = logging.getLogger("pyzone.arena.github")
        self.last_fetch_status = "idle"
        self.last_fetch_source = "local"

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
        self.last_fetch_source = "github"
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await self._perform_github_request(
                client,
                url,
                params={"ref": self.settings.github_branch},
            )
            if response.status_code == 404:
                self.last_fetch_status = "404"
                return []
            self.last_fetch_status = str(response.status_code)
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
        self.last_fetch_source = "github"
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await self._perform_github_request(
                client,
                url,
                params={"ref": self.settings.github_branch},
            )
            if response.status_code == 404:
                self.last_fetch_status = "404"
                raise FileNotFoundError(path)
            self.last_fetch_status = str(response.status_code)
            response.raise_for_status()
            payload = response.json()

        if payload.get("encoding") == "base64":
            return base64.b64decode(payload["content"]).decode("utf-8")
        return payload.get("content", "")

    def _local_list_directory(self, path: str) -> list[dict[str, str]]:
        self.last_fetch_source = "local"
        self.last_fetch_status = "local-ok"
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
        self.last_fetch_source = "local"
        self.last_fetch_status = "local-ok"
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

    async def _perform_github_request(
        self,
        client: httpx.AsyncClient,
        url: str,
        *,
        params: dict[str, Any],
    ) -> httpx.Response:
        last_error: Exception | None = None
        for attempt in range(3):
            try:
                response = await client.get(
                    url,
                    params=params,
                    headers=self._github_headers(),
                )
                if response.status_code in {429, 500, 502, 503, 504} and attempt < 2:
                    await asyncio.sleep(0.35 * 2**attempt)
                    continue
                return response
            except (httpx.TimeoutException, httpx.TransportError) as error:
                last_error = error
                if attempt >= 2:
                    break
                await asyncio.sleep(0.35 * 2**attempt)

        raise RuntimeError(f"GitHub request failed for {url}: {last_error}")
