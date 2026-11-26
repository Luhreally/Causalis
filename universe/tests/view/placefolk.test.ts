// A place's people as they are drawn between the host's words (view/placefolk.ts, view/gait.ts): a walk begun and
// ended at rest, shown in the time the host gives it or less; the legs turned by the ground covered, as wide as the
// step reaches, so a foot set down stays put; no two set off together because a tick began; a child's steps shorter
// and quicker, the old slower, by the same reckoning; a door gone in at over a moment; everyone as they stood with the
// clock stopped.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PLACE_ACT, type PlaceFrame, type VillagePlan } from "../../src/bridge/index.ts";
import {
  ACTIVITY,
  BLINK,
  EASY,
  PULL,
  STRIDES,
  WIDEST,
  agePace,
  easyPace,
  figureOf,
  hipOf,
  legSwing,
  strideLength,
  type Moment,
  type Presence,
} from "../../src/view/index.ts";
import { PLACED_SIZE, PlaceBodies, wayGone } from "../../src/view/placefolk.ts";
import { OCC, lifeFigure } from "../../src/rules/index.ts";

const N = 40,
  TICK = 600,
  FPS = 60;

const plan: VillagePlan = {
  ref: "town:0:5",
  name: "Walkham",
  population: 90,
  market: false,
  hand: false,
  districts: null,
  biome: 8,
  seed: 4,
  homes: Array.from({ length: 12 }, (_, k) => {
    const a = k * 2.399963,
      r = 16 + 8.5 * Math.sqrt(k);
    return { x: r * Math.cos(a), z: r * Math.sin(a), yaw: a, household: null };
  }),
  fields: [{ x: 160, z: 20, w: 40, d: 25, yaw: 0 }],
  pasture: { x: -300, z: 0, r: 90 },
  wild: 400,
  water: null,
  house: { walls: "wattle", roof: "thatch", form: "round", pitch: 45, design: null },
  body: null,
  road: { x: 600, z: 800 },
  placed: Array.from({ length: N }, (_, i) => i),
  people: Array.from({ length: N }, (_, i) => ({
    ref: `plc:town:0:5:${i}`,
    name: `Person ${i}`,
    home: i % 12,
    age: i < 6 ? 8 : i === 6 ? 85 : 30,
    occupation: OCC.farmer,
    child: i < 6,
  })) as VillagePlan["people"],
};

/** Lots along a street: lot k stands 30 m on from the one before. */
const lotAt = (lot: number) => ({ x: -60 + 30 * lot, z: 80 });

const frame = (
  t: number,
  each: (i: number) => Partial<Record<"at" | "to" | "eta" | "trip" | "act", number>>,
) =>
  ({
    town: plan.ref,
    t,
    season: 0.5,
    warmth: 15,
    tick: TICK,
    people: N,
    kept: N,
    households: 12,
    at: Array.from({ length: N }, (_, i) => each(i).at ?? 0),
    to: Array.from({ length: N }, (_, i) => each(i).to ?? each(i).at ?? 0),
    eta: Array.from({ length: N }, (_, i) => each(i).eta ?? 0),
    trip: Array.from({ length: N }, (_, i) => each(i).trip ?? 0),
    act: Array.from({ length: N }, (_, i) => each(i).act ?? PLACE_ACT.idle),
    hunger: new Array<number>(N).fill(0),
    tired: new Array<number>(N).fill(0),
    carries: new Array<boolean>(N).fill(false),
    why: new Array<string>(N).fill("Because"),
    doing: [],
    notices: [],
    managed: false,
    unsettled: 0,
    month: 0,
    sites: [],
  }) as PlaceFrame;

const still = (): Moment => ({
  x: 0,
  z: 0,
  yaw: 0,
  activity: ACTIVITY.home,
  task: null,
  hidden: false,
  hunger: 0,
  tiredness: 0,
  carry: null,
  why: null,
});

type Shot = {
  x: number;
  z: number;
  yaw: number;
  size: number;
  stride: number;
  reach: number;
  lean: number;
  walking: boolean;
  hidden: boolean;
};

/**
 * A town watched for `seconds` at `pace` of its clock's seconds a second: the host's word at each tick (`told`: the
 * tick's number), each frame what is drawn of everyone.
 */
function watch(
  pace: number,
  seconds: number,
  told: (tick: number) => PlaceFrame,
  stopAt = Infinity,
): Shot[][] {
  const bodies = new PlaceBodies(plan, lotAt),
    presence = new Map<string, Presence>(),
    out: Shot[][] = [];
  let t = 0;
  for (let f = 0; f < seconds * FPS; f++) {
    if (f / FPS < stopAt) t += pace / FPS;
    bodies.frame = told(Math.floor(t / TICK));
    bodies.at(t);
    const drawn = plan.people.map(() => ({ moment: still(), size: 1, stride: 0 }));
    bodies.pose(drawn, presence, f / FPS);
    out.push(
      drawn.map((d) => ({
        x: d.moment.x,
        z: d.moment.z,
        yaw: d.moment.yaw,
        size: d.size,
        stride: d.stride,
        reach: d.moment.reach ?? 0,
        lean: d.moment.lean ?? 0,
        walking: d.moment.activity === ACTIVITY.walking,
        hidden: d.moment.hidden,
      })),
    );
  }
  return out;
}

/** Everyone at lot 0; on tick 2 those `who` picks set off for lot `to(i)`, a tick's walk. */
const setOff =
  (who: (i: number) => boolean, to: (i: number) => number) =>
  (tick: number): PlaceFrame =>
    frame(tick * TICK, (i) =>
      !who(i) || tick < 2
        ? { at: 0 }
        : tick === 2
          ? { at: 0, to: to(i), eta: 1, trip: 1 }
          : { at: to(i) },
    );

const steps = (shots: Shot[][], i: number) =>
  shots.map((s, f) =>
    f ? Math.hypot(s[i]!.x - shots[f - 1]![i]!.x, s[i]!.z - shots[f - 1]![i]!.z) : 0,
  );

const figure = lifeFigure(figureOf(null, 0), null),
  legs = hipOf(figure),
  HIP = ((legs.hip * figure.scale) / 0.1) * PLACED_SIZE;

test("a walk's share of its way rises from rest and comes to rest, never jumping", () => {
  for (const r of [0, 0.1, 0.34, 0.5]) {
    let was = 0,
      most = 0;
    for (let k = 1; k <= 1000; k++) {
      const now = wayGone(k / 1000, r);
      assert.ok(now >= was - 1e-12, "it never goes back");
      most = Math.max(most, now - was);
      was = now;
    }
    assert.ok(Math.abs(wayGone(1, r) - 1) < 1e-9 && wayGone(0, r) === 0);
    if (r > 0) {
      assert.ok(wayGone(0.001, r) < 0.0002, "begun from rest");
      assert.ok(1 - wayGone(0.999, r) < 0.0002, "ended at rest");
      // (Its middle pace is the whole way over the time less one start: no faster.)
      assert.ok(most <= 1.001 / (1000 * (1 - r)), `the most in a step ${most}`);
    }
  }
});

test("a grown ape's stride, pace and swing are a body's: about a walker's of our own kind", () => {
  // (True to life, not as large as a place draws them: a hip some 0.8 m up.)
  const hip = HIP / PLACED_SIZE,
    pace = easyPace(hip),
    stride = strideLength(pace, hip);
  assert.ok(hip > 0.6 && hip < 1, `a hip ${hip.toFixed(2)} m up`);
  assert.ok(pace > 1.1 && pace < 1.6, `an easy pace of ${pace.toFixed(2)} m/s`);
  assert.ok(stride > 1.1 && stride < 1.7, `a stride of ${stride.toFixed(2)} m`);
  // (The step a leg reaches is the step taken: two of them the stride, so a foot down stays put.)
  assert.ok(Math.abs(4 * hip * Math.sin(legSwing(pace, hip)) - stride) < 1e-9);
  assert.ok(Math.abs((pace * pace) / (PULL * hip) - EASY) < 1e-9);
  // (Past a walk's end the swing is no wider: the stride is lengthened by flight.)
  assert.equal(legSwing(30, hip), WIDEST);
  assert.ok(strideLength(30, hip) > 4 * hip * Math.sin(WIDEST));
});

test("a walk begins and ends at rest, is done within its tick and a second, and no step is a jump", () => {
  for (const pace of [60, 600]) {
    const shots = watch(
        pace,
        pace === 60 ? 34 : 6,
        setOff(
          (i) => i === 10,
          () => 3,
        ),
      ),
      far = steps(shots, 10),
      moved = far.map((d, f) => (d > 1e-6 ? f : -1)).filter((f) => f >= 0),
      from = moved[0]!,
      until = moved[moved.length - 1]!,
      most = Math.max(...far),
      whole = far.reduce((a, b) => a + b, 0);
    assert.ok(whole > 80 && whole < 100, `the way was ${whole.toFixed(1)} m`);
    assert.ok(far[from]! < most / 8, `at ${pace}: the first step ${far[from]} of ${most}`);
    assert.ok(far[until]! < most / 8, `at ${pace}: the last step ${far[until]} of ${most}`);
    // (Set off on tick 2: there by the end of tick 3, or a second of the watcher's after.)
    const due = ((3 * TICK) / pace + 1) * FPS;
    assert.ok(from >= (2 * TICK * FPS) / pace - 1, `at ${pace}: not before its tick (${from})`);
    assert.ok(until <= due + 30, `at ${pace}: there by frame ${due} (${until})`);
    // (No step a jump: each within a fifth of the one before, once going.)
    for (let f = from + 3; f <= until; f++)
      assert.ok(
        Math.abs(far[f]! - far[f - 1]!) <= 0.2 * most + 1e-9,
        `at ${pace}: frame ${f} went ${far[f]} after ${far[f - 1]}`,
      );
    // (They face the way they go, and lean into the start and back from the stop.)
    const mid = Math.floor((from + until) / 2),
      a = shots[mid]![10]!;
    assert.ok(Math.abs(Math.sin(a.yaw) - 1) < 0.05, `facing down the street (${a.yaw})`);
    assert.ok(a.walking && a.reach > 0);
    assert.ok(
      Math.max(...shots.slice(from, mid).map((s) => s[10]!.lean)) > 0.02,
      "leant into the start",
    );
    assert.ok(
      Math.min(...shots.slice(mid, until + 20).map((s) => s[10]!.lean)) < -0.02,
      "leant back to stop",
    );
    assert.ok(Math.abs(shots[shots.length - 1]![10]!.lean) < 0.01, "upright at rest");
    assert.equal(shots[shots.length - 1]![10]!.reach, 0);
  }
});

test("the legs turn by the ground covered: at a walk a stride's two steps reach as far as the body goes", () => {
  // (Twenty of its seconds a second, a way of some 30 m: a tick is half a minute of the watcher's, time to walk it at
  // one's own easy pace. At a minute a second it is ten seconds, too few: the walk is hurried to fit.)
  const shots = watch(
      20,
      100,
      setOff(
        (i) => i === 10,
        () => 1,
      ),
    ),
    far = steps(shots, 10),
    most = Math.max(...far),
    pace = most * FPS,
    own = easyPace(HIP);
  assert.ok(
    Math.abs(pace - own) < 0.06 * own,
    `walked at ${pace.toFixed(2)} m/s, their own ${own.toFixed(2)}`,
  );
  let ground = 0,
    turned = 0,
    reached = 0,
    frames = 0;
  for (let f = 1; f < shots.length; f++) {
    if (far[f]! < 0.98 * most) continue;
    ground += far[f]!;
    turned += (shots[f]![10]!.stride - shots[f - 1]![10]!.stride) * STRIDES;
    reached += 4 * HIP * Math.sin(shots[f]![10]!.reach * legs.swing);
    frames++;
  }
  assert.ok(frames > 60, `at its full pace for ${frames} frames`);
  const stride = ground / turned;
  assert.ok(
    Math.abs(stride - reached / frames) < 0.03 * stride,
    `a stride covers ${stride.toFixed(2)} m, its two steps reach ${(reached / frames).toFixed(2)} m`,
  );
  assert.ok(Math.abs(stride - strideLength(own, HIP)) < 0.03 * stride);
});

test("no two set off together because a tick began", () => {
  const shots = watch(
      600,
      5,
      setOff(
        (i) => i >= 8,
        (i) => 1 + (i % 4),
      ),
    ),
    began = new Map<number, number>();
  for (let i = 8; i < N; i++) {
    const far = steps(shots, i),
      from = far.findIndex((d) => d > 1e-6);
    assert.ok(from > 0, `${i} set off`);
    began.set(from, (began.get(from) ?? 0) + 1);
  }
  const frames = [...began.keys()];
  assert.ok(
    Math.max(...began.values()) <= 3,
    `the most in one frame: ${Math.max(...began.values())} of ${N - 8}`,
  );
  assert.ok(Math.max(...frames) - Math.min(...frames) > 0.6 * FPS, "over most of a second");
});

test("a child's steps are shorter and quicker than a grown one's, the old one's pace slower", () => {
  // (Fifteen of its seconds a second: a tick is forty of the watcher's, time for the old one too at their own pace.)
  const shots = watch(
      15,
      130,
      setOff(
        (i) => i === 2 || i === 6 || i === 10,
        () => 1,
      ),
    ),
    of = (i: number) => {
      const far = steps(shots, i),
        most = Math.max(...far);
      let turned = 0,
        frames = 0;
      for (let f = 1; f < shots.length; f++)
        if (far[f]! >= 0.98 * most) {
          turned += (shots[f]![i]!.stride - shots[f - 1]![i]!.stride) * STRIDES;
          frames++;
        }
      return { pace: most * FPS, beat: (turned / frames) * FPS };
    },
    child = of(2),
    old = of(6),
    grown = of(10);
  assert.ok(
    child.pace < 0.9 * grown.pace,
    `a child at ${child.pace.toFixed(2)}, a grown one ${grown.pace.toFixed(2)} m/s`,
  );
  assert.ok(
    child.beat > 1.1 * grown.beat,
    `a child's ${child.beat.toFixed(2)} strides a second, a grown one's ${grown.beat.toFixed(2)}`,
  );
  assert.ok(
    Math.abs(old.pace / grown.pace - agePace(85) / agePace(30)) < 0.05,
    `the old one at ${old.pace.toFixed(2)} m/s`,
  );
  assert.ok(old.pace < 0.7 * grown.pace && old.beat < grown.beat);
});

test("in at a door is a going out over a moment, and out of it a coming up; not a switch", () => {
  const shots = watch(600, 6, (tick) =>
      frame(tick * TICK, (i) =>
        i === 10 && tick >= 1 && tick < 3 ? { at: 0, act: PLACE_ACT.sleep } : { at: 0 },
      ),
    ),
    sizes = shots.map((s) => s[10]!.size / PLACED_SIZE),
    out = sizes.findIndex((s) => s < 1),
    gone = sizes.findIndex((s) => s <= 0),
    back = sizes.findIndex((s, f) => f > gone && s > 0),
    whole = sizes.findIndex((s, f) => f > back && s >= 1);
  assert.equal(sizes[0], 1, "there as the town is entered");
  assert.ok(Math.abs((gone - out) / FPS - BLINK) < 0.05, `gone in ${(gone - out) / FPS} s`);
  assert.ok(shots[gone]![10]!.hidden && !shots[gone - 1]![10]!.hidden);
  assert.ok(Math.abs((whole - back) / FPS - BLINK) < 0.05, `back in ${(whole - back) / FPS} s`);
});

test("with the clock stopped everyone stays as they stood, mid-stride", () => {
  // (When their walk is half gone, as it is drawn going on: the clock stopped there.)
  const going = watch(
      600,
      5,
      setOff(
        (i) => i === 10,
        () => 3,
      ),
    )
      .map((s, f) => (s[10]!.walking && s[10]!.reach > 0 ? f : -1))
      .filter((f) => f >= 0),
    stop = going[Math.floor(going.length / 2)]! / FPS,
    shots = watch(
      600,
      5,
      setOff(
        (i) => i === 10,
        () => 3,
      ),
      stop,
    ),
    at = Math.round(stop * FPS) + 2,
    a = shots[at]![10]!,
    b = shots[shots.length - 1]![10]!;
  assert.ok(a.reach > 0 && a.walking, "stopped on the way");
  assert.deepEqual(b, a);
});
