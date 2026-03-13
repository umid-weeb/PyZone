from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from app.services.user_service import UserService, get_user_service


router = APIRouter(tags=["auth"], prefix="/api")


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
    created_at: float


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, service: UserService = Depends(get_user_service)) -> dict:
    created = service.create_user(payload.username, payload.password, payload.country)
    if not created:
        raise HTTPException(status_code=400, detail="Username already exists")
    user = service.get_user(payload.username)
    token = service.generate_token(user)
    return {"success": True, "token": token, "access_token": token, "token_type": "bearer"}


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, service: UserService = Depends(get_user_service)) -> TokenResponse:
    user = service.verify_user(payload.username, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = service.generate_token(user)
    return TokenResponse(token=token, access_token=token)


security = HTTPBearer(auto_error=False)


@router.get("/me", response_model=MeResponse)
def me(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    service: UserService = Depends(get_user_service),
) -> MeResponse:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    username = service.decode_token(credentials.credentials)
    if not username:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = service.get_user(username)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return MeResponse(username=user.username, country=user.country, created_at=user.created_at)
