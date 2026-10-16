"""
Live Smoke Test for Judge0 Code Execution Provider.
This test is clearly distinguished from mocked unit tests.
It only executes when a real Judge0 provider is configured in backend/.env.
"""

import os
import sys
import asyncio

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings
from app.services.execution_service import (
    is_provider_configured, 
    execute_code, 
    ExecuteRequest,
    evaluate_test_cases,
    TestCaseItem
)


async def main():
    print("\n=======================================================")
    print("  LIVE CODE EXECUTION SMOKE TEST (PHASE 3)             ")
    print("=======================================================")

    configured = is_provider_configured()
    if not configured:
        print("\n[LIVE SMOKE TEST SKIPPED]")
        print("Reason: No active Judge0 execution provider configured.")
        print(f"Current JUDGE0_URL: {settings.JUDGE0_URL}")
        print("Current JUDGE0_API_KEY: [Not configured / placeholder]")
        print("\nTo run this live smoke test against a real Judge0 sandbox:")
        print("  1. RapidAPI Judge0 CE: Set JUDGE0_API_KEY in backend/.env with your RapidAPI key.")
        print("  2. Self-Hosted Judge0: Set JUDGE0_URL=http://localhost:2358 in backend/.env.")
        print("\nAll mocked unit & integration tests run independently and verify full execution semantics.\n")
        return 0

    print(f"\nLive Provider Detected: {settings.JUDGE0_URL}")
    print("Submitting live smoke test program: Python print('Hello, World!')...")

    req = ExecuteRequest(
        language="python",
        source_code="print('Hello, World!')",
        stdin=""
    )

    result = await execute_code(req)
    print(f"Status: {result.status}")
    print(f"Stdout: {repr(result.stdout)}")
    print(f"Execution Time: {result.execution_time}s")
    print(f"Memory Used: {result.memory_used}KB")

    if result.status == "Accepted" and "Hello, World!" in (result.stdout or ""):
        print("\n[PASS] Live smoke test successfully verified on real Judge0 sandbox!")
        return 0
    else:
        print(f"\n[FAIL] Live smoke test returned unexpected status: {result.status}")
        if result.message:
            print(f"Message: {result.message}")
        if result.stderr:
            print(f"Stderr: {result.stderr}")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
