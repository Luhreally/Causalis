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
 * A raid as its town's scene reads it: which way it flies; the hits under its stream, those first to catch first; and where its
 * loads land on what it does not burn, first first. (A town flattened last year has nothing it can burn in all that is drawn: what
 * this raid brought down lies further out, and its machines would cross the ruins with nothing falling from them.)
 */
type RaidWay = {
  readonly heading: number;
  readonly under: readonly number[];
  readonly strays: readonly { readonly p: number; readonly at: number }[];
};
const WAYS = new WeakMap<TownStrike, RaidWay>();
const wayOf = (k: TownStrike): RaidWay =>
  WAYS.get(k) ?? { heading: unit(hashText(k.event), 1) * 2 * Math.PI, under: [], strays: [] };

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
export function timeRaids(plan: TownPlan, lots: TownLots, states: LotStates): void {
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
      key = hashText(k.event),
      first = mine.slice(0, Math.ceil(mine.length / 4));
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
    WAYS.set(k, { heading, under, strays });
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
  return {
    target: { x: 0, y: 2, z: 0 },
    yaw: (wayOf(k).heading * 180) / Math.PI - 16,
    pitch: -8,
    distance: 62,
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
export type RaidNow = {
  readonly flyers: readonly RaidFlyer[];
  /** Loads on their way down. */
  readonly falling: readonly { readonly x: number; readonly y: number; readonly z: number }[];
  /** Hits just landed: how far through its burst (0 … 1). */
  readonly bursts: readonly { readonly x: number; readonly z: number; readonly k: number }[];
  /** Whose machines they are (null: none over the town now). */
  readonly by: string | null;
};
const NONE: RaidNow = { flyers: [], falling: [], bursts: [], by: null };

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
  const from = k.at + SPREAD.raidFrom;
  return { from, to: from + SPREAD.raidAll };
}

/** From when its first is drawn until its last is gone (world seconds). */
export function raidSpan(k: TownStrike): { readonly from: number; readonly to: number } {
  const run = raidRun(k),
    far = RAID_FAR / Math.max(1, k.raid?.speed ?? 46);
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
      speed: RAID_SPEED,
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
} {
  const s = raidSpan(k),
    run = raidRun(k);
  return { from: s.from, calm: run.to + 25, to: run.to + 600 };
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
): readonly LandRaidNow[] {
  const out: LandRaidNow[] = [];
  for (const w of map?.wars ?? [])
    for (const k of w.raids ?? []) {
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
        flyers = [];
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

/** What of a raid is over a town at moment t (none: nothing now). */
export function raidNow(scene: TownScene | null, t: number): RaidNow {
  const list = scene?.plan.struck;
  if (!scene || !list?.length) return NONE;
  let flyers: RaidFlyer[] | null = null,
    by: string | null = null;
  for (const k of list) {
    if (!k.raid) continue;
    const span = raidSpan(k);
    if (t < span.from || t > span.to) continue;
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
        y: RAID_HIGH + (unit(key, 70 + j) - 0.5) * 30,
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
        if (falling.length >= MOST_FALLING) return;
        const heading = wayOf(k).heading,
          left = -since / FALL_S;
        // (Falling as it was flown: on along the machine's way, faster and faster down.)
        falling.push({
          x: lots.x[p]! - Math.sin(heading) * k.raid!.speed * -since,
          y: RAID_HIGH * (1 - (1 - left) * (1 - left)),
          z: lots.z[p]! - Math.cos(heading) * k.raid!.speed * -since,
        });
      } else if (bursts.length < MOST_BURSTS)
        bursts.push({ x: lots.x[p]!, z: lots.z[p]!, k: since / BURST_S });
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
  return flyers?.length || falling.length || bursts.length
    ? { flyers: flyers ?? [], falling, bursts, by }
    : NONE;
}
