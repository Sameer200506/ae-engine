import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decodeVector,
  dot,
  encodeVector,
  normalize,
  rankBySimilarity,
} from "../src/lib/vector.ts";

test("normalize produces a unit vector", () => {
  const v = normalize([3, 4]);
  assert.ok(Math.abs(v[0] - 0.6) < 1e-9);
  assert.ok(Math.abs(v[1] - 0.8) < 1e-9);
  assert.ok(Math.abs(dot(v, v) - 1) < 1e-9);
});

test("normalize leaves the zero vector finite", () => {
  const v = normalize([0, 0, 0]);
  assert.deepEqual(v, [0, 0, 0]);
  assert.ok(v.every((n) => Number.isFinite(n)));
});

test("normalized dot product behaves as cosine similarity", () => {
  const a = normalize([1, 0]);
  const b = normalize([1, 1]);
  const c = normalize([-1, 0]);

  assert.ok(Math.abs(dot(a, b) - Math.SQRT1_2) < 1e-9);
  assert.ok(Math.abs(dot(a, c) + 1) < 1e-9);
  assert.ok(Math.abs(dot(a, a) - 1) < 1e-9);
});

test("encode/decode round-trips a vector losslessly", () => {
  const original = [0.25, -1.5, 3.75, 0];
  const decoded = decodeVector(encodeVector(original));

  assert.equal(decoded.length, original.length);
  original.forEach((value, i) => {
    assert.ok(Math.abs(decoded[i] - value) < 1e-6, `mismatch at ${i}`);
  });
});

test("decodeVector tolerates non-blob input", () => {
  assert.equal(decodeVector(null).length, 0);
  assert.equal(decodeVector(undefined).length, 0);
  assert.equal(decodeVector("nope").length, 0);
});

test("decodeVector reads from a misaligned byte offset", () => {
  // Regression guard: SQLite does not guarantee 4-byte alignment, and a
  // misaligned Float32Array view throws. Subarraying produces such a view.
  const source = encodeVector([1, 2, 3]);
  const offset = new Uint8Array(source.byteLength + 1);
  offset.set(source, 1);
  const misaligned = offset.subarray(1);

  const decoded = decodeVector(misaligned);
  assert.equal(decoded.length, 3);
  assert.ok(Math.abs(decoded[0] - 1) < 1e-6);
  assert.ok(Math.abs(decoded[2] - 3) < 1e-6);
});

test("rankBySimilarity orders candidates by score", () => {
  const query = normalize([1, 0, 0]);
  const ranked = rankBySimilarity(query, [
    { item: "orthogonal", vector: normalize([0, 1, 0]) },
    { item: "aligned", vector: normalize([1, 0, 0]) },
    { item: "opposite", vector: normalize([-1, 0, 0]) },
    { item: "partial", vector: normalize([1, 0.5, 0]) },
  ]);

  assert.deepEqual(
    ranked.map((r) => r.item),
    ["aligned", "partial", "orthogonal", "opposite"],
  );
});

test("rankBySimilarity skips vectors of the wrong dimension", () => {
  // Guards the case where the embedding model was changed after indexing.
  const ranked = rankBySimilarity(normalize([1, 0]), [
    { item: "wrong-dim", vector: normalize([1, 0, 0]) },
    { item: "right-dim", vector: normalize([1, 0]) },
  ]);

  assert.deepEqual(
    ranked.map((r) => r.item),
    ["right-dim"],
  );
});
