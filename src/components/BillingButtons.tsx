"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/lib/sse-client";

/**
 * Starts a Stripe Checkout session for a plan.
 *
 * Falls back to signup when the visitor has no account, and surfaces the exact
 * missing env var when billing is not configured yet.
 */
export function UpgradeButton({
  plan,
  isSignedIn,
  disabled,
  label,
  variant = "primary",
}: {
  plan: "pro" | "scale";
  isSignedIn: boolean;
  disabled?: boolean;
  label?: string;
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles =
    variant === "primary"
      ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
      : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50";

  async function onClick() {
    if (!isSignedIn) {
      router.push(`/signup?next=${encodeURIComponent(`/dashboard/billing?plan=${plan}`)}`);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const { url } = await postJson<{ url: string }>("/api/billing/checkout", { plan });
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout.");
      setBusy(false);
    }
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={busy || disabled}
        className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles}`}
      >
        {busy ? "Redirecting..." : (label ?? "Upgrade")}
      </button>
      {error && <p className="mt-2 text-xs leading-relaxed text-rose-600">{error}</p>}
    </div>
  );
}

/** Opens the Stripe billing portal (cancel, change card, invoices). */
export function ManageBillingButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await postJson<{ url: string }>("/api/billing/portal");
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the billing portal.");
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={busy}
        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:opacity-50"
      >
        {busy ? "Opening..." : "Manage billing"}
      </button>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
