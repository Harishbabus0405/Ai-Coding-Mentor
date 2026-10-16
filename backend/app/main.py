from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from contextlib import asynccontextmanager
from app.api.health import router as health_router
from app.api.execute import router as execute_router
from app.api.analyze import router as analyze_router
from app.api.interview import router as interview_router
from app.api.auth import router as auth_router
from app.api.history import router as history_router
from app.db.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables on application start
    try:
        init_db()
    except Exception as e:
        import logging
        logging.getLogger("ai_coding_mentor").warning(f"Could not auto-initialize DB on startup: {e}")
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Backend API for AI Coding Mentor platform - an intelligent coding interview preparation system.",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Configure CORS for local development and frontend client
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routes
app.include_router(health_router, prefix="/api")
app.include_router(execute_router, prefix="/api")
app.include_router(analyze_router, prefix="/api")
app.include_router(interview_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(history_router, prefix="/api")


@app.get("/", tags=["Root"])
async def root():
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "online",
        "docs": "/docs",
        "health": "/api/health",
        "execute": "/api/execute",
        "analyze": "/api/analyze",
        "interview": "/api/interview",
        "auth": "/api/auth",
        "history": "/api/history"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )
