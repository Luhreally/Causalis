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

// Rockets (War past the line, W3; "where are the missles..."): the same four numbers. How far one carries is
// the rocket equation against the world's own pull and radius; what it brings is the same sum as a drop's; how
// far it misses goes with how far it flies. Aboard: no one. All figures are estimates against the named anchors.

/** Earth's radius (km). */
const EARTH_KM = 6371;
/** A world's size and pull, as a throw asks of them. */
type Ground = Pick<MeansWorld, "pull" | "radius">;

/** The way half round a world (km): the farthest anything can land. */
export const aroundKm = (w: Pick<MeansWorld, "radius">): number => Math.PI * EARTH_KM * w.radius;
/**
 * The speed a thing must reach to land so far away by the least dear way, its world's curve counted (m/s):
 * v² = g R · 2 sin(φ/2) / (1 + sin(φ/2)), φ the angle between (for a short way v² = g × range; half way round it asks just what orbit asks).
 */
export function speedToLand(w: Ground, km: number): number {
  const R = EARTH_KM * w.radius,
    half = Math.min(km, aroundKm(w)) / R / 2,
    s = dmath.sin(half);
  return dmath.sqrt(w.pull * PULL * R * 1000 * ((2 * s) / (1 + s)));
}
/** How far something at a speed lands (km): that sum turned about. At the speed of orbit or more, anywhere on its world. */
export function landsAt(w: Ground, speed: number): number {
  if (speed <= 0) return 0;
  const R = EARTH_KM * w.radius,
    x = (speed * speed) / (w.pull * PULL * R * 1000);
  if (x >= 1) return aroundKm(w);
  const s = x / (2 - x);
  return 2 * dmath.atan2(s, dmath.sqrt(1 - s * s)) * R;
}

/** How much of a charge's energy goes into the speed of what is thrown out (est: gives 2 km/s on gun cotton, as Earth's first great rocket had). */
const THROW_SHARE = 0.5;
/** The speed of what a rocket throws out (m/s), by what a kilogram of its charge holds. */
export const thrownOut = (mj: number): number => dmath.sqrt(2 * THROW_SHARE * mj * 1e6);
/** What one carries (kg; est: Earth's first, a tonne). */
export const ROCKET_LOAD_KG = 1000;
/** What of a rocket is its load and what of each stage its frame, by how many stages it comes in (est: Earth's first, 8% and 26%; those in stages, lighter in the frame and less in the load). */
const ROCKET_SHARES: readonly (readonly [load: number, frame: number])[] = [
  [0.08, 0.26],
  [0.05, 0.15],
  [0.03, 0.15],
];
/** How long it climbs against the pull (s; est: a minute, as Earth's first), and what the air takes of its speed at Earth's weight (m/s). */
const CLIMB_S = 60,
  AIR_LOSS = 50;
/** The fewest km worth a rocket: nearer than this, a gun does it (est: Earth's longest guns). */
export const LEAST_THROW_KM = 50;
/** The most stages known of: one, then two with machines to steer it, then three with what reaches orbit. */
export const MOST_STAGES = ROCKET_SHARES.length;

/** A rocket on a world: all of it from the numbers. */
export type Rocket = {
  readonly stages: number;
  /** What it weighs ready to fly (kg), and carries. */
  readonly kg: number;
  readonly loadKg: number;
  /** The speed of what it throws out, and its own when its charge is spent (m/s). */
  readonly thrown: number;
  readonly speed: number;
  /** How far it lands (km), and whether that is anywhere on its world. */
  readonly reachKm: number;
  readonly around: boolean;
};
type RocketGround = Pick<MeansWorld, "pull" | "radius" | "airBar" | "kelvin">;
/** The rocket a charge makes on a world, in so many stages: the rocket equation, less what its climb and its air take. */
export function rocketOn(w: RocketGround, mj: number, stages: number): Rocket {
  const n = Math.max(1, Math.min(MOST_STAGES, stages)),
    [load, frame] = ROCKET_SHARES[n - 1]!,
    each = dmath.pow(load, 1 / n),
    thrown = thrownOut(mj),
    gain = -n * thrown * dmath.log(each + (1 - each) * frame),
    speed = Math.max(0, gain - CLIMB_S * w.pull * PULL - AIR_LOSS * dmath.sqrt(airWeight(w))),
    reachKm = landsAt(w, speed);
  return {
    stages: n,
    kg: ROCKET_LOAD_KG / load,
    loadKg: ROCKET_LOAD_KG,
    thrown,
    speed,
    reachKm,
    around: reachKm >= aroundKm(w),
  };
}
/** Whether a world's first rocket on this charge is worth making (null: too heavy a world, or too weak a charge for the sum). */
export function firstRocket(w: RocketGround, mj: number | null | undefined): Rocket | null {
  if (!mj) return null;
  const r = rocketOn(w, mj, 1);
  return r.reachKm >= LEAST_THROW_KM ? r : null;
}
/** How many stages a land's people can build, by what it knows. */
export const stagesKnown = (knows: (id: string) => boolean): number =>
  1 + (knows("guidance") ? 1 : 0) + (knows("guidance") && knows("orbital-flight") ? 1 : 0);

/** How far from its aim a rocket lands, of how far it flew (est: half within it): thrown as a shell is, and steered (Earth's of 1962, some 400 m at 740 km). */
export const MISS_THROWN = 0.03,
  MISS_STEERED = 0.0005;
/** How far from the aim it lands (m), for so far flown. */
export const rocketMiss = (km: number, steered: boolean): number =>
  Math.max(MISS_STEADIED, km * 1000 * (steered ? MISS_STEERED : MISS_THROWN));
/** The lots a rocket flattens, all its load landing together: its energy to the 2/3 power, not each share's. */
export const lotsPerRocket = (mjPerKg: number): number =>
  deadlyGround(energyAt(ROCKET_LOAD_KG, mjPerKg)) / LOT_M2;

/** How many of its fighting men go to a rocket a year, and what one takes of a realm's machines (est: Earth's first thousands, some 2,000 men under arms to each). */
export const MEN_TO_A_ROCKET = 2000,
  MACHINES_TO_A_ROCKET = 40;
/** The most a realm throws in a year of a war, the most places it throws them at, and the least flattened that is told as a fall on a town (a lot: less is fields). */
export const MOST_ROCKETS = 1000,
  MOST_THROWN_AT = 3,
  LEAST_FLATTENED = 0.5;
/** How much more a town is worth to strike where it holds its land's works, and where its land's goods go through it, than what it holds of people (est). */
export const WORKS_WORTH = 8,
  WAYS_WORTH = 2;
/** The lots of a town's that its works are as great as (est), and how long its works stand idle once struck hard (years, est: a works bombed on Earth took about as long). */
export const WORKS_LOTS = 20,
  WORKS_DOWN_YEARS = 3;

/** What rockets thrown at a town do: pure, so a page and history reckon alike. */
export function throwOf(input: {
  readonly rockets: number;
  readonly mjPerKg: number;
  readonly miss: number;
  readonly lots: number;
  readonly people: number;
}): {
  readonly landed: number;
  readonly flattened: number;
  readonly share: number;
  readonly dead: number;
} {
  const landed = input.rockets * hitShare(townRadius(input.lots), input.miss),
    flattened = landed * lotsPerRocket(input.mjPerKg) * ON_HOMES;
  if (flattened < LEAST_FLATTENED || input.lots <= 0)
    return { landed, flattened: 0, share: 0, dead: 0 };
  const share = Math.min(MOST_FLATTENED, flattened / input.lots);
  return { landed, flattened, share, dead: Math.round(share * input.people * KILLS) };
}
