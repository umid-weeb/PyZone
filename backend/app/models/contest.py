from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import relationship

from app.database import Base


class Contest(Base):
    __tablename__ = "contests"

    id = Column(String(64), primary_key=True, index=True)  # slug-like id
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    starts_at = Column(DateTime(timezone=True), nullable=True)
    ends_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    problems = relationship(
        "ContestProblem",
        back_populates="contest",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="ContestProblem.sort_order.asc()",
    )


class ContestProblem(Base):
    __tablename__ = "contest_problems"

    id = Column(Integer, primary_key=True, autoincrement=True)
    contest_id = Column(String(64), ForeignKey("contests.id", ondelete="CASCADE"), index=True, nullable=False)
    problem_id = Column(String(36), ForeignKey("problems.id", ondelete="RESTRICT"), index=True, nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)

    contest = relationship("Contest", back_populates="problems")

    __table_args__ = (UniqueConstraint("contest_id", "problem_id", name="uq_contest_problem"),)


class ContestEntry(Base):
    __tablename__ = "contest_entries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    contest_id = Column(String(64), ForeignKey("contests.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    joined_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (UniqueConstraint("contest_id", "user_id", name="uq_contest_entry"),)


class ContestSubmission(Base):
    __tablename__ = "contest_submissions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    contest_id = Column(String(64), ForeignKey("contests.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    problem_id = Column(String(36), ForeignKey("problems.id", ondelete="RESTRICT"), index=True, nullable=False)
    submission_id = Column(String(64), nullable=False, index=True)
    verdict = Column(String(64), nullable=True)
    runtime_ms = Column(Integer, nullable=True)
    memory_kb = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

