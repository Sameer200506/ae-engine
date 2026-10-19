import "server-only";

import { HttpError } from "./auth";
import { all, get, now, run, uid } from "./db";

export interface ConversationRow {
  id: string;
  agent_id: string;
  user_id: string;
  title: string;
  visitor_id: string | null;
  created_at: number;
  updated_at: number;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources: string | null;
  created_at: number;
}

export function listConversations(userId: string, agentId?: string): ConversationRow[] {
  if (agentId) {
    return all<ConversationRow>(
      "SELECT * FROM conversations WHERE user_id = ? AND agent_id = ? ORDER BY updated_at DESC",
      [userId, agentId],
    );
  }
  return all<ConversationRow>(
    "SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC",
    [userId],
  );
}

export function getConversation(id: string): ConversationRow | undefined {
  return get<ConversationRow>("SELECT * FROM conversations WHERE id = ?", [id]);
}

export function requireOwnedConversation(id: string, userId: string): ConversationRow {
  const row = getConversation(id);
  if (!row || row.user_id !== userId) throw new HttpError(404, "Conversation not found.");
  return row;
}

export function createConversation(
  agentId: string,
  userId: string,
  title = "New conversation",
  visitorId: string | null = null,
): ConversationRow {
  const id = uid("cnv_");
  const ts = now();
  run(
    `INSERT INTO conversations (id, agent_id, user_id, title, visitor_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, agentId, userId, title, visitorId, ts, ts],
  );
  return getConversation(id)!;
}

export function renameConversation(id: string, title: string): void {
  run("UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?", [
    title.trim().slice(0, 120) || "Untitled",
    now(),
    id,
  ]);
}

export function deleteConversation(id: string): void {
  run("DELETE FROM conversations WHERE id = ?", [id]);
}

export function listMessages(conversationId: string, limit = 200): MessageRow[] {
  // Newest-first then reversed, so a long conversation keeps the most recent
  // turns rather than the oldest.
  const rows = all<MessageRow>(
    "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?",
    [conversationId, limit],
  );
  return rows.reverse();
}

export function countMessages(conversationId: string): number {
  return (
    get<{ c: number }>("SELECT COUNT(*) AS c FROM messages WHERE conversation_id = ?", [
      conversationId,
    ])?.c ?? 0
  );
}

/** Derive a short human title from the first user message. */
export function deriveTitle(text: string): string {
  const firstLine = text.replace(/\s+/g, " ").trim();
  if (firstLine.length <= 64) return firstLine || "New conversation";
  return `${firstLine.slice(0, 61)}...`;
}

/* ---------------------------------- admin --------------------------------- */

export interface AdminConversationRow {
  id: string;
  title: string;
  agent_name: string;
  user_email: string;
  plan: string;
  message_count: number;
  updated_at: number;
}

export function adminListConversations(limit = 100, search?: string): AdminConversationRow[] {
  const term = search?.trim() ? `%${search.trim()}%` : null;
  return all<AdminConversationRow>(
    `SELECT c.id, c.title, a.name AS agent_name, u.email AS user_email, u.plan,
            (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count,
            c.updated_at
       FROM conversations c
       JOIN agents a ON a.id = c.agent_id
       JOIN users u ON u.id = c.user_id
      ${term ? "WHERE c.title LIKE ? OR u.email LIKE ? OR a.name LIKE ?" : ""}
      ORDER BY c.updated_at DESC
      LIMIT ?`,
    term ? [term, term, term, limit] : [limit],
  );
}

export interface AdminStats {
  users: number;
  agents: number;
  conversations: number;
  messages: number;
  documents: number;
  messagesThisMonth: number;
  paidUsers: number;
}

export function adminStats(): AdminStats {
  const one = (sql: string): number => get<{ c: number }>(sql)?.c ?? 0;
  const periodStart = Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    1,
  );
  return {
    users: one("SELECT COUNT(*) AS c FROM users"),
    agents: one("SELECT COUNT(*) AS c FROM agents"),
    conversations: one("SELECT COUNT(*) AS c FROM conversations"),
    messages: one("SELECT COUNT(*) AS c FROM messages WHERE role = 'user'"),
    documents: one("SELECT COUNT(*) AS c FROM documents"),
    messagesThisMonth: one(
      `SELECT COUNT(*) AS c FROM messages WHERE role = 'user' AND created_at >= ${periodStart}`,
    ),
    paidUsers: one("SELECT COUNT(*) AS c FROM users WHERE plan != 'free'"),
  };
}
