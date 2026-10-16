"""
Live Groq Smoke Test for Phase 5: AI Interview Coach.
Performs a live API call to Groq only if an actual GROQ_API_KEY is configured in backend/.env.
If unconfigured, it clearly announces that live smoke testing is skipped without failing.
"""

import os
import sys
import asyncio

# Ensure utf-8 stdout encoding on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings
from app.services.groq_service import is_groq_configured
from app.services.interview_models import StartInterviewRequest, InterviewDifficulty, SubmitAnswerRequest
from app.services.interview_service import create_interview_session, evaluate_interview_answer
from app.db.database import init_db, get_engine
from sqlalchemy.orm import sessionmaker

SAMPLE_CODE = """
def is_palindrome(s: str) -> bool:
    cleaned = ''.join(c.lower() for c in s if c.isalnum())
    return cleaned == cleaned[::-1]
""".strip()


async def main():
    print("\n=======================================================")
    print("  LIVE GROQ INTERVIEW COACH SMOKE TEST (PHASE 5)       ")
    print("=======================================================\n")

    if not is_groq_configured():
        print("[LIVE GROQ SMOKE TEST SKIPPED]")
        print("Reason: No active GROQ_API_KEY configured in backend/.env.")
        print(f"Current Model: {settings.GROQ_MODEL}")
        print("Current GROQ_API_KEY: [Not configured / placeholder]\n")
        print("To enable live AI interview coach testing against Groq API:")
        print("  1. Create a free API key at https://console.groq.com")
        print("  2. Set GROQ_API_KEY=gsk_... in backend/.env")
        print("  3. Re-run this smoke test.\n")
        print("All mocked unit and integration tests run independently and verify full interview flow.\n")
        return 0

    print(f"[*] Active Groq API key detected. Using model: {settings.GROQ_MODEL}")
    print("[*] Initializing local database for test session...")
    
    engine = get_engine()
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    init_db()
    db = SessionLocal()

    try:
        print("[*] Generating 2 interview questions via live Groq API...")
        start_req = StartInterviewRequest(
            source_code=SAMPLE_CODE,
            language="python",
            num_questions=2,
            difficulty=InterviewDifficulty.INTERMEDIATE,
            topic="complexity"
        )
        start_res = await create_interview_session(db, start_req)
        
        print(f"[+] Successfully created session: {start_res.session_id}")
        print(f"[+] Total questions generated: {len(start_res.questions)}")
        for idx, q in enumerate(start_res.questions):
            print(f"    Q{idx + 1} ({q.topic} - {q.difficulty}): {q.question_text[:80]}...")

        # Test evaluating an answer on Question 1
        q1 = start_res.questions[0]
        print(f"\n[*] Submitting live answer to Question 1: '{q1.id}'...")
        answer_req = SubmitAnswerRequest(
            session_id=start_res.session_id,
            question_id=q1.id,
            answer="The time complexity is O(n) because we iterate through the string of length n to filter characters and then reverse it, which also takes O(n) time. The auxiliary space complexity is O(n) to store the cleaned string."
        )
        eval_res = await evaluate_interview_answer(db, answer_req)

        print(f"[+] Answer evaluation completed successfully!")
        print(f"    Score: {eval_res.score} / 10.0")
        print(f"    Sufficient: {eval_res.is_sufficient}")
        print(f"    Feedback: {eval_res.feedback[:120]}...")
        if eval_res.correct_concepts:
            print(f"    Correct Concepts: {eval_res.correct_concepts}")
        if eval_res.missing_concepts:
            print(f"    Missing Concepts: {eval_res.missing_concepts}")
        if eval_res.follow_up:
            print(f"    Follow-Up ({eval_res.follow_up.type}): {eval_res.follow_up.text[:80]}...")

        print("\n[SUCCESS] Live Groq Interview Coach smoke test verified successfully!\n")
        return 0
    except Exception as e:
        print(f"\n[ERROR] Live Groq API smoke test encountered an error: {e}\n")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
