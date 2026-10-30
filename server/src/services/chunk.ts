import type { Segment } from "./extract.ts";

const TARGET = 1500;

/** Splits extracted text into excerpts of about TARGET characters, keeping each excerpt's page or slide. */
export function chunkSegments(segments: Segment[]): Segment[] {
  const out: Segment[] = [];
  for (const seg of segments) {
    const clean = seg.text
      .replace(/\r/g, "")
      .replace(/[ \t\f\v]+/g, " ")
      .replace(/\n\s*\n+/g, "\n\n")
      .trim();
    if (!clean) continue;

    let buffer = "";
    const flush = () => {
      if (buffer.trim()) out.push({ location: seg.location, text: buffer.trim() });
      buffer = "";
    };

    for (const piece of pieces(clean)) {
      if (buffer && buffer.length + piece.length > TARGET) flush();
      buffer += (buffer ? "\n" : "") + piece;
    }
    flush();
  }
  return out;
}

/** Lines, with over-long lines broken at sentence ends and, failing that, at TARGET characters. */
function* pieces(text: string): Generator<string> {
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    if (line.length <= TARGET) {
      yield line;
      continue;
    }
    for (const sentence of line.split(/(?<=[.!?])\s+/)) {
      for (let i = 0; i < sentence.length; i += TARGET) yield sentence.slice(i, i + TARGET);
    }
  }
}
