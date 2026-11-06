// War from the air (War past the line, W2): a realm's machines in a war's year. What a side flies is its
// world's numbers (rules/reach.ts) and what its seat knows; it flies only with works that hold machines and the
// fuel its engine burns. No random draw anywhere here: a side strikes where it hurts most, and looking moves
// nothing. A strike's dead are told as a fire's are, so a town's roll, its graves and its wounds read them alike.
import { dmath, yearOfMoment, type Ref, type SimTime } from "../../kernel/index.ts";
import { meansNumbers, meansOfWorld } from "../../gen/index.ts";
import {
  G,
  GOODS,
  lotsAboutAim,
  MACHINES_TO_A_ROCKET,
  MEN_TO_A_FLYER,
  MEN_TO_A_ROCKET,
  MOST_FLYERS,
  MOST_ROCKETS,
  MOST_STRIKES,
  MOST_THROWN_AT,
  WAYS_WORTH,
  WORKS_DOWN_YEARS,
  WORKS_LOTS,
  WORKS_WORTH,
  engineOfLand,
  flyerOn,
  hitShare,
  missOf,
  rocketMiss,
  rocketOn,
  stagesKnown,
  strikeOf,
  throwOf,
  townRadius,
  firstRocket,
  type Flyer,
  type Rocket,
} from "../../rules/index.ts";
import { fuelFor, woundWorksFor } from "../design/design.ts";
import { deathsIn, spill } from "../acts/disasters.ts";
import type { Market, MarketStore } from "../economy/market.ts";
import { loreOf } from "../lore/lore.ts";
import type { Polity } from "../polity/polity.ts";
import type { PopulationContext } from "../population/systems.ts";
import { burnTown, townsOf } from "../town/fabric.ts";

/** What a realm has in the air. */
export type Fleet = {
  readonly flyers: number;
  readonly flyer: Flyer;
  /** It knows how to drop a load, and what a kilogram of its charge holds (MJ; 0: nothing to drop). */
  readonly mj: number;
  /** How far from the aim its loads land (m). */
  readonly miss: number;
};

/** Where a realm's machines would get what their engine burns (null: none): oil as its cars do, or coal for steam. */
function fueled(ctx: PopulationContext, p: Polity, fuel: "coal" | "oil"): boolean {
  if (fuel === "oil") return fuelFor(ctx, p) !== null;
  const markets = ctx.world.store<MarketStore>("economy.markets");
  return p.members.some((c) => (markets.get(c)?.stock[G.coal] ?? 0) > 0);
}

/** What a realm flies this year (null: nothing: it does not know how, or has no works or fuel to fly on). */
export function fleetOf(ctx: PopulationContext, p: Polity, fielded: () => number): Fleet | null {
  const lore = loreOf(ctx.world);
  if (!lore.get(p.seat, "powered-wings")) return null;
  const world = meansNumbers(ctx.generated),
    engine = engineOfLand(world, (id) => !!lore.get(p.seat, id));
  if (!engine || !fueled(ctx, p, engine.fuel) || !woundWorksFor(ctx, p)) return null;
  const flyers = Math.min(MOST_FLYERS, Math.floor(fielded() / MEN_TO_A_FLYER));
  if (flyers < 1) return null;
  const charge = meansOfWorld(ctx.generated).worksCharge;
  return {
    flyers,
    flyer: flyerOn(engine, world),
    mj: lore.get(p.seat, "dropped-loads") && charge ? charge.mj : 0,
    miss: missOf(!!lore.get(p.seat, "guidance")),
  };
}

/** A land's food in store. */
export function foodIn(ctx: PopulationContext, cell: number): number {
  const m = ctx.world.store<MarketStore>("economy.markets").get(cell);
  return m?.stock.reduce((s, v, i) => (i < 3 ? s + v : s), 0) ?? 0;
}

/** A town a side might strike. */
type Target = {
  readonly ref: Ref;
  readonly name: string;
  readonly cell: number;
  readonly hurt: number;
};

/**
 * The towns in reach of a front that would hurt a foe most, the worst first: by its people, double where its
 * land has works, and a share of its land's food. `chord`: the reach on a world of radius 1.
 */
export function targetsOf(
  ctx: PopulationContext,
  foe: Polity,
  front: number,
  chord: number,
): Target[] {
  const p = ctx.generated.grid.positions,
    markets = ctx.world.store<MarketStore>("economy.markets"),
    fx = p[3 * front]!,
    fy = p[3 * front + 1]!,
    fz = p[3 * front + 2]!,
    towns = townsOf(ctx.world),
    best: Target[] = [];
  for (const c of foe.members) {
    const dx = p[3 * c]! - fx,
      dy = p[3 * c + 1]! - fy,
      dz = p[3 * c + 2]! - fz;
    if (dx * dx + dy * dy + dz * dz > chord * chord) continue;
    const prov = ctx.provinces.get(c),
      all = prov?.total() ?? 0;
    if (!prov || all <= 0) continue;
    const works = markets.get(c)?.works ? 2 : 1,
      food = foodIn(ctx, c);
    for (const v of ctx.settlements.inProvince(c)) {
      if (!(v.population > 0)) continue;
      const hurt = v.population * works + (food * v.population) / all / 10;
      if (best.length === MOST_STRIKES && hurt <= best.at(-1)!.hurt) continue;
      if (!towns.get(v.ref)?.homes.some((n) => n > 0)) continue;
      let at = best.length;
      while (
        at > 0 &&
        (best[at - 1]!.hurt < hurt || (best[at - 1]!.hurt === hurt && best[at - 1]!.ref > v.ref))
      )
        at--;
      best.splice(at, 0, { ref: v.ref, name: v.name, cell: c, hurt });
      if (best.length > MOST_STRIKES) best.pop();
    }
  }
  return best;
}

/** What a strike did. */
export type StrikeDone = {
  readonly dead: number;
  readonly homes: number;
  readonly stores: number;
};

/** A strike falls on a town: its homes burned about its heart, its people dead by their land's ledgers, the food about it spoiled. */
export function strikeTown(
  ctx: PopulationContext,
  target: Target,
  fleet: Fleet,
  flyers: number,
  t: SimTime,
): StrikeDone {
  const v = ctx.settlements.get(target.ref)!,
    f = townsOf(ctx.world).get(target.ref)!,
    prov = ctx.provinces.get(target.cell)!,
    lots = Math.max(1, f.next),
    { share, dead } = strikeOf({
      flyers,
      loadKg: fleet.flyer.loadKg,
      mjPerKg: fleet.mj,
      miss: fleet.miss,
      lots,
      people: v.population,
    }),
    all = prov.total();
  if (share <= 0) return { dead: 0, homes: 0, stores: 0 };
  const homes = burnTown(ctx, target.ref, share, t, lotsAboutAim(fleet.miss)),
    killed = dead > 0 && all > 0 ? deathsIn(ctx, target.cell, dead, t) : 0,
    before = foodIn(ctx, target.cell);
  // (What burned of its land's stores: as much of them as of its homes, by the town's share of its land's people.)
  spill(ctx, target.cell, all > 0 ? (share * Math.min(1, v.population / all)) / 2 : 0);
  return { dead: killed, homes, stores: Math.round(before - foodIn(ctx, target.cell)) };
}

/** What a realm can throw in a year of a war (W3). */
export type Thrower = {
  readonly rockets: number;
  readonly rocket: Rocket;
  /** What a kilogram of its charge holds (MJ). */
  readonly mj: number;
  readonly steered: boolean;
};

/** What a realm throws this year (null: it does not know how, or has no works with machines to spare). */
export function throwerOf(
  ctx: PopulationContext,
  p: Polity,
  fielded: () => number,
): Thrower | null {
  const lore = loreOf(ctx.world);
  if (!lore.get(p.seat, "thrown-loads")) return null;
  const charge = meansOfWorld(ctx.generated).worksCharge,
    world = meansNumbers(ctx.generated);
  if (!firstRocket(world, charge?.mj)) return null;
  const markets = ctx.world.store<MarketStore>("economy.markets");
  let held = 0;
  for (const c of p.members) {
    const m = markets.get(c);
    if (m?.works) held += m.stock[G.machines]!;
  }
  const rockets = Math.min(
    MOST_ROCKETS,
    Math.floor(fielded() / MEN_TO_A_ROCKET),
    Math.floor(held / MACHINES_TO_A_ROCKET),
  );
  if (rockets < 1) return null;
  return {
    rockets,
    rocket: rocketOn(
      world,
      charge!.mj,
      stagesKnown((id) => !!lore.get(p.seat, id)),
    ),
    mj: charge!.mj,
    steered: !!lore.get(p.seat, "guidance"),
  };
}

/** A realm's rockets paid for, out of its works' machines, each land's in turn. */
export function payForRockets(ctx: PopulationContext, p: Polity, rockets: number): void {
  const markets = ctx.world.store<MarketStore>("economy.markets");
  let left = rockets * MACHINES_TO_A_ROCKET;
  for (const c of [...p.members].sort((a, b) => a - b)) {
    if (left <= 0) break;
    const m = markets.get(c);
    if (!m?.works) continue;
    const take = Math.min(left, m.stock[G.machines]!);
    m.move("used", G.machines, take);
    left -= take;
  }
}

/** Whether goods go through a land by road, rail or sea: what it carried in or out last year. */
function goesThrough(m: Market): boolean {
  for (let g = 0; g < GOODS.length; g++)
    if (m.book("carriedIn", g) > 0 || m.book("carriedOut", g) > 0) return true;
  return false;
}

/** A town a side's rockets might fall on: what it is worth, and how far it is from where they leave. */
type ThrownAt = Target & { readonly km: number; readonly works: boolean };

/**
 * The towns in a rocket's reach that would hurt a foe most for each one thrown, the worst first. Each land's
 * greatest town is what its land's works and ways are worth to strike (works WORKS_WORTH, goods going through it
 * WAYS_WORTH, each a multiple of the people it holds), by the share of what is thrown that would land on it from
 * here: so works come first, then the ways, then the most people, nearer before farther where the miss is wide.
 */
export function thrownAtOf(
  ctx: PopulationContext,
  foe: Polity,
  from: number,
  t: Thrower,
  radiusKm: number,
): ThrownAt[] {
  const p = ctx.generated.grid.positions,
    markets = ctx.world.store<MarketStore>("economy.markets"),
    towns = townsOf(ctx.world),
    fx = p[3 * from]!,
    fy = p[3 * from + 1]!,
    fz = p[3 * from + 2]!,
    // (In a straight line, on a world of radius 1: as far as the way round it is that far.)
    chord = t.rocket.around
      ? 3
      : 2 * dmath.sin(Math.min(Math.PI / 2, t.rocket.reachKm / radiusKm / 2)),
    best: (ThrownAt & { worth: number })[] = [];
  for (const c of foe.members) {
    const dx = p[3 * c]! - fx,
      dy = p[3 * c + 1]! - fy,
      dz = p[3 * c + 2]! - fz,
      d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > chord * chord) continue;
    const prov = ctx.provinces.get(c);
    if (!prov || !(prov.total() > 0)) continue;
    let great: { ref: Ref; name: string; population: number } | null = null;
    for (const v of ctx.settlements.inProvince(c))
      if (v.population > 0 && (!great || v.population > great.population)) great = v;
    if (!great || !towns.get(great.ref)?.homes.some((n) => n > 0)) continue;
    const m = markets.get(c),
      works = !!m?.works,
      ways = !!m && goesThrough(m),
      half = Math.min(1, dmath.sqrt(d2) / 2),
      km = 2 * dmath.atan2(half, dmath.sqrt(1 - half * half)) * radiusKm,
      lots = Math.max(1, towns.get(great.ref)!.next),
      worth =
        great.population *
        (works ? WORKS_WORTH : 1) *
        (ways ? WAYS_WORTH : 1) *
        hitShare(townRadius(lots), rocketMiss(km, t.steered));
    if (best.length === MOST_THROWN_AT && worth <= best.at(-1)!.worth) continue;
    let at = best.length;
    while (
      at > 0 &&
      (best[at - 1]!.worth < worth ||
        (best[at - 1]!.worth === worth && best[at - 1]!.ref > great.ref))
    )
      at--;
    best.splice(at, 0, {
      ref: great.ref,
      name: great.name,
      cell: c,
      hurt: worth,
      worth,
      km,
      works,
    });
    if (best.length > MOST_THROWN_AT) best.pop();
  }
  return best;
}

/** What a fall of rockets did. */
export type ThrowDone = StrikeDone & {
  /** How many of those thrown landed on the town, by what their miss makes of it. */
  readonly landed: number;
  /** The machines its land's works lost; whether its works now stand idle. */
  readonly machines: number;
  readonly idled: boolean;
};

/** Rockets fall on a town: as a raid's, its homes burned, its people dead, its stores spoiled; and what its land's works hold goes with them, and they stand idle. */
export function throwAt(
  ctx: PopulationContext,
  target: ThrownAt,
  t2: Thrower,
  rockets: number,
  t: SimTime,
): ThrowDone {
  const v = ctx.settlements.get(target.ref)!,
    f = townsOf(ctx.world).get(target.ref)!,
    prov = ctx.provinces.get(target.cell)!,
    lots = Math.max(1, f.next),
    miss = rocketMiss(target.km, t2.steered),
    { landed, flattened, share, dead } = throwOf({
      rockets,
      mjPerKg: t2.mj,
      miss,
      lots,
      people: v.population,
    }),
    all = prov.total();
  if (share <= 0) return { dead: 0, homes: 0, stores: 0, landed, machines: 0, idled: false };
  const homes = burnTown(
      ctx,
      target.ref,
      share,
      t,
      lotsAboutAim(miss),
      Math.max(1, Math.round(landed)),
    ),
    killed = dead > 0 && all > 0 ? deathsIn(ctx, target.cell, dead, t) : 0,
    before = foodIn(ctx, target.cell);
  spill(ctx, target.cell, all > 0 ? (share * Math.min(1, v.population / all)) / 2 : 0);
  // What its land's works held and did: as much of it as its fall took of what they stand on.
  const m = ctx.world.store<MarketStore>("economy.markets").get(target.cell);
  let machines = 0,
    idled = false;
  if (m?.works) {
    const hit = Math.min(1, flattened / WORKS_LOTS);
    machines = m.move("spoiled", G.machines, Math.floor(m.stock[G.machines]! * hit));
    idled = flattened >= 1;
    if (idled) m.idleUntil = Math.max(m.idleUntil, yearOfMoment(t) + WORKS_DOWN_YEARS);
  }
  return {
    dead: killed,
    homes,
    stores: Math.round(before - foodIn(ctx, target.cell)),
    landed,
    machines,
    idled,
  };
}
