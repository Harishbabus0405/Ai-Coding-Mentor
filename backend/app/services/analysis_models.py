"""
Pydantic Models for Phase 4 Multi-Agent AI Analysis.
Defines typed request, response, and structured agent finding schemas.
"""

from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field, field_validator

from app.core.config import settings
from app.services.execution_service import (
    LANGUAGE_MAPPINGS,
    ExecuteResponse,
    TestCaseResult
)


class BugFinding(BaseModel):
    """Detailed bug or suspicious logic finding identified by Code Review Agent."""
    __test__ = False
    severity: Literal["critical", "high", "medium", "low", "warning"] = Field(
        ..., description="Severity level of the finding"
    )
    line_number: Optional[int] = Field(
        default=None, description="1-indexed line number where the issue occurs, if reliably established"
    )
    title: str = Field(..., description="Short headline for the issue")
    description: str = Field(..., description="Clear explanation of the problem")
    root_cause: str = Field(..., description="Underlying mechanism causing the bug or flaw")
    suggestion: str = Field(..., description="Actionable recommendation to resolve the issue")


class CodeReviewResult(BaseModel):
    """Structured code review output from Node A."""
    __test__ = False
    status: str = Field(
        default="Review Completed",
        description="Review classification (e.g. Clean, Issues Identified, Critical Flaws)"
    )
    summary: str = Field(..., description="High-level evaluation of the submitted code")
    strengths: List[str] = Field(default_factory=list, description="Notable positive patterns in the code")
    potential_issues: List[str] = Field(default_factory=list, description="Suspicious logic or unsafe assumptions")


class FailedTestExplanation(BaseModel):
    """Explanation of a specific failed test case from Node B."""
    __test__ = False
    test_id: str = Field(..., description="Identifier of the test case")
    name: str = Field(..., description="Name or label of the test case")
    explanation: str = Field(..., description="Explanation of why the test failed or produced unexpected output")
    likely_cause: str = Field(..., description="Suspected algorithmic or implementation cause")


class SuggestedTestCase(BaseModel):
    """New test case suggested by Test Analysis Agent to probe edge cases."""
    __test__ = False
    name: str = Field(..., description="Descriptive label for suggested case")
    stdin: str = Field(default="", description="Input stream for test case")
    expected_output: str = Field(default="", description="Expected stdout")
    reason: str = Field(..., description="Edge case or condition this test validates")


class TestAnalysisResult(BaseModel):
    """Structured test analysis output from Node B."""
    __test__ = False
    summary: str = Field(..., description="Overall analysis of execution and test-case results")
    failed_test_explanations: List[FailedTestExplanation] = Field(
        default_factory=list, description="Per-failed test root cause analysis"
    )
    untested_boundary_conditions: List[str] = Field(
        default_factory=list, description="Edge cases not covered by current test cases"
    )
    suggested_tests: List[SuggestedTestCase] = Field(
        default_factory=list, description="New recommended test inputs with expected results"
    )


class OptimizedSolutionResult(BaseModel):
    """Optimization proposal from Node C."""
    __test__ = False
    is_optimization_needed: bool = Field(
        ..., description="Whether a significant algorithmic or memory optimization is justified"
    )
    optimized_code: Optional[str] = Field(
        default=None, description="Complete optimized source code in target language"
    )
    explanation: str = Field(
        ..., description="Explanation of algorithmic improvements and optimizations applied"
    )
    tradeoffs: List[str] = Field(
        default_factory=list, description="Trade-offs in readability, memory, or complexity"
    )
    language: str = Field(default="", description="Language of optimized code")


class ComplexityAnalysisResult(BaseModel):
    """Asymptotic Big-O complexity analysis from Node D."""
    __test__ = False
    original_time_complexity: str = Field(
        ..., description="Time complexity of original code (e.g. O(N), O(N^2), O(2^N))"
    )
    original_space_complexity: str = Field(
        ..., description="Auxiliary space complexity of original code"
    )
    optimized_time_complexity: Optional[str] = Field(
        default=None, description="Time complexity of proposed optimized solution, if one exists"
    )
    optimized_space_complexity: Optional[str] = Field(
        default=None, description="Auxiliary space complexity of proposed optimized solution"
    )
    time_justification: str = Field(
        ..., description="Step-by-step breakdown of dominant loops, recursive calls, and operations"
    )
    space_justification: str = Field(
        ..., description="Breakdown of auxiliary allocations, stack frames, and data structures"
    )
    assumptions: List[str] = Field(
        default_factory=list, description="Input size parameters (e.g. N = length of input array)"
    )


class LearningExplanationResult(BaseModel):
    """Pedagogical summary and mentor advice from Node E."""
    __test__ = False
    summary: str = Field(..., description="Student-friendly high-level takeaway")
    key_concepts: List[str] = Field(
        default_factory=list, description="Core computer science and algorithmic principles demonstrated"
    )
    mentor_tips: List[str] = Field(
        default_factory=list, description="Pro tips for technical interviews and coding hygiene"
    )
    next_steps: List[str] = Field(
        default_factory=list, description="Concrete next actions for the developer"
    )


class AnalyzeRequest(BaseModel):
    """Incoming request model for POST /api/analyze."""
    source_code: str = Field(..., description="Source code to analyze")
    language: str = Field(..., description="Programming language (e.g. python, javascript, cpp)")
    stdin: Optional[str] = Field(default="", description="Optional standard input stream")
    execution_result: Optional[ExecuteResponse] = Field(
        default=None, description="Phase 3 sandbox execution result if previously run"
    )
    test_results: Optional[List[TestCaseResult]] = Field(
        default=None, description="Phase 3 test cases evaluation results if previously run"
    )
    analysis_options: Optional[Dict[str, Any]] = Field(
        default_factory=dict, description="Optional configuration parameters for analysis"
    )

    @field_validator("language")
    @classmethod
    def validate_language(cls, v: str) -> str:
        clean_lang = v.strip().lower()
        if clean_lang not in LANGUAGE_MAPPINGS:
            allowed = ", ".join(["python", "javascript", "typescript", "c", "cpp", "java"])
            raise ValueError(f"Unsupported language '{v}'. Allowed languages are: {allowed}")
        return clean_lang

    @field_validator("source_code")
    @classmethod
    def validate_source_code(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("source_code cannot be empty or contain only whitespace.")
        if len(v) > settings.MAX_SOURCE_CODE_LENGTH:
            raise ValueError(f"source_code exceeds maximum allowed limit of {settings.MAX_SOURCE_CODE_LENGTH} characters.")
        return v


class AnalyzeResponse(BaseModel):
    """Complete structured response model for POST /api/analyze."""
    status: str = Field(default="Completed", description="Analysis status: Completed, Partial, Unavailable, Error")
    overall_summary: str = Field(..., description="Executive summary combining all agent findings")
    code_review: CodeReviewResult = Field(..., description="Code Review Agent output")
    bugs: List[BugFinding] = Field(default_factory=list, description="List of detected bugs and issues")
    test_analysis: TestAnalysisResult = Field(..., description="Test Analysis Agent output")
    optimized_solution: OptimizedSolutionResult = Field(..., description="Optimization Agent output")
    complexity_analysis: ComplexityAnalysisResult = Field(..., description="Complexity Analysis Agent output")
    learning_explanation: LearningExplanationResult = Field(..., description="Mentor Summary Agent output")
    warnings: List[str] = Field(default_factory=list, description="Warnings or caveats regarding analysis")
