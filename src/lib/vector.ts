/**
 * Vector helpers for retrieval.
 *
 * Deliberately dependency-free and free of `server-only`, so the similarity math
 * that retrieval quality depends on can be unit-tested directly.
 */

/** Scale a vector to unit length so cosine similarity becomes a dot product. */
export function normalize(vec: readonly number[]): number[] {
  let sum = 0;
  for (const v of vec) sum += v * v;
  const norm = Math.sqrt(sum);
  // A zero vector has no direction; return it unchanged rather than NaN.
  if (!norm || !Number.isFinite(norm)) return vec.slice();
  return vec.map((v) => v / norm);
}

/** Dot product. Equal to cosine similarity when both inputs are normalised. */
export function dot(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) sum += a[i] * b[i];
  return sum;
}

/** Pack a float vector into a BLOB for SQLite. */
export function encodeVector(vec: readonly number[]): Uint8Array {
  return new Uint8Array(new Float32Array(vec).buffer);
}

/**
 * Unpack a BLOB back into a Float32Array.
 *
 * The bytes are copied into a freshly allocated buffer: SQLite does not
 * guarantee the alignment Float32Array requires, and a misaligned view throws.
 */
export function decodeVector(blob: unknown): Float32Array {
  if (blob instanceof Uint8Array) {
    const copy = new Uint8Array(blob.byteLength);
    copy.set(blob);
    return new Float32Array(copy.buffer);
  }
  return new Float32Array(0);
}

export interface Ranked<T> {
  item: T;
  score: number;
}

/**
 * Rank candidate vectors against a query vector, highest score first.
 *
 * Vectors whose length differs from the query are skipped: that means the
 * embedding model changed, and comparing across dimensions is meaningless.
 */
export function rankBySimilarity<T>(
  query: ArrayLike<number>,
  candidates: { item: T; vector: ArrayLike<number> }[],
): Ranked<T>[] {
  const scored: Ranked<T>[] = [];
  for (const candidate of candidates) {
    if (candidate.vector.length !== query.length) continue;
    scored.push({ item: candidate.item, score: dot(query, candidate.vector) });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored;
}
