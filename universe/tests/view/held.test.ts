// Phase 61, the view's part: the blows track's rule given on from the rules' (rules/blows.ts, where
// it moved so the fight deals its blows by it); a soldier's taking laid out from the battle fought
// before a town as it is drawn, the battle drawn from his fight (and once it is over, its fallen
// where his fight left them, borne in), the stick turned onto the field; a beast's taking from the
// beasts drawn about a town and the beasts drawn from its small world, a flock's beast lost to it
// not drawn; a creature of an age's living world walked in by hand. Pure.
import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  BattleNear,
  BattleRoll,
  GenesisPlan,
  HeldBody,
  RollEntry,
  VillagePlan,
} from "../../src/bridge/index.ts";
import type { CreatureBody } from "../../src/rules/index.ts";
import {
  BLOW_PLACES,
  FIGHT_GONE,
  FIGHT_MOST,
  FIGHT_PACE,
  HAND_ACT,
  WILD_MOST,
  killShare,
  placeWeights,
} from "../../src/rules/index.ts";
import * as viewBlows from "../../src/view/blows.ts";
import * as viewBattle from "../../src/view/battle.ts";
import {
  MEADOW_STEP,
  WILD_GATHER,
  battleAt,
  beastTakeOf,
  beastsAt,
  defaultBody,
  faunaOf,
  fieldBid,
  fightSecondOf,
  fightShare,
  fightStepOf,
  flockMember,
  foughtBorne,
  foughtLying,
  heldBeastsOver,
  heldFightNow,
  holdMeadow,
  letGoMeadow,
  meadowHeld,
  meadowOffers,
  meadowStrip,
  membersWords,
  newBattle,
  newMeadow,
  soldierTakeOf,
  stepMeadow,
  type BeastNow,
  type MeadowState,
} from "../../src/view/index.ts";

const host = (name: string, fielded: number, fallen: number) => ({
  ref: `realm:${name}`,
  name: `the realm of ${name}`,
  color: [0.8, 0.2, 0.2] as [number, number, number],
  arms: null,
  fielded,
  fallen,
  wounded: fallen * 2,
  host: { arm: "spear", guard: "shield", mount: "" },
  kit: "spears",
});
const near = {
  event: "ev:0:77",
  war: "war:1",
  title: "The battle before Kesh",
  cell: 1,
  land: "the test",
  year: 300,
  attacker: host("A", 600, 60),
  defender: host("D", 400, 80),
  won: true,
  outcome: "field",
  civil: null,
  hills: false,
  river: false,
  walls: 0,
  town: null,
  figure: null,
  plan: { seed: "held test", lineages: [], kindOfAge: 0 },
} as unknown as BattleNear;
const field = newBattle(near, 60, true),
  names: (RollEntry | null)[] = field.troopers.map((t) => ({
    ref: `lv:${near.event}:${t.side}:${t.id}`,
    name: `Man ${t.id}`,
    place: 0,
    age: 30,
    kept: true,
  })),
  side = (realm: string) => ({
    realm,
    figures: { n: 60, falls: 0, hurt: 0, stood: 60 },
    fell: [],
    hurt: [],
    stood: [],
    towns: [{ name: "Kesh", fell: 0, hurt: 0, stood: 0 }],
  }),
  roll = {
    event: near.event,
    war: near.war,
    year: 300,
    per: field.per,
    most: 60,
    attacker: side("realm:A"),
    defender: side("realm:D"),
  } as unknown as BattleRoll;

test("the blows track's rule is the rules' now (rules/blows.ts), the view's the same", () => {
  assert.equal(viewBlows.killShare, killShare);
  assert.equal(viewBlows.placeWeights, placeWeights);
  assert.equal(viewBattle.BLOW_PLACES, BLOW_PLACES);
});

test("a soldier's taking laid out from the battle as it is drawn: he first, the nearest about him, each as the roll names him", () => {
  const s = 30,
    now = battleAt(field, s),
    stands = (id: number) => {
      const tr = field.troopers[id]!;
      return (tr.falls === null || tr.falls > s) && (tr.flees === null || tr.flees > s);
    },
    up = now.troopers.find(
      (t) => t.side === 1 && t.size > 0 && t.act !== "fall" && t.act !== "flee" && stands(t.id),
    )!,
    take = soldierTakeOf(near, field, now, roll, names, up.id, s, 60)!;
  assert.ok(take, "one standing is taken");
  assert.deepEqual(take.bodies.slice(0, 2), [up.id, 1]);
  assert.equal(take.ref, names[up.id]!.ref);
  assert.equal(take.name, `Man ${up.id}`);
  assert.equal(take.town, "Kesh");
  assert.equal(take.refs.length, take.bodies.length / 6);
  assert.ok(take.refs.length <= FIGHT_MOST);
  assert.deepEqual(take.figures, [field.hosts[0].n, field.hosts[1].n]);
  assert.equal(take.per, field.per);
  // The nearest first.
  const far = (i: number) =>
    Math.hypot(take.bodies[i * 6 + 2]! - up.x, take.bodies[i * 6 + 3]! - up.z);
  for (let i = 2; i < take.refs.length; i++) assert.ok(far(i) >= far(i - 1) - 1e-9);
  // Those fallen before now told; one fallen is not taken.
  const before = field.troopers.filter((t) => t.falls !== null && t.falls <= s);
  assert.equal(take.before[0] + take.before[1], before.length);
  const fell = field.troopers.find((t) => t.falls !== null && t.falls < s - 5);
  if (fell) assert.equal(soldierTakeOf(near, field, now, roll, names, fell.id, s, 60), null);
});

test("a field larger than his fight: of each side the nearest, as many as its share of those standing", () => {
  // (His side's ranks close about him, the foe's two hundred metres off: by nearness alone, his own.)
  const near = [
      ...Array.from({ length: 300 }, (_, i) => ({ side: 1 as const, id: i, d: i })),
      ...Array.from({ length: 200 }, (_, i) => ({ side: 0 as const, id: 300 + i, d: 200 + i })),
    ].sort((a, b) => a.d - b.d),
    took = fightShare(near, 1),
    of = (side: 0 | 1) => took.filter((t) => t.side === side).length;
  assert.equal(took.length, FIGHT_MOST - 1);
  // (Of 501 standing, he and 300 of his: 144 of the 240 his side's with him, 96 the foe's.)
  assert.equal(of(1), Math.round((FIGHT_MOST * 301) / 501) - 1);
  assert.equal(of(0), FIGHT_MOST - Math.round((FIGHT_MOST * 301) / 501));
  // Each side's nearest, the nearest first.
  assert.deepEqual(
    took.filter((t) => t.side === 0).map((t) => t.id),
    Array.from({ length: of(0) }, (_, i) => 300 + i),
  );
  for (let i = 1; i < took.length; i++) assert.ok(took[i]!.d >= took[i - 1]!.d);
  // Where the field is no more than the fight holds, all of it.
  assert.equal(fightShare(near.slice(0, 120), 1).length, 120);
  // The foe's few, farther than all his own: its share still.
  const few = [
    ...Array.from({ length: 400 }, (_, i) => ({ side: 1 as const, id: i, d: i })),
    ...Array.from({ length: 10 }, (_, i) => ({ side: 0 as const, id: 400 + i, d: 500 + i })),
  ];
  const t2 = fightShare(few, 1);
  assert.equal(t2.length, FIGHT_MOST - 1);
  assert.equal(t2.filter((t) => t.side === 0).length, Math.round((FIGHT_MOST * 10) / 411));
});

test("the stick turned from the town's ground onto the field's", () => {
  const go = { mx: 31, mz: 0, run: true, act: HAND_ACT.strike };
  assert.deepEqual(fieldBid({ x: 0, z: 0, ux: 1, uz: 0 } as never, go), go);
  assert.deepEqual(fieldBid({ x: 0, z: 0, ux: 0, uz: 1 } as never, go), { ...go, mx: 0, mz: -31 });
});

test("the battle drawn from his fight: those in it where it has them, struck where it struck them; the broken side's others in flight", () => {
  const s = 40,
    base = battleAt(field, 30),
    standingIds = base.troopers.filter((t) => t.size > 0 && t.act !== "fall").map((t) => t.id),
    me = base.troopers.find((t) => t.id === standingIds[0])!,
    other = base.troopers.find((t) => t.id === standingIds[1])!,
    body = (id: number, o: Partial<HeldBody>): HeldBody => ({
      id,
      x: 0,
      z: 0,
      yaw: 0,
      vx: 0,
      vz: 0,
      doing: "stand",
      hurt: 0,
      struck: -1,
      lost: -1,
      ...o,
    }),
    now = heldFightNow(
      field,
      base,
      [
        body(me.id, { x: 3, z: 4, doing: "fight" }),
        body(other.id, { x: 5, z: 4, doing: "dead", struck: 1 }),
      ],
      0,
      s - 1,
      s,
      ["point", "edge"],
    ),
    mine = now.troopers.find((t) => t.id === me.id)!,
    his = now.troopers.find((t) => t.id === other.id)!;
  assert.deepEqual([mine.x, mine.z, mine.act], [3, 4, "fight"]);
  assert.deepEqual([his.act, his.down, his.hit], ["fall", 1, "trunk"]);
  assert.ok(now.wounds!.some((w) => w.id === other.id && w.place === "trunk"));
  assert.ok(now.blood.length > base.blood.length);
  // The attackers broke a second ago: those of theirs not in the fight fly toward their own end.
  const flying = now.troopers.filter(
    (t) => t.side === 0 && t.id !== me.id && t.id !== other.id && t.act === "flee" && t.size > 0,
  );
  assert.ok(flying.length > 0);
  const was = base.troopers.find((t) => t.id === flying[0]!.id)!;
  assert.ok(Math.abs(was.x - FIGHT_PACE.flee - flying[0]!.x) < 1e-9 || flying[0]!.x < -FIGHT_GONE);
  assert.equal(now.s, s);
  // Once over: its dead lying where they fell, the living gone; borne in as the share has them.
  const over = foughtLying(now);
  assert.equal(over.troopers.find((t) => t.id === other.id)!.size, his.size);
  assert.equal(over.troopers.find((t) => t.id === me.id)!.size, 0);
  assert.equal(foughtBorne(over, 0), over);
  assert.ok(foughtBorne(over, 1).troopers.every((t) => t.size === 0));
  // The fight's step and second a moment of the world's is at.
  assert.equal(fightStepOf(1000 + 60, 1000), 20);
  assert.equal(fightStepOf(990, 1000), 0);
  assert.equal(fightSecondOf(1000 + 90, 1000, 20), 21.5);
});

const shape = (niche: string, size: number, o: Partial<CreatureBody> = {}): CreatureBody => ({
  ...defaultBody(niche, size, false),
  ...o,
});
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
  fields: [{ x: 160, z: 20, w: 40, d: 25, yaw: 0 }],
  pasture: { x: -200, z: 0, r: 90 },
  wild: 320,
  water: { x: 0, z: -700 },
  house: { walls: "wattle", roof: "thatch", form: "long", pitch: 45, design: null },
  body: null,
  road: { x: 0, z: 1100 },
  people: [],
  fauna: {
    wild: [
      {
        ref: "spec:0:3",
        name: "grey ox",
        niche: "grazer",
        size: 480,
        wool: false,
        stock: 0.9,
        body: shape("grazer", 480, { features: ["horns"] }),
      },
      {
        ref: "spec:0:9",
        name: "spotted bear",
        niche: "hunter",
        size: 280,
        wool: false,
        stock: 0.85,
        body: shape("hunter", 280),
      },
    ],
    flock: {
      ref: "spec:0:4",
      name: "pale woolly sheep",
      size: 60,
      wool: true,
      herders: 6,
      body: shape("grazer", 60, { covering: "wool", features: ["horns"] }),
    },
    raided: false,
  },
};

test("a beast's taking laid out from the beasts drawn about a town: its kinds, its herd, the flock's own, the water and the pasture", () => {
  const f = faunaOf(plan, 160, 2, true),
    out: BeastNow[] = [],
    n = beastsAt(f, 12 * 3600 + 123.4, out),
    at = (ok: (b: BeastNow) => boolean) => out.slice(0, n).findIndex(ok),
    sheep = at((b) => !!f.species[b.species]!.flock && !b.dead && b.id < 900000),
    ox = at((b) => f.species[b.species]!.ref === "spec:0:3" && !b.dead && b.id < 900000);
  assert.ok(sheep >= 0 && ox >= 0, "a sheep of the flock and an ox of the wild drawn");
  const take = beastTakeOf(plan, f, out, n, sheep)!;
  assert.equal(take.name, "a pale woolly sheep of Herdwick's flock");
  assert.equal(take.bodies[0], out[sheep]!.id);
  assert.equal(take.members[0], out[sheep]!.id % 1000);
  assert.deepEqual(take.pasture, [plan.pasture.x, plan.pasture.z, plan.pasture.r]);
  assert.equal(take.water.length, 3);
  assert.equal(take.kinds[0], "spec:0:4");
  assert.ok(take.bodies.length / 6 <= WILD_MOST);
  for (let i = 1; i < take.bodies.length / 6; i++)
    assert.ok(
      Math.hypot(
        take.bodies[i * 6 + 3]! - out[sheep]!.x,
        take.bodies[i * 6 + 4]! - out[sheep]!.z,
      ) <= WILD_GATHER,
    );
  // Its herd's middle, told as the flock's.
  const herd = take.bodies[2]!;
  assert.equal(take.herds[herd * 3 + 2], 1);
  const wild = beastTakeOf(plan, f, out, n, ox)!;
  assert.equal(wild.name, "a grey ox");
  assert.equal(wild.members[0], -1);
  assert.deepEqual(wild.pasture, []);
  assert.equal(beastTakeOf(plan, f, out, n, n), null, "none such");
});

test("the beasts drawn from a held one's small world; a flock's beast lost to it not drawn with it", () => {
  const f = faunaOf(plan, 160, 2, true),
    out: BeastNow[] = [],
    n = beastsAt(f, 12 * 3600 + 123.4, out),
    a = out[0]!,
    b = out[1]!;
  heldBeastsOver(out, n, [
    { id: a.id, x: 7, z: 8, yaw: 1, vx: 5, vz: 0, doing: "run", hurt: 0, struck: -1, lost: -1 },
    { id: b.id, x: 9, z: 9, yaw: 0, vx: 0, vz: 0, doing: "dead", hurt: 0, struck: -1, lost: -1 },
  ]);
  assert.deepEqual([a.x, a.z, a.yaw, a.dead, a.pose.gait], [7, 8, 1, false, 2]);
  assert.deepEqual([b.dead, b.pose.crouch, b.pose.gait], [true, 1, 0]);
  // The flock's first lost by the hand: not drawn until it is let go from the plan.
  const lost: VillagePlan = {
    ...plan,
    fauna: { ...plan.fauna!, flock: { ...plan.fauna!.flock!, gone: [0] } },
  };
  assert.deepEqual(flockMember(lost, 0, 1000), { shown: false, size: 0 });
  assert.equal(flockMember(plan, 0, 1000).shown, true);
});

// An age's living world, as tests/view/meadow.test.ts lays one.
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
let k = 0;
const lineage = (
  name: string,
  niche: string,
  size: number,
  arose: number,
  died: number | null,
) => ({
  ref: `spec:0:${k++}`,
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
  seed: "meadow test",
  name: "meadow test",
  worldAge: 4500,
  rungs: [],
  drop: null,
  acts: { ages: [], dawn: null, lives: [], peopling: { seasLow: false, age: null, cradle: null } },
  peopling: null,
  ages: [age(0), age(1), age(2)],
  lineages: [
    lineage("grey ox", "grazer", 300, 1, null),
    lineage("red cat", "hunter", 150, 1, null),
    lineage("pale hare", "seed-eater", 3, 2, null),
  ],
  people: null,
} as unknown as GenesisPlan;
const run = (s: MeadowState, seconds: number, each?: (s: MeadowState, i: number) => void) => {
  for (let i = 0; i < seconds / MEADOW_STEP; i++) {
    each?.(s, i);
    stepMeadow(s);
  }
};

test("a creature of an age's living world walked in: its body plan's members told, steered at its own walk, its acts as its way of life allows, let go told", () => {
  const m = newMeadow(PLAN, 2);
  run(m, 3);
  const coming = m.beasts.find((b) => b.doing === "coming");
  if (coming) assert.equal(holdMeadow(m, coming.id), null, "not one still walking in");
  const ox = m.beasts.find((b) => m.kinds[b.kind]!.name === "grey ox" && b.doing !== "coming")!,
    h = holdMeadow(m, ox.id)!;
  assert.ok(h && m.hand === h && ox.marked, "held, and followed");
  assert.equal(meadowStrip(m)!.name.endsWith("grey ox"), true);
  // Its strip: its lineage, its way and paces, and its body plan's members from its lineage's own plan.
  const plan = PLAN.lineages[m.kinds[ox.kind]!.lineage]!.body!;
  assert.equal(membersWords(plan), "four legs, fur");
  assert.equal(
    membersWords({
      ...plan,
      legs: 6,
      wings: 4,
      tail: 0.8,
      features: ["beak", "spines"],
      covering: "shell",
    }),
    "six legs, four wings, a long tail, a beak, spines, a shell",
  );
  assert.match(meadowStrip(m, plan)!.carries, /^four legs, fur · 300 kg$/);
  assert.match(meadowStrip(m)!.what, /^grazer of age 3 · walks [\d.]+, runs [\d.]+ m\/s$/);
  assert.deepEqual(
    meadowOffers(m).map((o) => o.act),
    ["eat", "bolt", "court", "call"],
  );
  // East at its walk for two seconds.
  const x0 = ox.x,
    walk = meadowHeld(m)!.k.walk;
  h.mx = 1;
  run(m, 2);
  const went = meadowHeld(m)!.b.x - x0;
  assert.ok(went > walk * 1.5 && went <= walk * 2 + 1e-9, `${went} at ${walk}`);
  h.mx = 0;
  // It eats where it stands, as its way is (or is told why not); bolts at its run.
  h.act = "eat";
  run(m, 1);
  assert.ok(h.told && /eats|grass|No /.test(h.told.words), h.told?.words);
  h.act = "bolt";
  run(m, MEADOW_STEP);
  assert.equal(h.told!.words, "It bolts");
  assert.ok(meadowHeld(m)!.b.speed > walk * 1.5);
  // A hunter's: a spring on the nearest it may take, a kill made a carcass.
  const cat = m.beasts.find((b) => m.kinds[b.kind]!.name === "red cat" && b.doing !== "coming")!;
  assert.match(letGoMeadow(m), /^You let go of the grey ox/);
  assert.equal(m.hand, null);
  const held = holdMeadow(m, cat.id)!;
  assert.deepEqual(
    meadowOffers(m).map((o) => o.act),
    ["spring", "eat", "court", "bolt"],
  );
  const prey = m.beasts.find((b) => m.kinds[b.kind]!.name === "grey ox" && b.doing !== "coming")!;
  meadowHeld(m)!.b.x = prey.x + 1;
  meadowHeld(m)!.b.z = prey.z;
  const carcasses = m.carcasses.length,
    taken = m.taken;
  held.act = "spring";
  run(m, MEADOW_STEP);
  assert.equal(held.killed, 1, held.told?.words);
  assert.equal(m.taken, taken + 1);
  assert.equal(m.carcasses.length, carcasses + 1);
  assert.match(held.told!.words, /^It brought down an? grey ox/);
  assert.match(letGoMeadow(m), /^You let go of the red cat: under your hand it brought down 1/);
});
