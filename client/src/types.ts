export const DIFFICULTIES = ["Easy", "Moderate", "Difficult"] as const;
export const BLOOMS = ["Remembering", "Understanding", "Applying", "Analyzing", "Evaluating", "Creating"] as const;
export const LETTERS = ["A", "B", "C", "D"];

export type QuestionStatus = "draft" | "approved" | "rejected" | "retired";
export type QuestionFormat = "single" | "situational" | "mixed";

export interface Topic {
  id: number;
  name: string;
  weight: number;
  targetItems: number;
  approved: number;
  drafts: number;
}

export interface Subject {
  id: number;
  code: string;
  name: string;
  description: string;
  targetItems: number;
  approved: number;
  drafts: number;
  topics: Topic[];
}

export interface Source {
  id: number;
  filename: string;
  size: number;
  subjectId: number | null;
  topicIds: number[];
  status: "processing" | "ready" | "error";
  error: string | null;
  charCount: number;
  chunkCount: number;
  questionCount: number;
  createdAt: string;
}

export interface Question {
  id: number;
  subjectId: number;
  subjectCode: string;
  topicId: number | null;
  topicName: string | null;
  jobId: number | null;
  chunkId: number | null;
  situation: string;
  stem: string;
  options: string[];
  correctIndex: number;
  rationale: string;
  explanations: string[];
  difficulty: string;
  bloom: string;
  format: string;
  status: QuestionStatus;
  warnings: string[];
  sourceQuote: string;
  sourceLabel: string;
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionDetail {
  question: Question;
  excerpt?: { text: string; location: string | null; sourceName: string; sourceId: number };
  events: { action: string; reason: string; createdAt: string }[];
}

export interface JobSettings {
  subjectId: number;
  topicIds: number[];
  sourceIds: number[];
  count: number;
  difficulty: string;
  blooms: string[];
  format: QuestionFormat;
  instructions: string;
  replaceQuestionId?: number;
}

export interface Job {
  id: number;
  settings: JobSettings;
  status: "queued" | "running" | "done" | "error";
  model: string | null;
  progress: number;
  total: number;
  usage: { input: number; output: number; cacheRead: number };
  notes: string[];
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface PracticeQuestion {
  id: number;
  subjectId: number;
  subjectCode: string;
  topicName: string | null;
  situation: string;
  stem: string;
  options: string[];
  correctIndex?: number;
  rationale?: string;
  explanations?: string[];
  sourceLabel?: string;
}

export interface PracticeResults {
  correct: number;
  total: number;
  answered: number;
  bySubject: { subjectId: number; code: string; correct: number; total: number; pct: number }[];
  generalAverage: number;
  passed: boolean;
  durationSec: number;
}

export interface PracticeSession {
  id: number;
  mode: "exam" | "study";
  subjectId: number | null;
  timeLimitSec: number | null;
  startedAt: string;
  finishedAt: string | null;
  answers: Record<string, number>;
  results: PracticeResults | null;
  questions: PracticeQuestion[];
}

export interface PracticeSummary {
  id: number;
  mode: "exam" | "study";
  subjectCode: string | null;
  count: number;
  startedAt: string;
  finishedAt: string | null;
  generalAverage: number | null;
  passed: boolean | null;
}

export interface Dashboard {
  questions: { approved: number; draft: number; rejected: number; retired: number; samples: number };
  sources: { total: number; ready: number; error: number };
  practice: { count: number; average: number | null; last: number | null };
  subjects: Omit<Subject, "topics">[];
  recentJobs: Job[];
  ai: AiStatus;
}

export interface AiStatus {
  configured: boolean;
  model: string;
  mock: boolean;
}
