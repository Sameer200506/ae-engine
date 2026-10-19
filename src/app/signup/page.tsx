import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
          ✳
        </span>
        <span className="text-base font-semibold tracking-tight">AEO Engine</span>
      </Link>

      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Create your account</h1>
        <p className="mt-1 mb-6 text-sm text-slate-500">
          Free plan, no card. You can upgrade whenever you like.
        </p>

        <Suspense fallback={<div className="h-72 animate-pulse rounded-lg bg-slate-100" />}>
          <AuthForm mode="signup" />
        </Suspense>
      </div>

      <p className="mt-6 max-w-sm text-center text-xs leading-relaxed text-slate-400">
        Add <code className="rounded bg-slate-100 px-1 py-0.5">OPENROUTER_API_KEY</code> to your
        environment to get free model access — otherwise chat returns a setup message.
      </p>
    </div>
  );
}
