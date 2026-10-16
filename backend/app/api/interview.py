"""
FastAPI Route Handlers for Phase 5: AI Interview Coach.
Endpoints:
- POST /api/interview/start
- POST /api/interview/answer
- GET /api/interview/{session_id}/report
- GET /api/interview/{session_id}
- GET /api/interview/status
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import UserModel
from app.api.deps import get_optional_current_user
from app.services.groq_service import (
    is_groq_configured,
    GroqAuthError,
    GroqRateLimitError,
    GroqServiceError,
)
from app.services.interview_models import (
    StartInterviewRequest,
    StartInterviewResponse,
    SubmitAnswerRequest,
    EvaluationResult,
    InterviewReportResponse,
    InterviewSessionDetailResponse,
)
from app.services.interview_service import (
    create_interview_session,
    evaluate_interview_answer,
    get_session_report,
    get_session_detail,
)
from app.core.config import settings

logger = logging.getLogger("ai_coding_mentor.api.interview")

router = APIRouter(prefix="/interview", tags=["Interview Coach"])


@router.get("/status", summary="Check Interview Coach Availability")
async def get_interview_status():
    """Returns configuration status for Groq AI inference and persistence."""
    return {
        "status": "Ready" if is_groq_configured() else "Unavailable",
        "groq_configured": is_groq_configured(),
        "model": settings.GROQ_MODEL,
        "message": (
            "Interview Coach is ready."
            if is_groq_configured()
            else "GROQ_API_KEY is not configured in backend/.env. AI question generation and evaluation are unavailable."
        )
    }


@router.post(
    "/start",
    response_model=StartInterviewResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Start New Interview Session"
)
async def start_interview(
    request: StartInterviewRequest,
    current_user: Optional[UserModel] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Initializes an interactive interview session tailored to the candidate's code.
    Generates structured questions with hidden evaluation rubrics.
    """
    if not is_groq_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "AI Interview Coach is unavailable: GROQ_API_KEY is not configured in backend/.env. "
                "Please configure an API key from https://console.groq.com."
            )
        )

    try:
        user_id = current_user.id if current_user else None
        response = await create_interview_session(db, request, user_id=user_id)
        return response
    except GroqRateLimitError as e:
        logger.warning(f"Groq rate limit during interview question generation: {e}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Groq API rate limit reached. Please wait a moment and try again."
        )
    except GroqAuthError as e:
        logger.error(f"Groq auth error during interview creation: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e)
        )
    except GroqServiceError as e:
        logger.error(f"Groq service error during interview creation: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI model provider error: {str(e)}"
        )
    except Exception as e:
        logger.exception("Unexpected error creating interview session")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initialize interview session: {str(e)}"
        )


@router.post(
    "/answer",
    response_model=EvaluationResult,
    summary="Submit Interview Answer for Evaluation"
)
async def submit_answer(
    request: SubmitAnswerRequest,
    db: Session = Depends(get_db)
):
    """
    Submits an answer to an interview question.
    Evaluates understanding against hidden rubric, returns score (0-10),
    correct concepts, missing concepts, feedback, and adaptive follow-up.
    """
    try:
        result = await evaluate_interview_answer(db, request)
        return result
    except ValueError as e:
        err_msg = str(e)
        if "not found" in err_msg.lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=err_msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)
    except GroqRateLimitError as e:
        logger.warning(f"Groq rate limit during answer evaluation: {e}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Groq API rate limit reached. Please wait a moment before submitting your answer."
        )
    except GroqAuthError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    except GroqServiceError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))
    except Exception as e:
        logger.exception("Unexpected error evaluating interview answer")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to evaluate answer: {str(e)}"
        )


@router.get(
    "/{session_id}/report",
    response_model=InterviewReportResponse,
    summary="Get Final Interview Performance Report"
)
async def get_interview_report(
    session_id: str,
    db: Session = Depends(get_db)
):
    """
    Returns the comprehensive interview performance report with
    deterministic score metrics, strengths, revision areas, and practice topics.
    """
    try:
        report = await get_session_report(db, session_id)
        return report
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.exception(f"Unexpected error retrieving report for session '{session_id}'")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate report: {str(e)}"
        )


@router.get(
    "/{session_id}",
    response_model=InterviewSessionDetailResponse,
    summary="Get Interview Session State"
)
async def get_interview_session(
    session_id: str,
    db: Session = Depends(get_db)
):
    """
    Retrieves the current state of an interview session, including
    questions, answered status, and prior evaluations for resumption.
    """
    try:
        detail = get_session_detail(db, session_id)
        return detail
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.exception(f"Unexpected error retrieving session '{session_id}'")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve session: {str(e)}"
        )
