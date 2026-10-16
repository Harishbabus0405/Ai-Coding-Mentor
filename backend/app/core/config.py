import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Coding Mentor API"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    
    # CORS Origins allowed to communicate with backend
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"
    
    # AI Groq configuration (Backend only, never exposed to client)
    GROQ_API_KEY: str = Field(default="", description="Groq API key for AI reasoning and mentoring")
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    GROQ_TIMEOUT_SECONDS: float = Field(default=30.0, description="Max timeout for Groq API calls")
    GROQ_MAX_RETRIES: int = Field(default=2, description="Max retries for transient Groq errors")
    
    # Database connection string (MySQL for Phase 4)
    DATABASE_URL: str = Field(
        default="mysql+pymysql://root:password@localhost:3306/ai_coding_mentor",
        description="MySQL database connection string"
    )
    
    # Authentication & Security (Phase 6)
    JWT_SECRET: str = Field(
        default="dev_secret_key_change_in_production_min_32_chars_long",
        description="Secret key for JWT generation"
    )
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    AUTH_COOKIE_NAME: str = "access_token"
    AUTH_COOKIE_SECURE: bool = False  # Set to True in production HTTPS
    AUTH_COOKIE_SAMESITE: str = "lax"

    # Judge0 Code Execution Engine (Phase 3)
    # Default points to RapidAPI or self-hosted Judge0 instance
    JUDGE0_URL: str = Field(
        default="https://judge0-ce.p.rapidapi.com",
        description="Base URL for Judge0 code execution service (e.g. RapidAPI or self-hosted http://localhost:2358)"
    )
    JUDGE0_API_KEY: str = Field(
        default="",
        description="API key for Judge0 service (RapidAPI Key or self-hosted auth token)"
    )
    JUDGE0_API_HOST: str = Field(
        default="judge0-ce.p.rapidapi.com",
        description="RapidAPI Host header if using RapidAPI"
    )
    JUDGE0_TIMEOUT_SECONDS: float = Field(
        default=15.0,
        description="HTTP request timeout for execution calls"
    )
    JUDGE0_CPU_TIME_LIMIT: float = Field(
        default=5.0,
        description="Max CPU execution time in seconds"
    )
    JUDGE0_MEMORY_LIMIT: int = Field(
        default=128000,
        description="Max memory limit in KB (128MB)"
    )
    MAX_SOURCE_CODE_LENGTH: int = Field(
        default=65536,
        description="Max allowed source code length in characters (64KB)"
    )
    MAX_STDIN_LENGTH: int = Field(
        default=32768,
        description="Max allowed stdin length in characters (32KB)"
    )

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
