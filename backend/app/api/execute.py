"""
FastAPI router for Code Execution endpoints.
Provides /api/execute, /api/execute/testcases, and /api/execute/languages.
"""

from fastapi import APIRouter
from app.services.execution_service import (
    ExecuteRequest, 
    ExecuteResponse, 
    BatchExecuteRequest,
    BatchExecuteResponse,
    execute_code, 
    evaluate_test_cases,
    check_judge0_languages
)

router = APIRouter(tags=["Code Execution"])


@router.post(
    "/execute",
    response_model=ExecuteResponse,
    summary="Execute Code via Judge0 Sandbox",
    description="Submits untrusted source code to the configured Judge0 sandbox runtime. Evaluates stdout, stderr, execution time, and compilation errors."
)
async def run_code(request: ExecuteRequest) -> ExecuteResponse:
    """
    Executes source code in an isolated sandbox environment.
    Never executes untrusted code locally.
    """
    return await execute_code(request)


@router.post(
    "/execute/testcases",
    response_model=BatchExecuteResponse,
    summary="Evaluate Multiple Test Cases",
    description="Runs untrusted source code against multiple test cases, compares normalized output, and returns per-case results and summary pass rates."
)
async def run_test_cases(request: BatchExecuteRequest) -> BatchExecuteResponse:
    """
    Evaluates source code against multiple test cases.
    Ensures compilation and runtime errors are never marked as passed.
    """
    return await evaluate_test_cases(
        language=request.language,
        source_code=request.source_code,
        test_cases=request.test_cases
    )


@router.get(
    "/execute/languages",
    summary="List Supported Execution Languages",
    description="Returns the list of supported languages and verifies availability with configured Judge0 instance."
)
async def list_supported_languages():
    """Lists languages available for execution and provider readiness status."""
    return await check_judge0_languages()
