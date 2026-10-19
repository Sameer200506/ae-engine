import "server-only";

import { get, now, run, uid } from "./db";
import {
  currentPeriodStart,
  getPlan,
  type Plan,
  type PlanId,
  type UsageSnapshot,
} from "./plans";

export type { UsageSnapshot };

/**
 * Usage tracking.
 *
 * Message counts are derived from the `messages` table rather than a separate
 * counter, so there is no denormalised number to drift out of sync. Revisit
 * with a rollup table once a single tenant passes ~1M messages.
 */

export function messagesUsedThisMonth(userId: string, periodStart = currentPeriodStart()): number {
  return (
    get<{ c: number }>(
      `SELECT COUNT(*) AS c
         FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
        WHERE c.user_id = ? AND m.role = 'user' AND m.created_at >= ?`,
      [userId, periodStart],
    )?.c ?? 0
  );
}

export function agentsUsed(userId: string): number {
  return get<{ c: number }>("SELECT COUNT(*) AS c FROM agents WHERE user_id = ?", [userId])?.c ?? 0;
}

export function documentsUsed(userId: string): number {
  return get<{ c: number }>("SELECT COUNT(*) AS c FROM documents WHERE user_id = ?", [userId])?.c ?? 0;
}

export function usageSnapshot(userId: string, planId: PlanId): UsageSnapshot {
  const plan = getPlan(planId);
  const messagesUsed = messagesUsedThisMonth(userId);
  const docs = documentsUsed(userId);
  const agents = agentsUsed(userId);
  const limit = plan.limits.monthlyMessages;

  return {
    messagesUsed,
    messageLimit: limit,
    messagesRemaining: Math.max(0, limit - messagesUsed),
    documentsUsed: docs,
    documentLimit: plan.limits.maxDocuments,
    agentsUsed: agents,
    agentLimit: plan.limits.maxAgents,
    periodStart: currentPeriodStart(),
    percentUsed: limit > 0 ? Math.min(100, Math.round((messagesUsed / limit) * 100)) : 0,
  };
}

export interface QuotaDecision {
  allowed: boolean;
  reason?: string;
  code?: "message_limit" | "agent_limit" | "document_limit" | "plan_feature";
  plan: Plan;
  snapshot?: UsageSnapshot;
}

export function checkMessageQuota(userId: string, planId: PlanId): QuotaDecision {
  const plan = getPlan(planId);
  const snapshot = usageSnapshot(userId, planId);
  if (snapshot.messagesRemaining <= 0) {
    return {
      allowed: false,
      code: "message_limit",
      plan,
      snapshot,
      reason: `You have used all ${plan.limits.monthlyMessages} messages included in the ${plan.name} plan this month. Upgrade to keep going.`,
    };
  }
  return { allowed: true, plan, snapshot };
}

export function checkAgentQuota(userId: string, planId: PlanId): QuotaDecision {
  const plan = getPlan(planId);
  if (agentsUsed(userId) >= plan.limits.maxAgents) {
    return {
      allowed: false,
      code: "agent_limit",
      plan,
      reason: `The ${plan.name} plan is limited to ${plan.limits.maxAgents} agent${plan.limits.maxAgents === 1 ? "" : "s"}. Upgrade to create more.`,
    };
  }
  return { allowed: true, plan };
}

export function checkDocumentQuota(userId: string, planId: PlanId): QuotaDecision {
  const plan = getPlan(planId);
  if (documentsUsed(userId) >= plan.limits.maxDocuments) {
    return {
      allowed: false,
      code: "document_limit",
      plan,
      reason: `The ${plan.name} plan is limited to ${plan.limits.maxDocuments} knowledge-base documents. Upgrade to add more.`,
    };
  }
  return { allowed: true, plan };
}

export function checkShareFeature(planId: PlanId): QuotaDecision {
  const plan = getPlan(planId);
  if (!plan.limits.canShare) {
    return {
      allowed: false,
      code: "plan_feature",
      plan,
      reason: "Sharing and the embeddable widget are available on paid plans.",
    };
  }
  return { allowed: true, plan };
}

/* ----------------------------- simple rate limit --------------------------- */

const buckets = new Map<string, { count: number; resetAt: number }>();

/**
 * Fixed-window limiter for the public widget endpoint, keyed by IP.
 * In-process only, which is fine for a single instance; move to Redis when you
 * scale beyond one.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const nowMs = now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < nowMs) {
    buckets.set(key, { count: 1, resetAt: nowMs + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

/** Persist a message. Returns its id. */
export function recordMessage(
  conversationId: string,
  role: "user" | "assistant" | "system",
  content: string,
  sources?: unknown,
): string {
  const id = uid("msg_");
  run(
    "INSERT INTO messages (id, conversation_id, role, content, sources, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [id, conversationId, role, content, sources ? JSON.stringify(sources) : null, now()],
  );
  run("UPDATE conversations SET updated_at = ? WHERE id = ?", [now(), conversationId]);
  return id;
}
