// A town struck from the air, seen as it plays out (War past the line, W2; asked for 2026-11-05: "...and
// drones and modern military and stuff beyond imagination"). Its people's foes' machines come over on a run,
// in the world's own time, tip to tip and as fast as their air and pull make them, and their load falls; each
// hit sets its lot alight as any fire does (view/blaze.ts burns it on from there). Pure: the same plan at the
// same moment flies the same. What falls comes down on the first roof or wall in its way, or the ground, and
// what a hit throws lies where it lands (asked 2026-11-11: "theres like no mesh coliders it seems for many things").
import {
  SPREAD,
  type LotStates,
  type TownLots,
  type TownPlan,
  type TownStrike,
  type WarsMap,
} from "../bridge/index.ts";
import type { Slowing } from "./battleday.ts";
import { homesRiseTo, townSurface, type TownScene } from "./town.ts";

/** How high they come over (metres; an estimate), how far from the town they are first drawn (metres). */
export const RAID_HIGH = 150,
  RAID_FAR = 1300;
/**
 * How long a load takes to fall (seconds, from that height at Earth's pull) and how long a hit's burst lasts, all told: its
 * flash and fireball, its smoke, and what it threw lying where it fell till it fades; a rocket's the longer.
 */
export const FALL_S = 5.5,
  BURST_S = 12,
  ROCKET_BURST_S = 18;
/** The most flyers, falling loads and bursts drawn at once. */
export const MOST_RAIDERS = 12,
  MOST_FALLING = 24,
  MOST_BURSTS = 32;
/** How long the ground a hit scorched stays dark (world seconds; the last third of it fading), and the most such marks drawn. */
export const MARK_S = 1200,
  MOST_MARKS = 48;
/** How many things a hit throws (a rocket's, more), and the numbers kept for each: how fast it went off (m/s, three ways), when it came down after the hit (s), where (m, three ways) and how big it is (m). */
export const BITS = 6,
  ROCKET_BITS = 10,
  BIT = 8;
/** Earth's pull, for what is thrown (m/s²). */
const PULL = 9.81;
/** How fast the clock runs through a raid in a town (world seconds a second): a run that can be watched. */
export const RAID_SPEED = 3;
/** How many fly abreast. */
const ABREAST = 3;
/** The most lots read for where a raid's loads fall on what it does not burn, and the most of those kept. */
const STRAY_READ = 2048,
  STRAY_KEPT = 160;
/**
 * A raid as its town's scene reads it: which way it flies; the hits under its stream, those first to catch first; where its
 * loads land on what it does not burn, first first (a town flattened last year has nothing it can burn in all that is drawn: what
 * this raid brought down lies further out, and its machines would cross the ruins with nothing falling from them); rockets, each one's fall.
 */
type RaidWay = {
  readonly heading: number;
  readonly under: readonly number[];
  /** Which lots are among those under its stream (1), so that none is drawn twice. */
  readonly underMask?: Uint8Array;
  readonly strays: readonly { readonly p: number; readonly at: number }[];
  readonly falls?: readonly RocketFall[];
  /** What it burned past the streets drawn, out in a great city's sprawl. */
  readonly far?: readonly FarBurn[];
  /** How high they come over (m): over the tallest of what stands there, in a city of spires. */
  readonly high: number;
  /** The greatest fire (W5): where it comes down. */
  readonly great?: { readonly at: number; readonly x: number; readonly z: number };
};
/** One rocket's fall on a town (W3): when, and where (out: past the streets drawn, on no lot of the scene's). */
type RocketFall = {
  readonly at: number;
  readonly x: number;
  readonly z: number;
  readonly out?: boolean;
};
/** A home alight past those a town's scene draws: when it caught, where, how high and how broad (metres). */
export type FarBurn = {
  readonly at: number;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly high: number;
  readonly wide: number;
};
/** A great city's sprawl, as far as the scene draws it (metres from its middle). */
type Ring = { readonly r0: number; readonly r1: number };
/** How many homes are drawn alight for each place it came down past the streets drawn, how far about it (m), and how long one takes to catch from the last (s). */
const FAR_HOMES = 9,
  FAR_ABOUT = 70,
  FAR_CATCH = 40;
/**
 * A rocket's way down as it is drawn (W3): how far up it it is first seen (m), and how steeply it comes in there and at the last
 * (radians from level): out of the sky on a long slant, steepening into a dive onto where it falls (est: Earth's first came down
 * at some 65 degrees and more).
 */
export const DIVE_SEEN = 2200,
  DIVE_TOP = 0.55,
  DIVE_END = 1.38;
/** How long the smoke a rocket left hangs after it has fallen (world seconds), how long before its first fall the sky is watched (world seconds), and after its last. */
export const STREAK_HANGS = 60,
  ROCKET_BEFORE = 14,
  ROCKET_AFTER = 30;
/** The bend of a rocket's way (radians a metre along it). */
const BEND = (DIVE_END - DIVE_TOP) / DIVE_SEEN;
/**
 * Where a rocket is `sigma` metres up its way from where it comes down (W3): how far back along its heading (m), how high over
 * that point (m), and its slant there (radians from level), into `out`. Its slant eases from the dive at the last to the long
 * slant at the top, a metre at a time, so its way is that curve's sum.
 */
export function diveAt(sigma: number, out: number[]): number[] {
  const s = Math.max(0, Math.min(DIVE_SEEN, sigma)),
    slant = DIVE_END - BEND * s;
  out[0] = (Math.sin(DIVE_END) - Math.sin(slant)) / BEND;
  out[1] = (Math.cos(slant) - Math.cos(DIVE_END)) / BEND;
  out[2] = slant;
  return out;
}
/** The most rockets' falls drawn on a town, and how fast the clock runs through them: the world's own. */
export const MOST_STREAKS = 8,
  ROCKET_SPEED = 1;
/** How long the greatest fire's cloud stands over a town (world seconds), and how long it is watched at the world's own pace (the rest at RAID_FIRES). */
export const GREAT_LASTS = 900,
  GREAT_WATCHED = 45;
/** How far apart hits of one fall catch (world seconds). */
const CATCH_S = 0.35;
const WAYS = new WeakMap<TownStrike, RaidWay>();
const wayOf = (k: TownStrike): RaidWay =>
  WAYS.get(k) ?? {
    heading: unit(hashText(k.event), 1) * 2 * Math.PI,
    under: [],
    strays: [],
    high: RAID_HIGH,
  };

/** What a strike burned past the streets drawn (none: what it burned is drawn). */
export const farBurnsOf = (k: TownStrike): readonly FarBurn[] => WAYS.get(k)?.far ?? [];

/** Whether a place past the streets drawn is on dry ground, with room about it. */
const dryOut = (plan: TownPlan, x: number, z: number): boolean =>
  !plan.water || Math.hypot(x - plan.water.x, z - plan.water.z) > plan.water.r + FAR_ABOUT + 10;

/** Homes alight about a place past the streets drawn: a keyed few, one catching after another. */
function burnsAbout(
  key: number,
  salt: number,
  x: number,
  z: number,
  at: number,
  out: FarBurn[],
): void {
  for (let i = 0; i < FAR_HOMES; i++) {
    const a = unit(key, salt + i * 3) * 2 * Math.PI,
      r = i === 0 ? 0 : FAR_ABOUT * Math.sqrt(unit(key, salt + i * 3 + 1));
    out.push({
      at: at + i * FAR_CATCH,
      x: x + r * Math.cos(a),
      z: z + r * Math.sin(a),
      yaw: a,
      high: 8 + unit(key, salt + i * 3 + 2) * 16,
      wide: 12,
    });
  }
}

/** When a row of a raid's machines is over the town's heart. */
const rowOver = (k: TownStrike, row: number, rows: number): number => {
  const run = raidRun(k);
  return run.from + (rows > 1 ? (row / (rows - 1)) * (run.to - run.from) : 0);
};
const rowsOf = (k: TownStrike): number =>
  Math.ceil(Math.min(MOST_RAIDERS, Math.max(1, k.raid?.flyers ?? 1)) / ABREAST);

/**
 * A raid laid over its town: one tight stream, drawn as a few of the many that fly, across the heart and over the
 * first of what it burns; and each lot caught when a row's moment comes over it, not as the lots are numbered, so
 * hits walk along under the machines. Read once, as a town's scene is made.
 */
export function timeRaids(
  plan: TownPlan,
  lots: TownLots,
  states: LotStates,
  rise = 0,
  ring: Ring | null = null,
): void {
  const list = plan.struck;
  if (!list?.some((k) => k.raid)) return;
  const own = new Map<number, number[]>();
  for (let p = 0; p < plan.lots; p++) {
    const i = states.struck[p]!;
    if (i < 0 || !list[i]?.raid) continue;
    let of = own.get(i);
    if (!of) own.set(i, (of = []));
    of.push(p);
  }
  list.forEach((k, i) => {
    if (!k.raid) return;
    const mine = own.get(i) ?? [],
      key = hashText(k.event);
    if (k.raid.great) {
      timeGreat(k, key, mine, lots, states, Math.max(RAID_HIGH, rise + 40));
      return;
    }
    if (k.raid.rocket) {
      timeRocket(k, key, mine, plan, lots, states, Math.max(RAID_HIGH, rise + 40), ring);
      return;
    }
    const first = mine.slice(0, Math.ceil(mine.length / 4));
    let cx = 0,
      cz = 0;
    for (const p of first) {
      cx += lots.x[p]!;
      cz += lots.z[p]!;
    }
    const heading =
        cx * cx + cz * cz > 400 * first.length * first.length
          ? Math.atan2(cx, cz)
          : unit(key, 1) * 2 * Math.PI,
      ux = Math.sin(heading),
      uz = Math.cos(heading),
      rows = rowsOf(k),
      speed = Math.max(1, k.raid.speed),
      wide = k.raid.span * 2.4 + 40,
      under: number[] = [];
    for (const p of mine) {
      const along = lots.x[p]! * ux + lots.z[p]! * uz,
        aside = lots.x[p]! * uz - lots.z[p]! * ux;
      states.began[p] =
        rowOver(k, Math.floor(unit(key, p) * rows), rows) +
        Math.max(-RAID_FAR, Math.min(RAID_FAR, along)) / speed +
        unit(key, p + 1) * 2;
      if (Math.abs(aside) < wide) under.push(p);
    }
    under.sort((a, b) => states.began[a]! - states.began[b]! || a - b);
    const strays: { p: number; at: number }[] = [];
    if (under.length < MOST_BURSTS) {
      const stride = Math.max(1, Math.ceil(plan.lots / STRAY_READ));
      for (let p = 0; p < plan.lots; p += stride) {
        const along = lots.x[p]! * ux + lots.z[p]! * uz,
          aside = lots.x[p]! * uz - lots.z[p]! * ux;
        if (Math.abs(aside) >= wide || Math.abs(along) >= RAID_FAR || states.struck[p] === i)
          continue;
        strays.push({
          p,
          at:
            rowOver(k, Math.floor(unit(key, p) * rows), rows) +
            along / speed +
            unit(key, p + 1) * 2,
        });
      }
      strays.sort((a, b) => a.at - b.at || a.p - b.p);
      if (strays.length > STRAY_KEPT) {
        const every = strays.length / STRAY_KEPT;
        for (let j = 0; j < STRAY_KEPT; j++) strays[j] = strays[Math.floor(j * every)]!;
        strays.length = STRAY_KEPT;
      }
    }
    // (All it burned lies past the streets drawn: it burns out there, on along its way.)
    const far: FarBurn[] = [];
    if (!mine.length && ring && k.homes !== 0)
      for (let r = 0; r < Math.min(3, rows); r++) {
        const out = Math.min(
            RAID_FAR,
            ring.r0 + (ring.r1 - ring.r0) * (0.04 + 0.3 * unit(key, 300 + r)),
          ),
          x = ux * out,
          z = uz * out;
        if (dryOut(plan, x, z))
          burnsAbout(key, 320 + r * 30, x, z, rowOver(k, r, rows) + out / speed, far);
      }
    const underMask = new Uint8Array(plan.lots);
    for (const p of under) underMask[p] = 1;
    WAYS.set(k, {
      heading,
      under,
      underMask,
      strays,
      ...(far.length ? { far } : {}),
      high: Math.max(RAID_HIGH, rise + 40),
    });
  });
}

/** How fast what it does goes out across a town (m a world second, drawn so that it can be watched), and for how long at most. */
const GREAT_GOES = 45,
  GREAT_OUT_S = 20;
/** How far out what the greatest fire does has gone, so many world seconds after its moment (metres). */
export function greatGone(seconds: number): number {
  return seconds <= 0 ? 0 : seconds >= GREAT_OUT_S ? Infinity : seconds * GREAT_GOES;
}
/**
 * The greatest fire laid over its town (W5): one, where the first of what it burned stands, and every lot it took caught as what it
 * does comes out to it. What it burned past the streets drawn is not drawn; what is drawn of it is what can be seen.
 */
function timeGreat(
  k: TownStrike,
  key: number,
  mine: readonly number[],
  lots: TownLots,
  states: LotStates,
  high: number,
): void {
  const heading = unit(key, 1) * 2 * Math.PI,
    at = raidRun(k).from,
    near = [...mine].sort((a, b) => a - b).slice(0, Math.max(1, Math.ceil(mine.length / 8)));
  let x = 0,
    z = 0;
  for (const p of near) {
    x += lots.x[p]!;
    z += lots.z[p]!;
  }
  x /= Math.max(1, near.length);
  z /= Math.max(1, near.length);
  // (In half-second steps: each is the town drawn again, and it goes out to thousands of lots.)
  for (const p of mine)
    states.began[p] =
      at +
      Math.ceil(
        Math.min(GREAT_OUT_S, Math.hypot(lots.x[p]! - x, lots.z[p]! - z) / GREAT_GOES) * 2,
      ) /
        2;
  WAYS.set(k, {
    heading,
    under: [...mine].sort((a, b) => states.began[a]! - states.began[b]! || a - b),
    strays: [],
    falls: [{ at, x, z }],
    high,
    great: { at, x, z },
  });
}

/**
 * A fall of rockets laid over its town: the lots it burned in their runs along the streets, each run where one came
 * down; the rockets one after another, and each one's lots caught together, out from its middle.
 */
function timeRocket(
  k: TownStrike,
  key: number,
  mine: readonly number[],
  plan: TownPlan,
  lots: TownLots,
  states: LotStates,
  high: number,
  ring: Ring | null,
): void {
  const heading = unit(key, 1) * 2 * Math.PI,
    runs: number[][] = [];
  // (A town flattened last year has nothing it can burn in all that is drawn: they still come down here, on the ruins.
  // In a great city, what it burned may all lie past the streets drawn: they come down and burn out there.)
  if (!mine.length) {
    const n = Math.min(4, Math.max(1, k.raid?.flyers ?? 1)),
      span = raidRun(k),
      each = n > 1 ? (span.to - span.from) / (n - 1) : 0,
      strays: { p: number; at: number }[] = [],
      falls: RocketFall[] = [],
      far: FarBurn[] = [];
    for (let r = 0; r < n; r++) {
      const at = span.from + r * each;
      let out: { x: number; z: number } | null = null;
      if (ring && k.homes !== 0)
        for (let tries = 0; tries < 8 && !out; tries++) {
          const a = unit(key, 60 + r * 20 + tries * 2) * 2 * Math.PI,
            d = ring.r0 + (ring.r1 - ring.r0) * (0.04 + 0.3 * unit(key, 61 + r * 20 + tries * 2)),
            x = d * Math.cos(a),
            z = d * Math.sin(a);
          if (dryOut(plan, x, z)) out = { x, z };
        }
      if (out) {
        falls.push({ at, x: out.x, z: out.z, out: true });
        burnsAbout(key, 200 + r * 30, out.x, out.z, at, far);
        continue;
      }
      const p = Math.floor(unit(key, 50 + r) * plan.lots);
      strays.push({ p, at });
      falls.push({ at, x: lots.x[p]!, z: lots.z[p]! });
    }
    WAYS.set(k, {
      heading,
      under: [],
      strays,
      falls,
      ...(far.length ? { far } : {}),
      high,
    });
    return;
  }
  for (const p of [...mine].sort((a, b) => a - b)) {
    const last = runs.at(-1);
    if (last && p === last.at(-1)! + 1) last.push(p);
    else runs.push([p]);
  }
  // (More runs than can be drawn: those nearest each other share a rocket.)
  while (runs.length > MOST_STREAKS) {
    const a = runs.pop()!;
    runs[runs.length - 1]!.push(...a);
  }
  const run = raidRun(k),
    gap = runs.length > 1 ? (run.to - run.from) / (runs.length - 1) : 0,
    falls: RocketFall[] = [];
  runs.forEach((list, r) => {
    const at = run.from + r * gap,
      mid = list[Math.floor(list.length / 2)]!;
    falls.push({ at, x: lots.x[mid]!, z: lots.z[mid]! });
    for (const p of list) {
      const dx = lots.x[p]! - lots.x[mid]!,
        dz = lots.z[p]! - lots.z[mid]!;
      states.began[p] = at + Math.min(3, CATCH_S * (Math.abs(dx) + Math.abs(dz)) * 0.05);
    }
  });
  WAYS.set(k, {
    heading,
    under: [...mine].sort((a, b) => states.began[a]! - states.began[b]! || a - b),
    strays: [],
    falls,
    high,
  });
}

/** A raid over the town at moment t (the first of them, if any): from a little before its first machine to a little after its last. */
export function raidOver(plan: TownPlan | null | undefined, t: number): TownStrike | null {
  for (const k of plan?.struck ?? []) {
    if (!k.raid) continue;
    const s = raidSpan(k);
    if (t >= s.from - 30 && t <= s.to + 60) return k;
  }
  return null;
}

/**
 * The eye on a raid: ahead of its machines and low, a little off their way so that they pass it by, looking back
 * up their way as they come over the town.
 */
export function raidEye(k: TownStrike): {
  readonly target: { readonly x: number; readonly y: number; readonly z: number };
  readonly yaw: number;
  readonly pitch: number;
  readonly distance: number;
} {
  // (Over a city of spires, from above their tops: from low down there would be nothing to see but walls.)
  const over = wayOf(k).high > RAID_HIGH;
  // (The greatest fire: far enough off that its whole cloud, as drawn, stands between the panel and the foot of the screen; as
  // low as the eye over a town may go, looking up at it. Further off, the town's haze takes it.)
  const great = wayOf(k).great;
  if (great)
    return {
      target: { x: great.x * 0.1, y: 30, z: great.z * 0.1 },
      yaw: (wayOf(k).heading * 180) / Math.PI + 74,
      pitch: over ? -10 : -8,
      distance: 150,
    };
  // (Rockets: off to the side of where the first comes down, with the sky it comes from over it.)
  const fall = wayOf(k).falls?.[0];
  if (k.raid?.rocket)
    return {
      target: { x: (fall?.x ?? 0) * 0.1, y: 8, z: (fall?.z ?? 0) * 0.1 },
      yaw: (wayOf(k).heading * 180) / Math.PI + 74,
      pitch: over ? -24 : -8,
      distance: over ? 130 : 96,
    };
  return {
    target: { x: 0, y: 2, z: 0 },
    yaw: (wayOf(k).heading * 180) / Math.PI - 16,
    pitch: over ? -24 : -8,
    distance: over ? 105 : 62,
  };
}

/** One of those drawn: where (metres), how high, which way it flies, tip to tip and nose to tail. */
export type RaidFlyer = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly span: number;
  readonly length: number;
};
/**
 * A rocket (W3) as it is drawn: its head now (metres) and its slant there, coming in along its heading; where its way comes
 * down (`ax`, `ay`, `az`: what it was thrown at, on its roof or the ground), and how far up that way its head is now and where
 * it stopped (m along it: what it met first); how fast it comes (m/s); world seconds since it came down (less than 0: on its
 * way); how far the smoke it left has faded (0 … 1).
 */
export type RocketStreak = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly slant: number;
  readonly ax: number;
  readonly ay: number;
  readonly az: number;
  readonly head: number;
  readonly stop: number;
  readonly speed: number;
  readonly since: number;
  readonly fade: number;
  /** Whether it has yet to land: its fire and its body. */
  readonly falling: boolean;
  /** Which it is: its smoke's own drift. */
  readonly key: number;
};
/** The greatest fire as it stands now (W5; metres): where, how long since it fell. */
export type GreatNow = {
  readonly x: number;
  readonly z: number;
  /** World seconds since it fell. */
  readonly since: number;
};
/** A load on its way down (metres): where, which way it was flown and how steeply it falls now (radians from level, nose down). */
export type RaidLoad = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly pitch: number;
};
/**
 * A hit (metres): where it struck (a roof, a wall in its way, or the ground); how far through its burst (0 … 1) and world seconds
 * since; how much greater than a load's (a rocket's: 4); which it is, for its own scatter; and what it threw (BIT numbers each).
 */
export type RaidBurst = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly k: number;
  readonly s: number;
  readonly size?: number;
  readonly key: number;
  readonly bits: Float32Array;
};
/** Ground a hit scorched (metres): where, how far about, and how far it has faded (0 … 1). */
export type RaidMark = {
  readonly x: number;
  readonly z: number;
  readonly r: number;
  readonly k: number;
};
export type RaidNow = {
  readonly great?: GreatNow;
  readonly flyers: readonly RaidFlyer[];
  /** Rockets (W3). */
  readonly streaks: readonly RocketStreak[];
  /** Loads on their way down. */
  readonly falling: readonly RaidLoad[];
  /** Hits, while their bursts last. */
  readonly bursts: readonly RaidBurst[];
  /** Ground scorched where loads came down on it. */
  readonly marks: readonly RaidMark[];
  /** Whose machines they are (null: none over the town now). */
  readonly by: string | null;
};
const NONE: RaidNow = { flyers: [], streaks: [], falling: [], bursts: [], marks: [], by: null };

/** Where a load comes down against where it was meant for: the moment, against its own (≤ 0: it met a roof or wall in its way first), where (m), and the top of what it was meant for. */
type Impact = {
  readonly dt: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly top: number;
};
/** A rocket's coming down against where it was thrown: where it stopped up its way (m; 0: there), what it was thrown at's top (m). */
type Dive = { readonly stop: number; readonly top: number };
/** Where each of a scene's loads came down, and what each hit threw: read once, for the same plan the same. */
const IMPACTS = new WeakMap<TownScene, Map<number, Impact>>(),
  DIVES = new WeakMap<TownScene, Map<number, Dive>>(),
  THROWN = new WeakMap<TownScene, Map<number, Float32Array>>(),
  GROUND_BY = new WeakMap<TownScene, Map<number, { x: number; z: number }>>(),
  TALLEST = new WeakMap<TownScene, number>();
/** A load's or a rocket's own number: its strike's place in the plan, what it is (0 a lot's load, 1 a stray, 2 a rocket's fall), and its lot or fall. */
const keyOf = (strike: number, kind: number, n: number) => (strike * 4 + kind) * 1_048_576 + n;

const kept = <V>(memo: WeakMap<TownScene, Map<number, V>>, scene: TownScene): Map<number, V> => {
  let m = memo.get(scene);
  if (!m) memo.set(scene, (m = new Map()));
  return m;
};

/** How high the tallest thing in a town stands (metres): under it, nothing falling can meet anything. */
function tallestOf(scene: TownScene): number {
  let h = TALLEST.get(scene);
  if (h === undefined) {
    // (Its homes' tallest, a spire's needle on top; or its tallest other building.)
    h = Math.max(70, (scene.plan.runs ? homesRiseTo(scene.plan) : 0) + 24);
    TALLEST.set(scene, h);
  }
  return h;
}

/**
 * Where a load meant for (x, z) at moment `at` comes down: on the roof there, or on the first roof or wall in its way as it
 * falls on along the machine's way (heading, m/s) from `high`.
 */
function loadImpact(
  scene: TownScene,
  key: number,
  x: number,
  z: number,
  at: number,
  heading: number,
  speed: number,
  high: number,
): Impact {
  const memo = kept(IMPACTS, scene),
    had = memo.get(key);
  if (had) return had;
  const top = townSurface(scene, x, z, at),
    drop = Math.max(1, high - top),
    ux = Math.sin(heading),
    uz = Math.cos(heading),
    // (A load's way down, back from where it is meant for: on along the machine's way, faster and faster down.)
    yOf = (s: number) => top + drop * (1 - (1 + s / FALL_S) * (1 + s / FALL_S)),
    over = (s: number) =>
      yOf(s) - townSurface(scene, x + ux * speed * s, z + uz * speed * s, at + s),
    tallest = tallestOf(scene);
  let made: Impact = { dt: 0, x, y: top, z, top };
  if (tallest > top) {
    // (Only its last stretch, under the tallest of what stands, can meet anything: looked along every few metres.)
    const from = FALL_S * (Math.sqrt(Math.max(0, 1 - (tallest - top) / drop)) - 1),
      n = Math.min(48, Math.max(2, Math.ceil((speed * -from) / 2.5)));
    let prev = from;
    for (let j = 1; j < n; j++) {
      const s = from * (1 - j / n);
      if (over(s) > 0) {
        prev = s;
        continue;
      }
      let lo = prev,
        hi = s;
      for (let b = 0; b < 4; b++) {
        const mid = (lo + hi) / 2;
        if (over(mid) > 0) lo = mid;
        else hi = mid;
      }
      made = { dt: hi, x: x + ux * speed * hi, y: yOf(hi), z: z + uz * speed * hi, top };
      break;
    }
  }
  memo.set(key, made);
  return made;
}

/**
 * Where a rocket thrown at (x, z) at moment `at` stops on its way down (m up its way; 0: on what it was thrown at): the first roof
 * or wall in its way.
 */
function diveImpact(
  scene: TownScene,
  key: number,
  x: number,
  z: number,
  at: number,
  heading: number,
): Dive {
  const memo = kept(DIVES, scene),
    had = memo.get(key);
  if (had) return had;
  const top = townSurface(scene, x, z, at),
    ux = Math.sin(heading),
    uz = Math.cos(heading),
    d = [0, 0, 0],
    over = (sigma: number) => {
      diveAt(sigma, d);
      return top + d[1]! - townSurface(scene, x - ux * d[0]!, z - uz * d[0]!, at);
    },
    tallest = tallestOf(scene);
  let stop = 0;
  if (tallest > top) {
    // (Up its way as far as it is under the tallest of what stands: a dive's last few hundred metres.)
    const reach = Math.min(DIVE_SEEN, (tallest - top) / Math.sin(DIVE_END) + 40),
      n = Math.min(64, Math.ceil(reach / 2.5));
    let prev = reach;
    for (let j = n - 1; j >= 1; j--) {
      const sigma = (reach * j) / n;
      if (over(sigma) > 0) {
        prev = sigma;
        continue;
      }
      let lo = sigma,
        hi = prev;
      for (let b = 0; b < 4; b++) {
        const mid = (lo + hi) / 2;
        if (over(mid) > 0) hi = mid;
        else lo = mid;
      }
      stop = hi;
      break;
    }
  }
  const made = { stop, top };
  memo.set(key, made);
  return made;
}

/** A spot of bare ground by a lot (metres), for a load that did not burn it: before it in its street, beside it, or the lot itself. */
function groundBy(scene: TownScene, p: number, at: number): { x: number; z: number } {
  const memo = kept(GROUND_BY, scene),
    had = memo.get(p);
  if (had) return had;
  const { lots } = scene,
    x = lots.x[p]!,
    z = lots.z[p]!,
    yaw = lots.yaw?.[p] ?? 0,
    c = Math.cos(yaw),
    s = Math.sin(yaw);
  let made = { x, z };
  // (In its own frame: before it in the street, beside it, behind it.)
  for (const [u, v] of GROUND_SPOTS) {
    const gx = x + u * c + v * s,
      gz = z - u * s + v * c;
    if (townSurface(scene, gx, gz, at) < 1.2) {
      made = { x: gx, z: gz };
      break;
    }
  }
  memo.set(p, made);
  return made;
}
const GROUND_SPOTS: readonly (readonly [number, number])[] = [
  [0, 0],
  [0, -11],
  [4.5, 0],
  [-4.5, 0],
  [2, -9],
  [-2, -9],
];

/**
 * What a hit at (x, y, z) at moment `at` throws, and where each comes down (BIT numbers each, as `RaidBurst.bits` keeps them):
 * off on its own slant, to the first roof or wall in its way, or the ground.
 */
function thrownOf(
  scene: TownScene,
  key: number,
  x: number,
  y: number,
  z: number,
  at: number,
  size: number,
): Float32Array {
  const memo = kept(THROWN, scene),
    had = memo.get(key);
  if (had) return had;
  const n = size > 1 ? ROCKET_BITS : BITS,
    q = Math.sqrt(size),
    out = new Float32Array(n * BIT),
    y0 = y + 0.6;
  for (let i = 0; i < n; i++) {
    const a = unit(key, 500 + i) * 2 * Math.PI,
      off = (5 + 11 * unit(key, 520 + i)) * q,
      vx = Math.cos(a) * off,
      vz = Math.sin(a) * off,
      vy = (7 + 12 * unit(key, 540 + i)) * Math.sqrt(q),
      // (When it would reach the bare ground, falling all the way.)
      ground = (vy + Math.sqrt(vy * vy + 2 * PULL * Math.max(0, y0 - 0.5))) / PULL;
    let land = ground,
      prev = 0;
    // (Each tenth of a second of its flight: the first moment it is under what stands there.)
    const under = (s: number) =>
      y0 + vy * s - 0.5 * PULL * s * s <= townSurface(scene, x + vx * s, z + vz * s, at + s);
    for (let s = 0.1; s < ground; s += 0.1) {
      if (!under(s)) {
        prev = s;
        continue;
      }
      let lo = prev,
        hi = s;
      for (let b = 0; b < 3; b++) {
        const mid = (lo + hi) / 2;
        if (under(mid)) hi = mid;
        else lo = mid;
      }
      // (Into a wall, not onto a roof: it drops at the wall's foot, where it was last clear of it.)
      const high = y0 + vy * hi - 0.5 * PULL * hi * hi;
      land = townSurface(scene, x + vx * hi, z + vz * hi, at + hi) - high > 1.5 ? lo : hi;
      break;
    }
    const lx = x + vx * land,
      lz = z + vz * land,
      o = i * BIT;
    out[o] = vx;
    out[o + 1] = vy;
    out[o + 2] = vz;
    out[o + 3] = land;
    out[o + 4] = lx;
    out[o + 5] = townSurface(scene, lx, lz, at + land);
    out[o + 6] = lz;
    out[o + 7] = (0.9 + 1.4 * unit(key, 560 + i)) * Math.sqrt(q);
  }
  memo.set(key, out);
  return out;
}

const unit = (a: number, b: number) => {
  let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};
const hashText = (text: string) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h;
};

/** When its load begins to fall and when the last of it lands (world seconds). */
export function raidRun(k: TownStrike): { readonly from: number; readonly to: number } {
  const from = k.at + (k.raid?.rocket ? SPREAD.rocketFrom : SPREAD.raidFrom);
  return { from, to: from + (k.raid?.rocket ? SPREAD.rocketAll : SPREAD.raidAll) };
}

/** From when its first is drawn until its last is gone (world seconds). */
export function raidSpan(k: TownStrike): { readonly from: number; readonly to: number } {
  const run = raidRun(k);
  if (k.raid?.great) return { from: run.from - ROCKET_BEFORE, to: run.from + GREAT_LASTS };
  if (k.raid?.rocket) return { from: run.from - ROCKET_BEFORE, to: run.to + ROCKET_AFTER };
  const far = RAID_FAR / Math.max(1, k.raid?.speed ?? 46);
  return { from: run.from - far, to: run.to + far };
}

/** How fast the morning of the next turn goes in a town lately bombed, while it is read whether they come again (world seconds a second). */
export const RAID_WATCH = 4 * 3600;

/**
 * How the clock is slowed for each raid on a town, in time order; and, in a town lately bombed, for the morning of
 * each turn to come while its last raid is kept: a raid falls at a turn and is drawn ten hours on, and at a year a second
 * ten hours are less than a frame, so the clock comes down for them or the town's plan never tells it in time.
 */
export function raidSlowings(plan: TownPlan): Slowing[] {
  const out: Slowing[] = [],
    year = 365 * 86_400,
    raids = (plan.struck ?? []).filter((k) => k.raid);
  for (const k of raids) {
    const s = raidSpan(k);
    // (The greatest fire: its own pace while it is watched, then quicker for what burns after.)
    if (k.raid?.great) {
      const at = raidRun(k).from;
      out.push(
        {
          key: `raid:${k.event}`,
          turn: Math.floor(k.at / year),
          cap: "raid",
          speed: ROCKET_SPEED,
          from: s.from,
          to: at + GREAT_WATCHED,
        },
        {
          key: `raid-after:${k.event}`,
          turn: Math.floor(k.at / year),
          cap: "raid",
          speed: RAID_FIRES,
          from: at + GREAT_WATCHED,
          to: s.to,
        },
      );
      continue;
    }
    out.push({
      key: `raid:${k.event}`,
      turn: Math.floor(k.at / year),
      cap: "raid",
      speed: k.raid?.rocket ? ROCKET_SPEED : RAID_SPEED,
      from: s.from,
      to: s.to,
    });
  }
  const last = raids.reduce((n, k) => Math.max(n, k.at), 0);
  if (last > 0)
    for (let i = 1; i <= 2; i++) {
      const at = last + i * year,
        s = raidSpan({ ...raids[0]!, at });
      out.push({
        key: `raid-watch:${at}`,
        turn: Math.floor(at / year),
        cap: "raid",
        speed: RAID_WATCH,
        from: at,
        to: s.from,
      });
    }
  return out.sort((a, b) => a.from - b.from);
}

/** The town's machines and fires played again (seconds of the world): from the first machine to the fires at their height, and how fast at each. */
export function raidFilm(k: TownStrike): {
  readonly from: number;
  readonly to: number;
  readonly calm: number;
  readonly speed: number;
} {
  const s = raidSpan(k),
    run = raidRun(k);
  if (k.raid?.great)
    return { from: s.from, calm: run.from + GREAT_WATCHED, to: s.to, speed: ROCKET_SPEED };
  return {
    from: s.from,
    calm: run.to + 25,
    to: run.to + 600,
    speed: k.raid?.rocket ? ROCKET_SPEED : RAID_SPEED,
  };
}
/** How fast the fires go once the machines have gone, in a raid played again (world seconds a second). */
export const RAID_FIRES = 30;

/** A strike from the air as a land's view draws it: its machines coming in and the town burning under them. */
export type LandRaidNow = {
  readonly key: string;
  readonly event: string;
  readonly x: number;
  readonly z: number;
  readonly r: number;
  /** How hard it burns now (0 … 1). */
  readonly burn: number;
  readonly flyers: readonly { readonly x: number; readonly z: number; readonly yaw: number }[];
  /** What a mark over it says. */
  readonly words: string;
  /** Rockets' way over the land (W3): from where it comes in, how high it rises, how far its head has come (0 … 1). */
  readonly arc?: {
    readonly x: number;
    readonly z: number;
    readonly high: number;
    readonly k: number;
  };
};
/** How long of a year a land's view shows the machines coming in, and the town burning after (years; its own clock is too fast for a run). */
const LAND_RUN = 0.08,
  LAND_BURN = 0.5;
/** How far off they are first drawn (a land's units), and the most raids drawn. */
const LAND_OFF = 60;
export const MOST_LAND_RAIDS = 8,
  LAND_FLYERS = 3;

/** The strikes from the air a land's towns are under now, at `y` (the world's years): those of its towns drawn, the latest first. */
export function landRaidsNow(
  map: WarsMap | null,
  y: number,
  townAt: (ref: string) => { readonly x: number; readonly z: number; readonly r: number } | null,
  /** Where a spot of the globe's lies from a place on this land's map: at it, or at the map's edge the way it lies. */
  spotFrom?: (
    spot: number,
    at: { readonly x: number; readonly z: number },
  ) => { readonly x: number; readonly z: number },
): readonly LandRaidNow[] {
  const out: LandRaidNow[] = [],
    // (A war with two fronts is on the map twice: its strikes once.)
    told = new Set<string>();
  // (The greatest fire over a town is what is told of it: W5.)
  const great = new Set<string>();
  for (const w of map?.wars ?? [])
    for (const k of w.raids ?? []) {
      const since = y - (k.year + 1);
      if (k.great && since >= 0 && since <= LAND_BURN) great.add(k.town);
    }
  for (const w of map?.wars ?? [])
    for (const k of w.raids ?? []) {
      if (told.has(k.event)) continue;
      told.add(k.event);
      // (History reckons it at the turn that ends its year.)
      const since = y - (k.year + 1);
      if (since < 0 || since > LAND_BURN || (great.has(k.town) && !k.great)) continue;
      const at = townAt(k.town);
      if (!at) continue;
      const key = hashText(k.event),
        heading = unit(key, 2) * 2 * Math.PI,
        ux = Math.sin(heading),
        uz = Math.cos(heading),
        run = since / LAND_RUN,
        flyers = [],
        rocket = k.rocket;
      if (rocket) {
        const left = spotFrom?.(rocket.from, at) ?? {
            x: at.x - ux * LAND_OFF * 2,
            z: at.z - uz * LAND_OFF * 2,
          },
          far = Math.hypot(left.x - at.x, left.z - at.z);
        out.push({
          key: `raid:${k.event}`,
          event: k.event,
          x: at.x,
          z: at.z,
          r: at.r,
          burn: run < 0.5 ? 0 : Math.max(0, 1 - since / LAND_BURN),
          flyers: [],
          words: `${k.great ? "☢️" : "☄️"} ${k.name}: ${k.dead.toLocaleString("en")} dead`,
          arc: { x: left.x, z: left.z, high: Math.max(14, far * 0.22), k: Math.min(1, run * 2) },
        });
        continue;
      }
      if (run < 1)
        for (let j = 0; j < Math.min(LAND_FLYERS, Math.max(1, k.flyers)); j++) {
          const on = (run - 0.5) * 2 * LAND_OFF - j * 5,
            aside = (j - 1) * 4;
          flyers.push({
            x: at.x + ux * on + uz * aside,
            z: at.z + uz * on - ux * aside,
            yaw: heading,
          });
        }
      out.push({
        key: `raid:${k.event}`,
        event: k.event,
        x: at.x,
        z: at.z,
        r: at.r,
        burn: run < 0.5 ? 0 : Math.max(0, 1 - since / LAND_BURN),
        flyers,
        words: `💥 ${k.name}: ${k.dead.toLocaleString("en")} dead`,
      });
    }
  return out.slice(0, MOST_LAND_RAIDS);
}

/** A rocket's way over the globe now (W3), in dots along it from where it left to where it fell. */
export type GlobeArc = {
  readonly key: string;
  readonly dots: readonly {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly head: boolean;
  }[];
  readonly from: readonly [number, number, number];
  readonly to: readonly [number, number, number];
};
/** How long an arc stays on the globe (years; the globe's clock is fast), the most drawn, and how many dots to one. */
const ARC_YEARS = 2.4;
export const MOST_ARCS = 24,
  ARC_DOTS = 18;
/** The rockets' ways over the globe at `y` (the world's years): positions of a globe of radius 1, spot by spot. */
export function globeArcsNow(
  map: WarsMap | null,
  y: number,
  positions: ArrayLike<number>,
): readonly GlobeArc[] {
  const out: GlobeArc[] = [],
    told = new Set<string>();
  for (const w of map?.wars ?? [])
    for (const k of w.raids ?? []) {
      if (!k.rocket || out.length >= MOST_ARCS || told.has(k.event)) continue;
      told.add(k.event);
      const since = y - (k.year + 1);
      if (since < -1 || since > ARC_YEARS) continue;
      const p = (s: number) =>
          [positions[3 * s]!, positions[3 * s + 1]!, positions[3 * s + 2]!] as const,
        a = p(k.rocket.from),
        b = p(k.rocket.to),
        angle = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))),
        high = 0.018 + angle * 0.18,
        // (Its head flies out over the year it was thrown in, and it stays as a line after.)
        reach = Math.max(0, Math.min(1, (since + 1) / 0.8)),
        dots: { x: number; y: number; z: number; head: boolean }[] = [];
      for (let i = 0; i <= ARC_DOTS; i++) {
        const u = i / ARC_DOTS;
        if (u > reach) break;
        const s = Math.sin(angle) || 1,
          ka = angle > 1e-4 ? Math.sin((1 - u) * angle) / s : 1 - u,
          kb = angle > 1e-4 ? Math.sin(u * angle) / s : u,
          r = 1.012 + high * Math.sin(Math.PI * u);
        dots.push({
          x: (a[0] * ka + b[0] * kb) * r,
          y: (a[1] * ka + b[1] * kb) * r,
          z: (a[2] * ka + b[2] * kb) * r,
          head: i === Math.floor(reach * ARC_DOTS),
        });
      }
      if (dots.length) out.push({ key: k.event, dots, from: a, to: b });
    }
  return out;
}

/**
 * What of a raid is over a town at moment t (none: nothing now): its machines, its loads falling, each hit's burst where it
 * came down and what it threw, the ground it scorched; rockets on their way down and the smoke they left; the greatest fire.
 */
export function raidNow(scene: TownScene | null, t: number): RaidNow {
  const list = scene?.plan.struck;
  if (!scene || !list?.length) return NONE;
  let flyers: RaidFlyer[] | null = null,
    by: string | null = null;
  const streaks: RocketStreak[] = [],
    falling: RaidLoad[] = [],
    bursts: RaidBurst[] = [],
    marks: RaidMark[] = [],
    d = [0, 0, 0],
    { struck, states, lots } = scene;
  // A hit's burst while it lasts: where it came down, `s` world seconds ago, so much greater than a load's.
  const burst = (key: number, x: number, y: number, z: number, s: number, size: number) => {
    const life = size > 1 ? ROCKET_BURST_S : BURST_S;
    if (s < 0 || s > life || bursts.length >= MOST_BURSTS) return;
    bursts.push({
      x,
      y,
      z,
      k: s / life,
      s,
      ...(size > 1 ? { size } : {}),
      key,
      bits: thrownOf(scene, key, x, y, z, t - s, size),
    });
  };
  // A load of raid k meant for (x, z) at `at`: on its way down, nose down along its fall, or come down on what was in its way.
  const load = (k: TownStrike, key: number, x: number, z: number, at: number) => {
    const s = t - at;
    if (s < -FALL_S || s > BURST_S) return;
    const way = wayOf(k),
      speed = k.raid!.speed,
      hit = loadImpact(scene, key, x, z, at, way.heading, speed, way.high);
    if (s >= hit.dt) return burst(key, hit.x, hit.y, hit.z, s - hit.dt, 1);
    if (falling.length >= MOST_FALLING) return;
    const u = 1 + s / FALL_S,
      drop = Math.max(1, way.high - hit.top);
    // (Falling as it was flown: on along the machine's way, faster and faster down.)
    falling.push({
      x: x + Math.sin(way.heading) * speed * s,
      y: hit.top + drop * (1 - u * u),
      z: z + Math.cos(way.heading) * speed * s,
      yaw: way.heading,
      pitch: Math.atan2((2 * drop * u) / FALL_S, Math.max(1, speed)),
    });
  };
  // Those falling or bursting of a list of lots in the order they caught: every so many of the list as it stands, the same ones
  // from frame to frame, to what can be drawn. `rest`: those not under a stream drawn, the rest of a great raid.
  const within = (hits: readonly number[], rest: boolean) => {
    let lo = 0,
      hi = hits.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (states.began[hits[mid]!]! < t - BURST_S) lo = mid + 1;
      else hi = mid;
    }
    let end = lo;
    while (end < hits.length && states.began[hits[end]!]! <= t + FALL_S) end++;
    const stride = Math.max(1, Math.ceil((end - lo) / (MOST_FALLING + MOST_BURSTS)));
    for (let i = Math.ceil(lo / stride) * stride; i < end; i += stride) {
      const p = hits[i]!,
        n = states.struck[p]!,
        k = list[n];
      // (A rocket's is its fall, not its lots'; what the greatest fire does is its own.)
      if (!k?.raid || k.raid.rocket || k.raid.great || (rest && wayOf(k).underMask?.[p])) continue;
      load(k, keyOf(n, 0, p), lots.x[p]!, lots.z[p]!, states.began[p]!);
    }
  };
  for (let n = 0; n < list.length; n++) {
    const k = list[n]!;
    if (!k.raid) continue;
    const way = wayOf(k);
    // Rockets: no machine; each on its way down out of the sky, and the smoke it left; its burst where it stopped.
    if (k.raid.rocket) {
      const run = raidRun(k),
        V = Math.max(200, k.raid.speed);
      if (t < run.from - DIVE_SEEN / V - 1 || t > run.to + MARK_S) continue;
      const ux = Math.sin(way.heading),
        uz = Math.cos(way.heading);
      (way.falls ?? []).forEach((f, r) => {
        const key = keyOf(n, 2, r),
          dive = diveImpact(scene, key, f.x, f.z, f.at, way.heading),
          down = f.at - dive.stop / V,
          since = t - down;
        // (The ground about where it came down, scorched: what of it is not under the homes it burned.)
        if (!k.raid!.great && since >= 0 && since <= MARK_S && marks.length < MOST_MARKS)
          marks.push({ x: f.x, z: f.z, r: 11, k: since / MARK_S });
        if (since < -(DIVE_SEEN - dive.stop) / V || since > STREAK_HANGS) return;
        by = k.raid!.by;
        const head = dive.stop + Math.max(0, -since) * V;
        diveAt(head, d);
        streaks.push({
          x: f.x - ux * d[0]!,
          y: dive.top + d[1]!,
          z: f.z - uz * d[0]!,
          yaw: way.heading,
          slant: d[2]!,
          ax: f.x,
          ay: dive.top,
          az: f.z,
          head,
          stop: dive.stop,
          speed: V,
          since,
          fade: since > 0 ? since / STREAK_HANGS : 0,
          falling: since < 0,
          key,
        });
        // (The greatest fire's own is its own: render/raid.ts.)
        if (!k.raid!.great) {
          diveAt(dive.stop, d);
          burst(key, f.x - ux * d[0]!, dive.top + d[1]!, f.z - uz * d[0]!, since, 4);
        }
      });
      continue;
    }
    const span = raidSpan(k);
    if (t < span.from || t > span.to + MARK_S) continue;
    // Its loads on what it did not burn, and the ground they scorched.
    if (!k.raid.great) {
      const strays = way.strays,
        every = Math.max(1, Math.ceil(strays.length / MOST_MARKS));
      for (let j = 0; j < strays.length; j++) {
        const s = strays[j]!,
          since = t - s.at;
        if (since < -FALL_S) break;
        if (since > MARK_S) continue;
        const g = groundBy(scene, s.p, s.at);
        if (since <= BURST_S) load(k, keyOf(n, 1, s.p), g.x, g.z, s.at);
        if (since >= 0 && j % every === 0 && marks.length < MOST_MARKS)
          marks.push({ x: g.x, z: g.z, r: 3.4, k: since / MARK_S });
      }
    }
    if (t > span.to) continue;
    // Its machines: in threes, each three a wedge, its leader ahead and its two a little behind and to either side.
    const key = hashText(k.event),
      ux = Math.sin(way.heading),
      uz = Math.cos(way.heading),
      count = Math.min(MOST_RAIDERS, Math.max(1, k.raid.flyers)),
      rows = rowsOf(k),
      each = k.raid.span * 2.4;
    by = k.raid.by;
    flyers ??= [];
    for (let j = 0; j < count; j++) {
      const row = Math.floor(j / ABREAST),
        side = (j % ABREAST) - 1,
        along = (t - rowOver(k, row, rows)) * k.raid.speed - (side ? each * 0.55 : 0);
      if (Math.abs(along) > RAID_FAR) continue;
      const aside = side * each + (unit(key, 40 + j) - 0.5) * k.raid.span * 0.3;
      flyers.push({
        x: ux * along + uz * aside,
        y: way.high + (unit(key, 70 + row) - 0.5) * 30 + (side ? 2 + 3 * unit(key, 90 + j) : 0),
        z: uz * along - ux * aside,
        yaw: way.heading,
        span: k.raid.span,
        length: k.raid.span * 0.7,
      });
    }
  }
  // (Those under the machines drawn first: the rest of a great raid is what is not drawn of it.)
  for (const k of list) if (k.raid && !k.raid.rocket) within(wayOf(k).under, false);
  if (falling.length < MOST_FALLING || bursts.length < MOST_BURSTS) within(struck, true);
  let great: GreatNow | undefined;
  for (const k of list) {
    const g = k.raid?.great ? wayOf(k).great : undefined;
    if (!g || t < g.at || t > g.at + GREAT_LASTS) continue;
    great = { x: g.x, z: g.z, since: t - g.at };
    by = k.raid!.by;
  }
  return flyers?.length ||
    streaks.length ||
    falling.length ||
    bursts.length ||
    marks.length ||
    great
    ? {
        flyers: flyers ?? [],
        streaks,
        falling,
        bursts,
        marks,
        by,
        ...(great ? { great } : {}),
      }
    : NONE;
}
