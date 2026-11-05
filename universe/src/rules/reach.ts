// What an arm reaches (War past the line, W2; asked for 2026-11-05: "where are the missles and nukes and
// like drones and modern military and stuff beyond imagination ... make it emerge from first principles").
// An arm is four numbers read off its world and what its people know (docs/architecture/war-reach-plan.md):
// what arrives at the target, how far it carries, how far from the aim it lands, who is aboard. Here the
// wing's, the first of them, and the one sum W3 and W5 share: the ground made deadly grows as energy to the
// 2/3 power (blast scales with the cube root of energy, Hopkinson 1915, Cranz 1926).
//
// Whether it flies at all: power to fly goes as pull^1.5 over air's weight^0.5 (rules/means.ts flightPower), an
// engine gives a power to its weight, and what a machine must spend on its engine comes out of what it carries.
// All figures here are estimates against the named anchors, and pages say so. Pure tables and functions.
import { dmath } from "../kernel/index.ts";
import { airWeight, flightPower, type MeansWorld } from "./means.ts";

/** A town's lot (9 m by 14 m, bridge/town.ts LOT_W and LOT_D; m²). */
export const LOT_M2 = 126;
/** What is dropped at one go (kg, est: the usual bomb of Earth's first air wars), and how much of it is charge (est). */
export const DROP_KG = 100,
  CHARGE_SHARE = 0.5;
/** The charge the sum is calibrated on: gun cotton (rules/means.ts CHARGES). */
const ORDINARY_MJ = 4.2;
/** The ground flattened for energy^(2/3) (m² per MJ^(2/3)): so that a drop of ordinary charge flattens one lot. Fifteen thousand tonnes' worth then flattens 0.56 km², about the ground of Hiroshima's heaviest blast. */
const DEADLY_K = LOT_M2 / dmath.pow(DROP_KG * CHARGE_SHARE * ORDINARY_MJ, 2 / 3);

/** The energy a load brings to its target (MJ): its charge's share, by what a kilogram of charge holds. */
export const energyAt = (loadKg: number, mjPerKg: number): number =>
  loadKg * CHARGE_SHARE * mjPerKg;
/** The ground made deadly by an energy (m²): W3's and W5's as well. */
export const deadlyGround = (mj: number): number => (mj > 0 ? DEADLY_K * dmath.pow(mj, 2 / 3) : 0);
/** How many lots one drop of a charge flattens. */
export const lotsPerDrop = (mjPerKg: number): number =>
  deadlyGround(energyAt(DROP_KG, mjPerKg)) / LOT_M2;

/** A height's eye misses by about this, and a machine that steadies it by this (m; both estimates: half land within it). */
export const MISS_EYE = 300,
  MISS_STEADIED = 30;
/** How far from the aim a load lands: by the eye, or steadied by a machine (`guidance`). */
export const missOf = (steadied: boolean): number => (steadied ? MISS_STEADIED : MISS_EYE);
/** The share of what is dropped that lands within a ground of this radius (half land within the miss). */
export const hitShare = (radiusM: number, miss: number): number =>
  1 - dmath.pow(2, -((radiusM / miss) * (radiusM / miss)));

/** The worst fliers' worth of Earth's numbers: what a machine that carries a load asks to the kilogram (W, est: 66 for the Handley Page O/400 of 1917, 108 for the Gotha G.IV). */
export const EARTH_ASK = 80;
/** What a machine's frame takes of its weight, and its fuel (est: Earth's first bombers). */
const FRAME_SHARE = 0.45,
  FUEL_SHARE = 0.15;
/** What it must have left to carry anyone at all: one aboard, in a machine of Earth's first size. */
const LEAST_LOAD = 0.02;
/** A machine's lift over drag (est: Earth's first, 8 to 10). */
const LIFT_OVER_DRAG = 8;
/** A kilogram of it against Earth's first bomber's four tonnes: flying as much cheaper as the world's numbers are makes it as much bigger (est), so far and no further. */
const EARTH_KG = 4000,
  LEAST_KG = 300,
  MOST_KG = 60_000;
/** The speed of Earth's first (m/s) and its loading (kg/m²), a wing's lift coefficient, its span against its chord (est). */
const EARTH_SPEED = 46,
  WING_LIFT = 0.6,
  SPAN_RATIO = 6;
/** Air's weight at Earth's sea level (kg/m³), and its pull (m/s²). */
const AIR_KG = 1.225,
  PULL = 9.81;

/** An engine a machine can carry: what it gives to its weight and what a kilogram of its fuel comes to at the shaft. */
export type CarriedEngine = {
  /** The principle that brings it. */
  readonly id: "steam-engine" | "engines";
  readonly name: string;
  /** W to the kilogram of plant (est: a steam plant, Maxim 1894; an oil engine, the Gnome of 1908). */
  readonly wkg: number;
  /** MJ a kilogram of its fuel comes to, at the shaft (coal 24 at 8%, oil 43 at 22%). */
  readonly shaftMj: number;
  readonly fuel: "coal" | "oil";
};
/** The engines a machine can carry, least first. Both burn: where nothing burns a machine has none (F1's list). */
export const CARRIED_ENGINES: readonly CarriedEngine[] = [
  { id: "steam-engine", name: "the steam engine", wkg: 150, shaftMj: 1.9, fuel: "coal" },
  { id: "engines", name: "the engine that burns oil", wkg: 490, shaftMj: 9.5, fuel: "oil" },
];

type Sky = Pick<MeansWorld, "airBar" | "kelvin" | "pull">;

/** What flying asks here, to the kilogram of machine (W). Titan's numbers give about 1.8, a man's own arms' reach; Mars's about 150. */
export const askWkg = (w: Sky): number => EARTH_ASK * flightPower(w);
/** What an engine gives to its weight here: it breathes its air, so under Earth's weight it gives the less, and over it no more. */
export const givesWkg = (e: CarriedEngine, w: Sky): number => e.wkg * Math.min(1, airWeight(w));
/** What of a machine's weight is left to carry, once its frame, fuel and the engine that lifts it are paid for. */
export const loadShare = (e: CarriedEngine, w: Sky): number =>
  1 - FRAME_SHARE - FUEL_SHARE - askWkg(w) / givesWkg(e, w);
/** Whether a machine can be driven here at all: fire, and ground to rise from. */
export const canBurn = (w: Pick<MeansWorld, "freeOxygen" | "bodyFire" | "medium">): boolean =>
  w.freeOxygen && w.bodyFire && w.medium !== "water";

/** The least engine that lifts a machine here (null: none does, or none can run here). */
export function liftingEngine(w: MeansWorld): CarriedEngine | null {
  if (!canBurn(w)) return null;
  return CARRIED_ENGINES.find((e) => loadShare(e, w) >= LEAST_LOAD) ?? null;
}

/** The best engine a land knows that lifts a machine here (null: none). */
export function engineOfLand(w: MeansWorld, knows: (id: string) => boolean): CarriedEngine | null {
  if (!canBurn(w)) return null;
  let best: CarriedEngine | null = null;
  for (const e of CARRIED_ENGINES) if (loadShare(e, w) >= LEAST_LOAD && knows(e.id)) best = e;
  return best;
}

/** How far a machine goes and comes back (km): fuel share, by what a kilogram gives at the shaft, by lift over drag, over pull, halved. */
export function reachKm(e: CarriedEngine, w: Pick<MeansWorld, "pull">): number {
  return (FUEL_SHARE * e.shaftMj * 1e6 * LIFT_OVER_DRAG) / (w.pull * PULL) / 2 / 1000;
}

/** A flying machine on a world: all of it from the numbers. */
export type Flyer = {
  readonly engine: CarriedEngine;
  /** What it weighs ready to fly (kg). */
  readonly kg: number;
  /** What it carries (kg): a person, and the rest load. */
  readonly loadKg: number;
  /** How fast it goes (m/s). */
  readonly speed: number;
  /** Its wing's area (m²), from its weight over air and speed squared. */
  readonly wingM2: number;
  /** Tip to tip, and nose to tail (m). */
  readonly spanM: number;
  readonly lengthM: number;
  /** How far it goes and comes back (km). */
  readonly reachKm: number;
  /** What flying asks here and what its engine gives (W to the kilogram of machine at its share of a third). */
  readonly askWkg: number;
  readonly givesWkg: number;
};

/** The machine an engine makes on this world. */
export function flyerOn(e: CarriedEngine, w: Sky): Flyer {
  const fly = flightPower(w),
    kg = Math.max(LEAST_KG, Math.min(MOST_KG, EARTH_KG / (fly * fly))),
    air = airWeight(w),
    speed = EARTH_SPEED * dmath.pow(w.pull / air, 0.5),
    wingM2 = (kg * w.pull * PULL) / (0.5 * AIR_KG * air * speed * speed * WING_LIFT),
    spanM = dmath.pow(SPAN_RATIO * wingM2, 0.5);
  return {
    engine: e,
    kg,
    loadKg: Math.max(0, loadShare(e, w) * kg),
    speed,
    wingM2,
    spanM,
    lengthM: spanM * 0.7,
    reachKm: reachKm(e, w),
    askWkg: askWkg(w),
    givesWkg: givesWkg(e, w),
  };
}

/** How many of its fighting men go to each machine in the air, ground crews and all (est: late in Earth's first air war). */
export const MEN_TO_A_FLYER = 400;
/** The most a realm keeps in the air, the most towns it strikes in a year of a war, and the most of a town one strike can flatten. */
export const MOST_FLYERS = 20_000,
  MOST_STRIKES = 3,
  MOST_FLATTENED = 0.5;
/** How much of a town's ground is homes (est), and how much of it a flattened home's people die (est: some four dead to the tonne dropped, as on Earth's first towns bombed). */
export const ON_HOMES = 0.5,
  KILLS = 0.1;
/** How much of a town's ground a lot takes: half of it is streets and yards (est). */
const STREETS = 2;
/** How many lots out from a town's heart a load's miss reaches, on average: hits thin as e^(-r²/2σ²), and a plan's lots go as r². */
export const lotsAboutAim = (miss: number): number =>
  (Math.PI * 2 * miss * miss) / (LOT_M2 * STREETS);
/** A town's radius (m), by how many lots it holds. */
export const townRadius = (lots: number): number =>
  dmath.pow((lots * LOT_M2 * STREETS) / Math.PI, 0.5);

/** What a side's sight of the ground is worth: at most this much more power, shared with a foe who also flies. */
export const SIGHT = 0.12;
/** A side's term for what it sees: exactly 1 with no flyers of its own. */
export const sightTerm = (own: number, foe: number): number =>
  own > 0 ? 1 + (SIGHT * own) / (own + foe) : 1;

/** What a strike on a town does: pure, so a page and history reckon alike. */
export function strikeOf(input: {
  readonly flyers: number;
  readonly loadKg: number;
  readonly mjPerKg: number;
  readonly miss: number;
  /** The town's lots, and its people. */
  readonly lots: number;
  readonly people: number;
}): { readonly flattened: number; readonly share: number; readonly dead: number } {
  const drops = (input.flyers * input.loadKg) / DROP_KG,
    landed = drops * hitShare(townRadius(input.lots), input.miss) * ON_HOMES,
    flattened = landed * lotsPerDrop(input.mjPerKg),
    share = input.lots > 0 ? Math.min(MOST_FLATTENED, flattened / input.lots) : 0;
  return {
    flattened,
    share,
    dead: Math.round(share * input.people * KILLS),
  };
}
