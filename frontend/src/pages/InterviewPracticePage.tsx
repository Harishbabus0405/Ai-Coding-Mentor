import React, { useState, useEffect } from 'react';
import { 
  MessageSquareCode, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Send, 
  ChevronRight, 
  Award, 
  RefreshCw, 
  Code2, 
  Lightbulb, 
  BarChart2, 
  RotateCcw,
  BookOpen,
  Check,
  AlertTriangle,
  TrendingUp,
  FileText
} from 'lucide-react';
import type { 
  NavPage, 
  InterviewDifficulty, 
  InterviewTopic, 
  StartInterviewResponse, 
  EvaluationResult, 
  InterviewReportResponse,
  InterviewStatusResponse
} from '../types';
import { 
  startInterview, 
  submitInterviewAnswer, 
  fetchInterviewReport, 
  fetchInterviewStatus 
} from '../services/api';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE_ID } from '../constants/languages';

interface InterviewPracticePageProps {
  onNavigate: (page: NavPage) => void;
}

type InterviewPhase = 'setup' | 'interview' | 'report';

const DEFAULT_SAMPLE_CODE = `def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1`;

export const InterviewPracticePage: React.FC<InterviewPracticePageProps> = ({ onNavigate }) => {
  const [phase, setPhase] = useState<InterviewPhase>('setup');

  // Setup form states
  const [sourceCode, setSourceCode] = useState<string>(() => {
    return localStorage.getItem('ai_mentor_last_code') || DEFAULT_SAMPLE_CODE;
  });
  const [language, setLanguage] = useState<string>(() => {
    return localStorage.getItem('ai_mentor_last_lang') || DEFAULT_LANGUAGE_ID;
  });
  const [difficulty, setDifficulty] = useState<InterviewDifficulty>('intermediate');
  const [topic, setTopic] = useState<InterviewTopic>('mixed');
  const [numQuestions, setNumQuestions] = useState<number>(3);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [statusInfo, setStatusInfo] = useState<InterviewStatusResponse | null>(null);

  // Active interview states
  const [session, setSession] = useState<StartInterviewResponse | null>(null);
  const [currentQIndex, setCurrentQIndex] = useState<number>(0);
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [evaluations, setEvaluations] = useState<Record<string, EvaluationResult>>({});
  const [showReferenceAnswer, setShowReferenceAnswer] = useState<boolean>(false);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  // Report states
  const [report, setReport] = useState<InterviewReportResponse | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState<boolean>(false);

  // Feedback / Error alert
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Initial status check
  useEffect(() => {
    fetchInterviewStatus()
      .then((st) => setStatusInfo(st))
      .catch(() => {});
  }, []);

  // Update stored code whenever source code or language changes
  const handleSourceCodeChange = (newCode: string) => {
    setSourceCode(newCode);
    localStorage.setItem('ai_mentor_last_code', newCode);
  };

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    localStorage.setItem('ai_mentor_last_lang', newLang);
  };

  // 1. Start Interview Session
  const handleStartInterview = async () => {
    if (!sourceCode.trim()) {
      setErrorNotice('Please provide or paste source code to interview on.');
      return;
    }

    setErrorNotice(null);
    setIsStarting(true);

    try {
      const response = await startInterview({
        source_code: sourceCode,
        language: language,
        num_questions: numQuestions,
        difficulty: difficulty,
        topic: topic
      });

      setSession(response);
      setCurrentQIndex(0);
      setEvaluations({});
      setUserAnswer('');
      setShowReferenceAnswer(false);
      setIsRetrying(false);
      setPhase('interview');
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to start interview session.');
    } finally {
      setIsStarting(false);
    }
  };

  // 2. Submit Answer
  const handleSubmitAnswer = async () => {
    if (!session || !userAnswer.trim()) return;

    const currentQuestion = session.questions[currentQIndex];
    if (!currentQuestion) return;

    setErrorNotice(null);
    setIsSubmitting(true);

    try {
      const result = await submitInterviewAnswer({
        session_id: session.session_id,
        question_id: currentQuestion.id,
        answer: userAnswer.trim(),
        is_retry: isRetrying
      });

      setEvaluations((prev) => ({
        ...prev,
        [currentQuestion.id]: result
      }));
      setIsRetrying(false);
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to evaluate answer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Retry Answer with Hint
  const handleEnableRetry = () => {
    setIsRetrying(true);
    setShowReferenceAnswer(false);
  };

  // 4. Move to Next Question or Finish
  const handleNextQuestion = () => {
    if (!session) return;
    setErrorNotice(null);
    setShowReferenceAnswer(false);
    setIsRetrying(false);

    if (currentQIndex + 1 < session.questions.length) {
      setCurrentQIndex(currentQIndex + 1);
      const nextQ = session.questions[currentQIndex + 1];
      // If next question was already evaluated, restore answer
      if (evaluations[nextQ.id]) {
        setUserAnswer('');
      } else {
        setUserAnswer('');
      }
    } else {
      // Completed all questions -> load final report
      handleFinishInterview();
    }
  };

  // 5. Finish Interview & View Report
  const handleFinishInterview = async () => {
    if (!session) return;
    setErrorNotice(null);
    setIsLoadingReport(true);
    setPhase('report');

    try {
      const rep = await fetchInterviewReport(session.session_id);
      setReport(rep);
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to load interview report.');
    } finally {
      setIsLoadingReport(false);
    }
  };

  // Reset back to setup
  const handleResetToSetup = () => {
    setPhase('setup');
    setSession(null);
    setEvaluations({});
    setReport(null);
    setErrorNotice(null);
  };

  const currentQuestion = session?.questions[currentQIndex];
  const currentEvaluation = currentQuestion ? evaluations[currentQuestion.id] : undefined;
  const isQuestionAnswered = Boolean(currentEvaluation && !isRetrying);

  return (
    <div className="space-y-6 pb-16 max-w-5xl mx-auto">
      {/* Top Header / Navigation */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
        <button
          onClick={() => phase === 'setup' ? onNavigate('workspace') : handleResetToSetup()}
          className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-emerald-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{phase === 'setup' ? 'Return to Coding Workspace' : 'Exit to Setup'}</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Interview Coach
          </span>
        </div>
      </div>

      {/* Error Alert Banner */}
      {errorNotice && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-rose-300">Notice</p>
            <p className="mt-0.5 leading-relaxed">{errorNotice}</p>
          </div>
          <button 
            onClick={() => setErrorNotice(null)}
            className="text-slate-400 hover:text-slate-200 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Provider Unconfigured Notice */}
      {statusInfo && !statusInfo.groq_configured && phase === 'setup' && (
        <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-300">Groq API Key Required for AI Interview Coaching</p>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              To practice interactive interviews with live question generation and answer evaluation, configure your free API key in <code className="bg-slate-900 px-1.5 py-0.5 rounded text-amber-300 font-mono">backend/.env</code> (<code className="font-mono text-emerald-400">GROQ_API_KEY=gsk_...</code>).
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. SETUP PHASE                                                            */}
      {/* ========================================================================= */}
      {phase === 'setup' && (
        <div className="space-y-6">
          {/* Hero Banner */}
          <div className="rounded-2xl bg-gradient-to-br from-[#0e1424] to-[#0a0f1d] border border-slate-800 p-6 md:p-8">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium mb-3">
                <MessageSquareCode className="w-3.5 h-3.5" />
                Mock Interview Practice
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                Practice Technical Interviews on Your Code
              </h1>
              <p className="text-xs md:text-sm text-slate-400 mt-2 leading-relaxed">
                Practice answering questions on your code just like in a real technical interview. Get instant feedback on your explanations, algorithmic thinking, and complexity analysis.
              </p>
            </div>
          </div>

          {/* Session Configuration Card */}
          <div className="rounded-2xl bg-[#0d121f] border border-slate-800 p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Code2 className="w-4 h-4 text-emerald-400" />
                <span>Interview Source Code</span>
              </h2>

              <div className="flex items-center gap-2">
                <label className="text-[11px] text-slate-400">Language:</label>
                <select
                  value={language}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Code Textarea */}
            <div>
              <textarea
                value={sourceCode}
                onChange={(e) => handleSourceCodeChange(e.target.value)}
                rows={8}
                placeholder="Paste or write the algorithm / code you want to be interviewed on..."
                className="w-full bg-[#080c14] border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500/80 transition-colors resize-y leading-relaxed"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Tip: The questions will be derived directly from the logic, loops, invariants, and edge cases in this code.
              </p>
            </div>

            {/* Configuration Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 border-t border-slate-800/80">
              {/* Difficulty Selector */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Target Difficulty
                </label>
                <div className="grid grid-cols-3 gap-1.5 bg-[#080c14] p-1 rounded-xl border border-slate-800">
                  {(['beginner', 'intermediate', 'advanced'] as InterviewDifficulty[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDifficulty(d)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                        difficulty === d
                          ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Number of Questions */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Number of Questions
                </label>
                <div className="grid grid-cols-3 gap-1.5 bg-[#080c14] p-1 rounded-xl border border-slate-800">
                  {[3, 5, 7].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setNumQuestions(num)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        numQuestions === num
                          ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {num} Questions
                    </button>
                  ))}
                </div>
              </div>

              {/* Interview Focus Topic */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Primary Focus
                </label>
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value as InterviewTopic)}
                  className="w-full bg-[#080c14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="mixed">All Topics (Realistic Mix)</option>
                  <option value="complexity">Time & Space Complexity</option>
                  <option value="data_structures_algorithms">Data Structures & Algorithms</option>
                  <option value="debugging">Debugging & Logic Invariants</option>
                  <option value="optimization">Algorithmic Optimization</option>
                  <option value="edge_cases_testing">Edge Cases & Boundary Conditions</option>
                  <option value="code_understanding">Code Understanding & Walkthrough</option>
                </select>
              </div>
            </div>

            {/* Launch Button */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={handleStartInterview}
                disabled={isStarting}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs shadow-sm shadow-emerald-500/20 transition-all disabled:opacity-50"
              >
                {isStarting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Generating Questions...</span>
                  </>
                ) : (
                  <>
                    <MessageSquareCode className="w-4 h-4" />
                    <span>Start Technical Interview</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. ACTIVE INTERVIEW PHASE                                                 */}
      {/* ========================================================================= */}
      {phase === 'interview' && session && currentQuestion && (
        <div className="space-y-6">
          {/* Progress Header */}
          <div className="rounded-xl bg-[#0d121f] border border-slate-800 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">
                  Question {currentQIndex + 1} of {session.questions.length}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700 capitalize">
                  {currentQuestion.topic.replace(/_/g, ' ')}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize">
                  {currentQuestion.difficulty}
                </span>
              </div>

              <button
                onClick={handleFinishInterview}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                Finish Early & View Report
              </button>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
                style={{ width: `${((currentQIndex + (isQuestionAnswered ? 1 : 0)) / session.questions.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Question Card */}
          <div className="rounded-2xl bg-[#0d121f] border border-slate-800 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5 font-mono text-sm font-bold">
                Q{currentQIndex + 1}
              </div>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-white leading-relaxed">
                  {currentQuestion.question_text}
                </h2>
                <p className="text-xs text-slate-400 mt-1 capitalize">
                  Category: {currentQuestion.topic.replace(/_/g, ' ')} • {currentQuestion.question_type}
                </p>
              </div>
            </div>

            {/* Answer Input Area */}
            <div className="space-y-2 pt-2">
              <label className="block text-xs font-medium text-slate-300">
                {isRetrying ? 'Your Revised Answer (Incorporate the hint):' : 'Your Answer:'}
              </label>

              <textarea
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                disabled={isQuestionAnswered && !isRetrying}
                rows={6}
                placeholder="Explain your technical reasoning clearly. Mention time and space complexity, data structures, and edge cases where relevant..."
                className={`w-full bg-[#080c14] border rounded-xl p-3.5 text-xs text-slate-200 focus:outline-none transition-colors resize-y leading-relaxed ${
                  isQuestionAnswered && !isRetrying
                    ? 'border-slate-800 opacity-80 cursor-not-allowed'
                    : 'border-slate-700 focus:border-emerald-500'
                }`}
              />

              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>{userAnswer.length} characters</span>
                <span>Scoring evaluates technical depth, not word count.</span>
              </div>
            </div>

            {/* Action Bar (When not yet answered or retrying) */}
            {(!isQuestionAnswered || isRetrying) && (
              <div className="flex items-center justify-between pt-2">
                {isRetrying && (
                  <button
                    type="button"
                    onClick={() => setIsRetrying(false)}
                    className="text-xs text-slate-400 hover:text-slate-200"
                  >
                    Cancel Retry
                  </button>
                )}

                <div className="ml-auto">
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={isSubmitting || !userAnswer.trim()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs shadow-sm shadow-emerald-500/20 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Evaluating Answer...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>{isRetrying ? 'Submit Revised Answer' : 'Submit Answer'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ===================================================================== */}
          {/* FEEDBACK & EVALUATION CARD                                            */}
          {/* ===================================================================== */}
          {currentEvaluation && (
            <div className="rounded-2xl bg-[#0e1424] border border-slate-800 p-6 space-y-5 animate-fade-in">
              {/* Score and Status Banner */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                <div className="flex items-center gap-3">
                  <div className={`px-3 py-1.5 rounded-xl font-bold font-mono text-sm border flex items-center gap-1.5 ${
                    currentEvaluation.score >= 8.0
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : currentEvaluation.score >= 5.0
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                  }`}>
                    <Award className="w-4 h-4" />
                    <span>{currentEvaluation.score.toFixed(1)} / 10.0</span>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold text-white">
                      {currentEvaluation.score >= 8.0 
                        ? 'Strong Technical Understanding' 
                        : currentEvaluation.score >= 5.0 
                          ? 'Partially Correct' 
                          : 'Needs Further Revision'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {currentEvaluation.is_sufficient ? 'Demonstrated sufficient grasp to advance.' : 'Key concepts were missing or misstated.'}
                    </p>
                  </div>
                </div>

                {currentEvaluation.retry_count > 0 && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    Retry Attempt: {currentEvaluation.retry_count}/2
                  </span>
                )}
              </div>

              {/* Feedback Text */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Evaluation Feedback</span>
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed bg-[#0a0e19] p-3 rounded-xl border border-slate-800/80">
                  {currentEvaluation.feedback}
                </p>
              </div>

              {/* Concept Breakdown Tags */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Correct Concepts */}
                {currentEvaluation.correct_concepts.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 font-mono uppercase tracking-wider">
                      <Check className="w-3 h-3" />
                      Concepts Addressed:
                    </span>
                    <ul className="space-y-1">
                      {currentEvaluation.correct_concepts.map((c, i) => (
                        <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5 bg-emerald-950/20 px-2.5 py-1 rounded border border-emerald-900/30">
                          <span className="text-emerald-400 font-bold">•</span>
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Missing Concepts */}
                {currentEvaluation.missing_concepts.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1 font-mono uppercase tracking-wider">
                      <AlertTriangle className="w-3 h-3" />
                      Omitted Key Points:
                    </span>
                    <ul className="space-y-1">
                      {currentEvaluation.missing_concepts.map((c, i) => (
                        <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5 bg-amber-950/20 px-2.5 py-1 rounded border border-amber-900/30">
                          <span className="text-amber-400 font-bold">•</span>
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Incorrect Statements / Misconceptions if any */}
              {currentEvaluation.incorrect_statements.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-rose-400 flex items-center gap-1 font-mono uppercase tracking-wider">
                    <AlertCircle className="w-3 h-3" />
                    Misconceptions Identified:
                  </span>
                  <ul className="space-y-1">
                    {currentEvaluation.incorrect_statements.map((inc, i) => (
                      <li key={i} className="text-xs text-rose-200 bg-rose-950/20 px-2.5 py-1.5 rounded border border-rose-900/40">
                        {inc}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Adaptive Follow-Up Question or Hint */}
              {currentEvaluation.follow_up && (
                <div className={`p-4 rounded-xl border space-y-2 ${
                  currentEvaluation.follow_up.type === 'hint'
                    ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                    : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold flex items-center gap-1.5">
                      <Lightbulb className="w-3.5 h-3.5" />
                      {currentEvaluation.follow_up.type === 'hint' ? 'Adaptive Coach Hint:' : 'Follow-Up Challenge:'}
                    </span>

                    {currentEvaluation.retry_count < 2 && !isRetrying && (
                      <button
                        onClick={handleEnableRetry}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded bg-slate-900 text-emerald-400 border border-slate-700 hover:border-emerald-500 transition-colors"
                      >
                        Try Retrying Answer
                      </button>
                    )}
                  </div>

                  <p className="text-xs leading-relaxed">
                    {currentEvaluation.follow_up.text}
                  </p>
                </div>
              )}

              {/* Model / Reference Answer Accordion */}
              <div className="border-t border-slate-800/80 pt-3">
                <button
                  type="button"
                  onClick={() => setShowReferenceAnswer(!showReferenceAnswer)}
                  className="text-xs text-slate-400 hover:text-emerald-400 font-medium flex items-center gap-1.5 transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>{showReferenceAnswer ? 'Hide Reference Answer' : 'View Model Reference Answer'}</span>
                </button>

                {showReferenceAnswer && (
                  <div className="mt-2.5 p-3.5 rounded-xl bg-[#080c14] border border-slate-800 text-xs text-slate-300 leading-relaxed font-mono">
                    {currentEvaluation.reference_answer}
                  </div>
                )}
              </div>

              {/* Advisory Disclaimer */}
              <p className="text-[10px] text-slate-500 italic">
                {currentEvaluation.advisory_notice}
              </p>

              {/* Next Navigation Button */}
              <div className="flex justify-end pt-2 border-t border-slate-800/80">
                <button
                  onClick={handleNextQuestion}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs shadow-sm transition-all"
                >
                  <span>{currentQIndex + 1 < session.questions.length ? 'Next Question' : 'Finish & View Final Report'}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. FINAL PERFORMANCE REPORT PHASE                                         */}
      {/* ========================================================================= */}
      {phase === 'report' && (
        <div className="space-y-6">
          {isLoadingReport && (
            <div className="p-12 text-center rounded-2xl bg-[#0d121f] border border-slate-800 space-y-3">
              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
              <h3 className="text-sm font-semibold text-white">Synthesizing Final Interview Report...</h3>
              <p className="text-xs text-slate-400">Computing deterministic scores and personalized study recommendations.</p>
            </div>
          )}

          {!isLoadingReport && report && (
            <div className="space-y-6">
              {/* Header Summary Banner */}
              <div className="rounded-2xl bg-gradient-to-br from-[#0e1424] to-[#090d18] border border-slate-800 p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div>
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono mb-2">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Interview Session Complete
                  </div>
                  <h1 className="text-2xl font-bold text-white tracking-tight">
                    Technical Interview Scorecard
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Completed {report.questions_answered} of {report.total_questions} questions across {report.topic_performance.length} topics.
                  </p>
                </div>

                {/* Big Score Box */}
                <div className="px-6 py-4 rounded-2xl bg-slate-900/90 border border-slate-700/80 text-center shrink-0">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block">
                    Average Score
                  </span>
                  <span className={`text-3xl font-extrabold font-mono ${
                    report.average_score >= 8.0 
                      ? 'text-emerald-400' 
                      : report.average_score >= 5.0 
                        ? 'text-amber-400' 
                        : 'text-rose-400'
                  }`}>
                    {report.average_score.toFixed(1)}
                  </span>
                  <span className="text-xs text-slate-400 font-mono"> / 10.0</span>
                </div>
              </div>

              {/* Topic Breakdown Card */}
              {report.topic_performance.length > 0 && (
                <div className="rounded-2xl bg-[#0d121f] border border-slate-800 p-6 space-y-4">
                  <h3 className="text-xs font-semibold text-white flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-emerald-400" />
                    <span>Topic-Wise Performance</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {report.topic_performance.map((tp, idx) => (
                      <div key={idx} className="p-3.5 rounded-xl bg-[#080c14] border border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-200 capitalize">
                            {tp.topic.replace(/_/g, ' ')}
                          </span>
                          <span className="font-mono text-emerald-400 font-bold">
                            {tp.average_score.toFixed(1)}/10
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-full rounded-full"
                            style={{ width: `${(tp.average_score / 10) * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500 block">
                          {tp.questions_count} question{tp.questions_count > 1 ? 's' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Strengths and Revision Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Strengths */}
                <div className="rounded-2xl bg-[#0d121f] border border-slate-800 p-6 space-y-3">
                  <h3 className="text-xs font-semibold text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Demonstrated Strengths</span>
                  </h3>
                  <ul className="space-y-2 text-xs text-slate-300">
                    {report.strengths.map((str, i) => (
                      <li key={i} className="flex items-start gap-2 bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-900/30">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Areas for Revision */}
                <div className="rounded-2xl bg-[#0d121f] border border-slate-800 p-6 space-y-3">
                  <h3 className="text-xs font-semibold text-amber-400 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    <span>Key Concepts to Revise</span>
                  </h3>
                  <ul className="space-y-2 text-xs text-slate-300">
                    {report.areas_for_revision.map((rev, i) => (
                      <li key={i} className="flex items-start gap-2 bg-amber-950/20 p-2.5 rounded-lg border border-amber-900/30">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span>{rev}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Key Corrections Table (if any misconceptions) */}
              {report.key_mistakes_and_corrections.length > 0 && (
                <div className="rounded-2xl bg-[#0d121f] border border-slate-800 p-6 space-y-3">
                  <h3 className="text-xs font-semibold text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                    <span>Identified Misconceptions & Corrections</span>
                  </h3>
                  <div className="space-y-2">
                    {report.key_mistakes_and_corrections.map((m, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-rose-950/20 border border-rose-900/30 text-xs space-y-1">
                        <p className="font-semibold text-rose-200">
                          Misstatement: "{m.incorrect_statement}"
                        </p>
                        <p className="text-slate-300 text-[11px] leading-relaxed">
                          Correction: {m.correction}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Practice Topics */}
              {report.suggested_practice_topics.length > 0 && (
                <div className="rounded-2xl bg-[#0d121f] border border-slate-800 p-6 space-y-3">
                  <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-emerald-400" />
                    <span>Recommended Next Practice Topics</span>
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {report.suggested_practice_topics.map((top, idx) => (
                      <span key={idx} className="px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-200 border border-slate-700">
                        {top}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Final Actions */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                <button
                  onClick={handleResetToSetup}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Start Another Interview</span>
                </button>

                <button
                  onClick={() => onNavigate('workspace')}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs shadow-sm transition-all"
                >
                  <Code2 className="w-4 h-4" />
                  <span>Return to Coding Workspace</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
