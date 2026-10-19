"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Markdown } from "./Markdown";
import { streamChatRequest } from "@/lib/sse-client";

export interface Source {
  documentId: string;
  title: string;
  score: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  pending?: boolean;
}

export interface SavedPrompt {
  id: string;
  title: string;
  body: string;
}

export interface ChatPanelProps {
  /** "/api/chat" (signed in) or "/api/public/chat" (shared widget). */
  endpoint: string;
  agentId?: string;
  token?: string;
  conversationId?: string | null;
  onConversationId?: (id: string) => void;
  initialMessages?: ChatMessage[];
  emptyTitle?: string;
  emptySubtitle?: string;
  suggestions?: string[];
  savedPrompts?: SavedPrompt[];
  compact?: boolean;
  className?: string;
  showSources?: boolean;
  placeholder?: string;
  /** Optional banner rendered above the transcript (used for quota warnings). */
  notice?: { tone: "warning" | "error"; message: string } | null;
}

const VISITOR_KEY = "aeo_visitor_id";

function readVisitorId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let id = window.localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      window.localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    // Private browsing / storage disabled: still usable, just not sticky.
    return null;
  }
}

export function ChatPanel({
  endpoint,
  agentId,
  token,
  conversationId: conversationIdProp,
  onConversationId,
  initialMessages,
  emptyTitle = "Ask anything",
  emptySubtitle = "Answers are grounded in the knowledge base you attached to this agent.",
  suggestions = [],
  savedPrompts = [],
  compact = false,
  className = "",
  showSources = true,
  placeholder = "Send a message...",
  notice,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages ?? []);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(conversationIdProp ?? null);
  const [showPromptMenu, setShowPromptMenu] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep in sync when the parent switches conversations.
  useEffect(() => {
    setConversationId(conversationIdProp ?? null);
  }, [conversationIdProp]);

  useEffect(() => {
    setMessages(initialMessages ?? []);
    setError(null);
  }, [initialMessages]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  useEffect(() => {
    scrollToBottom(busy ? "auto" : "smooth");
  }, [messages, busy, scrollToBottom]);

  const send = useCallback(
    async (raw?: string) => {
      const text = (raw ?? input).trim();
      if (!text || busy) return;

      setInput("");
      setError(null);
      setBusy(true);

      const userMessage: ChatMessage = { id: `u_${Date.now()}`, role: "user", content: text };
      const assistantId = `a_${Date.now()}`;

      setMessages((prev) => [
        ...prev,
        userMessage,
        { id: assistantId, role: "assistant", content: "", pending: true },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await streamChatRequest(
          endpoint,
          {
            ...(agentId ? { agentId } : {}),
            ...(token ? { token } : {}),
            message: text,
            conversationId,
            ...(token ? { visitorId: readVisitorId() } : {}),
          },
          {
            signal: controller.signal,
            onEvent: (event) => {
              const type = event.type as string;

              if (type === "meta") {
                const newId = event.conversationId as string | undefined;
                if (newId && newId !== conversationId) {
                  setConversationId(newId);
                  onConversationId?.(newId);
                }
                const sources = (event.sources as Source[] | undefined) ?? [];
                if (sources.length) {
                  setMessages((prev) =>
                    prev.map((m) => (m.id === assistantId ? { ...m, sources } : m)),
                  );
                }
                return;
              }

              if (type === "delta") {
                const chunk = event.text as string;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: m.content + chunk } : m,
                  ),
                );
                return;
              }

              if (type === "done") {
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, pending: false } : m)),
                );
                return;
              }

              if (type === "error") {
                setError(String(event.message ?? "Something went wrong."));
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, pending: false } : m)),
                );
              }
            },
          },
        );
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") {
          setError(err instanceof Error ? err.message : "The request failed.");
        }
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, pending: false } : m)),
        );
      } finally {
        abortRef.current = null;
        setBusy(false);
        // Drop an assistant bubble that never received any text.
        setMessages((prev) =>
          prev.filter((m) => !(m.id === assistantId && !m.content.trim() && !m.pending)),
        );
        textareaRef.current?.focus();
      }
    },
    [agentId, busy, conversationId, endpoint, input, onConversationId, token],
  );

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter makes a newline - the convention users expect.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  };

  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const hasMessages = messages.length > 0;

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      {notice && (
        <div
          className={`mb-3 rounded-lg border px-3 py-2 text-sm ${
            notice.tone === "error"
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          {notice.message}
        </div>
      )}

      {/* ------------------------------ transcript ----------------------------- */}
      <div
        ref={scrollRef}
        className="scroll-thin min-h-0 flex-1 overflow-y-auto px-1 py-2"
        aria-live="polite"
      >
        {!hasMessages && (
          <div className={`mx-auto max-w-2xl ${compact ? "py-6" : "py-12"} text-center`}>
            <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-lg text-white shadow-sm">
              ✳
            </div>
            <h2 className="text-lg font-semibold text-slate-900">{emptyTitle}</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{emptySubtitle}</p>

            {suggestions.length > 0 && (
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm text-slate-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className={`mx-auto w-full ${compact ? "max-w-none" : "max-w-3xl"} space-y-5`}>
          {messages.map((message) => (
            <div
              key={message.id}
              className={`animate-fade-up flex gap-3 ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {message.role === "assistant" && (
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-xs text-white">
                  ✳
                </div>
              )}

              <div
                className={
                  message.role === "user"
                    ? "max-w-[85%] rounded-2xl rounded-br-md bg-indigo-600 px-4 py-2.5 text-sm text-white shadow-sm"
                    : "min-w-0 max-w-full flex-1 text-slate-800"
                }
              >
                {message.role === "user" ? (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                ) : (
                  <>
                    {message.content ? (
                      <div className={message.pending ? "streaming-caret" : undefined}>
                        <Markdown>{message.content}</Markdown>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 py-1 text-sm text-slate-400">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
                        Thinking...
                      </div>
                    )}

                    {showSources && !message.pending && message.sources?.length ? (
                      <div className="mt-3 border-t border-slate-100 pt-2.5">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                          Sources
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {message.sources.map((source, i) => (
                            <span
                              key={`${source.documentId}-${i}`}
                              title={`Similarity ${source.score}`}
                              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
                            >
                              <span className="text-slate-400">[{i + 1}]</span>
                              <span className="max-w-[200px] truncate">{source.title}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* -------------------------------- error -------------------------------- */}
      {error && (
        <div className="mx-auto mt-2 w-full max-w-3xl rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          <div className="flex items-start justify-between gap-3">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="shrink-0 text-rose-500 hover:text-rose-700"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* -------------------------------- composer ----------------------------- */}
      <div className={`mx-auto w-full ${compact ? "max-w-none" : "max-w-3xl"} pt-3`}>
        <div className="rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              autoGrow(e.target);
            }}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={placeholder}
            disabled={busy}
            className="scroll-thin max-h-[200px] w-full resize-none bg-transparent px-2.5 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60"
          />

          <div className="flex items-center justify-between gap-2 px-1.5 pb-1">
            <div className="flex items-center gap-1">
              {savedPrompts.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowPromptMenu((v) => !v)}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    Saved prompts
                  </button>
                  {showPromptMenu && (
                    <>
                      <button
                        type="button"
                        className="fixed inset-0 z-10 cursor-default"
                        onClick={() => setShowPromptMenu(false)}
                        aria-label="Close prompt menu"
                      />
                      <div className="absolute bottom-full left-0 z-20 mb-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                        {savedPrompts.map((prompt) => (
                          <button
                            key={prompt.id}
                            type="button"
                            onClick={() => {
                              setInput(prompt.body);
                              setShowPromptMenu(false);
                              textareaRef.current?.focus();
                            }}
                            className="block w-full px-3 py-2 text-left hover:bg-slate-50"
                          >
                            <span className="block truncate text-sm font-medium text-slate-800">
                              {prompt.title}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-slate-500">
                              {prompt.body}
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
              <span className="hidden text-xs text-slate-400 sm:inline">
                Enter to send · Shift+Enter for a new line
              </span>
            </div>

            {busy ? (
              <button
                type="button"
                onClick={stop}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void send()}
                disabled={!input.trim()}
                className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Send
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
