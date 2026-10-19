import { clientIp, fail, handleError, ok, readJson, requireString } from "@/lib/api";
import { getAgentByShareToken } from "@/lib/agents";
import { findUserById } from "@/lib/auth";
import { runChat } from "@/lib/chat";
import { getConversation } from "@/lib/conversations";
import { sseStream } from "@/lib/sse";
import { rateLimit } from "@/lib/usage";
import type { PlanId } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Unauthenticated chat used by /share/<token> and the embeddable widget.
 *
 * Access is granted by the agent's share token. Usage is billed to the agent
 * owner's plan, and per-IP rate limiting stops a public widget from being used
 * as a free LLM proxy.
 */
export async function POST(request: Request) {
  try {
    const body = await readJson<{
      token?: string;
      message?: string;
      conversationId?: string | null;
      visitorId?: string | null;
    }>(request);

    const token = requireString(body.token, "token", 120);
    const message = requireString(body.message, "message", 4000);

    const agent = getAgentByShareToken(token);
    if (!agent || !agent.is_public) {
      return fail(404, "This assistant is not available.");
    }

    const ip = clientIp(request);
    if (!rateLimit(`public-chat:${ip}`, 20, 60_000)) {
      return fail(429, "Too many messages. Please wait a moment and try again.");
    }

    const owner = findUserById(agent.user_id);
    if (!owner) return fail(404, "This assistant is not available.");

    const { writer, response } = sseStream();

    void (async () => {
      try {
        for await (const event of runChat({
          agent,
          ownerId: owner.id,
          ownerPlan: owner.plan as PlanId,
          message,
          // A visitor-supplied conversation id must belong to this agent,
          // otherwise ignore it and start fresh.
          conversationId: validateVisitorConversation(body.conversationId, agent.id),
          visitorId: body.visitorId ?? null,
          signal: request.signal,
          historyLimit: 2500,
          topK: 4,
        })) {
          writer.send(event);
        }
      } catch (error) {
        writer.send({
          type: "error",
          message: error instanceof Error ? error.message : "The response failed.",
        });
      } finally {
        writer.close();
      }
    })();

    return response;
  } catch (error) {
    return handleError(error);
  }
}

/** A visitor-supplied conversation id must belong to the shared agent. */
function validateVisitorConversation(
  conversationId: string | null | undefined,
  agentId: string,
): string | null {
  if (!conversationId) return null;
  const row = getConversation(conversationId);
  if (!row || row.agent_id !== agentId) return null;
  return row.id;
}

export async function GET() {
  return ok({ ok: true, hint: "POST { token, message, conversationId? }" });
}
