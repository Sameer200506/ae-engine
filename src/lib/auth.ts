import "server-only";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { all, get, now, run, uid } from "./db";

/**
 * Email/password auth with server-side sessions.
 *
 * The cookie holds an opaque 256-bit random token whose hash-free lookup row
 * lives in `sessions`. This is deliberately not a signed JWT: sessions can be
 * revoked instantly, and there is no signing-key rotation to get wrong.
 */

export const SESSION_COOKIE = "aeo_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: string;
  plan: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_renews_at: number | null;
  created_at: number;
}

export type PublicUser = Omit<UserRow, "password_hash">;

export function toPublicUser(u: UserRow): PublicUser {
  const { password_hash: _ignored, ...rest } = u;
  return rest;
}

/* --------------------------------- password -------------------------------- */

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/* ---------------------------------- users ---------------------------------- */

export function findUserByEmail(email: string): UserRow | undefined {
  return get<UserRow>("SELECT * FROM users WHERE email = ?", [email.trim().toLowerCase()]);
}

export function findUserById(id: string): UserRow | undefined {
  return get<UserRow>("SELECT * FROM users WHERE id = ?", [id]);
}

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function countUsers(): number {
  return get<{ c: number }>("SELECT COUNT(*) AS c FROM users")?.c ?? 0;
}

export async function createUser(
  email: string,
  password: string,
  name = "",
): Promise<PublicUser> {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) throw new Error("Enter a valid email address.");
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");

  if (findUserByEmail(normalized)) {
    throw new Error("An account with that email already exists.");
  }

  // The first account ever created becomes the admin so a fresh local install
  // is immediately usable without hand-editing the database.
  const role = countUsers() === 0 || adminEmails().includes(normalized) ? "admin" : "user";

  const id = uid("usr_");
  run(
    `INSERT INTO users (id, email, password_hash, name, role, plan, created_at)
     VALUES (?, ?, ?, ?, ?, 'free', ?)`,
    [id, normalized, await hashPassword(password), name.trim(), role, now()],
  );
  return toPublicUser(findUserById(id)!);
}

/* --------------------------------- sessions -------------------------------- */

export function createSession(userId: string): { token: string; expiresAt: number } {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const expiresAt = now() + SESSION_TTL_MS;
  run("INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)", [
    token,
    userId,
    expiresAt,
    now(),
  ]);
  return { token, expiresAt };
}

export function destroySession(token: string): void {
  run("DELETE FROM sessions WHERE token = ?", [token]);
}

export function destroyAllSessions(userId: string): void {
  run("DELETE FROM sessions WHERE user_id = ?", [userId]);
}

/** Purge expired rows. Cheap, called opportunistically on login. */
export function purgeExpiredSessions(): void {
  run("DELETE FROM sessions WHERE expires_at < ?", [now()]);
}

export async function setSessionCookie(token: string, expiresAt: number): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/** Resolve the signed-in user, or null. Safe to call from any server context. */
export async function getCurrentUser(): Promise<PublicUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = get<{ user_id: string; expires_at: number }>(
    "SELECT user_id, expires_at FROM sessions WHERE token = ?",
    [token],
  );
  if (!row) return null;
  if (row.expires_at < now()) {
    destroySession(token);
    return null;
  }

  const user = findUserById(row.user_id);
  return user ? toPublicUser(user) : null;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requireUser(): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "You must be signed in.");
  return user;
}

export async function requireAdmin(): Promise<PublicUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new HttpError(403, "Admin access required.");
  return user;
}

/* ---------------------------------- admin --------------------------------- */

export function listAllUsers(): (PublicUser & { messageCount: number; agentCount: number })[] {
  const rows = all<PublicUser & { messageCount: number; agentCount: number }>(
    `SELECT u.id, u.email, u.name, u.role, u.plan, u.created_at,
            u.stripe_customer_id, u.stripe_subscription_id, u.plan_renews_at,
            (SELECT COUNT(*) FROM messages m
               JOIN conversations c ON c.id = m.conversation_id
              WHERE c.user_id = u.id AND m.role = 'user') AS messageCount,
            (SELECT COUNT(*) FROM agents a WHERE a.user_id = u.id) AS agentCount
       FROM users u
      ORDER BY u.created_at DESC`,
  );
  return rows;
}

export function setUserPlan(userId: string, plan: string): void {
  run("UPDATE users SET plan = ? WHERE id = ?", [plan, userId]);
}
