import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { PlanGrid } from "@/components/PlanGrid";
import { getCurrentUser } from "@/lib/auth";
import { PLANS, type PlanId } from "@/lib/plans";
import { stripeEnabled } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Free, Pro and Scale plans for AEO Engine.",
};

const COMPARISON: { label: string; values: [string, string, string] }[] = [
  { label: "Agents", values: ["1", "10", "50"] },
  { label: "Knowledge-base documents", values: ["3", "100", "1,000"] },
  { label: "Messages per month", values: ["25", "2,000", "10,000"] },
  { label: "Conversation history", values: ["Kept", "Kept", "Kept"] },
  { label: "Saved prompts", values: ["5", "200", "200"] },
  { label: "Share link & embeddable widget", values: ["—", "Included", "Included"] },
  { label: "Priority support", values: ["—", "—", "Included"] },
];

export default async function PricingPage() {
  const user = await getCurrentUser();
  const billingEnabled = stripeEnabled();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader isSignedIn={Boolean(user)} />

      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-slate-200 bg-white">
          <div className="hero-glow pointer-events-none absolute inset-0 opacity-40" />
          <div className="relative mx-auto max-w-3xl px-5 py-16 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Pricing that starts at free
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
              Limits are enforced on the server before a model is called, so an account can never
              silently overspend.
            </p>
          </div>
        </section>

        <section className="py-14">
          <div className="mx-auto max-w-6xl px-5">
            <PlanGrid
              plans={Object.values(PLANS)}
              isSignedIn={Boolean(user)}
              currentPlan={user?.plan as PlanId | undefined}
              billingEnabled={billingEnabled}
            />
          </div>
        </section>

        {/* ---------------------------- comparison table --------------------------- */}
        <section className="pb-16">
          <div className="mx-auto max-w-4xl px-5">
            <h2 className="text-lg font-semibold text-slate-900">Plan comparison</h2>

            <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-5 py-3 text-left font-medium text-slate-500">Feature</th>
                    {(["free", "pro", "scale"] as PlanId[]).map((id) => (
                      <th key={id} className="px-5 py-3 text-left font-semibold text-slate-800">
                        {PLANS[id].name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {COMPARISON.map((row) => (
                    <tr key={row.label}>
                      <td className="px-5 py-3 text-slate-600">{row.label}</td>
                      {row.values.map((value, i) => (
                        <td
                          key={i}
                          className={`px-5 py-3 ${value === "—" ? "text-slate-300" : "text-slate-800"}`}
                        >
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <h3 className="text-sm font-semibold text-slate-900">How to test billing locally</h3>
              <ol className="mt-3 space-y-2 text-sm text-slate-600">
                <li>
                  1. Add your Stripe <strong>test</strong> keys and a price id to{" "}
                  <code className="rounded bg-white px-1.5 py-0.5 text-xs">.env</code>.
                </li>
                <li>
                  2. Run{" "}
                  <code className="rounded bg-white px-1.5 py-0.5 text-xs">
                    stripe listen --forward-to localhost:3000/api/stripe/webhook
                  </code>{" "}
                  and copy the signing secret it prints.
                </li>
                <li>3. Upgrade with card 4242 4242 4242 4242 — the webhook flips your plan.</li>
              </ol>
              <p className="mt-4 text-xs text-slate-500">
                Full instructions, including production webhook setup, are in the README.
              </p>
            </div>

            <p className="mt-8 text-center text-sm text-slate-500">
              Questions before you buy?{" "}
              <Link href="/signup" className="font-medium text-indigo-600 hover:underline">
                Create a free account
              </Link>{" "}
              and try it with your own documents.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
