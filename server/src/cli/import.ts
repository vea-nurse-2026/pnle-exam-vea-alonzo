// Usage (from the project root): npm run import -- imports/<file>.json
import fs from "node:fs";
import path from "node:path";
import { importQuestions } from "../bank.ts";
import { seed } from "../seed.ts";

const arg = process.argv[2];
if (!arg) {
  console.error("Usage: npm run import -- <questions.json>");
  process.exit(1);
}
// npm runs workspace scripts from server/, so resolve the path from where the command was typed.
const file = path.resolve(process.env.INIT_CWD ?? process.cwd(), arg);

seed();
const result = importQuestions(JSON.parse(fs.readFileSync(file, "utf8")), path.basename(file));

console.log(`Imported ${result.imported} question(s) from ${path.basename(file)} into the Review Queue.`);
if (result.withWarnings) console.log(`${result.withWarnings} have automatic-check warnings to look at.`);
if (result.createdTopics.length) console.log(`New topics created:\n  ${result.createdTopics.join("\n  ")}`);
if (result.errors.length) {
  console.log(`Skipped ${result.errors.length} item(s):\n  ${result.errors.join("\n  ")}`);
  process.exitCode = 1;
}
