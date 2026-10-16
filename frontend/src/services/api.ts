import type { 
  HealthCheckResponse, 
  ExecutionRequest, 
  ExecutionResponse,
  BatchExecuteRequest,
  BatchExecuteResponse,
  AnalyzeRequest,
  AnalyzeResponse,
  StartInterviewRequest,
  StartInterviewResponse,
  SubmitAnswerRequest,
  EvaluationResult,
  InterviewReportResponse,
  InterviewSessionDetailResponse,
  InterviewStatusResponse,
  User,
  AuthSuccessResponse,
  SaveCodeSessionPayload,
  CodeSessionDetail,
  PaginatedCodeSessions,
  PaginatedInterviewSessions
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Checks the FastAPI backend health endpoint.
 * Works seamlessly with both Vite proxy (/api/health) and direct URL (http://localhost:8000/api/health).
 */
export async function checkBackendHealth(): Promise<{
  success: boolean;
  data?: HealthCheckResponse;
  error?: string;
  latencyMs?: number;
}> {
  const startTime = performance.now();
  
  const urlsToTry = [
    '/api/health',
    ...(API_BASE_URL ? [`${API_BASE_URL}/api/health`] : ['http://localhost:8000/api/health'])
  ];

  let lastError = 'Failed to connect to backend';

  for (const url of urlsToTry) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(3500)
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data: HealthCheckResponse = await response.json();
      const latencyMs = Math.round(performance.now() - startTime);

      return {
        success: true,
        data,
        latencyMs
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  const latencyMs = Math.round(performance.now() - startTime);
  return {
    success: false,
    error: lastError,
    latencyMs
  };
}

/**
 * Submits source code to the FastAPI backend for real sandbox execution via Judge0.
 * Never fabricates execution results.
 */
export async function executeCode(request: ExecutionRequest): Promise<ExecutionResponse> {
  const urlsToTry = [
    '/api/execute',
    ...(API_BASE_URL ? [`${API_BASE_URL}/api/execute`] : ['http://localhost:8000/api/execute'])
  ];

  let lastError = 'Execution service is unreachable.';

  for (const url of urlsToTry) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          language: request.language,
          source_code: request.source_code,
          stdin: request.stdin ?? ''
        }),
        signal: AbortSignal.timeout(20000)
      });

      if (response.status === 422) {
        const errorData = await response.json().catch(() => null);
        let errorMsg = 'Validation error occurred';
        if (errorData?.detail && Array.isArray(errorData.detail)) {
          errorMsg = errorData.detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ');
        } else if (typeof errorData?.detail === 'string') {
          errorMsg = errorData.detail;
        }

        return {
          status: 'Error',
          message: errorMsg,
          stderr: errorMsg,
          stdout: null,
          compile_output: null,
          execution_time: null,
          memory_used: null
        };
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMsg = errorData?.detail || `Execution failed with HTTP status ${response.status}`;
        return {
          status: 'Error',
          message: errorMsg,
          stderr: errorMsg,
          stdout: null,
          compile_output: null,
          execution_time: null,
          memory_used: null
        };
      }

      const data: ExecutionResponse = await response.json();
      return data;
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'TimeoutError';
      const errMessage = err instanceof Error ? err.message : String(err);
      if (isTimeout) {
        lastError = 'Request timed out after 20 seconds. Sandbox may be overloaded or unreachable.';
      } else {
        lastError = `Connection error: ${errMessage}. Ensure FastAPI backend server is running on port 8000.`;
      }
    }
  }

  return {
    status: 'Unavailable',
    message: lastError,
    stderr: lastError,
    stdout: null,
    compile_output: null,
    execution_time: null,
    memory_used: null
  };
}

/**
 * Evaluates multiple test cases in batch via backend API.
 */
export async function evaluateBatchTestCases(request: BatchExecuteRequest): Promise<BatchExecuteResponse> {
  const urlsToTry = [
    '/api/execute/testcases',
    ...(API_BASE_URL ? [`${API_BASE_URL}/api/execute/testcases`] : ['http://localhost:8000/api/execute/testcases'])
  ];

  let lastError = 'Execution service is unreachable.';

  for (const url of urlsToTry) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMsg = errorData?.detail || `Batch execution failed with HTTP status ${response.status}`;
        throw new Error(errorMsg);
      }

      const data: BatchExecuteResponse = await response.json();
      return data;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  throw new Error(lastError);
}

/**
 * Queries supported and verified languages from backend.
 */
export async function fetchSupportedLanguages(): Promise<{
  provider_configured: boolean;
  message?: string;
  languages: Array<{
    id: string;
    label: string;
    judge0_id: number;
    verified_available?: boolean;
  }>;
}> {
  const urlsToTry = [
    '/api/execute/languages',
    ...(API_BASE_URL ? [`${API_BASE_URL}/api/execute/languages`] : ['http://localhost:8000/api/execute/languages'])
  ];

  for (const url of urlsToTry) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        return await response.json();
      }
    } catch {
      // Fallback to next URL
    }
  }

  return {
    provider_configured: false,
    message: 'Could not connect to language verification endpoint.',
    languages: []
  };
}

/**
 * Submits source code and Phase 3 execution/test results to FastAPI backend
 * for multi-agent LangGraph analysis using Groq LLM inference.
 */
export async function analyzeCode(request: AnalyzeRequest): Promise<AnalyzeResponse> {
  const urlsToTry = [
    '/api/analyze',
    ...(API_BASE_URL ? [`${API_BASE_URL}/api/analyze`] : ['http://localhost:8000/api/analyze'])
  ];

  let lastError = 'Analysis service is unreachable.';

  for (const url of urlsToTry) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(60000)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        let errorMsg = `Analysis failed with HTTP status ${response.status}`;
        if (errorData?.detail) {
          if (Array.isArray(errorData.detail)) {
            errorMsg = errorData.detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ');
          } else if (typeof errorData.detail === 'string') {
            errorMsg = errorData.detail;
          }
        }
        throw new Error(errorMsg);
      }

      const data: AnalyzeResponse = await response.json();
      return data;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  throw new Error(lastError);
}

/**
 * Queries the readiness and registered agents for AI analysis.
 */
export async function fetchAnalysisStatus(): Promise<{
  provider: string;
  configured: boolean;
  model: string;
  workflow: string;
  agents: Array<{ id: string; name: string; focus: string }>;
  message: string;
}> {
  const urlsToTry = [
    '/api/analyze/status',
    ...(API_BASE_URL ? [`${API_BASE_URL}/api/analyze/status`] : ['http://localhost:8000/api/analyze/status'])
  ];

  for (const url of urlsToTry) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        return await response.json();
      }
    } catch {
      // Fallback
    }
  }

  return {
    provider: 'Groq API',
    configured: false,
    model: 'llama-3.3-70b-versatile',
    workflow: 'LangGraph Multi-Agent (5 Agents)',
    agents: [],
    message: 'Could not connect to AI analysis status endpoint.'
  };
}

// ==========================================
// Phase 5: AI Interview Coach Client Methods
// ==========================================

/**
 * Initializes a new interactive interview session based on submitted code.
 */
export async function startInterview(
  request: StartInterviewRequest
): Promise<StartInterviewResponse> {
  const urlsToTry = [
    '/api/interview/start',
    ...(API_BASE_URL ? [`${API_BASE_URL}/api/interview/start`] : ['http://localhost:8000/api/interview/start'])
  ];

  let lastError = 'Failed to initialize interview session.';

  for (const url of urlsToTry) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(45000)
      });

      if (response.ok) {
        return await response.json();
      }

      const errData = await response.json().catch(() => null);
      lastError = errData?.detail || `Server returned HTTP ${response.status}`;
      throw new Error(lastError);
    } catch (err: any) {
      if (err.name === 'TimeoutError') {
        lastError = 'Interview question generation timed out after 45 seconds.';
      } else if (err.message) {
        lastError = err.message;
      }
    }
  }

  throw new Error(lastError);
}

/**
 * Submits a candidate answer for structured evaluation against hidden rubric.
 */
export async function submitInterviewAnswer(
  request: SubmitAnswerRequest
): Promise<EvaluationResult> {
  const urlsToTry = [
    '/api/interview/answer',
    ...(API_BASE_URL ? [`${API_BASE_URL}/api/interview/answer`] : ['http://localhost:8000/api/interview/answer'])
  ];

  let lastError = 'Failed to evaluate interview answer.';

  for (const url of urlsToTry) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(45000)
      });

      if (response.ok) {
        return await response.json();
      }

      const errData = await response.json().catch(() => null);
      lastError = errData?.detail || `Evaluation failed with HTTP ${response.status}`;
      throw new Error(lastError);
    } catch (err: any) {
      if (err.name === 'TimeoutError') {
        lastError = 'Answer evaluation timed out after 45 seconds.';
      } else if (err.message) {
        lastError = err.message;
      }
    }
  }

  throw new Error(lastError);
}

/**
 * Retrieves the final performance report with deterministic scores and study topics.
 */
export async function fetchInterviewReport(
  sessionId: string
): Promise<InterviewReportResponse> {
  const urlsToTry = [
    `/api/interview/${encodeURIComponent(sessionId)}/report`,
    ...(API_BASE_URL 
      ? [`${API_BASE_URL}/api/interview/${encodeURIComponent(sessionId)}/report`] 
      : [`http://localhost:8000/api/interview/${encodeURIComponent(sessionId)}/report`])
  ];

  let lastError = 'Failed to fetch interview report.';

  for (const url of urlsToTry) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(30000)
      });

      if (response.ok) {
        return await response.json();
      }

      const errData = await response.json().catch(() => null);
      lastError = errData?.detail || `Failed to fetch report: HTTP ${response.status}`;
      throw new Error(lastError);
    } catch (err: any) {
      if (err.message) lastError = err.message;
    }
  }

  throw new Error(lastError);
}

/**
 * Retrieves the full session detail for resumption or active question tracking.
 */
export async function fetchInterviewSession(
  sessionId: string
): Promise<InterviewSessionDetailResponse> {
  const urlsToTry = [
    `/api/interview/${encodeURIComponent(sessionId)}`,
    ...(API_BASE_URL 
      ? [`${API_BASE_URL}/api/interview/${encodeURIComponent(sessionId)}`] 
      : [`http://localhost:8000/api/interview/${encodeURIComponent(sessionId)}`])
  ];

  let lastError = 'Failed to fetch interview session state.';

  for (const url of urlsToTry) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000)
      });

      if (response.ok) {
        return await response.json();
      }

      const errData = await response.json().catch(() => null);
      lastError = errData?.detail || `Failed with HTTP ${response.status}`;
      throw new Error(lastError);
    } catch (err: any) {
      if (err.message) lastError = err.message;
    }
  }

  throw new Error(lastError);
}

/**
 * Queries availability status of the AI Interview Coach.
 */
export async function fetchInterviewStatus(): Promise<InterviewStatusResponse> {
  const urlsToTry = [
    '/api/interview/status',
    ...(API_BASE_URL ? [`${API_BASE_URL}/api/interview/status`] : ['http://localhost:8000/api/interview/status'])
  ];

  for (const url of urlsToTry) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        return await response.json();
      }
    } catch {
      // Fallback
    }
  }

  return {
    status: 'Unavailable',
    groq_configured: false,
    model: 'llama-3.3-70b-versatile',
    message: 'Could not connect to AI Interview Coach status endpoint.'
  };
}

// =========================================================================
// Phase 6: Authentication & User Accounts API
// =========================================================================

/**
 * Registers a new candidate account.
 */
export async function registerUser(payload: {
  email: string;
  password: string;
  display_name?: string;
}): Promise<AuthSuccessResponse> {
  const url = `${API_BASE_URL}/api/auth/register`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || `Registration failed with HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Authenticates user credentials and receives HttpOnly session cookie.
 */
export async function loginUser(payload: {
  email: string;
  password: string;
}): Promise<AuthSuccessResponse> {
  const url = `${API_BASE_URL}/api/auth/login`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || `Login failed with HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Retrieves the currently logged-in candidate profile.
 * Returns null if unauthenticated or session has expired.
 */
export async function fetchCurrentUser(): Promise<User | null> {
  const url = `${API_BASE_URL}/api/auth/me`;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      credentials: 'include',
      signal: AbortSignal.timeout(6000),
    });

    if (response.status === 401 || response.status === 403) {
      return null;
    }

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch {
    return null;
  }
}

/**
 * Clears the HttpOnly authentication cookie on the backend.
 */
export async function logoutUser(): Promise<void> {
  const url = `${API_BASE_URL}/api/auth/logout`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      credentials: 'include',
      signal: AbortSignal.timeout(6000),
    });
  } catch {
    // Ignore network errors during logout
  }
}

// =========================================================================
// Phase 6: Code & Interview History Persistence API
// =========================================================================

/**
 * Persists active code, execution status, and AI analysis to MySQL.
 */
export async function saveCodeSession(
  payload: SaveCodeSessionPayload
): Promise<CodeSessionDetail> {
  const url = `${API_BASE_URL}/api/history/code`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || `Failed to save code session: HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Lists the authenticated user's saved code sessions with pagination & filters.
 */
export async function fetchCodeSessions(params?: {
  page?: number;
  limit?: number;
  language?: string;
  search?: string;
}): Promise<PaginatedCodeSessions> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', params.page.toString());
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.language) query.set('language', params.language);
  if (params?.search) query.set('search', params.search);

  const url = `${API_BASE_URL}/api/history/code?${query.toString()}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
    credentials: 'include',
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || `Failed to fetch code history: HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Retrieves the full detail of a saved code session for restoring or inspecting.
 */
export async function fetchCodeSessionDetail(
  sessionId: string
): Promise<CodeSessionDetail> {
  const url = `${API_BASE_URL}/api/history/code/${encodeURIComponent(sessionId)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
    credentials: 'include',
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || `Failed to fetch session detail: HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Deletes a saved code session owned by the candidate.
 */
export async function deleteCodeSession(sessionId: string): Promise<void> {
  const url = `${API_BASE_URL}/api/history/code/${encodeURIComponent(sessionId)}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: { 'Accept': 'application/json' },
    credentials: 'include',
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || `Failed to delete session: HTTP ${response.status}`);
  }
}

/**
 * Lists the authenticated user's interview history sessions.
 */
export async function fetchInterviewHistory(params?: {
  page?: number;
  limit?: number;
  difficulty?: string;
  topic?: string;
}): Promise<PaginatedInterviewSessions> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', params.page.toString());
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.difficulty) query.set('difficulty', params.difficulty);
  if (params?.topic) query.set('topic', params.topic);

  const url = `${API_BASE_URL}/api/history/interviews?${query.toString()}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
    credentials: 'include',
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || `Failed to fetch interview history: HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Retrieves full interview session detail including evaluations for review.
 */
export async function fetchInterviewHistoryDetail(
  sessionId: string
): Promise<any> {
  const url = `${API_BASE_URL}/api/history/interviews/${encodeURIComponent(sessionId)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
    credentials: 'include',
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || `Failed to fetch interview session detail: HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Deletes an interview history session owned by the candidate.
 */
export async function deleteInterviewHistorySession(
  sessionId: string
): Promise<void> {
  const url = `${API_BASE_URL}/api/history/interviews/${encodeURIComponent(sessionId)}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: { 'Accept': 'application/json' },
    credentials: 'include',
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || `Failed to delete interview session: HTTP ${response.status}`);
  }
}



