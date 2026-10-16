"""
Phase 7 End-to-End Functional Test Suite: Complete 18-Step Candidate Journey.

Simulates the complete user journey through all platform capabilities:
1. Register a user (Argon2id hashing, email normalization, password strength).
2. Log in securely (Issues signed JWT in HttpOnly cookie).
3. Verify profile (/api/auth/me).
4. Select programming language & verify supported runtimes (/api/execute/languages).
5. Write and execute code through sandbox provider (/api/execute).
6. Supply standard input and capture standard output.
7. Run multiple test cases and evaluate expected vs actual (/api/execute/batch).
8. Inspect compilation and runtime errors.
9. Request multi-agent AI code analysis (/api/analyze).
10. Review detected bugs and explanations.
11. Review proposed optimized solution.
12. Review Big-O time and space complexity analysis.
13. Start technical mock interview based on submitted code (/api/interview/start).
14. Submit interview answer and receive adaptive feedback (/api/interview/answer).
15. Complete interview and verify deterministic score report (/api/interview/{id}/report).
16. Save code session to MySQL and reopen it (/api/history/code).
17. Reopen completed interview scorecard (/api/history/interviews/{id}).
18. Log out and verify protected access is denied (HTTP 401).
"""

import os
import sys
import uuid
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
from app.db.models import UserModel, CodeSessionModel, InterviewSessionModel
from app.services.interview_models import (
    RawGeneratedQuestionsList,
    RawInterviewQuestion,
    RawAnswerEvaluation,
    RawReportSynthesis,
)

# In-memory SQLite with StaticPool for test isolation
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


@pytest.fixture(autouse=True)
def setup_e2e():
    """Ensure database is clean, dependency override is active, and cookies reset."""
    app.dependency_overrides[get_db] = override_get_db
    client.cookies.clear()
    db = TestingSessionLocal()
    db.query(CodeSessionModel).delete()
    db.query(InterviewSessionModel).delete()
    db.query(UserModel).delete()
    db.commit()
    db.close()
    yield
    client.cookies.clear()


@pytest.mark.asyncio
async def test_complete_18_step_user_journey():
    """Executes the full 18-step user journey end-to-end without regressions."""
    
    # -------------------------------------------------------------------------
    # STEP 1: Register User
    # -------------------------------------------------------------------------
    user_email = f"candidate_{uuid.uuid4().hex[:6]}@example.com"
    user_password = "ComplexPassword2026!"
    user_name = "Alex Senior Engineer"

    reg_resp = client.post("/api/auth/register", json={
        "email": user_email,
        "password": user_password,
        "display_name": user_name
    })
    assert reg_resp.status_code == 201, f"Step 1 failed: {reg_resp.text}"
    reg_data = reg_resp.json()
    assert "access_token" in reg_data
    assert reg_data["user"]["email"] == user_email.lower()
    assert reg_data["user"]["display_name"] == user_name
    user_id = reg_data["user"]["id"]

    # -------------------------------------------------------------------------
    # STEP 2: Log in Securely
    # -------------------------------------------------------------------------
    client.cookies.clear()  # Clear registration cookie to test explicit login
    login_resp = client.post("/api/auth/login", json={
        "email": user_email,
        "password": user_password
    })
    assert login_resp.status_code == 200, f"Step 2 failed: {login_resp.text}"
    login_data = login_resp.json()
    assert "access_token" in login_data
    assert "access_token" in client.cookies

    # -------------------------------------------------------------------------
    # STEP 3: Verify Profile via Cookie
    # -------------------------------------------------------------------------
    me_resp = client.get("/api/auth/me")
    assert me_resp.status_code == 200, f"Step 3 failed: {me_resp.text}"
    assert me_resp.json()["id"] == user_id
    assert me_resp.json()["email"] == user_email.lower()

    # -------------------------------------------------------------------------
    # STEP 4: Select Programming Language & Verify Supported Runtimes
    # -------------------------------------------------------------------------
    lang_resp = client.get("/api/execute/languages")
    assert lang_resp.status_code == 200, f"Step 4 failed: {lang_resp.text}"
    available_langs = lang_resp.json()["languages"]
    assert any(l["id"] == "python" for l in available_langs)
    assert any(l["id"] == "javascript" for l in available_langs)
    assert any(l["id"] == "cpp" for l in available_langs)

    # -------------------------------------------------------------------------
    # STEP 5 & 6: Write, Supply Stdin, and Execute Code via Sandbox Provider
    # -------------------------------------------------------------------------
    source_code = (
        "import sys\n"
        "lines = sys.stdin.read().split()\n"
        "if lines:\n"
        "    target = int(lines[0])\n"
        "    nums = [int(x) for x in lines[1:]]\n"
        "    seen = {}\n"
        "    for i, n in enumerate(nums):\n"
        "        diff = target - n\n"
        "        if diff in seen:\n"
        "            print(f'{seen[diff]} {i}')\n"
        "            break\n"
        "        seen[n] = i\n"
    )
    stdin_input = "9 2 7 11 15"

    from app.services.execution_service import ExecuteResponse, BatchExecuteResponse, TestCaseResult

    with patch("app.api.execute.execute_code", new=AsyncMock()) as mock_exec:
        mock_exec.return_value = ExecuteResponse(
            stdout="0 1\n",
            stderr="",
            compile_output=None,
            status="Accepted",
            execution_time=0.042,
            memory_used=12400
        )

        exec_resp = client.post("/api/execute", json={
            "language": "python",
            "source_code": source_code,
            "stdin": stdin_input
        })
        assert exec_resp.status_code == 200, f"Step 5/6 failed: {exec_resp.text}"
        exec_data = exec_resp.json()
        assert exec_data["status"] == "Accepted"
        assert exec_data["stdout"] == "0 1\n"
        assert exec_data["execution_time"] == 0.042

    # -------------------------------------------------------------------------
    # STEP 7: Run Multiple Test Cases
    # -------------------------------------------------------------------------
    test_cases = [
        {"id": "tc-1", "name": "Basic Case", "stdin": "9 2 7 11 15", "expected_output": "0 1"},
        {"id": "tc-2", "name": "Consecutive Elements", "stdin": "6 3 2 4", "expected_output": "1 2"},
    ]

    mock_batch_resp = BatchExecuteResponse(
        results=[
            TestCaseResult(
                id="tc-1",
                name="Basic Case",
                status="passed",
                passed=True,
                actual_output="0 1",
                expected_output="0 1",
                execution_time=0.040,
                memory_used=12000
            ),
            TestCaseResult(
                id="tc-2",
                name="Consecutive Elements",
                status="passed",
                passed=True,
                actual_output="1 2",
                expected_output="1 2",
                execution_time=0.038,
                memory_used=12100
            ),
        ],
        summary={
            "total": 2,
            "passed": 2,
            "failed": 0,
            "all_passed": True,
            "success_rate": 100.0
        }
    )

    with patch("app.api.execute.evaluate_test_cases", new=AsyncMock(return_value=mock_batch_resp)):
        batch_resp = client.post("/api/execute/testcases", json={
            "language": "python",
            "source_code": source_code,
            "test_cases": test_cases
        })
        assert batch_resp.status_code == 200, f"Step 7 failed: {batch_resp.text}"
        batch_data = batch_resp.json()
        assert batch_data["summary"]["total"] == 2
        assert batch_data["summary"]["passed"] == 2
        assert batch_data["summary"]["all_passed"] is True

    # -------------------------------------------------------------------------
    # STEP 8: Inspect Errors (Compilation / Runtime Errors)
    # -------------------------------------------------------------------------
    with patch("app.api.execute.execute_code", new=AsyncMock()) as mock_exec:
        mock_exec.return_value = ExecuteResponse(
            stdout="",
            stderr="ZeroDivisionError: division by zero",
            compile_output=None,
            status="Runtime Error (NZEC)",
            execution_time=0.030,
            memory_used=11500
        )

        error_resp = client.post("/api/execute", json={
            "language": "python",
            "source_code": "x = 1 / 0",
            "stdin": ""
        })
        assert error_resp.status_code == 200
        assert "ZeroDivisionError" in error_resp.json()["stderr"]
        assert "Runtime Error" in error_resp.json()["status"]

    # -------------------------------------------------------------------------
    # STEP 9, 10, 11, 12: Multi-Agent AI Analysis (Bugs, Optimization, Complexity)
    # -------------------------------------------------------------------------
    from app.services.analysis_models import (
        AnalyzeResponse,
        CodeReviewResult,
        BugFinding,
        TestAnalysisResult,
        SuggestedTestCase,
        OptimizedSolutionResult,
        ComplexityAnalysisResult,
        LearningExplanationResult
    )

    mock_analysis_resp = AnalyzeResponse(
        status="Completed",
        overall_summary="Optimal hash map two-pass solution with O(n) runtime and robust edge handling.",
        code_review=CodeReviewResult(
            status="Passed",
            summary="Clean implementation of the classic hash map two sum pattern.",
            strengths=["Optimal linear scan", "Clean dictionary lookup"],
            potential_issues=[]
        ),
        bugs=[
            BugFinding(
                severity="low",
                line_number=9,
                title="Duplicate Values Boundary",
                description="If duplicate values exist that sum to target, ensure indices are distinct.",
                root_cause="Hash map naturally overwrites previous index unless checked.",
                suggestion="Hash map naturally overwrites previous index unless checked."
            )
        ],
        test_analysis=TestAnalysisResult(
            summary="All test cases passed with expected outputs.",
            failed_test_explanations=[],
            untested_boundary_conditions=["Negative integer targets", "Empty input list"],
            suggested_tests=[
                SuggestedTestCase(
                    name="Negative Inputs",
                    stdin="0 -3 3",
                    expected_output="0 1",
                    reason="Test with target = 0 and negative inputs"
                )
            ]
        ),
        optimized_solution=OptimizedSolutionResult(
            is_optimization_needed=False,
            optimized_code=source_code,
            explanation="The code already runs in optimal O(n) time with a single pass hash map.",
            tradeoffs=["O(n) auxiliary space required for the hash table."],
            language="python"
        ),
        complexity_analysis=ComplexityAnalysisResult(
            original_time_complexity="O(n)",
            original_space_complexity="O(n)",
            optimized_time_complexity="O(n)",
            optimized_space_complexity="O(n)",
            time_justification="Single pass through nums with O(1) hash map lookups.",
            space_justification="Hash map stores at most n elements.",
            assumptions=["Python dict average lookup time is O(1)."]
        ),
        learning_explanation=LearningExplanationResult(
            summary="Hash tables trade O(n) space for O(1) lookup speed, reducing naive O(n^2) brute force to linear O(n).",
            key_concepts=["Hash Table Lookups", "Complement Search"],
            mentor_tips=["Always clarify whether the input array is sorted before choosing between Hash Map and Two Pointers."],
            next_steps=["Practice Two Sum II (Input array is sorted)", "Explore Three Sum with two-pointer technique"]
        ),
        warnings=[]
    )

    with patch("app.api.analyze.run_analysis_workflow", new=AsyncMock(return_value=mock_analysis_resp)):
        analysis_resp = client.post("/api/analyze", json={
            "language": "python",
            "source_code": source_code,
            "stdin": stdin_input
        })
        assert analysis_resp.status_code == 200, f"Step 9-12 failed: {analysis_resp.text}"
        analysis_data = analysis_resp.json()
        assert analysis_data["status"] == "Completed"
        # Step 10: Review potential bugs
        assert len(analysis_data["bugs"]) == 1
        assert analysis_data["bugs"][0]["title"] == "Duplicate Values Boundary"
        # Step 11: Review proposed optimized solution
        assert analysis_data["optimized_solution"]["is_optimization_needed"] is False
        # Step 12: Review time and space complexity
        assert analysis_data["complexity_analysis"]["original_time_complexity"] == "O(n)"
        assert analysis_data["complexity_analysis"]["original_space_complexity"] == "O(n)"

    # -------------------------------------------------------------------------
    # STEP 13: Start Technical Mock Interview
    # -------------------------------------------------------------------------
    mock_raw_questions = RawGeneratedQuestionsList(
        questions=[
            RawInterviewQuestion(
                question_text="How does the hash map approach compare to the two-pointer technique if the array were already sorted?",
                topic="complexity",
                difficulty="medium",
                question_type="tradeoff",
                expected_concepts=["Two pointer uses O(1) auxiliary space", "Hash map uses O(n) space"],
                evaluation_criteria="Candidate must mention the space difference between two-pointer O(1) and hash map O(n)."
            )
        ]
    )

    with patch("app.api.interview.is_groq_configured", return_value=True), \
         patch("app.services.interview_service.is_groq_configured", return_value=True), \
         patch("app.services.interview_service.call_groq_structured", new_callable=AsyncMock) as mock_q:
        
        mock_q.return_value = mock_raw_questions

        start_resp = client.post("/api/interview/start", json={
            "source_code": source_code,
            "language": "python",
            "difficulty": "intermediate",
            "topic": "complexity",
            "num_questions": 1
        })
        assert start_resp.status_code == 201, f"Step 13 failed: {start_resp.text}"
        start_data = start_resp.json()
        interview_session_id = start_data["session_id"]
        assert len(start_data["questions"]) == 1
        interview_q_id = start_data["questions"][0]["id"]
        # Hidden rubrics should not be leaked to candidate
        assert "expected_concepts" not in start_data["questions"][0]

    # -------------------------------------------------------------------------
    # STEP 14: Submit Interview Answer & Receive Feedback
    # -------------------------------------------------------------------------
    mock_eval = RawAnswerEvaluation(
        score=9.5,
        feedback="Superb explanation. You correctly identified that two-pointers achieves O(1) auxiliary space when sorted.",
        correct_concepts=["Two-pointer O(1) space", "Hash map O(n) space"],
        missing_concepts=[],
        incorrect_statements=[],
        suggested_improvements="Could mention that sorting first takes O(n log n) time if not already sorted.",
        reference_answer="If sorted, two pointers gives O(n) time and O(1) space, saving memory compared to hash map.",
        is_sufficient=True,
        has_follow_up=False,
        follow_up_type=None,
        follow_up_text=None
    )

    with patch("app.api.interview.is_groq_configured", return_value=True), \
         patch("app.services.interview_service.is_groq_configured", return_value=True), \
         patch("app.services.interview_service.call_groq_structured", new_callable=AsyncMock) as mock_ans:
        
        mock_ans.return_value = mock_eval

        answer_resp = client.post("/api/interview/answer", json={
            "session_id": interview_session_id,
            "question_id": interview_q_id,
            "answer": "If the array is sorted, two pointers achieves O(n) time with O(1) space, avoiding the O(n) memory overhead of the hash map."
        })
        assert answer_resp.status_code == 200, f"Step 14 failed: {answer_resp.text}"
        answer_data = answer_resp.json()
        assert answer_data["score"] == 9.5
        assert answer_data["is_sufficient"] is True

    # -------------------------------------------------------------------------
    # STEP 15: Complete Interview & View Report
    # -------------------------------------------------------------------------
    mock_synthesis = RawReportSynthesis(
        overall_feedback="Solid performance demonstrating good grasp of space vs time algorithmic tradeoffs.",
        strengths=["Strong grasp of space vs time algorithmic tradeoffs"],
        areas_for_revision=[],
        suggested_practice_topics=["Binary Search on Answer Space"]
    )

    with patch("app.api.interview.is_groq_configured", return_value=True), \
         patch("app.services.interview_service.is_groq_configured", return_value=True), \
         patch("app.services.interview_service.call_groq_structured", new_callable=AsyncMock) as mock_rep:
        
        mock_rep.return_value = mock_synthesis

        report_resp = client.get(f"/api/interview/{interview_session_id}/report")
        assert report_resp.status_code == 200, f"Step 15 failed: {report_resp.text}"
        report_data = report_resp.json()
        assert report_data["status"] == "completed"
        assert report_data["questions_answered"] == 1
        assert report_data["average_score"] == 9.5

    # -------------------------------------------------------------------------
    # STEP 16: Save and Reopen Code History
    # -------------------------------------------------------------------------
    save_code_resp = client.post("/api/history/code", json={
        "title": "Two Sum Optimal Hash Map",
        "language": "python",
        "source_code": source_code,
        "execution_status": "Accepted",
        "stdout": "0 1\n",
        "execution_time": 0.042,
        "memory_used": 12400.0,
        "analysis_summary": "Optimal hash map solution with O(n) runtime.",
        "analysis_results": mock_analysis_resp.model_dump()
    })
    assert save_code_resp.status_code == 201, f"Step 16 save failed: {save_code_resp.text}"
    saved_code_id = save_code_resp.json()["id"]

    # Reopen code session (simulate candidate navigating to history and opening session)
    reopen_code_resp = client.get(f"/api/history/code/{saved_code_id}")
    assert reopen_code_resp.status_code == 200, f"Step 16 reopen failed: {reopen_code_resp.text}"
    reopened = reopen_code_resp.json()
    assert reopened["title"] == "Two Sum Optimal Hash Map"
    assert reopened["language"] == "python"
    assert "diff in seen" in reopened["source_code"]
    assert reopened["analysis_results"]["complexity_analysis"]["original_time_complexity"] == "O(n)"

    # -------------------------------------------------------------------------
    # STEP 17: Reopen Interview Session Scorecard from History
    # -------------------------------------------------------------------------
    history_interviews_resp = client.get("/api/history/interviews")
    assert history_interviews_resp.status_code == 200, f"Step 17 list failed: {history_interviews_resp.text}"
    interviews_list = history_interviews_resp.json()["items"]
    assert any(item["id"] == interview_session_id for item in interviews_list)

    reopen_interview_resp = client.get(f"/api/history/interviews/{interview_session_id}")
    assert reopen_interview_resp.status_code == 200, f"Step 17 reopen failed: {reopen_interview_resp.text}"
    interview_detail = reopen_interview_resp.json()
    assert interview_detail["session_id"] == interview_session_id
    assert interview_detail["questions"][0]["evaluation"]["score"] == 9.5

    # -------------------------------------------------------------------------
    # STEP 18: Log Out and Verify Protected Access is Denied
    # -------------------------------------------------------------------------
    logout_resp = client.post("/api/auth/logout")
    assert logout_resp.status_code == 200, f"Step 18 logout failed: {logout_resp.text}"
    client.cookies.clear()  # Ensure cookie is cleared in test client

    # Verify protected routes reject unauthenticated access
    unauth_me = client.get("/api/auth/me")
    assert unauth_me.status_code == 401

    unauth_code_history = client.get("/api/history/code")
    assert unauth_code_history.status_code == 401

    unauth_interview_history = client.get("/api/history/interviews")
    assert unauth_interview_history.status_code == 401

    unauth_save = client.post("/api/history/code", json={"title": "Hack", "language": "python", "source_code": "code"})
    assert unauth_save.status_code == 401
