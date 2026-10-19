import { handleError, ok, optionalString, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createConversation, listConversations } from "@/lib/conversations";
import { requireOwnedAgent } from "@/lib/agents";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const agentId = new URL(request.url).searchParams.get("agentId") ?? undefined;

    const conversations = listConversations(user.id, agentId ?? undefined);
    return ok({
      conversations: conversations.map((c) => ({
        id: c.id,
        agentId: c.agent_id,
        title: c.title,
        updatedAt: c.updated_at,
        createdAt: c.created_at,
      })),
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJson<{ agentId?: string; title?: string }>(request);
    const agentId = optionalString(body.agentId, 80);
    if (!agentId) return Response.json({ error: "agentId is required." }, { status: 400 });

    const agent = requireOwnedAgent(agentId, user.id);
    const conversation = createConversation(
      agent.id,
      user.id,
      optionalString(body.title, 120) ?? "New conversation",
    );

    return ok({ conversation });
  } catch (error) {
    return handleError(error);
  }
}
