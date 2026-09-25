import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { kernelDigest, kernelVectors } from "../vectors/kernel.ts";

test("the kernel matches its golden vectors bit for bit", () => {
  const golden = JSON.parse(
    readFileSync(new URL("../golden/kernel.json", import.meta.url), "utf8"),
  ) as {
    digest: string;
    vectors: [string, string][];
  };
  const vectors = kernelVectors();
  assert.equal(vectors.length, golden.vectors.length, "vector count");
  for (let i = 0; i < vectors.length; i++)
    assert.deepEqual(vectors[i], golden.vectors[i], `vector ${i}`);
  assert.equal(kernelDigest(vectors), golden.digest);
});
