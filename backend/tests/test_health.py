"""Test suite for health check endpoint."""
import sys
import os

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from starlette.testclient import TestClient
from app.main import app


def test_health_check_endpoint():
    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    payload = response.json()
    assert payload.get("status") == "healthy", f"Expected status 'healthy', got {payload.get('status')}"
    assert payload.get("service") == "AI Coding Mentor API"
    assert "version" in payload
    assert "timestamp" in payload
    assert "checks" in payload
    print("[PASS] Health check endpoint responded with 200 OK and valid schema.")
    print("Payload:", payload)


def test_root_endpoint():
    client = TestClient(app)
    response = client.get("/")
    assert response.status_code == 200
    payload = response.json()
    assert payload.get("status") == "online"
    print("[PASS] Root endpoint responded with 200 OK.")


if __name__ == "__main__":
    test_health_check_endpoint()
    test_root_endpoint()
    print("All backend verification tests passed successfully!")
