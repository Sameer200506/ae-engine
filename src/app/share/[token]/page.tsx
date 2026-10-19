import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChatPanel } from "@/components/ChatPanel";
import { getAgentByShareToken } from "@/lib/agents";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const agent = getAgentByShareToken(token);
  return {
    title: agent ? agent.name : "Assistant unavailable",
    description: agent?.description || "An AI assistant grounded in a private knowledge base.",
    robots: { index: false, follow: false },
  };
}

export default async function SharePage({ params }: Props) {
  const { token } = await params;
  const agent = getAgentByShareToken(token);
  if (!agent) notFound();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
            ✳
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-slate-900">{agent.name}</h1>
            <p className="truncate text-xs text-slate-500">
              {agent.description || agent.role_label}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-5">
        <ChatPanel
          endpoint="/api/public/chat"
          token={token}
          className="min-h-0 flex-1"
          emptyTitle={`Ask ${agent.name}`}
          emptySubtitle={
            agent.description ||
            "This assistant answers from a fixed knowledge base, and will tell you when something is not covered."
          }
          suggestions={[
            "What can you help me with?",
            "Summarise the key information",
            "What do you not know?",
          ]}
        />
      </main>

      <footer className="border-t border-slate-200 bg-white px-5 py-3">
        <p className="text-center text-xs text-slate-400">
          Powered by AEO Engine · answers may be incomplete — verify anything important
        </p>
      </footer>
    </div>
  );
}
