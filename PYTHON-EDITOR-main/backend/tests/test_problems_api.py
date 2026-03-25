from pathlib import Path
import sys

from fastapi.testclient import TestClient


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.main import app


client = TestClient(app)


def test_list_problems_supports_pagination_and_query() -> None:
    response = client.get(
        "/api/problems",
        params={
            "page": 1,
            "per_page": 200,
            "q": "divisible",
            "tags": "array",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["page"] == 1
    assert payload["per_page"] == 200
    assert payload["total"] == 10
    assert payload["total_pages"] >= 1
    assert payload["selected_tags"] == ["array"]
    assert payload["easy_only"] is False
    assert len(payload["items"]) == 10
    assert payload["items"][0]["slug"].startswith("divisible-sum-")


def test_problem_catalog_contains_expected_distribution() -> None:
    response = client.get("/api/problems", params={"page": 1, "per_page": 200})

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 120

    counts = {"easy": 0, "medium": 0, "hard": 0}
    for item in payload["items"]:
        counts[item["difficulty"]] += 1

    assert counts == {"easy": 50, "medium": 50, "hard": 20}


def test_get_problem_returns_detail_without_hidden_tests() -> None:
    response = client.get("/api/problems/divisible-sum-01")

    assert response.status_code == 200
    payload = response.json()
    assert payload["slug"] == "divisible-sum-01"
    assert payload["title"] == "Beacon Divisible Sum"
    assert payload["difficulty"] == "easy"
    assert payload["function_name"] == "solve"
    assert payload["hidden_testcase_count"] == 3
    assert "hidden_testcases" not in payload
    assert len(payload["visible_testcases"]) == 3
    assert "divisible by 2" in payload["description"].lower()


def test_health_endpoints_report_ok() -> None:
    health = client.get("/health")
    db = client.get("/health/db")
    cache = client.get("/health/cache")

    assert health.status_code == 200
    assert health.json()["status"] == "ok"
    assert db.status_code == 200
    assert db.json()["status"] == "ok"
    assert cache.status_code == 200
    assert cache.json()["status"] == "ok"
