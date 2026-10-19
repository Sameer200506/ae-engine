import type { Metadata } from "next";
import { ManageBillingButton } from "@/components/BillingButtons";
import { PlanGrid } from "@/components/PlanGrid";
import { requireUser } from "@/lib/auth";
import { embeddingModel, embeddingsEnabled, embeddingsUnavailableReason } from "@/lib/embeddings";
import { defaultModel, modelChain } from "@/lib/llm";
import { getPlan, PLANS, type PlanId } from "@/lib/plans";
import { stripeEnabled } from "@/lib/stripe";
import { usageSnapshot } from "@/lib/usage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const user = await requireUser();
  const { checkout } = await searchParams;

  const plan = getPlan(user.plan as PlanId);
  const usage = usageSnapshot(user.id, plan.id);
  const billing = stripeEnabled();
  const keysSet = {
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    stripe: billing,
    webhook: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    sessionSecret:
      Boolean(process.env.SESSION_SECRET) &&
      process.env.SESSION_SECRET !== "replace-me-with-a-32-byte-random-hex-string",
  };

  return (
    <div className="h-full overflow-y-auto p-5 lg:p-7">
      <div className="mx-auto max-w-4xl space-y-7">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">Billing</h1>
          <p className="mt-1 text-sm text-slate-500">
            You are on the <strong>{plan.name}</strong> plan
            {plan.priceMonthly > 0 ? ` ($${plan.priceMonthly}/month)` : ""}.
          </p>
        </div>

        {checkout === "success" && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Checkout complete. Your plan updates as soon as Stripe&apos;s webhook arrives — refresh
            if it has not appeared yet.
          </div>
        )}

        {/* ------------------------------- usage ------------------------------- */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">This month</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Meter
              label="Messages"
              used={usage.messagesUsed}
              limit={usage.messageLimit}
            />
            <Meter label="Documents" used={usage.documentsUsed} limit={usage.documentLimit} />
            <Meter label="Agents" used={usage.agentsUsed} limit={usage.agentLimit} />
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Quotas reset on the 1st of each month (UTC). Limits are enforced before a model is
            called, so a request can never overspend.
          </p>

          {billing && user.stripe_customer_id && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <ManageBillingButton />
            </div>
          )}
        </div>

        {/* ------------------------------ plans -------------------------------- */}
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Change plan</h2>
          <div className="mt-4">
            <PlanGrid
              plans={Object.values(PLANS)}
              isSignedIn
              currentPlan={plan.id}
              billingEnabled={billing}
            />
          </div>
        </div>

        {/* ---------------------------- configuration -------------------------- */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Deployment status</h2>
          <p className="mt-1 text-xs text-slate-500">
            What this instance has configured. Useful when something is not working.
          </p>

          <dl className="mt-4 space-y-2.5 text-sm">
            <StatusRow label="OPENROUTER_API_KEY" ok={keysSet.openrouter} />
            <StatusRow label="SESSION_SECRET" ok={keysSet.sessionSecret} />
            <StatusRow label="STRIPE_SECRET_KEY" ok={keysSet.stripe} optional />
            <StatusRow label="STRIPE_WEBHOOK_SECRET" ok={keysSet.webhook} optional />

            <div className="flex items-start justify-between gap-4 border-t border-slate-100 pt-3">
              <dt className="text-slate-600">Chat model</dt>
              <dd className="text-right font-mono text-xs text-slate-800">{defaultModel()}</dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-slate-600">Fallback chain</dt>
              <dd className="max-w-[60%] text-right font-mono text-xs text-slate-600">
                {modelChain().join(" → ")}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-slate-600">Embeddings</dt>
              <dd className="text-right font-mono text-xs text-slate-800">
                {embeddingsEnabled() ? embeddingModel() : "disabled"}
              </dd>
            </div>
          </dl>

          {!embeddingsEnabled() && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {embeddingsUnavailableReason()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className="rounded-xl border border-slate-200 p-3.5">
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">
        {used}
        <span className="text-sm font-normal text-slate-400"> / {limit}</span>
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${percent >= 80 ? "bg-amber-500" : "bg-indigo-500"}`}
          style={{ width: `${Math.max(2, percent)}%` }}
        />
      </div>
    </div>
  );
}

function StatusRow({
  label,
  ok,
  optional = false,
}: {
  label: string;
  ok: boolean;
  optional?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="font-mono text-xs text-slate-600">{label}</dt>
      <dd
        className={`rounded px-2 py-0.5 text-[11px] font-medium ${
          ok
            ? "bg-emerald-100 text-emerald-700"
            : optional
              ? "bg-slate-100 text-slate-500"
              : "bg-rose-100 text-rose-700"
        }`}
      >
        {ok ? "set" : optional ? "not set" : "missing"}
      </dd>
    </div>
  );
}
