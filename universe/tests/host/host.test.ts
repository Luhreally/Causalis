import { test } from "node:test";
import assert from "node:assert/strict";
import { DAY, YEAR } from "../../src/kernel/index.ts";
import { makeToyWorld } from "../../src/sim/index.ts";
import type { FrameMessage } from "../../src/bridge/index.ts";
import type { WhyNode } from "../../src/host/index.ts";
import { rig } from "./harness.ts";

test("a universe started through the host is the same world as one built directly", async () => {
  const r = rig();
  await r.settle(r.client.start("sandbox", "alpha"));
  await r.settle(r.client.advance(6 * YEAR));
  const direct = makeToyWorld("alpha");
  direct.runTo(6 * YEAR);
  assert.deepEqual(await r.settle(r.client.query({ type: "hashes" })), direct.domainHashes());
});

test("looking never changes history: queries, subscriptions, interest and frames are pure", async () => {
  const quiet = rig(),
    busy = rig();
  await quiet.settle(quiet.client.start("sandbox", "purity"));
  await busy.settle(busy.client.start("sandbox", "purity"));
  const updates: unknown[] = [];
  busy.client.subscribe({ type: "summary" }, 50, (v) => updates.push(v));
  busy.client.subscribe({ type: "cell", args: { cell: 3 } }, 50, () => {});
  let t = 0;
  for (let step = 0; step < 40; step++) {
    t += (1 + ((step * 7919) % 23)) * DAY * 9;
    await quiet.settle(quiet.client.advance(t));
    busy.client.setInterest({ view: "ring", focus: step % 3 ? null : `tcell:0:${step % 16}` });
    await busy.settle(busy.client.advance(t));
    await busy.tick(120);
    const events = await busy.settle(
      busy.client.query<{ id: string }[]>({ type: "events.recent", args: { n: 5 } }),
    );
    if (events.length)
      await busy.settle(busy.client.query({ type: "why", args: { ref: events[0]!.id, depth: 4 } }));
    await busy.settle(busy.client.query({ type: "cell", args: { cell: step % 16 } }));
    if (step % 10 === 0) await busy.settle(busy.client.exportSave());
  }
  assert.ok(updates.length > 3, "subscriptions delivered");
  assert.deepEqual(
    await busy.settle(busy.client.query({ type: "checkpoints" })),
    await quiet.settle(quiet.client.query({ type: "checkpoints" })),
  );
});

test("commands go through the host, are stamped, logged and explained", async () => {
  const r = rig();
  await r.settle(r.client.start("sandbox", "acts"));
  await r.settle(r.client.advance(YEAR));
  const receipt = await r.settle(r.client.command("toy.bless", { cell: 2, people: 50 }));
  assert.equal(receipt.t, YEAR + 1);
  await assert.rejects(r.settle(r.client.command("toy.bless", { cell: 99 })), /cell/);
  await r.settle(r.client.advance(YEAR + 2));
  const events = await r.settle(
    r.client.query<{ id: string; type: string }[]>({ type: "events.recent", args: { n: 50 } }),
  );
  const blessing = events.find((e) => e.type === "toy.blessing")!;
  const tree = await r.settle(
    r.client.query<WhyNode>({ type: "why", args: { ref: blessing.id, depth: 1 } }),
  );
  assert.equal(tree.causes[0]!.ref, receipt.id);
  assert.equal(tree.causes[0]!.node!.basis, "command");
});

test("saves round-trip through slots and through exported bytes", async () => {
  const r = rig();
  await r.settle(r.client.start("sandbox", "keep"));
  await r.settle(r.client.advance(3 * YEAR));
  await r.settle(r.client.save("main"));
  const saved = await r.settle(r.client.query({ type: "hashes" }));
  const bytes = await r.settle(r.client.exportSave());
  await r.settle(r.client.advance(7 * YEAR));
  const later = await r.settle(r.client.query({ type: "hashes" }));
  assert.notDeepEqual(later, saved);
  const loaded = await r.settle(r.client.load("main"));
  assert.equal(loaded.t, 3 * YEAR);
  assert.deepEqual(await r.settle(r.client.query({ type: "hashes" })), saved);
  await r.settle(r.client.advance(7 * YEAR));
  assert.deepEqual(
    await r.settle(r.client.query({ type: "hashes" })),
    later,
    "a loaded save continues identically",
  );
  const other = rig();
  await other.settle(other.client.start("sandbox", "something else"));
  await other.settle(other.client.importSave(bytes));
  assert.deepEqual(await other.settle(other.client.query({ type: "hashes" })), saved);
});

test("frames carry the view's arrays, and speed follows the clock", async () => {
  const r = rig(),
    frames: FrameMessage[] = [];
  r.client.onFrame((f) => frames.push(f));
  await r.settle(r.client.start("sandbox", "frames"));
  r.client.setSpeed(DAY); // one day per second
  for (let i = 0; i < 20; i++) await r.tick(250);
  const t = (await r.settle(r.client.query<{ t: number }>({ type: "now" }))).t;
  assert.ok(t >= 4 * DAY && t <= 6 * DAY, `five seconds at a day a second reached ${t / DAY} days`);
  const last = frames.at(-1)!;
  assert.equal(last.view, "ring");
  assert.equal(last.arrays.people!.length, 48);
  assert.equal(last.arrays.prices!.length, 16);
  assert.ok(frames.length >= 5);
  assert.ok(r.client.status && r.client.status.speed === DAY);
  r.client.setSpeed(0);
  await r.tick(1000);
  const paused = (await r.settle(r.client.query<{ t: number }>({ type: "now" }))).t;
  await r.tick(5000);
  assert.equal((await r.settle(r.client.query<{ t: number }>({ type: "now" }))).t, paused);
});
