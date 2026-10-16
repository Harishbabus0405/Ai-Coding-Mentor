from datetime import datetime, timezone
from fastapi import APIRouter
from app.core.config import settings
from app.services.execution_service import is_provider_configured

router = APIRouter(tags=["Health"])


@router.get("/health", summary="Service Health Check")
async def health_check():
    """Health check endpoint to verify backend service status and configuration."""
    db_status = "unconfigured"
    if settings.DATABASE_URL:
        db_status = "configured"
        try:
            from app.db.database import init_db
            from sqlalchemy import text
            eng = init_db()
            with eng.connect() as conn:
                conn.execute(text("SELECT 1"))
            db_status = f"connected ({eng.name})"
        except Exception:
            db_status = "disconnected"

    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checks": {
            "api": "ok",
            "groq_configured": bool(settings.GROQ_API_KEY and settings.GROQ_API_KEY != "your_groq_api_key_here"),
            "database_configured": bool(settings.DATABASE_URL),
            "database_status": db_status,
            "judge0_configured": is_provider_configured()
        }
    }
