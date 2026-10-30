import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { BLOOMS, DIFFICULTIES, EXAM_DATA_FILE } from "./config.ts";
import { all, get, run, transaction } from "./db.ts";
import { QUESTION_SELECT, comparableQuestions, logReview, mapQuestion, type QuestionRow } from "./repo.ts";
import { runChecks } from "./services/checks.ts";

// Moving questions in and out of the bank: importing question files written outside the app,
// and publishing approved questions for the static online exam site.

const ImportItem = z.object({
  subject: z.string().min(1),
  topic: z.string().trim().min(1),
  situation: z.string().default(""),
  stem: z.string().trim().min(1),
  options: z.array(z.string().trim().min(1)).length(4),
  answer: z.enum(["A", "B", "C", "D"]),
  rationale: z.string().trim().min(1),
  explanations: z.array(z.string()).length(4),
  difficulty: z.enum(DIFFICULTIES),
  bloom: z.enum(BLOOMS),
  source: z.string().default(""),
  quote: z.string().default(""),
});

const ImportFile = z.union([
  z.array(z.unknown()),
  z.object({ source: z.string().optional(), questions: z.array(z.unknown()) }),
]);

const ROMAN = ["I", "II", "III", "IV", "V"];

/** Accepts "NP III", "NP3", "np 3", "NP-III". */
function subjectCode(raw: string): string {
  const m = /^np\s*-?\s*([1-5]|i{1,3}|iv|v)$/i.exec(raw.trim());
  if (!m) return raw.trim();
  const n = /^\d$/.test(m[1]) ? Number(m[1]) : ROMAN.indexOf(m[1].toUpperCase()) + 1;
  return `NP ${ROMAN[n - 1]}`;
}

export interface ImportResult {
  imported: number;
  withWarnings: number;
  createdTopics: string[];
  errors: string[];
}

/** Adds questions as drafts for review. Unknown topics are created under their subject. */
export function importQuestions(raw: unknown, label: string): ImportResult {
  const file = ImportFile.parse(raw);
  const items = Array.isArray(file) ? file : file.questions;
  const defaultSource = Array.isArray(file) ? "" : (file.source ?? "");
  const subjects = all<{ id: number; code: string }>("SELECT id, code FROM subjects");
  const result: ImportResult = { imported: 0, withWarnings: 0, createdTopics: [], errors: [] };

  transaction(() => {
    items.forEach((candidate, i) => {
      const parsed = ImportItem.safeParse(candidate);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        result.errors.push(`#${i + 1}: ${issue.path.join(".") || "item"} — ${issue.message}`);
        return;
      }
      const q = parsed.data;
      const subject = subjects.find((s) => s.code === subjectCode(q.subject));
      if (!subject) {
        result.errors.push(`#${i + 1}: unknown subject "${q.subject}" (use NP I to NP V)`);
        return;
      }

      let topic = get<{ id: number }>("SELECT id FROM topics WHERE subject_id = ? AND lower(name) = lower(?)", subject.id, q.topic);
      if (!topic) {
        const sort = get<{ m: number | null }>("SELECT MAX(sort) AS m FROM topics WHERE subject_id = ?", subject.id)?.m ?? 0;
        topic = { id: run("INSERT INTO topics (subject_id, name, sort) VALUES (?, ?, ?)", subject.id, q.topic, sort + 1).id };
        result.createdTopics.push(`${subject.code}: ${q.topic}`);
      }

      const correctIndex = "ABCD".indexOf(q.answer);
      const fields = {
        situation: q.situation.trim(),
        stem: q.stem,
        options: q.options,
        correctIndex,
        rationale: q.rationale,
        explanations: q.explanations,
        sourceQuote: q.quote.trim(),
      };
      const warnings = runChecks(fields, { excerptText: null, others: comparableQuestions(subject.id) });
      const { id } = run(
        `INSERT INTO questions (subject_id, topic_id, situation, stem, options, correct_index, rationale, explanations,
           difficulty, bloom, format, status, warnings, source_quote, source_label)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`,
        subject.id, topic.id, fields.situation, fields.stem, JSON.stringify(fields.options), correctIndex, fields.rationale,
        JSON.stringify(fields.explanations), q.difficulty, q.bloom, fields.situation ? "situational" : "single",
        JSON.stringify(warnings), fields.sourceQuote, q.source.trim() || defaultSource,
      );
      logReview(id, "imported", label);
      result.imported++;
      if (warnings.length) result.withWarnings++;
    });
  });
  return result;
}

/** Writes approved questions and the blueprint to the online exam site's data file. */
export function publishExamBank(includeSamples: boolean) {
  const questions = all<QuestionRow>(
    `${QUESTION_SELECT} WHERE q.status = 'approved' ${includeSamples ? "" : "AND q.is_sample = 0"} ORDER BY q.subject_id, q.id`,
  ).map(mapQuestion);
  const subjects = all<{ id: number; code: string; name: string; description: string; target_items: number }>(
    "SELECT id, code, name, description, target_items FROM subjects ORDER BY sort, id",
  );
  const topics = all<{ id: number; subject_id: number; name: string; target_items: number }>(
    "SELECT id, subject_id, name, target_items FROM topics ORDER BY sort, id",
  );

  const data = {
    publishedAt: new Date().toISOString(),
    subjects: subjects.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      description: s.description,
      targetItems: s.target_items,
      topics: topics.filter((t) => t.subject_id === s.id).map((t) => ({ id: t.id, name: t.name, targetItems: t.target_items })),
    })),
    questions: questions.map((q) => ({
      id: q.id,
      subjectId: q.subjectId,
      subjectCode: q.subjectCode,
      topicId: q.topicId,
      topicName: q.topicName,
      situation: q.situation,
      stem: q.stem,
      options: q.options,
      correctIndex: q.correctIndex,
      rationale: q.rationale,
      explanations: q.explanations,
      difficulty: q.difficulty,
      bloom: q.bloom,
      sourceLabel: q.sourceLabel,
    })),
  };

  fs.mkdirSync(path.dirname(EXAM_DATA_FILE), { recursive: true });
  fs.writeFileSync(EXAM_DATA_FILE, JSON.stringify(data));
  const bySubject = subjects.map((s) => `${s.code}: ${questions.filter((q) => q.subjectId === s.id).length}`);
  return { file: EXAM_DATA_FILE, total: questions.length, bySubject };
}
