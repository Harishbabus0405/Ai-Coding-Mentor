"""
Automated Test Suite for Phase 4 Multi-Agent AI Analysis.
Mocks Groq API calls to verify all 5 LangGraph agent nodes, validation rules,
error handling, rate limits, partial workflow fallbacks, and response schemas.
Does not require an active Groq API key to pass.
"""

import os
import sys
import json
from unittest.mock import patch, AsyncMock, MagicMock

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from starlette.testclient import TestClient
import groq

from app.main import app
from app.services.analysis_models import (
    AnalyzeRequest,
    AnalyzeResponse,
    CodeReviewResult,
    BugFinding,
    TestAnalysisResult,
    OptimizedSolutionResult,
    ComplexityAnalysisResult,
    LearningExplanationResult
)
from app.services.analysis_workflow import run_analysis_workflow
from app.services.groq_service import (
    is_groq_configured,
    call_groq_structured,
    GroqAuthError,
    GroqRateLimitError,
    GroqConnectionError
)

client = TestClient(app)


# -------------------------------------------------------------------------
# 1. Request Validation Tests
# -------------------------------------------------------------------------
def test_validation_unsupported_language():
    """Validates that unsupported languages are rejected with HTTP 422."""
    response = client.post("/api/analyze", json={
        "language": "rust",
        "source_code": "fn main() { println!(\"hello\"); }"
    })
    assert response.status_code == 422
    assert "Unsupported language" in response.text
    print("[PASS] Unsupported language correctly rejected with HTTP 422.")


def test_validation_empty_source_code():
    """Validates that empty or whitespace source code is rejected with HTTP 422."""
    response = client.post("/api/analyze", json={
        "language": "python",
        "source_code": "   \n   \t"
    })
    assert response.status_code == 422
    assert "source_code cannot be empty" in response.text
    print("[PASS] Empty source code correctly rejected with HTTP 422.")


def test_validation_oversized_source_code():
    """Validates that oversized source code is rejected with HTTP 422."""
    oversized = "x = 1\n" * 20000  # > 65536 characters
    response = client.post("/api/analyze", json={
        "language": "python",
        "source_code": oversized
    })
    assert response.status_code == 422
    assert "exceeds maximum allowed limit" in response.text
    print("[PASS] Oversized source code rejected with HTTP 422.")


# -------------------------------------------------------------------------
# 2. Unconfigured Provider Test
# -------------------------------------------------------------------------
def test_unconfigured_groq_provider():
    """When GROQ_API_KEY is not configured, returns Unavailable status with clear setup guidance."""
    with patch("app.services.analysis_workflow.is_groq_configured", return_value=False):
        response = client.post("/api/analyze", json={
            "language": "python",
            "source_code": "def two_sum(nums, target): return []"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "Unavailable"
        assert "GROQ_API_KEY" in data["overall_summary"]
        assert len(data["warnings"]) > 0
        print("[PASS] Unconfigured Groq provider gracefully returns Unavailable status.")


# -------------------------------------------------------------------------
# 3. Successful Multi-Agent Analysis Workflow (Mocked)
# -------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_successful_multi_agent_analysis_mocked():
    """Tests complete LangGraph execution through all 5 agent nodes with mocked Groq responses."""
    mock_responses = [
        # Node A: Code Review Agent Output
        json.dumps({
            "status": "Issues Found",
            "summary": "Implementation has a potential off-by-one boundary error in the inner loop.",
            "strengths": ["Clean function signature", "Uses built-in functions"],
            "potential_issues": ["Index boundary in array traversal"],
            "bugs": [{
                "severity": "high",
                "line_number": 4,
                "title": "Index Out of Range",
                "description": "Loop index reaches len(nums) instead of len(nums) - 1.",
                "root_cause": "Incorrect loop upper bound.",
                "suggestion": "Change range(len(nums)) to range(len(nums) - 1)."
            }]
        }),
        # Node B: Test Analysis Agent Output
        json.dumps({
            "summary": "1 of 2 tests failed due to IndexError.",
            "failed_test_explanations": [{
                "test_id": "tc-1",
                "name": "Edge Case - Single Element",
                "explanation": "Failed with IndexError when array size is 1.",
                "likely_cause": "Accessing index 1 on single-element array."
            }],
            "untested_boundary_conditions": ["Empty array", "Target not found", "Negative numbers"],
            "suggested_tests": [{
                "name": "Empty Input",
                "stdin": "",
                "expected_output": "[]",
                "reason": "Verifies graceful handling of empty lists."
            }]
        }),
        # Node C: Optimization Agent Output
        json.dumps({
            "is_optimization_needed": True,
            "optimized_code": "def two_sum(nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        complement = target - num\n        if complement in seen:\n            return [seen[complement], i]\n        seen[num] = i\n    return []\n",
            "explanation": "Replaced nested O(N^2) loop with a hash map lookup in O(N) time.",
            "tradeoffs": ["Requires O(N) auxiliary space instead of O(1) space."],
            "language": "python"
        }),
        # Node D: Complexity Analysis Agent Output
        json.dumps({
            "original_time_complexity": "O(N^2)",
            "original_space_complexity": "O(1)",
            "optimized_time_complexity": "O(N)",
            "optimized_space_complexity": "O(N)",
            "time_justification": "Original code contains nested loops iterating over N elements. Optimized code uses a single pass with O(1) dictionary lookups.",
            "space_justification": "Original code stores no extra data. Optimized code stores up to N elements in a hash map.",
            "assumptions": ["N = length of nums array"]
        }),
        # Node E: Mentor Summary Agent Output
        json.dumps({
            "overall_summary": "Your initial solution correctly identified the brute-force approach, but can be optimized from O(N^2) to O(N) using a hash map.",
            "learning_explanation": {
                "summary": "Trading a small amount of memory for significant time speedup is a classic algorithmic interview technique.",
                "key_concepts": ["Hash Table Lookup", "Time-Space Tradeoff", "Off-by-One Guarding"],
                "mentor_tips": ["Always consider if a dictionary can eliminate an inner loop."],
                "next_steps": ["Inspect the highlighted line 4 bug", "Copy and run the O(N) hash map solution"]
            }
        })
    ]

    mock_client = AsyncMock()
    # Create completion choices mock
    def make_choice(content):
        choice = MagicMock()
        choice.message.content = content
        mock_resp = MagicMock()
        mock_resp.choices = [choice]
        return mock_resp

    mock_client.chat.completions.create.side_effect = [
        make_choice(content) for content in mock_responses
    ]

    req = AnalyzeRequest(
        language="python",
        source_code="def two_sum(nums, target):\n    for i in range(len(nums)):\n        for j in range(i+1, len(nums)+1):\n            if nums[i] + nums[j] == target: return [i, j]",
        test_results=[{
            "id": "tc-1",
            "name": "Edge Case - Single Element",
            "status": "Failed",
            "passed": False,
            "stdout": "",
            "stderr": "IndexError: list index out of range",
            "expected_output": "[0, 1]",
            "actual_output": ""
        }]
    )

    with patch("app.services.analysis_workflow.is_groq_configured", return_value=True):
        with patch("app.services.groq_service.get_groq_client", return_value=mock_client):
            result = await run_analysis_workflow(req)

            assert result.status == "Completed"
            assert "O(N^2)" in result.overall_summary or "O(N)" in result.overall_summary
            assert len(result.bugs) == 1
            assert result.bugs[0].line_number == 4
            assert result.bugs[0].severity == "high"
            assert result.optimized_solution.is_optimization_needed is True
            assert "seen" in result.optimized_solution.optimized_code
            assert result.complexity_analysis.original_time_complexity == "O(N^2)"
            assert result.complexity_analysis.optimized_time_complexity == "O(N)"
            assert len(result.learning_explanation.key_concepts) > 0
            print("[PASS] Complete 5-agent analysis workflow executed with all structured fields verified.")


# -------------------------------------------------------------------------
# 4. Missing Execution Results Test
# -------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_missing_execution_results_handled():
    """Tests that missing execution results are handled cleanly without claiming tests ran."""
    mock_responses = [
        # Node A
        json.dumps({
            "status": "Clean",
            "summary": "Code is well-structured.",
            "strengths": ["Clean structure"],
            "potential_issues": [],
            "bugs": []
        }),
        # Node B (Test analysis with no execution traces)
        json.dumps({
            "summary": "No runtime execution traces provided; boundary conditions derived statically.",
            "failed_test_explanations": [],
            "untested_boundary_conditions": ["Empty input", "Large array"],
            "suggested_tests": [{
                "name": "Base Case",
                "stdin": "0",
                "expected_output": "0",
                "reason": "Tests base condition."
            }]
        }),
        # Node C
        json.dumps({
            "is_optimization_needed": False,
            "optimized_code": None,
            "explanation": "Current solution is already optimal O(N).",
            "tradeoffs": [],
            "language": "python"
        }),
        # Node D
        json.dumps({
            "original_time_complexity": "O(N)",
            "original_space_complexity": "O(1)",
            "optimized_time_complexity": None,
            "optimized_space_complexity": None,
            "time_justification": "Single linear pass.",
            "space_justification": "No auxiliary structures.",
            "assumptions": ["N = input length"]
        }),
        # Node E
        json.dumps({
            "overall_summary": "Solution is optimal and clean.",
            "learning_explanation": {
                "summary": "Good job using standard linear scan.",
                "key_concepts": ["Linear Traversal"],
                "mentor_tips": ["Test edge cases."],
                "next_steps": ["Try more complex problems."]
            }
        })
    ]

    mock_client = AsyncMock()
    def make_choice(content):
        choice = MagicMock()
        choice.message.content = content
        mock_resp = MagicMock()
        mock_resp.choices = [choice]
        return mock_resp

    mock_client.chat.completions.create.side_effect = [
        make_choice(content) for content in mock_responses
    ]

    req = AnalyzeRequest(
        language="python",
        source_code="def find_max(nums):\n    return max(nums) if nums else None",
        execution_result=None,
        test_results=None
    )

    with patch("app.services.analysis_workflow.is_groq_configured", return_value=True):
        with patch("app.services.groq_service.get_groq_client", return_value=mock_client):
            result = await run_analysis_workflow(req)

            assert result.status == "Completed"
            assert result.test_analysis.failed_test_explanations == []
            assert result.optimized_solution.is_optimization_needed is False
            print("[PASS] Missing execution results handled cleanly with valid static edge cases.")


# -------------------------------------------------------------------------
# 5. Groq Rate Limit (429) Handling Test
# -------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_groq_rate_limit_handling():
    """Tests that Groq HTTP 429 rate limit is caught and returns Unavailable status with notice."""
    mock_client = AsyncMock()
    mock_client.chat.completions.create.side_effect = groq.RateLimitError(
        message="Rate limit reached",
        response=MagicMock(status_code=429),
        body={}
    )

    req = AnalyzeRequest(
        language="python",
        source_code="print('hello')"
    )

    with patch("app.services.analysis_workflow.is_groq_configured", return_value=True):
        with patch("app.services.groq_service.get_groq_client", return_value=mock_client):
            with patch("asyncio.sleep", new_callable=AsyncMock):
                result = await run_analysis_workflow(req)

                assert result.status == "Unavailable"
                assert "rate limit" in result.overall_summary.lower()
                print("[PASS] Groq HTTP 429 rate limit caught and returned informative Unavailable status.")


# -------------------------------------------------------------------------
# 6. Malformed JSON Recovery Test
# -------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_groq_malformed_json_retry():
    """Tests that a transient malformed JSON response triggers bounded retry and recovers."""
    invalid_json = "NOT_VALID_JSON"
    valid_json = json.dumps({
        "status": "Clean",
        "summary": "Recovered after retry.",
        "strengths": ["Robust retry"],
        "potential_issues": [],
        "bugs": []
    })

    mock_client = AsyncMock()
    choice_bad = MagicMock()
    choice_bad.message.content = invalid_json
    resp_bad = MagicMock(choices=[choice_bad])

    choice_good = MagicMock()
    choice_good.message.content = valid_json
    resp_good = MagicMock(choices=[choice_good])

    # First call yields bad JSON, second call yields good JSON
    mock_client.chat.completions.create.side_effect = [resp_bad, resp_good]

    res = await call_groq_structured(
        prompt="Review code",
        system_prompt="You are a reviewer",
        response_schema=CodeReviewResult,
        client=mock_client,
        max_retries=1
    )

    assert res.status == "Clean"
    assert res.summary == "Recovered after retry."
    print("[PASS] Transient malformed JSON successfully recovered via bounded retry.")


# -------------------------------------------------------------------------
# 7. Partial Agent Node Failure Test
# -------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_partial_workflow_failure_recovers_with_warning():
    """Tests that if one node fails, the workflow does not crash but includes a warning and fallback."""
    mock_client = AsyncMock()

    # Node A fails with an error
    mock_client.chat.completions.create.side_effect = [
        Exception("Transient model error in Code Review"),
        # Node B succeeds
        MagicMock(choices=[MagicMock(message=MagicMock(content=json.dumps({
            "summary": "Test coverage reasonable.",
            "failed_test_explanations": [],
            "untested_boundary_conditions": [],
            "suggested_tests": []
        })))]),
        # Node C succeeds
        MagicMock(choices=[MagicMock(message=MagicMock(content=json.dumps({
            "is_optimization_needed": False,
            "optimized_code": None,
            "explanation": "Already optimal.",
            "tradeoffs": [],
            "language": "python"
        })))]),
        # Node D succeeds
        MagicMock(choices=[MagicMock(message=MagicMock(content=json.dumps({
            "original_time_complexity": "O(1)",
            "original_space_complexity": "O(1)",
            "optimized_time_complexity": None,
            "optimized_space_complexity": None,
            "time_justification": "Constant operations.",
            "space_justification": "No allocations.",
            "assumptions": []
        })))]),
        # Node E succeeds
        MagicMock(choices=[MagicMock(message=MagicMock(content=json.dumps({
            "overall_summary": "Analysis completed with partial fallback.",
            "learning_explanation": {
                "summary": "Partial analysis notice.",
                "key_concepts": [],
                "mentor_tips": [],
                "next_steps": []
            }
        })))]),
    ]

    req = AnalyzeRequest(
        language="python",
        source_code="x = 10"
    )

    with patch("app.services.analysis_workflow.is_groq_configured", return_value=True):
        with patch("app.services.groq_service.get_groq_client", return_value=mock_client):
            result = await run_analysis_workflow(req)

            assert result.status == "Completed"
            assert len(result.warnings) > 0
            assert "Code review agent notice" in result.warnings[0]
            assert result.code_review.status == "Review Incomplete"
            print("[PASS] Partial workflow failure isolated: remaining agents completed and warning recorded.")


# -------------------------------------------------------------------------
# 8. GET /api/analyze/status Endpoint Test
# -------------------------------------------------------------------------
def test_analyze_status_endpoint():
    """Verifies that GET /api/analyze/status returns provider status and 5 registered agents."""
    response = client.get("/api/analyze/status")
    assert response.status_code == 200
    data = response.json()
    assert data["provider"] == "Groq API"
    assert "configured" in data
    assert len(data["agents"]) == 5
    agent_ids = [a["id"] for a in data["agents"]]
    assert "code_review" in agent_ids
    assert "test_analysis" in agent_ids
    assert "optimization" in agent_ids
    assert "complexity_analysis" in agent_ids
    assert "mentor_summary" in agent_ids
    print("[PASS] /api/analyze/status returns all 5 registered agents.")


# -------------------------------------------------------------------------
# Runner for direct python execution
# -------------------------------------------------------------------------
def run_all_tests():
    import asyncio
    print("\n=======================================================")
    print("  RUNNING AI ANALYSIS AUTOMATED TEST SUITE (PHASE 4)   ")
    print("=======================================================\n")
    test_validation_unsupported_language()
    test_validation_empty_source_code()
    test_validation_oversized_source_code()
    test_unconfigured_groq_provider()
    asyncio.run(test_successful_multi_agent_analysis_mocked())
    asyncio.run(test_missing_execution_results_handled())
    asyncio.run(test_groq_rate_limit_handling())
    asyncio.run(test_groq_malformed_json_retry())
    asyncio.run(test_partial_workflow_failure_recovers_with_warning())
    test_analyze_status_endpoint()
    print("\n=======================================================")
    print("  ALL 8 AI ANALYSIS AUTOMATED TESTS PASSED (8/8)       ")
    print("=======================================================\n")


if __name__ == "__main__":
    run_all_tests()
