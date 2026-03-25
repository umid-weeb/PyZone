from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.ws_manager import contest_ws_manager
from app.models.contest import Contest, ContestStanding, ContestSubmission
from datetime import datetime

router = APIRouter(prefix="/api/contests", tags=["Contests"])
ws_router = APIRouter(tags=["WebSockets"])

@router.get("/{contest_id}/standings")
def get_standings(contest_id: str, db: Session = Depends(get_db)):
    standings = db.query(ContestStanding)\
        .filter(ContestStanding.contest_id == contest_id)\
        .order_by(ContestStanding.total_solved.desc(), ContestStanding.total_penalty.asc())\
        .limit(100).all()
    return {"standings": standings}

# Simulated submit endpoint triggered by the judge worker when a verdict arrives
@router.post("/internal/{contest_id}/update-score")
async def internal_update_score(contest_id: str, payload: dict, db: Session = Depends(get_db)):
    user_id = payload["user_id"]
    username = payload["username"]
    is_accepted = payload["is_accepted"]
    problem_id = payload["problem_id"]
    wrong_attempts = payload.get("wrong_attempts", 0) # Fetched from previous submissions
    
    contest = db.query(Contest).filter(Contest.id == contest_id).first()
    if not contest:
        raise HTTPException(status_code=404)

    standing = db.query(ContestStanding).filter_by(contest_id=contest_id, user_id=user_id).first()
    if not standing:
        standing = ContestStanding(contest_id=contest_id, user_id=user_id, username=username)
        db.add(standing)

    # ICPC Scoring Logic
    if is_accepted:
        elapsed_minutes = int((datetime.utcnow() - contest.starts_at).total_seconds() / 60)
        # 20 minutes penalty for each wrong attempt
        penalty = elapsed_minutes + (wrong_attempts * 20) 
        
        standing.total_solved += 1
        standing.total_penalty += penalty
        standing.last_submit = datetime.utcnow()
        db.commit()

        # Real-time WebSockets update
        await contest_ws_manager.broadcast(str(contest_id), {
            "type": "standing_update",
            "user_id": str(user_id),
            "username": username,
            "solved": standing.total_solved,
            "penalty": standing.total_penalty
        })
    return {"status": "ok"}

@ws_router.websocket("/ws/contest/{contest_id}")
async def contest_websocket(websocket: WebSocket, contest_id: str):
    await contest_ws_manager.connect(websocket, contest_id)
    try:
        while True:
            data = await websocket.receive_text() # keep connection alive
    except WebSocketDisconnect:
        contest_ws_manager.disconnect(websocket, contest_id)