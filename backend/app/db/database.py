import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

logger = logging.getLogger("ai_coding_mentor.db")

Base = declarative_base()

def get_engine():
    """
    Creates an engine using settings.DATABASE_URL.
    If connecting to MySQL fails (e.g. no local MySQL daemon running),
    it gracefully falls back to a local SQLite database for zero-friction development and testing.
    """
    database_url = settings.DATABASE_URL
    
    # Try connecting with configured URL
    if database_url and database_url.startswith("mysql"):
        try:
            engine = create_engine(
                database_url,
                pool_pre_ping=True,
                pool_recycle=3600,
                connect_args={"connect_timeout": 3}
            )
            # Test connection
            with engine.connect() as conn:
                pass
            logger.info("Connected to configured MySQL database.")
            return engine
        except Exception as e:
            logger.warning(
                f"Could not connect to MySQL at {database_url} ({e}). "
                "Falling back to local SQLite database: ai_coding_mentor.db"
            )
    
    # Fallback to local SQLite database
    sqlite_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 
        "ai_coding_mentor.db"
    )
    sqlite_url = f"sqlite:///{sqlite_path}"
    engine = create_engine(
        sqlite_url,
        connect_args={"check_same_thread": False}
    )
    return engine

# Lazy initialization
_engine = None
_SessionLocal = None

def init_db():
    global _engine, _SessionLocal
    if _engine is None:
        _engine = get_engine()
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
        # Create all tables automatically
        Base.metadata.create_all(bind=_engine)
    return _engine

def get_db():
    """FastAPI dependency to yield database sessions."""
    global _SessionLocal
    if _SessionLocal is None:
        init_db()
    db = _SessionLocal()
    try:
        yield db
    finally:
        db.close()
