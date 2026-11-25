// What fills the fuel slot on a world (gaps round, 2026-11-24: "the fuel slot must trade whatever the energy account burns").
// The market keeps two classes of fuel, a solid and a fluid (rules/goods.ts coal's and oil's places), as a need: heat for
// hearths, smelters and engines. What is in them on a given world is whatever its matter and life hold that gives heat with
// what its air holds to burn it with (rules/energy.ts bestHeat): wood cut past what a land's own hearths take, coal and oil
// where its crust buried them, the gas that comes with oil, the haze a hydrogen air rains down, sulphur by a sour world's
// vents. A fuel that gives no heat in a world's air is no fuel there, and its class holds none of it.
//   A unit of any fuel is the same heat (FUEL_UNIT_KWY), so a unit's weight is that heat over the fuel's heat a kilogram in
//   this world's air: the poorer the fuel, the more of it a unit is, and the more it costs to carry (slotBulk).
//   What a unit is worth where it is won is the work to win it: a worker wins so many kilograms a year (WON_KG), so many
//   units as their heat comes to, and a unit costs that share of what the worker's year would fetch elsewhere
//   (rules/money.ts naturalPrices `won`). Nothing here names a price.
// Dung and straw are burned where they fall and never carried: at their heat a kilogram, less than a third of coal's, with
// a tenth of it ash, a load is worth less than its carriage beyond a day's walk (the account keeps them a land's own).
// Pure tables and functions.
import { G, GOODS, RECIPES } from "./goods.ts";
import { FUEL_MAKEUP, FUEL_UNIT_KWY, MJ_A_KWY, bestHeat, mixMjKg, type Oxidant } from "./energy.ts";
import { BLENDED, BLEND_WHOLE, FUEL_CLASS, FUEL_KINDS, type FuelKind } from "./variety.ts";

/** The heat a unit of any fuel holds (MJ). */
export const FUEL_UNIT_MJ = FUEL_UNIT_KWY * MJ_A_KWY;

const recipeUnits = (g: number) =>
  RECIPES.find((r) => r.output[0] === g && r.needs?.seam)!.output[1];

/**
 * What a worker wins of each fuel in a year (kg): the work to win it. Coal's and oil's are what a year at the seam or the
 * field gives (their recipes' units, at the weight of a unit in oxygen), so the table and the recipe cannot disagree. What
 * lies about for the gathering is won by the same hands at the same weight as coal is dug (est: it was 60 kW·yr of heat a
 * crafter, whatever it was). Wood is felled, split, dried a season and carted: a third of a collier's weight (est: a
 * woodcutter's two cords a week, some 60 tonnes a year). Gas comes up with the oil and takes no work of its own.
 */
export const WON_KG: Readonly<Record<FuelKind, number>> = (() => {
  const coal = (recipeUnits(G.coal) * FUEL_UNIT_MJ) / mixMjKg(FUEL_MAKEUP.coal!, "oxygen"),
    oil = (recipeUnits(G.oil) * FUEL_UNIT_MJ) / mixMjKg(FUEL_MAKEUP.oil!, "oxygen");
  return { coal, oil, gas: Infinity, haze: coal, sulphur: coal, wood: 60_000 };
})();

/** What each kind is called where it is sold. */
export const FUEL_NOUNS: Readonly<Record<FuelKind, string>> = {
  coal: "coal",
  oil: "oil",
  gas: "gas",
  haze: "gathered haze",
  sulphur: "sulphur",
  wood: "firewood",
};

/** A fuel as it is on a world: the heat a kilogram gives in its air, and what follows from that. */
export type FuelHere = {
  readonly kind: FuelKind;
  /** The class it is sold in (a good's place). */
  readonly cls: number;
  /** The heat a kilogram gives with the best of what this air holds (MJ/kg), and with what. */
  readonly mj: number;
  readonly by: Oxidant;
  /** The weight of a unit of it here (kg). */
  readonly unitKg: number;
  /** The units a worker wins in a year (Infinity: it comes with another and takes no work of its own). */
  readonly won: number;
};

/** A fuel on a world whose air holds these to burn with (null: it gives no heat there, and is no fuel). */
export function fuelHere(kind: FuelKind, oxidants: readonly Oxidant[]): FuelHere | null {
  const key = `${kind}:${oxidants.join("+")}`;
  let f = HERE.get(key);
  if (f === undefined) {
    const h = bestHeat(FUEL_MAKEUP[kind]!, oxidants);
    if (!h.by || !(h.mj > 0)) f = null;
    else {
      const unitKg = FUEL_UNIT_MJ / h.mj;
      f = { kind, cls: FUEL_CLASS[kind], mj: h.mj, by: h.by, unitKg, won: WON_KG[kind] / unitKg };
    }
    HERE.set(key, f);
  }
  return f;
}
/** (Each fuel in each air, read once: a few kinds, a few airs.) */
const HERE = new Map<string, FuelHere | null>();

/**
 * What a year at a seam or a field gives on a world, against the same year under an air of oxygen (the recipe's units): a unit
 * is a heat, and the same weight dug gives as many units as its heat in this air comes to. Coal joined with a hydrogen air
 * gives under a fifth of what it gives burned in oxygen. 1 where the air holds nothing to burn with: nothing there burns it,
 * and what is dug is counted as it was (its works take it as a stuff).
 */
export function seamYield(kind: "coal" | "oil", oxidants: readonly Oxidant[]): number {
  if (!oxidants.length) return 1;
  return (fuelHere(kind, oxidants)?.mj ?? 0) / fuelHere(kind, ["oxygen"])!.mj;
}

/** Every fuel a world's air burns, the richest a kilogram first: what its fuel slot can hold at all. */
export function fuelsHere(oxidants: readonly Oxidant[]): FuelHere[] {
  return FUEL_KINDS.map((k) => fuelHere(k, oxidants))
    .filter((f): f is FuelHere => f !== null)
    .sort((a, b) => b.mj - a.mj || FUEL_KINDS.indexOf(a.kind) - FUEL_KINDS.indexOf(b.kind));
}

/** What a unit of a fuel costs where it is won: the share of a worker's year (worth `outside` elsewhere) a unit takes. */
export function fuelWorth(outside: number, f: Pick<FuelHere, "won">): number {
  return f.won > 0 && Number.isFinite(f.won) ? outside / f.won : 0;
}

/**
 * How heavy a unit of a fuel class is to carry in a market, against grain: the class's own (its first kind's, rules/goods.ts
 * bulk) times the weight of a unit of what the stock holds against a unit of its first kind. `mix`: the stock by kind, as
 * shares of one. Exactly the class's own where the stock is all its first kind.
 */
export function slotBulk(
  cls: number,
  mix: Partial<Record<FuelKind, number>>,
  oxidants: readonly Oxidant[],
): number {
  const first = fuelHere(cls === G.oil ? "oil" : "coal", ["oxygen"])!;
  let weight = 0,
    shares = 0;
  for (const k of FUEL_KINDS) {
    const s = mix[k] ?? 0;
    if (!(s > 0) || FUEL_CLASS[k] !== cls) continue;
    // (A kind this air does not burn is carried as dead weight at its first kind's.)
    weight += s * (fuelHere(k, oxidants)?.unitKg ?? first.unitKg);
    shares += s;
  }
  return GOODS[cls]!.bulk * (shares > 0 ? weight / shares / first.unitKg : 1);
}

/** (Each blended kind's unit weight against its class's first kind's, by what the air holds to burn with: read once an air.) */
const WEIGHTS = new Map<string, readonly number[]>();
function weightsOf(oxidants: readonly Oxidant[]): readonly number[] {
  const key = oxidants.join("+");
  let w = WEIGHTS.get(key);
  if (!w) {
    w = BLENDED.map((k) => {
      const first = fuelHere(FUEL_CLASS[k] === G.oil ? "oil" : "coal", ["oxygen"])!;
      return (fuelHere(k, oxidants)?.unitKg ?? first.unitKg) / first.unitKg;
    });
    WEIGHTS.set(key, w);
  }
  return w;
}

/** `slotBulk` read straight off a market's blend (rules/variety.ts: millionths, by BLENDED): nothing made, for the year's trade. */
export function blendBulk(
  cls: number,
  blend: readonly number[],
  oxidants: readonly Oxidant[],
): number {
  let k = 1;
  for (let i = 0; i < BLENDED.length; i++) {
    const share = blend[i] ?? 0;
    if (share > 0 && FUEL_CLASS[BLENDED[i]!] === cls)
      k += (share / BLEND_WHOLE) * (weightsOf(oxidants)[i]! - 1);
  }
  return GOODS[cls]!.bulk * k;
}

/** What a class's stock is called by what it holds: its greatest kind, and its second where that is a quarter of it or more. */
export function fillingName(mix: Partial<Record<FuelKind, number>>, cls: number): string {
  const had = FUEL_KINDS.filter((k) => FUEL_CLASS[k] === cls && (mix[k] ?? 0) > 0).sort(
    (a, b) => mix[b]! - mix[a]! || FUEL_KINDS.indexOf(a) - FUEL_KINDS.indexOf(b),
  );
  if (!had.length) return GOODS[cls]!.name;
  return had.length > 1 && mix[had[1]!]! >= 0.25
    ? `${FUEL_NOUNS[had[0]!]} and ${FUEL_NOUNS[had[1]!]}`
    : FUEL_NOUNS[had[0]!];
}
