import React, { useState } from 'react';
import { 
  Play, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  HardDrive,
  Loader2,
  FileCode2,
  HelpCircle
} from 'lucide-react';
import type { TestCase, TestSuiteSummary } from '../../types';

interface TestCasesPanelProps {
  testCases: TestCase[];
  summary: TestSuiteSummary | null;
  isRunningTests: boolean;
  onRunAllTests: () => void;
  onRunSingleTest: (id: string) => void;
  onAddTestCase: () => void;
  onUpdateTestCase: (id: string, updates: Partial<TestCase>) => void;
  onDeleteTestCase: (id: string) => void;
}

export const TestCasesPanel: React.FC<TestCasesPanelProps> = ({
  testCases,
  summary,
  isRunningTests,
  onRunAllTests,
  onRunSingleTest,
  onAddTestCase,
  onUpdateTestCase,
  onDeleteTestCase,
}) => {
  const [selectedCaseId, setSelectedCaseId] = useState<string>(
    testCases[0]?.id || ''
  );

  // If selected case was deleted or empty, keep it synced
  const activeCase = testCases.find((tc) => tc.id === selectedCaseId) || testCases[0];

  const getStatusIcon = (status: TestCase['status']) => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-3.5 h-3.5 text-sky-400 animate-spin shrink-0" />;
      case 'passed':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case 'failed':
        return <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
      case 'compilation_error':
      case 'runtime_error':
        return <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case 'time_limit_exceeded':
        return <Clock className="w-3.5 h-3.5 text-orange-400 shrink-0" />;
      case 'unavailable':
        return <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
      default:
        return <span className="w-2 h-2 rounded-full bg-slate-600 shrink-0" />;
    }
  };

  const getStatusBadge = (tc: TestCase) => {
    switch (tc.status) {
      case 'passed':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Passed
          </span>
        );
      case 'failed':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1">
            <XCircle className="w-3 h-3 text-rose-400" />
            Failed (Wrong Answer)
          </span>
        );
      case 'compilation_error':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-amber-400" />
            Compilation Error
          </span>
        );
      case 'runtime_error':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-amber-400" />
            Runtime Error
          </span>
        );
      case 'time_limit_exceeded':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-orange-500/15 text-orange-300 border border-orange-500/30 flex items-center gap-1">
            <Clock className="w-3 h-3 text-orange-400" />
            Time Limit Exceeded
          </span>
        );
      case 'unavailable':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
            <HelpCircle className="w-3 h-3 text-slate-400" />
            Provider Unavailable
          </span>
        );
      case 'running':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-sky-500/15 text-sky-300 border border-sky-500/30 flex items-center gap-1">
            <Loader2 className="w-3 h-3 text-sky-400 animate-spin" />
            Evaluating...
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700/60">
            Not Run
          </span>
        );
    }
  };

  return (
    <div className="h-full flex flex-col font-sans select-text">
      {/* 1. Header Toolbar with Stats & Global Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80 shrink-0">
        <div className="flex items-center gap-3">
          {summary && summary.completed ? (
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                summary.passed === summary.total
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              }`}>
                {summary.passed}/{summary.total} Passed
              </span>
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                {summary.passed === summary.total
                  ? 'All test cases passed successfully'
                  : `${summary.failed} failed, ${summary.errors} error(s)`}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <FileCode2 className="w-4 h-4 text-emerald-400" />
              <span>{testCases.length} Test Case{testCases.length === 1 ? '' : 's'} Configured</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Add Test Case Button */}
          <button
            onClick={onAddTestCase}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-850 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-300 hover:text-white transition-colors"
            title="Add a new test case"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Case</span>
          </button>

          {/* Run All Tests Button */}
          <button
            onClick={onRunAllTests}
            disabled={isRunningTests || testCases.length === 0}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold shadow-sm transition-all ${
              isRunningTests
                ? 'bg-emerald-600/50 text-slate-900 cursor-not-allowed'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-950/30 active:translate-y-0.5'
            }`}
          >
            {isRunningTests ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Running Tests...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run All Tests</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Test Case Tab Pills */}
      <div className="flex items-center gap-1.5 py-2 overflow-x-auto no-scrollbar shrink-0 border-b border-slate-800/60">
        {testCases.map((tc, idx) => {
          const isSelected = activeCase?.id === tc.id;
          return (
            <button
              key={tc.id}
              onClick={() => setSelectedCaseId(tc.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all border ${
                isSelected
                  ? 'bg-slate-800 text-slate-100 border-emerald-500/50 shadow-sm'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-850 border-slate-800'
              }`}
            >
              {getStatusIcon(tc.status)}
              <span>{tc.name || `Case ${idx + 1}`}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Selected Case Detail View & Execution Results */}
      {activeCase ? (
        <div className="flex-1 overflow-y-auto pt-2.5 space-y-3 pr-1">
          {/* Top row: Case Name, Status Badge, Case Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0d121f] p-2.5 rounded-lg border border-slate-800/90">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <input
                type="text"
                value={activeCase.name}
                onChange={(e) => onUpdateTestCase(activeCase.id, { name: e.target.value })}
                placeholder="Test Case Name"
                className="bg-slate-900 border border-slate-700/80 rounded px-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-emerald-500/80 font-medium flex-1 max-w-sm"
              />
              {getStatusBadge(activeCase)}
            </div>

            <div className="flex items-center gap-2">
              {/* Telemetry if available */}
              {activeCase.executionTime !== undefined && activeCase.executionTime !== null && (
                <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  <Clock className="w-3 h-3 text-emerald-400" />
                  <span>{activeCase.executionTime}s</span>
                </div>
              )}
              {activeCase.memoryUsed !== undefined && activeCase.memoryUsed !== null && (
                <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  <HardDrive className="w-3 h-3 text-sky-400" />
                  <span>{activeCase.memoryUsed}KB</span>
                </div>
              )}

              {/* Run this single case */}
              <button
                onClick={() => onRunSingleTest(activeCase.id)}
                disabled={isRunningTests || activeCase.status === 'running'}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 transition-colors"
                title="Run this specific test case"
              >
                {activeCase.status === 'running' ? (
                  <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                ) : (
                  <Play className="w-3 h-3 text-emerald-400 fill-current" />
                )}
                <span>Run Test</span>
              </button>

              {/* Delete case button */}
              {testCases.length > 1 && (
                <button
                  onClick={() => onDeleteTestCase(activeCase.id)}
                  className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                  title="Delete this test case"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Two-column layout: Input & Expected Output */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Standard Input (stdin) */}
            <div className="flex flex-col space-y-1">
              <label className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
                <span>Standard Input (stdin)</span>
                <span className="text-[10px] text-slate-400">Passed via stream</span>
              </label>
              <textarea
                value={activeCase.stdin}
                onChange={(e) => onUpdateTestCase(activeCase.id, { stdin: e.target.value, status: 'idle' })}
                placeholder="Enter input tokens, arguments, or multiline text..."
                rows={3}
                className="w-full p-2 bg-[#0e1422] border border-slate-800 rounded-lg text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500/60 resize-y"
                spellCheck={false}
              />
            </div>

            {/* Expected Output */}
            <div className="flex flex-col space-y-1">
              <label className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
                <span>Expected Output</span>
                <span className="text-[10px] text-slate-400">Normalized matching</span>
              </label>
              <textarea
                value={activeCase.expectedOutput}
                onChange={(e) => onUpdateTestCase(activeCase.id, { expectedOutput: e.target.value, status: 'idle' })}
                placeholder="Enter expected stdout to match against..."
                rows={3}
                className="w-full p-2 bg-[#0e1422] border border-slate-800 rounded-lg text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500/60 resize-y"
                spellCheck={false}
              />
            </div>
          </div>

          {/* Actual Execution Result Display */}
          {activeCase.status !== 'idle' && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-300">
                  Actual Sandbox Output
                </span>
                {activeCase.status === 'passed' && (
                  <span className="text-[11px] text-emerald-400 font-medium">
                    ✓ Matches normalized expected output
                  </span>
                )}
                {activeCase.status === 'failed' && (
                  <span className="text-[11px] text-rose-400 font-medium">
                    ✕ Normalized output did not match expected
                  </span>
                )}
              </div>

              {/* Actual Output Box */}
              <div className={`p-3 rounded-lg font-mono text-xs whitespace-pre-wrap leading-relaxed border ${
                activeCase.status === 'passed'
                  ? 'bg-emerald-950/15 border-emerald-500/30 text-emerald-200'
                  : activeCase.status === 'failed'
                  ? 'bg-rose-950/15 border-rose-500/30 text-rose-200'
                  : activeCase.status === 'compilation_error' || activeCase.status === 'runtime_error'
                  ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                  : 'bg-[#0e1422] border-slate-800 text-slate-300'
              }`}>
                {activeCase.actualOutput || activeCase.compileOutput || activeCase.errorMessage || (
                  <span className="text-slate-400 italic">No output produced</span>
                )}
              </div>

              {/* Diagnostic Message if Error / Unavailable */}
              {activeCase.errorMessage && activeCase.status !== 'failed' && (
                <div className="p-2.5 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-300 font-sans">
                  <span className="font-semibold text-slate-200">Diagnostics: </span>
                  {activeCase.errorMessage}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="h-full flex items-center justify-center text-slate-400 text-xs">
          No test case selected. Click "Add Case" to create one.
        </div>
      )}
    </div>
  );
};
