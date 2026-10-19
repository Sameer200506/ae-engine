"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { deleteJson, getJson } from "@/lib/sse-client";

interface AgentDto {
  id: string;
  name: string;
}

interface DocumentDto {
  id: string;
  title: string;
  source_type: string;
  source_ref: string | null;
  status: string;
  error: string | null;
  char_count: number;
  chunk_count: number;
  created_at: number;
}

export function KnowledgeManager({
  agents,
  maxDocuments,
  documentsUsed,
  embeddingsEnabled,
  embeddingsNote,
  embeddingsModel,
  acceptedExtensions,
}: {
  agents: AgentDto[];
  maxDocuments: number;
  documentsUsed: number;
  embeddingsEnabled: boolean;
  embeddingsNote: string | null;
  embeddingsModel: string;
  acceptedExtensions: string;
}) {
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [textTitle, setTextTitle] = useState("");
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"file" | "url" | "text">("file");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getJson<{ documents: DocumentDto[] }>(
        `/api/knowledge?agentId=${encodeURIComponent(id)}`,
      );
      setDocuments(data.documents);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load documents.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(agentId);
  }, [agentId, load]);

  async function uploadFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("agentId", agentId);
      form.append("file", file);

      // Deliberately not using a JSON helper here: this is a multipart upload.
      const response = await fetch("/api/knowledge", { method: "POST", body: form });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? `Upload failed (HTTP ${response.status}).`);
      }
      await load(agentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      await load(agentId); // pick up the `error` row the server recorded
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function addUrl() {
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, url: url.trim() }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? `Failed (HTTP ${response.status}).`);
      }
      setUrl("");
      await load(agentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not index that URL.");
      await load(agentId);
    } finally {
      setBusy(false);
    }
  }

  async function addText() {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          text,
          title: textTitle.trim() || "Pasted text",
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? `Failed (HTTP ${response.status}).`);
      }
      setText("");
      setTextTitle("");
      await load(agentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not index that text.");
      await load(agentId);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await deleteJson(`/api/knowledge/${id}`);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the document.");
    }
  }

  if (!agents.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center">
        <p className="text-sm text-slate-500">
          Create an agent first — knowledge bases belong to an agent.
        </p>
      </div>
    );
  }

  const atCap = documentsUsed >= maxDocuments;

  return (
    <div className="space-y-6">
      {/* -------------------------------- header -------------------------------- */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">Knowledge base</h1>
          <p className="mt-1 text-sm text-slate-500">
            Documents are chunked, embedded and retrieved at answer time.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            {documentsUsed}/{maxDocuments} documents
          </span>
          {agents.length > 1 && (
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
            >
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {!embeddingsEnabled && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {embeddingsNote ?? "Embeddings are not configured, so documents cannot be indexed."}
        </div>
      )}

      {atCap && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          You have reached the {maxDocuments}-document limit on your plan. Delete a document or
          upgrade to add more.
        </div>
      )}

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="shrink-0">
            ✕
          </button>
        </div>
      )}

      {/* -------------------------------- add form ------------------------------ */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {(
            [
              ["file", "Upload file"],
              ["url", "From URL"],
              ["text", "Paste text"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                mode === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {mode === "file" && (
            <div>
              <input
                ref={fileRef}
                type="file"
                accept={acceptedExtensions}
                disabled={busy || atCap}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadFile(file);
                }}
                className="block w-full cursor-pointer rounded-lg border border-dashed border-slate-300 px-3 py-6 text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:border-indigo-300 disabled:opacity-50"
              />
              <p className="mt-2 text-xs text-slate-500">
                {busy
                  ? "Uploading and embedding — this can take a few seconds..."
                  : `Accepts ${acceptedExtensions.replace(/,/g, ", ")} up to 10 MB.`}
              </p>
            </div>
          )}

          {mode === "url" && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/docs/getting-started"
                disabled={busy || atCap}
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => void addUrl()}
                disabled={busy || atCap || !url.trim()}
                className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-40"
              >
                {busy ? "Fetching..." : "Index page"}
              </button>
            </div>
          )}

          {mode === "text" && (
            <div className="space-y-2">
              <input
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                placeholder="Title (optional)"
                disabled={busy || atCap}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 disabled:opacity-50"
              />
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                placeholder="Paste the content you want the agent to answer from..."
                disabled={busy || atCap}
                className="scroll-thin w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => void addText()}
                disabled={busy || atCap || !text.trim()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-40"
              >
                {busy ? "Indexing..." : "Index text"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------ document list --------------------------- */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Indexed documents</h2>
          <span className="text-xs text-slate-400">
            Embedding model: <code>{embeddingsModel}</code>
          </span>
        </div>

        {loading ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">Loading...</p>
        ) : documents.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">
            Nothing indexed yet. Add a document above and this agent will start citing it.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-start justify-between gap-4 px-5 py-3.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-slate-800">{doc.title}</span>
                    <StatusPill status={doc.status} />
                    <span className="text-xs text-slate-400">{doc.source_type}</span>
                  </div>

                  <p className="mt-1 text-xs text-slate-500">
                    {doc.status === "ready"
                      ? `${doc.chunk_count} chunks · ${doc.char_count.toLocaleString()} characters`
                      : doc.error || "Processing..."}
                  </p>

                  {doc.source_ref && doc.source_type === "url" && (
                    <a
                      href={doc.source_ref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block truncate text-xs text-indigo-600 hover:underline"
                    >
                      {doc.source_ref}
                    </a>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => void remove(doc.id)}
                  className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ready: "bg-emerald-100 text-emerald-700",
    pending: "bg-amber-100 text-amber-800",
    error: "bg-rose-100 text-rose-700",
  };
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
        styles[status] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {status}
    </span>
  );
}
