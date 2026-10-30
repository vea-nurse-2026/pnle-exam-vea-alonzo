import type { PracticeResults, PracticeSession } from "../types.ts";

// Everything the online exam site does runs in the browser: the question bank is a static JSON file
// published from the studio, and exam sessions are saved in localStorage.

export interface BankTopic { id: number; name: string; targetItems: number }
export interface BankSubject { id: number; code: string; name: string; description: string; targetItems: number; topics: BankTopic[] }
export interface BankQuestion {
  id: number;
  subjectId: number;
  subjectCode: string;
  topicId: number | null;
  topicName: string | null;
  situation: string;
  stem: string;
  options: string[];
  correctIndex: number;
  rationale: string;
  explanations: string[];
  difficulty: string;
  bloom: string;
  sourceLabel: string;
}
export interface Bank { publishedAt: string; subjects: BankSubject[]; questions: BankQuestion[] }

export interface StoredExam {
  id: number;
  mode: "exam" | "study";
  subjectId: number | null;
  label: string;
  questionIds: number[];
  answers: Record<string, number>;
  timeLimitSec: number | null;
  startedAt: string;
  finishedAt: string | null;
  results: PracticeResults | null;
}

// PNLE passing rule: general average of at least 75%, no subject below 60%.
const PASS_AVERAGE = 75;
const PASS_SUBJECT_MIN = 60;
// The board allots 2 hours per 100-item subject: 72 seconds per item.
export const SECONDS_PER_ITEM = 72;
export const BOARD_ITEMS = 100;

export async function loadBank(): Promise<Bank> {
  const res = await fetch(`${import.meta.env.BASE_URL}questions.json`, { cache: "no-cache" });
  if (!res.ok) throw new Error("The question bank could not be loaded.");
  return (await res.json()) as Bank;
}

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Situational sets stay together, as on the board exam. */
function groups(qs: BankQuestion[]): BankQuestion[][] {
  const map = new Map<string, BankQuestion[]>();
  for (const q of qs) {
    const key = q.situation ? `s${q.subjectId}:${q.situation}` : `q${q.id}`;
    map.set(key, [...(map.get(key) ?? []), q]);
  }
  return [...map.values()];
}

/** Up to `count` questions, taking whole situational sets in random order. */
function pick(qs: BankQuestion[], count: number): BankQuestion[] {
  const out: BankQuestion[] = [];
  for (const g of shuffle(groups(qs))) {
    if (out.length >= count) break;
    if (out.length + g.length <= count) out.push(...g);
  }
  return out;
}

/** One subject's items, spread across topics by their blueprint targets when those are set. */
function pickSubject(bank: Bank, subjectId: number, count: number): BankQuestion[] {
  const pool = bank.questions.filter((q) => q.subjectId === subjectId);
  const topics = bank.subjects.find((s) => s.id === subjectId)?.topics ?? [];
  const totalTarget = topics.reduce((n, t) => n + t.targetItems, 0);
  if (!totalTarget) return pick(pool, count);

  const chosen: BankQuestion[] = [];
  for (const t of topics) {
    if (!t.targetItems) continue;
    chosen.push(...pick(pool.filter((q) => q.topicId === t.id), Math.round((t.targetItems / totalTarget) * count)));
  }
  const used = new Set(chosen.map((q) => q.id));
  chosen.push(...pick(pool.filter((q) => !used.has(q.id)), count - chosen.length));
  return groups(chosen).flat();
}

export function createExam(
  bank: Bank,
  opts: { subjectId: number | null; count: number; mode: "exam" | "study"; minutes: number | null; label: string },
): StoredExam {
  let questions: BankQuestion[];
  if (opts.subjectId) {
    questions = pickSubject(bank, opts.subjectId, opts.count);
  } else {
    // Mixed exam: an even share per subject, kept in subject order like the board's sections.
    const subjects = bank.subjects.filter((s) => bank.questions.some((q) => q.subjectId === s.id));
    questions = subjects.flatMap((s, i) => {
      const share = Math.floor(opts.count / subjects.length) + (i < opts.count % subjects.length ? 1 : 0);
      return pickSubject(bank, s.id, share);
    });
  }
  if (!questions.length) throw new Error("There are no questions to choose from.");
  return {
    id: Date.now(),
    mode: opts.mode,
    subjectId: opts.subjectId,
    label: opts.label,
    questionIds: questions.map((q) => q.id),
    answers: {},
    timeLimitSec: opts.mode === "exam" ? (opts.minutes ? opts.minutes * 60 : questions.length * SECONDS_PER_ITEM) : null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    results: null,
  };
}

/** The exam as the shared exam screens expect it, with answers hidden until they may be shown. */
export function toSession(bank: Bank, exam: StoredExam): PracticeSession {
  const byId = new Map(bank.questions.map((q) => [q.id, q]));
  const finished = Boolean(exam.finishedAt);
  return {
    id: exam.id,
    mode: exam.mode,
    subjectId: exam.subjectId,
    timeLimitSec: exam.timeLimitSec,
    startedAt: exam.startedAt,
    finishedAt: exam.finishedAt,
    answers: exam.answers,
    results: exam.results,
    questions: exam.questionIds
      .map((id) => byId.get(id))
      .filter((q): q is BankQuestion => Boolean(q))
      .map((q) => {
        const base = { id: q.id, subjectId: q.subjectId, subjectCode: q.subjectCode, topicName: q.topicName, situation: q.situation, stem: q.stem, options: q.options };
        const reveal = finished || (exam.mode === "study" && exam.answers[q.id] !== undefined);
        return reveal ? { ...base, correctIndex: q.correctIndex, rationale: q.rationale, explanations: q.explanations, sourceLabel: q.sourceLabel } : base;
      }),
  };
}

export function score(bank: Bank, exam: StoredExam): PracticeResults {
  const byId = new Map(bank.questions.map((q) => [q.id, q]));
  const questions = exam.questionIds.map((id) => byId.get(id)).filter((q): q is BankQuestion => Boolean(q));
  const subjects = new Map<number, { subjectId: number; code: string; correct: number; total: number; pct: number }>();
  let correct = 0;
  for (const q of questions) {
    const s = subjects.get(q.subjectId) ?? { subjectId: q.subjectId, code: q.subjectCode, correct: 0, total: 0, pct: 0 };
    s.total++;
    if (exam.answers[q.id] === q.correctIndex) {
      s.correct++;
      correct++;
    }
    subjects.set(q.subjectId, s);
  }
  const bySubject = [...subjects.values()]
    .map((s) => ({ ...s, pct: Math.round((s.correct / s.total) * 1000) / 10 }))
    .sort((a, b) => a.code.localeCompare(b.code));
  const generalAverage = bySubject.length ? Math.round((bySubject.reduce((n, s) => n + s.pct, 0) / bySubject.length) * 10) / 10 : 0;
  return {
    correct,
    total: questions.length,
    answered: Object.keys(exam.answers).length,
    bySubject,
    generalAverage,
    passed: generalAverage >= PASS_AVERAGE && bySubject.every((s) => s.pct >= PASS_SUBJECT_MIN),
    durationSec: Math.round((Date.now() - Date.parse(exam.startedAt)) / 1000),
  };
}

// Saved exams. Storage can be unavailable (private windows, blocked site data), so every access is guarded.
const KEY = "pnle-exam:sessions";
const KEEP = 50;

export function loadExams(): StoredExam[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as StoredExam[];
  } catch {
    return [];
  }
}

export function saveExam(exam: StoredExam): StoredExam[] {
  const rest = loadExams().filter((e) => e.id !== exam.id);
  const all = [exam, ...rest].sort((a, b) => b.id - a.id).slice(0, KEEP);
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Not saved; the exam still works for this visit.
  }
  return all;
}

export function deleteExam(id: number): StoredExam[] {
  const all = loadExams().filter((e) => e.id !== id);
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Ignore; nothing more to do.
  }
  return all;
}
