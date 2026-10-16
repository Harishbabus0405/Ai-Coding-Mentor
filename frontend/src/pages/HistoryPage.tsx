import React, { useState, useEffect, useCallback } from 'react';
import { 
  History, 
  Code2, 
  MessageSquareCode, 
  Search, 
  Filter, 
  Trash2, 
  ExternalLink, 
  RotateCcw, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  Loader2, 
  X,
  FileCode,
  ShieldAlert,
  Award
} from 'lucide-react';
import type { 
  NavPage, 
  SupportedLanguageId, 
  CodeSessionSummary, 
  CodeSessionDetail,
  InterviewSessionSummary,
  PaginatedCodeSessions,
  PaginatedInterviewSessions
} from '../types';
import { 
  fetchCodeSessions, 
  fetchCodeSessionDetail, 
  deleteCodeSession,
  fetchInterviewHistory,
  fetchInterviewHistoryDetail,
  deleteInterviewHistorySession
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { SUPPORTED_LANGUAGES } from '../constants/languages';

interface HistoryPageProps {
  onNavigate: (page: NavPage) => void;
  onRestoreCode?: (restored: {
    code: string;
    language: SupportedLanguageId;
    title?: string;
    executionResult?: any;
    analysisResult?: any;
  }) => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({ onNavigate, onRestoreCode }) => {
  const { user, openAuthModal } = useAuth();
  const [activeTab, setActiveTab] = useState<'code' | 'interviews'>('code');

  // Code History State
  const [codeSessions, setCodeSessions] = useState<CodeSessionSummary[]>([]);
  const [codePage, setCodePage] = useState(1);
  const [codeTotalPages, setCodeTotalPages] = useState(1);
  const [codeTotal, setCodeTotal] = useState(0);
  const [codeLanguage, setCodeLanguage] = useState<string>('');
  const [codeSearch, setCodeSearch] = useState<string>('');
  const [isLoadingCode, setIsLoadingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  // Interview History State
  const [interviewSessions, setInterviewSessions] = useState<InterviewSessionSummary[]>([]);
  const [interviewPage, setInterviewPage] = useState(1);
  const [interviewTotalPages, setInterviewTotalPages] = useState(1);
  const [interviewTotal, setInterviewTotal] = useState(0);
  const [interviewDifficulty, setInterviewDifficulty] = useState<string>('');
  const [interviewTopic, setInterviewTopic] = useState<string>('');
  const [isLoadingInterviews, setIsLoadingInterviews] = useState(false);
  const [interviewError, setInterviewError] = useState<string | null>(null);

  // Detail Modal State
  const [selectedCodeDetail, setSelectedCodeDetail] = useState<CodeSessionDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [selectedInterviewDetail, setSelectedInterviewDetail] = useState<any | null>(null);

  // Delete Confirmation Modal State
  const [itemToDelete, setItemToDelete] = useState<{ id: string; type: 'code' | 'interview'; title: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load Code Sessions
  const loadCodeSessions = useCallback(async () => {
    if (!user) return;
    setIsLoadingCode(true);
    setCodeError(null);
    try {
      const data: PaginatedCodeSessions = await fetchCodeSessions({
        page: codePage,
        limit: 10,
        language: codeLanguage || undefined,
        search: codeSearch.trim() || undefined,
      });
      setCodeSessions(data.items);
      setCodeTotalPages(data.total_pages);
      setCodeTotal(data.total);
    } catch (err: any) {
      setCodeError(err.message || 'Failed to load code sessions.');
    } finally {
      setIsLoadingCode(false);
    }
  }, [user, codePage, codeLanguage, codeSearch]);

  // Load Interview Sessions
  const loadInterviewSessions = useCallback(async () => {
    if (!user) return;
    setIsLoadingInterviews(true);
    setInterviewError(null);
    try {
      const data: PaginatedInterviewSessions = await fetchInterviewHistory({
        page: interviewPage,
        limit: 10,
        difficulty: interviewDifficulty || undefined,
        topic: interviewTopic || undefined,
      });
      setInterviewSessions(data.items);
      setInterviewTotalPages(data.total_pages);
      setInterviewTotal(data.total);
    } catch (err: any) {
      setInterviewError(err.message || 'Failed to load interview history.');
    } finally {
      setIsLoadingInterviews(false);
    }
  }, [user, interviewPage, interviewDifficulty, interviewTopic]);

  useEffect(() => {
    if (user) {
      if (activeTab === 'code') {
        loadCodeSessions();
      } else {
        loadInterviewSessions();
      }
    }
  }, [user, activeTab, loadCodeSessions, loadInterviewSessions]);

  // Handle Code Session Detail View
  const handleViewCodeDetail = async (sessionId: string) => {
    setIsLoadingDetail(true);
    try {
      const detail = await fetchCodeSessionDetail(sessionId);
      setSelectedCodeDetail(detail);
    } catch (err: any) {
      alert(`Could not open session: ${err.message}`);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Handle Code Session Restore to Editor
  const handleRestoreToEditor = async (sessionId: string) => {
    try {
      const detail = await fetchCodeSessionDetail(sessionId);
      if (onRestoreCode) {
        onRestoreCode({
          code: detail.source_code,
          language: detail.language as SupportedLanguageId,
          title: detail.title,
          executionResult: detail.execution_status ? {
            status: detail.execution_status,
            stdout: detail.stdout,
            stderr: detail.stderr,
            compile_output: detail.compile_output,
            execution_time: detail.execution_time,
            memory_used: detail.memory_used,
          } : null,
          analysisResult: detail.analysis_results || null,
        });
      }
      onNavigate('workspace');
    } catch (err: any) {
      alert(`Failed to restore code session: ${err.message}`);
    }
  };

  // Handle Interview Session Detail View
  const handleViewInterviewDetail = async (sessionId: string) => {
    setIsLoadingDetail(true);
    try {
      const detail = await fetchInterviewHistoryDetail(sessionId);
      setSelectedInterviewDetail(detail);
    } catch (err: any) {
      alert(`Could not load interview details: ${err.message}`);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Confirm and Execute Deletion
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      if (itemToDelete.type === 'code') {
        await deleteCodeSession(itemToDelete.id);
        setItemToDelete(null);
        loadCodeSessions();
      } else {
        await deleteInterviewHistorySession(itemToDelete.id);
        setItemToDelete(null);
        loadInterviewSessions();
      }
    } catch (err: any) {
      alert(`Failed to delete record: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Format date helper
  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  // Execution status badge helper
  const renderStatusBadge = (status?: string | null) => {
    if (!status) return <span className="text-[11px] text-slate-500 font-mono">Unexecuted</span>;
    const lower = status.toLowerCase();
    if (lower.includes('accept') || lower.includes('pass')) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          <span>{status}</span>
        </span>
      );
    }
    if (lower.includes('error') || lower.includes('wrong') || lower.includes('fail')) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30">
          <XCircle className="w-3 h-3 text-rose-400" />
          <span>{status}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
        <AlertTriangle className="w-3 h-3 text-amber-400" />
        <span>{status}</span>
      </span>
    );
  };

  // Unauthenticated Banner View
  if (!user) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl bg-[#0d121f] border border-slate-800 p-8 text-center max-w-2xl mx-auto my-12 shadow-2xl">
          <div className="w-14 h-14 mx-auto rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
            <History className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Learning History & Session Persistence
          </h2>
          <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
            Sign in to track your persistent coding submissions, restore past editor states, and review comprehensive AI mock interview scorecards.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => openAuthModal('login')}
              className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold shadow-sm transition-all"
            >
              Sign In to Your Account
            </button>
            <button
              onClick={() => openAuthModal('register')}
              className="px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all"
            >
              Create Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Title & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-400" />
            <span>My History</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Review past coding sessions, restore your code to the editor, and review mock interview scorecards.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'code'
                ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Code Sessions ({codeTotal})</span>
          </button>
          <button
            onClick={() => setActiveTab('interviews')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'interviews'
                ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquareCode className="w-3.5 h-3.5" />
            <span>Interviews ({interviewTotal})</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CODE SESSIONS */}
      {/* ========================================================================= */}
      {activeTab === 'code' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d121f] p-3 rounded-xl border border-slate-800/80">
            <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
              {/* Search Query */}
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by title or code..."
                  value={codeSearch}
                  onChange={(e) => { setCodeSearch(e.target.value); setCodePage(1); }}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Language Dropdown Filter */}
              <div className="relative">
                <select
                  value={codeLanguage}
                  onChange={(e) => { setCodeLanguage(e.target.value); setCodePage(1); }}
                  className="appearance-none bg-slate-900 border border-slate-700/80 text-slate-200 text-xs rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="">All Languages</option>
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
                <Filter className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Refresh Button */}
            <button
              onClick={loadCodeSessions}
              disabled={isLoadingCode}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-400 hover:text-white transition-colors"
              title="Refresh sessions"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCode ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>

          {/* Error Message */}
          {codeError && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {codeError}
            </div>
          )}

          {/* Loading State */}
          {isLoadingCode && (
            <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              <span>Loading saved code sessions...</span>
            </div>
          )}

          {/* Empty State */}
          {!isLoadingCode && codeSessions.length === 0 && (
            <div className="rounded-2xl bg-[#0d121f] border border-slate-800/80 p-12 text-center max-w-lg mx-auto">
              <FileCode className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-300">No Code Sessions Found</h3>
              <p className="text-xs text-slate-500 mt-1">
                {codeSearch || codeLanguage 
                  ? 'No sessions matched your search filters. Try clearing your search.' 
                  : 'You have not saved any code sessions yet. Open the coding workspace and click "Save Session" to persist your work.'}
              </p>
              <button
                onClick={() => onNavigate('workspace')}
                className="mt-4 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors"
              >
                Go to Coding Workspace
              </button>
            </div>
          )}

          {/* Sessions Grid */}
          {!isLoadingCode && codeSessions.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {codeSessions.map((session) => (
                <div
                  key={session.id}
                  className="rounded-xl bg-[#0d121f] border border-slate-800/90 hover:border-slate-700 p-5 flex flex-col justify-between gap-4 transition-all hover:shadow-lg"
                >
                  <div className="space-y-2.5">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-white tracking-tight">
                          {session.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                          <span className="font-mono text-emerald-400 font-medium uppercase text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                            {session.language}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span>{formatDate(session.updated_at)}</span>
                          </span>
                        </div>
                      </div>
                      <div>{renderStatusBadge(session.execution_status)}</div>
                    </div>

                    {/* Preview snippet */}
                    <div className="bg-slate-950/80 rounded-lg p-2.5 border border-slate-800/80 font-mono text-[11px] text-slate-300 overflow-x-auto whitespace-pre">
                      {session.preview}
                    </div>

                    {/* AI analysis tag */}
                    {session.has_analysis && (
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        <span>AI Feedback Saved</span>
                      </div>
                    )}
                  </div>

                  {/* Actions Toolbar */}
                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800/80">
                    <button
                      onClick={() => handleViewCodeDetail(session.id)}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Details</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setItemToDelete({ id: session.id, type: 'code', title: session.title })}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800/60 transition-colors"
                        title="Delete session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRestoreToEditor(session.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-medium text-xs transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore to Editor</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {codeTotalPages > 1 && (
            <div className="flex items-center justify-between pt-2 text-xs text-slate-400">
              <span>Showing page {codePage} of {codeTotalPages} ({codeTotal} total)</span>
              <div className="flex items-center gap-1">
                <button
                  disabled={codePage <= 1}
                  onClick={() => setCodePage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded bg-slate-900 border border-slate-800 disabled:opacity-40 hover:bg-slate-800 text-slate-300"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={codePage >= codeTotalPages}
                  onClick={() => setCodePage((p) => Math.min(codeTotalPages, p + 1))}
                  className="p-1.5 rounded bg-slate-900 border border-slate-800 disabled:opacity-40 hover:bg-slate-800 text-slate-300"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: INTERVIEW SESSIONS */}
      {/* ========================================================================= */}
      {activeTab === 'interviews' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d121f] p-3 rounded-xl border border-slate-800/80">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Difficulty Dropdown */}
              <select
                value={interviewDifficulty}
                onChange={(e) => { setInterviewDifficulty(e.target.value); setInterviewPage(1); }}
                className="appearance-none bg-slate-900 border border-slate-700/80 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="">All Difficulties</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>

              {/* Topic Dropdown */}
              <select
                value={interviewTopic}
                onChange={(e) => { setInterviewTopic(e.target.value); setInterviewPage(1); }}
                className="appearance-none bg-slate-900 border border-slate-700/80 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="">All Topics</option>
                <option value="dsa">DSA & Algorithms</option>
                <option value="system_design">System Architecture</option>
                <option value="behavioral">Engineering Principles</option>
              </select>
            </div>

            {/* Refresh Button */}
            <button
              onClick={loadInterviewSessions}
              disabled={isLoadingInterviews}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-400 hover:text-white transition-colors"
              title="Refresh interviews"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingInterviews ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>

          {/* Error Message */}
          {interviewError && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {interviewError}
            </div>
          )}

          {/* Loading State */}
          {isLoadingInterviews && (
            <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              <span>Loading interview history...</span>
            </div>
          )}

          {/* Empty State */}
          {!isLoadingInterviews && interviewSessions.length === 0 && (
            <div className="rounded-2xl bg-[#0d121f] border border-slate-800/80 p-12 text-center max-w-lg mx-auto">
              <MessageSquareCode className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-300">No Interview Sessions Found</h3>
              <p className="text-xs text-slate-500 mt-1">
                You have not completed any AI mock interviews yet. Launch an interactive interview from your code to build your scorecard.
              </p>
              <button
                onClick={() => onNavigate('interview')}
                className="mt-4 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors"
              >
                Start an AI Interview
              </button>
            </div>
          )}

          {/* Interview Sessions Grid */}
          {!isLoadingInterviews && interviewSessions.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {interviewSessions.map((session) => (
                <div
                  key={session.id}
                  className="rounded-xl bg-[#0d121f] border border-slate-800/90 hover:border-slate-700 p-5 flex flex-col justify-between gap-4 transition-all hover:shadow-lg"
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
                          <span className="capitalize">{session.topic.replace('_', ' ')} Interview</span>
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {session.difficulty}
                          </span>
                        </h3>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            <span>{formatDate(session.created_at)}</span>
                          </span>
                        </div>
                      </div>

                      {/* Score Badge */}
                      {session.average_score !== null && session.average_score !== undefined ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-bold">
                          <Award className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{session.average_score.toFixed(0)}%</span>
                        </div>
                      ) : (
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700">
                          In Progress
                        </span>
                      )}
                    </div>

                    {/* Metrics row */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                      <div>
                        <p className="text-[10px] text-slate-500 font-mono uppercase">Questions Answered</p>
                        <p className="text-slate-200 font-semibold mt-0.5">
                          {session.questions_answered} of {session.num_questions}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 font-mono uppercase">Language</p>
                        <p className="text-slate-200 font-semibold mt-0.5 capitalize">
                          {session.language}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800/80">
                    <button
                      onClick={() => setItemToDelete({ id: session.id, type: 'interview', title: `${session.topic} (${session.difficulty})` })}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800/60 transition-colors"
                      title="Delete interview session"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleViewInterviewDetail(session.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-medium text-xs transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Review Scorecard</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {interviewTotalPages > 1 && (
            <div className="flex items-center justify-between pt-2 text-xs text-slate-400">
              <span>Showing page {interviewPage} of {interviewTotalPages} ({interviewTotal} total)</span>
              <div className="flex items-center gap-1">
                <button
                  disabled={interviewPage <= 1}
                  onClick={() => setInterviewPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded bg-slate-900 border border-slate-800 disabled:opacity-40 hover:bg-slate-800 text-slate-300"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={interviewPage >= interviewTotalPages}
                  onClick={() => setInterviewPage((p) => Math.min(interviewTotalPages, p + 1))}
                  className="p-1.5 rounded bg-slate-900 border border-slate-800 disabled:opacity-40 hover:bg-slate-800 text-slate-300"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* CODE SESSION DETAIL MODAL */}
      {/* ========================================================================= */}
      {selectedCodeDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-3xl max-h-[90vh] bg-[#0d121f] border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-semibold text-white tracking-tight">
                  {selectedCodeDetail.title}
                </h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                  <span className="font-mono text-emerald-400 uppercase text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                    {selectedCodeDetail.language}
                  </span>
                  <span>•</span>
                  <span>Saved on {formatDate(selectedCodeDetail.updated_at)}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedCodeDetail(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Source Code */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
                    Source Code
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {selectedCodeDetail.source_code.split('\n').length} lines
                  </span>
                </div>
                <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono text-slate-200 overflow-x-auto max-h-64 leading-relaxed">
                  {selectedCodeDetail.source_code}
                </pre>
              </div>

              {/* Execution Telemetry */}
              {selectedCodeDetail.execution_status && (
                <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300 font-mono uppercase">
                      Execution Result
                    </span>
                    {renderStatusBadge(selectedCodeDetail.execution_status)}
                  </div>
                  {selectedCodeDetail.stdout && (
                    <div>
                      <p className="text-[10px] text-slate-400 font-mono">Standard Output:</p>
                      <pre className="mt-1 bg-slate-950 p-2.5 rounded border border-slate-800/80 text-xs font-mono text-emerald-300 overflow-x-auto">
                        {selectedCodeDetail.stdout}
                      </pre>
                    </div>
                  )}
                  {selectedCodeDetail.stderr && (
                    <div>
                      <p className="text-[10px] text-rose-400 font-mono">Standard Error:</p>
                      <pre className="mt-1 bg-slate-950 p-2.5 rounded border border-rose-900/50 text-xs font-mono text-rose-300 overflow-x-auto">
                        {selectedCodeDetail.stderr}
                      </pre>
                    </div>
                  )}
                  {selectedCodeDetail.compile_output && (
                    <div>
                      <p className="text-[10px] text-amber-400 font-mono">Compiler Output:</p>
                      <pre className="mt-1 bg-slate-950 p-2.5 rounded border border-amber-900/50 text-xs font-mono text-amber-300 overflow-x-auto">
                        {selectedCodeDetail.compile_output}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* AI Analysis Summary */}
              {selectedCodeDetail.analysis_summary && (
                <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                    <Sparkles className="w-4 h-4" />
                    <span>AI Mentor Analysis Summary</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {selectedCodeDetail.analysis_summary}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-900/40 shrink-0">
              <button
                onClick={() => setSelectedCodeDetail(null)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const id = selectedCodeDetail.id;
                  setSelectedCodeDetail(null);
                  handleRestoreToEditor(id);
                }}
                className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore to Editor</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* INTERVIEW SCORECARD MODAL */}
      {/* ========================================================================= */}
      {selectedInterviewDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-3xl max-h-[90vh] bg-[#0d121f] border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
                  <Award className="w-5 h-5 text-emerald-400" />
                  <span>Interview Session Scorecard</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Topic: <strong className="text-slate-200 capitalize">{selectedInterviewDetail.topic}</strong> • Difficulty: <span className="capitalize">{selectedInterviewDetail.difficulty}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedInterviewDetail(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Questions & Candidate Answers */}
              <div className="space-y-4">
                {selectedInterviewDetail.questions?.map((qItem: any, idx: number) => (
                  <div key={idx} className="bg-slate-900/60 rounded-xl p-4 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-400 font-mono">
                        Question {idx + 1}
                      </span>
                      {qItem.evaluation?.score !== undefined && (
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          Score: {qItem.evaluation.score}/100
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-slate-200">
                      {qItem.question?.question_text}
                    </p>

                    {/* Candidate Answer */}
                    {qItem.evaluation && (
                      <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-xs">
                        <p className="text-slate-400">
                          <strong className="text-slate-300">Feedback:</strong> {qItem.evaluation.feedback}
                        </p>
                        {qItem.evaluation.suggested_improvements && (
                          <p className="text-slate-400">
                            <strong className="text-slate-300">Suggestions:</strong> {qItem.evaluation.suggested_improvements}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 flex justify-end bg-slate-900/40 shrink-0">
              <button
                onClick={() => setSelectedInterviewDetail(null)}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION DIALOG */}
      {/* ========================================================================= */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[#0d121f] border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Confirm Deletion</h3>
                <p className="text-xs text-slate-400">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <strong className="text-white">"{itemToDelete.title}"</strong>? All associated telemetry and saved AI feedback will be removed from your account.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white font-semibold text-xs transition-colors flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Record</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Detail Overlay */}
      {isLoadingDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="flex items-center gap-2.5 px-4 py-3 bg-[#0d121f] border border-slate-800 rounded-xl text-slate-200 text-xs shadow-xl">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            <span>Loading session details...</span>
          </div>
        </div>
      )}
    </div>
  );
};
