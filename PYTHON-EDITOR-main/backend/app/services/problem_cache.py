from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any


class ProblemCache:
    def __init__(self, cache_dir: Path, ttl_seconds: int = 300, redis_client=None) -> None:
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.ttl_seconds = max(1, int(ttl_seconds))
        self.hit_count = 0
        self.miss_count = 0
        self.redis = redis_client

    def load_index(self) -> list[dict[str, Any]] | None:
        payload = self._load_json(self.cache_dir / "index.json", redis_key="index")
        if payload is None:
            return None
        return payload.get("items", [])

    def save_index(self, items: list[dict[str, Any]]) -> None:
        self._save_json(self.cache_dir / "index.json", {"items": items}, redis_key="index")

    def load_problem(self, problem_id: str) -> dict[str, Any] | None:
        return self._load_json(self.cache_dir / f"{problem_id}.json", redis_key=f"problem:{problem_id}")

    def save_problem(self, problem_id: str, payload: dict[str, Any]) -> None:
        self._save_json(self.cache_dir / f"{problem_id}.json", payload, redis_key=f"problem:{problem_id}")

    def status(self) -> dict[str, Any]:
        file_count = sum(1 for _ in self.cache_dir.glob("*.json"))
        return {
          "directory": str(self.cache_dir),
          "ttl_seconds": self.ttl_seconds,
          "files": file_count,
          "hits": self.hit_count,
          "misses": self.miss_count,
        }

    def _load_json(self, path: Path, redis_key: str | None = None) -> dict[str, Any] | None:
        if self.redis and redis_key:
            raw = self.redis.get(redis_key)
            if raw:
                self.hit_count += 1
                return json.loads(raw)

        if not path.exists():
            self.miss_count += 1
            return None

        payload = json.loads(path.read_text(encoding="utf-8"))
        saved_at = payload.get("_saved_at")
        ttl_seconds = int(payload.get("_ttl_seconds", self.ttl_seconds))
        if saved_at is not None and time.time() - float(saved_at) > ttl_seconds:
            self.miss_count += 1
            return None

        self.hit_count += 1
        if "_payload" in payload:
            return payload["_payload"]
        return payload

    def _save_json(self, path: Path, payload: dict[str, Any], redis_key: str | None = None) -> None:
        envelope = {
            "_saved_at": time.time(),
            "_ttl_seconds": self.ttl_seconds,
            "_payload": payload,
        }

        if self.redis and redis_key:
            self.redis.setex(redis_key, self.ttl_seconds, json.dumps(payload, ensure_ascii=False))

        path.write_text(
            json.dumps(envelope, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
