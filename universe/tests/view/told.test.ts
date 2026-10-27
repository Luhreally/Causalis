import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  BattleNear,
  BattleSideNear,
  RollEntry,
  StruckMember,
  WoundMember,
} from "../../src/bridge/index.ts";
import {
  newBattle,
  newBlows,
  placeOfMember,
  struckOf,
  toldBlows,
  type BattleField,
  type Blows,
} from "../../src/view/index.ts";

// Phase 55 wave 5: a battle seen near struck as history struck the men its figures stand for — the
// dead where the blow that killed them fell, the living where their wound did, a member cut off only
// where history cut it off there — and every figure's fate the same as the battle view drew it.

const side = (name: string, arm: string, extra: Partial<BattleSideNear>): BattleSideNear => ({
  ref: `realm:${name}`,
  name: `the realm of ${name}`,
  color: [0.8, 0.2, 0.2],
  arms: null,
  fielded: 900,
  fallen: 180,
  host: { arm, guard: "shield", mount: "" },
  kit: `${arm}s`,
  ...extra,
});
const near = (a: BattleSideNear, d: BattleSideNear): BattleNear => ({
  event: "ev:0:told",
  war: "war:1",
  title: "The battle at the test land",
  cell: 1,
  land: "The test land",
  year: 100,
  attacker: a,
  defender: { ...d, color: [0.2, 0.3, 0.85] },
  won: true,
  outcome: "field",
  civil: null,
  hills: false,
  river: false,
  walls: 0,
  town: null,
  figure: null,
  plan: {
    seed: "test battle",
    ages: [
      { index: 0, from: 0, to: 0, kind: "quiet", seaLevel: 0, warmth: 0, forests: true },
    ] as never,
    lineages: [],
  },
});
// (Axes against swords: edges that cut limbs off, and history's maimed among the wounded.)
const field = (): BattleField =>
  newBattle(
    near(
      side("Ash", "axe", { wounded: 380, maimed: 40 }),
      side("Elm", "sword", { fielded: 700, fallen: 220, wounded: 300, maimed: 50 }),
    ),
    360,
  );

const fate = (f: BattleField, b: Blows, id: number) => {
  if (f.troopers[id]!.falls !== null) return "fell";
  const k = b.of[id] ?? -1,
    hit = k >= 0 ? b.hits[k]! : null;
  return !hit || hit.back === null
    ? "stood"
    : hit.lost !== null || hit.shattered
      ? "maimed"
      : "wounded";
};
const MEMBERS: readonly WoundMember[] = [
  "head",
  "trunk",
  "arm-l",
  "leg-r",
  "eye-l",
  "hand-r",
  "leg-l",
];

test("a member history tells lands where a figure is drawn: an eye on the head", () => {
  assert.equal(placeOfMember("eye-l"), "head");
  assert.equal(placeOfMember("eye-r"), "head");
  for (const m of [
    "head",
    "trunk",
    "arm-l",
    "arm-r",
    "hand-l",
    "hand-r",
    "leg-l",
    "leg-r",
  ] as const)
    assert.equal(placeOfMember(m), m);
});

test("each named man struck where history struck him; every figure's fate as drawn; the rest unchanged", () => {
  const f = field(),
    drawn = newBlows(f);
  assert.deepEqual(newBlows(f, null), drawn, "told nothing: the battle view's own");
  // (Every struck figure named, a member told for each: cut off for every other maimed one.)
  const names: (RollEntry | null)[] = f.troopers.map(() => null),
    members: Record<string, StruckMember> = {};
  let n = 0;
  for (const t of f.troopers) {
    const k = drawn.of[t.id] ?? -1;
    if (k < 0) continue;
    const ref = `lv:${t.id}`,
      member = MEMBERS[n % MEMBERS.length]!;
    names[t.id] = { ref, name: `Man ${t.id}`, place: 0, age: 30, kept: false };
    members[ref] = { member, cut: fate(f, drawn, t.id) === "maimed" && n % 2 === 0 };
    n++;
  }
  // (One named whom history does not know: struck as drawn.)
  const unknown = f.troopers.find((t) => names[t.id] && t.falls === null)!;
  delete members[names[unknown.id]!.ref];
  const told = newBlows(f, toldBlows(names, members));
  let cut = 0,
    shattered = 0;
  for (const t of f.troopers) {
    assert.equal(fate(f, told, t.id), fate(f, drawn, t.id), `figure ${t.id}'s fate`);
    const k = told.of[t.id] ?? -1;
    assert.equal(k, drawn.of[t.id] ?? -1, `figure ${t.id}'s hit`);
    if (k < 0) continue;
    const hit = told.hits[k]!,
      was = drawn.hits[k]!,
      m = members[`lv:${t.id}`];
    assert.equal(hit.at, was.at, `figure ${t.id} struck when drawn`);
    if (!m) {
      assert.deepEqual(hit, was, "one history does not know: as drawn");
      continue;
    }
    assert.equal(hit.place, placeOfMember(m.member), `figure ${t.id} struck in history's member`);
    // (A blow history tells on the trunk lands on the chest, as the body's words have it.)
    if (hit.place === "trunk") assert.ok(hit.v > 0.1, `figure ${t.id} struck below the chest`);
    if (hit.back !== null && fate(f, told, t.id) === "maimed") {
      const limb = hit.place !== "head" && hit.place !== "trunk";
      assert.equal(hit.lost !== null, m.cut && limb, `figure ${t.id} cut off as history says`);
      if (hit.lost) cut++;
      if (hit.shattered) shattered++;
    }
    if (hit.back !== null && fate(f, told, t.id) === "wounded") assert.equal(hit.lost, null);
  }
  assert.ok(cut >= 1 && shattered >= 1, `${cut} cut off, ${shattered} shattered`);
  assert.deepEqual(told.dead, drawn.dead);
  assert.deepEqual(told.hurt, drawn.hurt);
  assert.deepEqual(told.maimed, drawn.maimed);
  assert.deepEqual(newBlows(f, toldBlows(names, members)), told, "the same on every asking");
});

test("a named man's body as the battle so far leaves him: in history's member, from his blow on", () => {
  const f = field(),
    drawn = newBlows(f),
    t = f.troopers.find((x) => x.falls !== null)!,
    hit = drawn.hits[drawn.of[t.id]!]!;
  assert.deepEqual(struckOf(f, drawn, t.id, hit.at - 0.01), []);
  assert.deepEqual(struckOf(f, drawn, t.id, hit.at, "eye-r"), [
    { member: "eye-r", lost: hit.lost !== null && hit.lost === hit.place, fell: true },
  ]);
  assert.equal(struckOf(f, drawn, t.id, hit.at)[0]!.member, hit.place);
});
