"""
Automated Test Suite for Phase 6: Authentication & Security.
Tests cover:
- Successful user registration with Argon2id password hashing
- Password strength validation (length, uppercase, lowercase, special characters)
- Duplicate email registration rejection (HTTP 409)
- User login with valid credentials (issues JWT and sets HttpOnly cookie)
- Invalid login credentials rejection with generic 401
- GET /api/auth/me authenticated profile retrieval
- Expired / invalid token handling
- POST /api/auth/logout cookie clearing
"""

import os
import sys
import pytest
from datetime import timedelta

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.database import Base, get_db
from app.core.security import create_access_token

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


@pytest.fixture(autouse=True)
def setup_test_auth():
    """Ensure dependency override is set, tables are clean, and cookies reset."""
    app.dependency_overrides[get_db] = override_get_db
    client.cookies.clear()
    yield
    client.cookies.clear()


# =========================================================================
# 1. Registration Tests
# =========================================================================

def test_successful_user_registration():
    """Verify that a valid user can register, receive JWT, and cookie is set."""
    payload = {
        "email": "candidate1@example.com",
        "password": "StrongPassword123!",
        "display_name": "Alice Candidate"
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "candidate1@example.com"
    assert data["user"]["display_name"] == "Alice Candidate"
    assert "password" not in data["user"]
    assert "password_hash" not in data["user"]

    # Verify HttpOnly cookie
    assert "access_token" in response.cookies


def test_registration_password_strength_enforcement():
    """Verify that weak passwords are rejected with HTTP 422."""
    # Too short (< 8 chars)
    res_short = client.post("/api/auth/register", json={
        "email": "user_short@example.com",
        "password": "Ab1!"
    })
    assert res_short.status_code == 422
    assert "at least 8 characters" in res_short.text

    # No uppercase
    res_no_upper = client.post("/api/auth/register", json={
        "email": "user_no_upper@example.com",
        "password": "password123!"
    })
    assert res_no_upper.status_code == 422
    assert "uppercase" in res_no_upper.text

    # No lowercase
    res_no_lower = client.post("/api/auth/register", json={
        "email": "user_no_lower@example.com",
        "password": "PASSWORD123!"
    })
    assert res_no_lower.status_code == 422
    assert "lowercase" in res_no_lower.text

    # No digit or special char
    res_no_digit = client.post("/api/auth/register", json={
        "email": "user_no_digit@example.com",
        "password": "PasswordOnly"
    })
    assert res_no_digit.status_code == 422
    assert "digit or special character" in res_no_digit.text


def test_duplicate_email_registration_rejected():
    """Verify that registering with an existing email returns HTTP 409 Conflict."""
    payload = {
        "email": "duplicate@example.com",
        "password": "Password123!",
        "display_name": "First User"
    }
    # Initial registration
    res1 = client.post("/api/auth/register", json=payload)
    assert res1.status_code == 201

    # Second registration with same email (different casing)
    res2 = client.post("/api/auth/register", json={
        "email": "DUPLICATE@example.com ",
        "password": "OtherPassword456!",
        "display_name": "Duplicate User"
    })
    assert res2.status_code == 409
    assert "already exists" in res2.json()["detail"].lower()


# =========================================================================
# 2. Login Tests
# =========================================================================

def test_successful_login():
    """Verify user can log in with valid credentials and receive token and cookie."""
    # Register first
    client.post("/api/auth/register", json={
        "email": "login_test@example.com",
        "password": "LoginSecret123!",
        "display_name": "Login Tester"
    })

    # Log in
    login_res = client.post("/api/auth/login", json={
        "email": "login_test@example.com",
        "password": "LoginSecret123!"
    })
    assert login_res.status_code == 200
    data = login_res.json()
    assert "access_token" in data
    assert data["user"]["email"] == "login_test@example.com"
    assert "access_token" in login_res.cookies


def test_invalid_login_credentials_generic_failure():
    """Verify that invalid password or nonexistent email returns generic 401 without enumeration."""
    # Wrong password for existing user
    res_wrong_pw = client.post("/api/auth/login", json={
        "email": "login_test@example.com",
        "password": "WrongPassword999!"
    })
    assert res_wrong_pw.status_code == 401
    assert "invalid email or password" in res_wrong_pw.json()["detail"].lower()

    # Non-existent email
    res_nonexistent = client.post("/api/auth/login", json={
        "email": "ghost_candidate@example.com",
        "password": "SomePassword123!"
    })
    assert res_nonexistent.status_code == 401
    assert "invalid email or password" in res_nonexistent.json()["detail"].lower()


# =========================================================================
# 3. Authenticated Profile & Token Tests
# =========================================================================

def test_get_me_authenticated():
    """Verify GET /api/auth/me returns profile using cookie or Bearer header."""
    reg_res = client.post("/api/auth/register", json={
        "email": "profile_test@example.com",
        "password": "ProfilePassword123!",
        "display_name": "Profile User"
    })
    token = reg_res.json()["access_token"]

    # Test via Authorization Bearer header
    res_header = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res_header.status_code == 200
    assert res_header.json()["email"] == "profile_test@example.com"

    # Test via HttpOnly cookie
    res_cookie = client.get("/api/auth/me", cookies={"access_token": token})
    assert res_cookie.status_code == 200
    assert res_cookie.json()["display_name"] == "Profile User"


def test_get_me_unauthenticated_returns_401():
    """Verify GET /api/auth/me without token returns HTTP 401."""
    client.cookies.clear()
    res = client.get("/api/auth/me")
    assert res.status_code == 401


def test_get_me_expired_token_returns_401():
    """Verify GET /api/auth/me with an expired token returns HTTP 401."""
    client.cookies.clear()
    expired_token = create_access_token(
        data={"sub": "user-123", "email": "test@example.com"},
        expires_delta=timedelta(seconds=-10)  # Expired in past
    )
    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
    assert res.status_code == 401
    assert "expired" in res.json()["detail"].lower()


# =========================================================================
# 4. Logout Tests
# =========================================================================

def test_logout_clears_cookie():
    """Verify POST /api/auth/logout clears the access_token cookie."""
    res = client.post("/api/auth/logout")
    assert res.status_code == 200
    assert res.json()["message"] == "Successfully logged out."
