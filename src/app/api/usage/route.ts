import { handleError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getPlan, type PlanId } from "@/lib/plans";
import { usageSnapshot } from "@/lib/usage";
import { embeddingsEnabled, embeddingsUnavailableReason, embeddingModel } from "@/lib/embeddings";
import { isLlmConfigured, defaultModel } from "@/lib/llm";
import { stripeEnabled } from "@/lib/stripe";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    const plan = getPlan(user.plan as PlanId);

    return ok({
      plan: { id: plan.id, name: plan.name, priceMonthly: plan.priceMonthly },
      usage: usageSnapshot(user.id, plan.id),
      status: {
        llmConfigured: isLlmConfigured(),
        chatModel: defaultModel(),
        embeddingsEnabled: embeddingsEnabled(),
        embeddingsModel: embeddingModel(),
        embeddingsNote: embeddingsEnabled() ? null : embeddingsUnavailableReason(),
        billingEnabled: stripeEnabled(),
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
