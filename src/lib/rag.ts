import "server-only";

import { chunkText } from "./chunk";
import { all, get, now, run, uid } from "./db";
import {
  embedQuery,
  embedTexts,
  embeddingModel,
  embeddingsEnabled,
  embeddingsUnavailableReason,
} from "./embeddings";
import { extractFromFile, extractFromUrl, type ExtractionError } from "./extract";
import { decodeVector, encodeVector, rankBySimilarity } from "./vector";

/* --------------------------------- ingestion ------------------------------- */

export interface IngestResult {
  documentId: string;
  chunks: number;
  chars: number;
}

function fail(documentId: string, message: string): void {
  run("UPDATE documents SET status = 'error', error = ? WHERE id = ?", [
    message.slice(0, 500),
    documentId,
  ]);
}

/**
 * Index a document into an agent's knowledge base.
 *
 * The row is created before embedding so a failure is visible in the UI instead
 * of silently vanishing; on error the document is marked `error` with the reason.
 */
export async function ingest(opts: {
  agentId: string;
  userId: string;
  title: string;
  sourceType: "file" | "url" | "text";
  sourceRef?: string | null;
  text: string;
  documentId?: string;
}): Promise<IngestResult> {
  const documentId = opts.documentId ?? uid("doc_");
  const chunks = chunkText(opts.text);

  if (!opts.documentId) {
    run(
      `INSERT INTO documents (id, agent_id, user_id, title, source_type, source_ref, status, char_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        documentId,
        opts.agentId,
        opts.userId,
        opts.title,
        opts.sourceType,
        opts.sourceRef ?? null,
        opts.text.length,
        now(),
      ],
    );
  } else {
    run(
      `UPDATE documents SET title = ?, status = 'pending', error = NULL, char_count = ?, chunk_count = 0 WHERE id = ?`,
      [opts.title, opts.text.length, documentId],
    );
    run("DELETE FROM chunks WHERE document_id = ?", [documentId]);
  }

  // Check configuration before content: a missing API key is the more
  // actionable error and should not be masked by a chunking complaint.
  if (!embeddingsEnabled()) {
    fail(documentId, embeddingsUnavailableReason());
    throw new Error(embeddingsUnavailableReason());
  }

  if (!chunks.length) {
    fail(documentId, "No indexable text found in this document.");
    throw new Error("No indexable text found in this document.");
  }

  try {
    const vectors = await embedTexts(chunks);
    const model = embeddingModel();

    for (let i = 0; i < chunks.length; i++) {
      const vec = vectors[i];
      run(
        `INSERT INTO chunks (id, document_id, agent_id, ord, content, embedding, dim)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uid("chk_"), documentId, opts.agentId, i, chunks[i], encodeVector(vec), vec.length],
      );
    }

    run(
      `UPDATE documents SET status = 'ready', error = NULL, chunk_count = ?, embedding_model = ? WHERE id = ?`,
      [chunks.length, model, documentId],
    );
    return { documentId, chunks: chunks.length, chars: opts.text.length };
  } catch (error) {
    fail(documentId, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/** Ingest a page from a URL, recording its title. */
export async function ingestUrl(
  agentId: string,
  userId: string,
  url: string,
): Promise<IngestResult> {
  const { text, title } = await extractFromUrl(url);
  return ingest({ agentId, userId, title, sourceType: "url", sourceRef: url, text });
}

/** Ingest an uploaded file. */
export async function ingestFile(
  agentId: string,
  userId: string,
  filename: string,
  bytes: Uint8Array,
): Promise<IngestResult> {
  const text = await extractFromFile(filename, bytes);
  return ingest({ agentId, userId, title: filename, sourceType: "file", sourceRef: filename, text });
}

/* ---------------------------------- search -------------------------------- */

export interface RetrievedChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  content: string;
  score: number;
}

/** Minimum cosine similarity for a chunk to count as a real match. */
const MIN_SCORE = 0.18;

interface ChunkRow {
  id: string;
  document_id: string;
  content: string;
  embedding: Uint8Array | null;
  dim: number;
  title: string;
}

/**
 * Top-k similarity search over one agent's chunks.
 *
 * Brute-force cosine in JS is intentional at this scale: a few thousand chunks
 * scan in single-digit milliseconds and it removes an entire vector-database
 * dependency. Swap in pgvector or sqlite-vec when a knowledge base outgrows RAM.
 */
export async function retrieve(agentId: string, query: string, k = 5): Promise<RetrievedChunk[]> {
  if (!embeddingsEnabled()) return [];

  const queryVec = await embedQuery(query);
  if (!queryVec?.length) return [];

  const typed = new Float32Array(queryVec);

  // The dim filter is an optimisation, not a correctness requirement:
  // rankBySimilarity also skips mismatched dimensions so a changed embedding
  // model cannot produce nonsense scores.
  const rows = all<ChunkRow>(
    `SELECT c.id, c.document_id, c.content, c.embedding, c.dim, d.title
       FROM chunks c
       JOIN documents d ON d.id = c.document_id
      WHERE c.agent_id = ? AND c.dim = ? AND d.status = 'ready'`,
    [agentId, typed.length],
  );

  const scored: RetrievedChunk[] = rankBySimilarity(
    typed,
    rows.map((row) => ({ item: row, vector: decodeVector(row.embedding) })),
  ).map(({ item, score }) => ({
    id: item.id,
    documentId: item.document_id,
    documentTitle: item.title,
    content: item.content,
    score,
  }));

  // Drop weak matches so an off-topic question is not force-fed context.
  const strong = scored.filter((c) => c.score >= MIN_SCORE);
  return (strong.length ? strong : scored).slice(0, k);
}

/** Build the retrieved-context block injected into the system prompt. */
export function buildContextBlock(chunks: RetrievedChunk[]): string {
  if (!chunks.length) return "";
  const body = chunks
    .map((c, i) => `[${i + 1}] Source: ${c.documentTitle}\n${c.content}`)
    .join("\n\n---\n\n");

  return `\n\n<knowledge_base>\nThe following excerpts were retrieved from the user's knowledge base. Use them when they are relevant. Cite them inline as [1], [2] and so on. If they do not answer the question, say so plainly and answer from general knowledge, making clear that you are doing so.\n\n${body}\n</knowledge_base>`;
}

/* ------------------------------- agent-scoped ------------------------------ */

export function listDocuments(agentId: string) {
  return all<{
    id: string;
    title: string;
    source_type: string;
    source_ref: string | null;
    status: string;
    error: string | null;
    char_count: number;
    chunk_count: number;
    created_at: number;
  }>(
    `SELECT id, title, source_type, source_ref, status, error, char_count, chunk_count, created_at
       FROM documents WHERE agent_id = ? ORDER BY created_at DESC`,
    [agentId],
  );
}

export function countDocuments(userId: string): number {
  return (
    get<{ c: number }>("SELECT COUNT(*) AS c FROM documents WHERE user_id = ?", [userId])?.c ?? 0
  );
}

export type { ExtractionError };
