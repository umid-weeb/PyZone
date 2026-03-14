from __future__ import annotations

from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    avatar_url = Column(String(512), nullable=True)
    
    user = relationship("User", back_populates="profile", foreign_keys=[user_id])
