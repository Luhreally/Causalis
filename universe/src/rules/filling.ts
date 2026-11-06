// A world filled (galaxy-plan.md, "Worlds filled", asked for 2026-11-05: "do they ever fully colonize the whole planet
// or just set up their one hall and its done?"). What a world can hold, read from what rules/habitat.ts reads of it: its
// air, cold, water, pull and radiation against its people's own body. A world they can walk out on fills to its edges; a
// world where every breath is made holds only as much ground as its people can keep roofs over, and however long they
// are given it never fills. Nothing here is a level of knowledge: a people fills it as fast as its numbers let it. Pure.
import type { BodyPlan } from "./bodies.ts";
import { MOST_UPKEEP, habitability, type Ground } from "./habitat.ts";

/** A world's ground as a filling reads it. */
export type FillGround = Ground & { readonly radius: number };

/** What its people know that bears on how many a km² can hold. */
export type FillMeans = { readonly vats: boolean; readonly towers: boolean };

/** People a km² of settled ground, under the open sky: fields, and towns among them (est.; the home world's mean today). */
export const OPEN_KM2 = 60;
/** People a km² of settled ground where every field is roofed (est.). */
export const SEALED_KM2 = 4;
/** The most of even the easiest world's ground that roofs can ever be carried over (est.). */
export const SEALED_REACH = 0.6;
/** A people's yearly growth with nothing taken from it, as a share (est.). */
export const BIRTHS = 0.018;
/** The share of a face of seas that is ground (est.; the home world's is 0.29). */
export const GROUND_SHARE = 0.35;
/** How much of what it can hold counts as filled. */
export const FILLED_AT = 0.98;
/** What a settler's upkeep is weighed against, in hands (as `hallsShare` weighs it). */
const HANDS = 6;

export type FillReading = {
  /** Its face, and the ground of it its people could ever stand on (km²). */
  readonly km2: number;
  readonly usable: number;
  /** Whether its people can live on it under the open sky, now. */
  readonly open: boolean;
  /** Why they cannot, in the words of what they must build (none: they can). */
  readonly because: readonly string[];
  /** Machines a settler a year, now; the share of hands that takes. */
  readonly upkeep: number;
  readonly kept: number;
  /** The share of its usable ground that can ever be settled, as it stands now. */
  readonly top: number;
  /** People a km² settled ground takes in; people a km² it can come to hold, built up. */
  readonly base: number;
  readonly dense: number;
  /** People when all it can settle is settled; people when that is built up as high as they know how. */
  readonly spread: number;
  readonly holds: number;
  /** Its people's yearly growth while there is room. */
  readonly rate: number;
};

/** Whether a people can live on a world's ground with nothing over them. */
export function openSky(
  g: Ground,
  body: BodyPlan | null,
  homeGravity: number,
  homeAir: string,
): boolean {
  const pull = g.gravity / homeGravity;
  // (The thresholds habitability itself weighs, and the same air-pressure span a meeting of two peoples reads.)
  if (g.temperature < -40 || g.temperature > 50 || g.radiation > 3) return false;
  if (pull < 0.1 || pull > 1.5) return false;
  if (body?.medium === "water") return g.water === "seas";
  return (
    homeAir === "breathable" && g.air === "breathable" && g.pressure >= 0.38 && g.pressure <= 2.6
  );
}

/** What a world can hold of a people, and how fast they come to it, from its numbers: `remade`, how far it has been remade. */
export function fillReading(
  g: FillGround,
  body: BodyPlan | null,
  homeGravity: number,
  homeAir: string,
  remade: number,
  means: FillMeans,
): FillReading {
  const h = habitability(g, body, homeGravity),
    r = 6371 * g.radius,
    km2 = 4 * Math.PI * r * r,
    sea = body?.medium === "water",
    seas = g.water === "seas",
    usable = km2 * (sea ? (seas ? 1 - GROUND_SHARE : 1) : seas ? GROUND_SHARE : 1),
    open = remade >= 1 || openSky(g, body, homeGravity, homeAir),
    // (As far as it has been remade, its people keep less out and its fields lie open.)
    upkeep = open ? 0 : Math.max(0, h.upkeep) * (1 - remade),
    kept = Math.min(0.9, upkeep / (upkeep + HANDS)),
    sealed = Math.max(0, 1 - h.upkeep / MOST_UPKEEP) * SEALED_REACH,
    top = open ? 1 : sealed + (1 - sealed) * remade,
    base = open ? OPEN_KM2 : SEALED_KM2 + (OPEN_KM2 - SEALED_KM2) * remade,
    dense = base * (means.vats ? 1.5 : 1) * (means.towers ? 2 : 1);
  return {
    km2,
    usable,
    open,
    because: open ? [] : h.because,
    upkeep,
    kept,
    top,
    base,
    dense,
    spread: usable * top * base,
    holds: usable * top * dense,
    rate: BIRTHS * (1 - kept),
  };
}

/** The most of a world its comers keep to while its own people hold the rest (est.). */
export const HELD_TOP = 0.1;

/** What a world holds of its comers while those who were there first, and threw them back, hold it. */
export function heldReading(r: FillReading): FillReading {
  const top = Math.min(r.top, HELD_TOP);
  return { ...r, top, spread: r.usable * top * r.base, holds: r.usable * top * r.dense };
}

/** The share of its usable ground settled by this many people. */
export function fillShare(people: number, r: FillReading): number {
  return Math.min(r.top, people / Math.max(1, r.usable * r.base));
}

/** Whether all it can settle is settled. */
export const fillDone = (people: number, r: FillReading): boolean =>
  r.top > 0 && fillShare(people, r) >= r.top * FILLED_AT;

/** A year of its people: they grow while there is room, and those who come take room too. */
export function fillNext(people: number, r: FillReading, comers: number): number {
  const room = Math.max(0, 1 - people / Math.max(1, r.holds));
  return people + (r.rate * people + comers) * room;
}

/** How many years until all it can settle is settled at this pace (0: it is; null: not in five thousand). */
export function yearsToFill(people: number, r: FillReading, comers: number): number | null {
  let n = people;
  for (let y = 0; y <= 5000; y++) {
    if (fillDone(n, r)) return y;
    n = fillNext(n, r, comers);
  }
  return null;
}
