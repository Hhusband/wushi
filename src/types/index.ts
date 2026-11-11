// ---- Lesson ----
export interface LessonData {
  id: string
  teacherId: string
  subject: string
  grade: string
  className: string
  lessonNumber: string
  lessonName: string
  coreQuestion: string
  followUpQuestions: string[]
  discussionRequirements: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface CreateLessonInput {
  subject?: string
  grade: string
  className: string
  lessonNumber: string
  lessonName: string
  coreQuestion: string
  followUpQuestions?: string[]
  discussionRequirements?: string
}

// ---- CurrentLesson ----
export interface CurrentLessonData {
  id: string
  lessonId: string
  teacherId: string
  grade: string
  className: string
  status: string
  startedAt: string
  endedAt?: string
  lesson?: LessonData
}

// ---- Session ----
export interface SessionData {
  id: string
  currentLessonId: string
  lessonId: string
  grade: string
  className: string
  groupNumber: number
  groupName: string
  status: string
  createdAt: string
  updatedAt: string
}

// ---- Message ----
export interface MessageData {
  id: string
  sessionId: string
  role: "student" | "assistant" | "system"
  authorName?: string
  content: string
  metadata: Record<string, unknown>
  createdAt: string
}

// ---- Submission ----
export interface SubmissionData {
  id: string
  sessionId: string
  lessonId: string
  currentLessonId: string
  groupName: string
  mainPoints: { point: string; evidence?: string }[]
  evidence: { source: string; quote: string }[]
  conclusions: string
  questions: string
  submittedAt: string
}

// ---- Dashboard ----
export interface DashboardData {
  currentLesson: CurrentLessonData
  lesson: LessonData
  totalGroups: number
  submittedGroups: number
  activeGroups: number
  sessions: DashboardSession[]
  keywordCloud: { word: string; count: number }[]
  opinionDistribution: { opinion: string; count: number; groups: string[] }[]
  activeGroupsRanking: { groupName: string; messageCount: number }[]
}

export interface DashboardSession {
  id: string
  groupName: string
  groupNumber: number
  status: string
  messageCount: number
  lastActiveAt: string
  depthScore: number
}

// ---- Report ----
export interface ReportData {
  id: string
  lessonId: string
  currentLessonId: string
  overallSummary: string
  topGroups: { groupName: string; reason: string; excerpt: string }[]
  strugglingGroups: { groupName: string; issue: string; suggestion: string }[]
  commonMisconceptions: { misconception: string; example: string; correction: string }[]
  teachingSuggestions: string
  followUpQuestions: { question: string; purpose: string }[]
  boardSuggestions: string
  homeworkSuggestions: string
  keywordCloud: { word: string; count: number }[]
  opinionDistribution: { opinion: string; count: number; groups: string[] }[]
  discussionDepthScores: { sessionId: string; groupName: string; score: number; comment: string }[]
  createdAt: string
}

// ---- Agent ----
export interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
}

export interface AgentResponse {
  content: string
  toolCalls?: { id?: string; name: string; arguments: Record<string, unknown> }[]
  data?: Record<string, unknown>
}

// ---- API ----
export interface ApiResponse<T> {
  data?: T
  error?: string
}
