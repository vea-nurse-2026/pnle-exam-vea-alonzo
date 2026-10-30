import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import { ALLOWED_EXTENSIONS, MOCK_AI, MOCK_DATA_DIR, UPLOAD_DIR } from "../config.ts";
import { all, get, run } from "../db.ts";
import { HttpError } from "../http.ts";
import { listSources, processSource } from "./sources.ts";

export const mockRouter = Router();

/** Imports the sample files in mock-data/ as sources. Each file name starts with its subject ("NP1 - ..."). */
mockRouter.post("/mock/load-sources", async (_req, res) => {
  if (!MOCK_AI) throw new HttpError(403, "Sample files can only be loaded in mock AI mode.");
  const names = (await fs.readdir(MOCK_DATA_DIR).catch(() => [] as string[])).filter((n) =>
    ALLOWED_EXTENSIONS.includes(path.extname(n).toLowerCase()) && /^NP\d/i.test(n),
  );
  if (!names.length) throw new HttpError(404, "No sample files found in the mock-data folder.");

  const subjects = all<{ id: number; code: string }>("SELECT id, code FROM subjects");
  const roman = ["I", "II", "III", "IV", "V"];
  const ids: number[] = [];
  for (const name of names) {
    if (get("SELECT id FROM sources WHERE filename = ?", name)) continue;
    const n = Number(/^NP(\d)/i.exec(name)![1]);
    const subject = subjects.find((s) => s.code === `NP ${roman[n - 1]}`);
    const stored = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${path.extname(name).toLowerCase()}`;
    await fs.copyFile(path.join(MOCK_DATA_DIR, name), path.join(UPLOAD_DIR, stored));
    const { size } = await fs.stat(path.join(UPLOAD_DIR, stored));
    ids.push(run("INSERT INTO sources (filename, stored_name, size, subject_id) VALUES (?, ?, ?, ?)", name, stored, size, subject?.id ?? null).id);
  }
  for (const id of ids) void processSource(id);
  res.json(listSources());
});
