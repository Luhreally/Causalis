// A town's site as its streets are grown from it (asked 2026-11-16: "it should be like the land view and town view like they
// should all be purposfully connected"): its ground's rise and the way it rises, from its land's map about its tile; the way
// its prevailing wind blows, from its world's turning and its latitude; the roads in, the same the land's map draws (each
// from a town to the nearest founded before it, and out toward each land its goods go to by road); whether its ground was
// measured out before it was built — its land writing, and the town founded since, or walled since and grown out past its
// walls; its walls; and whether it has flooded and learned to keep off the ground toward its water. All read, none kept.
import { YEAR, yearOfMoment, type Ref, type World } from "../kernel/index.ts";
import { isProvinceWorld } from "../gen/index.ts";
import {
  floodWary,
  loreOf,
  marketsOf,
  politiesOf,
  populationContext,
  regionOf,
  townsOf,
  DRY_MOST,
  type Fabric,
} from "../sim/index.ts";
import { streetsLaid, type TownRoad, type TownSite } from "../bridge/index.ts";
import { formFacts } from "./form.ts";
import { pilgrimsBetween } from "./pilgrims.ts";

/** A town as its roads are reckoned. */
export type RoadTown = {
  readonly ref: string;
  readonly tile: number;
  readonly founded: number;
  readonly population: number;
};

/** A road of a land before it is read (host/land.ts landRoads reads each): its ends, its years, how busy. */
export type RoadEnd = {
  readonly from: RoadTown;
  readonly to: number;
  readonly b: RoadTown | null;
  /** Toward a land beyond: its middle's tile is `to`, and its greatest town's name. */
  readonly toward: { readonly land: number; readonly name: string | null } | null;
  readonly since: number;
  readonly traffic: number;
  /** The pilgrims a year who go by it, and the land they go to (host/pilgrims.ts; absent: none). */
  readonly pilgrims?: { readonly n: number; readonly seat: number; readonly of: string };
  /** Its opening is on record (a way out of the land: the route's event). */
  readonly known: boolean;
};

/** The most carts on a road at once; the fewest a town holds for a railway to be laid to it. */
export const MOST_TRAFFIC = 8;
export const RAIL_TOWN = 800;

/** How busy a way is by the goods that went down it last year: one, and more for more. */
export function busy(goods: number): number {
  return Math.max(1, Math.min(MOST_TRAFFIC, Math.round(Math.log2(1 + goods / 20))));
}

/** The goods that went between two lands last year, either way. */
export function goodsBetween(world: World, a: number, b: number): number {
  let n = 0;
  for (const f of marketsOf(world).flows)
    if ((f.from === a && f.to === b) || (f.from === b && f.to === a)) n += f.count;
  return n;
}

/** A land's roads: between its towns, each to the nearest founded before it; and out of it, toward each land its goods go to by road. */
export function roadEnds(world: World, cell: number, towns: readonly RoadTown[]): RoadEnd[] {
  const ctx = populationContext(world),
    r = regionOf(ctx, cell),
    size = r.size,
    d2 = (a: number, b: number) =>
      ((a % size) - (b % size)) ** 2 + (Math.floor(a / size) - Math.floor(b / size)) ** 2,
    out: RoadEnd[] = [];
  const founded = [...towns].sort((a, b) => a.founded - b.founded || (a.ref < b.ref ? -1 : 1));
  for (let k = 1; k < founded.length; k++) {
    const t = founded[k]!;
    let near = founded[0]!;
    for (let q = 1; q < k; q++)
      if (d2(founded[q]!.tile, t.tile) < d2(near.tile, t.tile)) near = founded[q]!;
    // (Busy as the two towns are great together: a village's track a cart or two, a road between cities many.)
    if (near.tile !== t.tile)
      out.push({
        from: near,
        to: t.tile,
        b: t,
        toward: null,
        since: t.founded,
        known: true,
        traffic: Math.max(
          1,
          Math.min(MOST_TRAFFIC, Math.round(Math.sqrt(near.population * t.population) / 250)),
        ),
      });
  }
  // Out of the land: toward each land its goods have gone to by road, at the spot of its middle (else wherever it is in
  // sight), from the town nearest that way.
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
        .seenIn(nb)
        .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))[0],
      opened = world.events.get(route),
      going = pilgrimsBetween(world, cell, nb);
    out.push({
      from,
      to: end,
      b: null,
      toward: { land: nb, name: great?.name ?? null },
      since: opened ? yearOfMoment(opened.t) : yearOfMoment(world.now),
      known: !!opened,
      // (Its pilgrims go as their own file beside its carts: host/pilgrims.ts, render/landtraffic.ts.)
      traffic: busy(goodsBetween(world, cell, nb)),
      ...(going.pilgrims && going.seat !== null && going.of
        ? { pilgrims: { n: going.pilgrims, seat: going.seat, of: going.of } }
        : {}),
    });
  }
  return out;
}

/** A land's towns as its roads are reckoned: those that stand, as the land's map draws them. */
export function roadTowns(world: World, cell: number): RoadTown[] {
  // (A town forsaken still stands, in ruins, while its fabric does: host/land.ts settledIn.)
  const fabrics = townsOf(world);
  return populationContext(world)
    .settlements.seenIn(cell)
    .filter((s) => s.population > 0 || fabrics.get(s.ref))
    .map((s) => ({ ref: s.ref, tile: s.tile, founded: s.founded, population: s.population }));
}

/** Each land's roads as last reckoned, by world and moment: a land's towns' plans and pages ask them again and again. */
const ENDS = new WeakMap<World, { at: number; lands: Map<number, RoadEnd[]> }>();
/** A land's roads (roadEnds over its standing towns), reckoned once a moment. */
export function landRoadEnds(world: World, cell: number): RoadEnd[] {
  let kept = ENDS.get(world);
  if (!kept || kept.at !== world.now) ENDS.set(world, (kept = { at: world.now, lands: new Map() }));
  let ends = kept.lands.get(cell);
  if (!ends) kept.lands.set(cell, (ends = roadEnds(world, cell, roadTowns(world, cell))));
  return ends;
}

/** The roads into a town, the busiest first (rails before), each the bearing it leaves by. */
export function townRoads(
  world: World,
  ref: string,
  ends: readonly RoadEnd[],
  size: number,
): TownRoad[] {
  const now = Math.floor(world.now / YEAR),
    out: (TownRoad & { since: number })[] = [];
  const at = (t: number) => [t % size, Math.floor(t / size)] as const;
  for (const e of ends) {
    if (e.since > now) continue;
    const mine = e.from.ref === ref ? e.from : e.b?.ref === ref ? e.b : null;
    if (!mine) continue;
    const far = mine === e.from ? e.to : e.from.tile,
      [i0, j0] = at(mine.tile),
      [i1, j1] = at(far);
    if (i0 === i1 && j0 === j1) continue;
    out.push({
      bearing: Math.atan2(j1 - j0, i1 - i0),
      busy: e.traffic,
      rails: false,
      to: far,
      since: e.since,
    });
  }
  return out
    .sort((a, b) => b.busy - a.busy || a.since - b.since || a.to - b.to)
    .map(({ since, ...r }) => (void since, r));
}

/** The way the prevailing wind blows at a latitude (radians, in the town's frame: x east, z south), as gen/climate windAt has it. */
export function leeAt(lat: number, bands: number): number {
  const band = Math.min(bands - 1, Math.floor((Math.abs(lat) / (Math.PI / 2)) * bands)),
    toward = lat >= 0 ? -1 : 1,
    trade = band % 2 === 0,
    east = trade ? -1 : 1,
    north = (trade ? 0.45 : -0.45) * toward;
  return Math.atan2(-north, east);
}

/** The first block of a town measured out before it was built (-1: none): its land writing, and it founded since, or walled since. */
export function measuredFrom(world: World, cell: number, founded: number, f: Fabric): number {
  const writes = loreOf(world).get(cell, "writing")?.year;
  if (writes === undefined) return -1;
  if (founded >= writes) return 0;
  return f.walls && f.walls.start >= writes ? Math.ceil(f.walls.reach / 8) : -1;
}

/** A town's site, as its streets are grown from it (`ends`: its land's roads, where they are reckoned already). */
export function townSiteOf(
  world: World,
  ref: Ref,
  f: Fabric,
  ends?: readonly RoadEnd[],
): TownSite | null {
  const ctx = populationContext(world),
    s = ctx.settlements.get(ref);
  if (!s) return null;
  const r = regionOf(ctx, s.cell),
    size = r.size,
    i = s.tile % size,
    j = Math.floor(s.tile / size),
    h = (di: number, dj: number) => {
      const a = Math.max(0, Math.min(size - 1, i + di)),
        b = Math.max(0, Math.min(size - 1, j + dj));
      return Math.max(0, r.elevation[b * size + a]!);
    },
    // (Metres of rise a kilometre, east and south.)
    gx = (h(1, 0) - h(-1, 0)) / (2 * r.tileKm),
    gz = (h(0, 1) - h(0, -1)) / (2 * r.tileKm),
    g = ctx.generated,
    lat = g.grid.lat[s.cell] ?? 0,
    year = Math.floor(world.now / YEAR),
    rails = loreOf(world).get(s.cell, "railways")?.year,
    roads = townRoads(world, ref, ends ?? landRoadEnds(world, s.cell), size);
  // (Rails are laid along a town's roads once its land knows them and it is great enough: as the land's map lays them.)
  const railed = rails !== undefined && rails <= year && s.population >= RAIL_TOWN;
  return {
    up: Math.atan2(gz, gx),
    rise: Math.round(Math.hypot(gx, gz) * 10) / 10,
    lee: leeAt(lat, g.climate.bands),
    roads: roads.map((x, k) => (railed && k === 0 ? { ...x, rails: true } : x)),
    measured: measuredFrom(world, s.cell, s.founded, f),
    walled: f.walls?.reach ?? null,
    dry: f.next < DRY_MOST && floodWary(world, s.cell, year),
    // (What its streets were laid for, part by part: bridge/form.ts.)
    ...(() => {
      const facts = formFacts(world, ref, f, null),
        laid = facts ? streetsLaid(facts) : undefined;
      return laid ? { laid } : {};
    })(),
  };
}

/**
 * The way each realm beyond a town's land comes in to it (VillagePlan.ways): by each road out of its land toward a land that
 * realm holds, at the town's own road in nearest that way (its gate there), else straight that way; the busiest road first.
 * Its own realm's lands are marked so (`own`): a land taken is come into from them.
 */
export function realmWays(
  world: World,
  ref: Ref,
  site: TownSite | null,
): { realm: string; bearing: number; own?: true }[] {
  const ctx = populationContext(world),
    s = ctx.settlements.get(ref);
  if (!s) return [];
  const size = regionOf(ctx, s.cell).size,
    realms = politiesOf(world),
    own = realms.of(s.cell)?.ref ?? null,
    i0 = s.tile % size,
    j0 = Math.floor(s.tile / size),
    out: { realm: string; bearing: number; own?: true }[] = [];
  const ends = landRoadEnds(world, s.cell)
    .filter((e) => e.toward)
    .sort((a, b) => b.traffic - a.traffic || a.toward!.land - b.toward!.land);
  for (const e of ends) {
    const realm = realms.of(e.toward!.land)?.ref ?? null;
    if (!realm || out.some((w) => w.realm === realm)) continue;
    const di = (e.to % size) - i0,
      dj = Math.floor(e.to / size) - j0;
    if (!di && !dj) continue;
    const toward = Math.atan2(dj, di);
    let bearing = toward,
      off = Infinity;
    for (const r of site?.roads ?? []) {
      const d = Math.abs(Math.atan2(Math.sin(r.bearing - toward), Math.cos(r.bearing - toward)));
      if (d < off) {
        off = d;
        bearing = r.bearing;
      }
    }
    out.push(realm === own ? { realm, bearing, own: true } : { realm, bearing });
  }
  return out;
}
