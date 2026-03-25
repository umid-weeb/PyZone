from __future__ import annotations

import os
import secrets
from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.security import HTTPAuthorizationCredentials
from jose import JWTError, jwt
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from uuid import uuid4

from app.database import get_db
from app.database import SessionLocal
from app.models.user import User
from app.models.problem import Problem
from app.models.rating import UserRating
from app.models.submission_stats import UserSubmission
from app.api.routes.auth import (
    ALGORITHM,
    SECRET_KEY,
    get_password_hash,
    verify_password,
    security,
)
from app.api.routes.auth import get_current_user


router = APIRouter(tags=["users"])
account_router = APIRouter(tags=["account"])


class UserSearchItem(BaseModel):
    id: int
    username: str


class UserSearchResponse(BaseModel):
    users: list[UserSearchItem]


class ProfilePayload(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    country: str | None = None
    display_name: str | None = Field(default=None, max_length=120)
    bio: str | None = Field(default=None, max_length=2000)


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=6, max_length=128)
    new_password: str = Field(min_length=6, max_length=128)
    confirm_password: str = Field(min_length=6, max_length=128)


class PublicProfile(BaseModel):
    id: int
    username: str
    country: str | None = None


@router.get("/users/search", response_model=UserSearchResponse)
def search_users(
    q: str = Query(..., min_length=1, max_length=50),
    db: Session = Depends(get_db),
) -> UserSearchResponse:
    """
    Return up to 10 users whose username contains the query string (case-insensitive).
    """
    query = q.strip()
    if not query:
        return UserSearchResponse(users=[])

    pattern = f"%{query}%"
    stmt = (
        select(User.id, User.username)
        .where(User.username.ilike(pattern))
        .order_by(User.username.asc())
        .limit(10)
    )
    rows = db.execute(stmt).mappings().all()
    users = [UserSearchItem(id=row["id"], username=row["username"]) for row in rows]
    return UserSearchResponse(users=users)


@router.get("/users/lookup/{username}", response_model=PublicProfile)
def get_public_profile(username: str, db: Session = Depends(get_db)) -> PublicProfile:
    """
    Legacy-friendly minimal profile lookup.
    Canonical public profile is served by `/api/users/{username}` in `auth.py`.
    """
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return PublicProfile(id=user.id, username=user.username, country=user.country)


@account_router.put("/user/profile")
def update_profile(
    payload: ProfilePayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    # Check username uniqueness when changed
    if payload.username != current_user.username:
        existing = db.query(User).filter(User.username == payload.username).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This username is already taken")

    current_user.username = payload.username
    current_user.country = payload.country
    if hasattr(current_user, "display_name"):
        current_user.display_name = payload.display_name
    if hasattr(current_user, "bio"):
        current_user.bio = payload.bio

    db.commit()
    db.refresh(current_user)
    return {
        "success": True,
        "username": current_user.username,
        "country": current_user.country,
        "display_name": getattr(current_user, "display_name", None),
        "bio": getattr(current_user, "bio", None),
    }


@account_router.post("/user/password")
def change_password(
    payload: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passwords do not match")
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")

    current_user.password_hash = get_password_hash(payload.new_password)
    db.commit()
    return {"success": True}


@account_router.post("/user/avatar")
def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    allowed_types = {"image/png", "image/jpeg", "image/jpg", "image/webp"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file type")

    content = file.file.read()
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Max file size is 2MB")

    suffix = Path(file.filename or "").suffix.lower() or ".png"
    avatar_url: str

    supabase_url = os.getenv("SUPABASE_URL") or os.getenv("ARENA_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("ARENA_SUPABASE_SERVICE_ROLE_KEY")
    bucket = os.getenv("ARENA_SUPABASE_AVATAR_BUCKET", "avatars")

    if supabase_url and supabase_key:
        from supabase import create_client

        client = create_client(supabase_url, supabase_key)
        object_path = f"{current_user.id}/{uuid4().hex}{suffix}"
        client.storage.from_(bucket).upload(
            path=object_path,
            file=content,
            file_options={"content-type": file.content_type or "application/octet-stream", "upsert": "true"},
        )
        # Public bucket recommended for avatars; otherwise switch to signed URLs.
        avatar_url = client.storage.from_(bucket).get_public_url(object_path)
    else:
        upload_root = Path(os.getenv("ARENA_UPLOAD_ROOT", Path(__file__).resolve().parents[3] / "uploads"))
        avatar_dir = upload_root / "avatars"
        avatar_dir.mkdir(parents=True, exist_ok=True)

        filename = f"{current_user.id}_{secrets.token_hex(8)}{suffix}"
        filepath = avatar_dir / filename
        with open(filepath, "wb") as f:
            f.write(content)
        avatar_url = f"/uploads/avatars/{filename}"

    if hasattr(current_user, "avatar_url"):
        current_user.avatar_url = avatar_url
        db.commit()
    return {"avatar_url": avatar_url}


@account_router.get("/user/activity")
def user_activity(current_user: User = Depends(get_current_user)) -> list:
    with SessionLocal() as db:
        rows = (
            db.query(
                func.date(UserSubmission.created_at).label("date"),
                func.count().label("count"),
            )
            .filter(UserSubmission.user_id == current_user.id)
            .group_by(func.date(UserSubmission.created_at))
            .order_by(func.date(UserSubmission.created_at))
            .all()
        )
        return [{"date": str(row.date), "count": int(row.count)} for row in rows]


@account_router.get("/user/submissions")
def user_submissions(current_user: User = Depends(get_current_user)) -> list:
    with SessionLocal() as db:
        rows = (
            db.query(
                UserSubmission.problem_id,
                UserSubmission.language,
                UserSubmission.verdict,
                UserSubmission.runtime_ms,
                UserSubmission.memory_kb,
                UserSubmission.created_at,
                Problem.title.label("problem_title"),
                Problem.difficulty.label("difficulty"),
            )
            .outerjoin(Problem, Problem.id == UserSubmission.problem_id)
            .filter(UserSubmission.user_id == current_user.id)
            .order_by(UserSubmission.created_at.desc())
            .limit(200)
            .all()
        )

        return [
            {
                "problem_id": row.problem_id,
                "problem_title": row.problem_title,
                "language": row.language,
                "difficulty": row.difficulty,
                "verdict": row.verdict,
                "runtime_ms": row.runtime_ms,
                "memory_kb": row.memory_kb,
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "status": row.verdict,
            }
            for row in rows
        ]


@router.get("/leaderboard")
def leaderboard(db: Session = Depends(get_db)) -> list:
    """
    Global leaderboard sorted by rating, then solved.
    """
    subq = (
        db.query(
            UserSubmission.user_id.label("user_id"),
            func.count(func.distinct(UserSubmission.problem_id)).label("solved"),
            func.count().label("submissions"),
            func.min(UserSubmission.runtime_ms).label("fastest_ms"),
        )
        .filter(UserSubmission.verdict == "Accepted")
        .group_by(UserSubmission.user_id)
        .subquery()
    )

    rows = (
        db.query(
            User.username,
            func.coalesce(UserRating.rating, 800).label("rating"),
            subq.c.solved,
            subq.c.submissions,
            subq.c.fastest_ms,
        )
        .join(subq, subq.c.user_id == User.id)
        .outerjoin(UserRating, UserRating.user_id == User.id)
        .order_by(func.coalesce(UserRating.rating, 800).desc(), subq.c.solved.desc(), User.username.asc())
        .limit(100)
        .all()
    )

    return [
        {
            "username": row.username,
            "rating": int(row.rating or 800),
            "solved": int(row.solved or 0),
            "submissions": int(row.submissions or 0),
            "fastest_ms": int(row.fastest_ms) if row.fastest_ms is not None else None,
        }
        for row in rows
    ]
