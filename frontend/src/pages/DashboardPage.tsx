import React, { useState, useEffect } from 'react';
import { 
  Code2, 
  MessageSquareCode, 
  ArrowRight, 
  Sparkles, 
  Clock, 
  Award,
  ChevronRight,
  FolderGit2
} from 'lucide-react';
import type { NavPage, CodeSessionSummary, InterviewSessionSummary } from '../types';
import { fetchCodeSessions, fetchInterviewHistory } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface DashboardPageProps {
  onNavigate: (page: NavPage) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigate,
}) => {
  const { user, openAuthModal } = useAuth();
  const [recentCode, setRecentCode] = useState<CodeSessionSummary[]>([]);
  const [recentInterviews, setRecentInterviews] = useState<InterviewSessionSummary[]>([]);
  const [totalCodeCount, setTotalCodeCount] = useState<number>(0);
  const [totalInterviewCount, setTotalInterviewCount] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    if (user) {
      Promise.allSettled([
        fetchCodeSessions({ page: 1, limit: 3 }),
        fetchInterviewHistory({ page: 1, limit: 3 }),
      ]).then(([codeRes, intRes]) => {
        if (!isMounted) return;
        if (codeRes.status === 'fulfilled') {
          setRecentCode(codeRes.value.items || []);
          setTotalCodeCount(codeRes.value.total || 0);
        }
        if (intRes.status === 'fulfilled') {
          setRecentInterviews(intRes.value.items || []);
          setTotalInterviewCount(intRes.value.total || 0);
        }
      });
    } else {
      setRecentCode([]);
      setRecentInterviews([]);
      setTotalCodeCount(0);
      setTotalInterviewCount(0);
    }
    return () => {
      isMounted = false;
    };
  }, [user]);

  const hasRealActivity = totalCodeCount > 0 || totalInterviewCount > 0;

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-2">
      {/* 1. Welcome Hero Section */}
      <div className="rounded-2xl bg-[#0e1424] border border-slate-800/80 p-6 md:p-10 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI-Powered Coding Tutor</span>
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Learn to Code, Debug with Confidence, and Ace Technical Interviews
          </h1>

          <p className="text-sm text-slate-300 leading-relaxed pt-1">
            Write your own solutions, execute them against test cases, and get friendly step-by-step hints when you get stuck. When you are ready, turn your code into realistic mock interviews.
          </p>

          <div className="flex flex-wrap gap-3 pt-4">
            <button
              onClick={() => onNavigate('workspace')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold shadow-md shadow-emerald-950/40 transition-all active:translate-y-0.5"
            >
              <Code2 className="w-4 h-4" />
              <span>Start Coding</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => onNavigate('interview')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition-colors"
            >
              <MessageSquareCode className="w-4 h-4 text-emerald-400" />
              <span>Practice Interview</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Real Learning Summary (Only when real activity exists) */}
      {user && hasRealActivity && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-xl bg-[#0d121f] border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Saved Code Sessions</p>
              <p className="text-2xl font-bold text-white mt-1">{totalCodeCount}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Stored in your personal history</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Code2 className="w-5 h-5" />
            </div>
          </div>

          <div className="p-5 rounded-xl bg-[#0d121f] border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Completed Mock Interviews</p>
              <p className="text-2xl font-bold text-white mt-1">{totalInterviewCount}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Scored against technical rubrics</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Award className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}

      {/* 3. Recent Activity Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>Recent Activity</span>
          </h2>
          {user && hasRealActivity && (
            <button
              onClick={() => onNavigate('history')}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium inline-flex items-center gap-1"
            >
              <span>View All History</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {user && hasRealActivity ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recentCode.map((session) => (
              <div
                key={session.id}
                onClick={() => onNavigate('history')}
                className="p-4 rounded-xl bg-[#0d121f] border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-white group-hover:text-emerald-300 transition-colors">
                      {session.title}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {session.language.toUpperCase()} • {new Date(session.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  {session.execution_status && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700 font-mono">
                      {session.execution_status}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {recentInterviews.map((interview) => (
              <div
                key={interview.id}
                onClick={() => onNavigate('history')}
                className="p-4 rounded-xl bg-[#0d121f] border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-white group-hover:text-emerald-300 transition-colors">
                      Mock Interview: {interview.topic}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {interview.language.toUpperCase()} • {interview.difficulty} • {new Date(interview.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {interview.average_score !== null && interview.average_score !== undefined && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-mono font-bold">
                      {interview.average_score.toFixed(1)} / 10
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 rounded-xl bg-[#0d121f] border border-slate-800 text-center space-y-2">
            <FolderGit2 className="w-8 h-8 text-slate-500 mx-auto" />
            <p className="text-xs font-medium text-slate-300">No saved activity yet</p>
            <p className="text-[11px] text-slate-400 max-w-md mx-auto">
              {user
                ? "Start a coding session to write solutions, run tests, and save your progress here."
                : "Sign in or create an account to save your code solutions and track your interview practice scorecards."}
            </p>
            {!user && (
              <div className="pt-2">
                <button
                  onClick={() => openAuthModal('login')}
                  className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
                >
                  Sign In to Track Progress
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Three Simple Learning Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="p-5 rounded-xl bg-[#0d121f] border border-slate-800/80 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xs">
            1
          </div>
          <h3 className="text-xs font-semibold text-white">Write & Run Real Code</h3>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Choose Python, JavaScript, TypeScript, C, C++, or Java. Enter your own inputs, execute in a secure sandbox, and see real output.
          </p>
        </div>

        <div className="p-5 rounded-xl bg-[#0d121f] border border-slate-800/80 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xs">
            2
          </div>
          <h3 className="text-xs font-semibold text-white">Hints Before Spoilers</h3>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Stuck on an error? Ask for a hint to understand why the bug happens and how to fix it yourself, rather than getting an auto-complete answer.
          </p>
        </div>

        <div className="p-5 rounded-xl bg-[#0d121f] border border-slate-800/80 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xs">
            3
          </div>
          <h3 className="text-xs font-semibold text-white">Practice Live Interviews</h3>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Turn your code into realistic technical interview questions. Receive instant scoring on algorithmic trade-offs and complexity.
          </p>
        </div>
      </div>
    </div>
  );
};
