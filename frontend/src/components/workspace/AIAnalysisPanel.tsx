import React, { useState } from 'react';
import { 
  Bug, 
  HelpCircle, 
  Lightbulb, 
  Zap, 
  Clock, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  AlertTriangle,
  ExternalLink,
  Code2
} from 'lucide-react';
import type { AnalyzeResponse } from '../../types';

export type SimpleAnalysisSection = 
  | 'what_is_wrong' 
  | 'why_it_happens' 
  | 'how_to_fix' 
  | 'better_solution' 
  | 'complexity';

interface AIAnalysisPanelProps {
  analysis: AnalyzeResponse | null;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  activeSection?: SimpleAnalysisSection;
  onSectionChange?: (sec: SimpleAnalysisSection) => void;
  onApplySolution?: (code: string) => void;
}

export const AIAnalysisPanel: React.FC<AIAnalysisPanelProps> = ({
  analysis,
  isAnalyzing,
  onAnalyze,
  activeSection = 'what_is_wrong',
  onSectionChange,
  onApplySolution,
}) => {
  const [internalSection, setInternalSection] = useState<SimpleAnalysisSection>(activeSection);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showSolutionCode, setShowSolutionCode] = useState(false);

  const currentSection = onSectionChange ? activeSection : internalSection;
  const setSection = (sec: SimpleAnalysisSection) => {
    if (onSectionChange) {
      onSectionChange(sec);
    } else {
      setInternalSection(sec);
    }
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // 1. Loading State: Friendly student message
  if (isAnalyzing) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3 animate-pulse">
          <Sparkles className="w-6 h-6 animate-spin text-emerald-400" />
        </div>
        <h3 className="text-sm font-semibold text-white tracking-tight">
          Your AI Coding Mentor is reviewing your code...
        </h3>
        <p className="text-xs text-slate-400 mt-1 max-w-md">
          Checking your logic, finding edge-case bugs, and preparing step-by-step guidance.
        </p>
      </div>
    );
  }

  // 2. Empty State
  if (!analysis) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-3">
          <Lightbulb className="w-6 h-6 text-amber-400" />
        </div>
        <h3 className="text-sm font-semibold text-white tracking-tight">
          Ready for AI Guidance
        </h3>
        <p className="text-xs text-slate-400 mt-1 max-w-md">
          Click <strong>Find Bugs</strong> to check for logic errors, or <strong>Get a Hint</strong> to receive guided suggestions without spoiling the solution.
        </p>
        <div className="flex gap-2 mt-4">
          <button
            onClick={onAnalyze}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold shadow-sm transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Analyze My Code</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. Unavailable Provider State
  if (analysis.status === 'Unavailable') {
    return (
      <div className="h-full flex flex-col justify-center p-6">
        <div className="max-w-md mx-auto w-full bg-slate-900/90 border border-amber-500/40 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>AI Mentor Not Configured</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Please configure your free Groq API key in <code className="text-emerald-400 font-mono">backend/.env</code> to activate AI code feedback.
          </p>
          <div className="flex items-center justify-between pt-1">
            <a
              href="https://console.groq.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-emerald-400 hover:underline inline-flex items-center gap-1"
            >
              <span>Get API Key</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <button
              onClick={onAnalyze}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const bugs = analysis.bugs || [];
  const opt = analysis.optimized_solution;
  const comp = analysis.complexity_analysis;
  const learning = analysis.learning_explanation;
  const testAnalysis = analysis.test_analysis;

  return (
    <div className="h-full flex flex-col select-text font-sans">
      {/* 5 Simple, Beginner-Friendly Tabs */}
      <div className="flex items-center gap-1.5 pb-2 border-b border-slate-800 overflow-x-auto no-scrollbar shrink-0">
        <button
          onClick={() => setSection('what_is_wrong')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            currentSection === 'what_is_wrong'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Bug className="w-3.5 h-3.5 text-rose-400" />
          <span>What is wrong?</span>
          {bugs.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-rose-500/30 text-rose-200">
              {bugs.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setSection('why_it_happens')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            currentSection === 'why_it_happens'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
          <span>Why does it happen?</span>
        </button>

        <button
          onClick={() => setSection('how_to_fix')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            currentSection === 'how_to_fix'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Lightbulb className="w-3.5 h-3.5 text-emerald-400" />
          <span>How can I fix it?</span>
        </button>

        <button
          onClick={() => setSection('better_solution')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            currentSection === 'better_solution'
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-sky-400" />
          <span>Better solution</span>
        </button>

        <button
          onClick={() => setSection('complexity')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            currentSection === 'complexity'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-purple-400" />
          <span>Complexity</span>
        </button>
      </div>

      {/* Main Section Content */}
      <div className="flex-1 overflow-y-auto pt-3 pr-1 text-xs text-slate-200 space-y-3">
        {/* ========================================================================= */}
        {/* SECTION 1: WHAT IS WRONG? */}
        {/* ========================================================================= */}
        {currentSection === 'what_is_wrong' && (
          <div className="space-y-3">
            {bugs.length === 0 ? (
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 space-y-1">
                <p className="font-semibold text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>No obvious bugs detected!</span>
                </p>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Your code syntax and structure look solid. Run your test cases to check for any boundary inputs or edge cases.
                </p>
              </div>
            ) : (
              bugs.map((bug, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-rose-300 text-xs flex items-center gap-1.5">
                      <Bug className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>{bug.title}</span>
                    </h4>
                    {bug.line_number && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        Line {bug.line_number}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-300 text-xs leading-relaxed">
                    {bug.description}
                  </p>
                </div>
              ))
            )}

            {/* Test Case Failure Explanations if any */}
            {testAnalysis?.failed_test_explanations && testAnalysis.failed_test_explanations.length > 0 && (
              <div className="mt-4 space-y-2">
                <h4 className="font-semibold text-slate-300 text-xs">Failed Test Case Insights:</h4>
                {testAnalysis.failed_test_explanations.map((ft, i) => (
                  <div key={i} className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1">
                    <p className="font-medium text-amber-300">{ft.name}</p>
                    <p className="text-slate-300 text-[11px]">{ft.explanation}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION 2: WHY DOES IT HAPPEN? */}
        {/* ========================================================================= */}
        {currentSection === 'why_it_happens' && (
          <div className="space-y-3">
            {bugs.length > 0 ? (
              bugs.map((bug, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                  <h4 className="font-semibold text-amber-300 text-xs flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Root Cause for "{bug.title}":</span>
                  </h4>
                  <p className="text-slate-300 text-xs leading-relaxed">
                    {bug.root_cause || "This happens when the program encounters unexpected input values or loop boundary conditions."}
                  </p>
                </div>
              ))
            ) : (
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1 text-slate-300">
                <p className="font-medium text-xs text-white">General Code Architecture:</p>
                <p className="text-[11px] leading-relaxed">
                  {analysis.code_review?.summary || "Your code follows the expected algorithmic pattern without major structural flaws."}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION 3: HOW CAN I FIX IT? (Hints & Guidance) */}
        {/* ========================================================================= */}
        {currentSection === 'how_to_fix' && (
          <div className="space-y-3">
            {/* Actionable suggestions from bugs */}
            {bugs.map((bug, idx) => (
              <div key={idx} className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-1.5">
                <h4 className="font-semibold text-emerald-300 text-xs flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Suggestion for "{bug.title}":</span>
                </h4>
                <p className="text-slate-300 text-xs leading-relaxed">
                  {bug.suggestion}
                </p>
              </div>
            ))}

            {/* Mentor Tips (gentle learning hints) */}
            {learning?.mentor_tips && learning.mentor_tips.length > 0 && (
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <h4 className="font-semibold text-white text-xs flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Tutor Advice & Key Concepts</span>
                </h4>
                <ul className="space-y-1.5">
                  {learning.mentor_tips.map((tip, i) => (
                    <li key={i} className="text-slate-300 text-[11px] flex items-start gap-2">
                      <span className="text-emerald-400">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION 4: BETTER SOLUTION */}
        {/* ========================================================================= */}
        {currentSection === 'better_solution' && (
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-white text-xs flex items-center gap-2">
                  <Zap className="w-4 h-4 text-sky-400" />
                  <span>{opt?.is_optimization_needed ? 'Recommended Optimal Solution' : 'Solution Status'}</span>
                </h4>
                {opt?.optimized_code && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(opt.optimized_code || '')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition-colors"
                      title="Copy solution code"
                    >
                      {copiedCode ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-400" />
                          <span>Copy Solution</span>
                        </>
                      )}
                    </button>

                    {onApplySolution && (
                      <button
                        onClick={() => {
                          if (window.confirm("Do you want to apply this solution to your code editor? This will update your editor code.")) {
                            onApplySolution(opt.optimized_code || '');
                          }
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-[11px] text-emerald-300 border border-emerald-500/30 transition-colors"
                        title="Apply solution code to editor"
                      >
                        <Code2 className="w-3 h-3 text-emerald-400" />
                        <span>Apply to Editor</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {opt?.explanation || "Your current implementation is sound! Check the Complexity tab for Big-O metrics."}
              </p>

              {opt?.optimized_code && (
                <div className="pt-2">
                  <button
                    onClick={() => setShowSolutionCode(!showSolutionCode)}
                    className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 font-medium mb-2"
                  >
                    <span>{showSolutionCode ? 'Hide Solution Code' : 'Reveal Solution Code (Spoiler)'}</span>
                    {showSolutionCode ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {showSolutionCode && (
                    <pre className="p-3 rounded-lg bg-[#0a0e17] border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto leading-relaxed">
                      <code>{opt.optimized_code}</code>
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION 5: TIME & SPACE COMPLEXITY */}
        {/* ========================================================================= */}
        {currentSection === 'complexity' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[11px] text-slate-400 font-medium">Time Complexity</span>
                <p className="text-xl font-bold font-mono text-emerald-400">
                  {comp?.original_time_complexity || 'O(N)'}
                </p>
                <p className="text-[11px] text-slate-300 leading-relaxed pt-1">
                  {comp?.time_justification || "Time complexity reflects the number of operations relative to the input size."}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[11px] text-slate-400 font-medium">Space (Memory) Complexity</span>
                <p className="text-xl font-bold font-mono text-purple-400">
                  {comp?.original_space_complexity || 'O(1)'}
                </p>
                <p className="text-[11px] text-slate-300 leading-relaxed pt-1">
                  {comp?.space_justification || "Space complexity reflects auxiliary memory allocated during execution."}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
