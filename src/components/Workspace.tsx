"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChatPanel, type ChatMessage, type SavedPrompt } from "./ChatPanel";
import { deleteJson, getJson, patchJson } from "@/lib/sse-client";
import type { UsageSnapshot } from "@/lib/plans";

interface AgentSummary {
  id: string;
  name: string;
  role_label: string;
  description: string;
}

interface ConversationSummary {
  id: string;
  agentId: string;
  title: string;
  updatedAt: number;
}

interface MessageDto {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources: { documentId: string; title: string; score: number }[];
}

export function Workspace({
  agents,
  initialConversations,
  prompts,
  usage,
  llmConfigured,
}: {
  agents: AgentSummary[];
  initialConversations: ConversationSummary[];
  prompts: SavedPrompt[];
  usage: UsageSnapshot;
  llmConfigured: boolean;
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedAgentId, setSelectedAgentId] = useState(agents[0]?.id ?? "");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [loadedMessages, setLoadedMessages] = useState<MessageDto[]>([]);
  const [chatKey, setChatKey] = useState(0);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  const refreshConversations = useCallback(async () => {
    try {
      const data = await getJson<{ conversations: ConversationSummary[] }>("/api/conversations");
      setConversations(data.conversations);
    } catch {
      /* non-fatal: the list is a convenience */
    }
  }, []);

  // Re-sync when the server list changes (e.g. after a soft navigation).
  useEffect(() => {
    setConversations(initialConversations);
  }, [initialConversations]);

  const visibleConversations = conversations.filter((c) => c.agentId === selectedAgentId);

  async function openConversation(id: string) {
    setLoadingThread(true);
    setSidebarOpen(false);
    try {
      const data = await getJson<{
        conversation: { id: string; agentId: string; title: string };
        messages: MessageDto[];
      }>(`/api/conversations/${id}`);

      setSelectedAgentId(data.conversation.agentId);
      setSelectedConversationId(id);
      setLoadedMessages(data.messages);
      // Bumping the key remounts ChatPanel with the loaded transcript.
      setChatKey((k) => k + 1);
    } catch {
      setLoadedMessages([]);
    } finally {
      setLoadingThread(false);
    }
  }

  function startNewChat() {
    setSelectedConversationId(null);
    setLoadedMessages([]);
    setChatKey((k) => k + 1);
    setSidebarOpen(false);
  }

  async function removeConversation(id: string, event: React.MouseEvent) {
    event.stopPropagation();
    try {
      await deleteJson(`/api/conversations/${id}`);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (selectedConversationId === id) startNewChat();
    } catch {
      /* ignore */
    }
  }

  async function renameConversation(id: string, current: string, event: React.MouseEvent) {
    event.stopPropagation();
    const title = window.prompt("Rename conversation", current);
    if (!title?.trim()) return;
    try {
      await patchJson(`/api/conversations/${id}`, { title });
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
    } catch {
      /* ignore */
    }
  }

  const notice =
    !llmConfigured
      ? {
          tone: "warning" as const,
          message:
            "No LLM API key is configured. Add OPENROUTER_API_KEY to your .env file and restart the server (free keys at openrouter.ai/keys).",
        }
      : usage.messagesRemaining <= 0
        ? {
            tone: "error" as const,
                message: `You have used all ${usage.messageLimit} messages included this month. Upgrade your plan to keep chatting.`,
          }
        : null;

  if (!agents.length) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-xl">
            🤖
          </span>
          <h2 className="text-lg font-semibold text-slate-900">No agents yet</h2>
          <p className="mt-2 text-sm text-slate-600">
            An agent is a system prompt plus a knowledge base. Create one to start chatting.
          </p>
          <Link
            href="/dashboard/agents"
            className="mt-5 inline-block rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            Create your first agent
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      {/* ------------------------------ thread list ----------------------------- */}
      <div
        className={`${
          sidebarOpen ? "block" : "hidden"
        } w-full shrink-0 border-r border-slate-200 bg-white md:block md:w-72`}
      >
        <div className="flex h-full flex-col">
          <div className="space-y-2 border-b border-slate-200 p-3">
            <button
              type="button"
              onClick={startNewChat}
              className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              + New chat
            </button>

            {agents.length > 1 && (
              <select
                value={selectedAgentId}
                onChange={(e) => {
                  setSelectedAgentId(e.target.value);
                  startNewChat();
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm outline-none focus:border-indigo-400"
              >
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            )}

            {selectedAgent && (
              <p className="px-0.5 text-[11px] leading-relaxed text-slate-500">
                {selectedAgent.description || selectedAgent.role_label}
              </p>
            )}
          </div>

          <div className="scroll-thin flex-1 overflow-y-auto p-2">
            {visibleConversations.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-slate-400">
                No conversations yet.
              </p>
            ) : (
              <ul className="space-y-0.5">
                {visibleConversations.map((conversation) => (
                  <li key={conversation.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => void openConversation(conversation.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void openConversation(conversation.id);
                      }}
                      className={`group flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-2 text-sm transition ${
                        selectedConversationId === conversation.id
                          ? "bg-indigo-50 text-indigo-800"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">{conversation.title}</span>

                      <button
                        type="button"
                        onClick={(e) => void renameConversation(conversation.id, conversation.title, e)}
                        className="shrink-0 rounded p-1 text-xs text-slate-400 opacity-0 transition group-hover:opacity-100 hover:text-slate-700"
                        aria-label="Rename conversation"
                        title="Rename"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        onClick={(e) => void removeConversation(conversation.id, e)}
                        className="shrink-0 rounded p-1 text-xs text-slate-400 opacity-0 transition group-hover:opacity-100 hover:text-rose-600"
                        aria-label="Delete conversation"
                        title="Delete"
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* --------------------------------- chat --------------------------------- */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col p-4">
        <div className="mb-3 flex items-center justify-between md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium"
          >
            {sidebarOpen ? "Hide chats" : "Chats"}
          </button>
          <span className="truncate text-sm font-medium text-slate-700">
            {selectedAgent?.name}
          </span>
        </div>

        {loadingThread ? (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
            Loading conversation...
          </div>
        ) : (
          <ChatPanel
            key={chatKey}
            endpoint="/api/chat"
            agentId={selectedAgentId}
            conversationId={selectedConversationId}
            initialMessages={loadedMessages
              .filter((m) => m.role === "user" || m.role === "assistant")
              .map<ChatMessage>((m) => ({
                id: m.id,
                role: m.role as "user" | "assistant",
                content: m.content,
                sources: m.sources,
              }))}
            onConversationId={(id) => {
              // Continue in the same thread on the next message without
              // remounting the panel (which would drop the streaming reply).
              setSelectedConversationId(id);
              void refreshConversations();
            }}
            savedPrompts={prompts}
            notice={notice}
            showSources
            className="flex-1"
            emptyTitle={selectedAgent ? `Chat with ${selectedAgent.name}` : "Ask anything"}
            emptySubtitle={
              selectedAgent?.description ||
              "Answers are grounded in the knowledge base attached to this agent."
            }
            suggestions={[
              "Summarise what is in the knowledge base",
              "What questions can you answer?",
              "Give me a one-paragraph overview",
            ]}
          />
        )}
      </div>
    </div>
  );
}
