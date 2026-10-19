import assert from "node:assert/strict";
import { test } from "node:test";
import {
  chunkText,
  estimateTokens,
  MIN_CHUNK_CHARS,
  OVERLAP_CHARS,
  TARGET_CHARS,
} from "../src/lib/chunk.ts";

test("keeps a short note instead of dropping it", () => {
  const chunks = chunkText("AEO Engine is a lean agent platform.");
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0], "AEO Engine is a lean agent platform.");
});

test("returns nothing for whitespace-only input", () => {
  assert.deepEqual(chunkText("   \n\n  \t "), []);
});

test("joins short paragraphs into one chunk", () => {
  const text = ["First point about pricing.", "Second point about limits.", "Third point about setup."].join(
    "\n\n",
  );
  const chunks = chunkText(text);
  assert.equal(chunks.length, 1);
  assert.ok(chunks[0].includes("Third point"));
});

test("splits long input into multiple chunks, all within a sane size", () => {
  const paragraph = "Lorem ipsum dolor sit amet consectetur adipiscing elit. ".repeat(60);
  const text = Array.from({ length: 40 }, (_, i) => `Section ${i}. ${paragraph}`).join("\n\n");
  const chunks = chunkText(text);

  assert.ok(chunks.length > 1, "expected multiple chunks");
  for (const chunk of chunks) {
    // Chunks may slightly exceed the target when a single paragraph is long,
    // but must never balloon past the hard-split ceiling.
    assert.ok(chunk.length <= TARGET_CHARS + OVERLAP_CHARS + 60, `chunk too large: ${chunk.length}`);
  }
});

test("does not split mid-paragraph when paragraphs fit", () => {
  const para = "x".repeat(TARGET_CHARS - 100);
  const chunks = chunkText(`${para}\n\n${para}`);
  // Two paragraphs that together exceed the target should produce two chunks,
  // each containing a whole paragraph plus overlap.
  assert.ok(chunks.length >= 2);
  for (const chunk of chunks) {
    assert.ok(chunk.includes(para.slice(0, 50)));
  }
});

test("overlaps consecutive chunks so boundary answers survive", () => {
  const head = "A".repeat(TARGET_CHARS);
  const tail = "B".repeat(TARGET_CHARS);
  const chunks = chunkText(`${head}\n\n${tail}`);
  assert.ok(chunks.length >= 2);
  // The second chunk should begin with the tail of the first, not the second
  // paragraph directly.
  assert.ok(chunks[1].startsWith("A".repeat(OVERLAP_CHARS)));
});

test("hard-splits a single oversized paragraph", () => {
  const monster = "word ".repeat(1000); // ~5k chars, one paragraph
  const chunks = chunkText(monster);
  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    assert.ok(chunk.length >= MIN_CHUNK_CHARS);
  }
});

test("folds a tiny trailing fragment into the previous chunk", () => {
  const big = "S".repeat(TARGET_CHARS);
  const tiny = "tiny.";
  const chunks = chunkText(`${big}\n\n${tiny}`);
  assert.ok(!chunks.some((c) => c === tiny), "tiny fragment should be merged, not standalone");
});

test("estimateTokens approximates four characters per token", () => {
  assert.equal(estimateTokens(""), 0);
  assert.equal(estimateTokens("abcd"), 1);
  assert.equal(estimateTokens("a".repeat(400)), 100);
});
