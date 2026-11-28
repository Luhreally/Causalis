import { test } from "node:test";
import assert from "node:assert/strict";
import {
  YEAR,
  joinJson,
  jsonCopy,
  loadWorld,
  rulesetId,
  saveWorld,
  splitJson,
  type Seed,
} from "../../src/kernel/index.ts";
import {
  MemoryByteStore,
  SaveSlots,
  decodeSave,
  encodeSave,
  listSaves,
} from "../../src/host/index.ts";
import { makeToyWorld } from "../../src/sim/index.ts";

const build = (seed: Seed) => makeToyWorld(seed.text);

test("a save compresses and decodes to the same document", async () => {
  const w = makeToyWorld("bytes");
  w.runTo(20 * YEAR);
  const doc = saveWorld(w, rulesetId(w, "test"), { name: "bytes" });
  const bytes = await encodeSave(doc);
  const json = JSON.stringify(doc).length;
  assert.ok(bytes.length < json / 2, `gzip ${bytes.length} of ${json}`);
  assert.deepEqual(await decodeSave(bytes), JSON.parse(JSON.stringify(doc)));
  // (And as text, as a server may hand on a file named for its gzip with the gzip taken off.)
  assert.deepEqual(
    await decodeSave(new TextEncoder().encode(JSON.stringify(doc))),
    JSON.parse(JSON.stringify(doc)),
  );
  await assert.rejects(decodeSave(new TextEncoder().encode("{ not a save")), /not a save document/);
  await assert.rejects(decodeSave(bytes.subarray(0, bytes.length >> 1)), /do not decompress/);
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

test("the saves kept are listed with their world, time and size", async () => {
  const store = new MemoryByteStore(),
    w = makeToyWorld("listed"),
    ruleset = rulesetId(w, "test");
  w.runTo(3 * YEAR);
  await new SaveSlots(store, "toy:listed").write(saveWorld(w, ruleset, { universe: "toy" }));
  w.runTo(7 * YEAR);
  await new SaveSlots(store, "toy:listed:auto").write(saveWorld(w, ruleset, { universe: "toy" }));
  await store.put("save/broken/index", new TextEncoder().encode("{not json"));
  const saves = await listSaves(store);
  assert.deepEqual(saves.map((s) => s.name).sort(), ["toy:listed", "toy:listed:auto"]);
  const auto = saves.find((s) => s.name.endsWith(":auto"))!;
  assert.equal(auto.t, 7 * YEAR);
  assert.equal(auto.universe, "toy");
  assert.equal(auto.seed, "listed");
  assert.ok(auto.bytes > 0 && auto.rulesets === 1 && auto.count === 1);
});

// 2026-11-13: a world of 162 million people could not be kept, "Invalid string length": its save as one text was
// longer than an engine's longest string. A save too long for one text is written in pieces and read back the same.
test("a save too long for one text is written in pieces and reads back the same, its keys in their order", async () => {
  const w = makeToyWorld("pieces");
  w.runTo(20 * YEAR);
  const doc = saveWorld(w, rulesetId(w, "test"), { name: "pieces" }),
    whole = JSON.parse(JSON.stringify(doc)) as typeof doc,
    text = JSON.stringify(doc);
  for (const most of [64, 300, 2000, text.length >> 2]) {
    const bytes = await encodeSave(doc, most),
      back = await decodeSave(bytes);
    assert.deepEqual(back, whole, `pieces of ${most}`);
    // (Deep equality does not look at the order of keys; the text does.)
    assert.equal(JSON.stringify(back), text, `keys out of their order at ${most}`);
    assert.deepEqual(
      loadWorld(back, build, rulesetId(w, "test")).world.domainHashes(),
      w.domainHashes(),
    );
  }
  assert.deepEqual(await decodeSave(await encodeSave(doc, text.length)), whole);
});

test("split JSON keeps what JSON keeps: holes, nulls, nesting, long runs", async () => {
  const value = {
    a: [1, null, undefined, "x".repeat(50), { deep: [[], {}, [1, 2, [3, { z: "end" }]]] }],
    skipped: undefined,
    run: Array.from({ length: 500 }, (_, i) => ({ i, s: `row ${i}` })),
    "odd key\n": { "": 0, " ": [true, false] },
    n: [Number.NaN, 1e300, -0],
  };
  for (const most of [16, 40, 100, 1000, 1e9]) {
    const texts: string[] = [];
    await splitJson(value, (t) => void texts.push(t), most);
    assert.equal(JSON.stringify(joinJson(texts)), JSON.stringify(value), `at ${most}`);
    if (most >= 1000 && most < 1e9)
      assert.ok(
        Math.max(...texts.map((t) => t.length)) <= most + 200,
        `a piece too long at ${most}`,
      );
  }
  assert.deepEqual(jsonCopy(value), JSON.parse(JSON.stringify(value)));
});

// A save in one text is written a store at a time (a far world's text is hundreds of megabytes: never one string):
// the bytes are of the very text JSON.stringify writes, so a save written before reads as one written now.
test("a save in one text is the text JSON writes of it, store by store", async () => {
  const { gunzipSync } = await import("node:zlib");
  const w = makeToyWorld("one text");
  w.runTo(20 * YEAR);
  const doc = saveWorld(w, rulesetId(w, "test"), { name: "one text", gone: undefined });
  const text = (d: unknown) => JSON.stringify(d);
  for (const d of [
    doc,
    { ...doc, stores: {} },
    {
      ...doc,
      stores: { ...doc.stores, 'odd "name"\n': { schema: 1, data: [undefined], hash: "" } },
    },
    {},
  ] as (typeof doc)[]) {
    const bytes = await encodeSave(d);
    assert.equal(gunzipSync(bytes).toString("utf8"), text(d));
    assert.deepEqual(await decodeSave(bytes), JSON.parse(text(d)));
  }
  // (Exactly as long as `most` is one text still; a character longer, pieces.)
  const exact = await encodeSave(doc, text(doc).length),
    over = await encodeSave(doc, text(doc).length - 1);
  assert.equal(gunzipSync(exact).toString("utf8"), text(doc));
  assert.ok(gunzipSync(over).toString("utf8").startsWith("CAUSALIS-SPLIT 1\n"));
  assert.equal(JSON.stringify(await decodeSave(over)), text(doc));
});

test("a world's towns are kept apart from its save, written again only when they have changed, and read back where they were", async () => {
  const store = new MemoryByteStore(),
    slots = new SaveSlots(store, "towns"),
    w = makeToyWorld("towns"),
    ruleset = rulesetId(w, "test");
  w.runTo(3 * YEAR);
  const base = saveWorld(w, ruleset),
    towns = {
      schema: 1,
      data: { places: [{ town: "s:1", people: [1, 2, 3] }] },
      hash: "h1",
      outside: true as const,
    },
    withTowns = (doc: typeof base, chunk: typeof towns) =>
      ({ ...doc, stores: { ...doc.stores, "readings.places": chunk } }) as typeof base;
  await slots.write(withTowns(base, towns));
  const keys = (await store.keys()).filter((k) => k.includes("towns-"));
  assert.deepEqual(keys, ["save/towns/towns-h1"]);
  // The slot itself holds none of them.
  const slot = (await decodeSave((await store.get("save/towns/a"))!)).stores["readings.places"] as {
    data: unknown;
  };
  assert.equal(slot.data, null);
  // Saved again with the same towns: none written again; with others, the old let go once no slot names them.
  await slots.write(withTowns(base, towns));
  assert.deepEqual(
    (await store.keys()).filter((k) => k.includes("towns-")),
    ["save/towns/towns-h1"],
  );
  const other = { ...towns, data: { places: [] }, hash: "h2" };
  await slots.write(withTowns(base, other));
  await slots.write(withTowns(base, other));
  assert.deepEqual(
    (await store.keys()).filter((k) => k.includes("towns-")),
    ["save/towns/towns-h2"],
  );
  // Read back: put where they were.
  const got = await slots.read((doc) => doc);
  assert.deepEqual(got?.value.stores["readings.places"], JSON.parse(JSON.stringify(other)));
  // Their bytes lost: the save reads without them.
  await store.delete("save/towns/towns-h2");
  const bare = await slots.read((doc) => doc);
  assert.equal(bare?.value.stores["readings.places"], undefined);
  await slots.remove();
  assert.deepEqual(await store.keys(), []);
});
