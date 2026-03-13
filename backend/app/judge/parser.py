from __future__ import annotations

import ast
import json
import re
from typing import Any


def parse_text_value(raw: str) -> Any:
    stripped = raw.strip()
    if stripped == "":
        return ""

    for parser in (json.loads, ast.literal_eval):
        try:
            return parser(stripped)
        except (ValueError, SyntaxError, json.JSONDecodeError):
            continue

    return stripped


def parse_arguments(input_text: str) -> list[Any]:
    lines = [line for line in input_text.splitlines() if line.strip() != ""]
    return [parse_text_value(line) for line in lines]


def parse_expected_output(output_text: str) -> Any:
    stripped = output_text.strip()
    if stripped == "":
        return ""

    if "\n" not in stripped:
        return parse_text_value(stripped)

    return "\n".join(line.rstrip() for line in output_text.splitlines()).strip()


def parse_time_limit_seconds(raw_value: str | int | float | None) -> float:
    if raw_value is None:
        return 1.0
    if isinstance(raw_value, (int, float)):
        return float(raw_value)

    match = re.search(r"(\d+(?:\.\d+)?)", str(raw_value))
    return float(match.group(1)) if match else 1.0


def parse_memory_limit_mb(raw_value: str | int | None) -> int:
    if raw_value is None:
        return 256
    if isinstance(raw_value, int):
        return raw_value

    match = re.search(r"(\d+)", str(raw_value))
    return int(match.group(1)) if match else 256
