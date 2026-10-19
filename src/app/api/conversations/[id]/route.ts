import { handleError, ok, optionalString, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import {
  deleteConversation,
  listMessages,
  renameConversation,
  requireOwnedConversation,
} from "@/lib/conversations";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const conversation = requireOwnedConversation(id, user.id);

    const messages = listMessages(id).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      sources: m.sources ? JSON.parse(m.sources) : [],
      createdAt: m.created_at,
    }));

    return ok({
      conversation: {
        id: conversation.id,
        agentId: conversation.agent_id,
        title: conversation.title,
        updatedAt: conversation.updated_at,
      },
      messages,
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await params;
    requireOwnedConversation(id, user.id);

    const body = await readJson<{ title?: string }>(request);
    const title = optionalString(body.title, 120);
    if (!title) return Response.json({ error: "title is required." }, { status: 400 });

    renameConversation(id, title);
    return ok({ success: true, title });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await params;
    requireOwnedConversation(id, user.id);
    deleteConversation(id);
    return ok({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
