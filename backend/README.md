# Pyzone Arena Backend

## Overview

This backend adds a LeetCode-style problem solving arena to the existing Python editor.

Architecture:

- Frontend arena page: `public/arena.html`, `public/arena/arena.css`, `public/arena/arena.js`
- API layer: FastAPI routes under `backend/app/api/routes`
- Problem source: GitHub API or local sample repository
- Cache layer: filesystem cache under `backend/.cache/problems`
- Submission store: SQLite under `backend/.data/submissions.sqlite3`
- Async execution: Celery + Redis, with inline-thread fallback for development
- Judge: metadata-driven runner with Docker sandbox support

## Frontend Structure

- `ProblemList`: GitHub-backed easy problem navigator with search
- `ProblemDescription`: markdown description, metadata, tags, limits
- `CodeEditor`: CodeMirror-based Python editor with starter code preload
- `RunButton`: executes only visible tests
- `SubmitButton`: executes visible + hidden tests
- `TestcasePanel`: shows 3-4 visible testcases
- `ResultPanel`: verdict, runtime, memory, pass count, per-case output

## Backend Structure

- `app/main.py`: FastAPI entrypoint
- `app/api/routes/problems.py`: `GET /problems`, `GET /problem/{id}`
- `app/api/routes/submissions.py`: `POST /run`, `POST /submit`, `GET /submission/{id}`
- `app/services/github_client.py`: reads problem files from GitHub API
- `app/services/problem_service.py`: metadata parsing, cache orchestration, testcase loading
- `app/services/submission_service.py`: queueing and worker execution
- `app/repositories/submissions.py`: SQLite submission persistence
- `app/judge/parser.py`: testcase input parsing
- `app/judge/comparator.py`: exact + whitespace tolerant comparison
- `app/judge/runner.py`: isolated execution orchestration
- `app/worker/tasks.py`: Celery task entrypoint

## Judge Flow

1. User clicks `Run` or `Submit`.
2. Frontend sends code to `POST /api/run` or `POST /api/submit`.
3. API creates a submission record and queues work.
4. Worker fetches problem metadata, starter contract, visible/hidden tests.
5. Judge creates a temporary workspace with:
   - `submission.py`
   - `payload.json`
   - `harness.py`
6. Runner executes code in Docker (`--network none`, CPU/memory/pids limits) or local dev mode fallback.
7. Harness imports `Solution`, calls the metadata-defined function, captures return value/stdout, runtime and memory.
8. Comparator validates actual vs expected output.
9. API exposes verdict and analytics through `GET /api/submission/{id}`.

Supported verdicts:

- `Accepted`
- `Wrong Answer`
- `Time Limit Exceeded`
- `Runtime Error`
- `Memory Limit Exceeded`
- `Compilation Error`

## GitHub Problem Repository Format

Each problem must live in a GitHub repository under:

```text
problems/
  two_sum/
    problem.md
    metadata.yaml
    starter_code.py
    solution.py
    tests/
      visible/
        input1.txt
        output1.txt
      hidden/
        input1.txt
        output1.txt
```

`metadata.yaml` example:

```yaml
title: Two Sum
difficulty: easy
time_limit: 1 second
memory_limit: 256 MB
function_name: twoSum
input_format: nums, target
output_format: indices
constraints:
  - 2 <= nums.length <= 10000
  - -10^9 <= nums[i], target <= 10^9
tags:
  - array
  - hashmap
```

## Running Locally

1. Copy `.env.example` to `.env`.
2. For GitHub-backed mode, set:
   - `ARENA_GITHUB_OWNER`
   - `ARENA_GITHUB_REPO`
   - `ARENA_GITHUB_BRANCH`
   - `ARENA_GITHUB_TOKEN` if needed
3. Install dependencies:

```bash
pip install -r backend/requirements.txt
```

4. Start API:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

5. Optional async stack:

```bash
docker compose up --build
```

## Production Notes

- Populate the configured GitHub problem repo with 100+ easy problems.
- Keep hidden tests only in the backend source repo and never expose them in API responses.
- Enable Docker judge mode in production for sandboxing.
- Move submissions from SQLite to PostgreSQL if multi-node scaling is needed.
- Keep Redis + Celery for parallel submission processing.
