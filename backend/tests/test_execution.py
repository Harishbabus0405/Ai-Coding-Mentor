"""
Comprehensive Automated Test Suite for Code Execution Service and Test Runner.
Tests mocked Judge0 execution, validation, error classifications, timeouts,
multiple test-case evaluation, and output normalization policy.
"""

import os
import sys
import base64
from unittest.mock import patch

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from starlette.testclient import TestClient
import httpx

from app.main import app
from app.services.execution_service import (
    execute_code, 
    evaluate_test_cases,
    ExecuteRequest, 
    TestCaseItem,
    normalize_output,
    compare_outputs,
    LANGUAGE_MAPPINGS
)

client = TestClient(app)


# 1. Request Validation Tests
def test_request_validation_unsupported_language():
    """Validates that unsupported languages are rejected with HTTP 422."""
    response = client.post("/api/execute", json={
        "language": "ruby",
        "source_code": "puts 'hello'"
    })
    assert response.status_code == 422
    assert "Unsupported language" in response.text
    print("[PASS] Unsupported language correctly rejected with 422.")


def test_request_validation_empty_code():
    """Validates that empty or whitespace source code is rejected with HTTP 422."""
    response = client.post("/api/execute", json={
        "language": "python",
        "source_code": "   \n  \t "
    })
    assert response.status_code == 422
    assert "source_code cannot be empty" in response.text
    print("[PASS] Empty source code rejected with 422.")


def test_request_validation_oversized_code():
    """Validates that source code exceeding maximum limit is rejected with HTTP 422."""
    oversized = "a = 1\n" * 20000  # > 65536 bytes
    response = client.post("/api/execute", json={
        "language": "python",
        "source_code": oversized
    })
    assert response.status_code == 422
    assert "exceeds maximum allowed limit" in response.text
    print("[PASS] Oversized source code rejected with 422.")


# 2. Unavailable Provider Configuration Test
def test_unavailable_provider_configuration():
    """When execution provider is not configured, returns Unavailable status with guidance."""
    with patch("app.services.execution_service.is_provider_configured", return_value=False):
        response = client.post("/api/execute", json={
            "language": "python",
            "source_code": "print('hello')"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "Unavailable"
        assert "Judge0 execution provider is not configured" in data["message"]
        print("[PASS] Unconfigured provider gracefully returns Unavailable status.")


# 3. Successful Execution Test (Mocked)
@pytest.mark.asyncio
async def test_successful_execution_mocked():
    """Tests successful code execution using mocked Judge0 provider response."""
    mock_judge0_response = {
        "status": {"id": 3, "description": "Accepted"},
        "stdout": base64.b64encode(b"Hello, World!\n").decode("utf-8"),
        "stderr": None,
        "compile_output": None,
        "message": None,
        "time": "0.015",
        "memory": 8192
    }

    mock_resp = httpx.Response(
        200, 
        json=mock_judge0_response,
        request=httpx.Request("POST", "https://judge0-ce.p.rapidapi.com/submissions")
    )

    with patch("app.services.execution_service.is_provider_configured", return_value=True):
        with patch.object(httpx.AsyncClient, "post", return_value=mock_resp):
            req = ExecuteRequest(language="python", source_code="print('Hello, World!')")
            result = await execute_code(req)

            assert result.status == "Accepted"
            assert result.stdout.strip() == "Hello, World!"
            assert result.execution_time == 0.015
            assert result.memory_used == 8192
            assert result.stderr is None
            print("[PASS] Mocked successful execution returned Accepted with correct stdout.")


# 4. Compilation Error Test (Mocked)
@pytest.mark.asyncio
async def test_compilation_error_mocked():
    """Tests compilation error handling using mocked Judge0 provider response."""
    error_output = "solution.cpp: In function 'int main()':\nsolution.cpp:5:5: error: 'cout' was not declared"
    mock_judge0_response = {
        "status": {"id": 6, "description": "Compilation Error"},
        "stdout": None,
        "stderr": None,
        "compile_output": base64.b64encode(error_output.encode("utf-8")).decode("utf-8"),
        "message": None,
        "time": None,
        "memory": None
    }

    mock_resp = httpx.Response(
        200, 
        json=mock_judge0_response,
        request=httpx.Request("POST", "https://judge0-ce.p.rapidapi.com/submissions")
    )

    with patch("app.services.execution_service.is_provider_configured", return_value=True):
        with patch.object(httpx.AsyncClient, "post", return_value=mock_resp):
            req = ExecuteRequest(language="cpp", source_code="int main() { cout << 1; }")
            result = await execute_code(req)

            assert result.status == "Compilation Error"
            assert result.compile_output is not None
            assert "error: 'cout' was not declared" in result.compile_output
            assert result.stdout is None
            print("[PASS] Mocked compilation error handled with Compilation Error status.")


# 5. Runtime Error Test (Mocked)
@pytest.mark.asyncio
async def test_runtime_error_mocked():
    """Tests runtime error handling using mocked Judge0 response."""
    stderr_output = "Traceback (most recent call last):\n  File \"solution.py\", line 1, in <module>\nZeroDivisionError: division by zero"
    mock_judge0_response = {
        "status": {"id": 11, "description": "Runtime Error (NZEC)"},
        "stdout": None,
        "stderr": base64.b64encode(stderr_output.encode("utf-8")).decode("utf-8"),
        "compile_output": None,
        "message": None,
        "time": "0.020",
        "memory": 7500
    }

    mock_resp = httpx.Response(
        200, 
        json=mock_judge0_response,
        request=httpx.Request("POST", "https://judge0-ce.p.rapidapi.com/submissions")
    )

    with patch("app.services.execution_service.is_provider_configured", return_value=True):
        with patch.object(httpx.AsyncClient, "post", return_value=mock_resp):
            req = ExecuteRequest(language="python", source_code="x = 1 / 0")
            result = await execute_code(req)

            assert "Runtime Error" in result.status
            assert "ZeroDivisionError" in result.stderr
            print("[PASS] Mocked runtime error handled with Runtime Error status and stderr.")


# 6. Time Limit Exceeded Test (Mocked)
@pytest.mark.asyncio
async def test_time_limit_exceeded_mocked():
    """Tests Time Limit Exceeded status handling."""
    mock_judge0_response = {
        "status": {"id": 5, "description": "Time Limit Exceeded"},
        "stdout": None,
        "stderr": None,
        "compile_output": None,
        "message": "Time limit exceeded",
        "time": "5.001",
        "memory": 12000
    }

    mock_resp = httpx.Response(
        200, 
        json=mock_judge0_response,
        request=httpx.Request("POST", "https://judge0-ce.p.rapidapi.com/submissions")
    )

    with patch("app.services.execution_service.is_provider_configured", return_value=True):
        with patch.object(httpx.AsyncClient, "post", return_value=mock_resp):
            req = ExecuteRequest(language="python", source_code="while True: pass")
            result = await execute_code(req)

            assert result.status == "Time Limit Exceeded"
            print("[PASS] Mocked time limit handled with Time Limit Exceeded status.")


# 7. HTTP Rate Limit (429) & Provider Timeout Tests
@pytest.mark.asyncio
async def test_rate_limit_429():
    """Tests Judge0 HTTP 429 rate limit response."""
    mock_resp = httpx.Response(
        429, 
        text="Too Many Requests",
        request=httpx.Request("POST", "https://judge0-ce.p.rapidapi.com/submissions")
    )

    with patch("app.services.execution_service.is_provider_configured", return_value=True):
        with patch.object(httpx.AsyncClient, "post", return_value=mock_resp):
            req = ExecuteRequest(language="python", source_code="print(1)")
            result = await execute_code(req)

            assert result.status == "Unavailable"
            assert "rate limit exceeded" in result.message.lower()
            print("[PASS] HTTP 429 rate limit handled with informative message.")


@pytest.mark.asyncio
async def test_http_timeout_handling():
    """Tests HTTP client timeout handling when Judge0 provider hangs."""
    with patch("app.services.execution_service.is_provider_configured", return_value=True):
        with patch.object(httpx.AsyncClient, "post", side_effect=httpx.TimeoutException("Read timed out")):
            req = ExecuteRequest(language="python", source_code="print(1)")
            result = await execute_code(req)

            assert result.status == "Time Limit Exceeded"
            assert "timed out" in result.message.lower()
            print("[PASS] HTTP timeout handled with Time Limit Exceeded status.")


# 8. Output Normalization Policy Tests
def test_output_normalization_policy():
    """
    Verifies output comparison policy:
    1. Trims leading and trailing whitespace.
    2. Strips trailing whitespace per line.
    3. Normalizes CRLF to LF.
    4. Preserves intra-line spaces and meaningful internal line breaks.
    """
    # 1. Matching cases with trailing newlines and spaces
    assert normalize_output("Hello World\n") == normalize_output("Hello World")
    assert normalize_output("1 2 3\n\n") == normalize_output("1 2 3")
    assert normalize_output("Line 1   \nLine 2  \n\n") == normalize_output("Line 1\nLine 2")
    
    # 2. compare_outputs helper
    assert compare_outputs("42\n", "42") is True
    assert compare_outputs("  result: 100  \n", "result: 100") is True

    # 3. Differing internal content must NEVER pass
    assert compare_outputs("Hello  World", "Hello World") is False
    assert compare_outputs("42", "43") is False
    assert compare_outputs(None, "42") is False
    assert compare_outputs("", "") is True
    print("[PASS] Output normalization and comparison rules strictly validated.")


# 9. Multiple Test Cases Evaluation Tests
@pytest.mark.asyncio
async def test_multiple_test_cases_evaluation():
    """
    Tests evaluation of multiple test cases:
    - Case 1 passes (matches expected)
    - Case 2 fails (wrong answer)
    - Case 3 runtime error (never counted as passed)
    - Summary reports 1/3 passed
    """
    test_cases = [
        TestCaseItem(id="tc-1", name="Passing Case", stdin="5", expected_output="10"),
        TestCaseItem(id="tc-2", name="Failing Case", stdin="3", expected_output="9"),
        TestCaseItem(id="tc-3", name="Error Case", stdin="0", expected_output="0"),
    ]

    responses = [
        # tc-1: Accepted, stdout "10"
        httpx.Response(
            200, 
            json={"status": {"id": 3, "description": "Accepted"}, "stdout": base64.b64encode(b"10\n").decode("utf-8"), "time": "0.01", "memory": 5000},
            request=httpx.Request("POST", "https://judge0-ce.p.rapidapi.com/submissions")
        ),
        # tc-2: Accepted, stdout "6" (expected "9" -> Failed)
        httpx.Response(
            200, 
            json={"status": {"id": 3, "description": "Accepted"}, "stdout": base64.b64encode(b"6\n").decode("utf-8"), "time": "0.01", "memory": 5000},
            request=httpx.Request("POST", "https://judge0-ce.p.rapidapi.com/submissions")
        ),
        # tc-3: Runtime Error (ZeroDivisionError)
        httpx.Response(
            200, 
            json={"status": {"id": 11, "description": "Runtime Error (NZEC)"}, "stdout": None, "stderr": base64.b64encode(b"ZeroDivisionError").decode("utf-8"), "time": "0.01", "memory": 5000},
            request=httpx.Request("POST", "https://judge0-ce.p.rapidapi.com/submissions")
        )
    ]

    with patch("app.services.execution_service.is_provider_configured", return_value=True):
        with patch.object(httpx.AsyncClient, "post", side_effect=responses):
            batch_result = await evaluate_test_cases(
                language="python",
                source_code="import sys\nx = int(sys.stdin.read().strip())\nprint(x * 2)",
                test_cases=test_cases
            )

            # Check individual cases
            assert len(batch_result.results) == 3
            assert batch_result.results[0].status == "Passed"
            assert batch_result.results[0].passed is True

            assert batch_result.results[1].status == "Failed"
            assert batch_result.results[1].passed is False

            assert "Runtime Error" in batch_result.results[2].status
            assert batch_result.results[2].passed is False

            # Check summary
            assert batch_result.summary["total"] == 3
            assert batch_result.summary["passed"] == 1
            assert batch_result.summary["failed"] == 1
            assert batch_result.summary["errors"] == 1
            assert batch_result.summary["pass_rate"] == "1/3 tests passed"
            print("[PASS] Multiple test cases evaluated with correct pass/fail/error tally.")


@pytest.mark.asyncio
async def test_compilation_error_marks_all_test_cases_failed():
    """Validates that a compilation error is never marked as passed on any test case."""
    test_cases = [
        TestCaseItem(id="tc-1", name="Case 1", stdin="", expected_output="Hello"),
        TestCaseItem(id="tc-2", name="Case 2", stdin="", expected_output="World")
    ]

    compile_resp = httpx.Response(
        200, 
        json={"status": {"id": 6, "description": "Compilation Error"}, "compile_output": base64.b64encode(b"syntax error").decode("utf-8")},
        request=httpx.Request("POST", "https://judge0-ce.p.rapidapi.com/submissions")
    )

    with patch("app.services.execution_service.is_provider_configured", return_value=True):
        with patch.object(httpx.AsyncClient, "post", return_value=compile_resp):
            batch_result = await evaluate_test_cases(
                language="cpp",
                source_code="invalid cpp code",
                test_cases=test_cases
            )

            assert len(batch_result.results) == 2
            assert all(r.status == "Compilation Error" for r in batch_result.results)
            assert all(r.passed is False for r in batch_result.results)
            assert batch_result.summary["passed"] == 0
            assert batch_result.summary["errors"] == 2
            print("[PASS] Compilation error properly marked all test cases as failed.")


def test_languages_endpoint():
    """Verifies that GET /api/execute/languages returns supported languages."""
    response = client.get("/api/execute/languages")
    assert response.status_code == 200
    data = response.json()
    assert "languages" in data
    assert "provider_configured" in data
    lang_ids = [l["id"] for l in data["languages"]]
    for expected in ("python", "javascript", "typescript", "c", "cpp", "java"):
        assert expected in lang_ids
    print("[PASS] /api/execute/languages returns all 6 canonical languages.")


def run_all_tests():
    import asyncio
    print("\n=======================================================")
    print("  RUNNING CODE EXECUTION AUTOMATED TEST SUITE (PHASE 3)  ")
    print("=======================================================\n")
    test_request_validation_unsupported_language()
    test_request_validation_empty_code()
    test_request_validation_oversized_code()
    test_unavailable_provider_configuration()
    asyncio.run(test_successful_execution_mocked())
    asyncio.run(test_compilation_error_mocked())
    asyncio.run(test_runtime_error_mocked())
    asyncio.run(test_time_limit_exceeded_mocked())
    asyncio.run(test_rate_limit_429())
    asyncio.run(test_http_timeout_handling())
    test_output_normalization_policy()
    asyncio.run(test_multiple_test_cases_evaluation())
    asyncio.run(test_compilation_error_marks_all_test_cases_failed())
    test_languages_endpoint()
    print("\n=======================================================")
    print("  ALL 14 CODE EXECUTION AUTOMATED TESTS PASSED (14/14)  ")
    print("=======================================================\n")


if __name__ == "__main__":
    run_all_tests()
