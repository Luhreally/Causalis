// Phase 55 M226 (T17): a body's members, where a wound lands on them, what came of it, how it
// shows — for every kind of body, by the same nines as the battle's blows.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLADES,
  CUTS_OFF,
  EYE_LOST,
  KILL,
  LETHAL,
  LIMB_KILL,
  MAIMED_AT,
  MEMBERS,
  NINES,
  anatomyOf,
  hurtWeights,
  lastingOf,
  lostHow,
  lostWeights,
  memberOf,
  outcomeOf,
  woundOf,
  type BodyPlan,
  type Blow,
  type Member,
} from "../../src/rules/index.ts";
import * as blows from "../../src/view/blows.ts";

const BLOWS = Object.keys(LETHAL) as Blow[];
const ape = anatomyOf(null);
const bodyOf = (id: string) => CLADES.find((c) => c.id === id)!.body as unknown as BodyPlan;
const at = (m: Member) => MEMBERS.indexOf(m);
const grid = (f: (r: number) => boolean) => {
  let n = 0;
  for (let k = 0; k < 10000; k++) if (f((k + 0.5) / 10000)) n++;
  return n / 10000;
};

test("an upright ape", () => {
  assert.deepEqual(ape.members, MEMBERS);
  assert.deepEqual(ape.losable, [
    "arm-l",
    "arm-r",
    "hand-l",
    "hand-r",
    "leg-l",
    "leg-r",
    "eye-l",
    "eye-r",
  ]);
  assert.equal(ape.biped, true);
  assert.equal(ape.radial, false);
  assert.equal(ape.words["hand-l"], "~ left hand");
  assert.equal(ape.words.trunk, "~ chest");
  assert.equal(ape.words["eye-r"], "an eye");
  assert.deepEqual(anatomyOf(bodyOf("ape")), ape);
});

test("every kind's own body", () => {
  for (const c of CLADES) {
    const body = c.body as unknown as BodyPlan,
      a = anatomyOf(body);
    for (const m of a.members) assert.ok(MEMBERS.includes(m), `${c.id}: ${m}`);
    assert.ok(a.members.includes("head") && a.members.includes("trunk"), c.id);
    assert.ok(!a.losable.includes("head") && !a.losable.includes("trunk"), c.id);
    for (const m of a.losable) assert.ok(a.members.includes(m), `${c.id}: ${m} losable`);
    const sees = body.senses.includes("sight");
    assert.equal(a.members.includes("eye-l"), sees, `${c.id} eyes`);
    for (const m of a.members) assert.ok((a.words[m] ?? "").length > 0, `${c.id}: ${m} words`);
  }
  const trunk = anatomyOf(bodyOf("trunk"));
  assert.ok(trunk.members.includes("arm-r") && !trunk.members.includes("arm-l"));
  assert.equal(trunk.words["arm-r"], "~ trunk");
  assert.ok(!trunk.losable.includes("arm-r"));
  const burrower = anatomyOf(bodyOf("burrower"));
  assert.ok(!burrower.members.includes("hand-l") && !burrower.members.includes("hand-r"));
  const swimmer = anatomyOf(bodyOf("swimmer"));
  assert.equal(swimmer.radial, true);
  assert.equal(swimmer.biped, false);
  assert.equal(swimmer.words["arm-l"], "one of ~ tentacles");
  assert.equal(swimmer.words["leg-r"], "one of ~ tentacles");
});

test("wounds land by the battle's nines", () => {
  for (const blow of BLOWS) {
    const w = hurtWeights(ape, blow),
      theirs = blows.placeWeights("wounded", "hand", blow, false);
    assert.equal(theirs.length, 8);
    theirs.forEach((x, i) => assert.equal(w[i], x, `${blow}: ${MEMBERS[i]}`));
    assert.equal(w[at("eye-l")], 0);
    assert.equal(w[at("eye-r")], 0);
  }
});

test("what may be lost", () => {
  const edge = lostWeights(ape, "edge", true);
  for (const s of ["l", "r"] as const) {
    assert.equal(edge[at(`arm-${s}`)], 5);
    assert.equal(edge[at(`hand-${s}`)], 4);
    assert.equal(edge[at(`leg-${s}`)], 3);
    assert.equal(edge[at(`eye-${s}`)], EYE_LOST.edge);
  }
  const shot = lostWeights(ape, "shot", false);
  for (const m of ["arm-l", "arm-r", "hand-l", "hand-r", "leg-l", "leg-r"] as const)
    assert.equal(shot[at(m)], NINES[m]);
  assert.equal(shot[at("eye-l")], 1.5);
  for (const c of CLADES) {
    const a = anatomyOf(c.body as unknown as BodyPlan);
    for (const blow of BLOWS)
      for (const cuts of [true, false]) {
        const w = lostWeights(a, blow, cuts);
        MEMBERS.forEach((m, i) => {
          if (!a.losable.includes(m)) assert.equal(w[i], 0, `${c.id} ${blow}: ${m}`);
        });
        assert.ok(w.reduce((s, x) => s + x, 0) > 0, `${c.id} ${blow}: nothing to lose`);
      }
  }
});

test("drawn by weight", () => {
  const w = hurtWeights(ape, "point"),
    total = w.reduce((s, x) => s + x, 0),
    counts = new Map<Member, number>();
  for (let k = 0; k < 10000; k++) {
    const m = memberOf(w, (k + 0.5) / 10000);
    counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  MEMBERS.forEach((m, i) =>
    assert.ok(Math.abs((counts.get(m) ?? 0) / 10000 - w[i]! / total) <= 0.01, m),
  );
  assert.equal(
    memberOf(
      MEMBERS.map(() => 0),
      0.5,
    ),
    "trunk",
  );
});

test("what came of it", () => {
  for (const blow of BLOWS)
    for (const m of ["head", "trunk"] as const)
      assert.equal(
        grid((r) => outcomeOf(m, blow, 0, r) === "lame"),
        0,
        `${blow}: ${m}`,
      );
  assert.ok(Math.abs(grid((r) => outcomeOf("leg-l", "shot", 0, r) === "lame") - 0.18) <= 0.005);
  assert.ok(Math.abs(grid((r) => outcomeOf("leg-l", "shot", 1, r) === "lame") - 0.09) <= 0.005);
  assert.ok(Math.abs(grid((r) => outcomeOf("trunk", "fire", 0, r) === "scarred") - 0.6) <= 0.005);
});

test("how it was lost", () => {
  assert.equal(lostHow("eye-l", true, 0), "put out");
  for (let k = 0; k < 100; k++) {
    const r = (k + 0.5) / 100;
    assert.equal(lostHow("arm-l", true, r), r < 0.45 ? "cut off" : "taken off");
    assert.equal(lostHow("arm-l", false, r), "taken off");
  }
});

test("how it shows", () => {
  assert.equal(lastingOf(ape, "leg-l", "lost"), "crutch");
  assert.equal(lastingOf(anatomyOf(bodyOf("crawler")), "leg-l", "lost"), "limp");
  assert.equal(lastingOf(anatomyOf(bodyOf("swimmer")), "leg-l", "lost"), "stump");
  assert.equal(lastingOf(ape, "eye-r", "lost"), "patch");
  assert.equal(lastingOf(ape, "arm-l", "lame"), "stiff");
  assert.equal(lastingOf(ape, "leg-r", "lame"), "limp");
  assert.equal(lastingOf(ape, "trunk", "scarred"), "scar");
  assert.equal(lastingOf(ape, "hand-l", "healed"), null);
});

test("woundOf", () => {
  for (const blow of BLOWS)
    for (let k = 0; k < 50; k++) {
      const r = (k + 0.5) / 50,
        maimed = woundOf(ape, "maimed", blow, true, 0.5, r, 1 - r, r),
        hurt = woundOf(ape, "hurt", blow, false, 0.5, r, 1 - r, r);
      assert.equal(maimed.outcome, "lost");
      assert.ok(ape.losable.includes(maimed.member), maimed.member);
      assert.notEqual(hurt.outcome, "lost");
      assert.deepEqual(woundOf(ape, "hurt", blow, false, 0.5, r, 1 - r, r), hurt);
    }
});

test("one table, not two", () => {
  assert.equal(blows.NINES, NINES);
  assert.equal(blows.CUTS_OFF, CUTS_OFF);
  assert.equal(blows.MAIMED_AT, MAIMED_AT);
  assert.equal(blows.KILL, KILL);
  assert.equal(blows.LIMB_KILL, LIMB_KILL);
});
