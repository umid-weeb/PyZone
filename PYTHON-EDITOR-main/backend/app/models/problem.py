from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.database import Base


class Problem(Base):
    __tablename__ = "problems"

    id = Column(String(36), primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    slug = Column(String(180), unique=True, index=True, nullable=False)
    difficulty = Column(String(20), index=True, nullable=False)
    description = Column(Text, nullable=False)
    input_format = Column(Text, nullable=True)
    output_format = Column(Text, nullable=True)
    constraints_text = Column("constraints", Text, nullable=True)
    starter_code = Column(Text, nullable=False)
    function_name = Column(String(64), nullable=False, default="solve")
    tags_json = Column(Text, nullable=False, default="[]")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    test_cases = relationship(
        "TestCase",
        back_populates="problem",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="TestCase.sort_order.asc()",
    )


class TestCase(Base):
    __tablename__ = "test_cases"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    problem_id = Column(String(36), ForeignKey("problems.id", ondelete="CASCADE"), index=True, nullable=False)
    input = Column(Text, nullable=False)
    expected_output = Column(Text, nullable=False)
    is_hidden = Column(Boolean, nullable=False, default=False)
    sort_order = Column(Integer, nullable=False, default=0)

    problem = relationship("Problem", back_populates="test_cases")
