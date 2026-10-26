// Phase 55 M226, M229 (T20): a town's day as its wounds, the levy and the care of the wounded make
// it — away with the levy, home and abed, the healer's round, kept home to tend, a neighbour looking
// in, struck down where they were, up and bound, on a crutch at their ease. The fixture town.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVITY,
  careOn,
  legsTold,
  momentOf,
  townDay,
  villageSolids,
} from "../../src/view/index.ts";
import { D0, DAY, HOUR, at, woundedPlan } from "./wounded-town.ts";

test("away with the levy all day: out of sight, at the road's end", () => {
  const plan = woundedPlan(),
    m = momentOf(plan, 0, at(D0 + 1, 12));
  assert.equal(m.activity, ACTIVITY.away);
  assert.equal(m.hidden, true);
  const legs = legsTold(plan, 0, D0 + 1);
  assert.equal(legs.length, 1);
  assert.ok(legs[0]!.why!.startsWith("Away with the levy"), legs[0]!.why!);
});

test("home from the road: away till their place in the column, in, then abed or their evening", () => {
  const plan = woundedPlan();
  for (const i of [2, 4]) assert.equal(momentOf(plan, i, at(D0, 15)).hidden, true, `${i} away`);
  const walking = momentOf(plan, 2, at(D0, 16) + 60 + 30);
  assert.equal(walking.activity, ACTIVITY.walking);
  assert.ok(walking.why!.startsWith("Coming home from"), walking.why!);
  const evening = momentOf(plan, 2, at(D0, 20));
  assert.equal(evening.activity, ACTIVITY.eating);
  assert.equal(evening.hidden, false);
  const abed = momentOf(plan, 4, at(D0, 23));
  assert.equal(abed.activity, ACTIVITY.abed);
  assert.equal(abed.hidden, true);
  assert.equal(momentOf(plan, 3, at(D0 + 2, 12)).activity, ACTIVITY.abed);
});

test("the healer's round, and salves made at home", () => {
  const plan = woundedPlan(),
    legs = legsTold(plan, 1, D0 + 1),
    first = legs.find((l) => l.task === "heal")!;
  assert.ok(first, JSON.stringify(legs));
  assert.ok(first.why!.startsWith("Dressing P"), first.why!);
  assert.ok(legs.some((l) => l.task === "grind" && l.why!.startsWith("Making salves")));
  const m = momentOf(plan, 1, at(D0 + 1, 0) + first.to - 60);
  assert.equal(m.task, "heal");
  assert.equal(m.activity, ACTIVITY.working);
  assert.equal(m.hidden, false);
  // Every visit of the script is laid, in its order.
  const script = careOn(plan, D0 + 1).scripts.get(1)!,
    told = legs.filter((l) => l.task === "heal" || l.task === "grind").map((l) => l.why);
  assert.deepEqual(
    told,
    script.map((v) => v.why),
  );
});

test("one kept home to tend one of theirs abed", () => {
  const plan = woundedPlan(),
    m = momentOf(plan, 18, at(D0 + 51, 12));
  assert.equal(m.activity, ACTIVITY.home);
  assert.equal(m.hidden, false);
  assert.ok(m.why!.startsWith("At home, tending P6"), m.why!);
});

test("a neighbour looks in on one abed with no one at home", () => {
  const plan = woundedPlan(),
    calls = careOn(plan, D0 + 1).calls;
  assert.equal(calls.length, 2);
  const c = calls[0]!,
    m = momentOf(plan, c.who, c.until - 60);
  assert.ok(m.why!.startsWith("Looking in on P9"), m.why!);
  assert.equal(m.activity, ACTIVITY.gathering);
});

test("struck down, or killed, where their day had them", () => {
  const plan = woundedPlan();
  assert.notEqual(momentOf(plan, 6, at(D0 + 50, 11) - 60).activity, ACTIVITY.abed);
  const m = momentOf(plan, 6, at(D0 + 50, 11) + 60);
  assert.equal(m.activity, ACTIVITY.abed);
  assert.equal(m.hidden, true);
  assert.notEqual(momentOf(plan, 7, at(D0 + 60, 9) - 60).activity, ACTIVITY.gone);
  assert.equal(momentOf(plan, 7, at(D0 + 60, 9) + 60).activity, ACTIVITY.gone);
  assert.equal(momentOf(plan, 7, at(D0 + 61, 12)).hidden, true);
});

test("up and bound: dressed at the healer's on its day, an hour in the square", () => {
  const plan = woundedPlan(),
    legs = legsTold(plan, 4, D0 + 6);
  assert.ok(
    legs.some((l) => l.why === "Having the wound dressed by P1 Test, the healer"),
    JSON.stringify(legs.map((l) => l.why)),
  );
  assert.ok(legs.some((l) => l.task === "talk" && l.why!.endsWith("the wound bound")));
  const off = legsTold(plan, 4, D0 + 7);
  assert.ok(!off.some((l) => l.why?.startsWith("Having the wound dressed")));
});

test("on a crutch: kept from the town's work, at their ease near home", () => {
  const plan = woundedPlan(),
    town = townDay(plan, D0 + 2, villageSolids(plan));
  assert.equal(town.roles[10]?.kind ?? "as-ever", "as-ever");
  assert.equal(town.roles[3]?.kind ?? "as-ever", "as-ever");
  for (let h = 8; h < 17; h += 0.5)
    assert.notEqual(momentOf(plan, 10, at(D0 + 2, h)).activity, ACTIVITY.working, `at ${h}`);
});

test("the same plan, the same day", () => {
  const a = woundedPlan(),
    b = structuredClone(a);
  for (const i of [0, 1, 2, 3, 4, 6, 18])
    assert.deepEqual(legsTold(a, i, D0 + 1), legsTold(b, i, D0 + 1), `person ${i}`);
});
