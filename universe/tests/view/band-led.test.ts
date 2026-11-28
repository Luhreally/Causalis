// Live a Line's tribe (S6): a band led. Fed well three days running it has a child; seed dug from the grass and eaten by
// the fire is dropped there, and comes up where the band camps again days after, if a wild grain grows in its land. The
// hand sends the hunters after a beast and walks the band on, and is told why where it cannot. A band not led lives as it
// always did (tests/view/band.test.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import type { GenesisPlan } from "../../src/bridge/index.ts";
import {
  BAND_DAY,
  MEADOW_STEP,
  bandHour,
  bandQuarry,
  newBand,
  newMeadow,
  stepBand,
  stepMeadow,
  type BandState,
  type MeadowState,
} from "../../src/view/index.ts";
import { LedBand, orderHunt, orderWalk } from "../../src/view/band-led.ts";

const body = (size: number, moves = "walk") => ({
  symmetry: "bilateral" as const,
  segments: 1 as const,
  legs: 4 as const,
  fins: 0 as const,
  wings: 0 as const,
  covering: "fur",
  size,
  moves,
  eats: "grass",
  level: 2,
  neck: 0.4,
  tail: 0.3,
  features: [],
  warm: true,
});
let n = 0;
const lineage = (
  name: string,
  niche: string,
  size: number,
  arose: number,
  died: number | null,
) => ({
  ref: `spec:0:${n++}`,
  name,
  niche,
  arose,
  died,
  size,
  level: niche.includes("hunt") ? 3 : 2,
  body: body(size, niche === "swimmer" ? "swim" : "walk"),
  words: `a ${niche}`,
});
const age = (index: number) => ({
  index,
  from: 400 - index * 50,
  to: 350 - index * 50,
  kind: "quiet",
  seaLevel: 0,
  warmth: 1,
  forests: true,
});
const PLAN = {
  seed: "band test",
  name: "band test",
  worldAge: 4500,
  rungs: [],
  drop: null,
  acts: {
    ages: [],
    dawn: null,
    lives: [],
    peopling: { seasLow: false, age: null, cradle: null },
  },
  peopling: null,
  ages: [age(0), age(1), age(2)],
  lineages: [
    lineage("grey ox", "grazer", 300, 1, null),
    lineage("dun deer", "browser", 90, 1, null),
    lineage("red cat", "hunter", 150, 1, null),
    lineage("pale hare", "seed-eater", 3, 2, null),
  ],
  people: null,
} as unknown as GenesisPlan;

/** Led bands step through their hand (view/band-led.ts LedBand.step); others as ever. */
const hands = new WeakMap<BandState, LedBand>();
const stepOf = (b: BandState, m: MeadowState) => {
  const l = hands.get(b);
  if (l) l.step(b, m);
  else stepBand(b, m);
};
const lead = (b: BandState, grain: boolean): LedBand => {
  const l = new LedBand(b, grain);
  hands.set(b, l);
  return l;
};
const live = (b: BandState, m: MeadowState, days: number, each?: () => void) => {
  for (let i = 0; i < (days * BAND_DAY) / MEADOW_STEP; i++) {
    stepMeadow(m);
    stepOf(b, m);
    each?.();
  }
};
/** On to the next morning's hour (h). */
const until = (b: BandState, m: MeadowState, hour: number) => {
  for (let i = 0; i < BAND_DAY / MEADOW_STEP && Math.abs(bandHour(b) - hour) > 0.1; i++) {
    stepMeadow(m);
    stepOf(b, m);
  }
};

test("a band led and fed well has children; the same band not led is as it was", () => {
  const m = newMeadow(PLAN, 2, PLAN.seed),
    b = newBand(m, 14, "the Ana", PLAN.seed),
    l = lead(b, true);
  // (Its store kept full, as a hand that feeds it well would: three nights running full, a child.)
  live(b, m, 7, () => (b.food = Math.max(b.food, 6.5)));
  assert.ok(l.born >= 2, `${l.born} born`);
  assert.equal(b.people.length, 14 + l.born);
  assert.ok(b.people.filter((p) => p.kin === "child").length >= 2 + l.born);
  // (Never past twice what it was.)
  live(b, m, 30, () => (b.food = Math.max(b.food, 6.5)));
  assert.ok(b.people.length <= 28);
  // (Starved, the weakest lost.)
  const before = b.people.length;
  live(b, m, 4, () => (b.food = 0));
  assert.ok(l.lost >= 1 && b.people.length === before - l.lost, `${l.lost} lost`);
  // (Not led, the same land and seed: none born, none lost.)
  const m2 = newMeadow(PLAN, 2, PLAN.seed),
    b2 = newBand(m2, 14, "the Ana", PLAN.seed);
  live(b2, m2, 7, () => (b2.food = Math.max(b2.food, 6.5)));
  assert.equal(b2.people.length, 14);
});

test("seed dropped by the fire comes up where the band camps again days after, if a wild grain grows there", () => {
  for (const grain of [true, false]) {
    const m = newMeadow(PLAN, 2, PLAN.seed),
      b = newBand(m, 14, "the Ana", PLAN.seed),
      l = lead(b, grain);
    l.grass = true;
    /** Come to their ground (walking on, they are let arrive), on to the next morning. */
    const morning = () => {
      for (let k = 0; k < 6; k++) {
        until(b, m, 8);
        if (!b.going) return;
        live(b, m, 0.3);
      }
    };
    live(b, m, 1.5);
    const old = l.seed.find((s) => s.n >= 3);
    assert.ok(old, `seed dropped: ${JSON.stringify(l.seed)}`);
    // (Walked on, some way off; lived there some days; walked back to the old camp.)
    morning();
    if (Math.hypot(b.camp.x - old.x, b.camp.z - old.z) < 30)
      assert.equal(orderWalk(b, l, old.x + 60, old.z), null);
    live(b, m, 1.2);
    live(b, m, 4.5);
    morning();
    if (!l.sprouted && Math.hypot(b.camp.x - old.x, b.camp.z - old.z) >= 10)
      assert.equal(orderWalk(b, l, old.x, old.z), null);
    live(b, m, 1.2);
    live(b, m, 1);
    assert.equal(
      !!l.sprouted,
      grain,
      `${grain ? "" : "no "}grain come up: ${JSON.stringify(l.sprouted)}`,
    );
    if (grain) assert.ok(Math.hypot(l.sprouted!.x - old.x, l.sprouted!.z - old.z) < 8);
  }
});

test("the hunters sent after a beast they could take, by day; the band walked on by day; why not where not", () => {
  const m = newMeadow(PLAN, 2, PLAN.seed),
    b = newBand(m, 14, "the Ana", PLAN.seed);
  const l = lead(b, true);
  until(b, m, 22);
  const q = m.beasts.find((x) => bandQuarry(m, x))!;
  assert.match(orderHunt(b, m, q.id)!, /by day/);
  until(b, m, 9);
  assert.match(orderWalk(b, l, b.camp.x + 2, b.camp.z)!, /camped/);
  const near = m.beasts.find(
    (x) => bandQuarry(m, x) && Math.hypot(x.x - b.camp.x, x.z - b.camp.z) < 60,
  );
  if (near && !b.kill) {
    assert.equal(orderHunt(b, m, near.id), null);
    assert.equal(b.quarry, near.id);
  }
  const great = m.beasts.find((x) => !bandQuarry(m, x));
  if (great && !b.kill) assert.match(orderHunt(b, m, great.id)!, /too great|too far/);
  // (Told to walk on, it packs up at the next first light and comes to that ground.)
  const to = { x: b.camp.x + 40, z: b.camp.z };
  assert.equal(orderWalk(b, l, to.x, to.z), null);
  live(b, m, 1.5);
  assert.ok(
    Math.hypot(b.camp.x - to.x, b.camp.z - to.z) < 14,
    `camped at ${JSON.stringify(b.camp)}, not by ${JSON.stringify(to)}`,
  );
});
