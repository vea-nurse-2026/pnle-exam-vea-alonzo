import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const SERVER_ROOT = path.resolve(here, "..");
export const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(SERVER_ROOT, "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
export const CLIENT_DIST = path.resolve(SERVER_ROOT, "../client/dist");
// Data file for the static online exam site (built from client/exam.html).
export const EXAM_DATA_FILE = path.resolve(SERVER_ROOT, "../client/exam-public/questions.json");
export const PORT = Number(process.env.PORT ?? 4100);
// Studio sign-in is off unless REQUIRE_LOGIN=true. With it off, the API only listens on 127.0.0.1,
// so only this computer can reach the studio.
export const REQUIRE_LOGIN = process.env.REQUIRE_LOGIN === "true";

export const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5-5";
export const CLAUDE_EFFORT = (process.env.CLAUDE_EFFORT ?? "high") as "low" | "medium" | "high" | "xhigh" | "max";
// Source text sent per generation request. ~4 characters per token.
export const MAX_CONTEXT_CHARS = Number(process.env.MAX_CONTEXT_CHARS ?? 120_000);
export const BATCH_SIZE = 10;
export const MAX_QUESTIONS_PER_JOB = 50;

export const DIFFICULTIES = ["Easy", "Moderate", "Difficult"] as const;
export const BLOOMS = ["Remembering", "Understanding", "Applying", "Analyzing", "Evaluating", "Creating"] as const;
export const QUESTION_STATUSES = ["draft", "approved", "rejected", "retired"] as const;
export const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".pptx", ".txt", ".md"];

// Mock AI mode returns built-in test questions instead of calling Claude, for trying the app without a key.
export const MOCK_AI = process.env.MOCK_AI === "true";
export const MOCK_DATA_DIR = path.resolve(SERVER_ROOT, "../mock-data");

export function aiConfigured(): boolean {
  return MOCK_AI || Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export const AI_MODEL_LABEL = MOCK_AI ? "mock (test pool)" : CLAUDE_MODEL;
