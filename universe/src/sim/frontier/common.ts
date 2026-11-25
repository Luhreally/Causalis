// What the Frontier's systems share: a running digest for their stores, the home world's facts they read, and a realm's
// people and grid. Pure reads.
import { yearOfMoment, type Ref, type World } from "../../kernel/index.ts";
import { isProvinceWorld, type HomeWorld } from "../../gen/index.ts";
import type { Polity } from "../polity/polity.ts";
import type { PopulationContext } from "../population/systems.ts";
import { sparedShare } from "../economy/energy.ts";

/** Fold whole numbers into a running digest (two 32-bit words): what a checkpoint hashes in place of every row. */
export function fold(d: [number, number], xs: readonly number[]): void {
  let a = d[0],
    b = d[1];
  for (const x of xs) {
    const lo = x | 0,
      hi = Math.floor(x / 4294967296) | 0;
    a = Math.imul(a ^ lo, 0x01000193) ^ hi;
    b = Math.imul(b + lo + 0x9e3779b9, 0x85ebca6b) ^ (b >>> 13);
  }
  d[0] = a;
  d[1] = b;
}

/** A ref's whole number (for a digest). */
export function refNumber(ref: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < ref.length; i++) h = Math.imul(h ^ ref.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** The lands of the home world itself (its province grid's first cells; every other is of another body or a ship). */
export const homeLands = (g: HomeWorld): number =>
  isProvinceWorld(g) ? g.offworld.base : g.grid.count;

/** How near the poles a land lies (0 at the equator, 1 at a pole): its middle's height over the equator's plane. */
export function polarOf(g: HomeWorld, cell: number): number {
  return Math.abs(g.grid.positions[3 * cell + 2] ?? 0);
}

/** A realm's people, all its lands. */
export function realmPeople(ctx: PopulationContext, p: Polity): number {
  let n = 0;
  for (const c of p.members) n += ctx.provinces.get(c)?.total() ?? 0;
  return n;
}

/** The share of a land's work its wires carry (0 … 1): all but its bodies', beasts' and old mills' own, where it knows the current. */
export function gridShare(ctx: PopulationContext, cell: number, knowsCurrent: boolean): number {
  if (!knowsCurrent) return 0;
  const r = sparedShare(ctx.world, cell);
  return r === null ? 0 : Math.max(0, Math.min(1, r));
}

/** The year now. */
export const yearNowOf = (world: World): number => yearOfMoment(world.now);

/** Refs that are not null. */
export const refs = (xs: readonly (Ref | null | undefined)[]): Ref[] =>
  xs.filter((x): x is Ref => !!x);
