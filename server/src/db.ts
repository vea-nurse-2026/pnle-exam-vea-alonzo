import fs from "node:fs";
import path from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { DATA_DIR, UPLOAD_DIR } from "./config.ts";

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, "pnle.db"));

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  target_items INTEGER NOT NULL DEFAULT 100,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 0,
  target_items INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY,
  filename TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  mime TEXT,
  size INTEGER NOT NULL,
  subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  error TEXT,
  char_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS source_topics (
  source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  PRIMARY KEY (source_id, topic_id)
);

CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY,
  source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL,
  location TEXT,
  text TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS chunks_source ON chunks(source_id, idx);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY,
  settings TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  model TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '[]',
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
  job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  chunk_id INTEGER REFERENCES chunks(id) ON DELETE SET NULL,
  situation TEXT NOT NULL DEFAULT '',
  stem TEXT NOT NULL,
  options TEXT NOT NULL,
  correct_index INTEGER NOT NULL,
  rationale TEXT NOT NULL DEFAULT '',
  explanations TEXT NOT NULL DEFAULT '[]',
  difficulty TEXT NOT NULL,
  bloom TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'single',
  status TEXT NOT NULL DEFAULT 'draft',
  warnings TEXT NOT NULL DEFAULT '[]',
  source_quote TEXT NOT NULL DEFAULT '',
  source_label TEXT NOT NULL DEFAULT '',
  is_sample INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS questions_status ON questions(status, subject_id);

CREATE TABLE IF NOT EXISTS review_events (
  id INTEGER PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS practice_sessions (
  id INTEGER PRIMARY KEY,
  mode TEXT NOT NULL,
  subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  question_ids TEXT NOT NULL,
  answers TEXT NOT NULL DEFAULT '{}',
  results TEXT,
  general_average REAL,
  passed INTEGER,
  time_limit_sec INTEGER,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT
);
`);

type Param = SQLInputValue | boolean | undefined;

function bind(params: Param[]): SQLInputValue[] {
  return params.map((p) => (p === undefined ? null : typeof p === "boolean" ? (p ? 1 : 0) : p));
}

export function all<T>(sql: string, ...params: Param[]): T[] {
  return db.prepare(sql).all(...bind(params)) as T[];
}

export function get<T>(sql: string, ...params: Param[]): T | undefined {
  return db.prepare(sql).get(...bind(params)) as T | undefined;
}

export function run(sql: string, ...params: Param[]): { changes: number; id: number } {
  const r = db.prepare(sql).run(...bind(params));
  return { changes: Number(r.changes), id: Number(r.lastInsertRowid) };
}

export function transaction<T>(fn: () => T): T {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

/** Builds "(?, ?, ?)" for an IN clause. */
export function placeholders(n: number): string {
  return `(${Array(n).fill("?").join(", ")})`;
}
