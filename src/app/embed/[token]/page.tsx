import { notFound } from "next/navigation";
import { ChatPanel } from "@/components/ChatPanel";
import { getAgentByShareToken } from "@/lib/agents";

export const dynamic = "force-dynamic";

/**
 * Rendered inside the iframe created by /widget.js.
 *
 * Intentionally chrome-free and transparent-friendly: the host page controls
 * position and sizing via the injected iframe styles.
 */
export default async function EmbedPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const agent = getAgentByShareToken(token);
  if (!agent) notFound();

  return (
    <div className="flex h-screen flex-col bg-white">
      <header className="flex items-center gap-2.5 border-b border-slate-200 px-4 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs text-white">
          ✳
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-slate-900">{agent.name}</p>
          <p className="truncate text-[11px] text-slate-500">
            {agent.description || agent.role_label}
          </p>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col px-4 py-3">
        <ChatPanel
          endpoint="/api/public/chat"
          token={token}
          compact
          className="min-h-0 flex-1"
          emptyTitle={`Ask ${agent.name}`}
          placeholder="Type your question..."
        />
      </main>

      <footer className="border-t border-slate-100 px-4 py-2">
        <p className="text-center text-[10px] text-slate-400">Powered by AEO Engine</p>
      </footer>
    </div>
  );
}
