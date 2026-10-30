import { Router } from "express";
import { z } from "zod";
import { publishExamBank } from "../bank.ts";
import { all } from "../db.ts";
import { QUESTION_SELECT, mapQuestion, type QuestionRow } from "../repo.ts";
import { questionFilter } from "./questions.ts";

const LETTERS = ["A", "B", "C", "D"];

function csvCell(value: unknown): string {
  const s = String(value ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const exportRouter = Router();

exportRouter.post("/exam-site/publish", (req, res) => {
  const { includeSamples } = z.object({ includeSamples: z.boolean().default(false) }).parse(req.body);
  const result = publishExamBank(includeSamples);
  res.json({ total: result.total, bySubject: result.bySubject });
});

exportRouter.get("/export/questions.csv", (req, res) => {
  const { where, params } = questionFilter(req);
  const questions = all<QuestionRow>(`${QUESTION_SELECT} ${where} ORDER BY s.sort, q.topic_id, q.id`, ...params).map(mapQuestion);

  const header = [
    "ID", "Subject", "Topic", "Difficulty", "Bloom's level", "Status", "Situation", "Stem",
    "Option A", "Option B", "Option C", "Option D", "Answer", "Rationale",
    "Why A", "Why B", "Why C", "Why D", "Source", "Source quote",
  ];
  const rows = questions.map((q) => [
    q.id, q.subjectCode, q.topicName, q.difficulty, q.bloom, q.status, q.situation, q.stem,
    ...[0, 1, 2, 3].map((i) => q.options[i]), LETTERS[q.correctIndex], q.rationale,
    ...[0, 1, 2, 3].map((i) => q.explanations[i]), q.sourceLabel, q.sourceQuote,
  ]);

  const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="pnle-questions-${stamp}.csv"`);
  // The BOM makes Excel read the file as UTF-8.
  res.send(`﻿${csv}`);
});
