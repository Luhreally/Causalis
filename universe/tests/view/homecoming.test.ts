// Phase 55 M226, M229 (T31): the levy home — its litters, two to bear each, kin at the door, the
// town come out by the road. The fixture town.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVITY,
  COLUMN_GAP,
  HOMECOMING,
  MOST_LITTERS,
  bierBetween,
  homecomingsOn,
  littersNow,
  littersOn,
  momentOf,
} from "../../src/view/index.ts";
import { D0, DAY, HOUR, at, woundedPlan } from "./wounded-town.ts";

const near = (a: { x: number; z: number }, b: { x: number; z: number }, d: number) =>
  Math.hypot(a.x - b.x, a.z - b.z) <= d;

test("a litter for the one borne, two to bear it, none of the column", () => {
  const plan = woundedPlan(),
    lits = littersOn(plan, D0);
  assert.equal(lits.length, 1);
  const l = lits[0]!;
  assert.equal(l.index, 3);
  assert.equal(l.event, "e");
  assert.equal(l.bearers.length, 2);
  for (const i of l.bearers) {
    assert.ok(![2, 3, 4, 5].includes(i), `bearer ${i}`);
    assert.ok(!plan.people[i]!.child);
  }
  assert.equal(l.start, at(D0, 16) + 6);
  assert.ok(l.arrive > l.start);
  assert.equal(littersOn(plan, D0 + 1).length, 0);
});

test("set down at the road's end, borne between its bearers, set down at the door", () => {
  const plan = woundedPlan(),
    l = littersOn(plan, D0)[0]!,
    mid = (l.start + l.arrive) / 2;
  assert.equal(littersNow(plan, l.start - 20).length, 0);
  const set = littersNow(plan, l.start - 3);
  assert.equal(set.length, 1);
  assert.equal(set[0]!.borne, false);
  assert.ok(near(set[0]!, l.way[0]!, 1e-9));
  const now = littersNow(plan, mid)[0]!;
  assert.equal(now.borne, true);
  assert.deepEqual(now.bearers, l.bearers);
  const ms = l.bearers.map((i) => momentOf(plan, i, mid)),
    between = bierBetween(ms);
  assert.ok(near(now, between, 1e-9));
  for (const m of ms) {
    assert.equal(m.activity, ACTIVITY.walking);
    assert.equal(m.task, "carry");
    assert.equal(m.carry, "litter");
  }
  // The one borne goes with it, out of sight.
  const borne = momentOf(plan, 3, mid);
  assert.equal(borne.activity, ACTIVITY.abed);
  assert.equal(borne.hidden, true);
  assert.ok(near(borne, now, 1.5), JSON.stringify([borne.x, borne.z, now.x, now.z]));
  const door = littersNow(plan, l.arrive + 30)[0]!;
  assert.equal(door.borne, false);
  assert.ok(near(door, l.way.at(-1)!, 1e-9));
  assert.equal(littersNow(plan, l.arrive + HOMECOMING.setDown + 1).length, 0);
  assert.equal(momentOf(plan, 3, l.arrive + 120).activity, ACTIVITY.abed);
});

test("kin wait at the door; the town comes out by the road", () => {
  const plan = woundedPlan(),
    l = littersOn(plan, D0)[0]!,
    column = [2, 3, 4, 5];
  let kin = 0,
    crowd = 0;
  for (let i = 0; i < plan.people.length; i++) {
    if (column.includes(i)) continue;
    const m = momentOf(plan, i, at(D0, 16) + 5);
    if (m.why?.startsWith("Come to see the levy home from the battle at X")) crowd++;
  }
  for (let t = at(D0, 15.5); t < at(D0, 17.5); t += 300)
    for (const i of [16, 28, 40, 52])
      if (
        !l.bearers.includes(i) &&
        momentOf(plan, i, t).why?.startsWith("Waiting at the door for P4")
      )
        kin++;
  assert.ok(crowd >= 1 && crowd <= HOMECOMING.crowd, `crowd ${crowd}`);
  assert.ok(kin >= 1, `kin ${kin}`);
});

test("a household at the door in rows, at most so many, no two at one spot", () => {
  const full = woundedPlan(),
    // (Twenty more at P4's home, besides 16, 28, 40 and 52.)
    people = full.people.map((p, i) => (i >= 30 && i < 50 ? { ...p, home: 4 } : p)),
    crowded = { ...full, people },
    atDoor = (plan: typeof full) =>
      plan.people
        .map((_, i) => momentOf(plan, i, at(D0, 16) + 5))
        .filter((m) => m.why?.startsWith("Waiting at the door for P4"));
  const few = atDoor(full),
    many = atDoor(crowded);
  assert.ok(few.length >= 1 && few.length <= 4, `${few.length} at the door`);
  assert.equal(many.length, HOMECOMING.door);
  for (const kin of [few, many])
    for (let i = 0; i < kin.length; i++)
      for (let j = i + 1; j < kin.length; j++)
        assert.ok(!near(kin[i]!, kin[j]!, 0.3), `two at the door at one spot (${i}, ${j})`);
});

test("no one to bear them: carried in out of sight", () => {
  const full = woundedPlan(),
    people = full.people.map((p, i) =>
      [2, 3, 4, 5].includes(i) ? p : { ...p, child: true, age: 8 },
    ),
    plan = { ...full, people };
  assert.equal(littersOn(plan, D0).length, 0);
  assert.equal(momentOf(plan, 3, at(D0, 16) + 60).hidden, true);
  assert.equal(momentOf(plan, 3, at(D0, 22)).activity, ACTIVITY.abed);
});

test("at most so many litters a day", () => {
  const full = woundedPlan(),
    people = full.people.map((p, i) =>
      i >= 22 && i < 22 + MOST_LITTERS + 2
        ? {
            ...p,
            child: false,
            age: 30,
            away: full.people[3]!.away,
            wounds: full.people[3]!.wounds,
          }
        : p,
    ),
    plan = { ...full, people };
  assert.equal(littersOn(plan, D0).length, MOST_LITTERS);
});

test("two columns on a day come in one after the other; one crowd sees them in", () => {
  const full = woundedPlan(),
    people = full.people.map((p, i) =>
      i === 0
        ? {
            ...p,
            away: [{ event: "e2", from: D0 * DAY, until: at(D0, 16), where: "the battle at Y" }],
          }
        : p,
    ),
    plan = { ...full, people },
    comings = homecomingsOn(plan, D0);
  assert.deepEqual(
    comings.map((h) => h.event),
    ["e", "e2"],
  );
  const [a, b] = comings as [(typeof comings)[0], (typeof comings)[0]],
    lastOfA = a.people.at(-1)!;
  // (The first's last man is one who stood: the second comes in after him, and a gap.)
  assert.equal(b.at - lastOfA.at, COLUMN_GAP.stood + COLUMN_GAP.between);
  assert.equal(b.people[0]!.at, b.at);
  assert.equal(momentOf(plan, 0, b.at - 30).hidden, true);
  const walking = momentOf(plan, 0, b.at + 30);
  assert.equal(walking.activity, ACTIVITY.walking);
  assert.ok(walking.why!.startsWith("Coming home from the battle at Y"), walking.why!);
  // One crowd for both, each where no other stands.
  const crowd = plan.people
    .map((_, i) => momentOf(plan, i, at(D0, 16) + 5))
    .filter((m) => m.why?.startsWith("Come to see the levy home"));
  assert.ok(crowd.length >= 1 && crowd.length <= HOMECOMING.crowd, `crowd ${crowd.length}`);
  for (const m of crowd) assert.equal(m.why, "Come to see the levy home from the battles");
  for (let i = 0; i < crowd.length; i++)
    for (let j = i + 1; j < crowd.length; j++)
      assert.ok(!near(crowd[i]!, crowd[j]!, 0.3), `two of the crowd at one spot (${i}, ${j})`);
});

test("the same plan, the same litters", () => {
  const a = woundedPlan();
  assert.deepEqual(littersOn(a, D0), littersOn(structuredClone(a), D0));
});
