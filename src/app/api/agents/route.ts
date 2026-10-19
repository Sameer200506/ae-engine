import { handleError, ok, readJson, optionalString } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { AGENT_TEMPLATES, createAgent, listAgents } from "@/lib/agents";
import { checkAgentQuota } from "@/lib/usage";
import { getPlan, type PlanId } from "@/lib/plans";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    return ok({ agents: listAgents(user.id) });
  } catch (error) {
    return handleError(error);
  }
}

interface CreateBody {
  name?: string;
  systemPrompt?: string;
  description?: string;
  roleLabel?: string;
  model?: string | null;
  temperature?: number;
  template?: string;
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJson<CreateBody>(request);

    const quota = checkAgentQuota(user.id, user.plan as PlanId);
    if (!quota.allowed) {
      return Response.json({ error: quota.reason, code: quota.code }, { status: 402 });
    }

    const template = AGENT_TEMPLATES.find((t) => t.key === body.template);

    const agent = createAgent(user.id, {
      name: optionalString(body.name, 80) ?? template?.name ?? "New agent",
      roleLabel: optionalString(body.roleLabel, 40) ?? template?.roleLabel,
      description: optionalString(body.description, 300) ?? template?.description,
      systemPrompt: optionalString(body.systemPrompt) ?? template?.systemPrompt,
      model: optionalString(body.model, 120),
      temperature: typeof body.temperature === "number" ? body.temperature : undefined,
    });

    return ok({ agent, plan: getPlan(user.plan).id });
  } catch (error) {
    return handleError(error);
  }
}
