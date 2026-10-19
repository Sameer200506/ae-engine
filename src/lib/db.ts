import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

/**
 * Thin data layer over Node's built-in `node:sqlite`.
 *
 * We deliberately avoid `better-sqlite3`/Prisma here: `node:sqlite` ships with
 * Node 22.5+, so there is no native compile step and nothing to install on
 * Windows. That keeps `npm install && npm run dev` working on a clean machine.
 *
 * Tradeoff: the API is marked experimental and this is a single-file database,
 * so it is not shareable across instances. For production, move to a host with
 * a persistent volume, or swap this module for Postgres/Turso (see README).
 */

function resolveDbPath(): string {
  const configured = process.env.DATABASE_PATH?.trim();
  if (configured) {
    // The absolute-path branch is annotated so the bundler's static tracer does
    // not treat a runtime env var as "could be anywhere" and trace the whole
    // project into the server output.
    return path.resolve(/* turbopackIgnore: true */ configured);
  }
  return path.join(process.cwd(), "data", "app.db");
}

export const DB_PATH = resolveDbPath();

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user',
  plan TEXT NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan_renews_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role_label TEXT NOT NULL DEFAULT 'Assistant',
  description TEXT NOT NULL DEFAULT '',
  system_prompt TEXT NOT NULL,
  model TEXT,
  temperature REAL NOT NULL DEFAULT 0.7,
  share_token TEXT UNIQUE,
  is_public INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agents_user ON agents(user_id);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New conversation',
  visitor_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_conversations_agent ON conversations(agent_id);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  sources TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_ref TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  char_count INTEGER NOT NULL DEFAULT 0,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  embedding_model TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_documents_agent ON documents(agent_id, created_at);

CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  ord INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding BLOB,
  dim INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_chunks_agent ON chunks(agent_id);

CREATE TABLE IF NOT EXISTS saved_prompts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_prompts_user ON saved_prompts(user_id, created_at);
`;

declare global {
  // eslint-disable-next-line no-var
  var __aeoDb: DatabaseSync | undefined;
}

function open(): DatabaseSync {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const database = new DatabaseSync(DB_PATH);
  database.exec(SCHEMA);
  return database;
}

/** Lazily-created singleton. Cached on globalThis so Next's dev HMR reuses it. */
export function db(): DatabaseSync {
  if (!globalThis.__aeoDb) globalThis.__aeoDb = open();
  return globalThis.__aeoDb;
}

type Params = Record<string, unknown> | unknown[];

/** node:sqlite only accepts primitives / null / Uint8Array. Coerce booleans. */
function normalize(params: Params): Record<string, unknown> | unknown[] {
  const fix = (v: unknown) => {
    if (typeof v === "boolean") return v ? 1 : 0;
    if (v === undefined) return null;
    return v;
  };
  if (Array.isArray(params)) return params.map(fix);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) out[k] = fix(v);
  return out;
}

export function all<T = Record<string, unknown>>(sql: string, params: Params = []): T[] {
  return db().prepare(sql).all(...(normalize(params) as never[])) as T[];
}

export function get<T = Record<string, unknown>>(sql: string, params: Params = []): T | undefined {
  return db().prepare(sql).get(...(normalize(params) as never[])) as T | undefined;
}

export function run(sql: string, params: Params = []): void {
  db().prepare(sql).run(...(normalize(params) as never[]));
}

export function uid(prefix = ""): string {
  return prefix + crypto.randomUUID().replace(/-/g, "");
}

export function now(): number {
  return Date.now();
}

// Vector encoding lives in ./vector so it stays testable without SQLite.
