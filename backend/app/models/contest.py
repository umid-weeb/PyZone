import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class Contest(Base):
    __tablename__ = "contests"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    starts_at = Column(DateTime(timezone=True), nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=False)
    is_rated = Column(Boolean, default=False)

class ContestProblem(Base):
    __tablename__ = "contest_problems"
    contest_id = Column(UUID(as_uuid=True), ForeignKey("contests.id", ondelete="CASCADE"), primary_key=True)
    problem_id = Column(String, nullable=False, primary_key=True) # Problem slug or ID
    points = Column(Integer, default=100)
    order_num = Column(Integer, nullable=False)

class ContestRegistration(Base):
    __tablename__ = "contest_registrations"
    contest_id = Column(UUID(as_uuid=True), ForeignKey("contests.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    registered_at = Column(DateTime(timezone=True), default=datetime.utcnow)

class ContestSubmission(Base):
    __tablename__ = "contest_submissions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contest_id = Column(UUID(as_uuid=True), ForeignKey("contests.id", ondelete="CASCADE"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    problem_id = Column(String, nullable=False)
    penalty_minutes = Column(Integer, default=0)
    is_first_solve = Column(Boolean, default=False)
    is_accepted = Column(Boolean, default=False)
    submitted_at = Column(DateTime(timezone=True), default=datetime.utcnow)

class ContestStanding(Base):
    __tablename__ = "contest_standings"
    contest_id = Column(UUID(as_uuid=True), ForeignKey("contests.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    username = Column(String, nullable=False)
    total_solved = Column(Integer, default=0)
    total_penalty = Column(Integer, default=0) # ICPC format penalty in minutes
    last_submit = Column(DateTime(timezone=True))