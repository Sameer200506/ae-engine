import type { Metadata } from "next";
import { KnowledgeManager } from "@/components/KnowledgeManager";
import { listAgents } from "@/lib/agents";
import { requireUser } from "@/lib/auth";
import {
  embeddingModel,
  embeddingsEnabled,
  embeddingsUnavailableReason,
} from "@/lib/embeddings";
import { SUPPORTED_EXTENSIONS } from "@/lib/extract";
import { getPlan, type PlanId } from "@/lib/plans";
import { documentsUsed } from "@/lib/usage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Knowledge" };

export default async function KnowledgePage() {
  const user = await requireUser();
  const plan = getPlan(user.plan as PlanId);

  const agents = listAgents(user.id).map((a) => ({ id: a.id, name: a.name }));
  const enabled = embeddingsEnabled();

  return (
    <div className="h-full overflow-y-auto p-5 lg:p-7">
      <KnowledgeManager
        agents={agents}
        maxDocuments={plan.limits.maxDocuments}
        documentsUsed={documentsUsed(user.id)}
        embeddingsEnabled={enabled}
        embeddingsNote={enabled ? null : embeddingsUnavailableReason()}
        embeddingsModel={embeddingModel()}
        acceptedExtensions={SUPPORTED_EXTENSIONS.join(",")}
      />
    </div>
  );
}
