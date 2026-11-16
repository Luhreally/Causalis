// What a faith holds, and what holding it does (asked 2026-11-15: "is every political, physics, econonmy etc thing covered down to
// first principles", where a faith's tenet was a name and nothing else: eight tenets that did nothing, and devotion that crept up
// a twentieth of a hundredth a year under any faith alike). A faith's creed is what its founders took the power behind the world
// to be, and what they held themselves:
//   the power: what the omen that founded it was of. A power that harms (sickness, hunger, fire) is feared: a people under it
//     keeps to what wards it off (custom, thrift) and is wary of strangers, who bring sickness; a power that gives (rain, plenty,
//     healing) is thanked at feasts, among kin, by sharing; a power that knows (teaching) is followed by learning, against custom,
//     and holds its teaching written; a power that walks among them sets those it walks with over the rest.
//   its founders: what marked them when it was founded is hallowed by it (a quarter of how far each of their ways lay from the
//     middle): a faith of a warlike people hallows valour, of a trading people trade.
// Held for a generation, a creed is most of the way to being who a people are: its pull on their ways grows as a land has held it.
// Pure tables and functions.
import { dmath } from "../kernel/index.ts";
import { WAY_TRAITS, type WayTrait } from "./ways.ts";

/** What a faith may hold the power behind the world to do: harm, give, know, walk among them. */
export const POWERS = ["harms", "gives", "knows", "near"] as const;
export type Power = (typeof POWERS)[number];

/** Each power's pull on a people's ways (rules/ways.ts WAY_TRAITS), at a creed held for generations. */
export const POWER_LEANS: Readonly<Record<Power, Partial<Record<WayTrait, number>>>> = {
  harms: { piety: 0.08, tradition: 0.06, thrift: 0.04, openness: -0.05 },
  gives: { piety: 0.04, kinship: 0.03, trade: 0.02, thrift: -0.05 },
  knows: { piety: 0.02, tradition: -0.06, openness: 0.04 },
  near: { piety: 0.06, hierarchy: 0.06, valour: 0.03 },
};

/** What each tenet holds the power to be (sim/belief/belief.ts TENETS), in shares of the four. */
export const TENET_POWERS: Readonly<Record<string, Partial<Record<Power, number>>>> = {
  rain: { gives: 0.6, harms: 0.4 },
  plenty: { gives: 1 },
  sickness: { harms: 1 },
  healing: { gives: 0.7, near: 0.3 },
  teaching: { knows: 1 },
  presence: { near: 1 },
  hunger: { harms: 0.8, gives: 0.2 },
  fire: { harms: 1 },
};

export const CREED = {
  /** Of how far a founders' way lay from the middle, the share their faith hallows. */
  founders: 0.25,
  /** A generation of an upright ape, years: a creed held so long draws its land's ways half the way it will. */
  generation: 25,
} as const;

/** A creed: its pull on each way, in hundredths (as a faith keeps it), from its tenet and its founders' ways. */
export function creedOf(tenet: string, founders: readonly number[] | null): number[] {
  const powers = TENET_POWERS[tenet] ?? {};
  return WAY_TRAITS.map((t, k) => {
    let v = 0;
    for (const p of POWERS) v += (powers[p] ?? 0) * (POWER_LEANS[p][t] ?? 0);
    if (founders) v += CREED.founders * (founders[k]! - 0.5);
    return Math.round(v * 100);
  });
}

/** How far a creed draws a land that has held it `years` (0 … 1): half the way in a generation of theirs. */
export function creedHeld(years: number, span: number): number {
  const generation = (CREED.generation * Math.max(5, span)) / 70;
  return 1 - dmath.pow(0.5, Math.max(0, years) / generation);
}

/** How far a faith holds its teaching written (0 … 1): a power that knows, wholly; others as far as they hold it knows. */
export function scriptureOfTenet(tenet: string): number {
  return TENET_POWERS[tenet]?.knows ?? 0;
}

/** A power's words, as a page says what a faith holds. */
export const POWER_WORDS: Readonly<Record<Power, string>> = {
  harms: "a power that harms, to be warded off",
  gives: "a power that gives, to be thanked",
  knows: "a power that knows, to be learned from",
  near: "a power that walks among them",
};
