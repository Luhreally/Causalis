import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, loadWorld, rulesetId, saveWorld, type Seed } from "../../src/kernel/index.ts";
import { MemoryByteStore, SaveSlots, decodeSave, encodeSave } from "../../src/host/index.ts";
import { makeToyWorld } from "../fixtures/toy.ts";

const build = (seed: Seed) => makeToyWorld(seed.text);

test("a save compresses and decodes to the same document", async () => {
  const w = makeToyWorld("bytes");
  w.runTo(20 * YEAR);
  const doc = saveWorld(w, rulesetId(w, "test"), { name: "bytes" });
  const bytes = await encodeSave(doc);
  const json = JSON.stringify(doc).length;
  assert.ok(bytes.length < json / 2, `gzip ${bytes.length} of ${json}`);
  assert.deepEqual(await decodeSave(bytes), JSON.parse(JSON.stringify(doc)));
});

test("slots alternate, and a damaged latest save falls back to the one before", async () => {
  const store = new MemoryByteStore(),
    slots = new SaveSlots(store, "main"),
    w = makeToyWorld("slots"),
    ruleset = rulesetId(w, "test");
  w.runTo(5 * YEAR);
  await slots.write(saveWorld(w, ruleset));
  const early = w.domainHashes();
  w.runTo(9 * YEAR);
  await slots.write(saveWorld(w, ruleset));
  const late = w.domainHashes();
  const load = (doc: Parameters<typeof loadWorld>[0]) => loadWorld(doc, build, ruleset).world;
  const first = await slots.read(load);
  assert.equal(first?.fellBack, false);
  assert.deepEqual(first?.value.domainHashes(), late);
  // Damage the latest slot's bytes.
  const latestKey = (await store.keys()).find((k) => k.endsWith(`/${first!.slot}`))!;
  const bytes = (await store.get(latestKey))!;
  const at = bytes.length >> 1;
  bytes[at] = bytes[at]! ^ 0xff;
  await store.put(latestKey, bytes);
  const second = await slots.read(load);
  assert.equal(second?.fellBack, true);
  assert.deepEqual(second?.value.domainHashes(), early);
  await slots.remove();
  assert.equal(await slots.read(load), null);
});
