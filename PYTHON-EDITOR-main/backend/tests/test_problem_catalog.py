from pathlib import Path
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.database import Base
from app.models.problem import Problem
from app.services.problem_catalog import build_problem_catalog, ensure_problem_catalog_seeded


def test_ensure_problem_catalog_seeded_backfills_partial_catalog(tmp_path) -> None:
    db_path = tmp_path / "catalog.db"
    engine = create_engine(f"sqlite:///{db_path}", future=True)
    Session = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)
    Base.metadata.create_all(bind=engine)

    seed = build_problem_catalog()[0]

    with Session() as db:
        db.add(
            Problem(
                id=seed.id,
                title=seed.title,
                slug=seed.slug,
                difficulty=seed.difficulty,
                description=seed.description,
                input_format=seed.input_format,
                output_format=seed.output_format,
                constraints_text=seed.constraints_text,
                starter_code=seed.starter_code,
                function_name=seed.function_name,
                tags_json="[]",
            )
        )
        db.commit()

        summary = ensure_problem_catalog_seeded(db)

        assert summary.total_count == 120
        assert summary.inserted_count == 119
        assert db.query(Problem).count() == 120
