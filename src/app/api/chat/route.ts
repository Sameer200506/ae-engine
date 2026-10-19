import { handleError, ok, readJson, requireString } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { requireOwnedAgent } from "@/lib/agents";
import { runChat } from "@/lib/chat";
import { requireOwnedConversation } from "@/lib/conversations";
import { sseStream } from "@/lib/sse";
import type { PlanId } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Ingestion and long generations can exceed the default serverless timeout.
export const maxDuration = 60;

interface Body {
  agentId?: string;
  conversationId?: string | null;
  message?: string;
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJson<Body>(request);

    const agentId = requireString(body.agentId, "agentId", 80);
    const message = requireString(body.message, "message", 20_000);
    const agent = requireOwnedAgent(agentId, user.id);

    let conversationId: string | null = null;
    if (body.conversationId) {
      // Ownership is asserted here; runChat then owns the turn for the whole
      // stream, so a revoked conversation cannot be continued mid-flight.
      conversationId = requireOwnedConversation(body.conversationId, user.id).id;
    }

    const { writer, response } = sseStream();

    void (async () => {
      try {
        for await (const event of runChat({
          agent,
          ownerId: user.id,
          ownerPlan: user.plan as PlanId,
          message,
          conversationId,
          signal: request.signal,
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

export async function GET() {
  // Handy for confirming the route exists and whether a key is configured.
  return ok({ ok: true, hint: "POST { agentId, message, conversationId? }" });
}
