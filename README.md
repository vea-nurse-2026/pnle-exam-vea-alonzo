# PNLE QBank Studio

A web app that turns your nursing review materials into Philippine Nurse Licensure Examination (PNLE) style multiple-choice questions. You review and approve every question before examinees practice with it.

- **Source Materials**: upload PDF, Word (.docx), PowerPoint (.pptx), or text files, and tag each with a subject and topics.
- **Blueprint**: the five PNLE subjects (NP I–V) as defined in PRC's enhanced Tables of Specifications (Board of Nursing Resolution No. 10, s. 2025), with editable topics, weights, and targets.
- **Generate**: Claude writes drafts from your files. Each draft has 4 options, the key, a rationale, a one-line explanation per option, and a quote from the source.
- **Review Queue**: check each draft beside its source excerpt, then approve, edit, reject, or reject and regenerate. Automatic checks flag common problems: missing or unverifiable source quotes, near-duplicates, "all of the above", negative stems, and a correct answer that is noticeably longer than the others.
- **Question Bank**: search and filter, export to CSV, or print / save as PDF with an answer key.
- **Practice Exam**: timed exam or study mode, scored with the PNLE rule (general average of at least 75%, no subject below 60%).

The bank starts with 16 sample questions, so practice mode works right away. You can delete them from the Question Bank (filter "Samples only").

The project has two parts:

| Part | Runs on | Who uses it |
| --- | --- | --- |
| **Studio** (`client/index.html` + `server/`) | Your computer | You: import, review, and approve questions |
| **Online exam site** (`client/exam.html`) | Vercel, as a static site | Examinees: practice exams, study mode, board simulations. Results are saved in their browser. |

## Workflow: from review materials to the online site

1. **Add materials.** Put downloaded review books (PDF, Word, PowerPoint, text) in `materials/` and extract their text:
   ```bash
   npm run extract
   ```
   Text goes to `materials/_text/`, one block per page. Pages without a text layer (scanned books) are listed so they can be OCR'd or read as images. `materials/` is in `.gitignore`, so the books never reach GitHub or the public site.
2. **Write questions.** Claude Code reads your materials and writes a question file to `imports/` (format in [imports/README.md](imports/README.md)).
3. **Import them** into the studio's Review Queue as drafts:
   ```bash
   npm run import -- imports/<file>.json
   ```
4. **Review** each draft in the studio: approve, edit, or reject.
5. **Publish** the approved questions to the online site: click **Publish to exam site** on the Question Bank page, or run
   ```bash
   npm run publish:exam
   ```
   This writes `client/exam-public/questions.json`.
6. **Commit and push.** Vercel rebuilds the site in about a minute.

## Deploying the online exam site to Vercel

One-time setup:

1. Put the project in a GitHub repository. Make it **private**, because the questions come from your review materials.
2. In Vercel, choose **Add New → Project**, import the repository, and click **Deploy**. `vercel.json` already sets the build (`npm run build:exam`) and output folder (`client/dist-exam`), so no settings need changing.

After that, every push to the main branch updates the site. The site has no server or database: anyone with the link can use it, and each person's results stay in their own browser.

To preview the online site locally: `npm run dev:exam` (opens http://localhost:5191/exam.html).

## Requirements

- Node.js 24 or newer
- A Claude API key from [platform.claude.com](https://platform.claude.com). You only need it to generate questions.

## Setup

```bash
npm install
cp server/.env.example server/.env     # then put your key in ANTHROPIC_API_KEY
```

On Windows PowerShell, use `Copy-Item server/.env.example server/.env` instead of `cp`.

## Run

**Development** (auto-reloads):

```bash
npm run dev
```

Open http://localhost:5190. Sign-in is off by default, and the studio is reachable only from this computer. To require an admin account, set `REQUIRE_LOGIN=true` in `server/.env`.

**Production** (one server on one port):

```bash
npm run build
npm start
```

Open http://localhost:4100.

## Settings (`server/.env`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | — | Required for generation |
| `CLAUDE_MODEL` | `claude-opus-5-5` | Model that writes the questions |
| `CLAUDE_EFFORT` | `high` | `low`, `medium`, `high`, `xhigh`, or `max`. Lower is cheaper and faster. |
| `MAX_CONTEXT_CHARS` | `120000` | Source text sent per request (~4 characters per token) |
| `PORT` | `4100` | API / production port |
| `DATA_DIR` | `server/data` | Where the database and uploads are stored |
| `COOKIE_SECURE` | `false` | Set to `true` when served over HTTPS |

Rough cost with Claude Opus 5.5 at `high` effort: 2–3 US cents per question. Each job reports its actual token use.

## How it works

```
client/   React + Vite + Tailwind single-page app
server/   Node.js + Express API (TypeScript, run directly by Node 24)
  src/routes/       REST endpoints (/api/...)
  src/services/     text extraction, chunking, Claude generation, quality checks, job runner
  data/             SQLite database (pnle.db) and uploaded files (created on first run)
```

1. An uploaded file is split into excerpts of about 1,500 characters, each tagged with its page or slide.
2. A generation job sends the relevant excerpts and your settings to Claude. Jobs of more than 10 questions run in batches of 10. Claude returns structured JSON, which is validated.
3. Each item cites an excerpt and quotes it. The server confirms that the quote appears in that excerpt, runs the other checks, and saves the item as a draft.
4. Only approved items appear in the bank's default view and in practice exams.

The database is SQLite, using Node's built-in driver, so there's nothing extra to install. To back up, copy `server/data/`.

## Notes

- Scanned PDFs (page images) have no text layer, so they can't be read yet. Run them through OCR first.
- Upload only materials you have the right to use.
- Practice scores are estimates, not official PRC ratings.
