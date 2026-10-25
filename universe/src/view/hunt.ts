// The hunt (Phase 47 M209; asked for 2026-10-25: "...work on bringing back og causlisis like
// town/country game play and sim like the depth the og game had ... and just actions of stuff
// yk"): on a hunting day a town's hunters go out together after the game that grazes in the wild
// beyond its fields. Gathered where the wild begins, they close on the herd slowly from the town's
// side, rush it, and as often as not bring one down; they dress it where it fell, and one carries
// it home across the shoulders, the rest after with their spears. The herd runs at the rush and
// comes back to its grazing over the days after. Pure: the same town and moment, the same hunt,
// wherever it is looked at from.
import { LAKE_R, type VillagePlan } from "../bridge/index.ts";
import { OCC } from "../rules/index.ts";
import { hashText, unitOf } from "./draws.ts";
import { restDay } from "./seasons.ts";

const DAY = 86_400,
  HOUR = 3_600;

/** The hunt's hours: stalking, the rush, and done (the kill dressed, or the herd long gone). */
export const HUNT_STALK: readonly [number, number] = [8, 9.6];
export const HUNT_RUSH: readonly [number, number] = [9.6, 9.62];
export const HUNT_DONE = 10.4;
/** At most so many go out after the game. */
export const HUNT_PARTY = 6;
/** The share of working days that are hunting days, and of hunts that bring one down. */
const HUNT_DAYS = 0.45,
  KILLS = 0.6;
/** How far off the stalk begins, and the rush (metres from the herd); the hunters apart, abreast. */
const STALK_FROM = 140,
  RUSH_FROM = 30,
  ABREAST = 4.5;
/** How far the herd runs at the rush (metres), how long it runs, and how long it is in coming back. */
export const FLIGHT = 90;
const RUN_S = 240,
  BACK_DAYS = 2;

type Point = { readonly x: number; readonly z: number };

/** The kinds that are game: what grazes and browses in the wild, and the great beasts. */
export function gameOf(
  plan: VillagePlan,
): NonNullable<VillagePlan["fauna"]>["wild"][number] | null {
  return (
    plan.fauna?.wild.find(
      (s) =>
        (s.niche === "grazer" || s.niche === "browser" || s.niche === "great beast") &&
        s.stock > 0.05,
    ) ?? null
  );
}

/** Whether a town has the hunters for a hunt: two of its foragers grown. */
function hunters(plan: VillagePlan): boolean {
  let n = 0;
  for (const p of plan.people)
    if (p.occupation === OCC.forager && !p.child && ++n >= 2) return true;
  return false;
}

const GROUNDS = new WeakMap<VillagePlan, Point | null>();

/**
 * Where a town's game grazes (metres from its middle): in the wild between its homes and the
 * wild's edge, on the side away from its fields, turned until clear of its pasture and its water.
 * Null where it has no game or no hunters.
 */
export function huntGround(plan: VillagePlan): Point | null {
  if (GROUNDS.has(plan)) return GROUNDS.get(plan)!;
  let spot: Point | null = null;
  if (gameOf(plan) && hunters(plan)) {
    let fx = 0,
      fz = 0,
      homes = 40;
    for (const f of plan.fields) {
      fx += f.x;
      fz += f.z;
    }
    for (const h of plan.homes) homes = Math.max(homes, Math.hypot(h.x, h.z));
    const fieldWay = plan.fields.length ? Math.atan2(fz, fx) : 0,
      near = homes + (plan.town ? 90 : 60),
      far = Math.max(near + 120, plan.wild + 60),
      r = near + 0.6 * (far - near),
      p = plan.pasture,
      w = plan.water,
      clear = (x: number, z: number) =>
        Math.hypot(x - p.x, z - p.z) > p.r + 60 &&
        (!w || Math.hypot(x - w.x, z - w.z) > LAKE_R + 150);
    // (Away from the fields, turned this way and that, wider each time, until clear.)
    for (let turn = 0; turn < 24 && !spot; turn++) {
      const a = fieldWay + Math.PI + (turn % 2 ? 1 : -1) * 0.3 * Math.ceil(turn / 2),
        x = r * Math.cos(a),
        z = r * Math.sin(a);
      if (clear(x, z)) spot = { x, z };
    }
    spot ??= { x: -r * Math.cos(fieldWay), z: -r * Math.sin(fieldWay) };
  }
  GROUNDS.set(plan, spot);
  return spot;
}

/** A day's hunt: the herd where the rush finds it, the way the hunters come at it, whether one falls. */
export type Hunt = {
  readonly day: number;
  /** The herd's middle at the rush, before it runs. */
  readonly target: Point;
  /** The way from the town to the herd (unit): the hunters come along it, the herd runs on along it. */
  readonly ux: number;
  readonly uz: number;
  /** Where the one brought down falls; null: the herd got away. */
  readonly kill: (Point & { readonly yaw: number }) | null;
};

const HUNTS = new WeakMap<VillagePlan, Map<number, Hunt | null>>();

/** The hunt on a day (days since the world began), or null where there is none. */
export function huntOn(plan: VillagePlan, day: number): Hunt | null {
  let days = HUNTS.get(plan);
  if (!days) HUNTS.set(plan, (days = new Map()));
  if (days.has(day)) return days.get(day)!;
  const ground = huntGround(plan),
    seed = hashText(`hunt ${plan.ref}`);
  let hunt: Hunt | null = null;
  if (ground && !restDay(plan, day) && unitOf(seed, day, 1) < HUNT_DAYS) {
    const target = grazing(plan, ground, (day + HUNT_RUSH[0] / 24) * DAY),
      d = Math.hypot(target.x, target.z) || 1,
      ux = target.x / d,
      uz = target.z / d;
    hunt = {
      day,
      target,
      ux,
      uz,
      kill:
        unitOf(seed, day, 2) < KILLS
          ? {
              x: target.x + ux * 8 + uz * (unitOf(seed, day, 3) - 0.5) * 6,
              z: target.z + uz * 8 - ux * (unitOf(seed, day, 3) - 0.5) * 6,
              yaw: Math.atan2(ux, uz) + (unitOf(seed, day, 4) - 0.5) * 2,
            }
          : null,
    };
  }
  if (days.size > 40) days.clear();
  days.set(day, hunt);
  return hunt;
}

/** Where the game grazes at moment t, ignoring the hunts: slowly about its ground. */
function grazing(plan: VillagePlan, ground: Point, t: number): Point {
  const w = t / HOUR,
    k = (hashText(`game ${plan.ref}`) % 1000) / 159;
  return {
    x: ground.x + 22 * Math.cos(w * 0.11 + k),
    z: ground.z + 22 * Math.sin(w * 0.09 + 2 * k),
  };
}

/** The game now: its middle (run off after a rush, coming back), how alarmed, running, the one down. */
export type GameNow = {
  readonly x: number;
  readonly z: number;
  /** Heads up as the hunters creep in (0 … 1). */
  readonly alert: number;
  readonly running: boolean;
  /** Where its one brought down lies today, from the rush till it is carried off; null: none. */
  readonly down: (Point & { readonly yaw: number }) | null;
  /** The one brought down today is gone from the herd (from the rush till the day's end). */
  readonly struck: boolean;
};

const ease = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

/** The game at moment t, or null where the town has none. */
export function gameAt(plan: VillagePlan, t: number): GameNow | null {
  const ground = huntGround(plan);
  if (!ground) return null;
  const day = Math.floor(t / DAY),
    s = t - day * DAY,
    at = grazing(plan, ground, t);
  let x = at.x,
    z = at.z,
    alert = 0,
    running = false,
    down: GameNow["down"] = null,
    struck = false;
  // (The rushes of the last few days: it runs, and comes back over the days after.)
  for (let d = day - BACK_DAYS; d <= day; d++) {
    const hunt = huntOn(plan, d);
    if (!hunt) continue;
    const since = t - (d * DAY + HUNT_RUSH[0] * HOUR);
    if (since < 0) {
      // (Heads up in the stalk's last stretch.)
      if (d === day) alert = ease((s / HOUR - (HUNT_STALK[1] - 0.4)) / 0.4);
      continue;
    }
    const off =
      since < RUN_S
        ? ease(since / RUN_S)
        : Math.max(0, 1 - (since - RUN_S) / (BACK_DAYS * DAY - RUN_S));
    x += hunt.ux * FLIGHT * off;
    z += hunt.uz * FLIGHT * off;
    if (since < RUN_S) running = true;
    if (d === day) {
      alert = Math.max(alert, since < RUN_S + HOUR ? 1 : 0);
      struck = !!hunt.kill;
      if (hunt.kill && s < HUNT_DONE * HOUR) down = hunt.kill;
    }
  }
  return { x, z, alert, running, down, struck };
}

/** What a hunter is about, now. */
const HUNT_WHY = {
  waiting: "Gathered for the hunt, waiting on the others",
  stalking: "Stalking the herd",
  rush: "Running at the herd",
  dressing: "Dressing the kill",
  kill: "Standing by the kill",
  missed: "The herd got away",
} as const;

/**
 * Where the seat-th of a town's hunters is at moment t on a hunting day, facing which way, what
 * they are about and how (stalking low, the rush, kneeling at the kill): abreast and closing in,
 * then about the kill (or where the herd was). Null outside the hunt's hours or on a day without one.
 */
export function hunterAt(
  plan: VillagePlan,
  t: number,
  seat: number,
):
  | (Point & {
      readonly face: number;
      readonly why: string;
      readonly task: "stalk" | "strike" | "gather" | null;
    })
  | null {
  const day = Math.floor(t / DAY),
    hunt = huntOn(plan, day);
  if (!hunt) return null;
  const s = t / HOUR - day * 24;
  if (s >= HUNT_DONE) return null;
  const { ux, uz, target } = hunt,
    // (Abreast: across the way they come, the first in the middle.)
    across = (seat % 2 ? 1 : -1) * Math.ceil(seat / 2) * ABREAST,
    face = Math.atan2(ux, uz),
    line = (back: number, spread = 1): Point => ({
      x: target.x - ux * back - uz * across * spread,
      z: target.z - uz * back + ux * across * spread,
    });
  if (s < HUNT_STALK[0]) return { ...line(STALK_FROM), face, why: HUNT_WHY.waiting, task: null };
  if (s < HUNT_STALK[1]) {
    const k = ease((s - HUNT_STALK[0]) / (HUNT_STALK[1] - HUNT_STALK[0]));
    return {
      ...line(STALK_FROM + (RUSH_FROM - STALK_FROM) * k),
      face,
      why: HUNT_WHY.stalking,
      task: "stalk",
    };
  }
  const end = hunt.kill ?? {
    x: target.x + ux * 12,
    z: target.z + uz * 12,
  };
  if (s < HUNT_RUSH[1]) {
    const k = (s - HUNT_RUSH[0]) / (HUNT_RUSH[1] - HUNT_RUSH[0]),
      from = line(RUSH_FROM),
      to = { x: end.x - uz * across * 0.5, z: end.z + ux * across * 0.5 };
    return {
      x: from.x + (to.x - from.x) * k,
      z: from.z + (to.z - from.z) * k,
      face,
      why: HUNT_WHY.rush,
      task: "strike",
    };
  }
  if (!hunt.kill) {
    // (Where the herd was, looking after it.)
    return {
      x: end.x - uz * across * 0.5,
      z: end.z + ux * across * 0.5,
      face,
      why: HUNT_WHY.missed,
      task: null,
    };
  }
  // About the kill, facing it: the first two kneeling to dress it, the rest round them. (Folk are
  // drawn a good deal bigger than their metres: room enough between them to see it.)
  const a = hunt.kill.yaw + 0.9 + seat * 1.15,
    r = seat < 2 ? 3 : 5.2;
  const x = hunt.kill.x + Math.cos(a) * r,
    z = hunt.kill.z + Math.sin(a) * r;
  return {
    x,
    z,
    face: Math.atan2(hunt.kill.x - x, hunt.kill.z - z),
    why: seat < 2 ? HUNT_WHY.dressing : HUNT_WHY.kill,
    task: seat < 2 ? "gather" : null,
  };
}
