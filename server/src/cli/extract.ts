// Usage (from the project root): npm run extract -- [materials/<file> ...]
// With no arguments, extracts every supported file in materials/. Text goes to materials/_text/<file>.txt,
// one "=== p. N ===" block per page, and pages without a text layer (scans) are listed for OCR.
import fs from "node:fs";
import path from "node:path";
import { ALLOWED_EXTENSIONS } from "../config.ts";
import { extractSegments } from "../services/extract.ts";

const root = process.env.INIT_CWD ?? process.cwd();
const materials = path.resolve(root, "materials");
const outDir = path.join(materials, "_text");

const args = process.argv.slice(2);
const files = args.length
  ? args.map((a) => path.resolve(root, a))
  : fs.existsSync(materials)
    ? fs
        .readdirSync(materials)
        .filter((f) => ALLOWED_EXTENSIONS.includes(path.extname(f).toLowerCase()))
        .map((f) => path.join(materials, f))
    : [];

if (!files.length) {
  console.error("No files to extract. Put PDF, Word, PowerPoint, or text files in materials/ first.");
  process.exit(1);
}

/** "3, 5-9, 12" from a sorted list of page numbers. */
function ranges(pages: number[]): string {
  const out: string[] = [];
  for (let i = 0; i < pages.length; i++) {
    const start = pages[i];
    while (pages[i + 1] === pages[i] + 1) i++;
    out.push(start === pages[i] ? `${start}` : `${start}-${pages[i]}`);
  }
  return out.join(", ");
}

fs.mkdirSync(outDir, { recursive: true });
for (const file of files) {
  const name = path.basename(file);
  try {
    const segments = await extractSegments(file, name);
    const scanned = segments.flatMap((s, i) => (s.text.trim().length < 40 ? [i + 1] : []));
    const body = segments.map((s, i) => `=== ${s.location ?? `part ${i + 1}`} ===\n${s.text.trim()}`).join("\n\n");
    fs.writeFileSync(path.join(outDir, `${name}.txt`), body);

    const chars = segments.reduce((n, s) => n + s.text.length, 0);
    console.log(`${name}: ${segments.length} page(s), ${chars.toLocaleString()} characters → materials/_text/${name}.txt`);
    if (scanned.length) {
      console.log(`  ${scanned.length} page(s) have no text layer (scanned) and need OCR: ${ranges(scanned)}`);
    }
  } catch (e) {
    console.log(`${name}: could not extract (${e instanceof Error ? e.message : e})`);
    process.exitCode = 1;
  }
}
