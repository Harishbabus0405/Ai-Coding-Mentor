# AI Coding Mentor — Technical Interview Preparation & Architecture Deep-Dive

This document prepares software engineers and candidates to answer technical and architectural questions regarding the design, implementation, security, and scalability of the **AI Coding Mentor** platform.

---

## 📌 1. Project Overview & Elevator Pitch

> *"AI Coding Mentor is an enterprise-grade developer preparation platform that bridges the gap between competitive programming editors and technical interview practice. Candidates write code across 6 languages in Monaco Editor, execute programs in an isolated Judge0 sandbox, evaluate multiple test cases, receive multi-agent code analysis orchestrated via LangGraph on Groq Cloud, and practice dynamic technical interviews with an AI Interview Coach that evaluates answers against private rubrics and dynamically adapts follow-up questions."*

---

## 🏗️ 2. High-Level Architecture & Request Lifecycle

```
[Candidate Browser (React 19 + TypeScript)]
         |
         | HTTP / JSON (HttpOnly Cookies)
         v
[FastAPI Asynchronous Gateway (Uvicorn / Port 8000)]
         |
         +---> [Authentication Layer] ---> Argon2id Password Hashing + JWT
         |
         +---> [Code Execution Engine] --> HTTP REST to Isolated Judge0 Sandbox
         |                                 (Linux cgroups / Namespaces)
         |
         +---> [Multi-Agent Orchestrator] -> LangGraph StateGraph DAG
         |                                   (5 Specialized Agents over Groq API)
         |
         +---> [AI Interview Coach] ------> Dynamic Code-Tailored Generation
         |                                   Private Rubrics & Follow-up Hints
         |
         +---> [Relational Persistence] --> SQLAlchemy 2.0 ORM -> MySQL 8.0
                                             (Zero-friction SQLite Fallback)
```

### Complete Request Flow:
1. **Candidate Action**: User writes code in Monaco Editor and clicks **AI Analysis** or **Run Code**.
2. **Gateway & Auth Validation**: FastAPI validates request bodies via Pydantic v2 schemas and extracts the authenticated candidate's identity from the signed JWT inside the `HttpOnly` cookie.
3. **Sandbox Execution**: Code is dispatched to Judge0 via HTTP client (`execution_service.py`). The untrusted code is compiled and run in a resource-bounded sandbox (5.0s CPU time limit, 128MB memory limit). Results (stdout, stderr, compile errors, runtime metrics) return to FastAPI.
4. **LangGraph State Initialization**: `analysis_workflow.py` initializes a typed `AnalysisState` dict containing source code, language, and real execution telemetry.
5. **Multi-Agent DAG Execution**: Nodes execute in structured sequence:
   - `code_review_node` & `test_analysis_node` analyze code quality and test failures.
   - `optimization_node` drafts an optimal algorithmic approach.
   - `complexity_node` calculates time and space complexity with formal justifications.
   - `mentor_summary_node` compiles an educational report.
6. **Persistence**: The completed analysis and run metrics can be snapshotted to MySQL via `POST /api/history/code`.

---

## 💡 3. Technology Stack Decisions & Justifications

| Technology | Why It Was Chosen Over Alternatives |
| :--- | :--- |
| **Groq Cloud API** | Ultra-low inference latency (~200–500 tokens/sec via LPU hardware). Traditional LLM APIs introduce 5–15 second latencies across 5 sequential agent calls, creating unacceptable UX. Groq enables real-time multi-agent workflows in under 2 seconds. |
| **LangGraph** | Enables stateful, typed, multi-agent DAGs with checkpointing and error fallbacks. Traditional LangChain chains are rigid and lack fine-grained node-level recovery when an individual agent encounters JSON parse issues or rate limits. |
| **FastAPI** | High-performance asynchronous Python framework with native Pydantic v2 validation and automatic OpenAPI Swagger generation. Perfect for coordinating concurrent asynchronous I/O across Judge0 and Groq. |
| **MySQL 8.0** | ACID-compliant relational storage ensuring strict referential integrity for users, code sessions, interview questions, answers, and rubric evaluations. Cascading foreign keys (`ON DELETE CASCADE`) prevent orphaned child records. |
| **Judge0 API** | Isolated containerized execution sandbox implementing Linux namespaces, cgroups v2, and seccomp filtering. Executing untrusted user-submitted code inside the web server process (via Python `eval` or `exec`) is an extreme Remote Code Execution (RCE) vulnerability. |
| **React 19 + Vite** | Instant HMR development, component reusability, modular CSS with Tailwind, and fast production builds (~1.2s build time). |

---

## 🤖 4. Agentic Workflow & Multi-Agent Coordination

### The 5-Agent Architecture:
Rather than relying on a single monolithic LLM prompt (which suffers from hallucinations, formatting degradation, and context drift), the system delegates tasks across 5 specialized agents:

1. **Code Review Agent** ([`analysis_agents.py`](file:///c:/Users/Harish/Desktop/Harish%20Project/AI%20Coding%20Mentor/backend/app/services/analysis_agents.py)): Focuses strictly on code syntax, edge-case vulnerability, null-safety, and best practices.
2. **Test Analysis Agent**: Receives real test case outputs (stdout, stderr, exit codes). Explains *why* test cases failed without hallucinating fictional test runs.
3. **Optimization Agent**: Determines if an algorithmic optimization is warranted. If so, provides a completely separate, clean alternative implementation rather than modifying the user's code in place.
4. **Complexity Analysis Agent**: Inspects loop bounds, recursive call trees, and auxiliary data structures to output formal Big-O time and space notations with mathematical justifications.
5. **Mentor Summary Agent**: Synthesizes output from the prior 4 agents into actionable, encouraging interview coaching takeaways.

### Resilience & Error Handling:
- Each agent call uses Pydantic structured output models (`call_groq_structured`).
- If an agent fails due to transient JSON malformation, exponential backoff retries (up to 2 retries) are triggered automatically.
- If Groq credentials are unconfigured or unavailable, the workflow returns graceful degraded warnings rather than throwing unhandled HTTP 500 exceptions.

---

## 🛡️ 5. Security & Threat Modeling

1. **Remote Code Execution (RCE) Prevention**: Untrusted code is **never** executed inside the FastAPI container. It is dispatched to Judge0 sandboxes running under strict CPU time limits (5.0s), memory limits (128MB), and network isolation.
2. **Authentication Security**:
   - Password hashing uses **Argon2id** (`argon2-cffi`), a memory-hard algorithm resistant to GPU and ASIC cracking.
   - JWT tokens are stored in **HttpOnly, SameSite=Lax** cookies, rendering tokens inaccessible to JavaScript `document.cookie` and eliminating XSS token exfiltration.
   - In production HTTPS, `AUTH_COOKIE_SECURE=True` restricts cookie transmission to TLS-encrypted connections.
3. **Authorization & Ownership Protection**:
   - Every history query asserts `record.user_id == current_user.id`.
   - Accessing another candidate's session ID returns HTTP 403 Forbidden.
4. **Input Sanitization & Length Limits**:
   - `MAX_SOURCE_CODE_LENGTH`: 64 KB (65,536 characters).
   - `MAX_STDIN_LENGTH`: 32 KB (32,768 characters).
5. **Zero Secret Leakage**: API keys and database credentials exist solely in server environment variables and are never transmitted to client bundles or error logs.

---

## ❓ 6. 20 Technical Interview Questions & Model Answers

### Architecture & System Design

#### Q1: Why did you separate code execution into an external service (Judge0) instead of running it locally using Python's `subprocess` or `exec()`?
**Answer**:
Executing untrusted user-submitted code in the application server process or host OS is an immediate Remote Code Execution (RCE) vulnerability. A user could submit code that reads server environment variables, destroys the filesystem (`os.system("rm -rf /")`), or spawns fork bombs. Judge0 isolates execution within dedicated Linux cgroups, namespaces, and chroot sandboxes with bounded memory, CPU time, and network access.

#### Q2: How does the LangGraph workflow differ from standard sequential chains in LangChain?
**Answer**:
Standard sequential chains pass string outputs linearly down a pipe without persistent shared state. LangGraph provides a stateful directed acyclic graph (DAG) backed by a typed dictionary (`AnalysisState`). Nodes can execute conditionally, access prior agent outputs, and recover gracefully if an individual node encounters an error, ensuring one failing agent does not crash the entire analysis pipeline.

#### Q3: Why did you choose HttpOnly cookies for JWT storage rather than browser localStorage?
**Answer**:
Tokens stored in `localStorage` are vulnerable to Cross-Site Scripting (XSS). If an attacker injects a malicious script via an NPM dependency or unsanitized input, they can read `localStorage.getItem("token")` and exfiltrate user sessions. Storing tokens in `HttpOnly` cookies ensures the browser transmits the token automatically on HTTP requests, while JavaScript APIs have zero access to the cookie value.

#### Q4: How does the application handle database portability between local development and production?
**Answer**:
In `backend/app/db/database.py`, the engine factory attempts to connect to the configured MySQL database with a 3-second connection timeout and `pool_pre_ping=True`. If MySQL is unreachable (e.g. during offline development or testing), it logs a warning and gracefully falls back to a local SQLite database (`ai_coding_mentor.db`), automatically initializing all tables. In production, setting `DATABASE_URL` connects directly to MySQL 8.0.

#### Q5: How is candidate data ownership enforced across history endpoints?
**Answer**:
In `history_service.py`, every query for code sessions or interview reports filters by both `id` and `user_id`. When retrieving by ID (`GET /api/history/code/{session_id}`), the backend first queries the session. If `session.user_id != current_user.id`, it raises an HTTP 403 Forbidden exception rather than leaking the foreign record.

---

### Code Execution & Test Evaluation

#### Q6: How does the test runner evaluate stdout when user code prints trailing whitespace or Windows CRLF line endings?
**Answer**:
The frontend and backend apply a deterministic output normalization policy. Strings are split into lines, trailing whitespace per line is stripped, and `\r\n` line breaks are normalized to `\n`. However, internal meaningful spaces (e.g. spaces separating array elements) are strictly preserved. This prevents valid submissions from failing due to minor platform line-ending differences.

#### Q7: What happens if user code enters an infinite loop during execution?
**Answer**:
The Judge0 execution request specifies a `cpu_time_limit` of 5.0 seconds and a wall-clock timeout of 15.0 seconds. When user code exceeds this threshold, the sandbox terminates the process and returns Judge0 Status ID 5 ("Time Limit Exceeded"). The backend maps this to a clean error status and displays the timeout message in the console without hanging the server.

#### Q8: What guarantees that restoring a saved code session does not accidentally execute old code?
**Answer**:
The restoration handler in `App.tsx` and `CodingWorkspacePage.tsx` updates React state (`setSelectedLanguage`, `setCodePerLanguage`, and `setAnalysisResult`). It populates the Monaco Editor text model and displays the saved execution snapshot, but **never** triggers the `executeCode()` API call. Code execution only occurs when the user explicitly clicks the "Run Code" or "Run All Tests" button.

---

### AI Engineering & LLM Integration

#### Q9: How do you guarantee that LLM output adheres to your application's expected data format?
**Answer**:
We use Pydantic v2 schemas passed into Groq's structured output mode (`response_format={"type": "json_object"}`). When the JSON string returns, Pydantic parses and validates the fields (`model_validate_json`). If the response fails schema validation, the structured call catches the `ValidationError` and triggers a retry with exponential backoff.

#### Q10: How does the AI Interview Coach prevent candidates from cheating by inspecting the browser network tab?
**Answer**:
When an interview session is initiated (`POST /api/interview/start`), the backend LLM generates both question text and private rubrics (`expected_concepts` and `evaluation_criteria`). The backend stores the full schema in MySQL, but transforms the API response into `ClientInterviewQuestion`, stripping out all expected concepts and grading rubrics before sending the response to the browser.

#### Q11: How is the final interview score calculated? Does the LLM invent an arbitrary overall score?
**Answer**:
No. The final overall score is computed deterministically by the backend in `interview_service.py` by aggregating the exact numeric scores ($0.0 - 10.0$) stored in the `interview_answers` database table across all answered questions (`round(sum(scores) / len(scores), 1)`). The LLM is only responsible for evaluating individual answers against rubrics and synthesizing qualitative feedback.

#### Q12: How do you handle Groq API rate limits (HTTP 429) during peak usage?
**Answer**:
In `groq_service.py`, API calls are wrapped in an asynchronous retry loop with exponential backoff. If an HTTP 429 or transient 5xx error occurs, the service inspects the `Retry-After` header, waits with jitter, and retries up to `GROQ_MAX_RETRIES` times before raising a structured `GroqRateLimitError` that returns a user-friendly notification.

---

### Database, ORM & Concurrency

#### Q13: Why did you choose Argon2id over bcrypt for password hashing?
**Answer**:
Argon2id was the winner of the Password Hashing Competition (PHC). Unlike bcrypt (which is primarily CPU-bound and vulnerable to high-throughput GPU/ASIC cracking), Argon2id is memory-hard (`memory_cost=19456 KB`). This requires significant RAM per hash computation, making hardware brute-force attacks economically and computationally infeasible.

#### Q14: How are cascade deletions handled when a user account is deleted?
**Answer**:
In `models.py`, `CodeSessionModel` has `ondelete="CASCADE"`, meaning all code sessions belonging to a user are purged automatically by the database engine when the user record is removed. For `InterviewSessionModel`, foreign keys use `ondelete="SET NULL"`, preserving anonymized interview benchmark metrics while dissociating personal identity.

#### Q15: Why is SQLAlchemy's `pool_pre_ping=True` important in production?
**Answer**:
Cloud database providers (such as AWS RDS or Azure MySQL) routinely drop idle TCP connections after inactivity timeouts. Without `pool_pre_ping=True`, the application would attempt to reuse a stale socket from the connection pool, throwing an `OperationalError: MySQL server has gone away`. `pool_pre_ping` emits a lightweight `SELECT 1` ping before executing queries, transparently recycling dead connections.

---

### Frontend Engineering & State Management

#### Q16: Why did you choose Monaco Editor over lightweight alternatives like CodeMirror?
**Answer**:
Monaco Editor is the exact code editor that powers VS Code. It provides industry-standard syntax highlighting, auto-indentation, bracket matching, minimap navigation, and multi-cursor editing across all supported languages, giving candidates an authentic IDE experience identical to real technical screening environments.

#### Q17: How is code state preserved when a user switches programming languages in the editor?
**Answer**:
In `CodingWorkspacePage.tsx`, code is not stored in a single string state. Instead, state is maintained in a dictionary `codePerLanguage: Record<SupportedLanguageId, string>`. When the user toggles from Python to C++, the current Python buffer is saved in the map, and the C++ buffer is loaded into Monaco. When switching back, their exact Python edits are preserved.

#### Q18: How do you prevent layout shift and double scrollbars in the coding workspace?
**Answer**:
In `AppLayout.tsx`, the main content wrapper dynamically applies `overflow-hidden p-3 md:p-4` when `currentPage === 'workspace'`, allowing the workspace container to use `h-full` and fill the remaining viewport height. Content-heavy pages (Dashboard, History) retain `overflow-y-auto max-w-7xl mx-auto`. This prevents Monaco Editor and console panels from fighting with the browser window scrollbar.

---

### Testing & Scalability

#### Q19: How do automated backend tests run in CI/CD without relying on external Groq or Judge0 subscriptions?
**Answer**:
Routine unit and integration tests mock external HTTP boundaries using `unittest.mock.patch` (patching `groq_service.call_groq_structured` and `execution_service.execute_code`). This allows tests to run instantly, deterministically, and cost-free without internet access. Live tests (`smoke_test_groq_live.py` and `smoke_test_interview_live.py`) are maintained in separate standalone scripts that verify live credentials when explicitly triggered.

#### Q20: What are the current architectural bottlenecks and how would you scale the system to 100,000 active users?
**Answer**:
1. **Execution Bottleneck**: Self-host Judge0 on an auto-scaling Kubernetes cluster of worker nodes, placing an asynchronous task queue (e.g. Celery / Redis Streams) in front of execution requests so spike traffic queues gracefully.
2. **Database Reads**: Introduce Redis caching for language configurations and read-replicas for `GET /api/history` queries.
3. **LLM Concurrency**: Implement client-side streaming (Server-Sent Events) so candidates see incremental tokens as the AI evaluates answers, rather than waiting for complete JSON payloads.
