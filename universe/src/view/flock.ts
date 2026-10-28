// The flock's day and year (Phase 46 M208; asked for 2026-10-25: "...work on bringing back og
// causlisis like town/country game play and sim like the depth the og game had ... and just
// actions of stuff yk"): a town's flock folded by night at its pasture's gap, let out in the
// morning to graze and brought in before evening, its herders with it; after the harvest driven out
// through the gap to graze the stubble of the fields reaped; in winter kept at the fold on hay; its
// young born in the spring and grown by the harvest, a woolly flock shorn on a day of early summer,
// and a share of it taken for the winter in late autumn. A pure function of the town's plan and
// the moment: the same town, the same flock, wherever it is looked at from.
import type { VillagePlan } from "../bridge/index.ts";
import { hashText, unitOf } from "./draws.ts";
import { HARVEST, WINTER, restDay } from "./seasons.ts";
import { reapingsOf } from "./fields.ts";

const DAY = 86_400,
  HOUR = 3_600;

/** The drives (hours of the day): out from the fold, and in to it. Lying down from dusk to dawn. */
export const FLOCK_OUT: readonly [number, number] = [7.25, 8];
export const FLOCK_IN: readonly [number, number] = [16.75, 17.5];
export const FLOCK_LIES: readonly [number, number] = [19.5, 6.25];
/** The lambing weeks (shares of the year); the day of the shearing; the weeks it is thinned. */
export const LAMBING: readonly [number, number] = [0.2, 0.3];
export const SHEARING = 0.44;
export const CULL: readonly [number, number] = [0.84, 0.88];
/** One in so many of the flock taken for the winter (and as many young born in the spring). */
export const CULL_EVERY = 4;
/** After the harvest's first fields are reaped, the flock grazes their stubble until the cull. */
const STUBBLE_UNTIL = CULL[1];

type Point = { readonly x: number; readonly z: number };

export type FlockState = "folded" | "out" | "grazing" | "in" | "winter" | "shearing";

/** The flock now: where its middle is, which way it goes, what it is about. */
export type FlockNow = {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly state: FlockState;
  /** Where it grazes today: a reaped field's stubble (its index), else its pasture (-1). */
  readonly stubble: number;
  /** How far its beasts stand apart: 1 grazing … 0.32 packed in the fold. */
  readonly spread: number;
  /** Lying down (by night in the fold). */
  readonly lying: boolean;
  /** Driven along a way, its head at the middle: the way it goes (unit), else null. */
  readonly driven: { readonly ux: number; readonly uz: number } | null;
};

const yearDay = (day: number) => ((day % 365) + 365) % 365;

/** Where the flock is folded by night: in its pasture by the gap toward the town, facing in. */
export function foldOf(plan: Pick<VillagePlan, "pasture">): Point & { readonly yaw: number } {
  const p = plan.pasture,
    toward = Math.atan2(-p.z, -p.x);
  return {
    x: p.x + Math.cos(toward) * p.r * 0.62,
    z: p.z + Math.sin(toward) * p.r * 0.62,
    yaw: Math.atan2(-Math.cos(toward), -Math.sin(toward)),
  };
}

/** Just outside the pasture's gap, where a drive to the stubble leaves it. */
function gapOf(plan: Pick<VillagePlan, "pasture">): Point {
  const p = plan.pasture,
    toward = Math.atan2(-p.z, -p.x);
  return { x: p.x + Math.cos(toward) * (p.r + 6), z: p.z + Math.sin(toward) * (p.r + 6) };
}

/**
 * How far the fold's hurdles stand from its middle (metres): round the flock packed in it as many
 * as its herders keep, with room inside for them and its racks.
 */
export function foldReach(plan: Pick<VillagePlan, "pasture" | "fauna">): number {
  return Math.min(plan.pasture.r * 0.7, 8 + 4 * Math.sqrt(flockMany(plan))) * 0.32 + 4.5;
}

/**
 * How many a town's flock is drawn as at the most: six to each of its herders, up to as many as
 * the finest setting draws (a third of its 320 beasts). Its herders' places go by this, not by the
 * setting, so that a person's day is the same however the town is drawn.
 */
export const FLOCK_MOST = 112;
/** How many of a town's herders are with the flock it draws; the rest are out with its others. */
export const FLOCK_HANDS = 6;
function flockMany(plan: Pick<VillagePlan, "fauna">): number {
  return Math.min(FLOCK_MOST, Math.max(3, (plan.fauna?.flock?.herders ?? 0) * 6));
}

/** Whether a flock is kept at its fold on hay: from the winter's coming till the lambing's eve. */
export function onHay(t: number): boolean {
  const f = yearDay(Math.floor(t / DAY)) / 365;
  return f >= WINTER || f < LAMBING[0] - 0.08;
}

/** Whether the shorn fleeces lie piled by the fold: from the shearing's first hour to the day's end. */
export function fleecesPiled(plan: VillagePlan, t: number): boolean {
  const day = Math.floor(t / DAY);
  return day === shearingDay(plan, day) && t - day * DAY >= (FLOCK_OUT[0] + 0.5) * HOUR;
}

/** Whether a town keeps a flock (its herders and beasts). */
export function keepsFlock(plan: VillagePlan): boolean {
  return !!plan.fauna?.flock && plan.fauna.flock.herders > 0;
}

/** The day of the shearing this year (a working day), for a woolly flock; else -1. */
export function shearingDay(plan: VillagePlan, day: number): number {
  if (!plan.fauna?.flock?.wool) return -1;
  let d = day - yearDay(day) + Math.round(SHEARING * 365);
  while (restDay(plan, d)) d++;
  return d;
}

/**
 * Where the flock grazes on a day: the stubble of a field reaped (from when the harvest's first
 * fields are in until the cull — one of the three reaped nearest its pasture, on to the next every
 * four days), else its pasture, about a spot on its far side that moves from day to day.
 */
export function grazingOf(plan: VillagePlan, day: number): { at: Point; stubble: number } {
  const p = plan.pasture,
    yd = yearDay(day),
    seed = hashText(`flock ${plan.ref}`);
  if (yd / 365 < STUBBLE_UNTIL && !restDay(plan, day)) {
    const reaped = reapingsOf(plan)
      .map((r, k) => ({ r, k }))
      .filter((x) => x.r && x.r.to <= yd)
      .map((x) => {
        const f = plan.fields[x.k]!;
        return { k: x.k, f, d: Math.hypot(f.x - p.x, f.z - p.z) };
      })
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
    if (reaped.length) {
      const pick = reaped[Math.floor(yd / 4) % reaped.length]!;
      return { at: { x: pick.f.x, z: pick.f.z }, stubble: pick.k };
    }
  }
  const away = Math.atan2(p.z, p.x) + (unitOf(seed, day, 1) - 0.5) * 1.6;
  return {
    at: { x: p.x + Math.cos(away) * p.r * 0.32, z: p.z + Math.sin(away) * p.r * 0.32 },
    stubble: -1,
  };
}

/** Along a way of points, k (0 … 1) of its length: where, and which way. */
function along(way: readonly Point[], k: number): Point & { ux: number; uz: number } {
  let total = 0;
  for (let i = 1; i < way.length; i++)
    total += Math.hypot(way[i]!.x - way[i - 1]!.x, way[i]!.z - way[i - 1]!.z);
  let left = Math.max(0, Math.min(1, k)) * total;
  for (let i = 1; i < way.length; i++) {
    const a = way[i - 1]!,
      b = way[i]!,
      d = Math.hypot(b.x - a.x, b.z - a.z) || 1e-6;
    if (left <= d || i === way.length - 1) {
      const f = Math.min(1, left / d);
      return {
        x: a.x + (b.x - a.x) * f,
        z: a.z + (b.z - a.z) * f,
        ux: (b.x - a.x) / d,
        uz: (b.z - a.z) / d,
      };
    }
    left -= d;
  }
  const last = way[way.length - 1]!;
  return { x: last.x, z: last.z, ux: 0, uz: 1 };
}

const ease = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

/** The flock at moment t, or null where the town keeps none. */
export function flockAt(plan: VillagePlan, t: number): FlockNow | null {
  if (!keepsFlock(plan)) return null;
  const day = Math.floor(t / DAY),
    s = t - day * DAY,
    fold = foldOf(plan),
    lying = s >= FLOCK_LIES[0] * HOUR || s < FLOCK_LIES[1] * HOUR,
    folded = (state: FlockState): FlockNow => ({
      x: fold.x,
      z: fold.z,
      yaw: fold.yaw,
      state,
      stubble: -1,
      spread: 0.32,
      lying,
      driven: null,
    });
  // In winter, at the fold on hay; on the shearing day, penned there to be shorn.
  if (onHay(t)) return folded(lying ? "folded" : "winter");
  if (day === shearingDay(plan, day) && s >= FLOCK_OUT[0] * HOUR && s < FLOCK_IN[1] * HOUR)
    return folded("shearing");
  const graze = grazingOf(plan, day),
    way: Point[] = graze.stubble >= 0 ? [fold, gapOf(plan), graze.at] : [fold, graze.at];
  if (s < FLOCK_OUT[0] * HOUR || s >= FLOCK_IN[1] * HOUR) return folded("folded");
  const drive = (k: number, back: boolean): FlockNow => {
    const at = along(back ? [...way].reverse() : way, ease(k));
    return {
      x: at.x,
      z: at.z,
      yaw: Math.atan2(at.ux, at.uz),
      state: back ? "in" : "out",
      stubble: graze.stubble,
      spread: 0.6,
      lying: false,
      driven: { ux: at.ux, uz: at.uz },
    };
  };
  if (s < FLOCK_OUT[1] * HOUR)
    return drive((s / HOUR - FLOCK_OUT[0]) / (FLOCK_OUT[1] - FLOCK_OUT[0]), false);
  if (s >= FLOCK_IN[0] * HOUR)
    return drive((s / HOUR - FLOCK_IN[0]) / (FLOCK_IN[1] - FLOCK_IN[0]), true);
  // Grazing: its middle wandering slowly about the day's spot.
  const w = (s / HOUR) * 0.7 + unitOf(hashText(`flock ${plan.ref}`), day, 2) * 6.28,
    roam = graze.stubble >= 0 ? 6 : plan.pasture.r * 0.12;
  return {
    x: graze.at.x + Math.cos(w) * roam,
    z: graze.at.z + Math.sin(w * 0.8) * roam,
    yaw: w + Math.PI / 2,
    state: "grazing",
    stubble: graze.stubble,
    spread: 1,
    lying: false,
    driven: null,
  };
}

/**
 * The j-th of a flock of n at moment t: whether it is there (one in CULL_EVERY taken in the cull,
 * and born again as a lamb in the spring) and how big (a lamb grows to the flock's size by the
 * harvest).
 */
export function flockMember(
  plan: VillagePlan,
  j: number,
  t: number,
): { readonly shown: boolean; readonly size: number } {
  // (Lost to it by the god's hand: run off, or killed by him in a beast's body — Phase 61.)
  if (plan.fauna?.flock?.gone?.includes(j)) return { shown: false, size: 0 };
  if (j % CULL_EVERY !== CULL_EVERY - 1) return { shown: true, size: 1 };
  const seed = hashText(`flock ${plan.ref}`),
    f = yearDay(Math.floor(t / DAY)) / 365 + (t % DAY) / DAY / 365,
    gone = CULL[0] + unitOf(seed, j, 3) * (CULL[1] - CULL[0]),
    born = LAMBING[0] + unitOf(seed, j, 4) * (LAMBING[1] - LAMBING[0]);
  if (f >= gone || f < born) return { shown: false, size: 0 };
  return {
    shown: true,
    size: f >= HARVEST[0] ? 1 : 0.45 + 0.55 * ((f - born) / (HARVEST[0] - born)),
  };
}

/** What a herder is about, as the flock is. */
const HERD_WHY: Record<FlockState, string> = {
  folded: "At the fold with the flock",
  out: "Driving the flock out to graze",
  grazing: "Watching the flock at its grazing",
  in: "Bringing the flock in to the fold",
  winter: "Feeding the flock hay at the fold",
  shearing: "Shearing the flock",
};

/**
 * Where the seat-th of a town's herders stands with its flock at moment t, facing it, and what
 * they are about: behind it on a drive, about its edge while it grazes, among it at the shearing,
 * at the fold's side by its hay. Null where the town keeps no flock.
 */
export function herderAt(
  plan: VillagePlan,
  t: number,
  seat: number,
): (Point & { readonly face: number; readonly why: string }) | null {
  const fl = flockAt(plan, t);
  if (!fl) return null;
  const many = flockMany(plan),
    reach = 6 + 2.6 * Math.sqrt(many),
    why =
      HERD_WHY[fl.state] +
      (fl.stubble >= 0 && (fl.state === "out" || fl.state === "grazing") ? " on the stubble" : "");
  let x: number, z: number;
  if (fl.driven) {
    // (Behind its tail — strung out a few abreast — the first at it, the rest a little either side.)
    const abreast = Math.max(3, Math.min(7, Math.round(Math.sqrt(many) / 1.5))),
      back = Math.ceil(many / abreast) * 2.4 + 4 + Math.floor(seat / 2) * 3,
      side = (seat % 2 ? 1 : -1) * (2 + (seat >> 1) * 1.5);
    x = fl.x - fl.driven.ux * back - fl.driven.uz * side;
    z = fl.z - fl.driven.uz * back + fl.driven.ux * side;
  } else {
    // (About it as it grazes; at the fold, on its side toward the gap.)
    const p = plan.pasture,
      toward = Math.atan2(-p.z, -p.x),
      a =
        fl.state === "grazing"
          ? seat * 2.39996 + (t / HOUR) * 0.21
          : fl.state === "winter"
            ? toward + (seat % 2 ? 1 : -1) * (Math.PI / 2 - 0.3 * Math.floor(seat / 2))
            : toward + (seat - 0.5) * 0.7,
      r =
        fl.state === "shearing"
          ? reach * fl.spread * 0.7
          : fl.state === "winter"
            ? foldReach(plan) * 0.8 + 1.3
            : reach * fl.spread + 5;
    x = fl.x + Math.cos(a) * r;
    z = fl.z + Math.sin(a) * r;
  }
  return { x, z, face: Math.atan2(fl.x - x, fl.z - z), why };
}
