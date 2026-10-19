/**
 * Text chunking for retrieval.
 *
 * Dependency-free so it can be unit-tested directly — chunk boundaries are the
 * single biggest lever on retrieval quality, and they are easy to get subtly
 * wrong (dropping a short document, or splitting mid-thought).
 */

export const TARGET_CHARS = 1200;
export const OVERLAP_CHARS = 150;
export const MIN_CHUNK_CHARS = 80;

/**
 * Split text into overlapping chunks on paragraph boundaries.
 *
 * Overlap matters: answers often straddle a boundary, and without it the
 * retrieved chunk reads as a truncated thought.
 */
export function chunkText(text: string): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    const trimmed = current.trim();
    if (trimmed.length >= MIN_CHUNK_CHARS) chunks.push(trimmed);
    current = "";
  };

  for (const paragraph of paragraphs) {
    // A single paragraph longer than the target is hard-split with overlap.
    if (paragraph.length > TARGET_CHARS * 1.5) {
      flush();
      let start = 0;
      while (start < paragraph.length) {
        const end = Math.min(start + TARGET_CHARS, paragraph.length);
        const slice = paragraph.slice(start, end).trim();
        if (slice.length >= MIN_CHUNK_CHARS) chunks.push(slice);
        if (end === paragraph.length) break;
        start = end - OVERLAP_CHARS;
      }
      continue;
    }

    if ((current + "\n\n" + paragraph).length > TARGET_CHARS && current) {
      const tail = current.slice(-OVERLAP_CHARS);
      flush();
      current = `${tail}\n\n${paragraph}`;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }
  flush();

  // Fold a tiny trailing chunk into its predecessor rather than indexing noise.
  if (chunks.length > 1 && chunks[chunks.length - 1].length < MIN_CHUNK_CHARS) {
    const last = chunks.pop()!;
    chunks[chunks.length - 1] += `\n\n${last}`;
  }

  // A short note is still worth indexing. The minimum-length filter exists to
  // drop noisy fragments, not to reject a deliberate one-liner, so keep the
  // whole text when nothing else survived.
  if (!chunks.length) {
    const whole = text.trim();
    if (whole) chunks.push(whole);
  }

  return chunks;
}

/** Rough token estimate. Good enough to size a history window without a tokenizer. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
