// Phase 55 M226 (T18): wounds seen — what of a figure they hide, cut short, hold or add, for every
// kind of body — and the days they make: away with the levy, home from the road in its column,
// abed, up and bound, struck down, gone.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CLADES } from "../../src/rules/index.ts";
import {
  NO_LOOK,
  type VillagePlan,
  type Wound,
  type WoundLook,
  type WoundMember,
} from "../../src/bridge/index.ts";
import {
  COLUMN_GAP,
  HANDLESS_KEEP,
  LIMP_DIP,
  STUMP_KEEP,
  WOUND_HOLD,
  WOUND_PACE,
  figureOf,
  fitOn,
  homecomingsOn,
  hurtOn,
  unseen,
  woundDay,
  woundGear,
  woundLines,
  woundPace,
  woundPitch,
} from "../../src/view/index.ts";
import { STUMP } from "../../src/render/blows.ts";

const DAY = 86_400,
  HOUR = 3_600,
  D0 = 40 * 365,
  T0 = D0 * DAY;
const MEMBERS: readonly WoundMember[] = [
  "head",
  "trunk",
  "arm-l",
  "arm-r",
  "hand-l",
  "hand-r",
  "leg-l",
  "leg-r",
  "eye-l",
  "eye-r",
];

// —— The figure ——
const fig = figureOf(null, 2),
  head = fig.parts[1]!,
  leftEye = fig.parts.findIndex((p) => p.tone === 4 && p.x > 0);
const look = (over: Partial<WoundLook>): WoundLook => ({ ...NO_LOOK, ...over });

test("a lost arm is a stump, its hand gone", () => {
  const g = woundGear(fig, look({ lost: ["arm-l", "hand-l"] }));
  assert.equal(g.keep[3], STUMP_KEEP);
  assert.equal(g.keep[7], 0);
  g.keep.forEach((k, i) => {
    if (i !== 3 && i !== 7) assert.equal(k, 1, `part ${i}`);
  });
  assert.equal(g.swing[3], WOUND_HOLD.stump);
});

test("a lost eye is patched", () => {
  const g = woundGear(fig, look({ lost: ["eye-l"], patch: "l" }));
  assert.ok(leftEye >= 0);
  assert.equal(g.keep[leftEye], 0);
  const patch = g.props.find((p) => p.kind === "patch")!;
  assert.ok(patch.x > 0 && patch.z > head.z);
  assert.ok(g.props.some((p) => p.kind === "strap"));
});

test("a crutch to the ground", () => {
  const g = woundGear(fig, look({ crutch: "r" })),
    crutch = g.props.filter((p) => p.kind === "crutch");
  assert.equal(crutch.length, 2);
  for (const c of crutch) assert.ok(c.x < 0, "on the figure's right");
  const shaft = crutch[0]!;
  assert.ok(Math.abs(shaft.y - shaft.sy / 2) <= 1e-9);
  assert.ok(shaft.y + shaft.sy / 2 <= 0.33 + 0.09);
  assert.equal(g.hold[2], WOUND_HOLD.crutch);
  assert.equal(g.hold[6], WOUND_HOLD.crutch);
  assert.equal(g.limp, LIMP_DIP);
});

test("held, or swinging less", () => {
  const sling = woundGear(fig, look({ sling: "l" }));
  assert.equal(woundPitch(sling, 3, 0.4), WOUND_HOLD.sling);
  assert.equal(woundPitch(sling, 7, 0.4), -1);
  assert.equal(woundPitch(woundGear(fig, look({ stiff: "l" })), 3, 0.4), 0);
  const limp = woundGear(fig, look({ limp: "l" }));
  assert.ok(Math.abs(woundPitch(limp, 5, 0.4) - 0.4 * 0.35) <= 1e-9);
  assert.equal(woundPitch(limp, 4, 0.4), 0.4);
});

test("bound about the part", () => {
  const leg = woundGear(fig, look({ bound: ["leg-r"] })).bound;
  assert.equal(leg.length, 1);
  assert.equal(leg[0]!.part, 4);
  assert.equal(leg[0]!.along, 0);
  const stump = woundGear(fig, look({ lost: ["leg-r"], bound: ["leg-r"] })).bound;
  assert.equal(stump[0]!.part, 4);
  assert.equal(stump[0]!.along, -0.3);
  const hand = woundGear(fig, look({ lost: ["hand-l"], bound: ["hand-l"] })).bound;
  assert.equal(hand[0]!.part, 3);
});

test("every kind's figure", () => {
  const all = look({
    lost: MEMBERS,
    bound: MEMBERS,
    sling: "l",
    crutch: "r",
    patch: "l",
    scars: MEMBERS,
  });
  for (const c of CLADES)
    for (const detail of [0, 2]) {
      const b = c.body,
        f = figureOf(
          {
            clade: b.clade,
            medium: b.medium,
            symmetry: b.symmetry,
            manipulators: b.manipulators,
            limbs: b.limbs,
            skin: b.skin,
            size: b.size,
            span: b.span,
            folk: null,
          },
          detail,
        ),
        g = woundGear(f, all);
      for (const a of [g.keep, g.hold, g.swing]) assert.equal(a.length, f.parts.length, c.id);
      for (const k of g.keep)
        assert.ok([0, STUMP_KEEP, HANDLESS_KEEP, 1].includes(k), `${c.id}: keep ${k}`);
    }
});

test("the battle's stump", () => {
  assert.equal(STUMP_KEEP, STUMP.keep);
});

// —— The days ——
type Person = VillagePlan["people"][number];
const man = (k: number, over: Partial<Person> = {}): Person => ({
  ref: `p${k}`,
  name: `P${k} Test`,
  home: k,
  age: 30,
  occupation: 0,
  child: false,
  sex: 1,
  ...over,
});
const planOf = (...people: Person[]) => ({ people }) as unknown as VillagePlan;
const w0: Wound = {
  event: "ev:0:900",
  from: "battle",
  year: 312,
  where: "the battle at Pounholt's land",
  blow: "edge",
  arm: "a bronze axe",
  member: "hand-l",
  words: "~ left hand",
  outcome: "lost",
  how: "cut off",
  lasting: "stump",
  at: 1000,
  home: 2000,
  up: 3000,
  mended: 4000,
  tended: "healer",
  by: "by Sairis's healer, Mira Vell",
  borne: false,
};
/** A wound of the battle "e": dealt at 8h on D0, home at 16h, up five days on, mended ten after. */
const battle = (over: Partial<Wound> = {}): Wound => ({
  ...w0,
  event: "e",
  year: 39,
  at: T0 + 8 * HOUR,
  home: T0 + 16 * HOUR,
  up: T0 + 16 * HOUR + 5 * DAY,
  mended: T0 + 16 * HOUR + 15 * DAY,
  ...over,
});
/** One long mended by D0. */
const old = (over: Partial<Wound> = {}): Wound =>
  battle({
    at: T0 - 60 * DAY,
    home: T0 - 59 * DAY,
    up: T0 - 50 * DAY,
    mended: T0 - 30 * DAY,
    ...over,
  });
const away = { event: "e", from: T0, until: T0 + 16 * HOUR, where: "the battle at X" };
const lostLeg = { member: "leg-l", words: "~ left leg", lasting: "crutch" } as const;
const fire = (at: number): Wound =>
  battle({
    event: "ev:0:950",
    from: "fire",
    blow: "fire",
    where: "the fire in Sairis",
    arm: null,
    member: "arm-r",
    words: "~ right arm",
    outcome: "scarred",
    how: null,
    lasting: "scar",
    at,
    home: at,
    up: at + 4 * DAY,
    mended: at + 12 * DAY,
  });

test("away with the levy, and home", () => {
  const plan = planOf(man(0, { away: [away] }));
  assert.equal(woundDay(plan, 0, D0 - 1).kind, "whole");
  const home = woundDay(plan, 0, D0);
  assert.equal(home.kind, "home");
  if (home.kind === "home") {
    assert.ok(home.at >= 16 * HOUR);
    assert.equal(home.then, "whole");
    assert.equal(home.borne, false);
  }
  const long = planOf(man(0, { away: [{ ...away, until: T0 + 2 * DAY + 16 * HOUR }] }));
  assert.equal(woundDay(long, 0, D0 + 1).kind, "away");
});

test("homecomingsOn: the borne, the walking wounded, the rest; a day's columns in turn", () => {
  const people = [
      man(0, { away: [away] }),
      man(1, { away: [away], wounds: [battle({ borne: true })] }),
      man(2, { away: [away], wounds: [battle()] }),
      man(3, { away: [away] }),
    ],
    [h] = homecomingsOn(planOf(...people), D0);
  assert.deepEqual(
    h!.people.map((q) => [q.index, q.at - (T0 + 16 * HOUR)]),
    [
      [1, 0],
      [2, 40],
      [0, 60],
      [3, 70],
    ],
  );
  const two = homecomingsOn(planOf(...people, man(4, { away: [{ ...away, event: "e2" }] })), D0);
  assert.equal(two.length, 2);
  const gap = 70 + COLUMN_GAP.stood + COLUMN_GAP.between;
  assert.equal(gap, 200);
  assert.equal(two[1]!.event, "e2");
  assert.equal(two[1]!.at, T0 + 16 * HOUR + gap);
  assert.equal(two[1]!.people[0]!.at, T0 + 16 * HOUR + gap);
});

test("abed, then mending, dressed every third day", () => {
  const w = battle(),
    plan = planOf(man(0, { away: [away], wounds: [w] }), man(1, { healer: { years: 6 } }));
  const home = woundDay(plan, 0, D0);
  assert.equal(home.kind, "home");
  if (home.kind === "home") assert.equal(home.then, "abed");
  assert.equal(woundDay(plan, 0, D0 + 2).kind, "abed");
  for (let day = D0 + 6; day < D0 + 15; day++) {
    const wd = woundDay(plan, 0, day);
    assert.equal(wd.kind, "mending", `day ${day - D0}`);
    if (wd.kind === "mending")
      assert.equal(wd.dress !== null, (day - Math.floor(w.up / DAY)) % 3 === 1, `day ${day - D0}`);
  }
});

test("struck down, or killed, where their day had them", () => {
  const struck = woundDay(
    planOf(man(0, { wounds: [fire((D0 + 50) * DAY + 11 * HOUR)] })),
    0,
    D0 + 50,
  );
  assert.equal(struck.kind, "cut");
  if (struck.kind === "cut") {
    assert.equal(struck.at, 11 * HOUR);
    assert.equal(struck.then, "abed");
  }
  const plan = planOf(man(0, { gone: (D0 + 60) * DAY + 9 * HOUR })),
    killed = woundDay(plan, 0, D0 + 60);
  assert.equal(killed.kind, "cut");
  if (killed.kind === "cut") assert.equal(killed.then, "gone");
  assert.equal(woundDay(plan, 0, D0 + 61).kind, "gone");
});

test("unseen: away, abed, gone", () => {
  const w = battle(),
    gone = (D0 + 60) * DAY + 9 * HOUR,
    plan = planOf(man(0, { away: [away], wounds: [w] }), man(1, { gone }));
  assert.equal(unseen(plan, 0, w.home - 1, w.home + 1), true);
  assert.equal(unseen(plan, 0, T0 + HOUR, T0 + 2 * HOUR), true);
  assert.equal(unseen(plan, 0, T0 - DAY + 13 * HOUR, T0 - DAY + 15 * HOUR), false);
  assert.equal(unseen(plan, 1, gone, gone + HOUR), true);
  assert.equal(unseen(plan, 1, gone + 5 * DAY, gone + 5 * DAY + HOUR), true);
});

test("hurtOn and fitOn: what keeps one from the heavy work, and from their own", () => {
  const long = { ...away, until: T0 + 2 * DAY + 16 * HOUR },
    plan = planOf(
      man(0, { away: [long] }),
      man(1, { away: [away], wounds: [battle()] }),
      man(2, { wounds: [old(lostLeg)] }),
      man(3, {
        wounds: [old({ outcome: "scarred", how: null, lasting: "scar", member: "trunk" })],
      }),
      man(4, { wounds: [old()] }),
      man(5, { wounds: [old({ ...lostLeg, outcome: "lame", how: null, lasting: "limp" })] }),
      man(6, {
        wounds: [old({ member: "eye-l", words: "an eye", how: "put out", lasting: "patch" })],
      }),
      man(7),
      man(8, { wounds: [fire((D0 + 50) * DAY + 11 * HOUR)] }),
      man(9, { gone: (D0 + 60) * DAY + 9 * HOUR }),
    );
  // (0 away on D0 + 1; 1 home on D0, abed on D0 + 2, mending on D0 + 6.)
  for (const [i, day] of [
    [0, D0 + 1],
    [1, D0 + 2],
    [1, D0 + 6],
    [2, D0],
  ] as const)
    assert.equal(hurtOn(plan, i, day), true, `${i} on ${day - D0}`);
  assert.equal(hurtOn(plan, 3, D0), false);
  for (const [i, day] of [
    [0, D0 + 1],
    [1, D0],
    [1, D0 + 2],
    [1, D0 + 6],
    [8, D0 + 50],
    [9, D0 + 60],
    [9, D0 + 61],
    [2, D0],
  ] as const)
    assert.equal(fitOn(plan, i, day), false, `${i} on ${day - D0}`);
  for (const i of [4, 5, 6, 7]) assert.equal(fitOn(plan, i, D0), true, `${i}`);
  assert.equal(woundPace(plan, 2, D0), WOUND_PACE.crutch);
  assert.equal(woundPace(plan, 7, D0), 1);
});

test("their wounds told: how one heals now, then the gravest first", () => {
  const p = man(0, {
      wounds: [
        old({ event: "a", outcome: "scarred", how: null, lasting: "scar", member: "trunk" }),
        old({ event: "b", outcome: "healed", how: null, lasting: null, member: "arm-r" }),
        old({ event: "c", ...lostLeg, outcome: "lame", how: null, lasting: "limp" }),
        battle(),
      ],
    }),
    lines = woundLines(p, T0 + 16 * HOUR + 6 * DAY);
  assert.ok(lines[0]!.startsWith("Up again"), lines[0]);
  assert.ok(lines.length <= 4);
  assert.ok(lines[1]!.startsWith("Lost"), lines[1]);
});
