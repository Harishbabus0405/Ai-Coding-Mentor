"""
Live Smoke Test for Groq Multi-Agent AI Analysis.
This test is clearly distinguished from mocked unit tests.
It only executes real LLM inference when a valid GROQ_API_KEY is configured in backend/.env.
"""

import os
import sys
import asyncio

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings
from app.services.groq_service import is_groq_configured
from app.services.analysis_models import AnalyzeRequest
from app.services.analysis_workflow import run_analysis_workflow


async def main():
    print("\n=======================================================")
    print("  LIVE GROQ MULTI-AGENT SMOKE TEST (PHASE 4)          ")
    print("=======================================================")

    configured = is_groq_configured()
    if not configured:
        print("\n[LIVE GROQ SMOKE TEST SKIPPED]")
        print("Reason: No active GROQ_API_KEY configured in backend/.env.")
        print(f"Current Model: {settings.GROQ_MODEL}")
        print("Current GROQ_API_KEY: [Not configured / placeholder]")
        print("\nTo enable live AI analysis testing against Groq API:")
        print("  1. Create a free API key at https://console.groq.com")
        print("  2. Set GROQ_API_KEY=gsk_... in backend/.env")
        print("  3. Re-run this smoke test.")
        print("\nAll mocked unit and integration tests run independently and verify full multi-agent flow.\n")
        return 0

    print(f"\nLive Groq Provider Detected!")
    print(f"Active Model: {settings.GROQ_MODEL}")
    print("Submitting live analysis request for Python Two-Sum snippet...")

    req = AnalyzeRequest(
        language="python",
        source_code="""def two_sum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []
""",
        stdin="",
        execution_result={
            "status": "Accepted",
            "stdout": "[0, 1]\n",
            "stderr": None,
            "compile_output": None,
            "execution_time": 0.012,
            "memory_used": 7500,
            "message": "Accepted"
        }
    )

    result = await run_analysis_workflow(req)

    print(f"\nWorkflow Status: {result.status}")
    print(f"Overall Summary: {result.overall_summary}")
    print(f"Review Status: {result.code_review.status}")
    print(f"Detected Bugs Count: {len(result.bugs)}")
    print(f"Optimization Needed: {result.optimized_solution.is_optimization_needed}")
    print(f"Original Time Complexity: {result.complexity_analysis.original_time_complexity}")
    print(f"Original Space Complexity: {result.complexity_analysis.original_space_complexity}")
    print(f"Key Concepts: {result.learning_explanation.key_concepts}")

    if result.status == "Completed":
        print("\n[PASS] Live Groq multi-agent analysis successfully verified!")
        return 0
    else:
        print(f"\n[FAIL] Live Groq analysis returned unexpected status: {result.status}")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
