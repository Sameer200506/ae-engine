import { handleError, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import {
  ensureShareToken,
  requireOwnedAgent,
  setAgentPublic,
} from "@/lib/agents";
import { checkShareFeature } from "@/lib/usage";
import type { PlanId } from "@/lib/plans";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const agent = requireOwnedAgent(id, user.id);

    const body = await readJson<{ isPublic?: boolean }>(request);
    const wantPublic = body.isPublic !== false;

    if (wantPublic) {
      // Sharing is a paid feature; check before minting a token.
      const feature = checkShareFeature(user.plan as PlanId);
      if (!feature.allowed) {
        return Response.json({ error: feature.reason, code: feature.code }, { status: 402 });
      }
      ensureShareToken(agent.id);
    }

    const updated = setAgentPublic(agent.id, wantPublic);
    return ok({ agent: updated });
  } catch (error) {
    return handleError(error);
  }
}
