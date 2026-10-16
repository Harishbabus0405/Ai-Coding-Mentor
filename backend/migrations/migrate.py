"""
Database Migration and Schema Verification Script for AI Coding Mentor.
Ensures all required MySQL/SQLite tables, relationships, and indices are provisioned.
"""
import sys
import os

# Add backend directory to path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from sqlalchemy import inspect
from app.db.database import get_engine, Base
from app.db.models import (
    UserModel,
    CodeSessionModel,
    InterviewSessionModel,
    InterviewQuestionModel,
    InterviewAnswerModel,
    InterviewFollowUpModel
)

def run_migrations():
    print("[MIGRATION] Initializing database engine...")
    engine = get_engine()
    print(f"[MIGRATION] Connected to engine dialect: {engine.name}")
    
    print("[MIGRATION] Creating all tables from declarative models...")
    Base.metadata.create_all(bind=engine)
    
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()
    print(f"[MIGRATION] Detected tables: {sorted(existing_tables)}")
    
    required_tables = [
        "users",
        "code_sessions",
        "interview_sessions",
        "interview_questions",
        "interview_answers",
        "interview_follow_ups"
    ]
    
    all_ok = True
    for table in required_tables:
        if table in existing_tables:
            columns = [c["name"] for c in inspector.get_columns(table)]
            print(f"  [OK] Table '{table}' verified with {len(columns)} columns.")
        else:
            print(f"  [FAIL] Table '{table}' missing!")
            all_ok = False
            
    if all_ok:
        print("[MIGRATION SUCCESS] All database tables and schemas verified.")
        return 0
    else:
        print("[MIGRATION ERROR] One or more tables failed to create.")
        return 1

if __name__ == "__main__":
    sys.exit(run_migrations())
