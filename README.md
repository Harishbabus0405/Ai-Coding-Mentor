# AI Coding Mentor — Full-Stack Platform & Deployment Guide

An enterprise-ready AI-powered coding interview preparation platform where developers can write code in Monaco Editor, execute untrusted programs in an isolated sandbox, evaluate multiple test cases, run a 5-agent LangGraph code analysis, practice interactive **Technical Mock Interviews** with an adaptive AI Interview Coach, and securely authenticate to persist and restore coding sessions and interview history in MySQL.

> 📖 **Interview & Demonstration Resources**:
> - [5–7 Minute Technical Demonstration Script](docs/demo-script.md)
> - [Technical Interview Preparation Guide & 20 Model Q&A](docs/interview-preparation.md)

---

## 📸 Application Showcase

| Coding Workspace & Test Runner | 5-Agent Multi-Agent Code Analysis |
| :---: | :---: |
| ![Coding Workspace with Monaco Editor and Test Runner](docs/screenshots/coding-workspace.png) | ![5-Agent LangGraph AI Analysis Report](docs/screenshots/ai-analysis.png) |
| *Monaco Editor with syntax highlighting, custom stdin, and multi-test case runner* | *Multi-agent findings: Code Review, Test Analysis, Optimization, and Complexity* |

| AI Interview Coach | History & Scorecard Review |
| :---: | :---: |
| ![AI Interview Coach Active Session](docs/screenshots/interview-coach.png) | ![Saved Code Sessions and Interview History](docs/screenshots/history-scorecards.png) |
| *Adaptive interview question generation with private rubrics and score evaluations* | *Persistent session library with 1-click restore to editor and interview scorecard drilldowns* |

> *Note: Store genuine screenshot image captures in the `docs/screenshots/` folder matching the referenced paths above.*

---

## 🛠️ Architecture & Technology Stack

```
+---------------------------------------------------------------------------------+
|                                 USER BROWSER                                    |
|  React 19 + TypeScript + Vite | Monaco Editor | Dark Mode Emerald UI            |
+---------------------------------------------------------------------------------+
           |                                                      ^
           | REST (HTTP/JSON + HttpOnly Cookies)                  |
           v                                                      |
+---------------------------------------------------------------------------------+
|                          FASTAPI BACKEND (Python 3.12)                          |
|  - Auth & Security: JWT, Argon2id, HttpOnly Cookies, Strict Ownership Checks     |
|  - API Routers: /api/auth, /api/execute, /api/analyze, /api/interview, /api/history |
|  - Health & Diagnostics: /api/health (DB, Groq, Judge0 probe)                   |
+---------------------------------------------------------------------------------+
      |                           |                               |
      v                           v                               v
+------------------+    +--------------------+          +---------------------+
|      MYSQL       |    |     GROQ CLOUD     |          |   JUDGE0 SANDBOX    |
|   Database 8.0   |    |    (LLM Inference) |          | (Isolated Execution)|
|  - Users         |    | - GPT-OSS 120B /   |          | - Linux cgroups/ns  |
|  - Code Sessions |    |   Llama 3.3 70B    |          | - CPU/Mem/Time Caps |
|  - Interviews    |    | - LangGraph DAG    |          | - Never in FastAPI! |
+------------------+    +--------------------+          +---------------------+
```

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Frontend** | React 19 + TypeScript + Vite | Developer-tool aesthetic, dark theme with emerald accents, and strongly typed components |
| **Authentication (Client)** | Context API + HttpOnly Cookies | Zero token exposure in `localStorage`; automatic cookie credential transmission with Bearer fallback |
| **Authentication (Server)** | JWT + Argon2id Hashing | RFC 7519 JSON Web Tokens, `argon2-cffi` memory-hard password hashing, password strength validation |
| **Code Editor** | Monaco Editor (`@monaco-editor/react`) | Multi-language syntax highlighting, minimap, auto-indent & VS Code dark theme |
| **Execution Runner** | Judge0 API Sandbox | Real execution engine running untrusted code with CPU, wall-clock, memory and output limits |
| **AI Inference** | Groq Cloud API | Ultra-low-latency LLM inference using models like `openai/gpt-oss-120b` or `llama-3.3-70b-versatile` |
| **AI Orchestration** | LangGraph + LangChain Core | Cyclic/acyclic stateful multi-agent DAG workflow with typed state and conditional routing |
| **Styling** | Tailwind CSS v3 | Curated dark mode theme with emerald green accents |
| **Backend** | Python 3.12 + FastAPI | Asynchronous REST API with Pydantic v2 schemas and OpenAPI Swagger documentation |
| **Database & ORM** | SQLAlchemy 2.0 + PyMySQL | Relational persistence for users, code sessions, interview sessions, questions, answers, and evaluations |
| **Migrations** | Versioned SQL Scripts & Python Runner | `001_create_interview_tables.sql`, `002_create_users_and_code_sessions.sql`, and `backend/migrations/migrate.py` |

---

## 📁 Repository Folder Structure

```
AI Coding Mentor/
├── backend/
│   ├── app/
│   │   ├── api/                  # FastAPI REST Route Handlers
│   │   │   ├── analyze.py        # Multi-agent AI code analysis
│   │   │   ├── auth.py           # Registration, login, current user, logout
│   │   │   ├── deps.py           # Dependency injection & JWT auth guards
│   │   │   ├── execute.py        # Code execution & test case runner
│   │   │   ├── health.py         # System health & dependency probes
│   │   │   ├── history.py        # Code sessions and interview scorecards
│   │   │   └── interview.py      # AI Mock Interview Coach sessions
│   │   ├── core/                 # Core Configuration & Security
│   │   │   ├── config.py         # Pydantic BaseSettings from .env
│   │   │   └── security.py       # Argon2id hashing & JWT token issuance
│   │   ├── db/                   # Database Layer
│   │   │   ├── database.py       # SQLAlchemy engine & session maker
│   │   │   └── models.py         # Declarative models (Users, Sessions, Interviews)
│   │   └── services/             # Business Logic & External Integrations
│   │       ├── analysis_agents.py    # 5 specialized agent implementations
│   │       ├── analysis_models.py    # Pydantic schemas for analysis results
│   │       ├── analysis_workflow.py  # LangGraph DAG compilation & dispatch
│   │       ├── execution_models.py   # Schemas for Judge0 requests/responses
│   │       ├── execution_service.py  # Judge0 HTTP client (never executes locally!)
│   │       ├── groq_service.py       # Groq API client with structured outputs
│   │       ├── history_models.py     # Code & interview history response schemas
│   │       ├── history_service.py    # Ownership-verified persistence operations
│   │       ├── interview_models.py   # Interview session request/response schemas
│   │       └── interview_service.py  # Interview generation, rubric evaluation, reporting
│   ├── migrations/               # Database Migrations
│   │   ├── 001_create_interview_tables.sql
│   │   ├── 002_create_users_and_code_sessions.sql
│   │   └── migrate.py            # Automated schema provisioning & verification
│   ├── tests/                    # Comprehensive Automated Test Suites
│   │   ├── test_analysis.py      # Multi-agent LangGraph workflow tests
│   │   ├── test_auth.py          # Registration, login, Argon2id, JWT tests
│   │   ├── test_e2e_full_journey.py # 18-step full user journey verification
│   │   ├── test_execution.py     # Judge0 code execution & test runner tests
│   │   ├── test_health.py        # Health probe tests
│   │   ├── test_history.py       # Session persistence & ownership tests
│   │   └── test_interview.py     # AI Interview Coach generation & scoring tests
│   ├── .env.example              # Template for backend environment variables
│   ├── requirements.txt          # Python dependencies
│   └── venv/                     # Python 3.12 virtual environment
├── docs/                         # Architecture, Interview & Demo Documentation
│   ├── demo-script.md            # 5-7 minute demonstration script
│   ├── interview-preparation.md  # System architecture & 20 technical interview Q&A
│   └── screenshots/              # Application UI screenshot assets
├── frontend/
│   ├── src/
│   │   ├── components/           # Reusable UI Components
│   │   │   ├── auth/             # AuthModal with sign-in and register tabs
│   │   │   ├── history/          # ScorecardModal and DeleteConfirmationModal
│   │   │   ├── layout/           # TopNavbar with user profile and health pill
│   │   │   ├── workspace/        # Monaco Editor, Console, Test Cases, AI Tabs
│   │   │   └── interview/        # Active interview session and report cards
│   │   ├── context/              # React Context Providers (AuthContext)
│   │   ├── pages/                # Top-level route pages (Workspace, History)
│   │   └── types/                # Strongly-typed TypeScript interfaces
│   ├── tests/                    # Frontend tests (output comparison normalization)
│   └── package.json              # Frontend scripts & Vite/React dependencies
├── package.json                  # Root convenience scripts (test:all, dev, db:migrate)
└── README.md                     # Platform documentation
```

---

## 🔐 Security & Threat Model

The application strictly implements defense-in-depth principles:

```mermaid
sequenceDiagram
    autonumber
    actor Candidate as Candidate Browser
    participant API as FastAPI Backend (/api/auth)
    participant Auth as Security Layer (Argon2 / JWT)
    participant DB as MySQL Database

    Note over Candidate,API: User Registration
    Candidate->>API: POST /api/auth/register (Email, Password, Display Name)
    API->>Auth: Validate password strength & normalize email
    API->>Auth: Hash password with Argon2id (memory-hard)
    API->>DB: Check email uniqueness & persist UserModel
    API->>Auth: Generate signed JWT access token
    API-->>Candidate: Set HttpOnly Cookie ("access_token") + JSON Profile

    Note over Candidate,API: User Login
    Candidate->>API: POST /api/auth/login (Email, Password)
    API->>DB: Query UserModel by normalized email
    API->>Auth: Verify password against Argon2id hash (constant-time)
    API->>Auth: Generate signed JWT access token
    API-->>Candidate: Set HttpOnly Cookie ("access_token") + JSON Profile

    Note over Candidate,API: Protected Request & Ownership Enforcement
    Candidate->>API: GET /api/history/code/{session_id} (Sends Cookie automatically)
    API->>Auth: Decode & verify JWT signature, expiration, and user claim
    API->>DB: Query CodeSessionModel by session_id
    alt User owns session
        API-->>Candidate: Full session detail & AI analysis
    else Another user's session
        API-->>Candidate: 403 Forbidden (Ownership protection)
    end
```

### Security Measures Implemented
1. **Zero Execution Inside FastAPI Process**: Untrusted code submitted by users is **never** executed using Python `exec`, `eval`, or subprocess inside the backend. Code is dispatched over HTTP to Judge0 sandbox containers running under Linux cgroups/namespaces with wall-clock, CPU, and memory limits.
2. **HttpOnly Cookie Authentication**: Tokens are stored exclusively in **HttpOnly, SameSite=Lax** cookies, eliminating browser XSS token theft vectors.
3. **Argon2id Password Hashing**: Utilizes memory-hard Argon2id (`time_cost=2`, `memory_cost=19456`, `parallelism=1`) via `argon2-cffi` to resist GPU and ASIC brute-force attacks.
4. **Password Strength Validation**: Enforces minimum 8 characters, at least one uppercase letter (A-Z), at least one lowercase letter (a-z), and at least one digit or special character.
5. **Generic Authentication Failures**: Login errors return a uniform HTTP 401 response (`"Invalid email or password."`) to prevent user enumeration attacks.
6. **Strict Ownership Enforcement**: Candidate identity is extracted directly from the verified JWT claim. The backend asserts `record.user_id == current_user.id` on all read, update, and delete operations, returning HTTP 403 if unauthorized.
7. **SQL Parameterization**: All queries use SQLAlchemy ORM parameterized statements, preventing SQL injection vulnerabilities.
8. **No Secret Leaks**: Groq API keys, Judge0 tokens, and database passwords exist solely in backend environment variables and are never transmitted to the browser or leaked in client responses.

---

## 🗄️ Database Models & Migrations

### Applying Migrations

#### Option A: Automated Python Migration Runner (Recommended)
```powershell
npm.cmd run db:migrate
# Or directly:
& .\backend\venv\Scripts\python.exe backend\migrations\migrate.py
```

#### Option B: Direct MySQL CLI
```powershell
# 1. Initialize interview schema
Get-Content backend\migrations\001_create_interview_tables.sql | mysql -u root -p ai_coding_mentor

# 2. Add users, code sessions, and user_id foreign keys
Get-Content backend\migrations\002_create_users_and_code_sessions.sql | mysql -u root -p ai_coding_mentor
```

> **Zero-Friction Fallback**: If no local MySQL instance is reachable, the backend automatically falls back to an SQLite database (`ai_coding_mentor.db`), automatically initializing all tables so development and testing proceed smoothly.

---

## ⚙️ Environment Variables

Configure backend settings in `backend/.env` (see `backend/.env.example`):

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `mysql+pymysql://root:password@localhost:3306/ai_coding_mentor` | MySQL connection string |
| `JWT_SECRET` | `replace_with_a_secure_random_secret_key_at_least_32_characters` | Secret key used for signing authentication JWT tokens |
| `JWT_ALGORITHM` | `HS256` | JWT cryptographic signature algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` (24 hours) | Token expiration duration |
| `AUTH_COOKIE_NAME` | `access_token` | Name of the HttpOnly session cookie |
| `AUTH_COOKIE_SECURE` | `False` (`True` in production HTTPS) | Restricts cookies to HTTPS connections |
| `AUTH_COOKIE_SAMESITE` | `lax` | Cross-site request cookie policy |
| `GROQ_API_KEY` | `""` | Groq Cloud API Key for AI inference |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | LLM model for analysis and interview coaching |
| `JUDGE0_URL` | `https://judge0-ce.p.rapidapi.com` | Judge0 execution service endpoint |
| `JUDGE0_API_KEY` | `""` | RapidAPI key or Judge0 authentication token |
| `JUDGE0_API_HOST` | `judge0-ce.p.rapidapi.com` | RapidAPI Host header if using RapidAPI |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Allowed frontend origins for CORS |

---

## 🚀 Local Development Commands (Windows PowerShell)

### Run Backend Development Server
```powershell
npm.cmd run dev:backend
# Or:
& .\backend\venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --reload --port 8000 --host 127.0.0.1
```

### Run Frontend Development Server
```powershell
npm.cmd run dev:frontend
# Or:
npm.cmd --prefix frontend run dev
```

### Build Frontend for Production
```powershell
npm.cmd run build:frontend
# Or:
npm.cmd --prefix frontend run build
```

---

## 🧪 Automated Testing (63 Tests)

Run the full automated test suite (backend unit & integration tests, E2E full user journey, and frontend unit tests):

```powershell
npm.cmd run test:all
```

### Individual Test Suites:
```powershell
# 1. 18-Step Full End-to-End User Journey (1 test, 18 validated steps)
npm.cmd run test:e2e

# 2. Authentication & Password Security Suite (9 tests)
npm.cmd run test:auth

# 3. Code & Interview History Persistence Suite (7 tests)
npm.cmd run test:history

# 4. Real Execution Engine Suite (14 tests)
npm.cmd run test:execution

# 5. Multi-Agent AI Analysis Suite (10 tests)
npm.cmd run test:analysis

# 6. AI Interview Coach Suite (15 tests)
npm.cmd run test:interview

# 7. Frontend Output Comparison & Normalization Tests (5 tests)
npm.cmd run test:frontend
```

---

## 🚢 Production Deployment Guide

### 1. Frontend Deployment (Vercel / Netlify / Cloudflare Pages / Nginx)
- **Build**:
  ```bash
  cd frontend
  npm install
  npm run build
  ```
- **Output**: Static assets are emitted to `frontend/dist/`.
- **Environment**: Set `VITE_API_URL` to your production backend URL (e.g. `https://api.yourdomain.com`).
- **Nginx Config Sample**:
  ```nginx
  server {
      listen 443 ssl http2;
      server_name mentor.yourdomain.com;
      root /var/www/ai-coding-mentor/frontend/dist;
      index index.html;

      location / {
          try_files $uri $uri/ /index.html;
      }
  }
  ```

### 2. Backend Deployment (Docker / VPS / Render / Railway)
- **Production Server Command**:
  ```bash
  uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
  ```
- **Environment Variables**:
  - `ENVIRONMENT=production`
  - `AUTH_COOKIE_SECURE=True` (Enforces HTTPS-only cookies)
  - `AUTH_COOKIE_SAMESITE=none` (if frontend and backend reside on different domains) or `lax` (if on same root domain)
  - `JWT_SECRET=<32+ character cryptographically random string>`
  - `CORS_ORIGINS=https://mentor.yourdomain.com`
- **Reverse Proxy (Nginx with SSL Termination)**:
  ```nginx
  server {
      listen 443 ssl http2;
      server_name api.yourdomain.com;

      location / {
          proxy_pass http://127.0.0.1:8000;
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
      }
  }
  ```

### 3. Database Deployment (MySQL 8.0+)
- Ensure MySQL 8.0+ is configured with character set `utf8mb4` and collation `utf8mb4_unicode_ci`.
- Provision database user with appropriate privileges:
  ```sql
  CREATE DATABASE ai_coding_mentor CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER 'mentor_app'@'%' IDENTIFIED BY 'StrongGeneratedPassword';
  GRANT ALL PRIVILEGES ON ai_coding_mentor.* TO 'mentor_app'@'%';
  FLUSH PRIVILEGES;
  ```
- Run migrations:
  ```bash
  python backend/migrations/migrate.py
  ```

### 4. Code Execution Sandbox (Judge0)
- **Self-Hosted Judge0 (Recommended for high volume)**:
  Deploy Judge0 via Docker Compose on an isolated worker VM with Linux cgroups v2 enabled:
  ```bash
  # In Judge0 docker-compose directory:
  docker-compose up -d
  ```
  Set backend `.env`:
  `JUDGE0_URL=http://internal-judge0-host:2358`
- **Managed RapidAPI Judge0**:
  Subscribe to Judge0 CE on RapidAPI and configure `JUDGE0_API_KEY` and `JUDGE0_API_HOST`.

### 5. Health Check Monitoring
Configure uptime monitoring tools (e.g. Datadog, UptimeKuma, BetterStack) to probe `GET /api/health`. The response returns HTTP 200 with JSON payload checking:
- `checks.api`: `"ok"`
- `checks.database_status`: `"connected (mysql)"`
- `checks.groq_configured`: `true`
- `checks.judge0_configured`: `true`

---

## ⚠️ Known Limitations

1. **AI Output Non-Determinism**: AI-generated code reviews, optimizations, and complexity analyses are provided for educational coaching purposes and should not be treated as formally proven mathematical verifications.
2. **Execution Provider Availability**: If Judge0 API rate limits are exceeded or unconfigured, code execution will fail cleanly with an informative user-facing error message rather than silently fabricating output.
3. **Session Rate Limiting**: Groq API calls are subject to organization rate limits (requests per minute and tokens per minute). Exponential backoff and retry handling are implemented in `app/services/groq_service.py`.
