import React, { useState, useCallback, useEffect } from 'react';
import { Bookmark, CheckCircle2, AlertCircle, X, Loader2 } from 'lucide-react';
import type { 
  NavPage, 
  SupportedLanguageId, 
  ConsoleTab, 
  ExecutionResponse, 
  TestCase, 
  TestSuiteSummary,
  AnalyzeResponse 
} from '../types';
import { SUPPORTED_LANGUAGES, getLanguageDefinition, DEFAULT_LANGUAGE_ID } from '../constants/languages';
import { executeCode, analyzeCode, saveCodeSession } from '../services/api';
import { compareOutputs } from '../utils/outputComparison';
import { WorkspaceHeader } from '../components/workspace/WorkspaceHeader';
import { MonacoEditorPane } from '../components/workspace/MonacoEditorPane';
import { ConsolePanel } from '../components/workspace/ConsolePanel';
import type { SimpleAnalysisSection } from '../components/workspace/AIAnalysisPanel';
import { useAuth } from '../context/AuthContext';

export interface RestoredCodeState {
  code: string;
  language: SupportedLanguageId;
  title?: string;
  executionResult?: ExecutionResponse | null;
  analysisResult?: AnalyzeResponse | null;
}

interface CodingWorkspacePageProps {
  onNavigate: (page: NavPage) => void;
  restoredState?: RestoredCodeState | null;
  onClearRestoredState?: () => void;
}

export const CodingWorkspacePage: React.FC<CodingWorkspacePageProps> = ({
  restoredState,
  onClearRestoredState,
}) => {
  const { user, openAuthModal } = useAuth();
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguageId>(DEFAULT_LANGUAGE_ID);
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // Layout mode: 'horizontal' (Side-by-Side: Editor on Left, Console on Right) or 'vertical' (Stacked: Top/Bottom)
  const [layoutMode, setLayoutMode] = useState<'horizontal' | 'vertical'>(() => {
    const saved = localStorage.getItem('ai_coding_mentor_layout');
    return saved === 'vertical' ? 'vertical' : 'horizontal';
  });

  const handleToggleLayout = () => {
    setLayoutMode((prev) => {
      const next = prev === 'horizontal' ? 'vertical' : 'horizontal';
      localStorage.setItem('ai_coding_mentor_layout', next);
      return next;
    });
  };
  
  // Store code per language so candidate edits are preserved across language toggling
  const [codePerLanguage, setCodePerLanguage] = useState<Record<SupportedLanguageId, string>>(() => {
    const initialMap: Partial<Record<SupportedLanguageId, string>> = {};
    for (const lang of SUPPORTED_LANGUAGES) {
      initialMap[lang.id] = lang.starterCode;
    }
    return initialMap as Record<SupportedLanguageId, string>;
  });

  // Store test cases per language
  const [testCasesPerLanguage, setTestCasesPerLanguage] = useState<Record<SupportedLanguageId, TestCase[]>>(() => {
    const initialMap: Partial<Record<SupportedLanguageId, TestCase[]>> = {};
    for (const lang of SUPPORTED_LANGUAGES) {
      const starters = lang.starterTestCases || [];
      initialMap[lang.id] = starters.map((st, idx) => ({
        id: `tc-${lang.id}-${idx + 1}`,
        name: st.name,
        stdin: st.stdin,
        expectedOutput: st.expectedOutput,
        status: 'idle'
      }));
    }
    return initialMap as Record<SupportedLanguageId, TestCase[]>;
  });

  const [testSuiteSummary, setTestSuiteSummary] = useState<TestSuiteSummary | null>(null);
  const [stdin, setStdin] = useState<string>('');
  const [activeTab, setActiveTab] = useState<ConsoleTab>('testcases');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isRunningTests, setIsRunningTests] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResponse | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeResponse | null>(null);
  const [analysisSection, setAnalysisSection] = useState<SimpleAnalysisSection>('what_is_wrong');

  const currentCode = codePerLanguage[selectedLanguage] || getLanguageDefinition(selectedLanguage).starterCode;
  const currentTestCases = testCasesPerLanguage[selectedLanguage] || [];

  const handleLanguageChange = (newLang: SupportedLanguageId) => {
    setSelectedLanguage(newLang);
    if (!codePerLanguage[newLang]) {
      setCodePerLanguage((prev) => ({
        ...prev,
        [newLang]: getLanguageDefinition(newLang).starterCode,
      }));
    }
    setTestSuiteSummary(null);
  };

  const handleCodeChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      setCodePerLanguage((prev) => ({
        ...prev,
        [selectedLanguage]: value,
      }));
    }
  }, [selectedLanguage]);

  // Handle restoring a saved code session from History
  useEffect(() => {
    if (restoredState) {
      setSelectedLanguage(restoredState.language);
      setCodePerLanguage((prev) => ({
        ...prev,
        [restoredState.language]: restoredState.code,
      }));
      if (restoredState.executionResult) {
        setExecutionResult(restoredState.executionResult);
        setActiveTab('output');
      }
      if (restoredState.analysisResult) {
        setAnalysisResult(restoredState.analysisResult);
        setActiveTab('analysis');
      }
      if (onClearRestoredState) {
        onClearRestoredState();
      }
    }
  }, [restoredState, onClearRestoredState]);

  const handleOpenSaveModal = () => {
    if (!user) {
      openAuthModal('login');
      return;
    }
    const langDef = getLanguageDefinition(selectedLanguage);
    setSaveTitle(`${langDef.name} Solution`);
    setSaveError(null);
    setShowSaveModal(true);
  };

  const handleConfirmSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveTitle.trim()) {
      setSaveError('Please enter a session title.');
      return;
    }

    setIsSavingSession(true);
    setSaveError(null);
    try {
      await saveCodeSession({
        title: saveTitle.trim(),
        language: selectedLanguage,
        source_code: currentCode,
        execution_status: executionResult?.status,
        stdout: executionResult?.stdout,
        stderr: executionResult?.stderr,
        compile_output: executionResult?.compile_output,
        execution_time: executionResult?.execution_time,
        memory_used: executionResult?.memory_used,
        analysis_summary: analysisResult?.overall_summary,
        analysis_results: analysisResult,
      });

      setShowSaveModal(false);
      setSaveToast('Session saved to your history!');
      setTimeout(() => setSaveToast(null), 3500);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save code session.');
    } finally {
      setIsSavingSession(false);
    }
  };

  const handleResetCode = () => {
    const langDef = getLanguageDefinition(selectedLanguage);
    setCodePerLanguage((prev) => ({
      ...prev,
      [selectedLanguage]: langDef.starterCode,
    }));
    // Reset test cases for current language
    const starters = langDef.starterTestCases || [];
    setTestCasesPerLanguage((prev) => ({
      ...prev,
      [selectedLanguage]: starters.map((st, idx) => ({
        id: `tc-${selectedLanguage}-${Date.now()}-${idx + 1}`,
        name: st.name,
        stdin: st.stdin,
        expectedOutput: st.expectedOutput,
        status: 'idle'
      }))
    }));
    setTestSuiteSummary(null);
    setAnalysisResult(null);
  };

  const handleLoadExample = () => {
    const langDef = getLanguageDefinition(selectedLanguage);
    if (langDef.exampleCode) {
      setCodePerLanguage((prev) => ({
        ...prev,
        [selectedLanguage]: langDef.exampleCode || '',
      }));
      setSaveToast(`Loaded sample ${langDef.name} program!`);
      setTimeout(() => setSaveToast(null), 3000);
    }
  };

  const handleFindBugs = async () => {
    setAnalysisSection('what_is_wrong');
    setActiveTab('analysis');
    if (!analysisResult) {
      await handleAnalyzeCode();
    }
  };

  const handleGetHint = async () => {
    setAnalysisSection('how_to_fix');
    setActiveTab('analysis');
    if (!analysisResult) {
      await handleAnalyzeCode();
    }
  };

  const handleApplySolution = (code: string) => {
    setCodePerLanguage((prev) => ({
      ...prev,
      [selectedLanguage]: code,
    }));
    setSaveToast('Applied solution to code editor!');
    setTimeout(() => setSaveToast(null), 3000);
  };

  const handleClearConsole = () => {
    setExecutionResult(null);
    setTestSuiteSummary(null);
    setAnalysisResult(null);
    setTestCasesPerLanguage((prev) => ({
      ...prev,
      [selectedLanguage]: (prev[selectedLanguage] || []).map((tc) => ({
        ...tc,
        status: 'idle',
        actualOutput: undefined,
        errorMessage: undefined,
        executionTime: null,
        memoryUsed: null
      }))
    }));
  };

  // Test Case Management Handlers
  const handleAddTestCase = () => {
    const newIdx = currentTestCases.length + 1;
    const newCase: TestCase = {
      id: `tc-${selectedLanguage}-${Date.now()}`,
      name: `Test Case ${newIdx}`,
      stdin: '',
      expectedOutput: '',
      status: 'idle'
    };
    setTestCasesPerLanguage((prev) => ({
      ...prev,
      [selectedLanguage]: [...(prev[selectedLanguage] || []), newCase]
    }));
    setTestSuiteSummary(null);
  };

  const handleUpdateTestCase = (id: string, updates: Partial<TestCase>) => {
    setTestCasesPerLanguage((prev) => ({
      ...prev,
      [selectedLanguage]: (prev[selectedLanguage] || []).map((tc) =>
        tc.id === id ? { ...tc, ...updates } : tc
      )
    }));
  };

  const handleDeleteTestCase = (id: string) => {
    setTestCasesPerLanguage((prev) => ({
      ...prev,
      [selectedLanguage]: (prev[selectedLanguage] || []).filter((tc) => tc.id !== id)
    }));
    setTestSuiteSummary(null);
  };

  // 1. Run Code (Custom Input Stdin)
  const handleRunCode = async () => {
    if (isRunning || isRunningTests || isAnalyzing) return;

    setIsRunning(true);
    try {
      const response = await executeCode({
        language: selectedLanguage,
        source_code: currentCode,
        stdin: stdin.trim() ? stdin : undefined,
      });

      setExecutionResult(response);

      // Auto-switch tab based on result
      if (response.status === 'Accepted' && response.stdout && response.stdout.trim().length > 0) {
        setActiveTab('output');
      } else if (response.status !== 'Accepted') {
        setActiveTab('errors');
      } else {
        setActiveTab('output');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setExecutionResult({
        status: 'Error',
        message: errorMsg,
        stderr: errorMsg,
        stdout: null,
        compile_output: null,
        execution_time: null,
        memory_used: null
      });
      setActiveTab('errors');
    } finally {
      setIsRunning(false);
    }
  };

  // 2. Run Single Test Case
  const handleRunSingleTest = async (testCaseId: string) => {
    if (isRunning || isRunningTests || isAnalyzing) return;

    const targetCase = currentTestCases.find((tc) => tc.id === testCaseId);
    if (!targetCase) return;

    handleUpdateTestCase(testCaseId, { status: 'running' });

    try {
      const res = await executeCode({
        language: selectedLanguage,
        source_code: currentCode,
        stdin: targetCase.stdin
      });

      const isAccepted = res.status === 'Accepted';
      const actualOut = res.stdout || '';
      const isMatch = isAccepted && compareOutputs(actualOut, targetCase.expectedOutput);

      let caseStatus: TestCase['status'] = 'failed';
      if (isAccepted && isMatch) {
        caseStatus = 'passed';
      } else if (isAccepted && !isMatch) {
        caseStatus = 'failed';
      } else if (res.status === 'Compilation Error') {
        caseStatus = 'compilation_error';
      } else if (res.status.includes('Runtime Error')) {
        caseStatus = 'runtime_error';
      } else if (res.status === 'Time Limit Exceeded') {
        caseStatus = 'time_limit_exceeded';
      } else if (res.status === 'Unavailable') {
        caseStatus = 'unavailable';
      } else {
        caseStatus = 'error';
      }

      handleUpdateTestCase(testCaseId, {
        status: caseStatus,
        actualOutput: actualOut,
        compileOutput: res.compile_output,
        errorMessage: res.stderr || res.compile_output || res.message || undefined,
        executionTime: res.execution_time,
        memoryUsed: res.memory_used
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      handleUpdateTestCase(testCaseId, {
        status: 'error',
        errorMessage: msg
      });
    }
  };

  // 3. Run All Test Cases Sequentially
  const handleRunAllTests = async () => {
    if (isRunning || isRunningTests || isAnalyzing || currentTestCases.length === 0) return;

    setIsRunningTests(true);
    setActiveTab('testcases');

    let passedCount = 0;
    let failedCount = 0;
    let errorCount = 0;

    // Reset statuses to running/idle
    setTestCasesPerLanguage((prev) => ({
      ...prev,
      [selectedLanguage]: (prev[selectedLanguage] || []).map((tc) => ({
        ...tc,
        status: 'idle',
        actualOutput: undefined,
        errorMessage: undefined
      }))
    }));

    try {
      for (let i = 0; i < currentTestCases.length; i++) {
        const tc = currentTestCases[i];
        
        // Mark current case as running
        handleUpdateTestCase(tc.id, { status: 'running' });

        const res = await executeCode({
          language: selectedLanguage,
          source_code: currentCode,
          stdin: tc.stdin
        });

        const isAccepted = res.status === 'Accepted';
        const actualOut = res.stdout || '';
        const isMatch = isAccepted && compareOutputs(actualOut, tc.expectedOutput);

        let caseStatus: TestCase['status'] = 'failed';
        if (isAccepted && isMatch) {
          caseStatus = 'passed';
          passedCount++;
        } else if (isAccepted && !isMatch) {
          caseStatus = 'failed';
          failedCount++;
        } else if (res.status === 'Compilation Error') {
          caseStatus = 'compilation_error';
          errorCount++;
        } else if (res.status.includes('Runtime Error')) {
          caseStatus = 'runtime_error';
          errorCount++;
        } else if (res.status === 'Time Limit Exceeded') {
          caseStatus = 'time_limit_exceeded';
          errorCount++;
        } else if (res.status === 'Unavailable') {
          caseStatus = 'unavailable';
          errorCount++;
        } else {
          caseStatus = 'error';
          errorCount++;
        }

        handleUpdateTestCase(tc.id, {
          status: caseStatus,
          actualOutput: actualOut,
          compileOutput: res.compile_output,
          errorMessage: res.stderr || res.compile_output || res.message || undefined,
          executionTime: res.execution_time,
          memoryUsed: res.memory_used
        });

        // If compilation error occurred on first test case, remaining test cases will also fail compilation
        if (res.status === 'Compilation Error' && i === 0 && currentTestCases.length > 1) {
          for (let j = 1; j < currentTestCases.length; j++) {
            const remCase = currentTestCases[j];
            handleUpdateTestCase(remCase.id, {
              status: 'compilation_error',
              actualOutput: '',
              compileOutput: res.compile_output,
              errorMessage: res.compile_output || 'Compilation failed',
              executionTime: null,
              memoryUsed: null
            });
            errorCount++;
          }
          break;
        }
      }

      setTestSuiteSummary({
        total: currentTestCases.length,
        passed: passedCount,
        failed: failedCount,
        errors: errorCount,
        completed: true
      });
    } finally {
      setIsRunningTests(false);
    }
  };

  // 4. Multi-Agent AI Analysis Action
  const handleAnalyzeCode = async () => {
    if (isAnalyzing || isRunning || isRunningTests) return;

    setIsAnalyzing(true);
    setActiveTab('analysis');

    try {
      // Package existing test cases results (if any have been run)
      const formattedTestResults = currentTestCases.map((tc) => ({
        id: tc.id,
        name: tc.name,
        status: tc.status,
        passed: tc.status === 'passed',
        stdout: tc.actualOutput || null,
        stderr: tc.errorMessage || null,
        compile_output: tc.compileOutput || null,
        expected_output: tc.expectedOutput,
        actual_output: tc.actualOutput || '',
        execution_time: tc.executionTime,
        memory_used: tc.memoryUsed,
        message: tc.errorMessage
      }));

      const response = await analyzeCode({
        source_code: currentCode,
        language: selectedLanguage,
        stdin: stdin.trim() ? stdin : undefined,
        execution_result: executionResult,
        test_results: formattedTestResults.length > 0 ? formattedTestResults : undefined
      });

      setAnalysisResult(response);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setAnalysisResult({
        status: 'Error',
        overall_summary: `AI analysis could not be completed: ${errorMsg}`,
        code_review: {
          status: 'Connection Error',
          summary: 'Failed to communicate with AI analysis service.',
          strengths: [],
          potential_issues: []
        },
        bugs: [],
        test_analysis: {
          summary: 'Test analysis unavailable.',
          failed_test_explanations: [],
          untested_boundary_conditions: [],
          suggested_tests: []
        },
        optimized_solution: {
          is_optimization_needed: false,
          explanation: 'Optimization unavailable.',
          tradeoffs: [],
          language: selectedLanguage
        },
        complexity_analysis: {
          original_time_complexity: 'N/A',
          original_space_complexity: 'N/A',
          time_justification: 'Unavailable.',
          space_justification: 'Unavailable.',
          assumptions: []
        },
        learning_explanation: {
          summary: 'Please verify the backend server is running and GROQ_API_KEY is configured in backend/.env.',
          key_concepts: [],
          mentor_tips: [],
          next_steps: ['Check backend/.env for GROQ_API_KEY', 'Ensure backend is running on port 8000']
        },
        warnings: [errorMsg]
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="h-full flex flex-col rounded-xl overflow-hidden border border-slate-800 bg-[#0c101b] shadow-2xl">
      {/* 1. Header Toolbar */}
      <WorkspaceHeader
        selectedLanguage={selectedLanguage}
        onLanguageChange={handleLanguageChange}
        onRunCode={handleRunCode}
        onRunAllTests={handleRunAllTests}
        onFindBugs={handleFindBugs}
        onGetHint={handleGetHint}
        onLoadExample={handleLoadExample}
        onResetCode={handleResetCode}
        isRunning={isRunning}
        isRunningTests={isRunningTests}
        isAnalyzing={isAnalyzing}
        onSaveSession={handleOpenSaveModal}
        isSavingSession={isSavingSession}
        layoutMode={layoutMode}
        onToggleLayout={handleToggleLayout}
      />

      {/* 2 & 3. Main Workspace Area (Side-by-Side or Stacked) */}
      <div className={`flex-1 min-h-0 min-w-0 flex ${
        layoutMode === 'horizontal' ? 'flex-col lg:flex-row' : 'flex-col'
      } overflow-hidden`}>
        {/* Monaco Editor Viewport */}
        <div className="flex-1 min-w-0 min-h-0 h-full flex flex-col overflow-hidden">
          <MonacoEditorPane
            code={currentCode}
            language={selectedLanguage}
            onChange={handleCodeChange}
          />
        </div>

        {/* Output Console & AI Guidance Panel */}
        <div className={
          layoutMode === 'horizontal'
            ? 'w-full lg:w-[480px] xl:w-[560px] 2xl:w-[620px] min-h-0 h-full flex flex-col shrink-0'
            : 'w-full min-h-0 flex flex-col'
        }>
          <ConsolePanel
            layoutMode={layoutMode}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            stdin={stdin}
            onStdinChange={setStdin}
            executionResult={executionResult}
            onClearConsole={handleClearConsole}
            testCases={currentTestCases}
            testSuiteSummary={testSuiteSummary}
            isRunningTests={isRunningTests}
            onRunAllTests={handleRunAllTests}
            onRunSingleTest={handleRunSingleTest}
            onAddTestCase={handleAddTestCase}
            onUpdateTestCase={handleUpdateTestCase}
            onDeleteTestCase={handleDeleteTestCase}
            analysis={analysisResult}
            isAnalyzing={isAnalyzing}
            onAnalyze={handleAnalyzeCode}
            analysisSection={analysisSection}
            onSectionChange={setAnalysisSection}
            onApplySolution={handleApplySolution}
          />
        </div>
      </div>

      {/* Save Session Toast Notification */}
      {saveToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs rounded-xl shadow-xl backdrop-blur-md animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* Save Session Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[#0d121f] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Bookmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Save Code Session</h3>
                  <p className="text-xs text-slate-400">Persist active code, run metrics & AI analysis</p>
                </div>
              </div>
              <button
                onClick={() => setShowSaveModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmSave} className="p-6 space-y-4">
              {saveError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2 text-xs text-rose-300">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{saveError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Session Title
                </label>
                <input
                  type="text"
                  required
                  value={saveTitle}
                  onChange={(e) => setSaveTitle(e.target.value)}
                  placeholder="e.g. Optimized Two Sum (Hash Map)"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* What will be saved summary */}
              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 text-xs text-slate-400 space-y-1.5">
                <p className="font-semibold text-slate-300 text-[11px] font-mono uppercase tracking-wider">
                  Session Snapshot:
                </p>
                <div className="flex justify-between">
                  <span>Language:</span>
                  <span className="text-slate-200 font-mono">{selectedLanguage}</span>
                </div>
                <div className="flex justify-between">
                  <span>Code Size:</span>
                  <span className="text-slate-200 font-mono">{currentCode.split('\n').length} lines</span>
                </div>
                <div className="flex justify-between">
                  <span>Execution Status:</span>
                  <span className="text-slate-200 font-mono">{executionResult?.status || 'Not executed'}</span>
                </div>
                <div className="flex justify-between">
                  <span>AI Analysis:</span>
                  <span className="text-slate-200 font-mono">{analysisResult ? 'Included' : 'None'}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingSession}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold text-xs transition-colors flex items-center gap-2"
                >
                  {isSavingSession ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Session</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
