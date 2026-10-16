# AI Coding Mentor — 5–7 Minute Technical Demonstration Script

This script provides an exact, step-by-step guide for presenting **AI Coding Mentor** to technical recruiters, interviewers, or stakeholders. The presentation highlights real code execution in an isolated sandbox, a 5-agent LangGraph AI analysis flow, an interactive AI Interview Coach, and secure persistence with session restoration.

---

## ⏱️ Demonstration Timeline (Total: 6 Minutes)

| Time | Segment | Key Feature Demonstrated |
| :---: | :--- | :--- |
| **0:00 – 0:45** | 1. Introduction & Authentication | System overview, dark-mode UI, secure Argon2id + HttpOnly cookie login |
| **0:45 – 1:45** | 2. Code Execution & Standard Input | Monaco Editor, isolated execution via Judge0, live stdout/stderr console |
| **1:45 – 2:30** | 3. Multi-Test Case Evaluation | Test suite runner, edge-case failure, line-normalized output diffs |
| **2:30 – 3:45** | 4. 5-Agent LangGraph AI Analysis | Multi-agent DAG execution (Review, Optimization, Complexity, Mentor Tips) |
| **3:45 – 5:00** | 5. AI Technical Mock Interview | Code-tailored question generation, rubric scoring, adaptive follow-ups |
| **5:00 – 6:00** | 6. Session Persistence & History | Save code snapshot to MySQL, restore to editor without auto-run, review scorecards |

---

## ⚙️ Prerequisites & Environment Setup

Before starting the demonstration, verify that the backend and frontend servers are running:

1. **Backend Server** (Port 8000):
   ```powershell
   npm.cmd run dev:backend
   ```
2. **Frontend Server** (Port 5173):
   ```powershell
   npm.cmd run dev:frontend
   ```
3. **Required Configurations in `backend/.env`**:
   - `GROQ_API_KEY`: Configured with an active Groq API key (`gsk_...`).
   - `GROQ_MODEL`: `openai/gpt-oss-120b` (or `openai/gpt-oss-20b`).
   - `DATABASE_URL`: Connected to MySQL 8.0 (or local SQLite auto-fallback `ai_coding_mentor.db`).
   - `JUDGE0_URL`: Set to RapidAPI or self-hosted Judge0 instance.

---

## 🎬 Step-by-Step Demonstration Walkthrough

### Step 1: Secure Authentication & Dashboard (0:00 – 0:45)
1. **Navigate** to `http://localhost:5173`.
2. **Show the Top Navbar**: Point out the live backend health status badge (`/api/health`), showing active services: API, Database, and Groq status.
3. **Open Auth Modal**: Click **Sign In** in the top-right corner.
4. **Log In**:
   - Email: `demo@example.com`
   - Password: `Password123!`
   - *If registering for the first time*: Toggle to **Create Account**, enter `Demo Engineer`, `demo@example.com`, `Password123!`, and submit.
5. **Key Talking Point**:
   > *"Authentication uses memory-hard Argon2id password hashing and RFC 7519 JSON Web Tokens stored exclusively in secure, HttpOnly, SameSite cookies. No JWTs are stored in localStorage, preventing XSS token theft."*

---

### Step 2: Code Execution in Monaco Editor (0:45 – 1:45)
1. **Navigate** to the **Coding Workspace** via the sidebar.
2. **Language Selection**: Select **Python** from the language dropdown (Python, JavaScript, TypeScript, Java, C++, C# supported).
3. **Enter Code**: Paste a quadratic $O(N^2)$ solution for the classic Two-Sum problem:
   ```python
   import sys

   def two_sum(nums, target):
       for i in range(len(nums)):
           for j in range(i + 1, len(nums)):
               if nums[i] + nums[j] == target:
                   return [i, j]
       return []

   if __name__ == "__main__":
       line = sys.stdin.read().strip()
       if line:
           # Input format: target on line 1, array elements on line 2
           lines = line.split("\n")
           target = int(lines[0])
           nums = [int(x) for x in lines[1].split()]
           print(two_sum(nums, target))
   ```
4. **Supply Custom Stdin** in the **Standard Input** tab:
   ```text
   9
   2 7 11 15
   ```
5. **Click "Run Code"**:
   - The backend dispatches the code to the isolated Judge0 execution sandbox.
   - The **Console Output** tab renders `[0, 1]` with exact execution runtime and memory telemetry.
6. **Key Talking Point**:
   > *"Notice that untrusted user code is NEVER executed inside the FastAPI web server process. It is dispatched over HTTP to an isolated Judge0 sandbox bounded by CPU, memory, and wall-clock execution limits."*

---

### Step 3: Test Case Runner & Failure Inspection (1:45 – 2:30)
1. **Switch** to the **Test Cases** tab in the console panel.
2. **Review Configured Test Cases**:
   - **Test Case 1 (Standard)**:
     - Stdin: `9\n2 7 11 15`
     - Expected Output: `[0, 1]`
   - **Test Case 2 (Edge Case - Negative Numbers)**:
     - Stdin: `0\n-3 4 3 90`
     - Expected Output: `[0, 2]`
   - **Test Case 3 (Intentional Mismatch)**:
     - Stdin: `6\n3 2 4`
     - Expected Output: `[0, 1]` (Expected is intentionally wrong; real output is `[1, 2]`)
3. **Click "Run All Tests"**:
   - Test 1: Passed (Green checkmark)
   - Test 2: Passed (Green checkmark)
   - Test 3: Failed (Red badge)
4. **Inspect Failed Test Case**:
   - Click on **Test 3** to show side-by-side diff.
   - Point out actual output `[1, 2]` vs expected output `[0, 1]`.
5. **Key Talking Point**:
   > *"The platform normalizes trailing newlines and carriage returns (CRLF vs LF) to ensure accurate evaluation, while highlighting exact mismatch discrepancies."*

---

### Step 4: 5-Agent LangGraph AI Code Analysis (2:30 – 3:45)
1. **Click "AI Analysis"** in the top action bar.
2. **Observe Agent Execution**:
   - A pulsing badge indicates LangGraph multi-agent analysis is in progress.
   - The LangGraph workflow coordinates 5 specialized agents:
     1. **Code Review Agent**: Inspects source for edge cases, null guards, and clean structure.
     2. **Test Analysis Agent**: Evaluates the failed test case and highlights why it occurred.
     3. **Optimization Agent**: Recommends an optimal $O(N)$ hash map solution.
     4. **Complexity Analysis Agent**: Breaks down time and space complexity with formal justifications.
     5. **Mentor Summary Agent**: Synthesizes actionable coaching takeaways.
3. **Inspect the Output Tabs**:
   - **Code Review**: Highlights algorithmic structure and potential edge cases.
   - **Optimization**: Proposes the optimal single-pass hash map solution:
     ```python
     def two_sum(nums, target):
         seen = {}
         for i, num in enumerate(nums):
             diff = target - num
             if diff in seen:
                 return [seen[diff], i]
             seen[num] = i
         return []
     ```
   - **Complexity Analysis**: Clearly shows Original Time Complexity: $O(N^2)$ vs Proposed Time Complexity: $O(N)$, with $O(N)$ auxiliary space trade-off.
4. **Key Talking Point**:
   > *"Rather than relying on a single monolithic prompt, we use LangGraph to orchestrate a stateful multi-agent DAG. Each agent focuses on a single responsibility with strict Pydantic validation schemas."*

---

### Step 5: Interactive AI Mock Interview Session (3:45 – 5:00)
1. **Navigate** to **Interview Coach** via the sidebar (or click "Start Interview from Code").
2. **Session Setup**:
   - Programming Language: `Python`
   - Difficulty: `Intermediate`
   - Topic: `Complexity & Data Structures`
   - Questions: `2`
   - The active Two-Sum code is pre-loaded in the code viewport.
3. **Click "Start Technical Interview"**:
   - The AI generates 2 questions tailored specifically to the submitted code.
   - Private grading rubrics are stored on the backend and never exposed to the browser.
4. **Answer Question 1**:
   - *Question Prompt*: "Analyze the time and space complexity of your nested loop solution and explain how a hash map optimizes it."
   - *Type Answer*:
     > *"The nested loop approach takes O(n^2) time because for each element we scan the rest of the array. The space is O(1). We can optimize this to O(n) time by using a hash map to store elements we've seen so far, checking in O(1) time if target - current exists. The space trade-off is O(n) auxiliary memory for the map."*
   - Click **Submit Answer**.
5. **Review Instant Feedback**:
   - Score: `8.5 - 9.5 / 10.0`
   - Correct concepts recognized: $O(N^2)$ brute-force, $O(N)$ hash map, $O(N)$ auxiliary memory trade-off.
   - Adaptive Follow-Up Question: Asks about duplicate values or hash collisions.
6. **Key Talking Point**:
   > *"The AI interviewer does not generate generic LeetCode trivia. It examines the candidate's actual source code, grades answers against private rubrics, and dynamically adapts follow-up questions."*

---

### Step 6: Session Persistence & History Review (5:00 – 6:00)
1. **Return** to the **Coding Workspace**.
2. **Save Session**:
   - Click **Save Session** on the workspace header.
   - Title: `Two Sum Brute Force & AI Analysis`.
   - Click **Save Session**. A confirmation toast confirms persistence to MySQL.
3. **Navigate** to **History & Review**:
   - **Code Sessions Tab**: Shows the saved `Two Sum Brute Force` card with language badge, timestamp, execution telemetry, and AI analysis status.
   - Click **Restore to Editor**: Demonstrates that the code, language, and execution state are restored to Monaco Editor without automatically executing untrusted code.
   - **Interviews Tab**: Shows past interview sessions with overall calculated scores.
   - Click **Review Scorecard**: Displays question-by-question breakdown, candidate answers, rubric criteria, and evaluator feedback.
4. **Logout**:
   - Click user profile avatar -> **Sign Out**.
   - Verify protected access is cleared and session cookie is deleted.

---

## 🎯 Summary Takeaways for Interviewers

- **Full-Stack Competency**: Integrated React 19 frontend with Python FastAPI backend and MySQL persistence.
- **Enterprise Security**: Sandbox code execution via Judge0; zero execution in the application server; Argon2id password hashing; HttpOnly cookie JWT authentication; candidate ownership authorization.
- **Modern AI Engineering**: Multi-agent orchestration with LangGraph DAGs; structured Pydantic schema validation; Groq ultra-low-latency inference.
- **Code Quality**: 63 automated tests passing (backend unit, integration, 18-step full user journey, and frontend tests).
