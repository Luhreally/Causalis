// Signals (docs/architecture/first-principles-plan.md, "Signals"): carrying a word far and fast is a function, its means read from what a world
// allows. Earth's order comes out as it is; each step stops where a world's matter, medium or current does; what a land's
// signals do is one number, and at none it is exactly what history read before them; the information age is a web's.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AGE_LADDER,
  PRINCIPLES,
  PRINCIPLE_INDEX,
  SIGNAL,
  SIGNAL_STEPS,
  SIGNAL_TREE,
  SOLAR,
  WORD_WAYS,
  ageReached,
  askMet,
  causeOf,
  connectivityOf,
  delayWords,
  infoShare,
  meansOf,
  meansWorldOf,
  needsMet,
  openSteps,
  readCan,
  readFunctions,
  rocketSightKm,
  signalOf,
  stepStop,
  whyShut,
  wordPace,
  type CanWorld,
  type FunctionReading,
  type LandStop,
  type MeansWorld,
} from "../../src/rules/index.ts";

function worldOf(
  o: {
    medium?: MeansWorld["medium"];
    bodyFire?: boolean;
    land?: (id: string) => LandStop | null;
    matter?: (f: FunctionReading) => FunctionReading;
  } = {},
): CanWorld {
  const numbers = meansWorldOf({
      chem: SOLAR,
      kind: "rocky",
      celsius: 15,
      gravity: 1,
      medium: o.medium ?? "land",
      bodyFire: o.bodyFire ?? true,
      insolation: 1,
      grips: true,
    }),
    functions = readFunctions({
      chem: SOLAR,
      kind: "rocky",
      celsius: 15,
      gravity: 1,
      rockBodies: 8,
      giants: 4,
      starLeftGyr: 5,
      peopled: true,
      means: numbers,
    }).map((f) => o.matter?.(f) ?? f);
  return {
    numbers,
    means: meansOf(numbers),
    chem: SOLAR,
    functions,
    medium: o.medium ?? "land",
    fire: numbers.freeOxygen && (o.bodyFire ?? true),
    lanes: true,
    peopled: true,
    sows: true,
    orbitKms: 9.4,
    land: (p) => o.land?.(p.id) ?? null,
    copper: () => null,
  };
}

/** The order a land must come to the steps in, by their needs alone: each after all it needs. */
function needsOrder(): Map<string, number> {
  const depth = new Map<string, number>();
  const of = (id: string): number => {
    if (depth.has(id)) return depth.get(id)!;
    const p = PRINCIPLES[PRINCIPLE_INDEX.get(id)!];
    // (A way round met on the way is no way: the other is taken.)
    depth.set(id, 1e9);
    const d = !p ? 0 : 1 + Math.max(0, ...p.needs.map((n) => Math.min(...n.split("|").map(of))));
    depth.set(id, d);
    return d;
  };
  for (const id of SIGNAL_STEPS) of(id);
  return depth;
}

test("Earth comes to every signal step, in Earth's own order", () => {
  const w = worldOf(),
    open = openSteps(w);
  for (const id of SIGNAL_STEPS)
    if (id !== "sea-sound") assert.ok(open.has(id), `${id} is open on Earth`);
  assert.ok(!open.has("sea-sound"), "a people of the land sends no sound through the deep");
  const d = needsOrder(),
    order = ["telegraph", "telephone", "computing", "solid-state", "networks", "pocket-machines"];
  for (let i = 1; i < order.length; i++)
    assert.ok(d.get(order[i]!)! > d.get(order[i - 1]!)!, `${order[i]} after ${order[i - 1]}`);
  // (The voice on the air after the voice down the wire, as on Earth: its microphone is the telephone's.)
  assert.ok(d.get("radio")! > d.get("telephone")!);
  // (A set carried by hand comes on valves, before the crystal; the pocket machine after the web.)
  assert.ok(d.get("hand-sets")! < d.get("solid-state")! + 1);
  assert.ok(d.get("pocket-machines")! > d.get("hand-sets")!);
  // (Every row is after every other: nothing before the first is found moves.)
  const first = PRINCIPLE_INDEX.get(SIGNAL_TREE[0]!.id)!;
  assert.equal(first, PRINCIPLES.length - SIGNAL_TREE.length);
});

test("no current, no signals: each step stops where the world's current does", () => {
  const currents = new Set([
      "electricity",
      "sea-electricity",
      "graphite-dynamos",
      "ground-dynamos",
      "polymer-wire",
    ]),
    w = worldOf({ land: (id) => (currents.has(id) ? { on: "river" } : null) }),
    open = openSteps(w);
  for (const id of SIGNAL_STEPS) assert.ok(!open.has(id), `${id} shut without a current`);
  const why = whyShut("telegraph", w, open)!;
  assert.equal(why.on, "needs");
});

test("no stuff that carries a current: no wire, no voice, no waves", () => {
  const w = worldOf({
      matter: (f) => (f.id === "carry-current" ? { ...f, met: false, by: null } : f),
    }),
    open = openSteps(w);
  assert.ok(!open.has("telegraph"));
  assert.equal(
    stepStop(PRINCIPLES[PRINCIPLE_INDEX.get("telegraph")!]!, w, () => true)?.on,
    "matter",
  );
});

test("a world whose crust gives no pure crystal stops at valves and wire, and still has sets in the hand", () => {
  const w = worldOf({
      matter: (f) => (f.id === "switch-in-crystal" ? { ...f, met: false, by: null } : f),
    }),
    open = openSteps(w);
  for (const id of ["telegraph", "telephone", "radio", "computing", "hand-sets"])
    assert.ok(open.has(id), `${id} open on valves and wire`);
  for (const id of ["solid-state", "networks", "pocket-machines"])
    assert.ok(!open.has(id), `${id} shut without a pure crystal`);
  assert.match(causeOf(whyShut("solid-state", w, open)!, w)!, /^matter:switch-in-crystal/);
  // (Its reckoning tops out at relays and valves, and says why.)
  const mind = readCan(w, open, () => false).find((f) => f.id === "mind")!;
  assert.ok(mind.rungs.some((r) => r.by === "solid-state" && r.state === "shut" && r.why));
});

test("a people of the water sends its words by sound through the deep, never on waves through the air", () => {
  const w = worldOf({ medium: "water", bodyFire: false }),
    open = openSteps(w);
  assert.ok(!open.has("radio"));
  assert.equal(whyShut("radio", w, open)?.on, "medium");
  if (open.has("telegraph")) {
    assert.ok(open.has("sea-sound"));
    assert.ok(open.has("hand-sets"), "a set in the hand by sound");
  }
  assert.equal(wordPace((id) => id === "sea-sound" || id === "radio", "water").way.id, "sound");
});

test("a word's pace: faster with each way, and told in words", () => {
  assert.equal(wordPace(() => false, "land").way.id, "foot");
  assert.equal(wordPace(() => false, "land").words, "25 days");
  assert.equal(wordPace((id) => id === "telegraph", "land").words, "an hour");
  assert.equal(wordPace((id) => id === "riding" || id === "roads", "land").way.id, "post");
  assert.equal(wordPace((id) => id === "networks" || id === "radio", "land").words, "a second");
  for (let i = 1; i < WORD_WAYS.length; i++) assert.ok(WORD_WAYS[i]!.kmADay > 0);
  assert.equal(delayWords(1000 / 300_000), "5 minutes");
});

test("at no signal, what history reads is exactly what it read before them", () => {
  const c = connectivityOf(0);
  assert.equal(c, 0);
  assert.equal(0.25 * (1 + SIGNAL.tradeShare * c), 0.25);
  assert.equal(2 * (1 + SIGNAL.tradeMargin * c), 2);
  assert.equal(1 - SIGNAL.tradeCost * c, 1);
  assert.equal(1 - SIGNAL.warSteadied * c, 1);
  assert.equal(1 + SIGNAL.carriers * infoShare(c), 1);
  // (And a land with every step is on the line for most of its dealings, never all.)
  const all = SIGNAL_TREE.reduce((s, p) => s + (p.effects.signal ?? 0), 0);
  assert.ok(all > 0.9 && connectivityOf(all) <= 0.95);
  assert.ok(infoShare(connectivityOf(all)) < 0.5);
});

test("the information age is a web's: reached only with machines joined in one, and gone round where not", () => {
  const info = AGE_LADDER.findIndex((a) => a.id === "information"),
    orbit = AGE_LADDER.findIndex((a) => a.id === "orbit");
  assert.ok(info === orbit + 1 && AGE_LADDER[info]!.aside);
  const up = new Set(["telegraph", "telephone", "radio", "computing", "hand-sets", "solid-state"]);
  assert.ok(signalOf((id) => up.has(id)) < 0.75, "valves, wire and crystal without a web");
  up.add("networks");
  assert.ok(signalOf((id) => up.has(id)) >= 0.75);
  const ask = AGE_LADDER[info]!.asks[0]!;
  const figures = (signal: number) => ({ signal }) as unknown as Parameters<typeof askMet>[1];
  assert.ok(!askMet(ask, figures(0.7)) && askMet(ask, figures(0.85)));
  // (A world past it that never had a web did not pass through it.)
  assert.ok(!ageReached(info, info + 2, figures(0)));
  assert.ok(ageReached(info, info + 2, figures(0.85)));
});

test("a rocket's height sees a horizon of a thousand kilometres and more over Earth", () => {
  const km = rocketSightKm(6371);
  assert.ok(km > 1300 && km < 1500, `${km}`);
});

test("every signal step's needs are steps of the tree, and a land that knows all it needs can be found it", () => {
  const rows = PRINCIPLES.filter((p) => SIGNAL_STEPS.includes(p.id));
  assert.equal(rows.length, SIGNAL_TREE.length);
  for (const p of rows)
    for (const n of p.needs)
      for (const x of n.split("|")) assert.ok(PRINCIPLE_INDEX.has(x), `${p.id} needs ${x}`);
  const all = new Set(PRINCIPLES.map((p) => p.id));
  for (const p of rows) assert.ok(needsMet(p, (id) => all.has(id)));
});
