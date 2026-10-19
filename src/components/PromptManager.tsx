"use client";

import { useState } from "react";
import { deleteJson, postJson } from "@/lib/sse-client";

interface PromptDto {
  id: string;
  title: string;
  body: string;
  created_at: number;
}

const STARTERS: { title: string; body: string }[] = [
  {
    title: "Summarise a document",
    body: "Summarise the attached knowledge-base content in five bullet points. Keep every number exact and note anything that looks outdated.",
  },
  {
    title: "Answer as support",
    body: "Answer my question using only the retrieved excerpts. If the excerpts do not cover it, say so plainly instead of guessing.",
  },
  {
    title: "Find the gaps",
    body: "List the questions a new customer is likely to ask that our current knowledge base does NOT answer. Order them by how costly it would be to get them wrong.",
  },
  {
    title: "Rewrite to be quotable",
    body: "Rewrite the following so the direct answer appears in the first sentence and each paragraph can stand on its own when quoted out of context.",
  },
  {
    title: "Compare two options",
    body: "Compare the two options in the knowledge base in a table: what each is best at, what each costs, and which one you would pick for a small team. Cite your sources.",
  },
];

export function PromptManager({
  initialPrompts,
  cap,
}: {
  initialPrompts: PromptDto[];
  cap: number;
}) {
  const [prompts, setPrompts] = useState(initialPrompts);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(nextTitle = title, nextBody = body) {
    if (!nextTitle.trim() || !nextBody.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const data = await postJson<{ prompt: PromptDto }>("/api/prompts", {
        title: nextTitle,
        body: nextBody,
      });
      setPrompts((prev) => [data.prompt, ...prev]);
      setTitle("");
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the prompt.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await deleteJson(`/api/prompts?id=${encodeURIComponent(id)}`);
      setPrompts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the prompt.");
    }
  }

  const atCap = prompts.length >= cap;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">Saved prompts</h1>
        <p className="mt-1 text-sm text-slate-500">
          Reusable instructions that appear in the &ldquo;Saved prompts&rdquo; menu above the chat
          composer.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {prompts.length}/{cap} used on your plan
        </p>
      </div>

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="shrink-0">
            ✕
          </button>
        </div>
      )}

      {/* ------------------------------- create form ---------------------------- */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">New prompt</h2>

        <div className="mt-4 space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title, e.g. Weekly digest"
            disabled={atCap || busy}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-50"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="The full prompt text that gets inserted into the composer..."
            disabled={atCap || busy}
            className="scroll-thin w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void add()}
            disabled={atCap || busy || !title.trim() || !body.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-40"
          >
            {busy ? "Saving..." : "Save prompt"}
          </button>
          {atCap && (
            <p className="text-xs text-amber-700">
              Prompt limit reached. Delete one or upgrade for more.
            </p>
          )}
        </div>
      </div>

      {/* --------------------------------- saved -------------------------------- */}
      {prompts.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-900">
            Your prompts
          </h2>
          <ul className="divide-y divide-slate-100">
            {prompts.map((prompt) => (
              <li key={prompt.id} className="flex items-start justify-between gap-4 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{prompt.title}</p>
                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-slate-500">
                    {prompt.body}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void remove(prompt.id)}
                  className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ------------------------------- starters ------------------------------- */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-sm font-semibold text-slate-900">Starter prompts</h2>
        <p className="mt-1 text-xs text-slate-500">Click to save any of these to your shelf.</p>

        <div className="mt-4 space-y-2">
          {STARTERS.map((starter) => (
            <button
              key={starter.title}
              type="button"
              onClick={() => void add(starter.title, starter.body)}
              disabled={atCap || busy}
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-left transition hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50"
            >
              <span className="block text-sm font-medium text-slate-800">{starter.title}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{starter.body}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
