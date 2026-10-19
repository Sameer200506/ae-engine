import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, listAllUsers } from "@/lib/auth";
import { adminListConversations, adminStats } from "@/lib/conversations";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await getCurrentUser();
  // Layout already guards auth; this additionally guards the admin role.
  if (!user) redirect("/login?next=/dashboard/admin");
  if (user.role !== "admin") redirect("/dashboard");

  const { q } = await searchParams;
  const stats = adminStats();
  const users = listAllUsers();
  const conversations = adminListConversations(150, q);

  return (
    <div className="h-full overflow-y-auto p-5 lg:p-7">
      <div className="space-y-7">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">Admin console</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every account, plan and conversation on this instance.
          </p>
        </div>

        {/* -------------------------------- stats --------------------------------- */}
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Users", value: stats.users },
            { label: "Paid", value: stats.paidUsers },
            { label: "Agents", value: stats.agents },
            { label: "Conversations", value: stats.conversations },
            { label: "Messages (all time)", value: stats.messages },
            { label: "Messages (month)", value: stats.messagesThisMonth },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-3.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                {stat.label}
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* -------------------------------- users --------------------------------- */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-900">
            Users
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs text-slate-500">
                  <th className="px-5 py-2.5 font-medium">Email</th>
                  <th className="px-5 py-2.5 font-medium">Plan</th>
                  <th className="px-5 py-2.5 font-medium">Role</th>
                  <th className="px-5 py-2.5 font-medium">Agents</th>
                  <th className="px-5 py-2.5 font-medium">Messages</th>
                  <th className="px-5 py-2.5 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((row) => (
                  <tr key={row.id}>
                    <td className="px-5 py-2.5 font-medium text-slate-800">
                      {row.email}
                      {row.name ? (
                        <span className="ml-2 text-xs font-normal text-slate-400">{row.name}</span>
                      ) : null}
                    </td>
                    <td className="px-5 py-2.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                          row.plan === "free"
                            ? "bg-slate-100 text-slate-600"
                            : "bg-indigo-100 text-indigo-700"
                        }`}
                      >
                        {row.plan}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-slate-600">{row.role}</td>
                    <td className="px-5 py-2.5 text-slate-600">{row.agentCount}</td>
                    <td className="px-5 py-2.5 text-slate-600">{row.messageCount}</td>
                    <td className="px-5 py-2.5 text-xs text-slate-400">
                      {new Date(row.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ----------------------------- conversations ---------------------------- */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Conversations</h2>

            <form className="flex gap-2">
              <input
                name="q"
                defaultValue={q ?? ""}
                placeholder="Search title, agent or email"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-indigo-400"
              />
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                Search
              </button>
            </form>
          </div>

          {conversations.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">
              No conversations matched.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs text-slate-500">
                    <th className="px-5 py-2.5 font-medium">Title</th>
                    <th className="px-5 py-2.5 font-medium">Agent</th>
                    <th className="px-5 py-2.5 font-medium">User</th>
                    <th className="px-5 py-2.5 font-medium">Messages</th>
                    <th className="px-5 py-2.5 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {conversations.map((row) => (
                    <tr key={row.id}>
                      <td className="max-w-[280px] truncate px-5 py-2.5 text-slate-800">
                        {row.title}
                      </td>
                      <td className="px-5 py-2.5 text-slate-600">{row.agent_name}</td>
                      <td className="px-5 py-2.5 text-slate-600">
                        {row.user_email}
                        <span className="ml-2 text-xs text-slate-400">{row.plan}</span>
                      </td>
                      <td className="px-5 py-2.5 text-slate-600">{row.message_count}</td>
                      <td className="px-5 py-2.5 text-xs text-slate-400">
                        {new Date(row.updated_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
