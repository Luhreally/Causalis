// Cities (docs/architecture §20, cities): a market town grown to a thousand people
// becomes a city, laid out as a grid of blocks, each put to a use — houses, crowded
// houses, markets, workshops, a temple or hall — by what the block is worth: how
// near the middle it lies and how near the main road, which runs toward the city's
// busiest trading partner; the river; the nuisance of workshops. A city's quarters
// move toward what their worth asks a few blocks a year. When the land learns to
// pave its roads, the road through the city draws its markets and workshops along
// it — the city is reshaped, and history records why.
import {
  YEAR,
  defineEventType,
  dmath,
  yearOfMoment,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { OCC } from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import type { MarketStore } from "../economy/market.ts";
import { loreOf } from "../lore/lore.ts";

export const CITY_EVENTS = {
  founded: defineEventType("city.founded", 4),
  reshaped: defineEventType("city.reshaped", 4),
};

/** A city grows from a market town of this many. */
export const CITY_SIZE = 1000;
/** Blocks per side, and each block's side in metres. */
export const BLOCKS = 10;
export const BLOCK_M = 120;

export const USES = ["open", "houses", "crowded houses", "market", "workshops", "temple"] as const;
export const USE = { open: 0, houses: 1, crowded: 2, market: 3, workshops: 4, temple: 5 } as const;

export type City = {
  readonly town: Ref;
  readonly cell: number;
  readonly founded: number;
  readonly event: Ref;
  /** The main road's heading, in radians (toward the busiest trading partner). */
  axis: number;
  /** Whether the road through it is paved, and the event of its paving. */
  paved: Ref | null;
  /** Block uses, row by row. */
  uses: number[];
};

export class CityStore implements StateStore {
  readonly name = "city.quarters";
  private readonly map = new Map<string, City>();

  get(town: Ref): City | undefined {
    return this.map.get(town);
  }

  set(c: City): void {
    this.map.set(c.town, c);
  }

  all(): City[] {
    return [...this.map.values()].sort((a, b) => (a.town < b.town ? -1 : 1));
  }

  pinned(): Ref[] {
    const refs: Ref[] = [];
    for (const c of this.map.values()) {
      refs.push(c.event);
      if (c.paved) refs.push(c.paved);
    }
    return refs;
  }

  hashInto(h: Hasher): void {
    h.value(this.all());
  }

  save(): unknown {
    return { cities: this.all() };
  }

  load(state: unknown): void {
    this.map.clear();
    for (const c of (state as { cities: City[] }).cities) this.set({ ...c, uses: [...c.uses] });
  }
}

export function citiesOf(world: World): CityStore {
  return world.store<CityStore>("city.quarters");
}

/** Where block (i, j) lies, in metres from the city's middle. */
export function blockAt(i: number, j: number): { x: number; z: number } {
  return { x: (i - (BLOCKS - 1) / 2) * BLOCK_M, z: (j - (BLOCKS - 1) / 2) * BLOCK_M };
}

/** The blocks from the middle outward (ties by index). */
const INWARD = Array.from({ length: BLOCKS * BLOCKS }, (_, k) => k).sort((a, b) => {
  const d = (k: number) => {
    const { x, z } = blockAt(k % BLOCKS, Math.floor(k / BLOCKS));
    return x * x + z * z;
  };
  return d(a) - d(b) || a - b;
});

/** What each block is worth, and so what it should be put to, for a city as it stands. */
export function layout(
  people: number,
  crafters: number,
  traders: number,
  axis: number,
  paved: boolean,
  river: boolean,
): readonly number[] {
  const n = BLOCKS * BLOCKS,
    ux = dmath.cos(axis),
    uz = dmath.sin(axis);
  // Worth: nearness to the middle, and to the road (far more once it is paved).
  const worth = (k: number, road: number) => {
    const { x, z } = blockAt(k % BLOCKS, Math.floor(k / BLOCKS)),
      middle = dmath.sqrt(x * x + z * z) / BLOCK_M,
      along = Math.abs(-uz * x + ux * z) / BLOCK_M;
    return 1 / (1 + 0.35 * middle) + road / (1 + along);
  };
  const built = Math.min(n, Math.ceil(people / 110)),
    markets = Math.max(1, Math.min(8, Math.ceil(traders / 25))),
    workshops = Math.max(1, Math.min(14, Math.ceil(crafters / 35))),
    crowded = Math.max(0, Math.min(20, Math.floor((people - CITY_SIZE) / 400))),
    // The same counts on the same road always ask the same layout: kept, not redone.
    key = `${built}|${markets}|${workshops}|${crowded}|${axis}|${paved}|${river}`,
    kept = LAYOUTS.get(key);
  if (kept) return kept;
  // The blocks by worth, best first: the same for every city on the same heading.
  const order = (road: number) => {
    const at = `${axis}|${road}`;
    let o = ORDERS.get(at);
    if (!o) {
      const w = Array.from({ length: n }, (_, k) => worth(k, road));
      o = Array.from({ length: n }, (_, k) => k).sort((a, b) => w[b]! - w[a]! || a - b);
      if (ORDERS.size > 4_000) ORDERS.clear();
      ORDERS.set(at, o);
    }
    return o;
  };
  const uses = new Array<number>(n).fill(USE.open),
    count = new Array<number>(USES.length).fill(0);
  // The temple or hall takes the very middle; markets the best of the rest, by the road's pull.
  const middle = order(0),
    byRoad = order(paved ? 2.4 : 0.5),
    free = new Set(Array.from({ length: n }, (_, k) => k));
  const take = (k: number, use: number) => {
    uses[k] = use;
    count[use]!++;
    free.delete(k);
  };
  take(middle[0]!, USE.temple);
  for (const k of byRoad) if (free.has(k) && count[USE.market]! < markets) take(k, USE.market);
  // Workshops keep off the middle (their noise and smoke), along the road or the river.
  const edgeRoad = byRoad.filter((k) => {
    const { x, z } = blockAt(k % BLOCKS, Math.floor(k / BLOCKS));
    return x * x + z * z > 2.25 * BLOCK_M * BLOCK_M || river;
  });
  for (const k of edgeRoad)
    if (free.has(k) && count[USE.workshops]! < workshops) take(k, USE.workshops);
  for (const k of byRoad) if (free.has(k) && count[USE.crowded]! < crowded) take(k, USE.crowded);
  for (const k of middle) if (free.has(k) && n - free.size < built) take(k, USE.houses);
  if (LAYOUTS.size > 20_000) LAYOUTS.clear();
  LAYOUTS.set(key, uses);
  return uses;
}
const LAYOUTS = new Map<string, number[]>(),
  ORDERS = new Map<string, readonly number[]>();

/** The city's heading: toward the neighbour it trades with most (east when it trades with none). */
function headingOf(ctx: PopulationContext, cell: number): number {
  const markets = ctx.world.store<MarketStore>("economy.markets"),
    g = ctx.generated,
    by = new Map<number, number>();
  for (const f of markets.flows) {
    if (f.from === cell) by.set(f.to, (by.get(f.to) ?? 0) + f.count);
    else if (f.to === cell) by.set(f.from, (by.get(f.from) ?? 0) + f.count);
  }
  const best = [...by.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0];
  if (best === undefined) return 0;
  const lat = (c: number) => g.grid.lat[c]!,
    lon = (c: number) => g.grid.lon[c]!;
  return dmath.atan2(lat(best) - lat(cell), lon(best) - lon(cell));
}

/** The cities' year: towns grown great become cities; quarters move toward their worth; paving reshapes. */
export function cityYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = citiesOf(world),
    lore = loreOf(world),
    year = yearOfMoment(t);
  for (const town of ctx.settlements.all()) {
    if (!town.market) continue;
    let city = store.get(town.ref);
    const p = ctx.provinces.get(town.cell);
    if (!p) continue;
    if (!city) {
      if (town.population < CITY_SIZE) continue;
      const event = world.events.emit({
        type: CITY_EVENTS.founded.type,
        subjects: [town.ref],
        place: p.ref,
        causes: [{ ref: town.market, role: "trigger", weight: 1 }],
        data: { name: town.name, people: town.population },
      });
      city = {
        town: town.ref,
        cell: town.cell,
        founded: year,
        event,
        axis: headingOf(ctx, town.cell),
        paved: null,
        uses: new Array<number>(BLOCKS * BLOCKS).fill(USE.open),
      };
      store.set(city);
    }
    // Paving: when the land learns to pave its roads, the road through the city draws its trade along it.
    const roads = lore.get(town.cell, "roads");
    if (roads && !city.paved) {
      city.axis = headingOf(ctx, town.cell);
      city.paved = world.events.emit({
        type: CITY_EVENTS.reshaped.type,
        subjects: [town.ref],
        place: p.ref,
        causes: [{ ref: roads.event, role: "trigger", weight: 1 }],
        data: { name: town.name },
      });
    }
    // Share of the province's crafts and trade that live in its market town.
    const share = Math.min(1, town.population / Math.max(1, p.total())),
      want = layout(
        town.population,
        Math.round(p.occupation(OCC.crafter) * share * 3),
        Math.round(p.occupation(OCC.trader) * share * 3),
        city.axis,
        !!city.paved,
        !!ctx.generated.water.river[town.cell],
      );
    // A few blocks a year move toward what they are worth, from the middle outward.
    let changed = 0;
    for (const k of INWARD)
      if (city.uses[k] !== want[k]) {
        city.uses[k] = want[k]!;
        if (++changed >= 6) break;
      }
  }
}

/** Teach a peopled world its cities. */
export function installCities(world: World, ctx: () => PopulationContext): CityStore {
  const store = world.register(new CityStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "190.city.year", every: YEAR, run: (t) => cityYear(ctx(), t) });
  return store;
}
