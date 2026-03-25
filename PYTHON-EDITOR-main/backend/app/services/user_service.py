from __future__ import annotations

import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import jwt
from passlib.context import CryptContext

from app.core.config import get_settings


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def normalize_password(password: str) -> bytes:
    """
    bcrypt accepts up to 72 BYTES. Encode and truncate to 72 bytes.
    """
    return (password or "").encode("utf-8")[:72]


@dataclass
class User:
    id: int
    username: str
    password_hash: str
    country: str | None
    created_at: float


class UserService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.db_path = self.settings.submissions_db_path
        self._ensure_schema()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _ensure_schema(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    country TEXT,
                    created_at REAL NOT NULL
                )
                """
            )
            conn.commit()

    def create_user(self, username: str, password: str, country: str | None) -> bool:
        password_hash = pwd_context.hash(normalize_password(password))
        now = time.time()
        try:
            with self._connect() as conn:
                conn.execute(
                    "INSERT INTO users (username, password_hash, country, created_at) VALUES (?, ?, ?, ?)",
                    (username, password_hash, country, now),
                )
                conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False

    def verify_user(self, username: str, password: str) -> Optional[User]:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM users WHERE username = ?",
                (username,),
            ).fetchone()
        if not row:
            return None
        if not pwd_context.verify(normalize_password(password), row["password_hash"]):
            return None
        return User(
            id=row["id"],
            username=row["username"],
            password_hash=row["password_hash"],
            country=row["country"],
            created_at=row["created_at"],
        )

    def get_user(self, username: str) -> Optional[User]:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM users WHERE username = ?",
                (username,),
            ).fetchone()
        if not row:
            return None
        return User(
            id=row["id"],
            username=row["username"],
            password_hash=row["password_hash"],
            country=row["country"],
            created_at=row["created_at"],
        )

    def generate_token(self, user: User) -> str:
        payload = {
            "sub": user.username,
            "iat": int(time.time()),
            "exp": int(time.time()) + 7 * 24 * 3600,
        }
        return jwt.encode(payload, self.settings.jwt_secret, algorithm="HS256")

    def decode_token(self, token: str) -> Optional[str]:
        try:
            data = jwt.decode(token, self.settings.jwt_secret, algorithms=["HS256"])
            return data.get("sub")
        except Exception:
            return None


def get_user_service() -> UserService:
    return UserService()
