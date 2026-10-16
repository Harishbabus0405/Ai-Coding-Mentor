import React, { useState } from 'react';
import { 
  Terminal, 
  AlertTriangle, 
  FileInput, 
  Trash2, 
  Copy, 
  Check, 
  Info, 
  Maximize2, 
  Minimize2, 
  CheckCircle2, 
  PanelBottomClose,
  PanelBottomOpen,
  ListOrdered,
  Sparkles
} from 'lucide-react';
import type { 
  ConsoleTab, 
  ExecutionResponse, 
  TestCase, 
  TestSuiteSummary,
  AnalyzeResponse 
} from '../../types';
import { TestCasesPanel } from './TestCasesPanel';
import { AIAnalysisPanel, type SimpleAnalysisSection } from './AIAnalysisPanel';

interface ConsolePanelProps {
  activeTab: ConsoleTab;
  onTabChange: (tab: ConsoleTab) => void;
  stdin: string;
  onStdinChange: (val: string) => void;
  executionResult: ExecutionResponse | null;
  onClearConsole: () => void;
  // Test Case Integration Props
  testCases: TestCase[];
  testSuiteSummary: TestSuiteSummary | null;
  isRunningTests: boolean;
  onRunAllTests: () => void;
  onRunSingleTest: (id: string) => void;
  onAddTestCase: () => void;
  onUpdateTestCase: (id: string, updates: Partial<TestCase>) => void;
  onDeleteTestCase: (id: string) => void;
  // AI Guidance Props
  analysis: AnalyzeResponse | null;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  analysisSection?: SimpleAnalysisSection;
  onSectionChange?: (sec: SimpleAnalysisSection) => void;
  onApplySolution?: (code: string) => void;
  layoutMode?: 'horizontal' | 'vertical';
}

export const ConsolePanel: React.FC<ConsolePanelProps> = ({
  activeTab,
  onTabChange,
  stdin,
  onStdinChange,
  executionResult,
  onClearConsole,
  testCases,
  testSuiteSummary,
  isRunningTests,
  onRunAllTests,
  onRunSingleTest,
  onAddTestCase,
  onUpdateTestCase,
  onDeleteTestCase,
  analysis,
  isAnalyzing,
  onAnalyze,
  analysisSection,
  onSectionChange,
  onApplySolution,
  layoutMode = 'horizontal',
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // When tab is clicked, ensure panel is not collapsed
  const handleTabClick = (tab: ConsoleTab) => {
    setIsCollapsed(false);
    onTabChange(tab);
  };

  // Default to expanded height when viewing AI Analysis for plenty of room, unless user explicitly toggled it
  const isExpanded = userExpanded !== null ? userExpanded : activeTab === 'analysis';

  const hasOutput = Boolean(executionResult?.stdout && executionResult.stdout.trim().length > 0);
  const hasError = Boolean(
    executionResult?.compile_output || 
    (executionResult?.stderr && executionResult.stderr.trim().length > 0) ||
    (executionResult?.status && !['Accepted', 'idle'].includes(executionResult.status))
  );

  const handleCopyCurrentTab = () => {
    let textToCopy = '';
    if (activeTab === 'input') {
      textToCopy = stdin;
    } else if (activeTab === 'output') {
      textToCopy = executionResult?.stdout || '';
    } else if (activeTab === 'errors') {
      textToCopy = [
        executionResult?.compile_output,
        executionResult?.stderr,
        executionResult?.message
      ].filter(Boolean).join('\n\n');
    }

    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`bg-[#0b0f19] flex flex-col select-none transition-all duration-200 min-h-0 ${
      layoutMode === 'horizontal'
        ? 'w-full h-full flex-1 border-t lg:border-t-0 lg:border-l border-slate-800 overflow-hidden'
        : `w-full border-t border-slate-800 shrink-0 ${
            isCollapsed 
              ? 'h-10 overflow-hidden' 
              : (isExpanded ? 'h-80 sm:h-96' : 'h-52 sm:h-64')
          }`
    }`}>
      {/* Panel Tab Navigation Bar */}
      <div className="bg-[#0e1422] border-b border-slate-800/90 px-3 flex items-center justify-between shrink-0 h-10">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {/* Tab 0: Test Cases */}
          <button
            onClick={() => handleTabClick('testcases')}
            className={`flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium border-b-2 transition-colors shrink-0 ${
              activeTab === 'testcases'
                ? 'border-emerald-500 text-emerald-300 bg-slate-900/40'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>Tests</span>
            {testSuiteSummary && testSuiteSummary.completed ? (
              <span className={`px-1 py-0.2 rounded-full text-[10px] font-mono border ${
                testSuiteSummary.passed === testSuiteSummary.total
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
              }`}>
                {testSuiteSummary.passed}/{testSuiteSummary.total}
              </span>
            ) : (
              <span className="px-1 py-0.2 rounded-full text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700/60">
                {testCases.length}
              </span>
            )}
          </button>

          {/* Tab 1: Input */}
          <button
            onClick={() => handleTabClick('input')}
            className={`flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium border-b-2 transition-colors shrink-0 ${
              activeTab === 'input'
                ? 'border-emerald-500 text-emerald-300 bg-slate-900/40'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
            }`}
          >
            <FileInput className="w-3.5 h-3.5" />
            <span>Input</span>
            {stdin.trim().length > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            )}
          </button>

          {/* Tab 2: Output */}
          <button
            onClick={() => handleTabClick('output')}
            className={`flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium border-b-2 transition-colors shrink-0 ${
              activeTab === 'output'
                ? 'border-emerald-500 text-emerald-300 bg-slate-900/40'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Output</span>
            {hasOutput && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            )}
          </button>

          {/* Tab 3: Errors */}
          <button
            onClick={() => handleTabClick('errors')}
            className={`flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium border-b-2 transition-colors shrink-0 ${
              activeTab === 'errors'
                ? 'border-rose-500 text-rose-300 bg-slate-900/40'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>Errors</span>
            {hasError && (
              <span className="px-1 py-0.2 rounded-full text-[10px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30">
                !
              </span>
            )}
          </button>

          {/* Tab 4: AI Guidance */}
          <button
            onClick={() => handleTabClick('analysis')}
            className={`flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium border-b-2 transition-colors shrink-0 ${
              activeTab === 'analysis'
                ? 'border-emerald-400 text-emerald-300 bg-emerald-950/20'
                : 'border-transparent text-slate-400 hover:text-emerald-300 hover:bg-slate-900/20'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin text-emerald-400' : 'text-emerald-400'}`} />
            <span>AI Mentor</span>
            {analysis && (
              <span className="px-1 py-0.2 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {analysis.bugs?.length ? `${analysis.bugs.length}` : 'Ready'}
              </span>
            )}
          </button>
        </div>

        {/* Panel Action Controls */}
        <div className="flex items-center gap-1.5 py-1 shrink-0">
          {/* Execution telemetry if available */}
          {executionResult && (
            <div className="hidden md:flex items-center gap-1.5 text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
              {executionResult.status === 'Accepted' && (
                <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3 h-3" />
                  OK
                </span>
              )}
              {executionResult.status && executionResult.status !== 'Accepted' && (
                <span className="text-rose-400 flex items-center gap-1 font-semibold">
                  {executionResult.status}
                </span>
              )}
              {executionResult.execution_time !== undefined && executionResult.execution_time !== null && (
                <span className="text-slate-300 border-l border-slate-700/60 pl-1.5">
                  {executionResult.execution_time}s
                </span>
              )}
            </div>
          )}

          {/* Copy active tab text (for input, output, errors) */}
          {activeTab !== 'testcases' && activeTab !== 'analysis' && (
            <button
              onClick={handleCopyCurrentTab}
              title="Copy current tab contents"
              className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {/* Vertical Collapse / Restore Toggle */}
          {layoutMode === 'vertical' && (
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              title={isCollapsed ? 'Open output panel' : 'Minimize output panel'}
              className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              {isCollapsed ? (
                <PanelBottomOpen className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <PanelBottomClose className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {/* Expand / Collapse Height Toggle */}
          {layoutMode === 'vertical' && (
            <button
              onClick={() => {
                setIsCollapsed(false);
                setUserExpanded(!isExpanded);
              }}
              title={isExpanded ? 'Collapse panel height' : 'Expand panel height'}
              className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors hidden sm:block"
            >
              {isExpanded ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {/* Clear Console */}
          <button
            onClick={onClearConsole}
            title="Clear output and error messages"
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-400 hover:text-rose-300 hover:bg-slate-800 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            <span className="hidden md:inline text-[11px]">Clear</span>
          </button>
        </div>
      </div>

      {/* Panel Tab Viewport */}
      <div className="flex-1 p-3 overflow-hidden bg-[#0a0e17] font-mono text-xs select-text">
        {/* Tab 0 Content: Test Cases Panel */}
        {activeTab === 'testcases' && (
          <TestCasesPanel
            testCases={testCases}
            summary={testSuiteSummary}
            isRunningTests={isRunningTests}
            onRunAllTests={onRunAllTests}
            onRunSingleTest={onRunSingleTest}
            onAddTestCase={onAddTestCase}
            onUpdateTestCase={onUpdateTestCase}
            onDeleteTestCase={onDeleteTestCase}
          />
        )}

        {/* Tab 1 Content: Standard Input */}
        {activeTab === 'input' && (
          <div className="h-full flex flex-col">
            <textarea
              id="workspace-stdin-input"
              value={stdin}
              onChange={(e) => onStdinChange(e.target.value)}
              placeholder="Enter custom standard input (stdin) here... e.g. test cases, numbers, arrays, or multiline strings. It will be preserved between runs."
              className="flex-1 w-full p-2.5 bg-[#0e1422] border border-slate-800 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 font-mono text-xs resize-none"
              spellCheck={false}
            />
            <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 font-sans">
              <span>Standard input is passed to your program via stdin</span>
              <button
                onClick={() => onStdinChange('')}
                className="text-slate-400 hover:text-slate-200 text-[10px] underline"
              >
                Clear input
              </button>
            </div>
          </div>
        )}

        {/* Tab 2 Content: Standard Output */}
        {activeTab === 'output' && (
          <div className="h-full overflow-auto">
            {hasOutput ? (
              <div className="bg-[#0e1422] border border-slate-800/90 rounded-lg p-3 text-slate-200 whitespace-pre-wrap leading-relaxed font-mono">
                {executionResult?.stdout}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center p-4 font-sans">
                <Terminal className="w-6 h-6 mb-2 text-slate-400" />
                <p className="text-slate-300 text-xs font-medium">
                  No execution output yet
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Click <span className="text-emerald-400 font-medium">"Run Code"</span> in the toolbar to execute your code with stdin.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 3 Content: Errors */}
        {activeTab === 'errors' && (
          <div className="h-full overflow-auto font-sans">
            {hasError ? (
              <div className="bg-rose-950/20 border border-rose-500/30 rounded-lg p-3.5 space-y-2">
                <div className="flex items-center justify-between text-rose-400 font-semibold text-xs">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Diagnostics / Error Output</span>
                  </div>
                  {executionResult?.status && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-900/40 border border-rose-800/60 text-rose-300">
                      {executionResult.status}
                    </span>
                  )}
                </div>

                {/* Compilation Output if present */}
                {executionResult?.compile_output && (
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-rose-300">Compilation Output:</span>
                    <div className="text-rose-200 text-xs whitespace-pre-wrap font-mono leading-relaxed bg-[#0b0f19] p-2.5 rounded border border-rose-900/40">
                      {executionResult.compile_output}
                    </div>
                  </div>
                )}

                {/* Standard Error if present */}
                {executionResult?.stderr && (
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-rose-300">Standard Error (stderr):</span>
                    <div className="text-rose-200 text-xs whitespace-pre-wrap font-mono leading-relaxed bg-[#0b0f19] p-2.5 rounded border border-rose-900/40">
                      {executionResult.stderr}
                    </div>
                  </div>
                )}

                {/* Status Message if present */}
                {executionResult?.message && (
                  <div className="text-[11px] text-slate-300 bg-slate-900/80 p-2 rounded border border-slate-800">
                    <span className="font-semibold text-slate-200">Message: </span>
                    {executionResult.message}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center p-4">
                <Info className="w-6 h-6 mb-2 text-slate-400" />
                <p className="text-slate-300 text-xs font-medium">
                  No errors detected
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Compiler diagnostics, syntax warnings, and execution exceptions will appear here.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 4 Content: AI Mentor Guidance */}
        {activeTab === 'analysis' && (
          <AIAnalysisPanel
            analysis={analysis}
            isAnalyzing={isAnalyzing}
            onAnalyze={onAnalyze}
            activeSection={analysisSection}
            onSectionChange={onSectionChange}
            onApplySolution={onApplySolution}
          />
        )}
      </div>
    </div>
  );
};
