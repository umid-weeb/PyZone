from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.problem import Problem
from app.models.rating import RatingHistory, UserRating
from app.models.submission_stats import UserSubmission


@dataclass(frozen=True)
class RatingSnapshot:
    rating: int
    max_rating: int
    global_rank: int | None


def _difficulty_delta(difficulty: str | None) -> int:
    d = (difficulty or "").strip().lower()
    if d == "hard":
        return 20
    if d == "medium":
        return 12
    return 6


class RatingService:
    """
    Production note:
    A real CF-style system is contest-based. For Arena's continuous practice,
    this uses a conservative "first AC per problem gives delta" model.
    """

    def get_or_create(self, db: Session, user_id: int) -> UserRating:
        row = db.query(UserRating).filter(UserRating.user_id == user_id).first()
        if row:
            return row
        row = UserRating(user_id=user_id, rating=1200, max_rating=1200)
        db.add(row)
        db.flush()
        return row

    def on_submission_result(
        self,
        db: Session,
        *,
        user_id: int,
        problem_id: str,
        submission_id: str,
        verdict: str | None,
    ) -> None:
        if (verdict or "").strip().lower() != "accepted":
            return

        # Only award rating for the first accepted submission per problem.
        already_solved = (
            db.query(UserSubmission.id)
            .filter(
                UserSubmission.user_id == user_id,
                UserSubmission.problem_id == problem_id,
                UserSubmission.verdict == "Accepted",
                UserSubmission.submission_id != submission_id,
            )
            .first()
        )
        if already_solved:
            return

        exists = (
            db.query(RatingHistory.id)
            .filter(RatingHistory.user_id == user_id, RatingHistory.submission_id == submission_id)
            .first()
        )
        if exists:
            return

        difficulty = db.query(Problem.difficulty).filter(Problem.id == problem_id).scalar()
        delta = _difficulty_delta(difficulty)

        rating_row = self.get_or_create(db, user_id)
        rating_after = int(rating_row.rating) + int(delta)
        rating_row.rating = rating_after
        rating_row.max_rating = max(int(rating_row.max_rating), rating_after)

        db.add(
            RatingHistory(
                user_id=user_id,
                delta=delta,
                rating_after=rating_after,
                reason=f"first_ac:{difficulty or 'unknown'}",
                submission_id=submission_id,
            )
        )

    def snapshot(self, db: Session, user_id: int) -> RatingSnapshot:
        row = self.get_or_create(db, user_id)
        # Dense rank by rating desc.
        higher = db.query(func.count(UserRating.user_id)).filter(UserRating.rating > row.rating).scalar() or 0
        global_rank = int(higher) + 1
        return RatingSnapshot(rating=int(row.rating), max_rating=int(row.max_rating), global_rank=global_rank)


rating_service = RatingService()

