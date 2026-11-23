// Who may leave a realm and who may come in (rules/borders.ts): read from the Domar gain, the arms that hold, a say, and strangers
// among a narrow "us"; never a named people.
import { test } from "node:test";
import assert from "node:assert/strict";
import { entryBar, exitBar, gateBand, gatesOpen, type GateRead } from "../../src/rules/index.ts";

const at = (x: Partial<GateRead>): GateRead => ({
  gain: 0,
  hold: 0,
  voice: 0.5,
  strangers: 0,
  nation: 0.5,
  force: 0.5,
  word: 1,
  ...x,
});

test("a seat bars leaving where hands are dear and its arms hold, and not where its people have a say", () => {
  assert.equal(exitBar(at({ gain: 0, hold: 1, voice: 0 })), 0);
  assert.equal(exitBar(at({ gain: 0.9, hold: 0, voice: 0 })), 0);
  const shut = exitBar(at({ gain: 0.9, hold: 0.9, voice: 0.1 }));
  assert.ok(gateBand(shut) === 2, `barred at ${shut}`);
  assert.ok(exitBar(at({ gain: 0.9, hold: 0.9, voice: 0.9 })) < 0.25);
});

test("a seat that keeps the arms and watches every word holds its people in, as far as they have no say", () => {
  const watched = exitBar(at({ force: 0.9, word: 0.1, voice: 0.1 }));
  assert.ok(gateBand(watched) >= 1, `${watched}`);
  assert.equal(exitBar(at({ force: 0.9, word: 1, voice: 0.1 })), 0);
  assert.ok(exitBar(at({ force: 0.9, word: 0.1, voice: 0.9 })) < 0.25);
});

test("strangers many among a narrow us shut the gates; hands short open them", () => {
  assert.equal(entryBar(at({ strangers: 0 })), 0);
  const narrow = entryBar(at({ strangers: 0.15, nation: 0.1, hold: 1 })),
    wide = entryBar(at({ strangers: 0.15, nation: 0.9, hold: 1 })),
    short = entryBar(at({ strangers: 0.15, nation: 0.1, hold: 1, gain: 0.8 }));
  assert.ok(narrow > wide && narrow > short, `${narrow} ${wide} ${short}`);
});

test("gates let through what both bars leave, and half the bars hold those fleeing war", () => {
  assert.equal(gatesOpen(0, 0, false), 1);
  assert.equal(gatesOpen(1, 0, false), 0);
  assert.equal(gatesOpen(1, 0, true), 0.5);
  assert.ok(Math.abs(gatesOpen(0.5, 0.5, false) - 0.25) < 1e-9);
});

test("a realm's gates are kept as a couple of numbers and load back as saved", async () => {
  const { BorderStore } = await import("../../src/sim/index.ts");
  const a = new BorderStore();
  a.set("pol:0:7" as never, {
    exit: 64,
    entry: 10,
    exitEvent: "ev:0:3" as never,
    entryEvent: null,
  });
  a.set("pol:0:9" as never, { exit: 0, entry: 0, exitEvent: null, entryEvent: null });
  const b = new BorderStore();
  b.load(JSON.parse(JSON.stringify(a.save())));
  assert.deepEqual(b.save(), a.save());
  assert.equal(b.keys().length, 1, "a realm that bars nothing keeps nothing");
  b.load(undefined);
  assert.ok(b.dormant(), "a save from before the gates loads with none");
});
