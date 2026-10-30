import { Router } from "express";
import { AI_MODEL_LABEL, MOCK_AI, aiConfigured } from "../config.ts";
import { all, get } from "../db.ts";
import { listJobs } from "../services/jobs.ts";
import { listSubjects } from "./subjects.ts";

export const dashboardRouter = Router();

dashboardRouter.get("/dashboard", (_req, res) => {
  const status = all<{ status: string; n: number }>("SELECT status, COUNT(*) AS n FROM questions GROUP BY status");
  const n = (s: string) => status.find((r) => r.status === s)?.n ?? 0;
  const sources = all<{ status: string; n: number }>("SELECT status, COUNT(*) AS n FROM sources GROUP BY status");
  const practice = get<{ count: number; avg: number | null; last: number | null }>(
    `SELECT COUNT(*) AS count, AVG(general_average) AS avg,
       (SELECT general_average FROM practice_sessions WHERE finished_at IS NOT NULL ORDER BY id DESC LIMIT 1) AS last
     FROM practice_sessions WHERE finished_at IS NOT NULL`,
  )!;

  res.json({
    questions: {
      approved: n("approved"),
      draft: n("draft"),
      rejected: n("rejected"),
      retired: n("retired"),
      samples: get<{ n: number }>("SELECT COUNT(*) AS n FROM questions WHERE is_sample = 1")!.n,
    },
    sources: {
      total: sources.reduce((t, r) => t + r.n, 0),
      ready: sources.find((r) => r.status === "ready")?.n ?? 0,
      error: sources.find((r) => r.status === "error")?.n ?? 0,
    },
    practice: { count: practice.count, average: practice.avg, last: practice.last },
    subjects: listSubjects().map(({ topics: _topics, ...s }) => s),
    recentJobs: listJobs(5),
    ai: { configured: aiConfigured(), model: AI_MODEL_LABEL, mock: MOCK_AI },
  });
});
