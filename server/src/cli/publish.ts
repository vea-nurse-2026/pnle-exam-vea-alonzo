// Usage (from the project root): npm run publish:exam [-- --include-samples]
import path from "node:path";
import { publishExamBank } from "../bank.ts";
import { seed } from "../seed.ts";

seed();
const result = publishExamBank(process.argv.includes("--include-samples"));
console.log(`Published ${result.total} approved question(s) to ${path.relative(process.env.INIT_CWD ?? process.cwd(), result.file)}`);
console.log(`  ${result.bySubject.join(" · ")}`);
console.log("Commit and push to update the online site.");
