import "server-only";

import { HttpError } from "./auth";
import { all, get, now, run, uid } from "./db";

export interface AgentRow {
  id: string;
  user_id: string;
  name: string;
  role_label: string;
  description: string;
  system_prompt: string;
  model: string | null;
  temperature: number;
  share_token: string | null;
  is_public: number;
  created_at: number;
  updated_at: number;
}

export const DEFAULT_SYSTEM_PROMPT = `You are a careful, useful assistant.

Rules:
- Answer directly and concisely. Lead with the answer, then the reasoning if it helps.
- When knowledge-base excerpts are provided, ground your answer in them and cite them as [1], [2].
- Never invent facts, figures, quotes, prices or sources. If you do not know, say so.
- Format with short paragraphs, headings and lists where they aid scanning.`;

/** Starter agents, framed around the answer-engine-optimisation workflow. */
export const AGENT_TEMPLATES: {
  key: string;
  name: string;
  roleLabel: string;
  description: string;
  systemPrompt: string;
}[] = [
  {
    key: "support",
    name: "Knowledge Assistant",
    roleLabel: "Support",
    description: "Answers customer questions strictly from your uploaded docs and pages.",
    systemPrompt: `${DEFAULT_SYSTEM_PROMPT}

You are the support desk for a product. Only state details that appear in the retrieved knowledge-base excerpts. If the excerpts do not cover the question, say "I don't have that in my documentation" and suggest what the user should ask instead. Never promise refunds, timelines or features that are not written down.`,
  },
  {
    key: "researcher",
    name: "Answer Researcher",
    roleLabel: "Researcher",
    description: "Maps what questions buyers ask, and what the current answers get wrong.",
    systemPrompt: `You are an answer-engine researcher. Your job is to work out what people actually ask about a topic and how large language models currently answer it.

For every request:
1. List the concrete questions a buyer or user would type.
2. For each, state what a model would answer today and where that answer is thin, generic or wrong.
3. Identify the specific claims, statistics or comparisons that are missing.
4. Recommend what source material would close each gap.

Be specific and terse. Do not pad with generic marketing language.`,
  },
  {
    key: "optimizer",
    name: "Content Optimizer",
    roleLabel: "Optimizer",
    description: "Rewrites drafts so they are quotable by AI answer engines.",
    systemPrompt: `You are a content optimiser for AI answer engines.

When given a draft:
- Rewrite the opening so the direct answer appears in the first two sentences.
- Convert prose into self-contained, quotable blocks that survive being lifted out of context.
- Add the concrete numbers, named entities and comparisons that a citation would need.
- Keep the author's voice and every factual claim intact. Never add a statistic that was not supplied.

Return the rewritten content first, then a short list of the changes you made and why.`,
  },
];

export function listAgents(userId: string): AgentRow[] {
  return all<AgentRow>(
    "SELECT * FROM agents WHERE user_id = ? ORDER BY created_at ASC",
    [userId],
  );
}

export function getAgent(id: string): AgentRow | undefined {
  return get<AgentRow>("SELECT * FROM agents WHERE id = ?", [id]);
}

/** Load an agent and assert ownership. Throws HttpError(404) when not permitted. */
export function requireOwnedAgent(id: string, userId: string): AgentRow {
  const agent = getAgent(id);
  if (!agent || agent.user_id !== userId) throw new HttpError(404, "Agent not found.");
  return agent;
}

export function getAgentByShareToken(token: string): AgentRow | undefined {
  if (!token) return undefined;
  return get<AgentRow>("SELECT * FROM agents WHERE share_token = ? AND is_public = 1", [token]);
}

export function createAgent(
  userId: string,
  input: {
    name: string;
    roleLabel?: string;
    description?: string;
    systemPrompt?: string;
    model?: string | null;
    temperature?: number;
  },
): AgentRow {
  const id = uid("agt_");
  const ts = now();
  run(
    `INSERT INTO agents (id, user_id, name, role_label, description, system_prompt, model, temperature, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      input.name.trim().slice(0, 80) || "New agent",
      input.roleLabel?.trim().slice(0, 40) || "Assistant",
      input.description?.trim().slice(0, 300) || "",
      input.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT,
      input.model || null,
      input.temperature ?? 0.7,
      ts,
      ts,
    ],
  );
  return getAgent(id)!;
}

export function updateAgent(
  id: string,
  patch: Partial<{
    name: string;
    roleLabel: string;
    description: string;
    systemPrompt: string;
    model: string | null;
    temperature: number;
  }>,
): AgentRow {
  const current = getAgent(id);
  if (!current) throw new HttpError(404, "Agent not found.");

  run(
    `UPDATE agents SET name = ?, role_label = ?, description = ?, system_prompt = ?, model = ?, temperature = ?, updated_at = ?
      WHERE id = ?`,
    [
      patch.name?.trim().slice(0, 80) ?? current.name,
      patch.roleLabel?.trim().slice(0, 40) ?? current.role_label,
      patch.description?.trim().slice(0, 300) ?? current.description,
      patch.systemPrompt?.trim() || current.system_prompt,
      patch.model === undefined ? current.model : patch.model,
      patch.temperature ?? current.temperature,
      now(),
      id,
    ],
  );
  return getAgent(id)!;
}

export function deleteAgent(id: string): void {
  run("DELETE FROM agents WHERE id = ?", [id]);
}

/** Idempotently assign a share token. Only paid plans may publish. */
export function ensureShareToken(id: string): string {
  const agent = getAgent(id);
  if (!agent) throw new HttpError(404, "Agent not found.");
  if (agent.share_token) return agent.share_token;

  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  run("UPDATE agents SET share_token = ?, updated_at = ? WHERE id = ?", [token, now(), id]);
  return token;
}

export function setAgentPublic(id: string, isPublic: boolean): AgentRow {
  run("UPDATE agents SET is_public = ?, updated_at = ? WHERE id = ?", [isPublic ? 1 : 0, now(), id]);
  return getAgent(id)!;
}

/** Remove every trace of an agent's public access. */
export function unpublishAgent(id: string): void {
  run("UPDATE agents SET is_public = 0, updated_at = ? WHERE id = ?", [now(), id]);
}

/** Find the best agent to use when none is specified (oldest created). */
export function firstAgent(userId: string): AgentRow | undefined {
  return get<AgentRow>("SELECT * FROM agents WHERE user_id = ? ORDER BY created_at ASC LIMIT 1", [userId]);
}
