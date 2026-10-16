"""
Pydantic Models and Schemas for Code Sessions & Interview History.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class SaveCodeSessionRequest(BaseModel):
    session_id: Optional[str] = Field(default=None, description="Optional ID to update existing session")
    title: str = Field(default="Untitled Session", max_length=200)
    language: str = Field(..., max_length=32)
    source_code: str = Field(..., max_length=65536)
    execution_status: Optional[str] = None
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    compile_output: Optional[str] = None
    execution_time: Optional[float] = None
    memory_used: Optional[float] = None
    analysis_summary: Optional[str] = None
    analysis_results: Optional[Dict[str, Any]] = None


class CodeSessionSummaryResponse(BaseModel):
    id: str
    title: str
    language: str
    preview: str
    execution_status: Optional[str] = None
    has_analysis: bool = False
    created_at: str
    updated_at: str


class CodeSessionDetailResponse(BaseModel):
    id: str
    title: str
    language: str
    source_code: str
    execution_status: Optional[str] = None
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    compile_output: Optional[str] = None
    execution_time: Optional[float] = None
    memory_used: Optional[float] = None
    analysis_summary: Optional[str] = None
    analysis_results: Optional[Dict[str, Any]] = None
    created_at: str
    updated_at: str


class PaginatedCodeSessionsResponse(BaseModel):
    items: List[CodeSessionSummaryResponse]
    total: int
    page: int
    limit: int
    total_pages: int


class InterviewSessionSummaryResponse(BaseModel):
    id: str
    language: str
    topic: str
    difficulty: str
    status: str
    num_questions: int
    questions_answered: int
    average_score: Optional[float] = None
    created_at: str
    completed_at: Optional[str] = None


class PaginatedInterviewSessionsResponse(BaseModel):
    items: List[InterviewSessionSummaryResponse]
    total: int
    page: int
    limit: int
    total_pages: int
