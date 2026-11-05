// War from the air (War past the line, W2): a realm's machines in a war's year. What a side flies is its
// world's numbers (rules/reach.ts) and what its seat knows; it flies only with works that hold machines and the
// fuel its engine burns. No random draw anywhere here: a side strikes where it hurts most, and looking moves
// nothing. A strike's dead are told as a fire's are, so a town's roll, its graves and its wounds read them alike.
import type { Ref, SimTime } from "../../kernel/index.ts";
import { meansNumbers, meansOfWorld } from "../../gen/index.ts";
import {
  G,
  lotsAboutAim,
  MEN_TO_A_FLYER,
  MOST_FLYERS,
  MOST_STRIKES,
  engineOfLand,
  flyerOn,
  missOf,
  strikeOf,
  type Flyer,
} from "../../rules/index.ts";
import { fuelFor, woundWorksFor } from "../design/design.ts";
import { deathsIn, spill } from "../acts/disasters.ts";
import type { MarketStore } from "../economy/market.ts";
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
export function fleetOf(
  ctx: PopulationContext,
  p: Polity,
  fielded: () => number,
): Fleet | null {
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
function foodIn(ctx: PopulationContext, cell: number): number {
  const m = ctx.world.store<MarketStore>("economy.markets").get(cell);
  return m?.stock.reduce((s, v, i) => (i < 3 ? s + v : s), 0) ?? 0;
}

/** A town a side might strike. */
type Target = { readonly ref: Ref; readonly name: string; readonly cell: number; readonly hurt: number };

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
      while (at > 0 && (best[at - 1]!.hurt < hurt || (best[at - 1]!.hurt === hurt && best[at - 1]!.ref > v.ref)))
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
