import { Router } from "express";
import { z } from "zod";
import { all, get, run } from "../db.ts";
import { HttpError, toId } from "../http.ts";

interface SubjectRow { id: number; code: string; name: string; description: string; target_items: number }
interface TopicRow { id: number; subject_id: number; name: string; weight: number; target_items: number }
interface CountRow { key: number; status: string; n: number }

export function listSubjects() {
  const subjects = all<SubjectRow>("SELECT * FROM subjects ORDER BY sort, id");
  const topics = all<TopicRow>("SELECT * FROM topics ORDER BY sort, id");
  const bySubject = all<CountRow>("SELECT subject_id AS key, status, COUNT(*) AS n FROM questions GROUP BY subject_id, status");
  const byTopic = all<CountRow>("SELECT topic_id AS key, status, COUNT(*) AS n FROM questions WHERE topic_id IS NOT NULL GROUP BY topic_id, status");
  const count = (rows: CountRow[], key: number, status: string) => rows.find((r) => r.key === key && r.status === status)?.n ?? 0;

  return subjects.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    description: s.description,
    targetItems: s.target_items,
    approved: count(bySubject, s.id, "approved"),
    drafts: count(bySubject, s.id, "draft"),
    topics: topics
      .filter((t) => t.subject_id === s.id)
      .map((t) => ({
        id: t.id,
        name: t.name,
        weight: t.weight,
        targetItems: t.target_items,
        approved: count(byTopic, t.id, "approved"),
        drafts: count(byTopic, t.id, "draft"),
      })),
  }));
}

export const subjectsRouter = Router();

subjectsRouter.get("/subjects", (_req, res) => {
  res.json(listSubjects());
});

subjectsRouter.put("/subjects/:id", (req, res) => {
  const id = toId(req.params.id);
  const body = z
    .object({
      name: z.string().trim().min(1).max(200),
      description: z.string().trim().max(1000),
      targetItems: z.number().int().min(0).max(10000),
    })
    .parse(req.body);
  const r = run("UPDATE subjects SET name = ?, description = ?, target_items = ? WHERE id = ?", body.name, body.description, body.targetItems, id);
  if (!r.changes) throw new HttpError(404, "Subject not found.");
  res.json(listSubjects());
});

const TopicBody = z.object({
  name: z.string().trim().min(1, "Topic name is required.").max(200),
  weight: z.number().min(0).max(100).default(0),
  targetItems: z.number().int().min(0).max(10000).default(0),
});

subjectsRouter.post("/subjects/:id/topics", (req, res) => {
  const subjectId = toId(req.params.id);
  if (!get("SELECT id FROM subjects WHERE id = ?", subjectId)) throw new HttpError(404, "Subject not found.");
  const body = TopicBody.parse(req.body);
  const sort = get<{ m: number | null }>("SELECT MAX(sort) AS m FROM topics WHERE subject_id = ?", subjectId)?.m ?? 0;
  run("INSERT INTO topics (subject_id, name, weight, target_items, sort) VALUES (?, ?, ?, ?, ?)", subjectId, body.name, body.weight, body.targetItems, sort + 1);
  res.json(listSubjects());
});

subjectsRouter.put("/topics/:id", (req, res) => {
  const id = toId(req.params.id);
  const body = TopicBody.parse(req.body);
  const r = run("UPDATE topics SET name = ?, weight = ?, target_items = ? WHERE id = ?", body.name, body.weight, body.targetItems, id);
  if (!r.changes) throw new HttpError(404, "Topic not found.");
  res.json(listSubjects());
});

subjectsRouter.delete("/topics/:id", (req, res) => {
  run("DELETE FROM topics WHERE id = ?", toId(req.params.id));
  res.json(listSubjects());
});
