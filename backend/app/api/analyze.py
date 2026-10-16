"""
FastAPI router for Phase 4 Multi-Agent AI Analysis.
Exposes POST /api/analyze and GET /api/analyze/status.
"""

from fastapi import APIRouter
from app.core.config import settings
from app.services.analysis_models import AnalyzeRequest, AnalyzeResponse
from app.services.analysis_workflow import run_analysis_workflow
from app.services.groq_service import is_groq_configured

router = APIRouter(tags=["AI Code Analysis"])


@router.post(
    "/analyze",
    response_model=AnalyzeResponse,
    summary="Multi-Agent AI Code Analysis",
    description=(
        "Executes a LangGraph workflow coordinating 5 specialized AI agents: "
        "Code Review, Test Analysis, Optimization, Complexity Analysis, and Mentor Summary. "
        "Evaluates bugs, explains test failures, proposes optimized solutions, and calculates Big-O complexity."
    )
)
async def analyze_code(request: AnalyzeRequest) -> AnalyzeResponse:
    """
    Analyzes untrusted code and Phase 3 execution results via LangGraph + Groq API.
    Never executes source code inside this endpoint.
    """
    return await run_analysis_workflow(request)


@router.get(
    "/analyze/status",
    summary="AI Analysis Provider Status",
    description="Returns whether Groq AI analysis provider is configured and available."
)
async def get_analysis_status():
    """Returns Groq provider configuration readiness and active model."""
    configured = is_groq_configured()
    return {
        "provider": "Groq API",
        "configured": configured,
        "model": settings.GROQ_MODEL,
        "workflow": "LangGraph Multi-Agent (5 Agents)",
        "agents": [
            {"id": "code_review", "name": "Code Review Agent", "focus": "Logical bugs, edge cases, root causes"},
            {"id": "test_analysis", "name": "Test Analysis Agent", "focus": "Failure explanation, untested boundary cases"},
            {"id": "optimization", "name": "Optimization Agent", "focus": "Algorithmic refactoring, trade-offs"},
            {"id": "complexity_analysis", "name": "Complexity Analysis Agent", "focus": "Theoretical Big-O time and space"},
            {"id": "mentor_summary", "name": "Mentor Summary Agent", "focus": "Pedagogical synthesis, key concepts, next steps"}
        ],
        "message": (
            "Groq AI analysis is operational."
            if configured
            else "GROQ_API_KEY is not configured in backend/.env. AI analysis will report provider unavailable."
        )
    }
