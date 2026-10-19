import type { Metadata } from "next";
import { PromptManager } from "@/components/PromptManager";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { getPlan, type PlanId } from "@/lib/plans";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Prompts" };

export default async function PromptsPage() {
  const user = await requireUser();
  const plan = getPlan(user.plan as PlanId);

  const prompts = all<{ id: string; title: string; body: string; created_at: number }>(
    "SELECT id, title, body, created_at FROM saved_prompts WHERE user_id = ? ORDER BY created_at DESC",
    [user.id],
  );

  return (
    <div className="h-full overflow-y-auto p-5 lg:p-7">
      <PromptManager
        initialPrompts={prompts}
        cap={plan.id === "free" ? 5 : 200}
      />
    </div>
  );
}
