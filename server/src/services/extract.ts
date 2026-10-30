import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

export interface Segment {
  location: string | null;
  text: string;
}

/** Reads an uploaded file and returns its text, split by page or slide where the format has them. */
export async function extractSegments(filePath: string, filename: string): Promise<Segment[]> {
  const ext = path.extname(filename).toLowerCase();
  const buf = await fs.readFile(filePath);
  switch (ext) {
    case ".pdf": {
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const { text } = await extractText(pdf, { mergePages: false });
      return text.map((t, i) => ({ location: `p. ${i + 1}`, text: t }));
    }
    case ".docx": {
      const { value } = await mammoth.extractRawText({ buffer: buf });
      return [{ location: null, text: value }];
    }
    case ".pptx":
      return extractPptx(buf);
    case ".txt":
    case ".md":
      return [{ location: null, text: buf.toString("utf8") }];
    default:
      throw new Error(`Unsupported file type "${ext}"`);
  }
}

async function extractPptx(buf: Buffer): Promise<Segment[]> {
  const zip = await JSZip.loadAsync(buf);
  const slides = Object.keys(zip.files)
    .map((name) => ({ name, n: Number(/^ppt\/slides\/slide(\d+)\.xml$/.exec(name)?.[1] ?? 0) }))
    .filter((s) => s.n > 0)
    .sort((a, b) => a.n - b.n);

  const segments: Segment[] = [];
  for (const slide of slides) {
    const xml = await zip.file(slide.name)!.async("string");
    const paragraphs = xml
      .split("</a:p>")
      .map((p) => [...p.matchAll(/<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g)].map((m) => decodeXml(m[1])).join(""))
      .filter((line) => line.trim());
    segments.push({ location: `slide ${slide.n}`, text: paragraphs.join("\n") });
  }
  return segments;
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
}
