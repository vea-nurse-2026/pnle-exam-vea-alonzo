import fs from "node:fs";
import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { CLAUDE_MODEL, CLIENT_DIST, MOCK_AI, PORT, REQUIRE_LOGIN, aiConfigured } from "./config.ts";
import "./db.ts";
import { HttpError } from "./http.ts";
import { authRouter, requireAuth } from "./routes/auth.ts";
import { dashboardRouter } from "./routes/dashboard.ts";
import { exportRouter } from "./routes/export.ts";
import { mockRouter } from "./routes/mock.ts";
import { practiceRouter } from "./routes/practice.ts";
import { questionsRouter } from "./routes/questions.ts";
import { resumeInterruptedSources, sourcesRouter } from "./routes/sources.ts";
import { subjectsRouter } from "./routes/subjects.ts";
import { seed } from "./seed.ts";
import { failInterruptedJobs } from "./services/jobs.ts";

seed();
failInterruptedJobs();
resumeInterruptedSources();

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));

app.use("/api/auth", authRouter);
app.use("/api", requireAuth, subjectsRouter, sourcesRouter, questionsRouter, practiceRouter, dashboardRouter, exportRouter, mockRouter);
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found." });
});

// In production the built frontend is served from here; in development Vite serves it.
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(CLIENT_DIST, "index.html")));
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: err.issues[0]?.message ?? "Invalid request." });
  } else if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
  } else if (err instanceof multer.MulterError) {
    res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "Files must be 50 MB or smaller." : err.message });
  } else {
    console.error(err);
    res.status(500).json({ error: "Something went wrong on the server." });
  }
});

// Without sign-in, listen on this computer only so nobody else on the network can open the studio.
app.listen(PORT, REQUIRE_LOGIN ? "0.0.0.0" : "127.0.0.1", () => {
  console.log(`PNLE QBank Studio API on http://localhost:${PORT}`);
  if (!REQUIRE_LOGIN) console.log("Sign-in is off (set REQUIRE_LOGIN=true in server/.env to turn it on).");
  if (MOCK_AI) console.log("Mock AI mode: generation uses the built-in test pool, not Claude.");
  else console.log(aiConfigured() ? `Claude model: ${CLAUDE_MODEL}` : "No ANTHROPIC_API_KEY found. Add one to server/.env to generate questions.");
});
