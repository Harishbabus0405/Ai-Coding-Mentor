"""
Automated Test Suite for Phase 6: Code & Interview History Persistence.
Tests cover:
- Save code session (requires auth, HTTP 401 unauthenticated)
- Save, list, paginate, and search code sessions
- Filter code sessions by programming language
- Candidate ownership enforcement on Code Sessions:
  - User A cannot view User B's code session (HTTP 403)
  - User A cannot delete User B's code session (HTTP 403)
  - User B's list does not contain User A's sessions
- Deleting owned code session (HTTP 200, 404 on subsequent get)
- Nonexistent code session returns HTTP 404
- Interview history listing and candidate ownership enforcement:
  - User A's interview sessions appear in User A's list
  - User B cannot view User A's interview session (HTTP 403)
  - User B cannot delete User A's interview session (HTTP 403)
  - User A can delete own interview session (HTTP 200)
"""

import os
import sys
import uuid
import pytest
from datetime import datetime

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.database import Base, get_db
from app.db.models import UserModel, CodeSessionModel, InterviewSessionModel
from app.core.security import hash_password, create_access_token

# In-memory SQLite with StaticPool for test isolation
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


# =========================================================================
# Helper Fixtures & Setup
# =========================================================================

@pytest.fixture(autouse=True)
def clean_database():
    """Ensure database tables are fresh, dependency override is set, and client cookies are cleared."""
    app.dependency_overrides[get_db] = override_get_db
    client.cookies.clear()
    db = TestingSessionLocal()
    db.query(CodeSessionModel).delete()
    db.query(InterviewSessionModel).delete()
    db.query(UserModel).delete()
    db.commit()
    db.close()


def create_test_user(email: str, password: str = "StrongPass123!", display_name: str = "Test User") -> UserModel:
    """Helper to insert a user directly into the database."""
    db = TestingSessionLocal()
    user = UserModel(
        id=str(uuid.uuid4()),
        email=email.lower().strip(),
        password_hash=hash_password(password),
        display_name=display_name,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return user


def get_auth_headers(user: UserModel) -> dict:
    """Helper to generate Authorization header for a user."""
    token = create_access_token({"sub": user.id, "email": user.email})
    return {"Authorization": f"Bearer {token}"}


# =========================================================================
# 1. Code Session History Tests
# =========================================================================

def test_save_code_session_requires_auth():
    """Saving a code session without authentication returns 401."""
    payload = {
        "title": "Two Sum Solution",
        "language": "python",
        "source_code": "def two_sum(nums, target): return [0, 1]"
    }
    response = client.post("/api/history/code", json=payload)
    assert response.status_code == 401


def test_save_and_retrieve_code_session():
    """Candidate can save a code session and retrieve it by ID."""
    user = create_test_user("alice@example.com", display_name="Alice")
    headers = get_auth_headers(user)

    payload = {
        "title": "Binary Search",
        "language": "python",
        "source_code": "def binary_search(arr, x):\n    l, r = 0, len(arr) - 1\n    return -1",
        "execution_status": "Passed",
        "stdout": "All test cases passed!\n",
        "execution_time": 0.045,
        "memory_used": 12.4,
        "analysis_summary": "Clean logarithmic implementation with O(1) space.",
        "analysis_results": {"time_complexity": "O(log n)", "space_complexity": "O(1)"}
    }

    # Save session
    save_resp = client.post("/api/history/code", json=payload, headers=headers)
    assert save_resp.status_code == 201
    saved_data = save_resp.json()
    assert saved_data["title"] == "Binary Search"
    assert saved_data["language"] == "python"
    assert "binary_search" in saved_data["source_code"]
    assert saved_data["execution_status"] == "Passed"
    assert saved_data["analysis_results"]["time_complexity"] == "O(log n)"
    session_id = saved_data["id"]

    # Retrieve by ID
    get_resp = client.get(f"/api/history/code/{session_id}", headers=headers)
    assert get_resp.status_code == 200
    retrieved = get_resp.json()
    assert retrieved["id"] == session_id
    assert retrieved["title"] == "Binary Search"
    assert retrieved["stdout"] == "All test cases passed!\n"


def test_code_session_pagination_and_filtering():
    """Verify pagination, language filtering, and search in code history."""
    user = create_test_user("bob@example.com", display_name="Bob")
    headers = get_auth_headers(user)

    # Insert 3 Python sessions and 2 JavaScript sessions
    sessions_data = [
        {"title": "Python DFS", "language": "python", "source_code": "def dfs(): pass"},
        {"title": "Python BFS", "language": "python", "source_code": "def bfs(): pass"},
        {"title": "Python QuickSort", "language": "python", "source_code": "def quicksort(): pass"},
        {"title": "JS Promise All", "language": "javascript", "source_code": "Promise.all([])"},
        {"title": "JS Debounce", "language": "javascript", "source_code": "function debounce() {}"},
    ]
    for s in sessions_data:
        client.post("/api/history/code", json=s, headers=headers)

    # Test total count and pagination limit
    resp_all = client.get("/api/history/code?page=1&limit=10", headers=headers)
    assert resp_all.status_code == 200
    assert resp_all.json()["total"] == 5
    assert len(resp_all.json()["items"]) == 5

    # Test limit=2 pagination
    resp_p1 = client.get("/api/history/code?page=1&limit=2", headers=headers)
    assert resp_p1.status_code == 200
    assert len(resp_p1.json()["items"]) == 2
    assert resp_p1.json()["total_pages"] == 3

    # Test language filter
    resp_py = client.get("/api/history/code?language=python", headers=headers)
    assert resp_py.status_code == 200
    assert resp_py.json()["total"] == 3
    for item in resp_py.json()["items"]:
        assert item["language"] == "python"

    # Test search term filter
    resp_search = client.get("/api/history/code?search=Debounce", headers=headers)
    assert resp_search.status_code == 200
    assert resp_search.json()["total"] == 1
    assert resp_search.json()["items"][0]["title"] == "JS Debounce"


def test_code_session_ownership_protection():
    """User B cannot view, modify, or delete User A's code session."""
    user_a = create_test_user("alice@domain.com", display_name="Alice")
    user_b = create_test_user("charlie@domain.com", display_name="Charlie")

    headers_a = get_auth_headers(user_a)
    headers_b = get_auth_headers(user_b)

    # Alice saves a session
    save_resp = client.post("/api/history/code", json={
        "title": "Alice's Secret Algorithm",
        "language": "python",
        "source_code": "def secret_formula(): return 42"
    }, headers=headers_a)
    assert save_resp.status_code == 201
    session_id = save_resp.json()["id"]

    # Charlie lists sessions -> Alice's session should NOT appear
    list_b = client.get("/api/history/code", headers=headers_b)
    assert list_b.status_code == 200
    assert list_b.json()["total"] == 0

    # Charlie attempts to view Alice's session -> 403 Forbidden
    get_forbidden = client.get(f"/api/history/code/{session_id}", headers=headers_b)
    assert get_forbidden.status_code == 403
    assert "permission" in get_forbidden.json()["detail"].lower()

    # Charlie attempts to update Alice's session -> 403 Forbidden
    update_forbidden = client.post("/api/history/code", json={
        "session_id": session_id,
        "title": "Hacked Title",
        "language": "python",
        "source_code": "malicious code"
    }, headers=headers_b)
    assert update_forbidden.status_code == 403

    # Charlie attempts to delete Alice's session -> 403 Forbidden
    delete_forbidden = client.delete(f"/api/history/code/{session_id}", headers=headers_b)
    assert delete_forbidden.status_code == 403

    # Verify session still exists for Alice
    get_alice = client.get(f"/api/history/code/{session_id}", headers=headers_a)
    assert get_alice.status_code == 200
    assert get_alice.json()["title"] == "Alice's Secret Algorithm"


def test_delete_code_session():
    """Candidate can delete their own session, returning 404 subsequently."""
    user = create_test_user("david@domain.com")
    headers = get_auth_headers(user)

    save_resp = client.post("/api/history/code", json={
        "title": "To Be Deleted",
        "language": "cpp",
        "source_code": "int main() { return 0; }"
    }, headers=headers)
    session_id = save_resp.json()["id"]

    # Delete session
    del_resp = client.delete(f"/api/history/code/{session_id}", headers=headers)
    assert del_resp.status_code == 200
    assert "deleted" in del_resp.json()["message"].lower()

    # Verify 404 on subsequent get
    get_resp = client.get(f"/api/history/code/{session_id}", headers=headers)
    assert get_resp.status_code == 404


def test_nonexistent_code_session_returns_404():
    """Accessing or deleting a nonexistent session ID returns 404."""
    user = create_test_user("eve@domain.com")
    headers = get_auth_headers(user)
    fake_id = "00000000-0000-0000-0000-000000000000"

    get_resp = client.get(f"/api/history/code/{fake_id}", headers=headers)
    assert get_resp.status_code == 404

    del_resp = client.delete(f"/api/history/code/{fake_id}", headers=headers)
    assert del_resp.status_code == 404


# =========================================================================
# 2. Interview History Tests
# =========================================================================

def test_interview_history_listing_and_ownership():
    """Verify interview session persistence, listing, and ownership isolation."""
    user_a = create_test_user("frank@domain.com", display_name="Frank")
    user_b = create_test_user("grace@domain.com", display_name="Grace")

    headers_a = get_auth_headers(user_a)
    headers_b = get_auth_headers(user_b)

    # Directly create an interview session owned by Frank
    db = TestingSessionLocal()
    interview_session = InterviewSessionModel(
        id=str(uuid.uuid4()),
        user_id=user_a.id,
        language="python",
        difficulty="medium",
        topic="dsa",
        status="completed",
        num_questions=3,
        source_code="def solution(): pass",
        final_score=85.0
    )
    db.add(interview_session)
    db.commit()
    session_id = interview_session.id
    db.close()

    # Frank lists interviews -> should see the session
    resp_frank = client.get("/api/history/interviews", headers=headers_a)
    assert resp_frank.status_code == 200
    assert resp_frank.json()["total"] == 1
    assert resp_frank.json()["items"][0]["id"] == session_id
    assert resp_frank.json()["items"][0]["average_score"] == 85.0

    # Grace lists interviews -> should see 0 sessions
    resp_grace = client.get("/api/history/interviews", headers=headers_b)
    assert resp_grace.status_code == 200
    assert resp_grace.json()["total"] == 0

    # Grace attempts to view Frank's interview detail -> 403 Forbidden
    get_forbidden = client.get(f"/api/history/interviews/{session_id}", headers=headers_b)
    assert get_forbidden.status_code == 403

    # Grace attempts to delete Frank's interview -> 403 Forbidden
    del_forbidden = client.delete(f"/api/history/interviews/{session_id}", headers=headers_b)
    assert del_forbidden.status_code == 403

    # Frank deletes own interview session -> 200
    del_ok = client.delete(f"/api/history/interviews/{session_id}", headers=headers_a)
    assert del_ok.status_code == 200

    # Frank subsequent get -> 404
    get_404 = client.get(f"/api/history/interviews/{session_id}", headers=headers_a)
    assert get_404.status_code == 404
