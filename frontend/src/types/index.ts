export type NavPage = 'dashboard' | 'workspace' | 'interview' | 'history';

export interface HealthCheckResponse {
  status: string;
  service: string;
  version: string;
  environment?: string;
  timestamp?: string;
  checks?: {
    api?: string;
    groq_configured?: boolean;
    database_configured?: boolean;
    judge0_configured?: boolean;
  };
}

export interface MetricCardData {
  id: string;
  label: string;
  value: string | number;
  subtext: string;
  badge?: string;
}

export interface PracticeProblem {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  category: string;
  tags: string[];
  acceptanceRate: string;
}

export interface SystemComponentStatus {
  name: string;
  status: 'Operational' | 'Standby' | 'Configured' | 'Pending Setup';
  phase: string;
  description: string;
}

// Phase 2 & Phase 3: Coding Workspace & Real Execution Engine Types
export type SupportedLanguageId = 'python' | 'javascript' | 'typescript' | 'c' | 'cpp' | 'java';

export interface LanguageDefinition {
  id: SupportedLanguageId;
  name: string;
  monacoLanguage: string;
  extension: string;
  versionLabel: string;
  starterCode: string;
  exampleCode?: string;
  starterTestCases?: Array<{
    name: string;
    stdin: string;
    expectedOutput: string;
  }>;
}

export interface ExecutionRequest {
  language: SupportedLanguageId;
  source_code: string;
  stdin?: string;
}

export interface ExecutionResponse {
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  status: string; // e.g. Accepted, Wrong Answer, Compilation Error, Runtime Error (...), Time Limit Exceeded, Unavailable, Error
  execution_time?: number | null;
  memory_used?: number | null;
  message?: string | null;
}

export type TestCaseStatus = 
  | 'idle' 
  | 'running' 
  | 'passed' 
  | 'failed' 
  | 'compilation_error' 
  | 'runtime_error' 
  | 'time_limit_exceeded' 
  | 'unavailable' 
  | 'error';

export interface TestCase {
  id: string;
  name: string;
  stdin: string;
  expectedOutput: string;
  status: TestCaseStatus;
  actualOutput?: string;
  executionTime?: number | null;
  memoryUsed?: number | null;
  errorMessage?: string;
  compileOutput?: string | null;
}

export interface TestSuiteSummary {
  total: number;
  passed: number;
  failed: number;
  errors: number;
  completed: boolean;
}

export interface BatchExecuteRequest {
  language: SupportedLanguageId;
  source_code: string;
  test_cases: Array<{
    id: string;
    name: string;
    stdin: string;
    expected_output: string;
  }>;
}

export interface BatchExecuteResponse {
  results: Array<{
    id: string;
    name: string;
    status: string;
    passed: boolean;
    stdout?: string | null;
    stderr?: string | null;
    compile_output?: string | null;
    expected_output: string;
    actual_output: string;
    execution_time?: number | null;
    memory_used?: number | null;
    message?: string | null;
  }>;
  summary: {
    total: number;
    passed: number;
    failed: number;
    errors: number;
    pass_rate: string;
  };
}

export type ConsoleTab = 'testcases' | 'input' | 'output' | 'errors' | 'analysis';

// Phase 4: Multi-Agent AI Analysis Types
export type BugSeverity = 'critical' | 'high' | 'medium' | 'low' | 'warning';

export interface BugFinding {
  severity: BugSeverity;
  line_number?: number | null;
  title: string;
  description: string;
  root_cause: string;
  suggestion: string;
}

export interface CodeReviewResult {
  status: string;
  summary: string;
  strengths: string[];
  potential_issues: string[];
}

export interface FailedTestExplanation {
  test_id: string;
  name: string;
  explanation: string;
  likely_cause: string;
}

export interface SuggestedTestCase {
  name: string;
  stdin: string;
  expected_output: string;
  reason: string;
}

export interface TestAnalysisResult {
  summary: string;
  failed_test_explanations: FailedTestExplanation[];
  untested_boundary_conditions: string[];
  suggested_tests: SuggestedTestCase[];
}

export interface OptimizedSolutionResult {
  is_optimization_needed: boolean;
  optimized_code?: string | null;
  explanation: string;
  tradeoffs: string[];
  language: string;
}

export interface ComplexityAnalysisResult {
  original_time_complexity: string;
  original_space_complexity: string;
  optimized_time_complexity?: string | null;
  optimized_space_complexity?: string | null;
  time_justification: string;
  space_justification: string;
  assumptions: string[];
}

export interface LearningExplanationResult {
  summary: string;
  key_concepts: string[];
  mentor_tips: string[];
  next_steps: string[];
}

export interface AnalyzeRequest {
  source_code: string;
  language: SupportedLanguageId;
  stdin?: string;
  execution_result?: ExecutionResponse | null;
  test_results?: Array<{
    id: string;
    name: string;
    status: string;
    passed: boolean;
    stdout?: string | null;
    stderr?: string | null;
    compile_output?: string | null;
    expected_output: string;
    actual_output: string;
    execution_time?: number | null;
    memory_used?: number | null;
    message?: string | null;
  }> | null;
  analysis_options?: Record<string, any>;
}

export interface AnalyzeResponse {
  status: 'Completed' | 'Partial' | 'Unavailable' | 'Error';
  overall_summary: string;
  code_review: CodeReviewResult;
  bugs: BugFinding[];
  test_analysis: TestAnalysisResult;
  optimized_solution: OptimizedSolutionResult;
  complexity_analysis: ComplexityAnalysisResult;
  learning_explanation: LearningExplanationResult;
  warnings: string[];
}

export type AnalysisSectionTab = 
  | 'overview' 
  | 'bugs' 
  | 'tests' 
  | 'optimization' 
  | 'complexity' 
  | 'learning';

// ==========================================
// Phase 5: AI Interview Coach Types
// ==========================================

export type InterviewDifficulty = 'beginner' | 'intermediate' | 'advanced';

export type InterviewTopic = 
  | 'mixed'
  | 'code_understanding'
  | 'debugging'
  | 'data_structures_algorithms'
  | 'complexity'
  | 'optimization'
  | 'edge_cases_testing'
  | 'general_technical';

export interface ClientInterviewQuestion {
  id: string;
  question_index: number;
  question_text: string;
  topic: string;
  difficulty: string;
  question_type: string;
}

export interface StartInterviewRequest {
  source_code: string;
  language: string;
  num_questions: number;
  difficulty: InterviewDifficulty;
  topic: string;
  analysis_summary?: string;
}

export interface StartInterviewResponse {
  session_id: string;
  total_questions: number;
  difficulty: string;
  topic: string;
  questions: ClientInterviewQuestion[];
  status: string;
}

export interface SubmitAnswerRequest {
  session_id: string;
  question_id: string;
  answer: string;
  is_retry?: boolean;
}

export interface FollowUpQuestion {
  id: string;
  type: string;
  text: string;
}

export interface EvaluationResult {
  question_id: string;
  score: number;
  correct_concepts: string[];
  missing_concepts: string[];
  incorrect_statements: string[];
  feedback: string;
  suggested_improvements: string;
  reference_answer: string;
  is_sufficient: boolean;
  follow_up?: FollowUpQuestion | null;
  retry_count: number;
  advisory_notice: string;
}

export interface TopicPerformance {
  topic: string;
  questions_count: number;
  average_score: number;
}

export interface MistakeCorrection {
  question_text: string;
  incorrect_statement: string;
  correction: string;
}

export interface InterviewReportResponse {
  session_id: string;
  status: string;
  total_questions: number;
  questions_answered: number;
  average_score: number;
  topic_performance: TopicPerformance[];
  strengths: string[];
  areas_for_revision: string[];
  key_mistakes_and_corrections: MistakeCorrection[];
  suggested_practice_topics: string[];
  created_at: string;
  completed_at?: string | null;
}

export interface QuestionWithAnswerState {
  question: ClientInterviewQuestion;
  has_answered: boolean;
  evaluation?: EvaluationResult | null;
}

export interface InterviewSessionDetailResponse {
  session_id: string;
  status: string;
  difficulty: string;
  topic: string;
  current_question_index: number;
  total_questions: number;
  questions: QuestionWithAnswerState[];
  average_score?: number | null;
}

export interface InterviewStatusResponse {
  status: string;
  groq_configured: boolean;
  model: string;
  message: string;
}

// =========================================================================
// Phase 6: Authentication, User Accounts, and History Persistence
// =========================================================================

export interface User {
  id: string;
  email: string;
  display_name?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AuthSuccessResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface SaveCodeSessionPayload {
  session_id?: string;
  title: string;
  language: string;
  source_code: string;
  execution_status?: string | null;
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  execution_time?: number | null;
  memory_used?: number | null;
  analysis_summary?: string | null;
  analysis_results?: any;
}

export interface CodeSessionSummary {
  id: string;
  title: string;
  language: string;
  preview: string;
  execution_status?: string | null;
  has_analysis: boolean;
  created_at: string;
  updated_at: string;
}

export interface CodeSessionDetail {
  id: string;
  title: string;
  language: string;
  source_code: string;
  execution_status?: string | null;
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  execution_time?: number | null;
  memory_used?: number | null;
  analysis_summary?: string | null;
  analysis_results?: any;
  created_at: string;
  updated_at: string;
}

export interface PaginatedCodeSessions {
  items: CodeSessionSummary[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface InterviewSessionSummary {
  id: string;
  language: string;
  topic: string;
  difficulty: string;
  status: string;
  num_questions: number;
  questions_answered: number;
  average_score?: number | null;
  created_at: string;
  completed_at?: string | null;
}

export interface PaginatedInterviewSessions {
  items: InterviewSessionSummary[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}



