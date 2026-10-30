import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { BLOOMS, CLAUDE_EFFORT, CLAUDE_MODEL, DIFFICULTIES, MOCK_AI } from "../config.ts";
import { mockBatch } from "./mockAi.ts";

export interface Excerpt {
  chunkId: number;
  sourceName: string;
  location: string | null;
  text: string;
}

export interface BatchRequest {
  subject: { code: string; name: string; description: string };
  topics: string[];
  count: number;
  difficulty: string; // "Mixed" or one of DIFFICULTIES
  blooms: string[];
  format: "single" | "situational" | "mixed";
  instructions: string;
  avoidStems: string[];
  replacing?: { stem: string; reason: string };
}

const Item = z.object({
  situation: z.string(),
  stem: z.string().min(1),
  options: z.array(z.string()).length(4),
  correct_option: z.enum(["A", "B", "C", "D"]),
  rationale: z.string(),
  option_explanations: z.array(z.string()),
  topic: z.string(),
  difficulty: z.enum(DIFFICULTIES),
  bloom_level: z.enum(BLOOMS),
  source_excerpt_id: z.string(),
  source_quote: z.string(),
});
export type GeneratedItem = z.infer<typeof Item>;

export interface BatchResult {
  items: GeneratedItem[];
  notes: string[];
  usage: { input: number; output: number; cacheRead: number };
}

const SYSTEM_PROMPT = `You write multiple-choice questions for the Philippine Nurse Licensure Examination (PNLE), administered by the Professional Regulation Commission (PRC) Board of Nursing. A human reviewer approves every item before examinees see it.

Write items the way the PNLE does:
- Single best answer with exactly 4 options. Put option text only in "options" (no "A." prefixes); give the key as a letter in "correct_option".
- A clear, complete stem. Capitalize priority words as board items do (FIRST, BEST, MOST, PRIORITY, INITIAL). Avoid negative stems (EXCEPT, NOT, LEAST) unless asked.
- Plausible, homogeneous distractors of similar length and grammatical form. Never use "all of the above", "none of the above", or "both A and B".
- Spread the correct letter across A-D. Keep naturally ordered options (numbers, ranges) in ascending order.
- Apply the nursing process, prioritization (ABC, Maslow), safety, and delegation where they fit the requested cognitive level.
- Use Filipino names, Philippine settings (barangay health station, rural health unit, DOH programs) where natural. Write in English.

Grounding rules:
- The keyed answer and rationale must be supported by the source excerpts provided. Do not key an answer on facts the excerpts don't support.
- You may use standard nursing knowledge to explain why distractors are wrong, but never contradict the excerpts.
- "source_excerpt_id" is the id of the excerpt that supports the answer (e.g. "E12"). "source_quote" is a short phrase of at most 25 words copied exactly, character for character, from that excerpt.
- Paraphrase; do not copy long passages from the excerpts into stems or options.
- If the excerpts cannot support the requested number of good items, write fewer and say why in "notes". Use "notes" for anything else the reviewer should know; use an empty string if there is nothing.

Field rules:
- "situation": the shared clinical scenario for situational items, or "" for stand-alone items. For a situational set, copy the identical situation text into every item of the set.
- "rationale": 1-3 sentences on why the key is correct.
- "option_explanations": exactly 4 strings in A-D order; one line each on why that option is right or wrong.
- "topic": exactly one of the topic names given in the request.
- "difficulty": Easy, Moderate, or Difficult. "bloom_level": the revised Bloom's level the item actually tests.`;

function outputSchema(topics: string[]) {
  const str = { type: "string" };
  return {
    type: "object",
    additionalProperties: false,
    required: ["questions", "notes"],
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "situation", "stem", "options", "correct_option", "rationale", "option_explanations",
            "topic", "difficulty", "bloom_level", "source_excerpt_id", "source_quote",
          ],
          properties: {
            situation: str,
            stem: str,
            options: { type: "array", items: str },
            correct_option: { type: "string", enum: ["A", "B", "C", "D"] },
            rationale: str,
            option_explanations: { type: "array", items: str },
            topic: { type: "string", enum: topics },
            difficulty: { type: "string", enum: [...DIFFICULTIES] },
            bloom_level: { type: "string", enum: [...BLOOMS] },
            source_excerpt_id: str,
            source_quote: str,
          },
        },
      },
      notes: str,
    },
  };
}

function excerptBlock(excerpts: Excerpt[]): string {
  const body = excerpts
    .map((e) => {
      const loc = e.location ? ` location="${e.location}"` : "";
      return `<excerpt id="E${e.chunkId}" source="${e.sourceName.replace(/"/g, "'")}"${loc}>\n${e.text}\n</excerpt>`;
    })
    .join("\n");
  return `<source_excerpts>\n${body}\n</source_excerpts>`;
}

function taskText(req: BatchRequest): string {
  const difficulty =
    req.difficulty === "Mixed"
      ? "A mix: roughly 30% Easy, 50% Moderate, 20% Difficult."
      : `All items ${req.difficulty}.`;
  const format =
    req.count < 3 && req.format !== "single"
      ? "Situational: each item opens with a clinical situation."
      : {
          single: 'Stand-alone items only ("situation" is "").',
          situational: "Situational sets: groups of 3-5 items that share one clinical situation.",
          mixed: "About half stand-alone items and half situational sets of 3-5 items.",
        }[req.format];

  const lines = [
    `Write ${req.count} PNLE-style multiple-choice question${req.count === 1 ? "" : "s"} from the source excerpts above.`,
    "",
    `Subject: ${req.subject.code} - ${req.subject.name}`,
    `PRC coverage: ${req.subject.description}`,
    `Topics (spread items across these; use these exact names): ${req.topics.map((t) => `"${t}"`).join(", ")}`,
    `Difficulty: ${difficulty}`,
    `Cognitive levels (revised Bloom's): ${req.blooms.join(", ")}. Spread items across them.`,
    `Format: ${format}`,
  ];
  if (req.instructions.trim()) lines.push("", `Reviewer instructions: ${req.instructions.trim()}`);
  if (req.replacing) {
    lines.push(
      "",
      "This item replaces one the reviewer rejected. Write a different item on the same topic that fixes the problem.",
      `Rejected stem: ${req.replacing.stem}`,
      `Reviewer's reason: ${req.replacing.reason || "(none given)"}`,
    );
  }
  if (req.avoidStems.length) {
    lines.push("", "Do not duplicate these existing questions:", ...req.avoidStems.map((s) => `- ${s}`));
  }
  return lines.join("\n");
}

let client: Anthropic | null = null;

export async function generateBatch(req: BatchRequest, excerpts: Excerpt[]): Promise<BatchResult> {
  if (MOCK_AI) return mockBatch(req, excerpts);
  client ??= new Anthropic();

  const stream = client.beta.messages.stream({
    model: CLAUDE_MODEL,
    max_tokens: 64000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: CLAUDE_EFFORT,
      format: { type: "json_schema", schema: outputSchema(req.topics) },
    },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          // The excerpts repeat across batches of one job, so cache them.
          { type: "text", text: excerptBlock(excerpts), cache_control: { type: "ephemeral" } },
          { type: "text", text: taskText(req) },
        ],
      },
    ],
  });
  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    throw new Error("Claude declined this request. Try different source material or settings.");
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error("The response was cut off. Try fewer questions per job.");
  }

  const text = message.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Claude returned output that was not valid JSON.");
  }

  const envelope = z.object({ questions: z.array(z.unknown()), notes: z.string() }).parse(raw);
  const items: GeneratedItem[] = [];
  let invalid = 0;
  for (const candidate of envelope.questions) {
    const parsed = Item.safeParse(candidate);
    if (parsed.success) items.push(parsed.data);
    else invalid++;
  }

  const notes = envelope.notes.trim() ? [envelope.notes.trim()] : [];
  if (invalid) notes.push(`${invalid} item(s) were malformed and skipped.`);

  return {
    items,
    notes,
    usage: {
      input: message.usage.input_tokens + (message.usage.cache_creation_input_tokens ?? 0),
      output: message.usage.output_tokens,
      cacheRead: message.usage.cache_read_input_tokens ?? 0,
    },
  };
}

export function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return "Claude API key missing or invalid. Add ANTHROPIC_API_KEY to server/.env and restart the server.";
  }
  if (err instanceof Anthropic.RateLimitError) return "Claude rate limit reached. Wait a minute and try again.";
  if (err instanceof Anthropic.BadRequestError) return `Claude rejected the request: ${err.message}`;
  if (err instanceof Anthropic.APIError) return `Claude API error (${err.status ?? "network"}): ${err.message}`;
  if (err instanceof Error) {
    if (/api.?key|credentials|authentication/i.test(err.message)) {
      return "No Claude credentials found. Add ANTHROPIC_API_KEY to server/.env and restart the server.";
    }
    return err.message;
  }
  return String(err);
}
