import { Router, type Request } from "express";
import { z } from "zod";
import { AI_MODEL_LABEL, BLOOMS, DIFFICULTIES, MAX_QUESTIONS_PER_JOB, MOCK_AI, QUESTION_STATUSES, aiConfigured } from "../config.ts";
import { all, get, placeholders, run, transaction } from "../db.ts";
import { HttpError, toId } from "../http.ts";
import { QUESTION_SELECT, getQuestion, logReview, mapQuestion, recheck, type QuestionRow } from "../repo.ts";
import { createJob, getJob, listJobs, type JobSettings } from "../services/jobs.ts";

/** Turns query-string filters into a WHERE clause shared by the list and the exports. */
export function questionFilter(req: Request): { where: string; params: (string | number)[] } {
  const q = z
    .object({
      status: z.string().optional(),
      subjectId: z.coerce.number().int().optional(),
      topicId: z.coerce.number().int().optional(),
      difficulty: z.string().optional(),
      bloom: z.string().optional(),
      jobId: z.coerce.number().int().optional(),
      sample: z.enum(["only", "exclude"]).optional(),
      warnings: z.enum(["only"]).optional(),
      q: z.string().optional(),
    })
    .parse(req.query);

  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (q.status) {
    const statuses = q.status.split(",");
    clauses.push(`q.status IN ${placeholders(statuses.length)}`);
    params.push(...statuses);
  }
  if (q.subjectId) { clauses.push("q.subject_id = ?"); params.push(q.subjectId); }
  if (q.topicId) { clauses.push("q.topic_id = ?"); params.push(q.topicId); }
  if (q.difficulty) { clauses.push("q.difficulty = ?"); params.push(q.difficulty); }
  if (q.bloom) { clauses.push("q.bloom = ?"); params.push(q.bloom); }
  if (q.jobId) { clauses.push("q.job_id = ?"); params.push(q.jobId); }
  if (q.sample === "only") clauses.push("q.is_sample = 1");
  if (q.sample === "exclude") clauses.push("q.is_sample = 0");
  if (q.warnings === "only") clauses.push("q.warnings != '[]'");
  if (q.q?.trim()) {
    clauses.push("(q.stem LIKE ? OR q.situation LIKE ? OR q.options LIKE ? OR q.rationale LIKE ?)");
    const like = `%${q.q.trim()}%`;
    params.push(like, like, like, like);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

const Settings = z.object({
  subjectId: z.number().int().positive(),
  topicIds: z.array(z.number().int().positive()).default([]),
  sourceIds: z.array(z.number().int().positive()).default([]),
  count: z.number().int().min(1).max(MAX_QUESTIONS_PER_JOB),
  difficulty: z.enum(["Mixed", ...DIFFICULTIES]).default("Mixed"),
  blooms: z.array(z.enum(BLOOMS)).min(1, "Pick at least one cognitive level."),
  format: z.enum(["single", "situational", "mixed"]).default("single"),
  instructions: z.string().max(2000).default(""),
});

const Edit = z.object({
  situation: z.string().max(4000),
  stem: z.string().trim().min(1, "The stem is required.").max(4000),
  options: z.array(z.string().trim().min(1, "Options can't be empty.").max(1000)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  rationale: z.string().max(4000),
  explanations: z.array(z.string().max(1000)).length(4),
  difficulty: z.enum(DIFFICULTIES),
  bloom: z.enum(BLOOMS),
  topicId: z.number().int().positive().nullable(),
});

const REVIEW_STATUS: Record<string, (typeof QUESTION_STATUSES)[number]> = {
  approve: "approved",
  reject: "rejected",
  retire: "retired",
  restore: "draft",
};

export const questionsRouter = Router();

questionsRouter.get("/ai/status", (_req, res) => {
  res.json({ configured: aiConfigured(), model: AI_MODEL_LABEL, mock: MOCK_AI });
});

questionsRouter.get("/jobs", (_req, res) => {
  res.json(listJobs());
});

questionsRouter.post("/jobs", (req, res) => {
  const settings: JobSettings = Settings.parse(req.body);
  if (!get("SELECT id FROM subjects WHERE id = ?", settings.subjectId)) throw new HttpError(404, "Subject not found.");
  res.json(getJob(createJob(settings)));
});

questionsRouter.get("/jobs/:id", (req, res) => {
  const job = getJob(toId(req.params.id));
  if (!job) throw new HttpError(404, "Job not found.");
  const questions = all<QuestionRow>(`${QUESTION_SELECT} WHERE q.job_id = ? ORDER BY q.id`, job.id).map(mapQuestion);
  res.json({ job, questions });
});

questionsRouter.get("/questions", (req, res) => {
  const { where, params } = questionFilter(req);
  const { limit, offset } = z
    .object({ limit: z.coerce.number().int().min(1).max(500).default(50), offset: z.coerce.number().int().min(0).default(0) })
    .parse(req.query);
  const total = get<{ n: number }>(`SELECT COUNT(*) AS n FROM questions q ${where}`, ...params)!.n;
  const items = all<QuestionRow>(`${QUESTION_SELECT} ${where} ORDER BY q.id DESC LIMIT ? OFFSET ?`, ...params, limit, offset).map(mapQuestion);
  res.json({ items, total });
});

questionsRouter.post("/questions/bulk", (req, res) => {
  const { ids, action } = z
    .object({ ids: z.array(z.number().int().positive()).min(1).max(500), action: z.enum(["approve", "reject", "restore", "retire", "delete"]) })
    .parse(req.body);
  transaction(() => {
    for (const id of ids) {
      if (action === "delete") run("DELETE FROM questions WHERE id = ?", id);
      else {
        run("UPDATE questions SET status = ?, updated_at = datetime('now') WHERE id = ?", REVIEW_STATUS[action], id);
        logReview(id, action);
      }
    }
  });
  res.json({ ok: true });
});

questionsRouter.delete("/questions/samples", (_req, res) => {
  const r = run("DELETE FROM questions WHERE is_sample = 1");
  res.json({ deleted: r.changes });
});

questionsRouter.get("/questions/:id", (req, res) => {
  const question = getQuestion(toId(req.params.id));
  if (!question) throw new HttpError(404, "Question not found.");
  const excerpt = question.chunkId
    ? get<{ text: string; location: string | null; filename: string; source_id: number }>(
        "SELECT c.text, c.location, src.filename, src.id AS source_id FROM chunks c JOIN sources src ON src.id = c.source_id WHERE c.id = ?",
        question.chunkId,
      )
    : undefined;
  const events = all("SELECT action, reason, created_at AS createdAt FROM review_events WHERE question_id = ? ORDER BY id DESC", question.id);
  res.json({
    question,
    excerpt: excerpt && { text: excerpt.text, location: excerpt.location, sourceName: excerpt.filename, sourceId: excerpt.source_id },
    events,
  });
});

questionsRouter.put("/questions/:id", (req, res) => {
  const id = toId(req.params.id);
  const e = Edit.parse(req.body);
  const r = run(
    `UPDATE questions SET situation = ?, stem = ?, options = ?, correct_index = ?, rationale = ?, explanations = ?,
       difficulty = ?, bloom = ?, topic_id = ?, format = ?, updated_at = datetime('now') WHERE id = ?`,
    e.situation.trim(), e.stem, JSON.stringify(e.options), e.correctIndex, e.rationale.trim(), JSON.stringify(e.explanations),
    e.difficulty, e.bloom, e.topicId, e.situation.trim() ? "situational" : "single", id,
  );
  if (!r.changes) throw new HttpError(404, "Question not found.");
  recheck(id);
  logReview(id, "edit");
  res.json(getQuestion(id));
});

questionsRouter.post("/questions/:id/review", (req, res) => {
  const id = toId(req.params.id);
  const { action, reason } = z
    .object({ action: z.enum(["approve", "reject", "retire", "restore"]), reason: z.string().max(1000).default("") })
    .parse(req.body);
  const r = run("UPDATE questions SET status = ?, updated_at = datetime('now') WHERE id = ?", REVIEW_STATUS[action], id);
  if (!r.changes) throw new HttpError(404, "Question not found.");
  logReview(id, action, reason);
  res.json(getQuestion(id));
});

questionsRouter.post("/questions/:id/regenerate", (req, res) => {
  const id = toId(req.params.id);
  const { reason } = z.object({ reason: z.string().max(1000).default("") }).parse(req.body);
  const q = getQuestion(id);
  if (!q) throw new HttpError(404, "Question not found.");
  const sourceId = q.chunkId ? get<{ source_id: number }>("SELECT source_id FROM chunks WHERE id = ?", q.chunkId)?.source_id : undefined;

  run("UPDATE questions SET status = 'rejected', updated_at = datetime('now') WHERE id = ?", id);
  logReview(id, "regenerate", reason);
  const jobId = createJob({
    subjectId: q.subjectId,
    topicIds: q.topicId ? [q.topicId] : [],
    sourceIds: sourceId ? [sourceId] : [],
    count: 1,
    difficulty: q.difficulty,
    blooms: [q.bloom],
    format: q.situation ? "situational" : "single",
    instructions: q.situation ? `Keep this situation if it is sound: ${q.situation}` : "",
    replaceQuestionId: id,
    replaceReason: reason,
  });
  res.json(getJob(jobId));
});

questionsRouter.delete("/questions/:id", (req, res) => {
  run("DELETE FROM questions WHERE id = ?", toId(req.params.id));
  res.json({ ok: true });
});
