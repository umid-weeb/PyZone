# How to run locally

1. Copy environment template:
   ```bash
   cp .env.example .env
   ```
2. Start backend:
   ```bash
   cd backend
   python -m pip install -r requirements.txt
   python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
3. Start frontend in a new terminal:
   ```bash
   cd arena
   npm install
   npm run dev
   ```
4. Open frontend URL shown by Vite and verify API routes respond.
