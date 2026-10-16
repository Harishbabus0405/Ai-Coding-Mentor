from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator


class InterviewDifficulty(str, Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class InterviewTopic(str, Enum):
    CODE_UNDERSTANDING = "code_understanding"
    DEBUGGING = "debugging"
    DATA_STRUCTURES_ALGORITHMS = "data_structures_algorithms"
    COMPLEXITY = "complexity"
    OPTIMIZATION = "optimization"
    EDGE_CASES_TESTING = "edge_cases_testing"
    GENERAL_TECHNICAL = "general_technical"
    MIXED = "mixed"


# Canonical supported languages (same as Phase 3 & 4)
SUPPORTED_LANGUAGES = {"python", "javascript", "typescript", "c", "cpp", "java"}


class StartInterviewRequest(BaseModel):
    source_code: str = Field(
        ...,
        min_length=1,
        max_length=65536,
        description="Source code written or selected by the candidate"
    )
    language: str = Field(
        ...,
        description="Programming language (e.g. python, javascript, typescript, c, cpp, java)"
    )
    num_questions: int = Field(
        default=3,
        ge=1,
        le=10,
        description="Number of questions to generate for this interview (1 to 10)"
    )
    difficulty: InterviewDifficulty = Field(
        default=InterviewDifficulty.INTERMEDIATE,
        description="Candidate target difficulty level"
    )
    topic: str = Field(
        default="mixed",
        description="Target category (e.g. mixed, complexity, debugging, optimization)"
    )
    analysis_summary: Optional[str] = Field(
        default=None,
        max_length=5000,
        description="Optional summary from Phase 4 code analysis to tailor questions"
    )

    @field_validator("language")
    @classmethod
    def validate_language(cls, v: str) -> str:
        clean = v.strip().lower()
        if clean not in SUPPORTED_LANGUAGES:
            raise ValueError(
                f"Unsupported language '{clean}'. Supported languages: {', '.join(sorted(SUPPORTED_LANGUAGES))}"
            )
        return clean

    @field_validator("source_code")
    @classmethod
    def validate_source_code_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("source_code cannot be empty or pure whitespace")
        return v


class ClientInterviewQuestion(BaseModel):
    """Sanitized question presented to the student. Expected answers & rubrics are hidden."""
    id: str = Field(..., description="Stable question identifier")
    question_index: int = Field(..., description="0-indexed question sequence number")
    question_text: str = Field(..., description="Question prompt displayed to student")
    topic: str = Field(..., description="Category (e.g. complexity, data_structures_algorithms)")
    difficulty: str = Field(..., description="beginner, intermediate, or advanced")
    question_type: str = Field(..., description="conceptual, debugging, complexity, optimization, etc.")


class StartInterviewResponse(BaseModel):
    session_id: str
    total_questions: int
    difficulty: str
    topic: str
    questions: List[ClientInterviewQuestion]
    status: str = "in_progress"


class SubmitAnswerRequest(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=64)
    question_id: str = Field(..., min_length=1, max_length=64)
    answer: str = Field(
        ...,
        min_length=1,
        max_length=10000,
        description="The candidate's technical response"
    )
    is_retry: bool = Field(
        default=False,
        description="True if submitting a corrected retry answer"
    )

    @field_validator("answer")
    @classmethod
    def validate_answer(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("answer cannot be empty or pure whitespace")
        return v


class FollowUpQuestion(BaseModel):
    id: str = Field(..., description="Identifier for follow-up")
    type: str = Field(..., description="hint, clarification, or deeper_dive")
    text: str = Field(..., description="The follow-up prompt or guiding hint")


class EvaluationResult(BaseModel):
    question_id: str
    score: float = Field(..., ge=0.0, le=10.0, description="Score from 0.0 to 10.0")
    correct_concepts: List[str] = Field(default_factory=list)
    missing_concepts: List[str] = Field(default_factory=list)
    incorrect_statements: List[str] = Field(default_factory=list)
    feedback: str = Field(..., description="Clear feedback on candidate understanding")
    suggested_improvements: str = Field(..., description="Guidance to reach a complete answer")
    reference_answer: str = Field(..., description="Ideal model explanation or solution")
    is_sufficient: bool = Field(..., description="True if answer demonstrated sufficient mastery")
    follow_up: Optional[FollowUpQuestion] = None
    retry_count: int = 0
    advisory_notice: str = "AI-generated evaluation is advisory practice feedback, not a formal certification."


class TopicPerformance(BaseModel):
    topic: str
    questions_count: int
    average_score: float


class MistakeCorrection(BaseModel):
    question_text: str
    incorrect_point: str
    correction: str


class InterviewReportResponse(BaseModel):
    session_id: str
    status: str
    total_questions: int
    questions_answered: int
    average_score: float
    topic_performance: List[TopicPerformance]
    strengths: List[str]
    areas_for_revision: List[str]
    key_mistakes_and_corrections: List[Dict[str, Any]]
    suggested_practice_topics: List[str]
    created_at: str
    completed_at: Optional[str] = None


class QuestionWithAnswerState(BaseModel):
    """Detailed view for session resumption or review."""
    question: ClientInterviewQuestion
    has_answered: bool
    evaluation: Optional[EvaluationResult] = None


class InterviewSessionDetailResponse(BaseModel):
    session_id: str
    status: str
    difficulty: str
    topic: str
    current_question_index: int
    total_questions: int
    questions: List[QuestionWithAnswerState]
    average_score: Optional[float] = None


# --- Internal LLM Structured Output Models ---

class RawInterviewQuestion(BaseModel):
    question_text: str
    topic: str
    difficulty: str
    question_type: str
    expected_concepts: List[str]
    evaluation_criteria: str


class RawGeneratedQuestionsList(BaseModel):
    questions: List[RawInterviewQuestion]


class RawAnswerEvaluation(BaseModel):
    score: float
    correct_concepts: List[str]
    missing_concepts: List[str]
    incorrect_statements: List[str]
    feedback: str
    suggested_improvements: str
    reference_answer: str
    is_sufficient: bool
    has_follow_up: bool
    follow_up_type: Optional[str] = None
    follow_up_text: Optional[str] = None


class RawReportSynthesis(BaseModel):
    overall_feedback: str
    strengths: List[str]
    areas_for_revision: List[str]
    suggested_practice_topics: List[str]
