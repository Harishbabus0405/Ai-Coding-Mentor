import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class UserModel(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    display_name = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    code_sessions = relationship(
        "CodeSessionModel", 
        back_populates="user", 
        cascade="all, delete-orphan", 
        order_by="desc(CodeSessionModel.updated_at)"
    )
    interview_sessions = relationship(
        "InterviewSessionModel", 
        back_populates="user",
        order_by="desc(InterviewSessionModel.created_at)"
    )


class CodeSessionModel(Base):
    __tablename__ = "code_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    title = Column(String(200), default="Untitled Session", nullable=False)
    language = Column(String(32), nullable=False)
    source_code = Column(Text, nullable=False)
    execution_status = Column(String(32), nullable=True)
    stdout = Column(Text, nullable=True)
    stderr = Column(Text, nullable=True)
    compile_output = Column(Text, nullable=True)
    execution_time = Column(Float, nullable=True)
    memory_used = Column(Integer, nullable=True)
    analysis_summary = Column(Text, nullable=True)
    analysis_results = Column(Text, nullable=True)  # JSON-encoded string
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    user = relationship("UserModel", back_populates="code_sessions")


class InterviewSessionModel(Base):
    __tablename__ = "interview_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True)
    source_code = Column(Text, nullable=False)
    language = Column(String(32), nullable=False)
    topic = Column(String(64), nullable=False, default="mixed")
    difficulty = Column(String(32), nullable=False, default="intermediate")
    num_questions = Column(Integer, nullable=False, default=3)
    current_question_index = Column(Integer, nullable=False, default=0)
    status = Column(String(32), nullable=False, default="in_progress")  # in_progress, completed, abandoned
    final_score = Column(Float, nullable=True)
    overall_feedback = Column(Text, nullable=True)
    strengths = Column(Text, nullable=True)           # JSON list
    areas_for_revision = Column(Text, nullable=True)  # JSON list
    created_at = Column(DateTime, default=utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)

    user = relationship("UserModel", back_populates="interview_sessions")
    questions = relationship(
        "InterviewQuestionModel", 
        back_populates="session", 
        cascade="all, delete-orphan", 
        order_by="InterviewQuestionModel.question_index"
    )
    answers = relationship(
        "InterviewAnswerModel", 
        back_populates="session", 
        cascade="all, delete-orphan", 
        order_by="InterviewAnswerModel.created_at"
    )


class InterviewQuestionModel(Base):
    __tablename__ = "interview_questions"

    id = Column(String(64), primary_key=True)
    session_id = Column(String(36), ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False)
    question_index = Column(Integer, nullable=False)
    question_text = Column(Text, nullable=False)
    topic = Column(String(64), nullable=False)
    difficulty = Column(String(32), nullable=False)
    question_type = Column(String(64), nullable=False)
    expected_concepts = Column(Text, nullable=False)     # JSON list: hidden from candidate before answer
    evaluation_criteria = Column(Text, nullable=False)   # Hidden grading rubric
    created_at = Column(DateTime, default=utcnow, nullable=False)

    session = relationship("InterviewSessionModel", back_populates="questions")
    answers = relationship("InterviewAnswerModel", back_populates="question", cascade="all, delete-orphan")


class InterviewAnswerModel(Base):
    __tablename__ = "interview_answers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(String(64), ForeignKey("interview_questions.id", ondelete="CASCADE"), nullable=False)
    user_answer = Column(Text, nullable=False)
    score = Column(Float, nullable=False)
    correct_concepts = Column(Text, nullable=False)       # JSON list
    missing_concepts = Column(Text, nullable=False)       # JSON list
    incorrect_statements = Column(Text, nullable=False)   # JSON list
    feedback = Column(Text, nullable=False)
    suggested_improvements = Column(Text, nullable=False)
    reference_answer = Column(Text, nullable=False)
    is_sufficient = Column(Boolean, nullable=False, default=True)
    retry_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    session = relationship("InterviewSessionModel", back_populates="answers")
    question = relationship("InterviewQuestionModel", back_populates="answers")


class InterviewFollowUpModel(Base):
    __tablename__ = "interview_follow_ups"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(String(64), ForeignKey("interview_questions.id", ondelete="CASCADE"), nullable=False)
    follow_up_text = Column(Text, nullable=False)
    follow_up_type = Column(String(32), nullable=False)  # hint, clarification, deeper_dive
    user_answer = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
