import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { ALLOWED_EXTENSIONS, UPLOAD_DIR } from "../config.ts";
import { all, get, run, transaction } from "../db.ts";
import { HttpError, toId } from "../http.ts";
import { chunkSegments } from "../services/chunk.ts";
import { extractSegments } from "../services/extract.ts";

interface SourceRow {
  id: number;
  filename: string;
  stored_name: string;
  mime: string | null;
  size: number;
  subject_id: number | null;
  status: string;
  error: string | null;
  char_count: number;
  created_at: string;
  topic_ids: string | null;
  chunk_count: number;
  question_count: number;
}

const SOURCE_SELECT = `
  SELECT src.*,
    (SELECT GROUP_CONCAT(topic_id) FROM source_topics WHERE source_id = src.id) AS topic_ids,
    (SELECT COUNT(*) FROM chunks WHERE source_id = src.id) AS chunk_count,
    (SELECT COUNT(*) FROM questions q JOIN chunks c ON c.id = q.chunk_id WHERE c.source_id = src.id) AS question_count
  FROM sources src`;

function mapSource(r: SourceRow) {
  return {
    id: r.id,
    filename: r.filename,
    size: r.size,
    subjectId: r.subject_id,
    topicIds: r.topic_ids ? r.topic_ids.split(",").map(Number) : [],
    status: r.status,
    error: r.error,
    charCount: r.char_count,
    chunkCount: r.chunk_count,
    questionCount: r.question_count,
    createdAt: r.created_at,
  };
}

export function listSources() {
  return all<SourceRow>(`${SOURCE_SELECT} ORDER BY src.id DESC`).map(mapSource);
}

function setTopics(sourceId: number, topicIds: number[]): void {
  run("DELETE FROM source_topics WHERE source_id = ?", sourceId);
  for (const t of new Set(topicIds)) run("INSERT OR IGNORE INTO source_topics (source_id, topic_id) VALUES (?, ?)", sourceId, t);
}

export async function processSource(id: number): Promise<void> {
  const src = get<{ filename: string; stored_name: string }>("SELECT filename, stored_name FROM sources WHERE id = ?", id);
  if (!src) return;
  run("UPDATE sources SET status = 'processing', error = NULL WHERE id = ?", id);
  try {
    const segments = await extractSegments(path.join(UPLOAD_DIR, src.stored_name), src.filename);
    const chunks = chunkSegments(segments);
    const chars = chunks.reduce((n, c) => n + c.text.length, 0);
    if (chars < 200) {
      throw new Error("Almost no text could be read. If this is a scanned PDF, it needs OCR first (not supported yet).");
    }
    transaction(() => {
      run("DELETE FROM chunks WHERE source_id = ?", id);
      chunks.forEach((c, i) => run("INSERT INTO chunks (source_id, idx, location, text) VALUES (?, ?, ?, ?)", id, i, c.location, c.text));
      run("UPDATE sources SET status = 'ready', char_count = ? WHERE id = ?", chars, id);
    });
  } catch (err) {
    run("UPDATE sources SET status = 'error', error = ? WHERE id = ?", err instanceof Error ? err.message : String(err), id);
  }
}

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 50 * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) cb(null, true);
    else cb(new HttpError(400, `"${file.originalname}" is not supported. Use ${ALLOWED_EXTENSIONS.join(", ")}.`));
  },
});

const idList = z
  .string()
  .optional()
  .transform((s) => (s ? s.split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0) : []));

export const sourcesRouter = Router();

sourcesRouter.get("/sources", (_req, res) => {
  res.json(listSources());
});

sourcesRouter.post("/sources", upload.array("files"), (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (!files.length) throw new HttpError(400, "Choose at least one file.");
  const body = z.object({ subjectId: z.coerce.number().int().positive().optional(), topicIds: idList }).parse(req.body);

  const ids = transaction(() =>
    files.map((f) => {
      // Browsers send UTF-8 names; multer reads them as latin1.
      const filename = Buffer.from(f.originalname, "latin1").toString("utf8");
      const { id } = run(
        "INSERT INTO sources (filename, stored_name, mime, size, subject_id) VALUES (?, ?, ?, ?, ?)",
        filename, f.filename, f.mimetype, f.size, body.subjectId ?? null,
      );
      setTopics(id, body.topicIds);
      return id;
    }),
  );
  for (const id of ids) void processSource(id);
  res.json(listSources());
});

sourcesRouter.put("/sources/:id", (req, res) => {
  const id = toId(req.params.id);
  const body = z.object({ subjectId: z.number().int().positive().nullable(), topicIds: z.array(z.number().int().positive()) }).parse(req.body);
  transaction(() => {
    const r = run("UPDATE sources SET subject_id = ? WHERE id = ?", body.subjectId, id);
    if (!r.changes) throw new HttpError(404, "Source not found.");
    setTopics(id, body.topicIds);
  });
  res.json(listSources());
});

sourcesRouter.post("/sources/:id/reprocess", (req, res) => {
  const id = toId(req.params.id);
  if (!get("SELECT id FROM sources WHERE id = ?", id)) throw new HttpError(404, "Source not found.");
  void processSource(id);
  res.json(listSources());
});

sourcesRouter.get("/sources/:id/chunks", (req, res) => {
  const id = toId(req.params.id);
  res.json(all("SELECT id, idx, location, text FROM chunks WHERE source_id = ? ORDER BY idx LIMIT 200", id));
});

sourcesRouter.delete("/sources/:id", async (req, res) => {
  const id = toId(req.params.id);
  const src = get<{ stored_name: string }>("SELECT stored_name FROM sources WHERE id = ?", id);
  if (!src) throw new HttpError(404, "Source not found.");
  run("DELETE FROM sources WHERE id = ?", id);
  await fs.rm(path.join(UPLOAD_DIR, src.stored_name), { force: true });
  res.json(listSources());
});

/** Files that were mid-extraction when the server stopped are processed again. */
export function resumeInterruptedSources(): void {
  for (const { id } of all<{ id: number }>("SELECT id FROM sources WHERE status = 'processing'")) void processSource(id);
}
