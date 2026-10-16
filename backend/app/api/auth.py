"""
Authentication API Router.
Endpoints:
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me
- POST /api/auth/logout
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
)
from app.db.database import get_db
from app.db.models import UserModel
from app.api.deps import get_current_user
from app.services.auth_models import (
    RegisterRequest,
    LoginRequest,
    UserProfileResponse,
    AuthSuccessResponse,
)

logger = logging.getLogger("ai_coding_mentor.auth")

router = APIRouter(prefix="/auth", tags=["Authentication"])


def set_auth_cookie(response: Response, token: str) -> None:
    """Sets a secure HttpOnly cookie for session management."""
    response.set_cookie(
        key=settings.AUTH_COOKIE_NAME,
        value=token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        path="/"
    )


@router.post(
    "/register",
    response_model=AuthSuccessResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register New User Account"
)
async def register_user(
    request: RegisterRequest,
    response: Response,
    db: Session = Depends(get_db)
):
    """
    Registers a new candidate account.
    Enforces strong password rules and Argon2id hashing.
    Rejects duplicate email addresses with HTTP 409 Conflict.
    """
    # 1. Check if email already registered
    existing_user = db.query(UserModel).filter(UserModel.email == request.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists."
        )

    # 2. Hash password securely
    hashed_pwd = hash_password(request.password)

    # 3. Create user record
    new_user = UserModel(
        email=request.email,
        password_hash=hashed_pwd,
        display_name=request.display_name or request.email.split("@")[0],
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # 4. Generate JWT access token
    token = create_access_token({
        "sub": new_user.id,
        "email": new_user.email
    })

    # 5. Set HttpOnly cookie
    set_auth_cookie(response, token)

    return AuthSuccessResponse(
        user=UserProfileResponse(
            id=new_user.id,
            email=new_user.email,
            display_name=new_user.display_name,
            created_at=new_user.created_at.isoformat()
        ),
        access_token=token,
        token_type="bearer",
        expires_in_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )


@router.post(
    "/login",
    response_model=AuthSuccessResponse,
    summary="User Login"
)
async def login_user(
    request: LoginRequest,
    response: Response,
    db: Session = Depends(get_db)
):
    """
    Authenticates candidate using email and password.
    Returns generic failure on mismatch to prevent username enumeration.
    """
    user = db.query(UserModel).filter(UserModel.email == request.email).first()

    # Generic check to prevent account enumeration
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive. Please contact support."
        )

    # Generate token
    token = create_access_token({
        "sub": user.id,
        "email": user.email
    })

    # Set HttpOnly cookie
    set_auth_cookie(response, token)

    return AuthSuccessResponse(
        user=UserProfileResponse(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            created_at=user.created_at.isoformat()
        ),
        access_token=token,
        token_type="bearer",
        expires_in_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )


@router.get(
    "/me",
    response_model=UserProfileResponse,
    summary="Get Current User Profile"
)
async def get_me(
    current_user: UserModel = Depends(get_current_user)
):
    """Returns the authenticated user's profile."""
    return UserProfileResponse(
        id=current_user.id,
        email=current_user.email,
        display_name=current_user.display_name,
        created_at=current_user.created_at.isoformat()
    )


@router.post(
    "/logout",
    summary="Log Out User"
)
async def logout_user(
    response: Response
):
    """Clears authentication HttpOnly cookies."""
    response.delete_cookie(
        key=settings.AUTH_COOKIE_NAME,
        path="/"
    )
    return {"message": "Successfully logged out."}
