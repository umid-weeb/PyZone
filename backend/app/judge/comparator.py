from __future__ import annotations

import json
from typing import Any

from app.judge.parser import parse_expected_output


def compare_expected_to_actual(expected_output: str, actual_value: Any) -> bool:
    expected_value = parse_expected_output(expected_output)

    if _normalize_value(expected_value) == _normalize_value(actual_value):
        return True

    actual_text = stringify_value(actual_value)
    return _normalize_text(expected_output) == _normalize_text(actual_text)


def stringify_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()

    try:
        return json.dumps(_normalize_value(value), ensure_ascii=False)
    except TypeError:
        return str(value).strip()


def _normalize_text(value: str) -> str:
    return "\n".join(" ".join(line.split()) for line in str(value).strip().splitlines())


def _normalize_value(value: Any) -> Any:
    if isinstance(value, tuple):
        return [_normalize_value(item) for item in value]
    if isinstance(value, list):
        return [_normalize_value(item) for item in value]
    if isinstance(value, dict):
        return {key: _normalize_value(item) for key, item in sorted(value.items())}
    return value
