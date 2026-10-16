import React from 'react';
import { 
  Play, 
  RotateCcw, 
  Loader2,
  ChevronDown,
  ListOrdered,
  Bookmark,
  Bug,
  Lightbulb,
  FileCode2,
  Columns2,
  Rows2
} from 'lucide-react';
import type { SupportedLanguageId } from '../../types';
import { SUPPORTED_LANGUAGES } from '../../constants/languages';

interface WorkspaceHeaderProps {
  selectedLanguage: SupportedLanguageId;
  onLanguageChange: (lang: SupportedLanguageId) => void;
  onRunCode: () => void;
  onRunAllTests: () => void;
  onFindBugs: () => void;
  onGetHint: () => void;
  onLoadExample: () => void;
  onResetCode: () => void;
  onSaveSession?: () => void;
  isRunning: boolean;
  isRunningTests: boolean;
  isAnalyzing: boolean;
  isSavingSession?: boolean;
  layoutMode?: 'horizontal' | 'vertical';
  onToggleLayout?: () => void;
}

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  selectedLanguage,
  onLanguageChange,
  onRunCode,
  onRunAllTests,
  onFindBugs,
  onGetHint,
  onLoadExample,
  onResetCode,
  onSaveSession,
  isRunning,
  isRunningTests,
  isAnalyzing,
  isSavingSession,
  layoutMode,
  onToggleLayout,
}) => {
  const isBusy = isRunning || isRunningTests || isAnalyzing;

  return (
    <div className="bg-[#0e1422] border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 select-none">
      {/* Left: Language Selection & Example Starter */}
      <div className="flex items-center gap-2">
        {/* Language Selector Dropdown */}
        <div className="relative inline-flex items-center">
          <select
            id="workspace-language-select"
            value={selectedLanguage}
            onChange={(e) => onLanguageChange(e.target.value as SupportedLanguageId)}
            className="appearance-none bg-slate-900 border border-slate-700 text-slate-200 text-xs font-mono rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer hover:bg-slate-850"
            title="Choose programming language"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id} className="bg-slate-900 text-slate-200">
                {lang.name} ({lang.extension})
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 pointer-events-none" />
        </div>

        {/* Load Example Action */}
        <button
          onClick={onLoadExample}
          disabled={isBusy}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-300 hover:text-white transition-colors"
          title="Load a sample problem in this language"
        >
          <FileCode2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Load Example</span>
        </button>

        {/* Reset / Clear Code */}
        <button
          onClick={onResetCode}
          disabled={isBusy}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-400 hover:text-rose-300 transition-colors"
          title="Clear editor to start fresh"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Clear</span>
        </button>
      </div>

      {/* Right: Learning Actions & Execution */}
      <div className="flex flex-wrap items-center gap-2">
        {/* 1. Get a Hint */}
        <button
          id="workspace-hint-button"
          onClick={onGetHint}
          disabled={isBusy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-xs text-amber-300 font-medium transition-colors"
          title="Get a gentle hint without giving away the full answer"
        >
          {isAnalyzing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
          ) : (
            <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
          )}
          <span>Get a Hint</span>
        </button>

        {/* 2. Find Bugs */}
        <button
          id="workspace-find-bugs-button"
          onClick={onFindBugs}
          disabled={isBusy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-xs text-rose-300 font-medium transition-colors"
          title="Ask AI to find logical or edge case bugs in your code"
        >
          {isAnalyzing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
          ) : (
            <Bug className="w-3.5 h-3.5 text-rose-400" />
          )}
          <span>Find Bugs</span>
        </button>

        {/* 3. Run Tests */}
        <button
          id="workspace-run-tests-button"
          onClick={onRunAllTests}
          disabled={isBusy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-700 text-xs text-slate-200 hover:text-white transition-colors"
          title="Run code against configured test cases"
        >
          {isRunningTests ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
          ) : (
            <ListOrdered className="w-3.5 h-3.5 text-emerald-400" />
          )}
          <span>Run Tests</span>
        </button>

        {/* Layout Mode Toggle */}
        {onToggleLayout && (
          <button
            onClick={onToggleLayout}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-300 hover:text-white transition-colors"
            title={layoutMode === 'horizontal' ? 'Switch to Stacked View (Top/Bottom)' : 'Switch to Side-by-Side View (Columns)'}
          >
            {layoutMode === 'horizontal' ? (
              <>
                <Columns2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden xl:inline">Side-by-Side</span>
              </>
            ) : (
              <>
                <Rows2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden xl:inline">Stacked</span>
              </>
            )}
          </button>
        )}

        {/* 4. Save Session */}
        {onSaveSession && (
          <button
            id="workspace-save-session-button"
            onClick={onSaveSession}
            disabled={isSavingSession || isBusy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-300 hover:text-emerald-400 transition-colors"
            title="Save your work to My History"
          >
            {isSavingSession ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            ) : (
              <Bookmark className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span className="hidden sm:inline">Save</span>
          </button>
        )}

        {/* 5. Primary: Run Code */}
        <button
          id="workspace-run-button"
          onClick={onRunCode}
          disabled={isBusy}
          className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all ${
            isRunning
              ? 'bg-emerald-500/50 text-slate-950 cursor-not-allowed'
              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 active:translate-y-0.5'
          }`}
          title="Run code with standard input"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Running...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Code</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
