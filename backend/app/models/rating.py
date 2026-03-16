from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import relationship

from app.database import Base


class UserRating(Base):
    __tablename__ = "user_ratings"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    rating = Column(Integer, nullable=False, default=1200)
    max_rating = Column(Integer, nullable=False, default=1200)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", backref="rating_row")


class RatingHistory(Base):
    __tablename__ = "rating_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    delta = Column(Integer, nullable=False)
    rating_after = Column(Integer, nullable=False)
    reason = Column(String(120), nullable=False, default="submission")
    submission_id = Column(String(64), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", backref="rating_history")

    __table_args__ = (
        UniqueConstraint("user_id", "submission_id", name="uq_rating_history_user_submission"),
    )

