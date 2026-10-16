"""
End-to-end smoke test for Phase 6: Authentication, Session Persistence, and History.
Verifies registration, login, cookie setting, code session saving, and history retrieval.
"""

import os
import sys
import uuid

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app.main import app
from app.db.database import init_db

# Ensure tables are created
init_db()

client = TestClient(app)

def run_smoke_test():
    print("\n--- PHASE 6 LIVE SMOKE TEST ---")
    unique_email = f"candidate_{uuid.uuid4().hex[:8]}@example.com"
    password = "SecurePassword123!"
    display_name = "Phase 6 Candidate"

    # 1. Register User
    print(f"1. Registering new candidate ({unique_email})...")
    reg_resp = client.post("/api/auth/register", json={
        "email": unique_email,
        "password": password,
        "display_name": display_name
    })
    assert reg_resp.status_code == 201, f"Registration failed: {reg_resp.text}"
    reg_data = reg_resp.json()
    assert "access_token" in reg_data
    assert reg_data["user"]["email"] == unique_email
    print(f"   [PASS] User registered successfully with ID: {reg_data['user']['id']}")

    # 2. Check /api/auth/me using Cookie
    print("2. Verifying /api/auth/me profile via session cookie...")
    me_resp = client.get("/api/auth/me")
    assert me_resp.status_code == 200, f"Profile fetch failed: {me_resp.text}"
    me_data = me_resp.json()
    assert me_data["email"] == unique_email
    print(f"   [PASS] Profile authenticated: {me_data['display_name']} ({me_data['email']})")

    # 3. Save a Code Session
    print("3. Saving a code session with execution telemetry and AI results...")
    code_payload = {
        "title": "Reverse Linked List (Iterative)",
        "language": "python",
        "source_code": "def reverseList(head):\n    prev = None\n    curr = head\n    while curr:\n        nxt = curr.next\n        curr.next = prev\n        prev = curr\n        curr = nxt\n    return prev",
        "execution_status": "Passed",
        "stdout": "Test cases passed successfully.\n",
        "execution_time": 0.038,
        "memory_used": 14200.0,
        "analysis_summary": "Optimal O(n) time and O(1) auxiliary space implementation.",
        "analysis_results": {
            "time_complexity": "O(n)",
            "space_complexity": "O(1)",
            "strengths": ["Clean pointer swapping", "Handles empty list boundary"]
        }
    }
    save_resp = client.post("/api/history/code", json=code_payload)
    assert save_resp.status_code == 201, f"Save session failed: {save_resp.text}"
    save_data = save_resp.json()
    session_id = save_data["id"]
    print(f"   [PASS] Code session saved successfully with ID: {session_id}")

    # 4. List Code Sessions
    print("4. Querying paginated code history...")
    list_resp = client.get("/api/history/code?page=1&limit=10")
    assert list_resp.status_code == 200, f"List failed: {list_resp.text}"
    list_data = list_resp.json()
    assert list_data["total"] >= 1
    found = any(item["id"] == session_id for item in list_data["items"])
    assert found, "Saved session not found in user's history list"
    print(f"   [PASS] Found {list_data['total']} session(s) in history.")

    # 5. Fetch Session Detail
    print("5. Fetching session full detail...")
    detail_resp = client.get(f"/api/history/code/{session_id}")
    assert detail_resp.status_code == 200, f"Detail fetch failed: {detail_resp.text}"
    detail_data = detail_resp.json()
    assert detail_data["title"] == "Reverse Linked List (Iterative)"
    assert detail_data["language"] == "python"
    assert "reverseList" in detail_data["source_code"]
    print("   [PASS] Session detail verified.")

    # 6. Logout
    print("6. Testing logout...")
    logout_resp = client.post("/api/auth/logout")
    assert logout_resp.status_code == 200
    # Clear client cookie manually to test post-logout behavior
    client.cookies.clear()
    unauth_resp = client.get("/api/auth/me")
    assert unauth_resp.status_code == 401
    print("   [PASS] Logout verified. Access denied after cookie cleared.")

    # 7. Login again
    print("7. Testing login with valid credentials...")
    login_resp = client.post("/api/auth/login", json={
        "email": unique_email,
        "password": password
    })
    assert login_resp.status_code == 200
    print("   [PASS] Logged back in successfully.")

    # 8. Clean up session
    print("8. Deleting test code session...")
    del_resp = client.delete(f"/api/history/code/{session_id}")
    assert del_resp.status_code == 200
    verify_del = client.get(f"/api/history/code/{session_id}")
    assert verify_del.status_code == 404
    print("   [PASS] Deleted session and verified 404 on subsequent get.")

    print("\n=======================================================")
    print("  ALL PHASE 6 AUTH & HISTORY SMOKE TESTS PASSED (8/8)  ")
    print("=======================================================\n")

if __name__ == "__main__":
    run_smoke_test()
