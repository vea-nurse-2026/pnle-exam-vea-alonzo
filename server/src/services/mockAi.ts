import type { BatchRequest, BatchResult, Excerpt, GeneratedItem } from "./generator.ts";
import { MOCK_POOL } from "./mockPool.ts";

const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Stands in for Claude when MOCK_AI=true: returns unused test questions for the subject. */
export async function mockBatch(req: BatchRequest, excerpts: Excerpt[]): Promise<BatchResult> {
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const existing = req.avoidStems.join("\n").toLowerCase();
  // Situational items often share a short stem ("What is the nurse's FIRST action?"), so match those by situation.
  const isUsed = (q: (typeof MOCK_POOL)[number]) =>
    existing.includes((q.situation ?? q.stem).slice(0, 60).toLowerCase()) || q.stem === req.replacing?.stem;
  let pool = MOCK_POOL.filter((q) => q.subject === req.subject.code && !isUsed(q));
  const onTopic = pool.filter((q) => req.topics.includes(q.topic));
  if (onTopic.length) pool = onTopic;
  // Prefer the requested difficulty and cognitive levels.
  const score = (q: (typeof MOCK_POOL)[number]) =>
    (req.difficulty === "Mixed" || q.difficulty === req.difficulty ? 0 : 1) + (req.blooms.includes(q.bloom) ? 0 : 1);
  const picked = [...pool].sort((a, b) => score(a) - score(b)).slice(0, req.count);

  const items: GeneratedItem[] = picked.map((q) => {
    const excerpt = excerpts.find((e) => normalize(e.text).includes(normalize(q.quote))) ?? excerpts[0];
    return {
      situation: q.situation ?? "",
      stem: q.stem,
      options: q.options,
      correct_option: q.answer,
      rationale: q.rationale,
      option_explanations: q.explanations,
      topic: req.topics.includes(q.topic) ? q.topic : req.topics[0],
      difficulty: q.difficulty,
      bloom_level: q.bloom,
      source_excerpt_id: `E${excerpt.chunkId}`,
      source_quote: q.quote,
    };
  });

  const notes = ["Mock AI mode: these questions come from a built-in test pool, not from Claude."];
  if (picked.length < req.count) {
    notes.push(`The test pool has no more unused ${req.subject.code} questions, so ${picked.length} of ${req.count} were returned.`);
  }
  return { items, notes, usage: { input: 0, output: 0, cacheRead: 0 } };
}
