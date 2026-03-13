from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class ProblemCache:
    def __init__(self, cache_dir: Path) -> None:
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def load_index(self) -> list[dict[str, Any]] | None:
        payload = self._load_json(self.cache_dir / "index.json")
        if payload is None:
            return None
        return payload.get("items", [])

    def save_index(self, items: list[dict[str, Any]]) -> None:
        self._save_json(self.cache_dir / "index.json", {"items": items})

    def load_problem(self, problem_id: str) -> dict[str, Any] | None:
        return self._load_json(self.cache_dir / f"{problem_id}.json")

    def save_problem(self, problem_id: str, payload: dict[str, Any]) -> None:
        self._save_json(self.cache_dir / f"{problem_id}.json", payload)

    def _load_json(self, path: Path) -> dict[str, Any] | None:
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))

    def _save_json(self, path: Path, payload: dict[str, Any]) -> None:
        path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
