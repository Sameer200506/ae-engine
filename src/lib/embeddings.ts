import "server-only";

import { normalize } from "./vector";

/**
 * Embeddings for the knowledge base.
 *
 * Default is OpenRouter's free embedding models, so indexing costs nothing.
 * Switch to OpenAI with EMBEDDINGS_PROVIDER=openai when you need throughput
 * (free embedding models share the platform's 20/min and 50/day free caps).
 *
 * Vectors are L2-normalised on the way in, so cosine similarity reduces to a
 * dot product at query time.
 */

export type EmbeddingProvider = "openrouter" | "openai" | "none";

export function embeddingProvider(): EmbeddingProvider {
  const raw = (process.env.EMBEDDINGS_PROVIDER || "openrouter").toLowerCase();
  if (raw === "openai" || raw === "none") return raw;
  return "openrouter";
}

export function embeddingModel(): string {
  if (embeddingProvider() === "openai") {
    return process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
  }
  return process.env.OPENROUTER_EMBEDDING_MODEL || "nvidia/nemotron-3-embed-1b:free";
}

export function embeddingsEnabled(): boolean {
  const provider = embeddingProvider();
  if (provider === "none") return false;
  if (provider === "openai") return Boolean(process.env.OPENAI_API_KEY);
  return Boolean(process.env.OPENROUTER_API_KEY || process.env.LLM_API_KEY);
}

export function embeddingsUnavailableReason(): string {
  switch (embeddingProvider()) {
    case "none":
      return "Knowledge-base indexing is disabled (EMBEDDINGS_PROVIDER=none).";
    case "openai":
      return "OPENAI_API_KEY is not set, so documents cannot be indexed.";
    default:
      return "OPENROUTER_API_KEY is not set, so documents cannot be indexed.";
  }
}

const BATCH_SIZE = 32;

function endpoint(): { url: string; key: string } {
  if (embeddingProvider() === "openai") {
    return {
      url: `${(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")}/embeddings`,
      key: process.env.OPENAI_API_KEY ?? "",
    };
  }
  const base = (process.env.LLM_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");
  return { url: `${base}/embeddings`, key: process.env.OPENROUTER_API_KEY || process.env.LLM_API_KEY || "" };
}

async function embedBatch(inputs: string[]): Promise<number[][]> {
  const { url, key } = endpoint();
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: embeddingModel(), input: inputs }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    let detail = body.slice(0, 300);
    try {
      detail = JSON.parse(body)?.error?.message ?? detail;
    } catch {
      /* keep raw */
    }
    throw new Error(`Embedding request failed (HTTP ${response.status}). ${detail}`);
  }

  const json = (await response.json()) as {
    data?: { embedding: number[] | string; index?: number }[];
  };
  const rows = json.data ?? [];
  if (!rows.length) throw new Error("Embedding provider returned no vectors.");

  // Preserve input order; some providers return an unordered `index`.
  const ordered = rows.slice().sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return ordered.map((row) => {
    if (typeof row.embedding === "string") {
      return normalize(Array.from(decodeBase64Float32(row.embedding)));
    }
    return normalize(row.embedding);
  });
}

function decodeBase64Float32(b64: string): Float32Array {
  const buf = Buffer.from(b64, "base64");
  const copy = new Uint8Array(buf.byteLength);
  copy.set(buf);
  return new Float32Array(copy.buffer);
}

/** Embed many texts, batching to stay inside provider payload limits. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const slice = texts.slice(i, i + BATCH_SIZE).map((t) => t.slice(0, 8000));
    out.push(...(await embedBatch(slice)));
  }
  return out;
}

export async function embedQuery(text: string): Promise<number[] | null> {
  if (!embeddingsEnabled()) return null;
  try {
    const [vec] = await embedTexts([text]);
    return vec ?? null;
  } catch {
    // A failed query embedding should degrade to "no context", not a 500.
    return null;
  }
}

// Similarity math lives in ./vector (dependency-free, unit-tested).
export { dot, normalize } from "./vector";
