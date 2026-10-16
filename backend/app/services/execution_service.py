"""
Modular Execution Service for Judge0 API Sandbox.
Handles code submission, polling, base64 transcoding, output normalization,
error classification, language validation, and multiple test-case evaluation.
"""

import asyncio
import base64
import logging
import time
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, field_validator
import httpx

from app.core.config import settings

logger = logging.getLogger("execution_service")

# Canonical Judge0 CE Language IDs (stable across Judge0 CE instances)
LANGUAGE_MAPPINGS: Dict[str, int] = {
    "python": 71,       # Python (3.8.1)
    "py": 71,
    "javascript": 63,   # JavaScript (Node.js 12.14.0)
    "js": 63,
    "typescript": 74,   # TypeScript (3.7.4)
    "ts": 74,
    "c": 50,            # C (GCC 9.2.0)
    "cpp": 54,          # C++ (GCC 9.2.0)
    "c++": 54,
    "java": 62,         # Java (OpenJDK 13.0.1)
}

# Canonical human-readable names and versions
LANGUAGE_NAMES: Dict[str, str] = {
    "python": "Python (3.8.1)",
    "javascript": "JavaScript (Node.js 12.14.0)",
    "typescript": "TypeScript (3.7.4)",
    "c": "C (GCC 9.2.0)",
    "cpp": "C++ (GCC 9.2.0)",
    "java": "Java (OpenJDK 13.0.1)",
}

# Cache for verified provider languages: (timestamp, data)
_LANGUAGES_CACHE: Dict[str, Any] = {"timestamp": 0.0, "data": None}
CACHE_TTL_SECONDS = 300.0  # 5 minutes


class ExecuteRequest(BaseModel):
    """Pydantic model for single execution request."""
    language: str = Field(..., description="Target programming language (e.g. python, javascript, typescript, c, cpp, java)")
    source_code: str = Field(..., description="Source code to execute in sandbox")
    stdin: Optional[str] = Field(default="", description="Optional standard input stream")

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

    @field_validator("stdin")
    @classmethod
    def validate_stdin(cls, v: Optional[str]) -> str:
        if v is None:
            return ""
        if len(v) > settings.MAX_STDIN_LENGTH:
            raise ValueError(f"stdin exceeds maximum allowed limit of {settings.MAX_STDIN_LENGTH} characters.")
        return v


class ExecuteResponse(BaseModel):
    """Pydantic model for execution response."""
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    compile_output: Optional[str] = None
    status: str = Field(..., description="Execution status description (e.g. Accepted, Compilation Error, Runtime Error, Time Limit Exceeded, Unavailable, Error)")
    execution_time: Optional[float] = None
    memory_used: Optional[int] = None
    message: Optional[str] = None


class TestCaseItem(BaseModel):
    """Single test case input and expected output."""
    __test__ = False
    id: str = Field(..., description="Unique test case identifier")
    name: str = Field(default="Test Case", description="Descriptive label for test case")
    stdin: str = Field(default="", description="Standard input passed to program")
    expected_output: str = Field(default="", description="Expected stdout from program")


class TestCaseResult(BaseModel):
    """Evaluation result for an individual test case."""
    __test__ = False
    id: str
    name: str
    status: str  # Passed, Failed, Compilation Error, Runtime Error, Time Limit Exceeded, Unavailable, Error
    passed: bool
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    compile_output: Optional[str] = None
    expected_output: str
    actual_output: str
    execution_time: Optional[float] = None
    memory_used: Optional[int] = None
    message: Optional[str] = None


class BatchExecuteRequest(BaseModel):
    """Request model for evaluating multiple test cases."""
    language: str
    source_code: str
    test_cases: List[TestCaseItem] = Field(..., min_length=1, max_length=25)

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
            raise ValueError(f"source_code exceeds limit of {settings.MAX_SOURCE_CODE_LENGTH} characters.")
        return v


class BatchExecuteResponse(BaseModel):
    """Summary and per-test case results."""
    results: List[TestCaseResult]
    summary: Dict[str, Any]


def normalize_output(text: Optional[str]) -> str:
    """
    Normalizes execution output for test case evaluation:
    1. Replaces CRLF and CR with LF.
    2. Strips trailing whitespace from each line.
    3. Strips leading and trailing newlines/whitespace.
    4. Preserves intra-line spaces and meaningful internal line breaks.
    """
    if not text:
        return ""
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = [line.rstrip() for line in normalized.strip().splitlines()]
    return "\n".join(lines)


def compare_outputs(actual: Optional[str], expected: str) -> bool:
    """
    Compares normalized actual output with normalized expected output.
    Returns True only if both match exactly after normalization.
    """
    return normalize_output(actual) == normalize_output(expected)


def encode_b64(text: Optional[str]) -> Optional[str]:
    """Encodes string to UTF-8 base64 for reliable transmission to Judge0."""
    if text is None:
        return None
    return base64.b64encode(text.encode("utf-8")).decode("utf-8")


def decode_b64(text: Optional[str]) -> Optional[str]:
    """Decodes base64 string returned by Judge0, handling non-base64 fallback gracefully."""
    if not text:
        return text
    try:
        decoded_bytes = base64.b64decode(text, validate=True)
        return decoded_bytes.decode("utf-8", errors="replace")
    except Exception:
        return text


def get_judge0_headers() -> Dict[str, str]:
    """Builds appropriate HTTP headers for RapidAPI or self-hosted Judge0."""
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    
    api_key = settings.JUDGE0_API_KEY.strip() if settings.JUDGE0_API_KEY else ""
    is_placeholder = api_key in ("", "your_judge0_or_rapidapi_key_here")

    # If using RapidAPI endpoint
    if "rapidapi.com" in settings.JUDGE0_URL.lower():
        if not is_placeholder:
            headers["x-rapidapi-key"] = api_key
            headers["x-rapidapi-host"] = settings.JUDGE0_API_HOST
    elif not is_placeholder:
        # Self-hosted token or custom auth
        headers["x-auth-token"] = api_key

    return headers


def is_provider_configured() -> bool:
    """
    Checks whether the Judge0 execution provider has required configuration.
    Returns False if URL is empty or if using RapidAPI with placeholder/empty key.
    """
    if not settings.JUDGE0_URL or not settings.JUDGE0_URL.strip():
        return False
    
    if "rapidapi.com" in settings.JUDGE0_URL.lower():
        api_key = settings.JUDGE0_API_KEY.strip() if settings.JUDGE0_API_KEY else ""
        if not api_key or api_key == "your_judge0_or_rapidapi_key_here":
            return False
            
    return True


async def execute_code(
    request: ExecuteRequest,
    client: Optional[httpx.AsyncClient] = None
) -> ExecuteResponse:
    """
    Submits untrusted source code to the configured Judge0 sandbox provider.
    Never executes untrusted code locally via exec, eval, or shell commands.
    """
    # 1. Verify provider configuration
    if not is_provider_configured():
        return ExecuteResponse(
            status="Unavailable",
            message=(
                "Judge0 execution provider is not configured. "
                "Please configure JUDGE0_URL (and JUDGE0_API_KEY if using RapidAPI) in backend/.env. "
                "See README.md for setup instructions."
            )
        )

    # 2. Map language to Judge0 language ID
    language_id = LANGUAGE_MAPPINGS.get(request.language)
    if not language_id:
        return ExecuteResponse(
            status="Error",
            message=f"Language '{request.language}' could not be mapped to an execution runtime."
        )

    # 3. Prepare payload for Judge0 with base64 encoding
    submission_payload = {
        "language_id": language_id,
        "source_code": encode_b64(request.source_code),
        "stdin": encode_b64(request.stdin or ""),
        "cpu_time_limit": settings.JUDGE0_CPU_TIME_LIMIT,
        "memory_limit": settings.JUDGE0_MEMORY_LIMIT,
    }

    base_url = settings.JUDGE0_URL.rstrip("/")
    submission_url = f"{base_url}/submissions?base64_encoded=true&wait=true"
    headers = get_judge0_headers()

    should_close_client = False
    if client is None:
        client = httpx.AsyncClient(timeout=settings.JUDGE0_TIMEOUT_SECONDS)
        should_close_client = True

    try:
        response = await client.post(submission_url, json=submission_payload, headers=headers)
        
        # Check HTTP authentication and rate limit responses
        if response.status_code in (401, 403):
            return ExecuteResponse(
                status="Unavailable",
                message="Judge0 authentication failed (HTTP 401/403). Check JUDGE0_API_KEY in backend/.env."
            )
        elif response.status_code == 429:
            return ExecuteResponse(
                status="Unavailable",
                message="Judge0 rate limit exceeded (HTTP 429). Please wait a few moments before retrying."
            )
        elif response.status_code not in (200, 201):
            return ExecuteResponse(
                status="Error",
                message=f"Judge0 provider returned HTTP {response.status_code}: {response.text[:200]}"
            )

        data = response.json()
        token = data.get("token")
        
        # If status is in queue (id 1) or processing (id 2), poll until completed
        status_obj = data.get("status") or {}
        status_id = status_obj.get("id", 1)

        poll_attempts = 0
        max_poll_attempts = 20  # up to 10 seconds (20 * 0.5s)
        while status_id in (1, 2) and token and poll_attempts < max_poll_attempts:
            await asyncio.sleep(0.5)
            poll_attempts += 1
            poll_url = f"{base_url}/submissions/{token}?base64_encoded=true"
            poll_resp = await client.get(poll_url, headers=headers)
            if poll_resp.status_code == 200:
                data = poll_resp.json()
                status_obj = data.get("status") or {}
                status_id = status_obj.get("id", 1)
            else:
                break

        # Decode base64 outputs
        raw_stdout = decode_b64(data.get("stdout"))
        raw_stderr = decode_b64(data.get("stderr"))
        raw_compile = decode_b64(data.get("compile_output"))
        raw_message = decode_b64(data.get("message"))

        # Parse timing and memory
        exec_time = None
        if data.get("time") is not None:
            try:
                exec_time = float(data["time"])
            except (ValueError, TypeError):
                pass

        memory_used = None
        if data.get("memory") is not None:
            try:
                memory_used = int(data["memory"])
            except (ValueError, TypeError):
                pass

        # Parse Judge0 status description
        status_desc = status_obj.get("description", "Unknown")
        
        # Normalize status to standard categories
        if status_id == 3:
            normalized_status = "Accepted"
        elif status_id == 4:
            normalized_status = "Wrong Answer"
        elif status_id == 5:
            normalized_status = "Time Limit Exceeded"
        elif status_id == 6:
            normalized_status = "Compilation Error"
        elif status_id in (7, 8, 9, 10, 11, 12):
            normalized_status = f"Runtime Error ({status_desc})"
        elif status_id in (1, 2):
            normalized_status = "Time Limit Exceeded"
            raw_message = "Execution timed out while waiting in provider queue."
        else:
            normalized_status = status_desc

        return ExecuteResponse(
            stdout=raw_stdout,
            stderr=raw_stderr,
            compile_output=raw_compile,
            status=normalized_status,
            execution_time=exec_time,
            memory_used=memory_used,
            message=raw_message or status_desc
        )

    except httpx.TimeoutException:
        return ExecuteResponse(
            status="Time Limit Exceeded",
            message=f"Execution request timed out after {settings.JUDGE0_TIMEOUT_SECONDS}s."
        )
    except httpx.ConnectError:
        return ExecuteResponse(
            status="Unavailable",
            message=f"Failed to connect to Judge0 execution provider at {base_url}. Verify network connectivity."
        )
    except Exception:
        logger.exception("Unexpected error during code execution")
        return ExecuteResponse(
            status="Error",
            message="An unexpected error occurred while processing the execution request."
        )
    finally:
        if should_close_client and client is not None:
            await client.aclose()


async def evaluate_test_cases(
    language: str,
    source_code: str,
    test_cases: List[TestCaseItem],
    client: Optional[httpx.AsyncClient] = None
) -> BatchExecuteResponse:
    """
    Evaluates multiple test cases against untrusted source code.
    Runs each case, normalizes output, checks exact equality,
    and ensures compilation/runtime errors are never reported as passed.
    """
    results: List[TestCaseResult] = []
    should_close_client = False

    if client is None:
        client = httpx.AsyncClient(timeout=settings.JUDGE0_TIMEOUT_SECONDS)
        should_close_client = True

    try:
        passed_count = 0
        failed_count = 0
        error_count = 0

        # Execute test cases sequentially (to preserve provider limits and detect early compile error)
        for idx, case in enumerate(test_cases):
            req = ExecuteRequest(
                language=language,
                source_code=source_code,
                stdin=case.stdin
            )

            res = await execute_code(req, client=client)

            # Determine whether this case passed
            is_accepted = res.status == "Accepted"
            actual_out = res.stdout or ""
            is_match = False

            if is_accepted:
                is_match = compare_outputs(actual_out, case.expected_output)
                if is_match:
                    case_status = "Passed"
                    passed_count += 1
                else:
                    case_status = "Failed"
                    failed_count += 1
            else:
                # Any compilation, runtime, time limit, or provider error
                case_status = res.status
                error_count += 1

            results.append(
                TestCaseResult(
                    id=case.id,
                    name=case.name,
                    status=case_status,
                    passed=(is_accepted and is_match),
                    stdout=res.stdout,
                    stderr=res.stderr,
                    compile_output=res.compile_output,
                    expected_output=case.expected_output,
                    actual_output=actual_out,
                    execution_time=res.execution_time,
                    memory_used=res.memory_used,
                    message=res.message
                )
            )

            # If there is a compilation error on test case 1, all remaining test cases
            # will also fail to compile with identical error; fill them quickly.
            if res.status == "Compilation Error" and idx == 0 and len(test_cases) > 1:
                for rem_case in test_cases[1:]:
                    results.append(
                        TestCaseResult(
                            id=rem_case.id,
                            name=rem_case.name,
                            status="Compilation Error",
                            passed=False,
                            stdout=None,
                            stderr=None,
                            compile_output=res.compile_output,
                            expected_output=rem_case.expected_output,
                            actual_output="",
                            execution_time=None,
                            memory_used=None,
                            message=res.message
                        )
                    )
                    error_count += 1
                break

        total = len(test_cases)
        summary = {
            "total": total,
            "passed": passed_count,
            "failed": failed_count,
            "errors": error_count,
            "pass_rate": f"{passed_count}/{total} tests passed"
        }

        return BatchExecuteResponse(results=results, summary=summary)

    finally:
        if should_close_client and client is not None:
            await client.aclose()


async def check_judge0_languages(client: Optional[httpx.AsyncClient] = None) -> Dict[str, Any]:
    """
    Checks the configured Judge0 instance's available languages.
    Caches results for 5 minutes.
    """
    now = time.time()
    if _LANGUAGES_CACHE["data"] is not None and (now - _LANGUAGES_CACHE["timestamp"]) < CACHE_TTL_SECONDS:
        return _LANGUAGES_CACHE["data"]

    configured = is_provider_configured()
    if not configured:
        return {
            "provider_configured": False,
            "message": "Judge0 execution provider is not configured. Configure JUDGE0_URL (and JUDGE0_API_KEY) in backend/.env.",
            "languages": [
                {
                    "id": key,
                    "label": LANGUAGE_NAMES.get(key, key.capitalize()),
                    "judge0_id": val,
                    "verified_available": False
                }
                for key, val in LANGUAGE_MAPPINGS.items()
                if key not in ("py", "js", "ts", "c++")
            ]
        }

    base_url = settings.JUDGE0_URL.rstrip("/")
    languages_url = f"{base_url}/languages"
    headers = get_judge0_headers()

    should_close_client = False
    if client is None:
        client = httpx.AsyncClient(timeout=8.0)
        should_close_client = True

    try:
        resp = await client.get(languages_url, headers=headers)
        if resp.status_code == 200:
            provider_langs = resp.json()
            available_ids = {item["id"] for item in provider_langs if "id" in item}

            languages_info = []
            for key, val in LANGUAGE_MAPPINGS.items():
                if key in ("py", "js", "ts", "c++"):
                    continue
                languages_info.append({
                    "id": key,
                    "label": LANGUAGE_NAMES.get(key, key.capitalize()),
                    "judge0_id": val,
                    "verified_available": val in available_ids
                })

            result = {
                "provider_configured": True,
                "message": "Connected to Judge0 language runtime provider.",
                "languages": languages_info
            }
            _LANGUAGES_CACHE["timestamp"] = now
            _LANGUAGES_CACHE["data"] = result
            return result
        else:
            return {
                "provider_configured": True,
                "message": f"Judge0 returned status {resp.status_code} when querying languages.",
                "languages": [
                    {
                        "id": key,
                        "label": LANGUAGE_NAMES.get(key, key.capitalize()),
                        "judge0_id": val,
                        "verified_available": True
                    }
                    for key, val in LANGUAGE_MAPPINGS.items()
                    if key not in ("py", "js", "ts", "c++")
                ]
            }
    except Exception as e:
        logger.warning(f"Failed to query Judge0 /languages endpoint: {e}")
        return {
            "provider_configured": True,
            "message": f"Could not reach Judge0 /languages endpoint: {str(e)}",
            "languages": [
                {
                    "id": key,
                    "label": LANGUAGE_NAMES.get(key, key.capitalize()),
                    "judge0_id": val,
                    "verified_available": False
                }
                for key, val in LANGUAGE_MAPPINGS.items()
                if key not in ("py", "js", "ts", "c++")
            ]
        }
    finally:
        if should_close_client and client is not None:
            await client.aclose()
