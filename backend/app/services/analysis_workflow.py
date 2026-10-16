"""
LangGraph Multi-Agent Analysis Workflow for AI Coding Mentor.
Coordinates 5 specialized agents:
- Node A: Code Review Agent
- Node B: Test Analysis Agent
- Node C: Optimization Agent
- Node D: Complexity Analysis Agent
- Node E: Mentor Summary Agent
"""

import json
import logging
from typing import TypedDict, Optional, List, Dict, Any
from pydantic import BaseModel
from langgraph.graph import StateGraph, START, END

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
from app.services.groq_service import (
    call_groq_structured,
    is_groq_configured,
    GroqAuthError,
    GroqRateLimitError,
    GroqConnectionError
)

logger = logging.getLogger("analysis_workflow")


class AnalysisState(TypedDict, total=False):
    """Shared, typed state passed across all workflow nodes."""
    source_code: str
    language: str
    stdin: Optional[str]
    execution_result: Optional[Dict[str, Any]]
    test_results: Optional[List[Dict[str, Any]]]
    analysis_options: Optional[Dict[str, Any]]
    
    # Agent findings
    code_review: Optional[Dict[str, Any]]
    bugs: List[Dict[str, Any]]
    test_analysis: Optional[Dict[str, Any]]
    optimized_solution: Optional[Dict[str, Any]]
    complexity_analysis: Optional[Dict[str, Any]]
    overall_summary: Optional[str]
    learning_explanation: Optional[Dict[str, Any]]
    warnings: List[str]
    errors: List[str]


# -------------------------------------------------------------------------
# Node A: Code Review Agent
# -------------------------------------------------------------------------
class CodeReviewAgentOutput(CodeReviewResult):
    bugs: List[BugFinding] = []


async def code_review_node(state: AnalysisState) -> Dict[str, Any]:
    """
    Node A: Code Review Agent.
    Analyzes logical errors, unsafe assumptions, edge cases, and suspicious code.
    Distinguishes confirmed bugs from potential issues; avoids purely stylistic complaints.
    """
    source_code = state.get("source_code", "")
    language = state.get("language", "text")
    warnings = list(state.get("warnings", []))

    system_prompt = (
        "You are a Senior Code Reviewer and Static Analysis Specialist. "
        "Your task is to thoroughly analyze the user's source code for logical bugs, boundary errors, "
        "type errors, and unhandled conditions. "
        "RULES:\n"
        "1. Identify actual logical errors and unsafe assumptions, NOT stylistic preferences.\n"
        "2. Provide accurate 1-indexed line numbers only when the location can be determined reliably.\n"
        "3. Provide clear explanations of root causes and concrete suggestions.\n"
        "4. Assign an appropriate severity ('critical', 'high', 'medium', 'low', 'warning')."
    )

    user_prompt = (
        f"Language: {language}\n\n"
        f"Source Code:\n```{language}\n{source_code}\n```\n\n"
        "Review this code and output a JSON object with fields:\n"
        "- status: (e.g. 'Clean', 'Issues Found', 'Critical Bugs')\n"
        "- summary: high-level evaluation\n"
        "- strengths: array of positive points\n"
        "- potential_issues: array of suspicious constructs or unhandled assumptions\n"
        "- bugs: array of objects with (severity, line_number, title, description, root_cause, suggestion)"
    )

    try:
        review_output = await call_groq_structured(
            prompt=user_prompt,
            system_prompt=system_prompt,
            response_schema=CodeReviewAgentOutput
        )

        return {
            "code_review": {
                "status": review_output.status,
                "summary": review_output.summary,
                "strengths": review_output.strengths,
                "potential_issues": review_output.potential_issues,
            },
            "bugs": [b.model_dump() for b in review_output.bugs],
            "warnings": warnings
        }
    except (GroqAuthError, GroqRateLimitError):
        raise
    except Exception as e:
        logger.warning(f"Code review agent encountered error: {e}")
        warnings.append(f"Code review agent notice: {str(e)}")
        return {
            "code_review": {
                "status": "Review Incomplete",
                "summary": "Automated code review could not be completed due to provider error.",
                "strengths": [],
                "potential_issues": []
            },
            "bugs": [],
            "warnings": warnings
        }


# -------------------------------------------------------------------------
# Node B: Test Analysis Agent
# -------------------------------------------------------------------------
async def test_analysis_node(state: AnalysisState) -> Dict[str, Any]:
    """
    Node B: Test Analysis Agent.
    Inspects actual execution output and test-case results from Phase 3.
    Explains why failed tests may have failed and suggests untested boundary cases.
    """
    source_code = state.get("source_code", "")
    language = state.get("language", "text")
    execution_result = state.get("execution_result")
    test_results = state.get("test_results") or []
    warnings = list(state.get("warnings", []))

    # If no execution or test results were supplied, return static boundary condition advice
    has_results = bool(execution_result or test_results)
    
    system_prompt = (
        "You are an Automated QA and Test Analysis Engineer. "
        "Your task is to analyze test results and execution output from untrusted code execution. "
        "RULES:\n"
        "1. Never claim a test passed or failed unless the provided test results confirm it.\n"
        "2. If a test case failed or errored, explain the likely underlying cause.\n"
        "3. Identify untested boundary conditions (e.g. empty input, single element, large inputs, negative values).\n"
        "4. Suggest 2-3 additional test cases with realistic inputs and expected outputs."
    )

    exec_summary = "No single execution result provided."
    if execution_result:
        exec_summary = (
            f"Status: {execution_result.get('status')}\n"
            f"Stdout: {execution_result.get('stdout')}\n"
            f"Stderr: {execution_result.get('stderr')}\n"
            f"Compile Output: {execution_result.get('compile_output')}\n"
            f"Execution Time: {execution_result.get('execution_time')}s"
        )

    tests_summary = "No batch test cases provided."
    if test_results:
        tests_summary = "\n".join([
            f"- Test '{t.get('name', t.get('id'))}': Status={t.get('status')}, Passed={t.get('passed')}, "
            f"Stdin={repr(t.get('stdin', ''))}, Expected={repr(t.get('expected_output', ''))}, Actual={repr(t.get('actual_output', ''))}"
            for t in test_results
        ])

    user_prompt = (
        f"Language: {language}\n\n"
        f"Source Code:\n```{language}\n{source_code}\n```\n\n"
        f"Execution Trace:\n{exec_summary}\n\n"
        f"Test Cases Results:\n{tests_summary}\n\n"
        "Analyze these results and return a JSON object with fields:\n"
        "- summary: overall assessment of test coverage and test behavior\n"
        "- failed_test_explanations: array of objects (test_id, name, explanation, likely_cause)\n"
        "- untested_boundary_conditions: array of edge cases not covered\n"
        "- suggested_tests: array of objects (name, stdin, expected_output, reason)"
    )

    try:
        test_output = await call_groq_structured(
            prompt=user_prompt,
            system_prompt=system_prompt,
            response_schema=TestAnalysisResult
        )

        return {
            "test_analysis": test_output.model_dump(),
            "warnings": warnings
        }
    except (GroqAuthError, GroqRateLimitError):
        raise
    except Exception as e:
        logger.warning(f"Test analysis agent encountered error: {e}")
        warnings.append(f"Test analysis notice: {str(e)}")
        fallback_summary = (
            "Test analysis unavailable due to provider error." if has_results 
            else "No runtime execution results were supplied. Run your code or test cases for dynamic failure diagnostics."
        )
        return {
            "test_analysis": {
                "summary": fallback_summary,
                "failed_test_explanations": [],
                "untested_boundary_conditions": ["Empty or null input", "Maximum size inputs", "Negative numbers or edge tokens"],
                "suggested_tests": []
            },
            "warnings": warnings
        }


# -------------------------------------------------------------------------
# Node C: Optimization Agent
# -------------------------------------------------------------------------
async def optimization_node(state: AnalysisState) -> Dict[str, Any]:
    """
    Node C: Optimization Agent.
    Evaluates current algorithm for unnecessary loops, repeated work, or inefficient structures.
    Proposes an optimized implementation only when justified, preserving original behavior.
    """
    source_code = state.get("source_code", "")
    language = state.get("language", "text")
    bugs = state.get("bugs") or []
    warnings = list(state.get("warnings", []))

    bug_context = ""
    if bugs:
        bug_context = "Known issues to fix during optimization:\n" + "\n".join(
            [f"- {b.get('title')}: {b.get('description')}" for b in bugs[:3]]
        )

    system_prompt = (
        "You are an Algorithmic Optimization and Performance Architect. "
        "Your task is to analyze the computational efficiency of the submitted code and propose an optimized version. "
        "RULES:\n"
        "1. Only propose a revised solution if a meaningful algorithmic, memory, or clean implementation improvement is justified.\n"
        "2. If the current implementation is already optimal, set 'is_optimization_needed' to false and explain why.\n"
        "3. Strictly preserve the intended input/output format and problem specifications.\n"
        "4. Return complete, working optimized source code in the same language.\n"
        "5. Detail performance vs readability trade-offs."
    )

    user_prompt = (
        f"Language: {language}\n\n"
        f"Original Source Code:\n```{language}\n{source_code}\n```\n\n"
        f"{bug_context}\n\n"
        "Evaluate and return a JSON object with fields:\n"
        "- is_optimization_needed: boolean\n"
        "- optimized_code: string containing the complete optimized source code (or null if already optimal)\n"
        "- explanation: detailed explanation of the algorithmic improvements\n"
        "- tradeoffs: array of strings discussing memory vs speed vs code clarity trade-offs\n"
        f"- language: '{language}'"
    )

    try:
        opt_output = await call_groq_structured(
            prompt=user_prompt,
            system_prompt=system_prompt,
            response_schema=OptimizedSolutionResult
        )

        return {
            "optimized_solution": opt_output.model_dump(),
            "warnings": warnings
        }
    except (GroqAuthError, GroqRateLimitError):
        raise
    except Exception as e:
        logger.warning(f"Optimization agent encountered error: {e}")
        warnings.append(f"Optimization agent notice: {str(e)}")
        return {
            "optimized_solution": {
                "is_optimization_needed": False,
                "optimized_code": None,
                "explanation": "Optimization analysis could not be completed due to provider error.",
                "tradeoffs": [],
                "language": language
            },
            "warnings": warnings
        }


# -------------------------------------------------------------------------
# Node D: Complexity Analysis Agent
# -------------------------------------------------------------------------
async def complexity_analysis_node(state: AnalysisState) -> Dict[str, Any]:
    """
    Node D: Complexity Analysis Agent.
    Evaluates asymptotic Big-O time and space complexity for original and proposed solutions.
    Does not mistake measured execution time for Big-O complexity.
    """
    source_code = state.get("source_code", "")
    language = state.get("language", "text")
    optimized_solution = state.get("optimized_solution") or {}
    opt_code = optimized_solution.get("optimized_code")
    warnings = list(state.get("warnings", []))

    system_prompt = (
        "You are an Algorithms and Computational Complexity Professor. "
        "Your task is to determine the theoretical Big-O Time and Auxiliary Space complexity. "
        "RULES:\n"
        "1. Never present measured execution time (in seconds/ms) as Big-O complexity.\n"
        "2. Break down the dominant factors step-by-step (nested loops, recursions, data structures).\n"
        "3. Provide Big-O for both the original code and the proposed optimized code (if provided).\n"
        "4. Explicitly state assumptions about input size parameters (e.g., N = number of elements)."
    )

    user_prompt = (
        f"Language: {language}\n\n"
        f"Original Code:\n```{language}\n{source_code}\n```\n\n"
        f"Optimized Code (if any):\n```{language}\n{opt_code or 'None'}\n```\n\n"
        "Analyze the Big-O complexity and return a JSON object with fields:\n"
        "- original_time_complexity: string (e.g. 'O(N^2)')\n"
        "- original_space_complexity: string (e.g. 'O(1)')\n"
        "- optimized_time_complexity: string (e.g. 'O(N)' or null)\n"
        "- optimized_space_complexity: string (e.g. 'O(N)' or null)\n"
        "- time_justification: step-by-step derivation of time complexity\n"
        "- space_justification: step-by-step derivation of memory allocations\n"
        "- assumptions: array of input size definitions"
    )

    try:
        comp_output = await call_groq_structured(
            prompt=user_prompt,
            system_prompt=system_prompt,
            response_schema=ComplexityAnalysisResult
        )

        return {
            "complexity_analysis": comp_output.model_dump(),
            "warnings": warnings
        }
    except (GroqAuthError, GroqRateLimitError):
        raise
    except Exception as e:
        logger.warning(f"Complexity analysis agent encountered error: {e}")
        warnings.append(f"Complexity analysis notice: {str(e)}")
        return {
            "complexity_analysis": {
                "original_time_complexity": "O(N)",
                "original_space_complexity": "O(1)",
                "optimized_time_complexity": None,
                "optimized_space_complexity": None,
                "time_justification": "Complexity evaluation could not be completed due to provider error.",
                "space_justification": "Space complexity evaluation could not be completed.",
                "assumptions": ["N = size of input"]
            },
            "warnings": warnings
        }


# -------------------------------------------------------------------------
# Node E: Mentor Summary Agent
# -------------------------------------------------------------------------
class MentorSummaryOutput(BaseModel):
    __test__ = False
    overall_summary: str
    learning_explanation: LearningExplanationResult


async def mentor_summary_node(state: AnalysisState) -> Dict[str, Any]:
    """
    Node E: Mentor Summary Agent.
    Synthesizes findings from all prior agents into an encouraging, student-friendly lesson.
    Highlights core concepts, pro tips, and clear next steps without redundant repetition.
    """
    source_code = state.get("source_code", "")
    language = state.get("language", "text")
    code_review = state.get("code_review") or {}
    bugs = state.get("bugs") or []
    test_analysis = state.get("test_analysis") or {}
    opt_solution = state.get("optimized_solution") or {}
    complexity = state.get("complexity_analysis") or {}
    warnings = list(state.get("warnings", []))

    system_prompt = (
        "You are an Empathetic Senior Staff Engineer and Technical Interview Mentor. "
        "Your task is to synthesize the technical findings into a cohesive, encouraging lesson for the developer. "
        "RULES:\n"
        "1. Summarize the key takeaway concisely in student-friendly language.\n"
        "2. Explain why the optimized approach is preferable without repeating the whole analysis verbatim.\n"
        "3. Highlight fundamental computer science patterns and data structures.\n"
        "4. Provide 3 actionable next steps to practice or verify."
    )

    findings_summary = (
        f"Review Status: {code_review.get('status')}\n"
        f"Detected Bugs Count: {len(bugs)}\n"
        f"Optimization Recommended: {opt_solution.get('is_optimization_needed')}\n"
        f"Original Complexity: {complexity.get('original_time_complexity')} time, {complexity.get('original_space_complexity')} space\n"
        f"Optimized Complexity: {complexity.get('optimized_time_complexity')} time, {complexity.get('optimized_space_complexity')} space"
    )

    user_prompt = (
        f"Language: {language}\n\n"
        f"Agent Findings Summary:\n{findings_summary}\n\n"
        "Synthesize this into a mentor takeaway and return a JSON object with fields:\n"
        "- overall_summary: a concise 2-3 sentence executive summary\n"
        "- learning_explanation: object with fields:\n"
        "    - summary: pedagogical overview\n"
        "    - key_concepts: array of 3-4 core concepts to learn\n"
        "    - mentor_tips: array of 2-3 interview-ready engineering tips\n"
        "    - next_steps: array of 3 concrete next actions"
    )

    try:
        mentor_output = await call_groq_structured(
            prompt=user_prompt,
            system_prompt=system_prompt,
            response_schema=MentorSummaryOutput
        )

        return {
            "overall_summary": mentor_output.overall_summary,
            "learning_explanation": mentor_output.learning_explanation.model_dump(),
            "warnings": warnings
        }
    except (GroqAuthError, GroqRateLimitError):
        raise
    except Exception as e:
        logger.warning(f"Mentor summary agent encountered error: {e}")
        warnings.append(f"Mentor summary notice: {str(e)}")
        return {
            "overall_summary": "Analysis completed. Review the individual tabs for detailed findings and recommendations.",
            "learning_explanation": {
                "summary": "Review the detected patterns and test recommendations to refine your implementation.",
                "key_concepts": ["Algorithmic efficiency", "Edge case validation", "Clean code structure"],
                "mentor_tips": ["Always test boundary conditions before submitting code."],
                "next_steps": ["Inspect highlighted bug findings", "Compare the optimized solution"]
            },
            "warnings": warnings
        }


# -------------------------------------------------------------------------
# Conditional Routing
# -------------------------------------------------------------------------
def route_after_code_review(state: AnalysisState) -> str:
    """
    Conditionally routes after Node A.
    Skips test analysis if client explicitly requested skipping tests.
    """
    options = state.get("analysis_options") or {}
    if options.get("skip_test_analysis", False):
        return "optimization"
    return "test_analysis"


# -------------------------------------------------------------------------
# Build and Compile LangGraph Workflow
# -------------------------------------------------------------------------
def build_analysis_graph():
    """Builds the compiled LangGraph StateGraph workflow."""
    workflow = StateGraph(AnalysisState)

    # 1. Register all 5 agent nodes
    workflow.add_node("code_review", code_review_node)
    workflow.add_node("test_analysis", test_analysis_node)
    workflow.add_node("optimization", optimization_node)
    workflow.add_node("complexity_analysis", complexity_analysis_node)
    workflow.add_node("mentor_summary", mentor_summary_node)

    # 2. Add edges with conditional routing
    workflow.add_edge(START, "code_review")
    workflow.add_conditional_edges(
        "code_review",
        route_after_code_review,
        {
            "test_analysis": "test_analysis",
            "optimization": "optimization"
        }
    )
    workflow.add_edge("test_analysis", "optimization")
    workflow.add_edge("optimization", "complexity_analysis")
    workflow.add_edge("complexity_analysis", "mentor_summary")
    workflow.add_edge("mentor_summary", END)

    return workflow.compile()


# Singleton compiled graph instance
analysis_graph = build_analysis_graph()


# -------------------------------------------------------------------------
# High-Level Workflow Runner
# -------------------------------------------------------------------------
async def run_analysis_workflow(request: AnalyzeRequest) -> AnalyzeResponse:
    """
    High-level entrypoint that executes the LangGraph multi-agent analysis workflow.
    Validates configuration, runs the graph, handles errors, and returns typed AnalyzeResponse.
    """
    # 1. Verify Groq API is configured
    if not is_groq_configured():
        return AnalyzeResponse(
            status="Unavailable",
            overall_summary=(
                "AI Analysis is unavailable because GROQ_API_KEY is not configured. "
                "Please configure GROQ_API_KEY in backend/.env to activate multi-agent code analysis."
            ),
            code_review=CodeReviewResult(
                status="Provider Unavailable",
                summary="GROQ_API_KEY is not configured in backend/.env.",
                strengths=[],
                potential_issues=[]
            ),
            bugs=[],
            test_analysis=TestAnalysisResult(
                summary="Test analysis requires active Groq LLM inference.",
                failed_test_explanations=[],
                untested_boundary_conditions=[],
                suggested_tests=[]
            ),
            optimized_solution=OptimizedSolutionResult(
                is_optimization_needed=False,
                optimized_code=None,
                explanation="LLM optimization engine requires active GROQ_API_KEY.",
                tradeoffs=[],
                language=request.language
            ),
            complexity_analysis=ComplexityAnalysisResult(
                original_time_complexity="N/A",
                original_space_complexity="N/A",
                optimized_time_complexity=None,
                optimized_space_complexity=None,
                time_justification="Requires GROQ_API_KEY.",
                space_justification="Requires GROQ_API_KEY.",
                assumptions=[]
            ),
            learning_explanation=LearningExplanationResult(
                summary="Please configure GROQ_API_KEY in backend/.env to receive personalized mentor recommendations.",
                key_concepts=[],
                mentor_tips=[],
                next_steps=["Get a free API key at https://console.groq.com", "Add GROQ_API_KEY to backend/.env", "Restart backend server"]
            ),
            warnings=["Groq execution provider not configured."]
        )

    # 2. Build initial state
    initial_state: AnalysisState = {
        "source_code": request.source_code,
        "language": request.language,
        "stdin": request.stdin or "",
        "execution_result": request.execution_result.model_dump() if request.execution_result else None,
        "test_results": [t.model_dump() for t in request.test_results] if request.test_results else None,
        "analysis_options": request.analysis_options or {},
        "bugs": [],
        "warnings": [],
        "errors": []
    }

    # 3. Invoke LangGraph workflow
    try:
        final_state = await analysis_graph.ainvoke(initial_state)

        # 4. Assemble typed response
        review_data = final_state.get("code_review") or {}
        bugs_data = final_state.get("bugs") or []
        test_data = final_state.get("test_analysis") or {}
        opt_data = final_state.get("optimized_solution") or {}
        comp_data = final_state.get("complexity_analysis") or {}
        learn_data = final_state.get("learning_explanation") or {}
        warnings = final_state.get("warnings") or []

        return AnalyzeResponse(
            status="Completed",
            overall_summary=final_state.get("overall_summary") or "Code analysis completed.",
            code_review=CodeReviewResult(**review_data),
            bugs=[BugFinding(**b) for b in bugs_data],
            test_analysis=TestAnalysisResult(**test_data),
            optimized_solution=OptimizedSolutionResult(**opt_data),
            complexity_analysis=ComplexityAnalysisResult(**comp_data),
            learning_explanation=LearningExplanationResult(**learn_data),
            warnings=warnings
        )

    except GroqAuthError as e:
        return AnalyzeResponse(
            status="Unavailable",
            overall_summary="Groq authentication failed. Please verify your GROQ_API_KEY.",
            code_review=CodeReviewResult(status="Auth Error", summary=str(e), strengths=[], potential_issues=[]),
            bugs=[],
            test_analysis=TestAnalysisResult(summary=str(e), failed_test_explanations=[], untested_boundary_conditions=[], suggested_tests=[]),
            optimized_solution=OptimizedSolutionResult(is_optimization_needed=False, explanation=str(e), language=request.language),
            complexity_analysis=ComplexityAnalysisResult(original_time_complexity="N/A", original_space_complexity="N/A", time_justification=str(e), space_justification=str(e)),
            learning_explanation=LearningExplanationResult(summary=str(e), key_concepts=[], mentor_tips=[], next_steps=[]),
            warnings=[f"Authentication error: {e}"]
        )

    except GroqRateLimitError as e:
        return AnalyzeResponse(
            status="Unavailable",
            overall_summary="Groq API rate limit reached. Please wait a moment before re-analyzing.",
            code_review=CodeReviewResult(status="Rate Limited", summary=str(e), strengths=[], potential_issues=[]),
            bugs=[],
            test_analysis=TestAnalysisResult(summary=str(e), failed_test_explanations=[], untested_boundary_conditions=[], suggested_tests=[]),
            optimized_solution=OptimizedSolutionResult(is_optimization_needed=False, explanation=str(e), language=request.language),
            complexity_analysis=ComplexityAnalysisResult(original_time_complexity="N/A", original_space_complexity="N/A", time_justification=str(e), space_justification=str(e)),
            learning_explanation=LearningExplanationResult(summary=str(e), key_concepts=[], mentor_tips=[], next_steps=[]),
            warnings=[f"Rate limit: {e}"]
        )

    except Exception as e:
        logger.exception("Unexpected failure during multi-agent analysis workflow")
        return AnalyzeResponse(
            status="Error",
            overall_summary="An error occurred while executing the multi-agent analysis workflow.",
            code_review=CodeReviewResult(status="Error", summary="Analysis pipeline encountered an error.", strengths=[], potential_issues=[]),
            bugs=[],
            test_analysis=TestAnalysisResult(summary="Could not complete test analysis.", failed_test_explanations=[], untested_boundary_conditions=[], suggested_tests=[]),
            optimized_solution=OptimizedSolutionResult(is_optimization_needed=False, explanation="Optimization unavailable.", language=request.language),
            complexity_analysis=ComplexityAnalysisResult(original_time_complexity="N/A", original_space_complexity="N/A", time_justification="Unavailable.", space_justification="Unavailable."),
            learning_explanation=LearningExplanationResult(summary="Please retry analysis.", key_concepts=[], mentor_tips=[], next_steps=[]),
            warnings=[f"Internal error: {str(e)}"]
        )
