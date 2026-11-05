// War past the line, W2: a raid over a town as it is seen. One tight stream across the town, its hits walking along under
// it, first of all those under the machines drawn; by day; the eye low and ahead of them.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SPREAD,
  type LotStates,
  type TownLots,
  type TownPlan,
  type TownStrike,
} from "../../src/bridge/index.ts";
import {
  MOST_FALLING,
  MOST_RAIDERS,
  raidEye,
  raidFilm,
  raidNow,
  raidOver,
  raidRun,
  raidSlowings,
  raidSpan,
  timeRaids,
  type TownScene,
} from "../../src/view/index.ts";

const raid = (over: Partial<TownStrike> = {}): TownStrike =>
  ({
    kind: "raid",
    at: 1000 * 365 * 86_400,
    lot: -1,
    homes: 400,
    event: "ev:0:5",
    raid: { by: "the league of Gel", flyers: 666, span: 17, speed: 47 },
    ...over,
  }) as TownStrike;

/** A ring of lots about the heart, and a raid that burned the lots in `hit`. */
function scene(k: TownStrike, hit: (p: number) => boolean, lots = 2000): TownScene {
  const x = new Float32Array(lots),
    z = new Float32Array(lots),
    struck = new Int16Array(lots).fill(-1),
    began = new Float64Array(lots),
    list: number[] = [];
  for (let p = 0; p < lots; p++) {
    // (A plan's lots go out as r².)
    const r = 12 * Math.sqrt(p),
      a = p * 2.399963;
    x[p] = r * Math.cos(a);
    z[p] = r * Math.sin(a);
    if (hit(p)) {
      struck[p] = 0;
      began[p] = k.at + SPREAD.raidFrom;
      list.push(p);
    }
  }
  const plan = { lots, struck: [k] } as unknown as TownPlan,
    states = { struck, began } as unknown as LotStates,
    made = { x, z } as unknown as TownLots;
  timeRaids(plan, made, states);
  list.sort((a, b) => began[a]! - began[b]!);
  return { plan, states, lots: made, struck: list } as unknown as TownScene;
}

test("a raid comes by day", () => {
  const hour = (SPREAD.raidFrom % 86_400) / 3600;
  assert.ok(hour >= 8 && hour <= 15, `at ${hour} o'clock`);
});

test("its machines fly in a stream, the most drawn at once kept to", () => {
  const k = raid(),
    s = scene(k, (p) => p % 5 === 0),
    { from, to } = raidRun(k),
    now = raidNow(s, (from + to) / 2);
  assert.ok(now.flyers.length > 0 && now.flyers.length <= MOST_RAIDERS);
  assert.equal(now.by, "the league of Gel");
  // Abreast no wider than a tight formation, whatever the lots burned lie: they are a few of the many.
  const heading = now.flyers[0]!.yaw,
    aside = now.flyers.map((f) => f.x * Math.cos(heading) - f.z * Math.sin(heading));
  assert.ok(
    Math.max(...aside.map(Math.abs)) < k.raid!.span * 4,
    `${Math.max(...aside.map(Math.abs))} m aside`,
  );
});

test("a hit lands when a row is over it, by how far along the machines' way it lies", () => {
  const k = raid(),
    s = scene(k, () => true, 2000),
    run = raidRun(k),
    heading = raidNow(s, run.from).flyers[0]!.yaw,
    ux = Math.sin(heading),
    uz = Math.cos(heading),
    { x, z } = s.lots,
    late = (p: number) => s.states.began[p]! - run.from - (x[p]! * ux + z[p]! * uz) / k.raid!.speed;
  for (let p = 0; p < 2000; p += 37) {
    // (Over some row's moment, and a little after it for the load's own scatter.)
    const off = late(p);
    assert.ok(
      off >= -0.01 && off <= run.to - run.from + 2.01,
      `lot ${p} is ${off} s after the first row`,
    );
  }
});

test("it flies over the first of what it burns", () => {
  const k = raid({ event: "ev:0:9" }),
    // (One stretch of lots: the first of them lie to one side of the heart.)
    s = scene(k, (p) => p >= 200 && p < 203),
    run = raidRun(k),
    f = raidNow(s, run.from).flyers[0]!,
    ux = Math.sin(f.yaw),
    uz = Math.cos(f.yaw),
    { x, z } = s.lots,
    aside = Math.abs(x[200]! * uz - z[200]! * ux);
  assert.ok(aside < 170, `the first hit lies ${aside} m aside of its way`);
});

test("those under the machines fall first, the rest of a great raid not drawn", () => {
  const k = raid({ event: "ev:0:11" }),
    s = scene(k, () => true, 2000),
    run = raidRun(k),
    now = raidNow(s, run.from + 10);
  assert.ok(now.falling.length > 0 && now.falling.length <= MOST_FALLING);
});

test("nothing over the town before it comes or after it has gone", () => {
  const k = raid(),
    s = scene(k, (p) => p % 5 === 0),
    run = raidRun(k);
  assert.equal(raidNow(s, run.from - 3600).flyers.length, 0);
  assert.equal(raidNow(s, run.to + 3600).flyers.length, 0);
  assert.equal(raidOver(s.plan, run.from - 3600), null);
  assert.equal(raidOver(s.plan, run.from), k);
  assert.equal(raidOver(s.plan, run.to + 3600), null);
});

test("the eye goes low and ahead of the machines, looking back up their way", () => {
  const k = raid(),
    s = scene(k, (p) => p % 5 === 0),
    f = raidNow(s, raidRun(k).from).flyers[0]!,
    v = raidEye(k),
    off = (((v.yaw - (f.yaw * 180) / Math.PI) % 360) + 360) % 360;
  assert.equal(v.pitch, -8);
  assert.ok(off === 344 || Math.abs(off - 344) < 1e-6, `${off}° off their way`);
});

test("a town's clock slows for its raid", () => {
  const k = raid(),
    plan = { lots: 0, struck: [k] } as unknown as TownPlan,
    [slow] = raidSlowings(plan);
  assert.equal(slow?.cap, "raid");
  assert.ok(slow!.from < raidRun(k).from && slow!.to > raidRun(k).to);
});

test("a raid on a town in ruins, all it burned out beyond what is drawn: its loads still fall on what lies under its stream", () => {
  const n = 600,
    x = new Float32Array(n),
    z = new Float32Array(n);
  for (let p = 0; p < n; p++) {
    x[p] = ((p % 25) - 12) * 12;
    z[p] = (Math.floor(p / 25) - 12) * 12;
  }
  const k = raid({ homes: 18000 }),
    plan = { lots: n, struck: [k] } as unknown as TownPlan,
    states = {
      began: new Float64Array(n),
      struck: new Int16Array(n).fill(-1),
    } as unknown as LotStates;
  timeRaids(plan, { x, z } as unknown as TownLots, states);
  const scene = { plan, struck: [], states, lots: { x, z } } as unknown as TownScene,
    run = raidRun(k),
    middle = raidNow(scene, (run.from + run.to) / 2);
  assert.ok(middle.falling.length + middle.bursts.length > 0, "nothing falls from them");
  assert.deepEqual(raidNow(scene, raidSpan(k).from - 20).bursts, []);
  assert.deepEqual(raidNow(scene, (run.from + run.to) / 2), middle, "the same moment, the same");
  assert.equal(raidNow(scene, raidSpan(k).to + 60).by, null);
});

test("a town lately bombed slows the clock for the morning of the next two turns, in time for the plan to tell of a raid", () => {
  const year = 365 * 86_400,
    k = raid({ at: 700 * year }),
    plan = { struck: [k] } as unknown as TownPlan,
    all = raidSlowings(plan);
  assert.equal(all.length, 3);
  assert.deepEqual(
    all.map((s) => s.from),
    [...all.map((s) => s.from)].sort((a, b) => a - b),
  );
  for (const [i, s] of all.slice(1).entries()) {
    assert.equal(s.from, 700 * year + (i + 1) * year);
    assert.ok(
      s.to > s.from && s.to < s.from + SPREAD.raidFrom,
      "over before any machine could be there",
    );
    assert.ok(s.speed <= (s.to - s.from) / 2, "two seconds at least, for the plan to load");
  }
  assert.equal(raidSlowings({ struck: [] } as unknown as TownPlan).length, 0);
});

test("a raid played again runs from its first machine to its fires, the machines gone in between", () => {
  const k = raid({ at: 700 * 365 * 86_400 }),
    film = raidFilm(k);
  assert.ok(film.from < raidRun(k).from);
  assert.ok(film.calm > raidRun(k).to && film.calm < film.to);
});
