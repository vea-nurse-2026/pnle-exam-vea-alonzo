import crypto from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { REQUIRE_LOGIN } from "../config.ts";
import { get, run } from "../db.ts";
import { HttpError } from "../http.ts";

const COOKIE = "sid";
const SESSION_DAYS = 7;

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const expected = Buffer.from(hash, "hex");
  const actual = crypto.scryptSync(password, Buffer.from(salt, "hex"), 64);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

function startSession(res: Response, userId: number): void {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  run("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)", token, userId, expires.toISOString());
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    expires,
  });
}

function sessionUser(req: Request): { id: number; username: string } | undefined {
  const token = readCookie(req, COOKIE);
  if (!token) return undefined;
  return get<{ id: number; username: string }>(
    "SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?",
    token, new Date().toISOString(),
  );
}

// Stands in for a signed-in user when REQUIRE_LOGIN is off.
const OPEN_USER = { id: 0, username: "Local user" };

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!REQUIRE_LOGIN) {
    res.locals.user = OPEN_USER;
    next();
    return;
  }
  const user = sessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Please sign in." });
    return;
  }
  res.locals.user = user;
  next();
}

// Slows password guessing: 10 failed logins per IP per 15 minutes.
const failures = new Map<string, { count: number; until: number }>();
function checkRate(ip: string): void {
  const f = failures.get(ip);
  if (f && f.until > Date.now() && f.count >= 10) throw new HttpError(429, "Too many failed sign-ins. Try again in 15 minutes.");
}
function recordFailure(ip: string): void {
  const f = failures.get(ip);
  if (!f || f.until < Date.now()) failures.set(ip, { count: 1, until: Date.now() + 15 * 60_000 });
  else f.count++;
}

const Credentials = z.object({
  username: z.string().trim().min(3, "Username must be at least 3 characters.").max(40),
  password: z.string().min(8, "Password must be at least 8 characters.").max(200),
});

export const authRouter = Router();

authRouter.get("/me", (req, res) => {
  if (!REQUIRE_LOGIN) {
    res.json({ loginRequired: false, setupRequired: false, user: OPEN_USER });
    return;
  }
  const users = get<{ n: number }>("SELECT COUNT(*) AS n FROM users")!.n;
  res.json({ loginRequired: true, setupRequired: users === 0, user: sessionUser(req) ?? null });
});

authRouter.post("/setup", (req, res) => {
  const users = get<{ n: number }>("SELECT COUNT(*) AS n FROM users")!.n;
  if (users > 0) throw new HttpError(409, "An admin account already exists. Sign in instead.");
  const { username, password } = Credentials.parse(req.body);
  const { id } = run("INSERT INTO users (username, password_hash) VALUES (?, ?)", username, hashPassword(password));
  startSession(res, id);
  res.json({ user: { id, username } });
});

authRouter.post("/login", (req, res) => {
  const ip = req.ip ?? "unknown";
  checkRate(ip);
  const { username, password } = z.object({ username: z.string().trim(), password: z.string() }).parse(req.body);
  const user = get<{ id: number; username: string; password_hash: string }>(
    "SELECT id, username, password_hash FROM users WHERE username = ?", username,
  );
  if (!user || !verifyPassword(password, user.password_hash)) {
    recordFailure(ip);
    throw new HttpError(401, "Wrong username or password.");
  }
  failures.delete(ip);
  run("DELETE FROM sessions WHERE expires_at <= ?", new Date().toISOString());
  startSession(res, user.id);
  res.json({ user: { id: user.id, username: user.username } });
});

authRouter.post("/logout", (req, res) => {
  const token = readCookie(req, COOKIE);
  if (token) run("DELETE FROM sessions WHERE token = ?", token);
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});
