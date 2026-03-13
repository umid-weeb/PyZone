from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User


router = APIRouter(tags=["auth"], prefix="/api")

SECRET_KEY = os.getenv("ARENA_JWT_SECRET", os.getenv("JWT_SECRET", "dev-secret-change-me"))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ARENA_JWT_EXPIRE_MINUTES", "60"))  # default 60 minutes

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)


def normalize_password(password: str) -> str:
    """
    bcrypt accepts up to 72 bytes. Truncate to 72 characters (safe for typical UTF-8).
    """
    return (password or "")[:72]


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=128)
    country: str | None = None


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    token: str
    access_token: str
    token_type: str = "bearer"


class MeResponse(BaseModel):
    username: str
    country: str | None = None
    created_at: datetime


def get_password_hash(password: str) -> str:
    return pwd_context.hash(normalize_password(password))


def verify_password(password: str, hashed: str) -> bool:
    return pwd_context.verify(normalize_password(password), hashed)


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"sub": subject, "exp": expire}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> dict:
    try:
        existing = db.query(User).filter(User.username == payload.username).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username already exists")
        user = User(
            username=payload.username,
            password_hash=get_password_hash(payload.password),
            country=payload.country,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        token = create_access_token(user.username)
        return {"success": True, "token": token, "access_token": token, "token_type": "bearer"}
    except HTTPException:
        raise
    except Exception as exc:
        # Capture unexpected errors to help debug 500s in production
        import logging

        logging.getLogger(__name__).exception("Register failed: %s", exc)
        db.rollback()
        raise HTTPException(status_code=500, detail="Registration failed")


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        user = db.query(User).filter(User.username == payload.username).first()
        if not user or not verify_password(payload.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        token = create_access_token(user.username)
        return TokenResponse(token=token, access_token=token)
    except HTTPException:
        raise
    except Exception as exc:
        import logging

        logging.getLogger(__name__).exception("Login failed: %s", exc)
        raise HTTPException(status_code=500, detail="Login failed")


@router.get("/me", response_model=MeResponse)
def me(credentials: HTTPAuthorizationCredentials | None = Depends(security), db: Session = Depends(get_db)) -> MeResponse:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str | None = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if not username:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return MeResponse(username=user.username, country=user.country, created_at=user.created_at)
