// What a crossing costs a tonne, and what is worth carrying across it (Phase 71, asked for 2026-11-03: "alien contact and
// space age exploration and exploitation and trading"; "make it emerge from first principles"). A rocket's fuel is its
// speed's, not its distance's; a sail's is its beam's; a lane's fuel is burned by the ship, whatever it carries; and every
// year under way ties up a hull, and spoils what spoils. So a slow, far crossing carries only what is worth a great deal for
// its weight, and a lane opens the bulk trade. Goods are carried when what they fetch there, less what is lost on the way,
// beats what they cost here and what the crossing costs: one function, with no list of goods or ages. Pure.
import { dmath } from "../kernel/index.ts";
import { GOODS } from "./goods.ts";
import { LANE_MACHINES_TONNE, type LaneRoute } from "./lanes.ts";
import { STAR_DRIVES, crossingYears, cruise, type StarDrive } from "./starships.ts";

/** A unit of bulk in tonnes: a person's food for a month, in its sacks (est.). */
export const BULK_TONNES = 0.02;
/** What a freighter holds (tonnes, est.): a hull as dear as a settler ship's, with no one to keep alive in it. */
export const HOLD_TONNES = 20_000;
/** What its hull costs (machines), as a settler ship's does, and how many years it lasts (est.). */
export const HULL_MACHINES = 8_000_000;
export const HULL_YEARS = 300;
/** The share of a beam's energy a sail takes up (est.). */
export const BEAM_SHARE = 0.05;
/** Machines a tonne annihilated costs: the lanes' own figure, so all energy is priced alike. */
export const ENERGY_MACHINES = LANE_MACHINES_TONNE;
/** How much of its cruising speed a freighter crawls at between a lane's mouths: fuel saved against a few years (est.). */
export const LANE_CRAWL = 0.25;
/** A crossing within a star's own worlds takes about this long, its fuel next to nothing beside a star's (est.). */
export const SYSTEM_YEARS = 1;
/** What a land's people can pay for what comes from elsewhere, a head a year, in grain (est.). */
export const PAY_HEAD = 2;

/** The energy a tonne carried asks of a drive, up to a speed and down again, as tonnes annihilated. */
export function burnPerTonne(d: StarDrive, speed: number): number {
  if (d.sail) return (0.5 * speed * speed) / BEAM_SHARE;
  const r = dmath.exp(speed / d.exhaust);
  return 0.5 * (r * r - 1) * d.exhaust * d.exhaust;
}

/** What a crossing is, by a way a people could send it. */
export type Crossing = {
  readonly drive: string;
  readonly words: string;
  readonly ly: number;
  readonly hops: number;
  readonly years: number;
  /** Machines a tonne carried costs: its drive's fuel, a lane's, the hull's years; and all together. */
  readonly fuel: number;
  readonly lane: number;
  readonly hull: number;
  readonly machines: number;
};

const HULL_YEAR = HULL_MACHINES / HULL_YEARS / HOLD_TONNES;

/** A crossing on a drive straight across. */
export function crossingBy(d: StarDrive, ly: number): Crossing {
  const years = crossingYears(ly, d),
    fuel = ENERGY_MACHINES * burnPerTonne(d, cruise(d)),
    hull = HULL_YEAR * years;
  return {
    drive: d.id,
    words: d.words,
    ly,
    hops: 0,
    years,
    fuel,
    lane: 0,
    hull,
    machines: fuel + hull,
  };
}

/** A crossing by a way of lanes, on a drive that crawls from mouth to mouth. */
export function crossingByLanes(d: StarDrive, route: LaneRoute): Crossing {
  const speed = cruise(d) * LANE_CRAWL,
    years = route.jump + route.mouths / speed + 2 * Math.min(3, speed * 10),
    fuel = ENERGY_MACHINES * burnPerTonne(d, speed),
    lane = (route.tonnes * LANE_MACHINES_TONNE) / HOLD_TONNES,
    hull = HULL_YEAR * years;
  return {
    drive: d.id,
    words: d.words,
    ly: route.ly,
    hops: route.hops,
    years,
    fuel,
    lane,
    hull,
    machines: fuel + lane + hull,
  };
}

/** A crossing within one star's worlds. */
export const crossingWithin = (): Crossing => ({
  drive: "system",
  words: "a ship among its own star's worlds",
  ly: 0,
  hops: 0,
  years: SYSTEM_YEARS,
  fuel: 0,
  lane: 0,
  hull: HULL_YEAR * SYSTEM_YEARS,
  machines: HULL_YEAR * SYSTEM_YEARS,
});

/**
 * The cheapest way a people can carry a tonne across: by each drive it knows and any way of lanes it can use, no crossing longer
 * than it would send its own on (null: none is).
 */
export function cheapestCrossing(
  ly: number,
  knows: (id: string) => boolean,
  route: LaneRoute | null,
  longest: number,
): Crossing | null {
  if (ly <= 0) return crossingWithin();
  let best: Crossing | null = null;
  for (const d of STAR_DRIVES) {
    if (!d.needs.every(knows)) continue;
    for (const c of [crossingBy(d, ly), ...(route ? [crossingByLanes(d, route)] : [])]) {
      if (c.years > longest) continue;
      if (!best || c.machines < best.machines) best = c;
    }
  }
  return best;
}

/** What a unit of bulk costs to carry across, in grain, at what a machine fetches where the ship is fitted out. */
export const perBulk = (c: Crossing, machinePrice: number): number =>
  c.machines * BULK_TONNES * machinePrice;

/** The share of a good that comes to port: what spoils, spoils for as long as it is under way. */
export const survives = (good: number, years: number): number =>
  dmath.pow(1 - GOODS[good]!.spoil, 12 * years);

/** What a unit of a good clears, carried: what it fetches there and comes to port, less all it cost. */
export function marginOf(
  good: number,
  here: number,
  there: number,
  c: Crossing,
  machinePrice: number,
  risk: number,
): number {
  return (
    there * survives(good, c.years) * (1 - risk) -
    here -
    perBulk(c, machinePrice) * GOODS[good]!.bulk
  );
}

/** What a land has to sell of a good, what it asks; what another pays. */
export type Offer = {
  readonly good: number;
  readonly here: number;
  readonly there: number;
  readonly spare: number;
};

/** A hold's load of a good. */
export type Load = { readonly good: number; readonly count: number; readonly margin: number };

/** The most goods a hold is laded with (the best for their weight). */
export const HOLD_GOODS = 3;

/**
 * What a hold is laded with: what clears most for its weight first, as much as there is to spare, the hold takes and those who
 * would have it can pay for. Nothing, if nothing clears.
 */
export function holdOf(
  asks: readonly Offer[],
  c: Crossing,
  machinePrice: number,
  budget: number,
  risk: number,
): Load[] {
  const rows = asks
    .map((a) => ({
      a,
      margin: marginOf(a.good, a.here, a.there, c, machinePrice, risk),
    }))
    .filter((r) => r.margin > 0 && r.a.spare > 0)
    .sort(
      (x, y) =>
        y.margin / GOODS[y.a.good]!.bulk - x.margin / GOODS[x.a.good]!.bulk || x.a.good - y.a.good,
    );
  const out: Load[] = [];
  let room = HOLD_TONNES / BULK_TONNES,
    purse = budget;
  for (const { a, margin } of rows) {
    if (out.length >= HOLD_GOODS || room <= 0 || purse <= 0) break;
    const count = Math.floor(
      Math.min(a.spare, room / GOODS[a.good]!.bulk, purse / Math.max(1e-9, a.there)),
    );
    if (count <= 0) continue;
    out.push({ good: a.good, count, margin });
    room -= count * GOODS[a.good]!.bulk;
    purse -= count * a.there;
  }
  return out;
}

/** What goods clear a crossing at given prices, for a page's or a test's table: the dearest for their weight first. */
export function clearing(
  prices: readonly (readonly [number, number])[],
  c: Crossing,
  machinePrice: number,
): number[] {
  const out: number[] = [];
  prices.forEach(([here, there], g) => {
    if (marginOf(g, here, there, c, machinePrice, 0) > 0) out.push(g);
  });
  return out.sort((a, b) => GOODS[b]!.value / GOODS[b]!.bulk - GOODS[a]!.value / GOODS[a]!.bulk);
}
