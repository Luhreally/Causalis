import { test } from "node:test";
import assert from "node:assert/strict";
import type { VillagePlan } from "../../src/bridge/index.ts";
import {
  BEAST_SCALE,
  MOST_PARTS,
  beastsAt,
  birdsAt,
  bodyOf,
  coatOf,
  doingOf,
  faunaOf,
  fishAt,
  kindOf,
  posed,
  type BeastNow,
  type BeastPart,
} from "../../src/view/index.ts";

const plan: VillagePlan = {
  ref: "town:0:7",
  name: "Herdwick",
  population: 120,
  market: false,
  hand: false,
  districts: null,
  biome: 8,
  seed: 5,
  homes: [{ x: 20, z: 0, yaw: 0, household: null }],
  fields: [
    { x: 160, z: 20, w: 40, d: 25, yaw: 0 },
    { x: 150, z: 70, w: 40, d: 25, yaw: 0.3 },
  ],
  pasture: { x: -200, z: 0, r: 90 },
  wild: 320,
  water: { x: 0, z: -400 },
  house: { walls: "wattle", roof: "thatch", form: "long", pitch: 45, design: null },
  body: null,
  road: { x: 0, z: 1100 },
  people: [],
  fauna: {
    wild: [
      { ref: "spec:0:3", name: "grey ox", niche: "grazer", size: 480, wool: false, stock: 0.9 },
      { ref: "spec:0:5", name: "red deer", niche: "browser", size: 90, wool: false, stock: 0.8 },
      {
        ref: "spec:0:9",
        name: "spotted bear",
        niche: "hunter",
        size: 280,
        wool: false,
        stock: 0.85,
      },
    ],
    flock: { ref: "spec:0:4", name: "pale woolly sheep", size: 60, wool: true, herders: 6 },
    raided: false,
  },
};

test("a lineage's name says what kind of beast it is and what coat it wears", () => {
  assert.equal(kindOf("pale woolly sheep", "grazer"), "sheep");
  assert.equal(kindOf("lesser grey ox", "grazer"), "ox");
  assert.equal(kindOf("golden great tusker", "great beast"), "tusker");
  assert.equal(kindOf("black woolly giant", "great beast"), "giant");
  assert.equal(kindOf("spotted bear", "hunter"), "bear");
  assert.equal(kindOf("red tapir", "browser"), "tapir");
  // (A name that says none: its niche's kind.)
  assert.equal(kindOf("strange thing", "hunter"), "wolf");
  assert.equal(coatOf("spotted bear", false).pattern, "spots");
  assert.equal(coatOf("brindled horse", false).pattern, "stripes");
  assert.equal(coatOf("grey ox", false).pattern, null);
  const hide = coatOf("red goat", false).coat,
    wool = coatOf("red woolly sheep", true).coat;
  assert.ok(wool[0] + wool[1] + wool[2] > hide[0] + hide[1] + hide[2], "wool is paler than hide");
});

test("a beast is built finer at a finer setting, never past the most parts, and bows its head to graze", () => {
  const parts: BeastPart[] = [];
  let last = 0;
  for (const detail of [0, 1, 2, 3]) {
    const b = bodyOf("horse", 400, false, "stripes", detail, 7),
      n = posed(b, { gait: 0, phase: 0, head: 0, crouch: 0 }, parts);
    assert.ok(n >= last, `detail ${detail}: ${n} parts`);
    assert.ok(n <= MOST_PARTS);
    last = n;
  }
  for (const kind of ["sheep", "tusker", "elk", "cat", "camel", "buffalo"] as const)
    for (const detail of [0, 3])
      assert.ok(
        posed(
          bodyOf(kind, 300, true, "spots", detail, 1),
          { gait: 2, phase: 1, head: 1, crouch: 1 },
          parts,
        ) <= MOST_PARTS,
      );
  // The head (part 5: body, four legs, then neck and head... the head is the 7th placed).
  const ox = bodyOf("ox", 500, false, null, 1),
    headOf = (head: number) => {
      posed(ox, { gait: 0, phase: 0, head, crouch: 0 }, parts);
      return parts[6]!;
    };
  const up = headOf(0).y,
    down = headOf(1).y;
  assert.ok(
    down < up * 0.6,
    `grazing, the head goes down (${down.toFixed(2)} against ${up.toFixed(2)})`,
  );
  // Drawn as much larger than life as a village's people: an ox about as tall as a man.
  posed(ox, { gait: 0, phase: 0, head: 0, crouch: 0 }, parts);
  const top = Math.max(...parts.slice(0, 7).map((p) => p.y + p.sy / 2));
  assert.ok(
    top > 1.2 * BEAST_SCALE && top < 2.6 * BEAST_SCALE,
    `an ox stands ${top.toFixed(2)} high`,
  );
});

test("the living world about a village keeps to the setting's count and lays out its flocks, herds and hunters", () => {
  for (const cap of [30, 80, 160, 320]) {
    const f = faunaOf(plan, cap, 2, true),
      beasts =
        f.herds.reduce((a, h) => a + h.members.length, 0) +
        f.packs.reduce((a, p) => a + p.members, 0);
    assert.ok(beasts <= cap + 4, `${beasts} beasts at ${cap}`);
    assert.ok(beasts >= Math.min(cap, 20) * 0.5, `${beasts} beasts at ${cap}: enough to see`);
    // The flocks graze in the pasture.
    const flock = f.herds.find((h) => f.species[h.species]!.flock)!;
    assert.ok(flock, "the village's flock");
    assert.ok(Math.hypot(flock.home.x - plan.pasture.x, flock.home.z - plan.pasture.z) < 1);
    // The wild herds keep off the fields' side, past the homes.
    for (const h of f.herds.filter((h) => !f.species[h.species]!.flock)) {
      const r = Math.hypot(h.home.x, h.home.z);
      assert.ok(r > 100, `a herd ${r.toFixed(0)} m out`);
    }
    // Every band of hunters hunts a herd, and the bear is the hunter.
    assert.ok(f.packs.length >= 1);
    for (const p of f.packs) {
      assert.equal(f.species[p.species]!.kind, "bear");
      assert.ok(f.herds[p.herd]);
    }
  }
  // Where the hunters raid the flocks, they hunt the flock.
  const raided = faunaOf({ ...plan, fauna: { ...plan.fauna!, raided: true } }, 160, 2, true);
  assert.ok(raided.species[raided.herds[raided.packs[0]!.herd]!.species]!.flock);
  // The plainest setting has no birds or fish; a village without water has no fish.
  const plain = faunaOf(plan, 30, 0, false);
  assert.equal(plain.birds.length + plain.fish.length, 0);
  assert.equal(faunaOf({ ...plan, water: null }, 160, 2, true).fish.length, 0);
  // Nothing lives about a village whose plan says nothing does.
  const none = faunaOf({ ...plan, fauna: undefined }, 160, 2, false);
  assert.equal(none.herds.length + none.packs.length, 0);
});

test("the beasts move smoothly by the screen's clock, and the same moment always looks the same", () => {
  const f = faunaOf(plan, 160, 2, true),
    a: BeastNow[] = [],
    b: BeastNow[] = [];
  const n = beastsAt(f, 123.4, a);
  assert.equal(beastsAt(f, 123.4, b), n);
  for (let i = 0; i < n; i++) {
    assert.equal(a[i]!.x, b[i]!.x);
    assert.equal(a[i]!.z, b[i]!.z);
  }
  // Over a twentieth of a second no beast goes further than a sprint takes it.
  for (let s = 0; s < 400; s += 0.37) {
    const m = beastsAt(f, s, a);
    beastsAt(f, s + 0.05, b);
    for (let i = 0; i < m; i++) {
      const d = Math.hypot(b[i]!.x - a[i]!.x, b[i]!.z - a[i]!.z);
      assert.ok(d < 3, `beast ${i} at ${s.toFixed(2)} s moved ${d.toFixed(2)} m`);
    }
  }
});

test("a hunting band stalks its herd and runs at it; the herd lifts its heads, flees, and comes back", () => {
  const f = faunaOf(plan, 160, 2, true),
    pack = f.packs[0]!,
    herd = f.herds[pack.herd]!,
    out: BeastNow[] = [],
    // The hunters come after every herd's beasts; the band's first is the first after them.
    first = f.herds.reduce((a, h) => a + h.members.length, 0) + f.packs.slice(0, 0).length,
    herdStart = f.herds.slice(0, pack.herd).reduce((a, h) => a + h.members.length, 0),
    at = (phi: number) => {
      const s =
        (Math.floor(1000 / pack.period) + phi) * pack.period - pack.offset + 5 * pack.period;
      beastsAt(f, s, out);
      const hunter = out[first]!,
        beasts = out.slice(herdStart, herdStart + herd.members.length),
        mx = beasts.reduce((a, b) => a + b.x, 0) / beasts.length,
        mz = beasts.reduce((a, b) => a + b.z, 0) / beasts.length;
      return {
        hunter: { ...hunter, pose: { ...hunter.pose } },
        herd: { x: mx, z: mz, poses: beasts.map((b) => ({ ...b.pose })) },
        gap: Math.hypot(hunter.x - mx, hunter.z - mz),
      };
    };
  const prowl = at(0.3),
    stalk = at(0.65),
    chase = at(0.8),
    rest = at(0.95),
    back = at(0.45);
  assert.equal(stalk.hunter.pose.crouch, 1, "stalking, the hunter crouches");
  assert.ok(
    stalk.herd.poses.every((p) => p.head === 0),
    "the herd lifts its heads",
  );
  assert.equal(chase.hunter.pose.gait, 2, "the hunter runs");
  assert.ok(
    chase.herd.poses.every((p) => p.gait === 2),
    "the herd runs",
  );
  assert.ok(stalk.gap < prowl.gap, "stalking, the hunter closes");
  assert.ok(rest.gap > 40, `the herd got away (${rest.gap.toFixed(0)} m)`);
  assert.equal(doingOf(f.species[pack.species]!, stalk.hunter.pose), "stalking the herd");
  assert.equal(doingOf(f.species[herd.species]!, chase.herd.poses[0]!), "running from the hunters");
  // And by the next prowl the herd grazes again.
  assert.ok(
    back.herd.poses.some((p) => p.head === 1),
    "grazing again",
  );
});

test("birds wheel on beating wings, and fish leap now and then from the water", () => {
  const f = faunaOf(plan, 160, 2, true);
  assert.ok(f.birds.length >= 3 && f.fish.length > 0);
  const birds: ReturnType<typeof Array.prototype.slice> = [];
  const n = birdsAt(f, 10, birds as never);
  assert.equal(n, f.birds.length);
  let leapt = 0;
  for (let s = 0; s < 60; s += 0.5) leapt += fishAt(f, s, [] as never);
  assert.ok(leapt > 0 && leapt < 6 * 120 * 0.5, `${leapt} leaps seen`);
});
