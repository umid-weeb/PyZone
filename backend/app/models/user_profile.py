from __future__ import annotations

from sqlalchemy import Column, ForeignKey, Integer, String

from app.database import Base


class UserProfile(Base):
    __tablename__ = "user_profiles"

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True, index=True)
    avatar_url = Column(String(512), nullable=True)
    bio = Column(String(500), nullable=True)
    github = Column(String(255), nullable=True)
    linkedin = Column(String(255), nullable=True)
