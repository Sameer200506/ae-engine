import { UpgradeButton } from "./BillingButtons";
import type { Plan, PlanId } from "@/lib/plans";

/**
 * Plan comparison grid. Plans are passed in from a server component so the
 * env-var overrides in plans.ts are reflected rather than the client's bundle.
 */
export function PlanGrid({
  plans,
  isSignedIn,
  currentPlan,
  billingEnabled = true,
}: {
  plans: Plan[];
  isSignedIn: boolean;
  currentPlan?: PlanId;
  billingEnabled?: boolean;
}) {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {plans.map((plan) => {
        const isCurrent = currentPlan === plan.id;
        const isPaid = plan.priceMonthly > 0;

        return (
          <div
            key={plan.id}
            className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm transition ${
              plan.highlight ? "border-indigo-300 ring-1 ring-indigo-200" : "border-slate-200"
            }`}
          >
            {plan.highlight && (
              <span className="absolute -top-3 left-6 rounded-full bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                Most popular
              </span>
            )}

            <h3 className="text-base font-semibold text-slate-900">{plan.name}</h3>
            <p className="mt-0.5 text-sm text-slate-500">{plan.tagline}</p>

            <div className="mt-5 flex items-baseline gap-1.5">
              <span className="text-3xl font-bold tracking-tight text-slate-900">
                ${plan.priceMonthly}
              </span>
              <span className="text-sm text-slate-500">/month</span>
            </div>

            <ul className="mt-6 flex-1 space-y-2.5">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2.5 text-sm text-slate-600">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] text-emerald-700">
                    ✓
                  </span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <div className="mt-7">
              {!isPaid ? (
                <a
                  href={isSignedIn ? "/dashboard" : "/signup"}
                  className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                >
                  {isSignedIn ? "Go to dashboard" : "Start free"}
                </a>
              ) : isCurrent ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-center text-sm font-semibold text-emerald-800">
                  Current plan
                </div>
              ) : (
                <UpgradeButton
                  plan={plan.id === "scale" ? "scale" : "pro"}
                  isSignedIn={isSignedIn}
                  label={`Upgrade to ${plan.name}`}
                  variant={plan.highlight ? "primary" : "secondary"}
                />
              )}

              {isPaid && !billingEnabled && (
                <p className="mt-2 text-xs leading-relaxed text-amber-700">
                  Stripe is not configured on this deployment yet — set <code>STRIPE_SECRET_KEY</code>{" "}
                  and a price id to enable checkout.
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
