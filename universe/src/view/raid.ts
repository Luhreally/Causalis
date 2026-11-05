// A town struck from the air, seen as it plays out (War past the line, W2; asked for 2026-11-05: "...and
// drones and modern military and stuff beyond imagination"). Its people's foes' machines come over on a run,
// in the world's own time, tip to tip and as fast as their air and pull make them, and their load falls; each
// hit sets its lot alight as any fire does (view/blaze.ts burns it on from there). Pure: the same plan at the
// same moment flies the same.
import {
  SPREAD,
  type LotStates,
  type TownLots,
  type TownPlan,
  type TownStrike,
  type WarsMap,
} from "../bridge/index.ts";
import type { Slowing } from "./battleday.ts";
import type { TownScene } from "./town.ts";

/** How high they come over (metres; an estimate), how far from the town they are first drawn (metres). */
export const RAID_HIGH = 150,
  RAID_FAR = 1300;
/** How long a load takes to fall (seconds, from that height at Earth's pull) and how long a hit's burst lasts. */
export const FALL_S = 5.5,
  BURST_S = 4;
/** The most flyers, falling loads and bursts drawn at once. */
export const MOST_RAIDERS = 12,
  MOST_FALLING = 24,
  MOST_BURSTS = 24;
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
  readonly strays: readonly { readonly p: number; readonly at: number }[];
  readonly falls?: readonly RocketFall[];
  /** How high they come over (m): over the tallest of what stands there, in a city of spires. */
  readonly high: number;
};
/** One rocket's fall on a town (W3): when, and where. */
type RocketFall = { readonly at: number; readonly x: number; readonly z: number };
/** How steeply they come down (radians from level, est: Earth's first came down at some 65 degrees), how high they are drawn from (m). */
const STREAK_DOWN = 1.13,
  STREAK_HIGH = 1600;
/** How long a streak hangs after it has fallen (world seconds), how long before its first fall the sky is watched (world seconds), and after its last. */
export const STREAK_HANGS = 40,
  ROCKET_BEFORE = 14,
  ROCKET_AFTER = 30;
/** The most rockets' falls drawn on a town, and how fast the clock runs through them: the world's own. */
export const MOST_STREAKS = 8,
  ROCKET_SPEED = 1;
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
export function timeRaids(plan: TownPlan, lots: TownLots, states: LotStates, rise = 0): void {
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
    if (k.raid.rocket) {
      timeRocket(k, key, mine, plan.lots, lots, states, Math.max(RAID_HIGH, rise + 40));
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
    WAYS.set(k, { heading, under, strays, high: Math.max(RAID_HIGH, rise + 40) });
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
  drawn: number,
  lots: TownLots,
  states: LotStates,
  high: number,
): void {
  const heading = unit(key, 1) * 2 * Math.PI,
    runs: number[][] = [];
  // (A town flattened last year has nothing it can burn in all that is drawn: they still come down here, on the ruins.)
  if (!mine.length) {
    const n = Math.min(4, Math.max(1, k.raid?.flyers ?? 1)),
      span = raidRun(k),
      each = n > 1 ? (span.to - span.from) / (n - 1) : 0,
      strays: { p: number; at: number }[] = [],
      falls: RocketFall[] = [];
    for (let r = 0; r < n; r++) {
      const p = Math.floor(unit(key, 50 + r) * drawn),
        at = span.from + r * each;
      strays.push({ p, at });
      falls.push({ at, x: lots.x[p]!, z: lots.z[p]! });
    }
    WAYS.set(k, { heading, under: [], strays, falls, high });
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
/** A rocket's streak (W3): its head now and where the streak reaches up to (metres), and how far it has faded (0 … 1). */
export type RocketStreak = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  /** How long it is (m), and down at what slant (radians). */
  readonly length: number;
  readonly slant: number;
  readonly fade: number;
  /** Whether it has yet to land: a bright head. */
  readonly falling: boolean;
};
export type RaidNow = {
  readonly flyers: readonly RaidFlyer[];
  /** Rockets' streaks (W3). */
  readonly streaks: readonly RocketStreak[];
  /** Loads on their way down. */
  readonly falling: readonly { readonly x: number; readonly y: number; readonly z: number }[];
  /** Hits just landed: how far through its burst (0 … 1), and how much larger than a drop's. */
  readonly bursts: readonly {
    readonly x: number;
    readonly z: number;
    readonly k: number;
    readonly size?: number;
  }[];
  /** Whose machines they are (null: none over the town now). */
  readonly by: string | null;
};
const NONE: RaidNow = { flyers: [], streaks: [], falling: [], bursts: [], by: null };

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
  for (const w of map?.wars ?? [])
    for (const k of w.raids ?? []) {
      if (told.has(k.event)) continue;
      told.add(k.event);
      // (History reckons it at the turn that ends its year.)
      const since = y - (k.year + 1);
      if (since < 0 || since > LAND_BURN) continue;
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
          words: `☄️ ${k.name}: ${k.dead.toLocaleString("en")} dead`,
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

/** What of a raid is over a town at moment t (none: nothing now). */
export function raidNow(scene: TownScene | null, t: number): RaidNow {
  const list = scene?.plan.struck;
  if (!scene || !list?.length) return NONE;
  let flyers: RaidFlyer[] | null = null,
    by: string | null = null;
  const streaks: RocketStreak[] = [];
  for (const k of list) {
    if (!k.raid) continue;
    const span = raidSpan(k);
    if (t < span.from || t > span.to) continue;
    // (Rockets: no machine; whose they are, and each one's streak.)
    if (k.raid.rocket) {
      by = k.raid.by;
      const way = wayOf(k),
        ux = Math.sin(way.heading),
        uz = Math.cos(way.heading),
        cos = Math.cos(STREAK_DOWN),
        sin = Math.sin(STREAK_DOWN),
        fall = Math.max(200, k.raid.speed);
      for (const f of way.falls ?? []) {
        const since = t - f.at;
        // (From when it can first be seen up there until its smoke is gone.)
        if (since < -STREAK_HIGH / fall || since > STREAK_HANGS) continue;
        const left = Math.max(0, -since * fall),
          // The head on its way down; what it leaves reaches back up to where it was first seen.
          length = STREAK_HIGH - left;
        streaks.push({
          x: f.x - ux * cos * left,
          y: sin * left,
          z: f.z - uz * cos * left,
          yaw: way.heading,
          length,
          slant: STREAK_DOWN,
          fade: since > 0 ? since / STREAK_HANGS : 0,
          falling: since < 0,
        });
      }
      continue;
    }
    const key = hashText(k.event),
      heading = wayOf(k).heading,
      ux = Math.sin(heading),
      uz = Math.cos(heading),
      n = Math.min(MOST_RAIDERS, Math.max(1, k.raid.flyers)),
      rows = rowsOf(k),
      each = k.raid.span * 2.4;
    by = k.raid.by;
    flyers ??= [];
    for (let j = 0; j < n; j++) {
      const row = Math.floor(j / ABREAST),
        along = (t - rowOver(k, row, rows)) * k.raid.speed;
      if (Math.abs(along) > RAID_FAR) continue;
      const aside = ((j % ABREAST) - 1) * each + (unit(key, 40 + j) - 0.5) * k.raid.span;
      flyers.push({
        x: ux * along + uz * aside,
        y: wayOf(k).high + (unit(key, 70 + j) - 0.5) * 30,
        z: uz * along - ux * aside,
        yaw: heading,
        span: k.raid.span,
        length: k.raid.span * 0.7,
      });
    }
  }
  const falling: { x: number; y: number; z: number }[] = [],
    bursts: { x: number; z: number; k: number }[] = [],
    { struck, states, lots } = scene,
    // A load on its way down to a lot, or just landed on it.
    load = (k: TownStrike, p: number, since: number) => {
      if (since < 0) {
        // (A rocket's is its streak, not a load falling from a machine.)
        if (k.raid!.rocket || falling.length >= MOST_FALLING) return;
        const heading = wayOf(k).heading,
          left = -since / FALL_S;
        // (Falling as it was flown: on along the machine's way, faster and faster down.)
        falling.push({
          x: lots.x[p]! - Math.sin(heading) * k.raid!.speed * -since,
          y: wayOf(k).high * (1 - (1 - left) * (1 - left)),
          z: lots.z[p]! - Math.cos(heading) * k.raid!.speed * -since,
        });
      } else if (bursts.length < MOST_BURSTS)
        bursts.push({
          x: lots.x[p]!,
          z: lots.z[p]!,
          k: since / BURST_S,
          ...(k.raid!.rocket ? { size: 4 } : {}),
        });
    },
    // Those falling or bursting of a list of lots in the order they caught, a stride through it to what can be drawn.
    within = (hits: readonly number[]) => {
      let lo = 0,
        hi = hits.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (states.began[hits[mid]!]! < t - BURST_S) lo = mid + 1;
        else hi = mid;
      }
      let many = 0;
      for (let i = lo; i < hits.length && states.began[hits[i]!]! <= t + FALL_S; i++) many++;
      const stride = Math.max(1, Math.ceil(many / (MOST_FALLING + MOST_BURSTS)));
      for (let i = lo; i < hits.length; i += stride) {
        const p = hits[i]!,
          since = t - states.began[p]!;
        if (since < -FALL_S) break;
        const k = list[states.struck[p]!];
        if (k?.raid) load(k, p, since);
      }
    };
  // (Those under the machines drawn first: the rest of a great raid is what is not drawn of it.)
  for (const k of list) if (k.raid) within(wayOf(k).under);
  if (falling.length < MOST_FALLING || bursts.length < MOST_BURSTS) within(struck);
  for (const k of list) {
    if (!k.raid || t < raidSpan(k).from || t > raidSpan(k).to + BURST_S) continue;
    for (const s of wayOf(k).strays) {
      const since = t - s.at;
      if (since < -FALL_S) break;
      if (since <= BURST_S) load(k, s.p, since);
    }
  }
  return flyers?.length || streaks.length || falling.length || bursts.length
    ? { flyers: flyers ?? [], streaks, falling, bursts, by }
    : NONE;
}
