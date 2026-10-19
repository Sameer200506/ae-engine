import "server-only";

import type { AgentRow } from "./agents";
import { estimateTokens } from "./chunk";
import { createConversation, deriveTitle, listMessages, renameConversation } from "./conversations";
import { getPlan, type PlanId } from "./plans";
import { buildContextBlock, retrieve } from "./rag";
import { checkMessageQuota, recordMessage } from "./usage";
import { isLlmConfigured, streamChat, type ChatMessage } from "./llm";

/**
 * Chat orchestration shared by the authenticated dashboard and the public
 * widget. Emits a stream of events the transport layer forwards over SSE.
 */

export type ChatEvent =
  | {
      type: "meta";
      conversationId: string;
      title: string;
      model: string | null;
      sources: { documentId: string; title: string; score: number }[];
    }
  | { type: "delta"; text: string }
  | { type: "done"; messageId: string }
  | { type: "error"; message: string };

export interface RunChatOptions {
  agent: AgentRow;
  /** Owner of the agent. Usage is always billed to this user. */
  ownerId: string;
  ownerPlan: PlanId;
  message: string;
  conversationId?: string | null;
  visitorId?: string | null;
  signal?: AbortSignal;
  /** How many prior turns to replay. */
  historyLimit?: number;
  /** How many knowledge-base chunks to retrieve. */
  topK?: number;
}

/** Keep the most recent turns that fit inside a rough token budget. */
function trimHistory(messages: MessageRow[], budgetTokens: number): MessageRow[] {
  const kept: MessageRow[] = [];
  let used = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const cost = estimateTokens(messages[i].content);
    if (used + cost > budgetTokens && kept.length) break;
    used += cost;
    kept.push(messages[i]);
  }
  return kept.reverse();
}

interface MessageRow {
  role: string;
  content: string;
}

export async function* runChat(options: RunChatOptions): AsyncGenerator<ChatEvent> {
  const { agent, ownerId, ownerPlan } = options;
  const question = options.message.trim();

  if (!question) {
    yield { type: "error", message: "Message is empty." };
    return;
  }

  // 0. Fail fast on a missing API key. Checked before the quota so a
  // misconfigured deployment does not silently burn a user's monthly messages
  // or litter the database with empty conversations.
  if (!isLlmConfigured()) {
    yield {
      type: "error",
      message:
        "No LLM API key is configured on this server. Add OPENROUTER_API_KEY to your .env file and restart (free keys: https://openrouter.ai/keys).",
    };
    return;
  }

  // 1. Plan limits. Checked before any tokens are spent.
  const quota = checkMessageQuota(ownerId, ownerPlan);
  if (!quota.allowed) {
    yield { type: "error", message: quota.reason ?? "Message limit reached." };
    return;
  }

  // 2. Resolve or create the conversation.
  let conversationId = options.conversationId ?? null;
  if (conversationId) {
    const exists = listMessages(conversationId, 1);
    if (!exists.length) {
      // Brand-new or empty conversation: give it a real title below.
      renameConversation(conversationId, deriveTitle(question));
    }
  } else {
    const created = createConversation(
      agent.id,
      ownerId,
      deriveTitle(question),
      options.visitorId ?? null,
    );
    conversationId = created.id;
  }

  // 3. Persist the user's turn immediately so it survives a later failure.
  recordMessage(conversationId, "user", question);

  // 4. Retrieval-augmented context.
  let sources: { documentId: string; title: string; score: number }[] = [];
  let contextBlock = "";
  try {
    const chunks = await retrieve(agent.id, question, options.topK ?? 5);
    if (chunks.length) {
      contextBlock = buildContextBlock(chunks);
      sources = chunks.map((c) => ({
        documentId: c.documentId,
        title: c.documentTitle,
        score: Number(c.score.toFixed(3)),
      }));
    }
  } catch {
    // Retrieval is best-effort: a failure degrades the answer, not the request.
    contextBlock = "";
  }

  // Everything but the message just recorded, so the question is not duplicated.
  const history = trimHistory(
    listMessages(conversationId, 40)
      .slice(0, -1)
      .map((m) => ({ role: m.role, content: m.content })),
    options.historyLimit ?? 4000,
  );

  const messages: ChatMessage[] = [
    { role: "system", content: agent.system_prompt + contextBlock },
    ...history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: question },
  ];

  yield {
    type: "meta",
    conversationId,
    title: deriveTitle(question),
    model: agent.model,
    sources,
  };

  // 5. Stream the completion.
  let answer = "";
  let streamError: string | null = null;

  for await (const event of streamChat({
    messages,
    model: agent.model,
    temperature: agent.temperature,
    signal: options.signal,
  })) {
    if (event.type === "delta") {
      answer += event.text;
      yield { type: "delta", text: event.text };
    } else if (event.type === "error") {
      streamError = event.message;
    } else if (event.type === "model") {
      yield { type: "meta", conversationId, title: deriveTitle(question), model: event.model, sources };
    }
  }

  // 6. Persist whatever we produced, including partial answers.
  if (answer.trim()) {
    const messageId = recordMessage(conversationId, "assistant", answer, sources);
    yield { type: "done", messageId };
  }

  if (streamError) {
    yield { type: "error", message: streamError };
  } else if (!answer.trim()) {
    yield {
      type: "error",
      message:
        "The model returned an empty response. Free OpenRouter endpoints do this occasionally; try again or set a different OPENROUTER_MODEL.",
    };
  }
}

/** Plan lookup that tolerates an unknown plan string from the database. */
export function planName(planId: string): string {
  return getPlan(planId).name;
}
