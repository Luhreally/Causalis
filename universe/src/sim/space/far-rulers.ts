// Who leads a people of another star (the audit's "a far people's inner actors": a far people was one actor, with no one inside
// it until its world was entered). A far people is kept coarsely (gen/civilizations.ts: its body, its pace, its years), and so is
// who leads it: nothing is stored. A reign and the house that holds its seat are read off the people alone and the year, the
// same each time, as its nature is (sim/space/peoples.ts peopleNature):
//   a reign lasts as its people's lives do: about three tenths of their body's span, each its own length;
//   who leads is one of them, named in their own sounds; a people whose bodies live as one (rules keepsPersons) is led by a
//     line of them, not one body;
//   the seat passes within a house until another takes it: at each passing, about one time in five; a house is named for the
//     one who first took the seat for it;
//   who leads matters: each has a bent of their own (a little more or less curious, wary, bold, given to trade than their
//     people), and the people's nature while they lead is its own and theirs together. So a people is bolder under one ruler
//     and warier under the next, and what it sends and how it meets others turns with the reign.
// Before a people has seats at all (before its chronicle begins) no one leads it. O(1) to read a reign; a house is found by
// walking back its few reigns. No state, no events of its own: a meeting or a fleet's page tells under whom it came.
import { defineStream, parseRef, type World } from "../../kernel/index.ts";
import { civBody, civWord, type Civilization } from "../../gen/index.ts";
import { keepsPersons } from "../../rules/index.ts";

const RULE = defineStream("space.farrulers");

export const FAR_RULE = {
  /** A reign's usual length, as a share of the people's span; and the least, in years. */
  reign: 0.3,
  least: 6,
  /** The chance at a passing that another house takes the seat. */
  passes: 0.2,
  /** How far one who leads bends their people's nature, at the most, either way. */
  bent: 0.1,
  /** How far back a house is looked for before it is taken as old as the reckoning goes (reigns). */
  back: 40,
} as const;

/** One who leads a far people. */
export type FarRuler = {
  /** Which reign of their people's chronicle this is (0: the first). */
  readonly reign: number;
  readonly name: string;
  /** A line of a people whose bodies live as one, not one body. */
  readonly many: boolean;
  /** The years (in the home chronicle) the reign runs from and to. */
  readonly since: number;
  readonly until: number;
  /** Their bent, each -FAR_RULE.bent … +FAR_RULE.bent: curious, wary, bold, given to trade. */
  readonly bent: readonly [number, number, number, number];
};

/** The house that holds a far people's seat. */
export type FarHouse = {
  readonly name: string;
  /** The reign it took the seat in, the year, and how many of it have led since. */
  readonly from: number;
  readonly since: number;
  readonly reigns: number;
  /** Whether it is as old as their reckoning goes (its taking of the seat is not known). */
  readonly old: boolean;
};

const keyOf = (civ: Civilization): number => {
  const { a, b } = parseRef(civ.ref);
  return (a * 4096 + b) >>> 0;
};

/** A reign's length for a people (years), and the year reign k begins. */
function reignLength(civ: Civilization): number {
  const span = civBody(civ)?.span ?? 70;
  return Math.max(FAR_RULE.least, Math.round(span * FAR_RULE.reign));
}
function beginsAt(world: World, civ: Civilization, k: number, length: number): number {
  // (Each reign begins up to half a reign late: none is the same length as the last.)
  const late = k > 0 ? Math.floor(world.rng.real(RULE, keyOf(civ), k, 0) * 0.5 * length) : 0;
  return Math.ceil(civ.offset) + k * length + late;
}

/** Who leads a far people in a year (null: before its chronicle begins, or it has no years at all). */
export function farRulerOf(world: World, civ: Civilization, year: number): FarRuler | null {
  if (!Number.isFinite(civ.offset) || year < Math.ceil(civ.offset)) return null;
  const length = reignLength(civ);
  let k = Math.floor((year - Math.ceil(civ.offset)) / length);
  if (year < beginsAt(world, civ, k, length)) k--;
  if (k < 0) k = 0;
  const key = keyOf(civ),
    u = (n: number) => world.rng.real(RULE, key, k, n),
    bend = (n: number) => Math.round((2 * u(n) - 1) * FAR_RULE.bent * 1000) / 1000;
  return {
    reign: k,
    name: civWord(world.rng, civ, 1000 + k),
    many: !keepsPersons(civBody(civ)?.social),
    since: beginsAt(world, civ, k, length),
    until: beginsAt(world, civ, k + 1, length),
    bent: [bend(1), bend(2), bend(3), bend(4)],
  };
}

/** Whether another house took the seat at the beginning of reign k. */
const tookSeat = (world: World, civ: Civilization, k: number): boolean =>
  k > 0 && world.rng.real(RULE, keyOf(civ), k, 9) < FAR_RULE.passes;

/** The house that holds a far people's seat in a year (null: no one leads it yet). */
export function farHouseOf(world: World, civ: Civilization, year: number): FarHouse | null {
  const ruler = farRulerOf(world, civ, year);
  if (!ruler) return null;
  let from = ruler.reign,
    old = false;
  while (from > 0 && !tookSeat(world, civ, from)) {
    if (ruler.reign - from >= FAR_RULE.back) {
      old = true;
      break;
    }
    from--;
  }
  return {
    // (Named for the one who first took the seat for it.)
    name: civWord(world.rng, civ, 1000 + from),
    from,
    since: beginsAt(world, civ, from, reignLength(civ)),
    reigns: ruler.reign - from + 1,
    old,
  };
}
