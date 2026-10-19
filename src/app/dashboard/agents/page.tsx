import type { Metadata } from "next";
import { AgentManager } from "@/components/AgentManager";
import { AGENT_TEMPLATES, DEFAULT_SYSTEM_PROMPT, listAgents } from "@/lib/agents";
import { requireUser } from "@/lib/auth";
import { defaultModel } from "@/lib/llm";
import { getPlan, type PlanId } from "@/lib/plans";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Agents" };

export default async function AgentsPage() {
  const user = await requireUser();
  const plan = getPlan(user.plan as PlanId);

  const agents = listAgents(user.id).map((a) => ({
    id: a.id,
    name: a.name,
    role_label: a.role_label,
    description: a.description,
    system_prompt: a.system_prompt,
    model: a.model,
    temperature: a.temperature,
    share_token: a.share_token,
    is_public: a.is_public,
  }));

  return (
    <div className="h-full p-5 lg:p-7">
      <AgentManager
        initialAgents={agents}
        templates={AGENT_TEMPLATES.map((t) => ({
          key: t.key,
          name: t.name,
          roleLabel: t.roleLabel,
          description: t.description,
        }))}
        defaultPrompt={DEFAULT_SYSTEM_PROMPT}
        plan={plan.id}
        canShare={plan.limits.canShare}
        maxAgents={plan.limits.maxAgents}
        appUrl={(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "")}
        modelDefault={defaultModel()}
      />
    </div>
  );
}
