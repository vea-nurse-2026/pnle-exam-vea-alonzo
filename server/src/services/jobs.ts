import { AI_MODEL_LABEL, BATCH_SIZE, MAX_CONTEXT_CHARS } from "../config.ts";
import { all, get, placeholders, run, transaction } from "../db.ts";
import { parseJson } from "../http.ts";
import { comparableQuestions, logReview } from "../repo.ts";
import { runChecks } from "./checks.ts";
import { describeError, generateBatch, type Excerpt } from "./generator.ts";

export interface JobSettings {
  subjectId: number;
  topicIds: number[];
  sourceIds: number[];
  count: number;
  difficulty: string;
  blooms: string[];
  format: "single" | "situational" | "mixed";
  instructions: string;
  replaceQuestionId?: number;
  replaceReason?: string;
}

interface JobRow {
  id: number;
  settings: string;
  status: string;
  model: string | null;
  progress: number;
  total: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  notes: string;
  error: string | null;
  created_at: string;
  finished_at: string | null;
}

export function mapJob(r: JobRow) {
  return {
    id: r.id,
    settings: parseJson<JobSettings>(r.settings, {} as JobSettings),
    status: r.status,
    model: r.model,
    progress: r.progress,
    total: r.total,
    usage: { input: r.input_tokens, output: r.output_tokens, cacheRead: r.cache_read_tokens },
    notes: parseJson<string[]>(r.notes, []),
    error: r.error,
    createdAt: r.created_at,
    finishedAt: r.finished_at,
  };
}

export function getJob(id: number) {
  const row = get<JobRow>("SELECT * FROM jobs WHERE id = ?", id);
  return row && mapJob(row);
}

export function listJobs(limit = 20) {
  return all<JobRow>("SELECT * FROM jobs ORDER BY id DESC LIMIT ?", limit).map(mapJob);
}

export function createJob(settings: JobSettings): number {
  const { id } = run(
    "INSERT INTO jobs (settings, status, model, total) VALUES (?, 'queued', ?, ?)",
    JSON.stringify(settings), AI_MODEL_LABEL, settings.count,
  );
  void runJob(id);
  return id;
}

/** Jobs that were mid-run when the server stopped can't resume; mark them failed. */
export function failInterruptedJobs(): void {
  run(
    "UPDATE jobs SET status = 'error', error = 'Interrupted by a server restart.', finished_at = datetime('now') WHERE status IN ('queued', 'running')",
  );
}

/** Source excerpts the job may draw on: the chosen files, or else every ready file tagged with the subject. */
function candidateExcerpts(s: JobSettings): Excerpt[] {
  let sourceIds = s.sourceIds;
  if (!sourceIds.length) {
    const tagged = all<{ id: number; topic_ids: string | null }>(
      `SELECT src.id, GROUP_CONCAT(st.topic_id) AS topic_ids
       FROM sources src LEFT JOIN source_topics st ON st.source_id = src.id
       WHERE src.subject_id = ? AND src.status = 'ready' GROUP BY src.id`,
      s.subjectId,
    );
    // With topics chosen, prefer files tagged with one of them; untagged files still count.
    const wanted = new Set(s.topicIds);
    const matching = tagged.filter((t) => !t.topic_ids || !wanted.size || t.topic_ids.split(",").some((id) => wanted.has(Number(id))));
    sourceIds = (matching.length ? matching : tagged).map((t) => t.id);
  }
  if (!sourceIds.length) return [];
  return all<{ id: number; filename: string; location: string | null; text: string }>(
    `SELECT c.id, src.filename, c.location, c.text FROM chunks c JOIN sources src ON src.id = c.source_id
     WHERE src.status = 'ready' AND src.id IN ${placeholders(sourceIds.length)} ORDER BY src.id, c.idx`,
    ...sourceIds,
  ).map((c) => ({ chunkId: c.id, sourceName: c.filename, location: c.location, text: c.text }));
}

/** Splits excerpts into consecutive parts that each fit in one request. */
function partition(excerpts: Excerpt[]): Excerpt[][] {
  const parts: Excerpt[][] = [[]];
  let size = 0;
  for (const e of excerpts) {
    if (size + e.text.length > MAX_CONTEXT_CHARS && parts.at(-1)!.length) {
      parts.push([]);
      size = 0;
    }
    parts.at(-1)!.push(e);
    size += e.text.length;
  }
  return parts;
}

function addNotes(jobId: number, notes: string[]): void {
  if (!notes.length) return;
  const row = get<{ notes: string }>("SELECT notes FROM jobs WHERE id = ?", jobId);
  const merged = [...parseJson<string[]>(row?.notes, []), ...notes];
  run("UPDATE jobs SET notes = ? WHERE id = ?", JSON.stringify(merged), jobId);
}

async function runJob(jobId: number): Promise<void> {
  const job = getJob(jobId);
  if (!job) return;
  const s = job.settings;
  run("UPDATE jobs SET status = 'running' WHERE id = ?", jobId);

  try {
    const subject = get<{ id: number; code: string; name: string; description: string }>(
      "SELECT id, code, name, description FROM subjects WHERE id = ?", s.subjectId,
    );
    if (!subject) throw new Error("Subject not found.");
    const allTopics = all<{ id: number; name: string }>("SELECT id, name FROM topics WHERE subject_id = ? ORDER BY sort, id", s.subjectId);
    const topics = s.topicIds.length ? allTopics.filter((t) => s.topicIds.includes(t.id)) : allTopics;
    if (!topics.length) throw new Error("This subject has no topics. Add topics on the Blueprint page.");
    const topicByName = new Map(topics.map((t) => [t.name, t.id]));

    const excerpts = candidateExcerpts(s);
    if (!excerpts.length) {
      throw new Error("No processed source material for this subject. Upload files and tag them with this subject on the Sources page.");
    }
    const parts = partition(excerpts);

    const replacing = s.replaceQuestionId
      ? get<{ stem: string }>("SELECT stem FROM questions WHERE id = ?", s.replaceQuestionId)
      : undefined;

    const batches: number[] = [];
    for (let left = s.count; left > 0; left -= BATCH_SIZE) batches.push(Math.min(BATCH_SIZE, left));

    if (parts.length > batches.length) {
      addNotes(jobId, [
        `The selected material was too long for one request, so it was split into ${parts.length} parts; this job used ${batches.length}. Generate more questions, or pick specific files, to cover the rest.`,
      ]);
    }

    let created = 0;
    for (let b = 0; b < batches.length; b++) {
      const others = comparableQuestions(s.subjectId);
      const result = await generateBatch(
        {
          subject,
          topics: topics.map((t) => t.name),
          count: batches[b],
          difficulty: s.difficulty,
          blooms: s.blooms,
          format: s.format,
          instructions: s.instructions,
          avoidStems: others.slice(-60).map((o) => `${o.situation ? `${o.situation.slice(0, 100)}… ` : ""}${o.stem.slice(0, 160)}`),
          replacing: replacing && { stem: replacing.stem, reason: s.replaceReason ?? "" },
        },
        parts[b % parts.length],
      );

      if (result.items.length > batches[b]) result.items.length = batches[b];
      const excerptById = new Map(excerpts.map((e) => [`E${e.chunkId}`, e]));
      const letters = { A: 0, B: 0, C: 0, D: 0 };
      transaction(() => {
        for (const item of result.items) {
          const excerpt = excerptById.get(item.source_excerpt_id.trim());
          const correctIndex = "ABCD".indexOf(item.correct_option);
          letters[item.correct_option]++;
          const fields = {
            situation: item.situation.trim(),
            stem: item.stem.trim(),
            options: item.options,
            correctIndex,
            rationale: item.rationale.trim(),
            explanations: item.option_explanations,
            sourceQuote: item.source_quote.trim(),
          };
          const warnings = runChecks(fields, { excerptText: excerpt?.text ?? "", others });
          if (!excerpt) warnings.push(`Cited excerpt "${item.source_excerpt_id}" was not among those provided.`);
          const label = excerpt ? `${excerpt.sourceName}${excerpt.location ? `, ${excerpt.location}` : ""}` : "";
          const { id } = run(
            `INSERT INTO questions (subject_id, topic_id, job_id, chunk_id, situation, stem, options, correct_index,
               rationale, explanations, difficulty, bloom, format, status, warnings, source_quote, source_label)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`,
            s.subjectId, topicByName.get(item.topic) ?? topics[0].id, jobId, excerpt?.chunkId ?? null,
            fields.situation, fields.stem, JSON.stringify(fields.options), correctIndex, fields.rationale,
            JSON.stringify(fields.explanations), item.difficulty, item.bloom_level,
            fields.situation ? "situational" : "single", JSON.stringify(warnings), fields.sourceQuote, label,
          );
          others.push({ id, stem: fields.stem, situation: fields.situation });
          if (s.replaceQuestionId) logReview(id, "created", `Replacement for question #${s.replaceQuestionId}`);
          created++;
        }
        run(
          `UPDATE jobs SET progress = ?, input_tokens = input_tokens + ?, output_tokens = output_tokens + ?,
             cache_read_tokens = cache_read_tokens + ? WHERE id = ?`,
          created, result.usage.input, result.usage.output, result.usage.cacheRead, jobId,
        );
      });

      const n = result.items.length;
      const top = Math.max(...Object.values(letters));
      const notes = [...result.notes];
      if (n >= 4 && top / n > 0.5) notes.push(`Batch ${b + 1}: the correct answer is the same letter in ${top} of ${n} items; consider reordering options.`);
      if (n < batches[b]) notes.push(`Batch ${b + 1}: asked for ${batches[b]}, received ${n}.`);
      addNotes(jobId, notes);
    }

    run("UPDATE jobs SET status = 'done', finished_at = datetime('now') WHERE id = ?", jobId);
  } catch (err) {
    run("UPDATE jobs SET status = 'error', error = ?, finished_at = datetime('now') WHERE id = ?", describeError(err), jobId);
  }
}
