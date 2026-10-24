// A land's towns and roads as the land draws them (Phase 25 M150, asked for 2026-10-24: "i cant
// see the cities form and evolve and get that type of detail i got from the og causalisis, i mean
// like the land view"): each town's fabric — the plan its own streets are drawn from, laid along
// the same way about the same water — out to as many lots as the setting gives the land, the
// greatest towns first; and its roads: from each town to the nearest of those founded before it,
// trodden from its founding; and out toward each land its goods have gone to by road, from the
// year they first went, leaving from the town nearest that way; paved from the year the land
// learned to pave them, railed from the year it learned railways between towns of a size to want
// them. Looked at, never lived.
import { mix, yearOfMoment, type World } from "../kernel/index.ts";
import { isProvinceWorld } from "../gen/index.ts";
import { citiesOf, loreOf, marketsOf, populationContext, regionOf, townsOf } from "../sim/index.ts";
import type { LandPlan, LandRoad, LandTown, TownPlan } from "../bridge/index.ts";
import { townPlan } from "./town.ts";
import { landEra, townSite } from "./village.ts";

/** Lots a land draws of each of its towns at the least (a village's every lot). */
const LEAST_LOTS = 240;
/** Of the lots left to a land, the most its greatest town drawn next is given (the rest its sprawl). */
const SHARE = 0.6;
/** The fewest a town holds for a railway to be laid to it. */
const RAIL_TOWN = 800;

/** A number that changes when a town's plan does (its runs, buildings, walls, designs, paving). */
function planKey(plan: TownPlan | null): number {
  if (!plan) return 0;
  let h = mix(mix(0x2545f491, plan.lots), plan.whole);
  for (const r of plan.runs) for (const v of r) h = mix(h, v | 0);
  for (const c of plan.civics) h = mix(mix(mix(h, c.at), c.start), c.fell ?? -1);
  if (plan.walls) h = mix(mix(h, plan.walls.start), plan.walls.reach);
  h = mix(h, plan.designs.length);
  return mix(h, plan.paved ? 1 : 0) >>> 0;
}

/** A land's towns, each with its plan out to its share of `budget` lots, and its roads. */
export function landPlan(world: World, cell: number, budget = 8000): LandPlan {
  const ctx = populationContext(world),
    fabrics = townsOf(world),
    cities = citiesOf(world),
    // (A town forsaken still stands, in ruins, while its fabric does.)
    settled = ctx.settlements
      .inProvince(cell)
      .filter((s) => s.population > 0 || fabrics.get(s.ref)),
    fields = landEra(world, cell) !== "forage",
    plans = new Map<string, TownPlan | null>();
  let left = Math.max(0, budget);
  for (const s of [...settled].sort(
    (a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1),
  )) {
    const site = townSite(world, s.ref),
      plan = site
        ? townPlan(
            world,
            s.ref,
            site.axis,
            Math.max(LEAST_LOTS, Math.floor(left * SHARE)),
            site.water,
          )
        : null;
    plans.set(s.ref, plan);
    left = Math.max(0, left - (plan?.lots ?? 0));
  }
  const towns: LandTown[] = settled.map((s) => {
    const plan = plans.get(s.ref) ?? null;
    return {
      ref: s.ref,
      name: s.name,
      tile: s.tile,
      population: s.population,
      founded: s.founded,
      city: !!cities.get(s.ref),
      fields,
      plan,
      key: planKey(plan),
    };
  });
  return { t: world.now, towns, roads: landRoads(world, cell, towns) };
}

/** A land's roads: between its towns, each to the nearest founded before it; and out of it by road. */
function landRoads(world: World, cell: number, towns: readonly LandTown[]): LandRoad[] {
  const ctx = populationContext(world),
    lore = loreOf(world),
    paved = lore.get(cell, "roads")?.year ?? null,
    railed = lore.get(cell, "railways")?.year ?? null,
    r = regionOf(ctx, cell),
    size = r.size,
    d2 = (a: number, b: number) =>
      ((a % size) - (b % size)) ** 2 + (Math.floor(a / size) - Math.floor(b / size)) ** 2,
    road = (
      from: LandTown,
      to: number,
      b: LandTown | null,
      toward: string | null,
      since: number,
    ): LandRoad => ({
      from: from.tile,
      to,
      a: from.ref,
      b: b?.ref ?? null,
      toward,
      since,
      paved: paved === null ? null : Math.max(paved, since),
      rails:
        railed !== null && from.population >= RAIL_TOWN && (!b || b.population >= RAIL_TOWN)
          ? Math.max(railed, since)
          : null,
    }),
    out: LandRoad[] = [];
  const founded = [...towns].sort((a, b) => a.founded - b.founded || (a.ref < b.ref ? -1 : 1));
  for (let k = 1; k < founded.length; k++) {
    const t = founded[k]!;
    let near = founded[0]!;
    for (let q = 1; q < k; q++)
      if (d2(founded[q]!.tile, t.tile) < d2(near.tile, t.tile)) near = founded[q]!;
    if (near.tile !== t.tile) out.push(road(near, t.tile, t, null, t.founded));
  }
  // Out of the land: toward each land its goods have gone to by road, at the spot of its middle
  // (else wherever it is in sight), from the town nearest that way.
  const g = ctx.generated,
    markets = marketsOf(world);
  if (!isProvinceWorld(g) || !towns.length) return out;
  for (let k = g.grid.offsets[cell]!; k < g.grid.offsets[cell + 1]!; k++) {
    const nb = g.grid.neighbours[k]!,
      route = markets.route(cell, nb);
    if (!route || markets.bySea(cell, nb)) continue;
    let si = 0,
      sj = 0,
      n = 0;
    const middle = g.centre[nb]!;
    for (let t = 0; t < size * size; t++)
      if (r.parent[t] === middle) {
        si += t % size;
        sj += Math.floor(t / size);
        n++;
      }
    if (!n)
      for (let t = 0; t < size * size; t++)
        if (g.provinceOf[r.parent[t]!] === nb) {
          si += t % size;
          sj += Math.floor(t / size);
          n++;
        }
    if (!n) continue;
    const end = Math.round(sj / n) * size + Math.round(si / n);
    let from = towns[0]!;
    for (const t of towns) if (d2(t.tile, end) < d2(from.tile, end)) from = t;
    const great = ctx.settlements
        .inProvince(nb)
        .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))[0],
      opened = world.events.get(route);
    out.push(
      road(
        from,
        end,
        null,
        great?.name ?? null,
        opened ? yearOfMoment(opened.t) : yearOfMoment(world.now),
      ),
    );
  }
  return out;
}
