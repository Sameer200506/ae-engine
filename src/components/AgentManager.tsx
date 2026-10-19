"use client";

import { useEffect, useMemo, useState } from "react";
import { deleteJson, patchJson, postJson } from "@/lib/sse-client";
import type { PlanId } from "@/lib/plans";

interface AgentDto {
  id: string;
  name: string;
  role_label: string;
  description: string;
  system_prompt: string;
  model: string | null;
  temperature: number;
  share_token: string | null;
  is_public: number;
}

interface Template {
  key: string;
  name: string;
  roleLabel: string;
  description: string;
}

export function AgentManager({
  initialAgents,
  templates,
  defaultPrompt,
  plan,
  canShare,
  maxAgents,
  appUrl,
  modelDefault,
}: {
  initialAgents: AgentDto[];
  templates: Template[];
  defaultPrompt: string;
  plan: PlanId;
  canShare: boolean;
  maxAgents: number;
  appUrl: string;
  modelDefault: string;
}) {
  const [agents, setAgents] = useState(initialAgents);
  const [activeId, setActiveId] = useState<string | null>(initialAgents[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const active = useMemo(() => agents.find((a) => a.id === activeId) ?? null, [agents, activeId]);

  // Local edit buffer so typing does not mutate the list until saved.
  const [draft, setDraft] = useState({
    name: "",
    role_label: "",
    description: "",
    system_prompt: "",
    model: "",
    temperature: 0.7,
  });

  useEffect(() => {
    if (!active) return;
    setDraft({
      name: active.name,
      role_label: active.role_label,
      description: active.description,
      system_prompt: active.system_prompt,
      model: active.model ?? "",
      temperature: active.temperature,
    });
  }, [active]);

  const dirty = Boolean(
    active &&
      (draft.name !== active.name ||
        draft.role_label !== active.role_label ||
        draft.description !== active.description ||
        draft.system_prompt !== active.system_prompt ||
        draft.model !== (active.model ?? "") ||
        draft.temperature !== active.temperature),
  );

  async function createAgent(templateKey?: string) {
    setError(null);
    try {
      const data = await postJson<{ agent: AgentDto }>("/api/agents", {
        ...(templateKey ? { template: templateKey } : {}),
      });
      setAgents((prev) => [...prev, data.agent]);
      setActiveId(data.agent.id);
      setNotice("Agent created. Edit the system prompt, then attach knowledge.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the agent.");
    }
  }

  async function save() {
    if (!active) return;
    setSaving(true);
    setError(null);
    try {
      const data = await patchJson<{ agent: AgentDto }>(`/api/agents/${active.id}`, {
        name: draft.name,
        roleLabel: draft.role_label,
        description: draft.description,
        systemPrompt: draft.system_prompt,
        model: draft.model.trim() ? draft.model.trim() : null,
        temperature: draft.temperature,
      });
      setAgents((prev) => prev.map((a) => (a.id === active.id ? data.agent : a)));
      setNotice("Saved.");
      setTimeout(() => setNotice(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function removeAgent(id: string) {
    if (!window.confirm("Delete this agent and all of its conversations and knowledge?")) return;
    try {
      await deleteJson(`/api/agents/${id}`);
      setAgents((prev) => {
        const next = prev.filter((a) => a.id !== id);
        setActiveId(next[0]?.id ?? null);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the agent.");
    }
  }

  async function toggleShare(next: boolean) {
    if (!active) return;
    setError(null);
    try {
      const data = await postJson<{ agent: AgentDto }>(`/api/agents/${active.id}/share`, {
        isPublic: next,
      });
      setAgents((prev) => prev.map((a) => (a.id === active.id ? data.agent : a)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update sharing.");
    }
  }

  const shareUrl = active?.share_token ? `${appUrl}/share/${active.share_token}` : null;
  const embedSnippet = active?.share_token
    ? `<script src="${appUrl}/widget.js" data-agent="${active.share_token}" async></script>`
    : null;

  return (
    <div className="grid h-full min-h-0 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      {/* ------------------------------- agent list ------------------------------ */}
      <div className="flex min-h-0 flex-col">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Agents{" "}
            <span className="font-normal text-slate-400">
              {agents.length}/{maxAgents}
            </span>
          </h2>
        </div>

        <ul className="space-y-1">
          {agents.map((agent) => (
            <li key={agent.id}>
              <button
                type="button"
                onClick={() => setActiveId(agent.id)}
                className={`w-full rounded-lg px-3 py-2 text-left transition ${
                  agent.id === activeId
                    ? "bg-indigo-50 ring-1 ring-indigo-200"
                    : "hover:bg-slate-100"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-slate-800">{agent.name}</span>
                  {agent.is_public ? (
                    <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                      live
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block truncate text-xs text-slate-500">
                  {agent.role_label}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-4 space-y-2 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={() => void createAgent()}
            disabled={agents.length >= maxAgents}
            className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-40"
          >
            + Blank agent
          </button>

          {templates.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                From a template
              </p>
              <div className="space-y-1">
                {templates.map((template) => (
                  <button
                    key={template.key}
                    type="button"
                    onClick={() => void createAgent(template.key)}
                    disabled={agents.length >= maxAgents}
                    title={template.description}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-left text-xs text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-40"
                  >
                    {template.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* -------------------------------- editor -------------------------------- */}
      <div className="min-h-0 overflow-y-auto">
        {!active ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center">
            <p className="text-sm text-slate-500">
              No agent selected. Create one to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-5 pb-10">
            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </div>
            )}
            {notice && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {notice}
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-900">Identity</h3>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Name</span>
                  <input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Role label</span>
                  <input
                    value={draft.role_label}
                    onChange={(e) => setDraft({ ...draft, role_label: e.target.value })}
                    placeholder="Researcher, Support, Optimizer..."
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </label>
              </div>

              <label className="mt-4 block">
                <span className="text-xs font-medium text-slate-600">
                  Description (shown to users)
                </span>
                <input
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </label>
            </div>

            {/* ------------------------- system prompt ------------------------- */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">System prompt</h3>
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, system_prompt: defaultPrompt })}
                  className="text-xs font-medium text-slate-500 hover:text-slate-800"
                >
                  Reset to default
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                This is the agent&apos;s standing instruction. Retrieved knowledge-base excerpts are
                appended automatically at request time.
              </p>

              <textarea
                value={draft.system_prompt}
                onChange={(e) => setDraft({ ...draft, system_prompt: e.target.value })}
                rows={12}
                spellCheck={false}
                className="scroll-thin mt-3 w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-xs leading-relaxed outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            {/* ----------------------------- model ---------------------------- */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-900">Model</h3>
              <p className="mt-1 text-xs text-slate-500">
                Leave blank to use the server default (<code>{modelDefault}</code>).
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Model id</span>
                  <input
                    value={draft.model}
                    onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                    placeholder="e.g. nvidia/nemotron-3-super-120b-a12b:free"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-slate-600">
                    Temperature: {draft.temperature.toFixed(1)}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1.5}
                    step={0.1}
                    value={draft.temperature}
                    onChange={(e) =>
                      setDraft({ ...draft, temperature: Number(e.target.value) })
                    }
                    className="mt-3 w-full accent-indigo-600"
                  />
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void save()}
                disabled={!dirty || saving}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-40"
              >
                {saving ? "Saving..." : dirty ? "Save changes" : "Saved"}
              </button>

              <button
                type="button"
                onClick={() => void removeAgent(active.id)}
                className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
              >
                Delete agent
              </button>
            </div>

            {/* ---------------------------- sharing --------------------------- */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-900">Share &amp; embed</h3>

              {!canShare ? (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Share links and the embeddable widget are available on paid plans.
                </p>
              ) : (
                <>
                  <label className="mt-3 flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={Boolean(active.is_public)}
                      onChange={(e) => void toggleShare(e.target.checked)}
                      className="h-4 w-4 accent-indigo-600"
                    />
                    <span className="text-sm text-slate-700">
                      Publish this agent publicly
                    </span>
                  </label>

                  {active.is_public && shareUrl && embedSnippet && (
                    <div className="mt-4 space-y-4">
                      <div>
                        <p className="text-xs font-medium text-slate-600">Share link</p>
                        <CopyField value={shareUrl} />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-600">
                          Embed on any website
                        </p>
                        <CopyField value={embedSnippet} mono />
                        <p className="mt-1.5 text-xs text-slate-500">
                          Paste before <code>&lt;/body&gt;</code>. A floating launcher appears
                          bottom-right; each visitor gets their own conversation.
                        </p>
                      </div>
                      <p className="text-xs text-slate-500">
                        Widget messages count against your monthly quota and the public endpoint is
                        rate-limited per IP.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            <p className="text-xs text-slate-400">
              Plan: <span className="font-medium text-slate-600">{plan}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function CopyField({ value, mono = false }: { value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable (insecure origin) */
    }
  }

  return (
    <div className="mt-1.5 flex items-stretch gap-2">
      <input
        readOnly
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className={`min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-700 ${
          mono ? "font-mono" : ""
        }`}
      />
      <button
        type="button"
        onClick={() => void copy()}
        className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
