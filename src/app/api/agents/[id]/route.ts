import { handleError, ok, optionalString, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { deleteAgent, requireOwnedAgent, updateAgent } from "@/lib/agents";
import { listDocuments } from "@/lib/rag";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const agent = requireOwnedAgent(id, user.id);
    return ok({ agent, documents: listDocuments(agent.id) });
  } catch (error) {
    return handleError(error);
  }
}

interface PatchBody {
  name?: string;
  roleLabel?: string;
  description?: string;
  systemPrompt?: string;
  model?: string | null;
  temperature?: number;
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await params;
    requireOwnedAgent(id, user.id);

    const body = await readJson<PatchBody>(request);
    const agent = updateAgent(id, {
      name: optionalString(body.name, 80) ?? undefined,
      roleLabel: optionalString(body.roleLabel, 40) ?? undefined,
      description: body.description === undefined ? undefined : (optionalString(body.description, 300) ?? ""),
      systemPrompt: optionalString(body.systemPrompt) ?? undefined,
      model: body.model === undefined ? undefined : optionalString(body.model, 120),
      temperature:
        typeof body.temperature === "number"
          ? Math.min(2, Math.max(0, body.temperature))
          : undefined,
    });

    return ok({ agent });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await params;
    requireOwnedAgent(id, user.id);
    deleteAgent(id);
    return ok({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
