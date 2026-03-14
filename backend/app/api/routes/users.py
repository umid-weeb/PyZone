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
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.user_profile import UserProfile
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
    bio: str | None = Field(default=None, max_length=500)
    github: str | None = Field(default=None, max_length=255)
    linkedin: str | None = Field(default=None, max_length=255)


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=6, max_length=128)
    new_password: str = Field(min_length=6, max_length=128)
    confirm_password: str = Field(min_length=6, max_length=128)


class PublicProfile(BaseModel):
    id: int
    username: str
    country: str | None = None
    avatar_url: str | None = None
    github: str | None = None
    linkedin: str | None = None
    bio: str | None = None


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


@router.get("/users/{username}", response_model=PublicProfile)
def get_public_profile(username: str, db: Session = Depends(get_db)) -> PublicProfile:
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    return PublicProfile(
        id=user.id,
        username=user.username,
        country=user.country,
        avatar_url=getattr(profile, "avatar_url", None),
        github=getattr(profile, "github", None),
        linkedin=getattr(profile, "linkedin", None),
        bio=getattr(profile, "bio", None),
    )


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

    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile:
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)
    profile.bio = payload.bio
    profile.github = payload.github
    profile.linkedin = payload.linkedin

    db.commit()
    db.refresh(current_user)
    return {
        "success": True,
        "username": current_user.username,
        "country": current_user.country,
        "bio": profile.bio,
        "github": profile.github,
        "linkedin": profile.linkedin,
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

    upload_root = Path(os.getenv("ARENA_UPLOAD_ROOT", Path(__file__).resolve().parents[3] / "uploads"))
    avatar_dir = upload_root / "avatars"
    avatar_dir.mkdir(parents=True, exist_ok=True)

    suffix = Path(file.filename or "").suffix.lower() or ".png"
    filename = f"{current_user.id}_{secrets.token_hex(8)}{suffix}"
    filepath = avatar_dir / filename
    with open(filepath, "wb") as f:
        f.write(content)

    public_url = f"/uploads/avatars/{filename}"
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile:
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)
    profile.avatar_url = public_url
    db.commit()
    return {"avatar_url": public_url}


@account_router.get("/user/activity")
def user_activity(current_user: User = Depends(get_current_user)) -> list:
    # Placeholder activity; real implementation can pull from submissions
    return []


@account_router.get("/user/submissions")
def user_submissions(current_user: User = Depends(get_current_user)) -> list:
    # Placeholder submissions; real implementation can pull from submissions storage
    return []


