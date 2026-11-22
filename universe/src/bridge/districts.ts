// A town's districts (asked 2026-11-21: "suburbs vs cities vs countrysides and how all that looks different?"; from first
// principles, as they arose). bridge/form.ts already says the rule this reads: ground is worth what it saves in going (the
// bid-rent rule), so a town is built close and high where it is dear, by its square and within its walls, and apart in yards
// where it is cheap, at its edge; and how far out that edge comes in is set by how its people get to work. This names what
// each lot's ground makes of it, so that each reads as it is:
//
//   • the core, where ground is dearest or walls make it scarce: rows wall to wall, tall homes, trodden courts;
//   • the ring between: terraces and tenements, a tree in a yard here and there;
//   • the edge of a town its people walk: cottages apart in their yards and gardens;
//   • where its people ride a line they all share (rails, trams, a hauler): villas strung along the roads the line runs
//     down, each in a hedged garden, the old edge between them;
//   • where households keep engines of their own: sprawl, every home apart on its own plot behind a hedge or a fence, its
//     drive, and for as many as ride, the engine standing on it.
//
// Who lives where follows wealth and the cost of going (bridge/rank.ts homeGround): before engines the well-off keep the
// heart, after them the high edge. Pure: read from the plan; nothing kept.
import { TIER, lotTier, type TownForm } from "./form.ts";
import type { TownRoad } from "./sites.ts";

export const DISTRICT = { core: 0, inner: 1, edge: 2, line: 3, sprawl: 4 } as const;
export type District = (typeof DISTRICT)[keyof typeof DISTRICT];

/** How far from a railed road a home stands to be strung along it (metres): a short walk to its stops. */
export const LINE_WALK = 140;

/** Whether a point lies within a walk of a road in that carries a line (`rails`). */
export function nearLine(roads: readonly TownRoad[], x: number, z: number): boolean {
  for (const r of roads) {
    if (!r.rails) continue;
    const c = Math.cos(r.bearing),
      s = Math.sin(r.bearing),
      along = x * c + z * s;
    if (along > 0 && Math.abs(-x * s + z * c) < LINE_WALK) return true;
  }
  return false;
}

/**
 * A lot's district: its ground's tier (bridge/form.ts lotTier: by the square or within its walls the core; the edge where its
 * homes stand apart; the ring between), and at the edge, how its people get there: on foot, by a line they share (strung
 * along the line's roads), or each by their own engine (sprawl). `line`: the lot lies within a walk of a railed road.
 */
export function districtOf(
  form: TownForm,
  p: number,
  whole: number,
  walled: number,
  line: boolean,
): District {
  return districtFrom(form, lotTier(form, p, whole, walled), line);
}

/** A district from a lot's tier (bridge/form.ts TIER) and how its people get about (as districtOf). */
export function districtFrom(form: TownForm, tier: number, line: boolean): District {
  if (tier === TIER.heart) return DISTRICT.core;
  if (tier === TIER.town) return DISTRICT.inner;
  if (form.over) return DISTRICT.edge;
  if (form.drive) return DISTRICT.sprawl;
  // (A line they all share: its engines run, but no household keeps one of its own.)
  if (form.engines >= 0 && line) return DISTRICT.line;
  return DISTRICT.edge;
}

/** Of a town's lots, the share in each district (core, inner, edge, line, sprawl): for its page and for a check. */
export function districtShares(
  form: TownForm,
  whole: number,
  walled: number,
  lineAt: (p: number) => boolean,
): number[] {
  const out = [0, 0, 0, 0, 0],
    n = Math.max(1, whole);
  for (let p = 0; p < whole; p++) out[districtOf(form, p, whole, walled, lineAt(p))]! += 1 / n;
  return out;
}

/** A district in words. */
export const DISTRICT_WORDS = [
  "its old core: rows wall to wall and tall homes, trodden courts, little green",
  "the ring between: terraces and tenements",
  "its edge: cottages apart in their yards and gardens",
  "villas strung along the line, each in its hedged garden",
  "sprawl: every home apart on its own plot behind a hedge or fence, its drive",
] as const;

/** What a town's districts, strongholds and land-holding come to, in plain lines for its page. */
export function districtWhys(
  form: TownForm,
  roads: readonly TownRoad[],
  holds: readonly { readonly name: string; readonly hamlet?: number; readonly words: string }[],
): string[] {
  const out: string[] = [];
  if (form.drive)
    out.push(
      `${Math.round(form.rides * 10)} in 10 of its households ride engines of their own, so its edge has spread into sprawl: each home stands apart on its own plot behind a hedge or a fence, its drive before it, the engine standing on it.`,
    );
  else if (form.engines >= 0 && !form.over && roads.some((r) => r.rails))
    out.push(
      "Its people ride a line they all share: along the roads it runs down, villas stand strung out in hedged gardens a short walk from its stops; between them, its old edge.",
    );
  for (const h of holds) out.push(`By it stands ${h.words}, the seat of ${h.name}.`);
  const estate = holds.find((h) => h.hamlet);
  if (!form.over || estate)
    out.push(
      estate
        ? `Its land is the estate of ${estate.name}: those who work its fields are its tenants, and live in a hamlet by their lord's seat.`
        : "Its land is worked by those who hold it: each farm's house stands by its barn, out among its fields.",
    );
  return out;
}
