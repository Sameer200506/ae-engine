import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
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
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Welcome back</h1>
        <p className="mt-1 mb-6 text-sm text-slate-500">Sign in to your workspace.</p>

        <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-slate-100" />}>
          <AuthForm mode="login" />
        </Suspense>
      </div>

      <p className="mt-6 text-xs text-slate-400">
        First account created on this instance becomes the admin.
      </p>
    </div>
  );
}
