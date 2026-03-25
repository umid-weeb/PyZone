from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import os
import time

import requests


@dataclass
class Judge0Settings:
  base_url: str
  api_key: str | None
  enabled: bool


def get_judge0_settings() -> Judge0Settings:
  base_url = os.getenv("JUDGE0_BASE_URL", "").rstrip("/")
  api_key = os.getenv("JUDGE0_API_KEY") or None
  enabled = bool(base_url)
  return Judge0Settings(base_url=base_url, api_key=api_key, enabled=enabled)


class Judge0Client:
  def __init__(self, settings: Judge0Settings | None = None) -> None:
    self.settings = settings or get_judge0_settings()

  def _headers(self) -> dict[str, str]:
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if self.settings.api_key:
      headers["X-RapidAPI-Key"] = self.settings.api_key
    return headers

  def submit(self, *, source_code: str, language_id: int, stdin: str = "") -> str:
    if not self.settings.enabled:
      raise RuntimeError("Judge0 is not configured.")

    payload = {
      "source_code": source_code,
      "language_id": language_id,
      "stdin": stdin,
    }
    response = requests.post(
      f"{self.settings.base_url}/submissions?base64_encoded=false&wait=false",
      json=payload,
      headers=self._headers(),
      timeout=10,
    )
    response.raise_for_status()
    data = response.json()
    return data.get("token")

  def get_result(self, token: str, *, timeout_seconds: float = 20.0) -> dict[str, Any]:
    if not self.settings.enabled:
      raise RuntimeError("Judge0 is not configured.")

    deadline = time.time() + timeout_seconds
    url = f"{self.settings.base_url}/submissions/{token}?base64_encoded=false"
    while time.time() < deadline:
      response = requests.get(url, headers=self._headers(), timeout=10)
      response.raise_for_status()
      payload = response.json()
      status = (payload.get("status") or {}).get("id")
      # 1 = In Queue, 2 = Processing, others are terminal
      if status not in {1, 2}:
        return payload
      time.sleep(0.7)

    raise TimeoutError("Judge0 execution timed out")

