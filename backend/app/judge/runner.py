from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

from app.core.config import Settings, get_settings
from app.judge.comparator import compare_expected_to_actual, stringify_value
from app.judge.parser import parse_arguments


HARNESS_CODE = """\
import contextlib
import importlib.util
import io
import json
import pathlib
import time
import traceback
import tracemalloc

workspace = pathlib.Path(__file__).resolve().parent
payload = json.loads((workspace / "payload.json").read_text(encoding="utf-8"))
submission_path = workspace / "submission.py"

spec = importlib.util.spec_from_file_location("submission", submission_path)
module = importlib.util.module_from_spec(spec)

try:
    spec.loader.exec_module(module)
except SyntaxError as exc:
    print(json.dumps({
        "verdict": "Compilation Error",
        "error": "".join(traceback.format_exception_only(type(exc), exc)).strip(),
        "runtime_ms": 0,
        "memory_kb": 0
    }, ensure_ascii=False))
    raise SystemExit(0)
except Exception as exc:
    print(json.dumps({
        "verdict": "Runtime Error",
        "error": traceback.format_exc(),
        "runtime_ms": 0,
        "memory_kb": 0
    }, ensure_ascii=False))
    raise SystemExit(0)

try:
    if hasattr(module, "Solution"):
        target = getattr(module.Solution(), payload["function_name"])
    else:
        target = getattr(module, payload["function_name"])
except AttributeError as exc:
    print(json.dumps({
        "verdict": "Runtime Error",
        "error": f"Function topilmadi: {payload['function_name']}",
        "runtime_ms": 0,
        "memory_kb": 0
    }, ensure_ascii=False))
    raise SystemExit(0)

stdout_buffer = io.StringIO()
tracemalloc.start()
started = time.perf_counter()

try:
    with contextlib.redirect_stdout(stdout_buffer):
        result = target(*payload.get("args", []))
    runtime_ms = int((time.perf_counter() - started) * 1000)
    current, peak = tracemalloc.get_traced_memory()
    actual = result if result is not None else stdout_buffer.getvalue().strip()
    print(json.dumps({
        "verdict": "Accepted",
        "actual": actual,
        "runtime_ms": runtime_ms,
        "memory_kb": int(peak / 1024)
    }, ensure_ascii=False, default=repr))
except MemoryError as exc:
    runtime_ms = int((time.perf_counter() - started) * 1000)
    current, peak = tracemalloc.get_traced_memory()
    print(json.dumps({
        "verdict": "Memory Limit Exceeded",
        "error": "".join(traceback.format_exception_only(type(exc), exc)).strip(),
        "runtime_ms": runtime_ms,
        "memory_kb": int(peak / 1024)
    }, ensure_ascii=False))
except Exception:
    runtime_ms = int((time.perf_counter() - started) * 1000)
    current, peak = tracemalloc.get_traced_memory()
    print(json.dumps({
        "verdict": "Runtime Error",
        "error": traceback.format_exc(),
        "runtime_ms": runtime_ms,
        "memory_kb": int(peak / 1024)
    }, ensure_ascii=False))
finally:
    tracemalloc.stop()
"""


class JudgeRunner:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    def run_submission(
        self,
        problem: dict[str, Any],
        code: str,
        mode: str,
    ) -> dict[str, Any]:
        visible = list(problem.get("visible_testcases", []))
        hidden = list(problem.get("hidden_testcases", []))
        selected = visible[:4] if mode == "run" else visible + hidden

        if not selected:
            return {
                "verdict": "Runtime Error",
                "runtime_ms": 0,
                "memory_kb": 0,
                "passed_count": 0,
                "total_count": 0,
                "error_text": "Masala uchun testcase topilmadi.",
                "case_results": [],
            }

        case_results: list[dict[str, Any]] = []
        verdict = "Accepted"
        passed_count = 0
        runtime_total = 0
        memory_peak = 0
        error_text = None

        for testcase in selected:
            execution = self._execute_case(problem, code, testcase)
            runtime_total += execution.get("runtime_ms", 0) or 0
            memory_peak = max(memory_peak, execution.get("memory_kb", 0) or 0)

            is_hidden = bool(testcase.get("hidden")) and mode == "submit"
            case_result = {
                "name": testcase.get("name", "Case"),
                "verdict": execution["verdict"],
                "passed": execution["passed"],
                "runtime_ms": execution.get("runtime_ms"),
                "memory_kb": execution.get("memory_kb"),
                "input": None if is_hidden else testcase.get("input"),
                "expected_output": None if is_hidden else testcase.get("expected_output"),
                "actual_output": execution.get("actual_output"),
                "hidden": is_hidden,
                "error": execution.get("error"),
            }
            case_results.append(case_result)

            if execution["passed"]:
                passed_count += 1
                continue

            verdict = execution["verdict"]
            error_text = execution.get("error")
            if mode == "submit":
                break

        return {
            "verdict": verdict,
            "runtime_ms": runtime_total,
            "memory_kb": memory_peak,
            "passed_count": passed_count,
            "total_count": len(selected),
            "error_text": error_text,
            "case_results": case_results,
        }

    def _execute_case(
        self,
        problem: dict[str, Any],
        code: str,
        testcase: dict[str, Any],
    ) -> dict[str, Any]:
        args = parse_arguments(testcase.get("input", ""))

        with tempfile.TemporaryDirectory(prefix="arena-judge-") as temp_dir:
            workspace = Path(temp_dir)
            (workspace / "submission.py").write_text(code, encoding="utf-8")
            (workspace / "harness.py").write_text(HARNESS_CODE, encoding="utf-8")
            (workspace / "payload.json").write_text(
                json.dumps(
                    {
                        "function_name": problem["function_name"],
                        "args": args,
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )

            result = self._invoke_runner(
                workspace=workspace,
                time_limit_seconds=problem.get("time_limit_seconds", 1.0),
                memory_limit_mb=problem.get("memory_limit_mb", 256),
            )

        return self._evaluate_case_result(
            testcase=testcase,
            execution_result=result,
        )

    def _invoke_runner(
        self,
        workspace: Path,
        time_limit_seconds: float,
        memory_limit_mb: int,
    ) -> dict[str, Any]:
        timeout_seconds = max(1.0, float(time_limit_seconds) + 1.0)

        if self.settings.judge_use_docker:
            command = [
                "docker",
                "run",
                "--rm",
                "--network",
                "none",
                "--cpus",
                str(self.settings.judge_cpu_limit),
                "--memory",
                f"{int(memory_limit_mb)}m",
                "--pids-limit",
                str(self.settings.judge_pids_limit),
                "--read-only",
                "--cap-drop",
                "ALL",
                "--security-opt",
                "no-new-privileges",
                "--tmpfs",
                "/tmp:rw,noexec,nosuid,size=64m",
                "-e",
                "PYTHONDONTWRITEBYTECODE=1",
                "-v",
                f"{workspace.resolve()}:/workspace:ro",
                "-w",
                "/workspace",
                self.settings.judge_docker_image,
                "python",
                "-I",
                "harness.py",
            ]
        else:
            command = [sys.executable, "-I", "harness.py"]

        try:
            completed = subprocess.run(
                command,
                cwd=workspace,
                capture_output=True,
                text=True,
                timeout=timeout_seconds,
                check=False,
            )
        except subprocess.TimeoutExpired:
            return {
                "verdict": "Time Limit Exceeded",
                "passed": False,
                "runtime_ms": int(timeout_seconds * 1000),
                "memory_kb": 0,
                "actual_output": "",
                "error": "Execution timed out.",
            }

        if completed.returncode != 0 and not completed.stdout.strip():
            if completed.returncode in {137, 139}:
                verdict = "Memory Limit Exceeded"
            else:
                verdict = "Runtime Error"
            return {
                "verdict": verdict,
                "passed": False,
                "runtime_ms": 0,
                "memory_kb": 0,
                "actual_output": completed.stdout.strip(),
                "error": completed.stderr.strip() or "Judge process failed.",
            }

        try:
            payload = json.loads(completed.stdout.strip() or "{}")
        except json.JSONDecodeError:
            return {
                "verdict": "Runtime Error",
                "passed": False,
                "runtime_ms": 0,
                "memory_kb": 0,
                "actual_output": completed.stdout.strip(),
                "error": completed.stderr.strip() or "Judge JSON natija qaytarmadi.",
            }

        payload["passed"] = payload.get("verdict") == "Accepted"
        payload["actual_output"] = stringify_value(payload.get("actual"))
        return payload

    def _evaluate_case_result(
        self,
        testcase: dict[str, Any],
        execution_result: dict[str, Any],
    ) -> dict[str, Any]:
        if execution_result["verdict"] != "Accepted":
            execution_result["passed"] = False
            return execution_result

        actual_value = execution_result.get("actual")
        passed = compare_expected_to_actual(testcase.get("expected_output", ""), actual_value)
        if passed:
            execution_result["passed"] = True
            execution_result["actual_output"] = stringify_value(actual_value)
            return execution_result

        return {
            "verdict": "Wrong Answer",
            "passed": False,
            "runtime_ms": execution_result.get("runtime_ms", 0),
            "memory_kb": execution_result.get("memory_kb", 0),
            "actual_output": stringify_value(actual_value),
            "error": None,
        }
