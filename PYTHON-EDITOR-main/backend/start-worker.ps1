Copy-Item .env.example .env -ErrorAction SilentlyContinue
py -m celery -A app.worker.celery_app.celery_app worker --loglevel=info
