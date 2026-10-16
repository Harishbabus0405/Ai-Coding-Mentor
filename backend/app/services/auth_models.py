"""
Pydantic Models and Schemas for User Authentication.
"""

from typing import Optional
from pydantic import BaseModel, Field, field_validator
from app.core.security import normalize_email, validate_password_strength


class RegisterRequest(BaseModel):
    email: str = Field(..., max_length=255, description="Candidate email address")
    password: str = Field(..., min_length=8, max_length=128, description="Candidate plaintext password")
    display_name: Optional[str] = Field(default=None, max_length=100, description="Optional public candidate name")

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        return normalize_email(v)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        validate_password_strength(v)
        return v


class LoginRequest(BaseModel):
    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        return normalize_email(v)


class UserProfileResponse(BaseModel):
    id: str
    email: str
    display_name: Optional[str] = None
    created_at: str


class AuthSuccessResponse(BaseModel):
    user: UserProfileResponse
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int
