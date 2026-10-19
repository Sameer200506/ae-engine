"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/lib/sse-client";
import type { UsageSnapshot } from "@/lib/plans";

const NAV = [
  { href: "/dashboard", label: "Chat", icon: "💬" },
  { href: "/dashboard/agents", label: "Agents", icon: "🤖" },
  { href: "/dashboard/knowledge", label: "Knowledge", icon: "📚" },
  { href: "/dashboard/prompts", label: "Prompts", icon: "✨" },
  { href: "/dashboard/billing", label: "Billing", icon: "💳" },
];

export function DashboardShell({
  children,
  user,
  planName,
  usage,
  isAdmin,
}: {
  children: React.ReactNode;
  user: { name: string; email: string };
  planName: string;
  usage: UsageSnapshot;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const nav = isAdmin ? [...NAV, { href: "/dashboard/admin", label: "Admin", icon: "🛡️" }] : NAV;

  async function signOut() {
    try {
      await postJson("/api/auth/logout");
    } finally {
      router.refresh();
      router.push("/");
    }
  }

  const nearLimit = usage.percentUsed >= 80;

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* --------------------------------- sidebar -------------------------------- */}
      <aside
        className={`${
          open ? "block" : "hidden"
        } border-b border-slate-200 bg-white lg:block lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r`}
      >
        <div className="flex h-full flex-col p-4">
          <Link href="/" className="mb-6 flex items-center gap-2.5 px-1">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm text-white">
              ✳
            </span>
            <span className="text-[15px] font-semibold tracking-tight">AEO Engine</span>
          </Link>

          <nav className="flex-1 space-y-1">
            {nav.map((item) => {
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                    active
                      ? "bg-indigo-50 font-medium text-indigo-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <span aria-hidden>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* -------------------------------- usage ------------------------------- */}
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600">{planName} plan</span>
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {usage.percentUsed}%
              </span>
            </div>

            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full transition-all ${
                  nearLimit ? "bg-amber-500" : "bg-indigo-500"
                }`}
                style={{ width: `${Math.max(2, usage.percentUsed)}%` }}
              />
            </div>

            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              {usage.messagesUsed} of {usage.messageLimit} messages used this month
            </p>

            <Link
              href="/dashboard/billing"
              className="mt-2 block text-[11px] font-medium text-indigo-600 hover:underline"
            >
              {planName === "Free" ? "Upgrade for more" : "Manage plan"}
            </Link>
          </div>

          {/* --------------------------------- user ------------------------------- */}
          <div className="mt-3 border-t border-slate-200 pt-3">
            <p className="truncate px-1 text-sm font-medium text-slate-800">
              {user.name || user.email.split("@")[0]}
            </p>
            <p className="truncate px-1 text-xs text-slate-500">{user.email}</p>
            <button
              type="button"
              onClick={() => void signOut()}
              className="mt-2 w-full rounded-lg px-3 py-1.5 text-left text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* ---------------------------------- main ---------------------------------- */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium"
          >
            {open ? "Close" : "Menu"}
          </button>
          <span className="text-sm font-semibold">AEO Engine</span>
          <span className="w-16" />
        </div>

        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
