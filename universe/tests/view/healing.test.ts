// Phase 55 M229 (T32): who tends whom on a town's day — the healer's round of a morning, the
// evening's for the newly wounded, the hospital; one kept home to tend; a neighbour looking in;
// kin at the hospital.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { VillagePlan, Wound } from "../../src/bridge/index.ts";
import { ROUNDS, TENDING, careOn, type CareDay } from "../../src/view/index.ts";

const DAY = 86_400,
  HOUR = 3_600,
  D0 = 40 * 365,
  T0 = D0 * DAY;
type Person = VillagePlan["people"][number];
// (Twelve homes twenty metres apart; 54 people, each at home i % 12. 21, 33 and 45 are children,
// so no one else grown lives at home 9.)
const homes = Array.from({ length: 12 }, (_, k) => ({
  x: (k % 4) * 20,
  z: Math.floor(k / 4) * 20,
  yaw: 0,
  household: null,
}));
const young = [21, 33, 45];
const w0: Wound = {
  event: "e",
  from: "battle",
  year: 39,
  where: "the battle at X",
  blow: "edge",
  arm: "a bronze axe",
  member: "arm-l",
  words: "~ left arm",
  outcome: "healed",
  how: null,
  lasting: null,
  at: T0 + 8 * HOUR,
  home: T0 + 16 * HOUR,
  up: T0 + 16 * HOUR + 9 * DAY,
  mended: T0 + 16 * HOUR + 29 * DAY,
  tended: "healer",
  by: "by Yewford's healer, P1 Test",
  borne: false,
};
const away = { event: "e", from: T0, until: T0 + 16 * HOUR, where: "the battle at X" };
/** A strike's wound at `at`: abed `abed` days, then up ten. */
const struck = (event: string, at: number, abed: number, over: Partial<Wound>): Wound => ({
  ...w0,
  event,
  from: "fire",
  blow: "fire",
  where: "the fire in Yewford",
  arm: null,
  at,
  home: at,
  up: at + abed * DAY,
  mended: at + (abed + 10) * DAY,
  ...over,
});

/**
 * The town: 1 its healer; 3 and 7 home from the battle abed in the healer's care (D0, 16h; up nine
 * days on); 4 burned on D0 + 50 at 11h, tended at home (16 lives there too); 9 hurt in a quake on
 * D0 − 1, tended by kin, no one else grown at home.
 */
function planOf(edit?: (ps: Person[]) => void): VillagePlan {
  const ps: Person[] = Array.from({ length: 54 }, (_, i) => ({
    ref: `p${i}`,
    name: `P${i} Test`,
    home: i % 12,
    age: young.includes(i) ? 8 : 30,
    occupation: 0,
    child: young.includes(i),
    sex: i % 2,
  }));
  ps[1] = { ...ps[1]!, healer: { years: 6 } };
  for (const k of [3, 7]) ps[k] = { ...ps[k]!, away: [away], wounds: [w0] };
  ps[4] = {
    ...ps[4]!,
    wounds: [struck("f", (D0 + 50) * DAY + 11 * HOUR, 5, { tended: "household", by: "at home" })],
  };
  ps[9] = {
    ...ps[9]!,
    wounds: [
      struck("q", (D0 - 1) * DAY + 10 * HOUR, 6, {
        from: "quake",
        blow: "crush",
        where: "the quake in Yewford",
        tended: "kin",
        by: "by kin",
      }),
    ],
  };
  edit?.(ps);
  return { homes, people: ps } as unknown as VillagePlan;
}
const far = (a: number, b: number) =>
  Math.hypot(homes[a]!.x - homes[b]!.x, homes[a]!.z - homes[b]!.z);

test("the morning's round", () => {
  const d0 = (D0 + 1) * DAY,
    round = careOn(planOf(), D0 + 1).scripts.get(1)!;
  assert.deepEqual(
    round.map((v) => v.task),
    ["heal", "heal", "grind"],
  );
  const [a, b, grind] = round as [(typeof round)[0], (typeof round)[0], (typeof round)[0]];
  assert.deepEqual([a.to, b.to].sort(), [3, 7]);
  assert.ok(far(1, a.to as number) <= far(1, b.to as number), "the nearest first");
  assert.ok(a.from >= d0 + 7.5 * HOUR);
  for (const v of [a, b]) assert.equal(v.until - v.from, ROUNDS.visit);
  assert.equal(grind.to, 1);
  assert.equal(grind.until, d0 + 17 * HOUR);
});

test("the evening's, for the newly wounded", () => {
  const round = careOn(planOf(), D0).scripts.get(1)!,
    heals = round.filter((v) => v.task === "heal");
  assert.deepEqual(heals.map((v) => v.to).sort(), [3, 7]);
  assert.ok(heals.length <= ROUNDS.fresh);
  for (const v of heals) {
    assert.ok(v.from >= T0 + 17.25 * HOUR, "none of a morning");
    assert.equal(v.until - v.from, ROUNDS.freshVisit);
  }
});

test("at most ten a round", () => {
  const many = [3, 7, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22],
    plan = planOf((ps) => {
      for (const k of many) ps[k] = { ...ps[k]!, away: [away], wounds: [w0] };
    }),
    round = careOn(plan, D0 + 1).scripts.get(1)!,
    morning = round.filter((v) => v.task === "heal" && v.from < (D0 + 1) * DAY + 17 * HOUR);
  assert.equal(morning.length, ROUNDS.most);
});

test("kept home to tend", () => {
  const d0 = (D0 + 51) * DAY;
  assert.deepEqual(careOn(planOf(), D0 + 51).scripts.get(16), [
    {
      who: 16,
      to: 4,
      from: d0 + TENDING.from * HOUR,
      until: d0 + TENDING.until * HOUR,
      task: "tend",
      why: "At home, tending P4, abed with her wounds",
    },
  ]);
});

test("a neighbour looks in", () => {
  const plan = planOf(),
    calls = careOn(plan, D0 + 1).calls.filter((c) => c.to === 9);
  assert.deepEqual(
    calls.map((c) => [c.task, c.from - (D0 + 1) * DAY]),
    TENDING.looks.map((h) => ["tend", h * HOUR]),
  );
  const who = calls[0]!.who,
    home = plan.people[who]!.home;
  assert.ok(calls.every((c) => c.who === who));
  assert.ok(!plan.people[who]!.child);
  assert.notEqual(home, 9);
  for (let h = 0; h < 12; h++) if (h !== 9) assert.ok(far(home, 9) <= far(h, 9), `home ${h}`);
});

test("the hospital", () => {
  const d0 = (D0 + 1) * DAY,
    plan = planOf((ps) => {
      ps[3] = {
        ...ps[3]!,
        wounds: [{ ...w0, tended: "hospital", by: "at the hospital of Yewford" }],
      };
    }),
    care = careOn(plan, D0 + 1),
    round = care.scripts.get(1)!;
  assert.equal(round.length, 1);
  assert.equal(round[0]!.to, "hospital");
  assert.equal(round[0]!.from, d0 + 8 * HOUR);
  assert.equal(round[0]!.until, d0 + 17 * HOUR);
  const visit = care.calls.find((c) => c.to === "hospital")!;
  assert.equal(plan.people[visit.who]!.home, 3);
  assert.equal(visit.from, d0 + TENDING.visit * HOUR);
});

test("no healer fit, no round", () => {
  const plan = planOf((ps) => {
    ps[1] = {
      ...ps[1]!,
      wounds: [struck("h", D0 * DAY + 10 * HOUR, 6, { tended: "household", by: "at home" })],
    };
  });
  assert.equal(careOn(plan, D0 + 1).scripts.get(1), undefined);
});

test("the same plan, the same care", () => {
  const told = (c: CareDay) => JSON.stringify([[...c.scripts.entries()], c.calls]);
  assert.equal(told(careOn(planOf(), D0 + 1)), told(careOn(structuredClone(planOf()), D0 + 1)));
});
