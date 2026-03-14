from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
import logging
import bcrypt
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User


router = APIRouter(tags=["auth"])

SECRET_KEY = os.getenv("ARENA_JWT_SECRET", os.getenv("JWT_SECRET", "dev-secret-change-me"))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ARENA_JWT_EXPIRE_MINUTES", "60"))  # default 60 minutes
security = HTTPBearer(auto_error=False)
logger = logging.getLogger(__name__)


def normalize_password(password: str) -> bytes:
    """
    bcrypt accepts up to 72 BYTES. Encode to UTF-8 and truncate to 72 bytes.
    """
    return (password or "").encode("utf-8")[:72]


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=4, max_length=128)


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
    avatar_url: str | None = None
    bio: str | None = None
    github: str | None = None
    linkedin: str | None = None


def get_password_hash(password: str) -> str:
    # Use the bcrypt library directly to avoid backend detection issues that caused 500s
    return bcrypt.hashpw(normalize_password(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(normalize_password(password), hashed.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"sub": subject, "exp": expire}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> dict:
    try:
        # Rule 1: username must start with "@"
        if not payload.username.startswith("@"):
            raise HTTPException(status_code=400, detail="Username must start with '@'")

        # Rule 2: username must be unique
        existing = db.query(User).filter(User.username == payload.username).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username already exists")

        # Create user with hashed password
        user = User(
            full_name=payload.full_name,
            username=payload.username,
            password_hash=get_password_hash(payload.password),
        )
        db.add(user)
        db.commit()
        
        return {"message": "User created successfully"}
    except HTTPException:
        raise
    except Exception as exc:
        import sqlalchemy

        db.rollback()
        # Handle duplicate username gracefully instead of crashing
        if isinstance(exc, sqlalchemy.exc.IntegrityError):
            logger.warning("Register integrity error (likely duplicate): %s", exc, exc_info=True)
            raise HTTPException(status_code=400, detail="Username already exists")

        logger.error("Register failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Registration failed")


@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> dict:
    try:
        user = db.query(User).filter(User.username == payload.username).first()
        if not user or not verify_password(payload.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        return {"message": "Login success"}
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
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    return MeResponse(
        username=user.username,
        country=user.country,
        created_at=user.created_at,
        avatar_url=getattr(profile, "avatar_url", None),
        bio=getattr(profile, "bio", None),
        github=getattr(profile, "github", None),
        linkedin=getattr(profile, "linkedin", None),
    )


@router.post("/logout")
def logout(credentials: HTTPAuthorizationCredentials | None = Depends(security)) -> dict:
    """
    Logout endpoint that validates the token and returns success.
    Frontend should handle token removal from localStorage.
    """
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str | None = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if not username:
        raise HTTPException(status_code=401, detail="Invalid token")
    return {"message": "Successfully logged out"}


# Settings endpoints

class UsernameUpdateRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)


class PasswordUpdateRequest(BaseModel):
    old_password: str
    new_password: str = Field(min_length=6, max_length=128)


class ResetVerifyRequest(BaseModel):
    phone: str | None = None
    code: str

def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(security), db: Session = Depends(get_db)) -> User:
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
    return user


@router.get("/user/profile")
def get_user_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    return {
        "user": {
            "username": user.username,
            "email": user.email,
            "country": user.country,
            "created_at": user.created_at
        },
        "profile": {
            "avatar_url": profile.avatar_url if profile else None
        }
    }


@router.patch("/user/username")
def update_username(request: UsernameUpdateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Check if username is already taken
    existing = db.query(User).filter(User.username == request.username).first()
    if existing and existing.id != user.id:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    user.username = request.username
    db.commit()
    return {"message": "Username updated successfully"}


@router.patch("/user/password")
def update_password(request: PasswordUpdateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Verify old password
    if not verify_password(request.old_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Update password
    user.password_hash = get_password_hash(request.new_password)
    db.commit()
    return {"message": "Password updated successfully"}


@router.post("/profile/avatar")
async def upload_avatar(avatar: UploadFile = File(...), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Validate file type
    if not avatar.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Create uploads directory if it doesn't exist
    import os
    upload_dir = "public/uploads/avatars"
    os.makedirs(upload_dir, exist_ok=True)
    
    # Generate unique filename
    import uuid
    file_extension = avatar.filename.split('.')[-1] if '.' in avatar.filename else 'jpg'
    filename = f"{user.id}_{uuid.uuid4().hex}.{file_extension}"
    file_path = os.path.join(upload_dir, filename)
    
    # Save file
    with open(file_path, "wb") as buffer:
        content = await avatar.read()
        buffer.write(content)
    
    # Update or create profile
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    if not profile:
        profile = UserProfile(user_id=user.id, avatar_url=f"/uploads/avatars/{filename}")
        db.add(profile)
    else:
        profile.avatar_url = f"/uploads/avatars/{filename}"
    
    db.commit()
    return {"avatar_url": f"/uploads/avatars/{filename}"}


@router.delete("/profile/avatar")
def delete_avatar(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    if profile:
        # Delete file if it exists
        import os
        if profile.avatar_url:
            file_path = f"public{profile.avatar_url}"
            if os.path.exists(file_path):
                os.remove(file_path)
        
        db.delete(profile)
        db.commit()
    
    return {"message": "Avatar removed successfully"}


@router.post("/password/reset")
def request_password_reset(user: User = Depends(get_current_user)):
    # This would integrate with Telegram bot
    # For now, just return success
    return {"message": "Reset code sent to your Telegram"}


@router.post("/password/reset/verify")
def verify_password_reset(request: ResetVerifyRequest):
    # Placeholder verification logic; integrate with Telegram bot or DB in production
    if not request.code:
        raise HTTPException(status_code=400, detail="Code is required")
    return {"message": "Reset code verified"}
