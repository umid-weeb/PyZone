# Pyzone Arena Backend

## Overview

This backend adds a LeetCode-style problem solving arena to the existing Python editor.

Architecture:

- Frontend arena app source: `arena/` (React + Vite)
- Production arena build output: `public/arena-spa/`
- API layer: FastAPI routes under `backend/app/api/routes`
- Problem source: GitHub API or local sample repository for visible assets
- Hidden testcase source: secure local directory or private GitHub repository
- Cache layer: filesystem cache under `backend/.cache/problems` with TTL
- Submission store: SQLite under `backend/.data/submissions.sqlite3`
- Async execution: Celery + Redis, with inline-thread fallback for development
- Judge: metadata-driven runner with Docker sandbox support
- Reverse proxy: Nginx serves frontend and proxies `/api` to FastAPI

## Frontend Structure

- `ProblemList`: GitHub-backed easy problem navigator with search
- Three-pane resizable layout with cached pane sizes and fast-first-paint skeletons
- `ProblemDescription`: markdown description, metadata, tags, limits
- `CodeEditor`: Monaco editor with textarea fallback and lazy starter-code loading
- `RunButton`: executes only visible tests
- `SubmitButton`: executes visible + hidden tests
- `TestcasePanel`: shows 3-4 visible testcases
- `ResultPanel`: verdict, runtime, memory, pass count, per-case output

## Backend Structure

- `app/main.py`: FastAPI entrypoint
- `app/api/routes/problems.py`: `GET /problems`, `GET /problem/{id}`
- `app/api/routes/submissions.py`: `POST /run`, `POST /submit`, `GET /submission/{id}`
- `app/api/routes/auth.py`: `POST /api/register`, `POST /api/login`, `GET /api/me`
- `app/services/github_client.py`: reads problem files from GitHub API
- `app/services/problem_service.py`: metadata parsing, cache orchestration, testcase loading
- `app/services/submission_service.py`: queueing and worker execution
- `app/repositories/submissions.py`: SQLite submission persistence
- `app/judge/parser.py`: testcase input parsing
- `app/judge/comparator.py`: exact + whitespace tolerant comparison
- `app/judge/runner.py`: isolated execution orchestration
- `app/worker/tasks.py`: Celery task entrypoint
- `app/api/routes/health.py`: `GET /health`, `GET /health/db`, `GET /health/cache`

## Updated Architecture Diagram

```text
Browser
  |
  |  GET /, /zone, /assets
  v
Nginx reverse proxy
  |-------------------------------> static frontend files (public/)
  |
  |  /api/*, /health*
  v
FastAPI API
  |------> Problem cache (.cache/problems)
  |------> SQLite submissions (.data/submissions.sqlite3)
  |------> Visible problem source (public GitHub repo or local sample repo)
  |------> Hidden testcase source (.data/secure_problem_store or private GitHub repo)
  |
  v
Celery worker -> Judge runner -> Docker sandbox
  |
  v
Redis broker/result backend
```

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
```

Hidden tests must not live in the public problem repository in production.

Recommended production split:

```text
public problems repo:
  problems/<slug>/problem.md
  problems/<slug>/metadata.yaml
  problems/<slug>/starter_code.py
  problems/<slug>/tests/visible/*

secure hidden store:
  <secure_root>/<slug>/tests/hidden/*
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

1. Enter the backend directory:

```bash
cd backend
```

2. Copy `.env.example` to `.env`.

Windows:

```bash
copy .env.example .env
```

3. For GitHub-backed mode, set:
   - `ARENA_GITHUB_OWNER`
   - `ARENA_GITHUB_REPO`
   - `ARENA_GITHUB_BRANCH`
   - `ARENA_GITHUB_TOKEN` if needed
4. For secure hidden tests, set one of:
   - `ARENA_HIDDEN_TEST_ROOT` to a local secure directory outside public web assets
   - `ARENA_HIDDEN_GITHUB_OWNER`, `ARENA_HIDDEN_GITHUB_REPO`, `ARENA_HIDDEN_GITHUB_TOKEN`
5. Install dependencies:

```bash
py -m pip install -r requirements.txt
```

6. Start API:

```bash
py -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Windows shortcut:

```powershell
./start-api.ps1
```

7. In development, frontend can talk to backend directly by setting `VITE_ARENA_API_BASE`. The React app defaults to:

```js
VITE_ARENA_API_BASE=http://127.0.0.1:8000
```

when loaded from `localhost` or `127.0.0.1`.

List endpoint supports lightweight summary pagination:

```text
GET /api/problems?page=1&per_page=20&q=two&tags=array,hashmap
```

Response shape:

```json
{
  "items": [
    {
      "id": "two_sum",
      "title": "Two Sum",
      "difficulty": "easy",
      "tags": ["array", "hashmap"],
      "preview": "2 <= nums.length <= 10000"
    }
  ],
  "total": 1,
  "page": 1,
  "per_page": 20,
  "total_pages": 1,
  "selected_tags": ["array"],
  "available_tags": ["array", "hashmap"],
  "source": "local:..."
}
```

Run tests:

```bash
py -m pytest tests -q
```

8. Optional full stack with Docker:

```bash
docker compose up --build
```

Worker only:

```powershell
./start-worker.ps1
```

This brings up:

- `api` at container port `8000`
- `worker`
- `redis`
- `nginx` serving frontend at `http://localhost:8080`
- docker socket mounted to worker for sandboxed judge runs

## Nginx Reverse Proxy

Production sample config lives at:

- `backend/deploy/nginx/default.conf`

Routing:

- `/` -> static frontend files from `public/`
- `/api/*` -> FastAPI backend
- `/health*` -> FastAPI backend

## Health Endpoints

- `GET /health`
- `GET /health/db`
- `GET /health/cache`

These expose API health, SQLite connectivity and cache stats.

## Logging

Problem requests now log:

- problem source
- cache hit or miss
- GitHub fetch status
- request latency

Example log line:

```text
problems.list source=local:... github_fetch=local-ok refresh=False cache=hit ... latency_ms=2.10
```

## Production Notes

- Populate the configured GitHub problem repo with 100+ easy problems.
- Keep hidden tests only in private storage and never expose them in API responses.
- Enable Docker judge mode in production for sandboxing.
- Move submissions from SQLite to PostgreSQL if multi-node scaling is needed.
- Keep Redis + Celery for parallel submission processing.
- Put Nginx in front so frontend and backend share one origin.
- For production set `ARENA_USE_INLINE_EXECUTION=false` and ensure Redis and Celery worker are running.
- Redis cache is used automatically when reachable; otherwise filesystem cache is used.
- Auth endpoints added:
  - `POST /api/register` (username, password, country) -> `{ success: true, token, access_token }`
  - `POST /api/login` -> `{ token, access_token }`
  - `GET /api/me` -> current user profile (requires `Authorization: Bearer <token>`)
  - JWT secret configured via `ARENA_JWT_SECRET`.
- Supabase / PostgreSQL auth storage:
  - Configure `DATABASE_URL` (e.g., `postgresql+psycopg2://postgres:password@host:5432/postgres`).
  - Models live in `app/models/user.py`; SQLAlchemy engine/session in `app/database.py`.
  - Tables auto-created on startup via `Base.metadata.create_all(bind=engine)`.
