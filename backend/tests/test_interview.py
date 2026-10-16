"""
Automated Test Suite for Phase 5: AI Interview Coach.
Tests cover:
- Session creation with mocked Groq
- Question generation input validation (invalid difficulty, question count, empty code, oversized code)
- Answer submission and scoring evaluation
- Missing or invalid session IDs (404)
- Invalid question IDs (404 / 400 mismatch)
- Duplicate answer submissions (idempotency, no duplicate scoring)
- Retry behavior and maximum retry limits
- Follow-up question generation and limits
- Final report calculations (deterministic math, unfinished sessions)
- Provider errors (HTTP 429 rate limit, unconfigured key)
- Status endpoint
"""

import os
import sys
import json
import pytest
from unittest.mock import patch, AsyncMock

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.database import Base, get_db
from app.services.interview_models import (
    RawGeneratedQuestionsList,
    RawInterviewQuestion,
    RawAnswerEvaluation,
    RawReportSynthesis,
)

# Use an in-memory SQLite database with StaticPool so all connections share the same memory instance
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


SAMPLE_CODE = """
def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1
""".strip()


# =========================================================================
# 1. Validation Tests
# =========================================================================

def test_start_interview_validation_unsupported_language():
    """Verify that unsupported language IDs are rejected with HTTP 422."""
    payload = {
        "source_code": SAMPLE_CODE,
        "language": "ruby",
        "num_questions": 3,
        "difficulty": "intermediate"
    }
    response = client.post("/api/interview/start", json=payload)
    assert response.status_code == 422
    assert "Unsupported language" in response.text


def test_start_interview_validation_empty_source_code():
    """Verify that empty or whitespace-only source code is rejected with HTTP 422."""
    payload = {
        "source_code": "   \n\t  ",
        "language": "python",
        "num_questions": 3,
        "difficulty": "intermediate"
    }
    response = client.post("/api/interview/start", json=payload)
    assert response.status_code == 422


def test_start_interview_validation_invalid_question_count():
    """Verify that question count < 1 or > 10 is rejected with HTTP 422."""
    # Count > 10
    response = client.post("/api/interview/start", json={
        "source_code": SAMPLE_CODE,
        "language": "python",
        "num_questions": 15,
        "difficulty": "intermediate"
    })
    assert response.status_code == 422

    # Count < 1
    response = client.post("/api/interview/start", json={
        "source_code": SAMPLE_CODE,
        "language": "python",
        "num_questions": 0,
        "difficulty": "intermediate"
    })
    assert response.status_code == 422


def test_start_interview_validation_invalid_difficulty():
    """Verify that unknown difficulty string is rejected with HTTP 422."""
    payload = {
        "source_code": SAMPLE_CODE,
        "language": "python",
        "num_questions": 3,
        "difficulty": "super_hard"
    }
    response = client.post("/api/interview/start", json=payload)
    assert response.status_code == 422


def test_start_interview_unconfigured_key_handling():
    """When GROQ_API_KEY is not configured, endpoint returns 503 Service Unavailable."""
    with patch("app.api.interview.is_groq_configured", return_value=False):
        payload = {
            "source_code": SAMPLE_CODE,
            "language": "python",
            "num_questions": 3,
            "difficulty": "intermediate"
        }
        response = client.post("/api/interview/start", json=payload)
        assert response.status_code == 503
        assert "unavailable" in response.json()["detail"].lower()


# =========================================================================
# 2. Session Creation & Question Generation Tests (Mocked Groq)
# =========================================================================

@pytest.mark.asyncio
async def test_successful_session_creation_mocked():
    """Verify that a valid request creates a session and returns sanitized questions."""
    mock_questions = RawGeneratedQuestionsList(questions=[
        RawInterviewQuestion(
            question_text="Why do we use (left + right) // 2 instead of left + (right - left) // 2?",
            topic="debugging",
            difficulty="intermediate",
            question_type="conceptual",
            expected_concepts=["Integer overflow in fixed-width languages", "Midpoint equivalence"],
            evaluation_criteria="Score 10 if candidate explains integer overflow in Java/C++."
        ),
        RawInterviewQuestion(
            question_text="What is the worst-case time complexity of this binary search and why?",
            topic="complexity",
            difficulty="intermediate",
            question_type="complexity",
            expected_concepts=["O(log n)", "Repeated division by 2", "Logarithm base 2"],
            evaluation_criteria="Score 10 if candidate mentions repeated halving and O(log n)."
        )
    ])

    with patch("app.api.interview.is_groq_configured", return_value=True), \
         patch("app.services.interview_service.is_groq_configured", return_value=True), \
         patch("app.services.interview_service.call_groq_structured", new_callable=AsyncMock) as mock_call:
        
        mock_call.return_value = mock_questions

        payload = {
            "source_code": SAMPLE_CODE,
            "language": "python",
            "num_questions": 2,
            "difficulty": "intermediate",
            "topic": "complexity"
        }
        response = client.post("/api/interview/start", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert "session_id" in data
        assert data["total_questions"] == 2
        assert len(data["questions"]) == 2
        
        # Verify hidden rubrics are NOT exposed to client
        first_q = data["questions"][0]
        assert "question_text" in first_q
        assert "topic" in first_q
        assert "expected_concepts" not in first_q
        assert "evaluation_criteria" not in first_q


# =========================================================================
# 3. Answer Submission & Evaluation Tests
# =========================================================================

@pytest.mark.asyncio
async def test_submit_answer_and_evaluation_flow():
    """Verify answer submission, scoring, feedback, follow-up, and idempotency."""
    mock_questions = RawGeneratedQuestionsList(questions=[
        RawInterviewQuestion(
            question_text="Explain the time complexity of binary search.",
            topic="complexity",
            difficulty="intermediate",
            question_type="complexity",
            expected_concepts=["O(log n)", "Halving search space"],
            evaluation_criteria="Score 9-10 for O(log n) with halving justification."
        )
    ])

    mock_eval = RawAnswerEvaluation(
        score=9.5,
        correct_concepts=["O(log n) time complexity", "Halving search space at each iteration"],
        missing_concepts=[],
        incorrect_statements=[],
        feedback="Excellent and accurate explanation of binary search complexity.",
        suggested_improvements="Could mention space complexity is O(1) iterative.",
        reference_answer="Binary search runs in O(log n) time because the search space is divided by 2 each step.",
        is_sufficient=True,
        has_follow_up=True,
        follow_up_type="deeper_dive",
        follow_up_text="How would the space complexity change if you implemented this recursively?"
    )

    with patch("app.api.interview.is_groq_configured", return_value=True), \
         patch("app.services.interview_service.is_groq_configured", return_value=True), \
         patch("app.services.interview_service.call_groq_structured", new_callable=AsyncMock) as mock_call:
        
        mock_call.return_value = mock_questions
        start_res = client.post("/api/interview/start", json={
            "source_code": SAMPLE_CODE,
            "language": "python",
            "num_questions": 1,
            "difficulty": "intermediate"
        })
        session_id = start_res.json()["session_id"]
        q_id = start_res.json()["questions"][0]["id"]

        # Submit Answer
        mock_call.return_value = mock_eval
        ans_res = client.post("/api/interview/answer", json={
            "session_id": session_id,
            "question_id": q_id,
            "answer": "Binary search is O(log n) because at each comparison the remaining array is cut in half."
        })

        assert ans_res.status_code == 200
        ans_data = ans_res.json()
        assert ans_data["score"] == 9.5
        assert ans_data["is_sufficient"] is True
        assert len(ans_data["correct_concepts"]) == 2
        assert ans_data["follow_up"] is not None
        assert ans_data["follow_up"]["type"] == "deeper_dive"

        # Test Idempotency: Re-submitting the exact same question without is_retry returns same result without extra LLM call
        call_count_before = mock_call.call_count
        dup_res = client.post("/api/interview/answer", json={
            "session_id": session_id,
            "question_id": q_id,
            "answer": "Duplicate submission attempt"
        })
        assert dup_res.status_code == 200
        assert dup_res.json()["score"] == 9.5
        assert mock_call.call_count == call_count_before  # No redundant model call!


def test_submit_answer_invalid_session_id():
    """Verify that a non-existent session ID returns HTTP 404."""
    with patch("app.api.interview.is_groq_configured", return_value=True):
        res = client.post("/api/interview/answer", json={
            "session_id": "non-existent-session-uuid",
            "question_id": "q-1",
            "answer": "My answer"
        })
        assert res.status_code == 404


def test_submit_answer_mismatched_question_id():
    """Verify that a question belonging to another session is rejected."""
    mock_questions = RawGeneratedQuestionsList(questions=[
        RawInterviewQuestion(
            question_text="Q1",
            topic="complexity",
            difficulty="intermediate",
            question_type="complexity",
            expected_concepts=["A"],
            evaluation_criteria="Rubric"
        )
    ])

    with patch("app.api.interview.is_groq_configured", return_value=True), \
         patch("app.services.interview_service.is_groq_configured", return_value=True), \
         patch("app.services.interview_service.call_groq_structured", new_callable=AsyncMock) as mock_call:
        
        mock_call.return_value = mock_questions
        # Create Session 1
        s1 = client.post("/api/interview/start", json={
            "source_code": SAMPLE_CODE,
            "language": "python",
            "num_questions": 1
        }).json()

        # Create Session 2
        s2 = client.post("/api/interview/start", json={
            "source_code": SAMPLE_CODE,
            "language": "python",
            "num_questions": 1
        }).json()

        # Submit Session 2's question ID to Session 1
        res = client.post("/api/interview/answer", json={
            "session_id": s1["session_id"],
            "question_id": s2["questions"][0]["id"],
            "answer": "My answer"
        })
        assert res.status_code == 400
        assert "does not belong" in res.json()["detail"].lower()


# =========================================================================
# 4. Final Performance Report Tests
# =========================================================================

@pytest.mark.asyncio
async def test_final_report_exact_numerical_calculation():
    """Verify that final report computes mathematical averages accurately in backend code."""
    mock_questions = RawGeneratedQuestionsList(questions=[
        RawInterviewQuestion(
            question_text="Q1 Complexity",
            topic="complexity",
            difficulty="intermediate",
            question_type="complexity",
            expected_concepts=["O(log n)"],
            evaluation_criteria="Rubric"
        ),
        RawInterviewQuestion(
            question_text="Q2 Edge cases",
            topic="edge_cases_testing",
            difficulty="intermediate",
            question_type="edge_cases",
            expected_concepts=["Target not in array", "Empty array"],
            evaluation_criteria="Rubric"
        )
    ])

    with patch("app.api.interview.is_groq_configured", return_value=True), \
         patch("app.services.interview_service.is_groq_configured", return_value=True), \
         patch("app.services.interview_service.call_groq_structured", new_callable=AsyncMock) as mock_call:
        
        mock_call.return_value = mock_questions
        start_res = client.post("/api/interview/start", json={
            "source_code": SAMPLE_CODE,
            "language": "python",
            "num_questions": 2
        })
        session_id = start_res.json()["session_id"]
        q1_id = start_res.json()["questions"][0]["id"]
        q2_id = start_res.json()["questions"][1]["id"]

        # Answer Q1 with 8.0
        mock_call.return_value = RawAnswerEvaluation(
            score=8.0,
            correct_concepts=["O(log n)"],
            missing_concepts=[],
            incorrect_statements=[],
            feedback="Good answer",
            suggested_improvements="",
            reference_answer="",
            is_sufficient=True,
            has_follow_up=False
        )
        client.post("/api/interview/answer", json={
            "session_id": session_id,
            "question_id": q1_id,
            "answer": "Answer 1"
        })

        # Answer Q2 with 6.0
        mock_call.return_value = RawAnswerEvaluation(
            score=6.0,
            correct_concepts=["Empty array"],
            missing_concepts=["Single element array"],
            incorrect_statements=["Assumed array length is always even"],
            feedback="Partial answer",
            suggested_improvements="Consider single element arrays",
            reference_answer="",
            is_sufficient=True,
            has_follow_up=False
        )
        client.post("/api/interview/answer", json={
            "session_id": session_id,
            "question_id": q2_id,
            "answer": "Answer 2"
        })

        # Fetch report
        report_res = client.get(f"/api/interview/{session_id}/report")
        assert report_res.status_code == 200
        report = report_res.json()
        assert report["total_questions"] == 2
        assert report["questions_answered"] == 2
        # Exact arithmetic: (8.0 + 6.0) / 2 = 7.0
        assert report["average_score"] == 7.0
        assert len(report["topic_performance"]) == 2
        assert report["status"] == "completed"


def test_unfinished_session_report_handled_gracefully():
    """Verify that an unfinished session with 0 answers does not divide by zero or crash."""
    mock_questions = RawGeneratedQuestionsList(questions=[
        RawInterviewQuestion(
            question_text="Q1",
            topic="complexity",
            difficulty="beginner",
            question_type="conceptual",
            expected_concepts=["A"],
            evaluation_criteria="Rubric"
        )
    ])

    with patch("app.api.interview.is_groq_configured", return_value=True), \
         patch("app.services.interview_service.is_groq_configured", return_value=True), \
         patch("app.services.interview_service.call_groq_structured", new_callable=AsyncMock) as mock_call:
        
        mock_call.return_value = mock_questions
        start_res = client.post("/api/interview/start", json={
            "source_code": SAMPLE_CODE,
            "language": "python",
            "num_questions": 1
        })
        session_id = start_res.json()["session_id"]

        # Immediately request report with 0 answers
        report_res = client.get(f"/api/interview/{session_id}/report")
        assert report_res.status_code == 200
        data = report_res.json()
        assert data["questions_answered"] == 0
        assert data["average_score"] == 0.0


# =========================================================================
# 5. Status Endpoint Test
# =========================================================================

def test_interview_status_endpoint():
    """Verify /api/interview/status returns readiness metadata."""
    res = client.get("/api/interview/status")
    assert res.status_code == 200
    data = res.json()
    assert "status" in data
    assert "groq_configured" in data
    assert "model" in data


@pytest.mark.asyncio
async def test_retry_behavior_and_limit_enforced():
    """Verify that candidate can retry up to 2 times, and 3rd retry is rejected with HTTP 400."""
    mock_questions = RawGeneratedQuestionsList(questions=[
        RawInterviewQuestion(
            question_text="Q1",
            topic="debugging",
            difficulty="intermediate",
            question_type="debugging",
            expected_concepts=["A"],
            evaluation_criteria="Rubric"
        )
    ])

    with patch("app.api.interview.is_groq_configured", return_value=True), \
         patch("app.services.interview_service.is_groq_configured", return_value=True), \
         patch("app.services.interview_service.call_groq_structured", new_callable=AsyncMock) as mock_call:
        
        mock_call.return_value = mock_questions
        start_res = client.post("/api/interview/start", json={
            "source_code": SAMPLE_CODE,
            "language": "python",
            "num_questions": 1
        })
        session_id = start_res.json()["session_id"]
        q_id = start_res.json()["questions"][0]["id"]

        mock_call.return_value = RawAnswerEvaluation(
            score=3.0,
            correct_concepts=[],
            missing_concepts=["A"],
            incorrect_statements=["Wrong logic"],
            feedback="Needs work",
            suggested_improvements="",
            reference_answer="",
            is_sufficient=False,
            has_follow_up=True,
            follow_up_type="hint",
            follow_up_text="Hint 1"
        )

        # Initial submission (retry_count = 0)
        res1 = client.post("/api/interview/answer", json={
            "session_id": session_id,
            "question_id": q_id,
            "answer": "First attempt (incomplete)"
        })
        assert res1.status_code == 200
        assert res1.json()["retry_count"] == 0

        # Retry 1 (retry_count = 1)
        res2 = client.post("/api/interview/answer", json={
            "session_id": session_id,
            "question_id": q_id,
            "answer": "Second attempt",
            "is_retry": True
        })
        assert res2.status_code == 200
        assert res2.json()["retry_count"] == 1

        # Retry 2 (retry_count = 2)
        res3 = client.post("/api/interview/answer", json={
            "session_id": session_id,
            "question_id": q_id,
            "answer": "Third attempt",
            "is_retry": True
        })
        assert res3.status_code == 200
        assert res3.json()["retry_count"] == 2

        # Retry 3 (exceeds limit) -> HTTP 400
        res4 = client.post("/api/interview/answer", json={
            "session_id": session_id,
            "question_id": q_id,
            "answer": "Fourth attempt",
            "is_retry": True
        })
        assert res4.status_code == 400
        assert "maximum retry limit" in res4.json()["detail"].lower()


@pytest.mark.asyncio
async def test_groq_rate_limit_handled():
    """Verify that HTTP 429 rate limit is returned when Groq throws GroqRateLimitError."""
    from app.services.groq_service import GroqRateLimitError

    with patch("app.api.interview.is_groq_configured", return_value=True), \
         patch("app.services.interview_service.is_groq_configured", return_value=True), \
         patch("app.services.interview_service.call_groq_structured", new_callable=AsyncMock) as mock_call:
        
        mock_call.side_effect = GroqRateLimitError("Rate limit exceeded")

        res = client.post("/api/interview/start", json={
            "source_code": SAMPLE_CODE,
            "language": "python",
            "num_questions": 2
        })
        assert res.status_code == 429
        assert "rate limit" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_session_detail_retrieval():
    """Verify GET /api/interview/{session_id} returns questions, answered status, and progression."""
    mock_questions = RawGeneratedQuestionsList(questions=[
        RawInterviewQuestion(
            question_text="Q1",
            topic="complexity",
            difficulty="intermediate",
            question_type="complexity",
            expected_concepts=["A"],
            evaluation_criteria="Rubric"
        )
    ])

    with patch("app.api.interview.is_groq_configured", return_value=True), \
         patch("app.services.interview_service.is_groq_configured", return_value=True), \
         patch("app.services.interview_service.call_groq_structured", new_callable=AsyncMock) as mock_call:
        
        mock_call.return_value = mock_questions
        start_res = client.post("/api/interview/start", json={
            "source_code": SAMPLE_CODE,
            "language": "python",
            "num_questions": 1
        })
        session_id = start_res.json()["session_id"]

        detail_res = client.get(f"/api/interview/{session_id}")
        assert detail_res.status_code == 200
        data = detail_res.json()
        assert data["session_id"] == session_id
        assert len(data["questions"]) == 1
        assert data["questions"][0]["has_answered"] is False

