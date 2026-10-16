"""
History API Router for Code Sessions and Interview Sessions.
Enforces strict candidate ownership: candidates can only view, restore,
and delete records they own.
"""

import json
import logging
from math import ceil
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.db.database import get_db
from app.db.models import UserModel, CodeSessionModel, InterviewSessionModel
from app.api.deps import get_current_user
from app.services.interview_service import get_session_detail
from app.services.history_models import (
    SaveCodeSessionRequest,
    CodeSessionSummaryResponse,
    CodeSessionDetailResponse,
    PaginatedCodeSessionsResponse,
    InterviewSessionSummaryResponse,
    PaginatedInterviewSessionsResponse,
)

logger = logging.getLogger("ai_coding_mentor.history")

router = APIRouter(prefix="/history", tags=["History & Persistence"])


# =========================================================================
# Code Session History Endpoints
# =========================================================================

@router.post(
    "/code",
    response_model=CodeSessionDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Save or Update Code Session"
)
async def save_code_session(
    request: SaveCodeSessionRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Saves the candidate's active coding session, including source code,
    execution telemetry, and multi-agent AI analysis results.
    """
    if request.session_id:
        existing = db.query(CodeSessionModel).filter(
            CodeSessionModel.id == request.session_id
        ).first()

        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Code session '{request.session_id}' not found."
            )

        if existing.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to modify this code session."
            )

        # Update existing session
        existing.title = request.title
        existing.language = request.language
        existing.source_code = request.source_code
        existing.execution_status = request.execution_status
        existing.stdout = request.stdout
        existing.stderr = request.stderr
        existing.compile_output = request.compile_output
        existing.execution_time = request.execution_time
        existing.memory_used = request.memory_used
        existing.analysis_summary = request.analysis_summary
        existing.analysis_results = json.dumps(request.analysis_results) if request.analysis_results else None

        db.commit()
        db.refresh(existing)
        target = existing
    else:
        # Create new session
        new_session = CodeSessionModel(
            user_id=current_user.id,
            title=request.title or f"{request.language.capitalize()} Solution",
            language=request.language,
            source_code=request.source_code,
            execution_status=request.execution_status,
            stdout=request.stdout,
            stderr=request.stderr,
            compile_output=request.compile_output,
            execution_time=request.execution_time,
            memory_used=request.memory_used,
            analysis_summary=request.analysis_summary,
            analysis_results=json.dumps(request.analysis_results) if request.analysis_results else None
        )
        db.add(new_session)
        db.commit()
        db.refresh(new_session)
        target = new_session

    return CodeSessionDetailResponse(
        id=target.id,
        title=target.title,
        language=target.language,
        source_code=target.source_code,
        execution_status=target.execution_status,
        stdout=target.stdout,
        stderr=target.stderr,
        compile_output=target.compile_output,
        execution_time=target.execution_time,
        memory_used=target.memory_used,
        analysis_summary=target.analysis_summary,
        analysis_results=json.loads(target.analysis_results) if target.analysis_results else None,
        created_at=target.created_at.isoformat(),
        updated_at=target.updated_at.isoformat()
    )


@router.get(
    "/code",
    response_model=PaginatedCodeSessionsResponse,
    summary="List Authenticated User's Code Sessions"
)
async def list_code_sessions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    language: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns paginated code sessions owned exclusively by the current candidate."""
    query = db.query(CodeSessionModel).filter(CodeSessionModel.user_id == current_user.id)

    if language and language.strip():
        query = query.filter(CodeSessionModel.language == language.strip().lower())

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            (CodeSessionModel.title.ilike(term)) | (CodeSessionModel.source_code.ilike(term))
        )

    total = query.count()
    total_pages = ceil(total / limit) if total > 0 else 1

    records = query.order_by(desc(CodeSessionModel.updated_at))\
                   .offset((page - 1) * limit)\
                   .limit(limit)\
                   .all()

    items = [
        CodeSessionSummaryResponse(
            id=r.id,
            title=r.title,
            language=r.language,
            preview=r.source_code[:120].strip() + ("..." if len(r.source_code) > 120 else ""),
            execution_status=r.execution_status,
            has_analysis=bool(r.analysis_results or r.analysis_summary),
            created_at=r.created_at.isoformat(),
            updated_at=r.updated_at.isoformat()
        )
        for r in records
    ]

    return PaginatedCodeSessionsResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages
    )


@router.get(
    "/code/{session_id}",
    response_model=CodeSessionDetailResponse,
    summary="Get Code Session Details"
)
async def get_code_session(
    session_id: str,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns full details of a saved code session.
    Verifies that the session belongs to the authenticated candidate.
    """
    session = db.query(CodeSessionModel).filter(CodeSessionModel.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Code session '{session_id}' not found."
        )

    if session.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this code session."
        )

    return CodeSessionDetailResponse(
        id=session.id,
        title=session.title,
        language=session.language,
        source_code=session.source_code,
        execution_status=session.execution_status,
        stdout=session.stdout,
        stderr=session.stderr,
        compile_output=session.compile_output,
        execution_time=session.execution_time,
        memory_used=session.memory_used,
        analysis_summary=session.analysis_summary,
        analysis_results=json.loads(session.analysis_results) if session.analysis_results else None,
        created_at=session.created_at.isoformat(),
        updated_at=session.updated_at.isoformat()
    )


@router.delete(
    "/code/{session_id}",
    summary="Delete Code Session"
)
async def delete_code_session(
    session_id: str,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Deletes a saved code session owned by the candidate."""
    session = db.query(CodeSessionModel).filter(CodeSessionModel.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Code session '{session_id}' not found."
        )

    if session.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this code session."
        )

    db.delete(session)
    db.commit()
    return {"message": "Code session deleted successfully."}


# =========================================================================
# Interview History Endpoints
# =========================================================================

@router.get(
    "/interviews",
    response_model=PaginatedInterviewSessionsResponse,
    summary="List Candidate's Interview History"
)
async def list_interview_history(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    difficulty: Optional[str] = Query(None),
    topic: Optional[str] = Query(None),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns paginated interview sessions owned by the candidate."""
    query = db.query(InterviewSessionModel).filter(
        InterviewSessionModel.user_id == current_user.id
    )

    if difficulty and difficulty.strip():
        query = query.filter(InterviewSessionModel.difficulty == difficulty.strip().lower())

    if topic and topic.strip():
        query = query.filter(InterviewSessionModel.topic == topic.strip().lower())

    total = query.count()
    total_pages = ceil(total / limit) if total > 0 else 1

    records = query.order_by(desc(InterviewSessionModel.created_at))\
                   .offset((page - 1) * limit)\
                   .limit(limit)\
                   .all()

    items = [
        InterviewSessionSummaryResponse(
            id=r.id,
            language=r.language,
            topic=r.topic,
            difficulty=r.difficulty,
            status=r.status,
            num_questions=r.num_questions,
            questions_answered=len(r.answers),
            average_score=r.final_score,
            created_at=r.created_at.isoformat(),
            completed_at=r.completed_at.isoformat() if r.completed_at else None
        )
        for r in records
    ]

    return PaginatedInterviewSessionsResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages
    )


@router.get(
    "/interviews/{session_id}",
    summary="Get Interview Session Detail for Review"
)
async def get_interview_history_detail(
    session_id: str,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns full questions, answers, evaluations, and final scorecard for a completed session.
    Verifies candidate ownership.
    """
    session = db.query(InterviewSessionModel).filter(
        InterviewSessionModel.id == session_id
    ).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Interview session '{session_id}' not found."
        )

    if session.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this interview session."
        )

    return get_session_detail(db, session_id)


@router.delete(
    "/interviews/{session_id}",
    summary="Delete Interview Session"
)
async def delete_interview_session(
    session_id: str,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Deletes an interview session owned by the candidate."""
    session = db.query(InterviewSessionModel).filter(
        InterviewSessionModel.id == session_id
    ).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Interview session '{session_id}' not found."
        )

    if session.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this interview session."
        )

    db.delete(session)
    db.commit()
    return {"message": "Interview session deleted successfully."}
