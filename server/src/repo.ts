import { all, get, placeholders, run } from "./db.ts";
import { parseJson } from "./http.ts";
import { runChecks } from "./services/checks.ts";

export interface QuestionRow {
  id: number;
  subject_id: number;
  topic_id: number | null;
  job_id: number | null;
  chunk_id: number | null;
  situation: string;
  stem: string;
  options: string;
  correct_index: number;
  rationale: string;
  explanations: string;
  difficulty: string;
  bloom: string;
  format: string;
  status: string;
  warnings: string;
  source_quote: string;
  source_label: string;
  is_sample: number;
  created_at: string;
  updated_at: string;
  subject_code: string;
  topic_name: string | null;
}

export const QUESTION_SELECT = `
  SELECT q.*, s.code AS subject_code, t.name AS topic_name
  FROM questions q
  JOIN subjects s ON s.id = q.subject_id
  LEFT JOIN topics t ON t.id = q.topic_id`;

export function mapQuestion(r: QuestionRow) {
  return {
    id: r.id,
    subjectId: r.subject_id,
    subjectCode: r.subject_code,
    topicId: r.topic_id,
    topicName: r.topic_name,
    jobId: r.job_id,
    chunkId: r.chunk_id,
    situation: r.situation,
    stem: r.stem,
    options: parseJson<string[]>(r.options, []),
    correctIndex: r.correct_index,
    rationale: r.rationale,
    explanations: parseJson<string[]>(r.explanations, []),
    difficulty: r.difficulty,
    bloom: r.bloom,
    format: r.format,
    status: r.status,
    warnings: parseJson<string[]>(r.warnings, []),
    sourceQuote: r.source_quote,
    sourceLabel: r.source_label,
    isSample: Boolean(r.is_sample),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export type Question = ReturnType<typeof mapQuestion>;

export function getQuestion(id: number): Question | undefined {
  const row = get<QuestionRow>(`${QUESTION_SELECT} WHERE q.id = ?`, id);
  return row && mapQuestion(row);
}

export function getQuestions(ids: number[]): Question[] {
  if (!ids.length) return [];
  return all<QuestionRow>(`${QUESTION_SELECT} WHERE q.id IN ${placeholders(ids.length)}`, ...ids).map(mapQuestion);
}

/** Questions the duplicate check compares against: everything in the subject that isn't rejected. */
export function comparableQuestions(subjectId: number, excludeId?: number) {
  return all<{ id: number; stem: string; situation: string }>(
    "SELECT id, stem, situation FROM questions WHERE subject_id = ? AND status != 'rejected' AND id != ?",
    subjectId, excludeId ?? 0,
  );
}

export function excerptText(chunkId: number | null): string | null {
  if (!chunkId) return null;
  return get<{ text: string }>("SELECT text FROM chunks WHERE id = ?", chunkId)?.text ?? "";
}

/** Re-runs the automatic checks for a stored question and saves the warnings. */
export function recheck(id: number): void {
  const q = getQuestion(id);
  if (!q) return;
  const warnings = runChecks(q, {
    excerptText: q.isSample ? null : excerptText(q.chunkId),
    others: comparableQuestions(q.subjectId, q.id),
  });
  run("UPDATE questions SET warnings = ? WHERE id = ?", JSON.stringify(warnings), id);
}

export function logReview(questionId: number, action: string, reason = ""): void {
  run("INSERT INTO review_events (question_id, action, reason) VALUES (?, ?, ?)", questionId, action, reason);
}
