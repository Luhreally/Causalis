// A land's towns and roads as the land draws them (Phase 25 M150, asked for 2026-10-24: "i cant
// see the cities form and evolve and get that type of detail i got from the og causalisis, i mean
// like the land view"): each town's fabric — the plan its own streets are drawn from, laid along
// the same way about the same water — out to as many lots as the setting gives the land, the
// greatest towns first; and its roads: from each town to the nearest of those founded before it,
// trodden from its founding; and out toward each land its goods have gone to by road, from the
// year they first went, leaving from the town nearest that way; paved from the year the land
// learned to pave them, railed from the year it learned railways between towns of a size to want
// them; and how busy each is, by the towns it joins or the goods that went down it last year, and
// the sea lanes its ships sail toward the lands across the sea they have reached (Phase 26 M153).
// Looked at, never lived.
import { mix, yearOfMoment, type World } from "../kernel/index.ts";
import { isProvinceWorld } from "../gen/index.ts";
import { citiesOf, loreOf, marketsOf, populationContext, regionOf, townsOf } from "../sim/index.ts";
import type { LandLane, LandPlan, LandRoad, LandTown, TownPlan } from "../bridge/index.ts";
import { townPlan } from "./town.ts";
import { landEra, townSite } from "./village.ts";

/** Lots a land draws of each of its towns at the least (a village's every lot). */
const LEAST_LOTS = 240;
/** Of the lots left to a land, the most its greatest town drawn next is given (the rest its sprawl). */
const SHARE = 0.6;
/** The fewest a town holds for a railway to be laid to it. */
const RAIL_TOWN = 800;
/** The most carts on a road at once, and ships on a lane. */
const MOST_TRAFFIC = 8;

/** How busy a way is by the goods that went down it last year: one, and more for more. */
function busy(goods: number): number {
  return Math.max(1, Math.min(MOST_TRAFFIC, Math.round(Math.log2(1 + goods / 20))));
}

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
    era = landEra(world, cell),
    fields = era !== "forage",
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
  return {
    t: world.now,
    era,
    towns,
    roads: landRoads(world, cell, towns),
    lanes: landLanes(world, cell, towns),
  };
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
      traffic: number,
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
      traffic,
    }),
    out: LandRoad[] = [];
  const founded = [...towns].sort((a, b) => a.founded - b.founded || (a.ref < b.ref ? -1 : 1));
  for (let k = 1; k < founded.length; k++) {
    const t = founded[k]!;
    let near = founded[0]!;
    for (let q = 1; q < k; q++)
      if (d2(founded[q]!.tile, t.tile) < d2(near.tile, t.tile)) near = founded[q]!;
    // (Busy as the two towns are great together: a village's track a cart or two, a road between
    // cities many.)
    if (near.tile !== t.tile)
      out.push(
        road(
          near,
          t.tile,
          t,
          null,
          t.founded,
          Math.max(
            1,
            Math.min(MOST_TRAFFIC, Math.round(Math.sqrt(near.population * t.population) / 250)),
          ),
        ),
      );
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
        busy(goodsBetween(world, cell, nb)),
      ),
    );
  }
  return out;
}

/** The goods that went between two lands last year, either way. */
function goodsBetween(world: World, a: number, b: number): number {
  let n = 0;
  for (const f of marketsOf(world).flows)
    if ((f.from === a && f.to === b) || (f.from === b && f.to === a)) n += f.count;
  return n;
}

/**
 * A land's sea lanes: toward each land across the sea its ships have reached, from its docks (else
 * its greatest town on the sea), the way that land lies on the globe, as the land's map is laid.
 */
function landLanes(world: World, cell: number, towns: readonly LandTown[]): LandLane[] {
  const ctx = populationContext(world),
    g = ctx.generated,
    markets = marketsOf(world);
  if (!isProvinceWorld(g) || !towns.length) return [];
  const r = regionOf(ctx, cell),
    size = r.size,
    sea = (tile: number) => {
      const i = tile % size,
        j = Math.floor(tile / size);
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const x = i + di,
            y = j + dj;
          if (x >= 0 && y >= 0 && x < size && y < size && r.water[y * size + x] === 1) return true;
        }
      return false;
    },
    fabrics = townsOf(world),
    ports = towns
      .filter((t) => sea(t.tile))
      .sort(
        (a, b) =>
          Number(
            !!fabrics
              .get(b.ref as never)
              ?.civics.some((c) => c.kind === "docks" && c.fell === null),
          ) -
            Number(
              !!fabrics
                .get(a.ref as never)
                ?.civics.some((c) => c.kind === "docks" && c.fell === null),
            ) ||
          b.population - a.population ||
          (a.ref < b.ref ? -1 : 1),
      ),
    port = ports[0];
  if (!port) return [];
  // The tangent frame the land's map is laid on (gen's refineRegion): east, and north.
  const P = g.fine.grid.positions,
    o = g.centre[cell]!,
    ox = P[o * 3]!,
    oy = P[o * 3 + 1]!,
    oz = P[o * 3 + 2]!,
    el = Math.hypot(oz, ox) || 1,
    ex = oz / el,
    ez = -ox / el,
    nx = oy * ez,
    ny = oz * ex - ox * ez,
    nz = -oy * ex,
    out: LandLane[] = [];
  for (const nb of markets.seaPartners(cell)) {
    const route = markets.route(cell, nb);
    if (!route || !markets.bySea(cell, nb)) continue;
    const q = g.centre[nb]!,
      qx = P[q * 3]!,
      qy = P[q * 3 + 1]!,
      qz = P[q * 3 + 2]!,
      east = qx * ex + qz * ez,
      north = qx * nx + qy * ny + qz * nz,
      len = Math.hypot(east, north);
    if (len < 1e-9) continue;
    const great = ctx.settlements
        .inProvince(nb)
        .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))[0],
      opened = world.events.get(route);
    out.push({
      from: port.tile,
      a: port.ref,
      toward: great?.name ?? null,
      // (The map's z runs south.)
      dx: east / len,
      dz: -north / len,
      since: opened ? yearOfMoment(opened.t) : yearOfMoment(world.now),
      ships: busy(goodsBetween(world, cell, nb)),
    });
  }
  return out;
}
