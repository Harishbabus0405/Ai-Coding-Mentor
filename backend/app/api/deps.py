"""
Authentication Dependencies for FastAPI Route Handlers.
Extracts and validates JWT tokens from HttpOnly cookies and Bearer headers.
"""

from typing import Optional
from fastapi import Request, Depends, HTTPException, status
from sqlalchemy.orm import Session
import jwt

from app.core.config import settings
from app.core.security import decode_access_token
from app.db.database import get_db
from app.db.models import UserModel


def extract_token_from_request(request: Request) -> Optional[str]:
    """
    Extracts JWT token from HttpOnly cookie first, then falls back to Authorization Bearer header.
    """
    # 1. Prefer HttpOnly cookie
    cookie_token = request.cookies.get(settings.AUTH_COOKIE_NAME)
    if cookie_token and cookie_token.strip():
        return cookie_token.strip()

    # 2. Check Authorization: Bearer <token> header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        parts = auth_header.split(" ", 1)
        if len(parts) == 2 and parts[1].strip():
            return parts[1].strip()

    return None


async def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
) -> UserModel:
    """
    Validates identity and returns the active UserModel.
    Raises HTTP 401 Unauthorized if unauthenticated or invalid.
    """
    token = extract_token_from_request(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    try:
        payload = decode_access_token(token)
        user_id: Optional[str] = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload.",
                headers={"WWW-Authenticate": "Bearer"}
            )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    except (jwt.InvalidTokenError, Exception):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or deleted.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account."
        )

    return user


async def get_optional_current_user(
    request: Request,
    db: Session = Depends(get_db)
) -> Optional[UserModel]:
    """
    Returns the authenticated UserModel if valid, or None if anonymous/unauthenticated.
    Allows public or guest workflows to optionally attach records to logged-in users.
    """
    token = extract_token_from_request(request)
    if not token:
        return None

    try:
        payload = decode_access_token(token)
        user_id: Optional[str] = payload.get("sub")
        if not user_id:
            return None
        user = db.query(UserModel).filter(UserModel.id == user_id).first()
        if user and user.is_active:
            return user
    except Exception:
        return None

    return None
