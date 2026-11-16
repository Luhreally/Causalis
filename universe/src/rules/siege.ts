// Sieges (the last sweep, war). A realm's seat is not taken in a day. Once its host is beaten in the field before it, the seat
// is shut in. It lives on what it had in store when the lines closed, and on what the sea brings it while its ships hold the
// sea. What its land grows outside the walls goes to the camp. The besiegers wear at the walls with what they know of siege
// work and with what their arms throw, against the walls the land knows how to raise. The camp sickens as camps do: more
// where the land is warm, more as more men are packed in, less where they know how to keep a camp clean. The town sickens
// too, crowded with those who fled in from its land. It falls when the walls are open and the besiegers win before them
// (stormed), or when its stores are gone (starved). It is relieved when the besiegers are beaten before it. These are pure
// readings of numbers the world keeps; sim/war/siege.ts keeps one row a siege and steps it in a war's year.
import { dmath } from "../kernel/index.ts";

export const SIEGE = {
  /** The share of a besieged land's harvest grown inside the walls or slipped past the lines. The camp takes the rest. */
  within: 0.1,
  /** What a year of siege work opens of a wall that no learned principle raised: one year of it and the walls are down. */
  breach: 1,
  /** How much each unit of the besiegers' fire and breaching adds to their siege work. */
  fire: 0.5,
  /** Of a camp, the share its sickness kills in a year on middling ground, in a middling crowd, with no care. */
  camp: 0.1,
  /** How much warmer than the world's mean (°C) a camp must stand for its sickness to double. */
  warmDoubles: 15,
  /** A camp this many strong is a middling crowd; each tenfold more crowds it by `crowdStep` more. */
  crowdMid: 1000,
  crowdStep: 0.25,
  /** Of a besieged town, the share its crowding kills in a year (crowded with refugees, its water foul), with no care. */
  town: 0.03,
  /** Of a town without food for a whole year, the share that dies of it before it gives up. */
  starve: 0.3,
  /** The most care can save of either sickness. */
  careMost: 0.9,
} as const;

/** A besieged seat's year: the numbers the step reads. */
export type SiegeYear = {
  /** Months of food the seat had in store at the year's start (it may be 0). */
  readonly months: number;
  /** How far its walls are open (0 … 1). */
  readonly breach: number;
  /** How much its land knows of raising walls (the summed `walls` effect of the principles it has: 0 none). */
  readonly walls: number;
  /** How much the besiegers know of siege work (the summed `sieges` effect at their seat). */
  readonly engines: number;
  /** What the besiegers' arms throw and breach (sim/war/arms.ts `fire` + `breach`; 0 before the magazine and the armour). */
  readonly fire: number;
  /** Of the seat's food, the share its realm's ships bring in at full command of the sea (0: none, or no coast). */
  readonly relief: number;
  /** The men in the besiegers' camp. */
  readonly camp: number;
  /** How much warmer the seat's land is than its world's mean, °C (negative where colder). */
  readonly warmth: number;
  /** Of deaths, the share the besiegers' care spares (their `health` effect), and the town's. */
  readonly careCamp: number;
  readonly careTown: number;
};

export type SiegeOutcome = "holds" | "stormed" | "starved";

/** What a siege's year comes to. */
export type SiegeStep = {
  readonly months: number;
  readonly breach: number;
  /** Of the camp, the share the year's sickness killed. */
  readonly campDead: number;
  /** Of the town, the share its crowding and hunger killed. */
  readonly townDead: number;
  readonly outcome: SiegeOutcome;
};

/** Of a camp, the share its sickness kills in a year: by the warmth of its ground, its crowding and its care. */
export function campSickness(men: number, warmth: number, care: number): number {
  const heat = dmath.clamp(dmath.pow(2, warmth / SIEGE.warmDoubles), 0.5, 2),
    crowd = dmath.clamp(
      1 + SIEGE.crowdStep * dmath.log10(Math.max(1, men) / SIEGE.crowdMid),
      0.25,
      2,
    );
  return SIEGE.camp * heat * crowd * (1 - dmath.clamp(care, 0, SIEGE.careMost));
}

/** How far a year of siege work opens the walls: by what the besiegers know and throw, against what the land knows of walls. */
export function breachYear(engines: number, fire: number, walls: number): number {
  return (
    (SIEGE.breach * (1 + Math.max(0, engines)) * (1 + SIEGE.fire * Math.max(0, fire))) /
    (1 + Math.max(0, walls))
  );
}

/** Months a seat's food keeps its people: what is in store over what they eat a month. */
export function storeMonths(stock: number, monthly: number): number {
  return monthly > 0 ? Math.max(0, stock / monthly) : 0;
}

/**
 * A siege's year, in which the besiegers again beat whoever came out against them. The seat eats a year of what it holds, less
 * what its walls grow and its ships bring. The walls open by a year's siege work. The camp and the town sicken, and the town
 * starves for the part of the year it has nothing. Stormed if the walls are open, else starved if its stores ran out, else it
 * holds.
 */
export function siegeStep(y: SiegeYear): SiegeStep {
  const inflow = SIEGE.within + (1 - SIEGE.within) * dmath.clamp(y.relief, 0, 1),
    months = y.months - 12 * (1 - inflow),
    breach = Math.min(1, y.breach + breachYear(y.engines, y.fire, y.walls)),
    gap = dmath.clamp(-months / 12, 0, 1),
    campDead = Math.min(1, campSickness(y.camp, y.warmth, y.careCamp)),
    townDead = Math.min(
      1,
      SIEGE.town *
        dmath.clamp(dmath.pow(2, y.warmth / SIEGE.warmDoubles), 0.5, 2) *
        (1 - dmath.clamp(y.careTown, 0, SIEGE.careMost)) +
        SIEGE.starve * gap,
    ),
    outcome: SiegeOutcome = breach >= 1 ? "stormed" : months <= 0 ? "starved" : "holds";
  return { months: Math.max(0, months), breach, campDead, townDead, outcome };
}
