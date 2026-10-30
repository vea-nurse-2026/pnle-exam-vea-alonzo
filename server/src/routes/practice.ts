import { Router } from "express";
import { z } from "zod";
import { all, get, run } from "../db.ts";
import { HttpError, parseJson, toId } from "../http.ts";
import { getQuestions, type Question } from "../repo.ts";

// PNLE passing rule (RA 9173, Sec. 13): general average of at least 75%, no subject below 60%.
const PASS_AVERAGE = 75;
const PASS_SUBJECT_MIN = 60;
// The board allots 2 hours per 100-item subject: 72 seconds per item.
const SECONDS_PER_ITEM = 72;
const GRACE_SECONDS = 30;

interface SessionRow {
  id: number;
  mode: "exam" | "study";
  subject_id: number | null;
  question_ids: string;
  answers: string;
  results: string | null;
  general_average: number | null;
  passed: number | null;
  time_limit_sec: number | null;
  started_at: string;
  finished_at: string | null;
}

interface SubjectResult { subjectId: number; code: string; correct: number; total: number; pct: number }

function loadSession(id: number): SessionRow {
  const row = get<SessionRow>("SELECT * FROM practice_sessions WHERE id = ?", id);
  if (!row) throw new HttpError(404, "Practice session not found.");
  return row;
}

function startedMs(row: SessionRow): number {
  return Date.parse(`${row.started_at.replace(" ", "T")}Z`);
}

function publicQuestion(q: Question, reveal: boolean) {
  const base = { id: q.id, subjectId: q.subjectId, subjectCode: q.subjectCode, topicName: q.topicName, situation: q.situation, stem: q.stem, options: q.options };
  return reveal ? { ...base, correctIndex: q.correctIndex, rationale: q.rationale, explanations: q.explanations, sourceLabel: q.sourceLabel } : base;
}

function view(row: SessionRow) {
  const ids = parseJson<number[]>(row.question_ids, []);
  const byId = new Map(getQuestions(ids).map((q) => [q.id, q]));
  const answers = parseJson<Record<string, number>>(row.answers, {});
  const finished = Boolean(row.finished_at);
  return {
    id: row.id,
    mode: row.mode,
    subjectId: row.subject_id,
    timeLimitSec: row.time_limit_sec,
    startedAt: new Date(startedMs(row)).toISOString(),
    finishedAt: row.finished_at,
    answers,
    results: parseJson(row.results, null),
    questions: ids
      .map((id) => byId.get(id))
      .filter((q): q is Question => Boolean(q))
      // Study mode reveals each answer once it has been given; exam mode only after submitting.
      .map((q) => publicQuestion(q, finished || (row.mode === "study" && answers[q.id] !== undefined))),
  };
}

function score(row: SessionRow) {
  const ids = parseJson<number[]>(row.question_ids, []);
  const questions = getQuestions(ids);
  const answers = parseJson<Record<string, number>>(row.answers, {});
  const subjects = new Map<number, SubjectResult>();
  let correct = 0;
  for (const q of questions) {
    const s = subjects.get(q.subjectId) ?? { subjectId: q.subjectId, code: q.subjectCode, correct: 0, total: 0, pct: 0 };
    s.total++;
    if (answers[q.id] === q.correctIndex) {
      s.correct++;
      correct++;
    }
    subjects.set(q.subjectId, s);
  }
  const bySubject = [...subjects.values()]
    .map((s) => ({ ...s, pct: Math.round((s.correct / s.total) * 1000) / 10 }))
    .sort((a, b) => a.code.localeCompare(b.code));
  const generalAverage = bySubject.length ? Math.round((bySubject.reduce((n, s) => n + s.pct, 0) / bySubject.length) * 10) / 10 : 0;
  const passed = generalAverage >= PASS_AVERAGE && bySubject.every((s) => s.pct >= PASS_SUBJECT_MIN);
  return {
    correct,
    total: questions.length,
    answered: Object.keys(answers).length,
    bySubject,
    generalAverage,
    passed,
    durationSec: Math.round((Date.now() - startedMs(row)) / 1000),
  };
}

export const practiceRouter = Router();

practiceRouter.get("/practice", (_req, res) => {
  res.json(
    all<SessionRow & { count: number; code: string | null }>(
      `SELECT ps.*, json_array_length(ps.question_ids) AS count, s.code
       FROM practice_sessions ps LEFT JOIN subjects s ON s.id = ps.subject_id ORDER BY ps.id DESC LIMIT 50`,
    ).map((r) => ({
      id: r.id,
      mode: r.mode,
      subjectCode: r.code,
      count: r.count,
      startedAt: new Date(startedMs(r)).toISOString(),
      finishedAt: r.finished_at,
      generalAverage: r.general_average,
      passed: r.passed === null ? null : Boolean(r.passed),
    })),
  );
});

practiceRouter.post("/practice", (req, res) => {
  const body = z
    .object({
      subjectId: z.number().int().positive().nullable(),
      count: z.number().int().min(1).max(500),
      mode: z.enum(["exam", "study"]),
      minutes: z.number().int().min(1).max(600).nullable().optional(),
      includeSamples: z.boolean().default(true),
    })
    .parse(req.body);

  const clauses = ["status = 'approved'"];
  const params: number[] = [];
  if (body.subjectId) { clauses.push("subject_id = ?"); params.push(body.subjectId); }
  if (!body.includeSamples) clauses.push("is_sample = 0");
  const ids = all<{ id: number }>(`SELECT id FROM questions WHERE ${clauses.join(" AND ")} ORDER BY RANDOM() LIMIT ?`, ...params, body.count).map((r) => r.id);
  if (!ids.length) throw new HttpError(400, "No approved questions match. Approve some questions in the Review queue first.");

  const timeLimit = body.mode === "exam" ? (body.minutes ? body.minutes * 60 : ids.length * SECONDS_PER_ITEM) : null;
  const { id } = run(
    "INSERT INTO practice_sessions (mode, subject_id, question_ids, time_limit_sec) VALUES (?, ?, ?, ?)",
    body.mode, body.subjectId, JSON.stringify(ids), timeLimit,
  );
  res.json(view(loadSession(id)));
});

practiceRouter.get("/practice/:id", (req, res) => {
  res.json(view(loadSession(toId(req.params.id))));
});

practiceRouter.post("/practice/:id/answer", (req, res) => {
  const row = loadSession(toId(req.params.id));
  const { questionId, choice } = z.object({ questionId: z.number().int(), choice: z.number().int().min(0).max(3) }).parse(req.body);
  if (row.finished_at) throw new HttpError(409, "This session is already submitted.");
  if (!parseJson<number[]>(row.question_ids, []).includes(questionId)) throw new HttpError(400, "That question is not in this session.");
  if (row.time_limit_sec && Date.now() > startedMs(row) + (row.time_limit_sec + GRACE_SECONDS) * 1000) {
    throw new HttpError(409, "Time is up. Submit the exam to see your results.");
  }
  const answers = parseJson<Record<string, number>>(row.answers, {});
  // In study mode the answer is revealed right away, so it can't be changed afterwards.
  if (!(row.mode === "study" && answers[questionId] !== undefined)) {
    answers[questionId] = choice;
    run("UPDATE practice_sessions SET answers = ? WHERE id = ?", JSON.stringify(answers), row.id);
  }
  res.json(view(loadSession(row.id)));
});

practiceRouter.post("/practice/:id/submit", (req, res) => {
  const row = loadSession(toId(req.params.id));
  if (!row.finished_at) {
    const results = score(row);
    run(
      "UPDATE practice_sessions SET results = ?, general_average = ?, passed = ?, finished_at = datetime('now') WHERE id = ?",
      JSON.stringify(results), results.generalAverage, results.passed, row.id,
    );
  }
  res.json(view(loadSession(row.id)));
});

practiceRouter.delete("/practice/:id", (req, res) => {
  run("DELETE FROM practice_sessions WHERE id = ?", toId(req.params.id));
  res.json({ ok: true });
});
