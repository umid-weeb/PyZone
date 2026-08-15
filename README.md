# PyZone

PyZone is an online Python coding platform with a browser-based editor and an Arena module for LeetCode-style problem solving, submission judging, and lightweight user/auth flows backed by a FastAPI service.

## Tech Stack
- Frontend: React + Vite (`arena/`)
- Backend/API: FastAPI (Python)
- Queue/Async: Celery + Redis
- Storage: SQLite (default), optional Supabase integration
- Tooling: npm, pytest, GitHub Actions

## Quick Setup & Run
1. Clone repo and go to project root.
2. Create env file from template:
   ```bash
   cp .env.example .env
   ```
3. Backend setup:
   ```bash
   cd backend
   python -m pip install -r requirements.txt
   python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
4. Frontend setup (new terminal):
   ```bash
   cd arena
   npm install
   npm run dev
   ```

## Project at a glance (HR-friendly)
- Product focus: web-based Python learning/coding experience
- Core capability: coding tasks with run/submit and judge feedback
- Architecture: split frontend + API backend with optional worker queue
- Deploy readiness: Docker/K8s assets and GitHub Actions workflows included
- Team process: issue/PR templates, contribution guide, and code of conduct

## Demo / Screenshots
- Add product demo link here: `<DEMO_URL>`
- Add screenshots here: `<SCREENSHOT_LINKS>`
