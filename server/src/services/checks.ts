export interface CheckInput {
  situation: string;
  stem: string;
  options: string[];
  correctIndex: number;
  rationale: string;
  explanations: string[];
  sourceQuote: string;
}

export interface CheckContext {
  /** Text of the cited source excerpt; null when the item has no source (e.g. samples). */
  excerptText: string | null;
  /** Other questions in the same subject, for the duplicate check. */
  others: { id: number; stem: string; situation: string }[];
}

const STOPWORDS = new Set(
  "the a an of to and or in on for with is are was were be by at as which what who whom that this these those from into it its client nurse patient".split(" "),
);

/** Automatic quality checks. Returns human-readable warnings; an empty list means the item passed. */
export function runChecks(q: CheckInput, ctx: CheckContext): string[] {
  const w: string[] = [];
  const opts = q.options.map((o) => o.trim());

  if (opts.length !== 4) w.push(`Has ${opts.length} options; PNLE items have exactly 4.`);
  if (opts.some((o) => !o)) w.push("One or more options are empty.");
  if (new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) w.push("Two options are identical.");
  if (q.correctIndex < 0 || q.correctIndex >= opts.length) w.push("The correct answer does not point to an option.");
  if (opts.some((o) => /\b(all|none) of the above\b|\bboth [a-d] and [a-d]\b/i.test(o)))
    w.push('Uses "all/none of the above" or "both A and B" options.');

  if (q.stem.trim().length < 20) w.push("Stem is very short; make it a complete question.");
  if (/\b(EXCEPT|NOT|LEAST)\b/.test(q.stem) || /\b(except|least)\b/.test(q.stem))
    w.push("Negative stem (EXCEPT/NOT/LEAST); use sparingly.");

  if (opts.length === 4 && q.correctIndex >= 0 && q.correctIndex < 4) {
    const lengths = opts.map((o) => o.length);
    const others = lengths.filter((_, i) => i !== q.correctIndex);
    const avgOthers = others.reduce((a, b) => a + b, 0) / others.length;
    if (lengths[q.correctIndex] > 1.6 * avgOthers && lengths[q.correctIndex] - avgOthers > 15)
      w.push("The correct option is much longer than the distractors (a test-wise clue).");
  }

  if (!q.rationale.trim()) w.push("Missing rationale.");
  if (q.explanations.length !== opts.length || q.explanations.some((e) => !e.trim()))
    w.push("Missing an explanation for one or more options.");

  if (ctx.excerptText !== null) {
    if (!q.sourceQuote.trim()) w.push("No supporting quote from the source.");
    else if (!normalize(ctx.excerptText).includes(normalize(q.sourceQuote)))
      w.push("The supporting quote was not found word-for-word in the cited excerpt; verify against the source.");
  }

  const mine = tokens(`${q.situation} ${q.stem}`);
  for (const other of ctx.others) {
    if (similarity(mine, tokens(`${other.situation} ${other.stem}`)) >= 0.75) {
      w.push(`Very similar to question #${other.id}.`);
      break;
    }
  }
  return w;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function tokens(s: string): Set<string> {
  return new Set(normalize(s).split(" ").filter((t) => t.length > 2 && !STOPWORDS.has(t)));
}

function similarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / (a.size + b.size - shared);
}
