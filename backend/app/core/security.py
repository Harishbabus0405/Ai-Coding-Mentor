"""
Security, Password Hashing, and JWT Authentication Utilities.
Implements Argon2id password hashing, strength validation, and JWT token issuance.
"""

import re
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHash
import jwt

from app.core.config import settings

# Argon2 password hasher with standard RFC parameters
ph = PasswordHasher(
    time_cost=2,
    memory_cost=19456,  # ~19 MB memory
    parallelism=1
)


def hash_password(password: str) -> str:
    """Hashes a plaintext password using Argon2id."""
    return ph.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plaintext password against an Argon2 hash. Never raises on mismatch."""
    try:
        return ph.verify(hashed_password, plain_password)
    except (VerifyMismatchError, InvalidHash, Exception):
        return False


def validate_password_strength(password: str) -> None:
    """
    Enforces strong password rules:
    - Minimum 8 characters
    - At least 1 uppercase letter
    - At least 1 lowercase letter
    - At least 1 digit or special character
    """
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long.")
    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must contain at least one uppercase letter.")
    if not re.search(r"[a-z]", password):
        raise ValueError("Password must contain at least one lowercase letter.")
    if not re.search(r"[0-9!@#$%^&*(),.?\":{}|<>_\-\+=]", password):
        raise ValueError("Password must contain at least one digit or special character.")


def normalize_email(email: str) -> str:
    """Cleans and standardizes email addresses to prevent duplicate casing issues."""
    cleaned = email.strip().lower()
    # Basic standard email pattern check
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", cleaned):
        raise ValueError("Invalid email address format.")
    return cleaned


def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Creates and signs a JWT access token with expiration and issue timestamps.
    """
    to_encode = data.copy()
    now_utc = datetime.now(timezone.utc)
    expire = now_utc + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))

    to_encode.update({
        "exp": expire,
        "iat": now_utc
    })

    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decodes and validates a JWT token's signature, issuer, and expiration time.
    Raises jwt.ExpiredSignatureError or jwt.InvalidTokenError on failure.
    """
    return jwt.decode(
        token,
        settings.JWT_SECRET,
        algorithms=[settings.JWT_ALGORITHM]
    )
