from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.contest import Contest, ContestProblem, ContestSubmission
from app.models.problem import Problem
from app.models.user import User


router = APIRouter(tags=["contests"])


def _status(now: datetime, starts_at: datetime | None, ends_at: datetime | None) -> str:
    if starts_at and now < starts_at:
        return "upcoming"
    if ends_at and now >= ends_at:
        return "finished"
    if starts_at and (ends_at is None or now < ends_at):
        return "running"
    return "upcoming"


@router.get("/contests")
def list_contests(db: Session = Depends(get_db)) -> dict:
    now = datetime.now(timezone.utc)
    contests = db.query(Contest).order_by(Contest.starts_at.desc().nullslast(), Contest.created_at.desc()).limit(50).all()
    return {
        "items": [
            {
                "id": c.id,
                "title": c.title,
                "starts_at": c.starts_at.isoformat() if c.starts_at else None,
                "ends_at": c.ends_at.isoformat() if c.ends_at else None,
                "status": _status(now, c.starts_at, c.ends_at),
            }
            for c in contests
        ]
    }


@router.get("/contests/{contest_id}")
def get_contest(contest_id: str, db: Session = Depends(get_db)) -> dict:
    contest = db.query(Contest).filter(Contest.id == contest_id).first()
    if not contest:
        raise HTTPException(status_code=404, detail="Contest not found")

    rows = (
        db.query(
            ContestProblem.problem_id,
            ContestProblem.sort_order,
            Problem.slug,
            Problem.title,
            Problem.difficulty,
        )
        .join(Problem, Problem.id == ContestProblem.problem_id)
        .filter(ContestProblem.contest_id == contest_id)
        .order_by(ContestProblem.sort_order.asc())
        .all()
    )

    return {
        "id": contest.id,
        "title": contest.title,
        "description": contest.description,
        "starts_at": contest.starts_at.isoformat() if contest.starts_at else None,
        "ends_at": contest.ends_at.isoformat() if contest.ends_at else None,
        "problems": [
            {
                "problem_id": r.problem_id,
                "problem_slug": r.slug,
                "title": r.title,
                "difficulty": r.difficulty,
                "sort_order": int(r.sort_order or 0),
            }
            for r in rows
        ],
    }


@router.get("/contests/{contest_id}/leaderboard")
def contest_leaderboard(contest_id: str, db: Session = Depends(get_db)) -> dict:
    contest = db.query(Contest).filter(Contest.id == contest_id).first()
    if not contest:
        raise HTTPException(status_code=404, detail="Contest not found")
    if not contest.starts_at:
        return {"items": []}

    # ICPC-style: per problem, first Accepted counts; penalty = minutes since start at AC + 20 * wrong attempts.
    submissions = (
        db.query(
            ContestSubmission.user_id,
            User.username,
            ContestSubmission.problem_id,
            ContestSubmission.verdict,
            ContestSubmission.created_at,
        )
        .join(User, User.id == ContestSubmission.user_id)
        .filter(ContestSubmission.contest_id == contest_id)
        .order_by(ContestSubmission.created_at.asc())
        .all()
    )

    start = contest.starts_at
    per_user: dict[int, dict] = {}
    for row in submissions:
        user_state = per_user.setdefault(
            int(row.user_id),
            {"username": row.username, "problems": {}, "solved": 0, "penalty": 0},
        )
        p = user_state["problems"].setdefault(
            row.problem_id,
            {"solved": False, "wrong": 0},
        )
        if p["solved"]:
            continue

        verdict = (row.verdict or "").strip()
        if verdict == "Accepted":
            p["solved"] = True
            user_state["solved"] += 1
            minutes = int(max(0, (row.created_at - start).total_seconds()) // 60)
            user_state["penalty"] += minutes + 20 * int(p["wrong"])
        else:
            # Count wrong attempts only for non-null verdicts (queued/running excluded).
            if verdict:
                p["wrong"] += 1

    rows = sorted(
        per_user.values(),
        key=lambda x: (-x["solved"], x["penalty"], x["username"].lower()),
    )

    return {
        "items": [
            {
                "username": r["username"],
                "solved": int(r["solved"]),
                "penalty_minutes": int(r["penalty"]),
            }
            for r in rows
        ]
    }

