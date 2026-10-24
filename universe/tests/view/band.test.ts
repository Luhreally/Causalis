import { test } from "node:test";
import assert from "node:assert/strict";
import type { GenesisPlan } from "../../src/bridge/index.ts";
import {
  BAND_DAY,
  MEADOW_STEP,
  bandHour,
  bandQuarry,
  bandWords,
  newBand,
  newMeadow,
  stepBand,
  stepMeadow,
  type BandState,
  type MeadowState,
} from "../../src/view/index.ts";

// Phase 28 M158: a band watched — the first people's band on the last age's land, camped about
// their fire, out gathering and hunting by day, asleep by night, walking on when the land about
// them is bare; and the land's beasts living on about them. Pure: a made-up beginning of three ages.

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

/** A band on the last age's land, played for so many of its days. */
const played = (days: number, each?: (b: BandState, m: MeadowState) => void) => {
  const m = newMeadow(PLAN, 2, PLAN.seed),
    b = newBand(m, 14, "the Ana", PLAN.seed);
  for (let i = 0; i < (days * BAND_DAY) / MEADOW_STEP; i++) {
    stepMeadow(m);
    stepBand(b, m);
    each?.(b, m);
  }
  return { b, m };
};

test("a band camps where the land would feed it: its old, its children and its grown about the fire, the same for the same land and seed", () => {
  const m = newMeadow(PLAN, 2, PLAN.seed),
    b = newBand(m, 14, "the Ana", PLAN.seed);
  assert.equal(b.people.length, 14);
  const kin = (k: string) => b.people.filter((p) => p.kin === k).length;
  assert.ok(kin("old") >= 1 && kin("child") >= 2 && kin("grown") >= 6, JSON.stringify(b.people));
  assert.ok(
    b.people.some((p) => p.hunter) && b.people.every((p) => !p.hunter || p.kin === "grown"),
  );
  assert.ok(b.shelters.length >= 2, "shelters about the fire");
  assert.ok(
    b.people.every((p) => Math.hypot(p.x - b.camp.x, p.z - b.camp.z) < 4),
    "all about the fire",
  );
  if (m.pond)
    assert.ok(Math.hypot(b.camp.x - m.pond.x, b.camp.z - m.pond.z) > m.pond.r, "not in the pool");
  assert.equal(Math.round(bandHour(b)), 7, "a morning");
  // The same land, the same band; another seed, another camp.
  const again = newBand(newMeadow(PLAN, 2, PLAN.seed), 14, "the Ana", PLAN.seed);
  assert.deepEqual(again.camp, b.camp);
  const other = newBand(newMeadow(PLAN, 2, PLAN.seed), 14, "the Ana", "another seed");
  assert.notDeepEqual(other.camp, b.camp);
});

test("by day the grown go out to gather and hunt, the children play, the old keep the fire; by night they sleep about it", () => {
  const byDay = new Set<string>(),
    byNight = new Set<string>();
  let farAtNight = 0;
  const { b } = played(2, (b) => {
    const h = bandHour(b);
    for (const p of b.people) {
      if (h >= 9 && h < 17) byDay.add(`${p.kin}:${p.doing}`);
      if (h >= 22 || h < 5) {
        byNight.add(p.doing);
        if (!b.going) farAtNight = Math.max(farAtNight, Math.hypot(p.x - b.camp.x, p.z - b.camp.z));
      }
    }
  });
  for (const d of ["grown:gathering", "child:playing", "old:tending"])
    assert.ok(byDay.has(d), `${d} (seen ${[...byDay].join(", ")})`);
  assert.ok(
    byDay.has("grown:stalking") || byDay.has("grown:chasing"),
    `hunting (seen ${[...byDay].join(", ")})`,
  );
  assert.deepEqual([...byNight].sort(), ["sleeping", "tending"], "asleep, one keeping the fire");
  assert.ok(farAtNight < 6, `all home by night (${farAtNight.toFixed(1)} m out)`);
  assert.ok(b.gathered >= 5, `armfuls brought home: ${b.gathered}`);
  assert.equal(b.day, 2);
});

test("the hunters run down the age's beasts, and the beasts run from them", () => {
  let fled = 0;
  const { b, m } = played(4, (b, m) => {
    if (b.people.some((p) => p.doing === "chasing"))
      fled = Math.max(fled, m.beasts.filter((q) => q.doing === "fleeing").length);
  });
  assert.ok(b.hunts >= 2, `hunts ${b.hunts}`);
  assert.ok(b.kills >= 1 && m.taken >= b.kills, `kills ${b.kills}, taken ${m.taken}`);
  assert.ok(fled > 0, "the hunted fled");
  assert.ok(b.food > 0.5, `fed: ${b.food.toFixed(2)} days put by`);
  // What may be hunted: the grass- and leaf-eaters big enough to be worth it; not the hunters, nor the small.
  const kinds = new Map(m.kinds.map((k, i) => [k.name, i]));
  const quarry = (name: string) =>
    bandQuarry(m, { ...m.beasts[0]!, kind: kinds.get(name)!, doing: "grazing" });
  assert.equal(quarry("grey ox"), true);
  assert.equal(quarry("dun deer"), true);
  assert.equal(quarry("red cat"), false);
  assert.equal(quarry("pale hare"), false);
});

test("the land about the camp eaten bare, they pack up and walk on to fresh ground", () => {
  const m = newMeadow(PLAN, 2, PLAN.seed),
    b = newBand(m, 10, "the Ana", PLAN.seed),
    first = { ...b.camp };
  // Bare about the camp, kept so: no leaf, no grass.
  const bare = () => {
    for (const s of m.shrubs) if (Math.hypot(s.x - first.x, s.z - first.z) < 40) s.leaf = 0;
    m.grass.fill(0);
  };
  let walked = false,
    words = "";
  for (let i = 0; i < (4 * BAND_DAY) / MEADOW_STEP && b.camps < 2; i++) {
    stepMeadow(m);
    if (!b.going) bare();
    stepBand(b, m);
    if (b.going && b.people.every((p) => p.doing === "moving")) {
      walked = true;
      words = bandWords(b);
    }
  }
  assert.ok(walked, "they walked on");
  assert.match(words, /^The band of 10 walks on to fresh ground, the camp on their backs/);
  assert.equal(b.camps, 2);
  assert.ok(Math.hypot(b.camp.x - first.x, b.camp.z - first.z) >= 25, "a fresh camp, away");
  assert.ok(
    b.news.some((w) => /walked on to fresh ground — their second camp/.test(w)),
    b.news.join(" | "),
  );
});

test("the band told in a line: by day what they are at and their store; by night asleep about the fire", () => {
  let day = "",
    night = "";
  played(1.5, (b) => {
    const h = bandHour(b);
    if (!day && h > 11 && h < 12) day = bandWords(b);
    if (!night && h > 23) night = bandWords(b);
  });
  assert.match(
    day,
    /^The band of 14: .*(gathering|carrying home).* — forenoon, day 1; (.* put by|hungry)/,
  );
  assert.match(
    night,
    /^Night: the band of 14 sleeps about its fire, one keeping it — day 1, their first camp\.$/,
  );
});

test("the land lives on about them: the age's lineages last, the few left joined by more from the land about", () => {
  // (A lineage may be hunted out of the stretch watched for a while; never for long.)
  const away: number[] = [],
    longest: number[] = [];
  const { m } = played(8, (_, m) => {
    if (Math.floor(m.t) === Math.floor(m.t - MEADOW_STEP)) return;
    m.kinds.forEach((_, i) => {
      away[i] = m.beasts.some((q) => q.kind === i) ? 0 : (away[i] ?? 0) + 1;
      longest[i] = Math.max(longest[i] ?? 0, away[i]!);
    });
  });
  for (const [i, k] of m.kinds.entries())
    if (!k.gone && k.feed !== "swim")
      assert.ok(longest[i]! < BAND_DAY / 2, `${k.name} gone from the land ${longest[i]} s at most`);
  // None left of a kind: a few walk in from the edge.
  const ox = m.kinds.findIndex((k) => k.name === "grey ox");
  m.beasts = m.beasts.filter((q) => q.kind !== ox);
  let came = false;
  for (let i = 0; i < 90 / MEADOW_STEP && !came; i++) {
    stepMeadow(m);
    came = m.beasts.some((q) => q.kind === ox && q.doing === "coming");
  }
  assert.ok(came, "oxen walked in");
});
