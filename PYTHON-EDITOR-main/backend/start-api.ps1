Copy-Item .env.example .env -ErrorAction SilentlyContinue
py -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
