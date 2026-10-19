import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { getCurrentUser } from "@/lib/auth";
import { getPlan, type PlanId } from "@/lib/plans";
import { usageSnapshot } from "@/lib/usage";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Middleware-free auth guard: every dashboard route re-checks on the server.
  if (!user) redirect("/login?next=/dashboard");

  const plan = getPlan(user.plan as PlanId);

  return (
    <DashboardShell
      user={{ name: user.name, email: user.email }}
      planName={plan.name}
      usage={usageSnapshot(user.id, plan.id)}
      isAdmin={user.role === "admin"}
    >
      {children}
    </DashboardShell>
  );
}
