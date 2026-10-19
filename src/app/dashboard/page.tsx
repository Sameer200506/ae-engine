import type { Metadata } from "next";
import { Workspace } from "@/components/Workspace";
import { listAgents } from "@/lib/agents";
import { requireUser } from "@/lib/auth";
import { listConversations } from "@/lib/conversations";
import { all } from "@/lib/db";
import { isLlmConfigured } from "@/lib/llm";
import { getPlan, type PlanId } from "@/lib/plans";
import { usageSnapshot } from "@/lib/usage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Chat" };

export default async function DashboardPage() {
  const user = await requireUser();

  const agents = listAgents(user.id).map((a) => ({
    id: a.id,
    name: a.name,
    role_label: a.role_label,
    description: a.description,
  }));

  const conversations = listConversations(user.id).map((c) => ({
    id: c.id,
    agentId: c.agent_id,
    title: c.title,
    updatedAt: c.updated_at,
  }));

  const prompts = all<{ id: string; title: string; body: string }>(
    "SELECT id, title, body FROM saved_prompts WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
    [user.id],
  );

  return (
    <Workspace
      agents={agents}
      initialConversations={conversations}
      prompts={prompts}
      usage={usageSnapshot(user.id, getPlan(user.plan as PlanId).id)}
      llmConfigured={isLlmConfigured()}
    />
  );
}
