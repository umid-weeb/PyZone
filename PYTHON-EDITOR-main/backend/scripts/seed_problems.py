from __future__ import annotations

import argparse
import sys
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app import models as _models  # noqa: F401
from app.database import Base, SessionLocal, engine
from app.services.problem_catalog import seed_problem_catalog


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed the default Pyzone Arena problem catalog.")
    parser.add_argument("--force", action="store_true", help="Delete existing problems before inserting the default catalog.")
    args = parser.parse_args()

    Base.metadata.create_all(bind=engine)

    print("Seeding problems...")
    with SessionLocal() as db:
        summary = seed_problem_catalog(db, force=args.force)

    print(f"{summary.total_count} problems ready.")
    print(
        f"Seeded {summary.inserted_count} problems, skipped {summary.skipped_count}, total catalog size {summary.total_count}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
