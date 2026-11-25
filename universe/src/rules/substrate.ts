// What a principle is found from (gaps round, 2026-11-24: "derive each principle's reachability and order from prerequisites in
// the world: what matter, energy density, instruments and surplus a people has"). The tree (rules/principles.ts) says what must
// be known first and who is at the trade a thing is found in; this says how readily a land that could find it does, by what
// it has to find it WITH. Each is a figure the land already keeps, and each bends a principle's chance of being found there
// in a year (sim/lore/lore.ts loreYear), never its place in the tree:
//   matter: a craft found by an ore is found the more readily by a land with the ore in its own ground, the less by one
//     that has it from a neighbour or a road (the ore's own driver, read for how near it lies);
//   heat: where nothing burns, a craft that asks a heat is found the more readily the further the land's hottest means
//     passes it (a world that burns has the old road: any heat, with the craft);
//   energy density: what drives works and engines is found the more readily where the richest fuel at hand holds more heat
//     a kilogram in that world's air (coal in a market against wood alone; rules/fuels.ts), the less where it has none;
//   surplus: what is found by those not at winning food and lies deep enough to be specialists' work, by the share of a
//     land's hands its food leaves free (a craft that rests on nothing is its makers' own, beside their food);
//   what is met: what of healing is found by looking through an instrument (the seeds of sickness, and what grows straight
//     from knowing them) by the sickness a land has met and the share of its people who can read what was seen. A land that
//     never met a sickness has nothing to look at; one that has buried thousands and writes it down has much.
// Which of these a principle answers to is read from the principle itself (its effects, its needs, its drivers, its field),
// never listed by name. What remains authored: the tree's needs, each principle's own rate and drivers, and the reference
// each force is measured against (marked est).
// Pure tables and functions.
import { dmath } from "../kernel/index.ts";
import { MEASURING } from "./letters.ts";
import { FUNCTIONS, PRINCIPLES, PRINCIPLE_DEPTH, fieldOf, type Principle } from "./principles.ts";

export const SUBSTRATE = {
  /** An ore in a land's own ground against one a neighbour or a road gives it: so much more, and less, readily. */
  oreOwn: 1.2,
  oreNear: 0.85,
  /** Heat: how much more readily at twice the heat asked, or more (where nothing burns). */
  heatMost: 1.5,
  /**
   * Energy density: the richest fuel at hand (MJ/kg in its air, rules/fuels.ts) against this, within these bounds (est: between
   * air-dried wood's 12 and coal's 26, so a land with only wood finds what engines ask the less readily and one with coal the
   * more; a land with nothing to burn, on a world that burns, the least).
   */
  fuelMj: 18,
  energyLeast: 0.75,
  energyMost: 1.5,
  /**
   * Surplus: the share of a land's hands not at winning food, against this (est: a fifth, a farming land with towns: first
   * light's lands stand at a ninth of their hands at year 50, a fifth at 300, over a third at 450), within these bounds.
   */
  /** Up to this depth a craft is its makers' own, beside their food; from `specialists` it is wholly specialists' (est). */
  ownHands: 1,
  specialists: 4,
  spare: 0.2,
  spareLeast: 0.8,
  spareMost: 1.25,
  /**
   * What is met: a land's dead of sickness times the share of its people who read, against this many (est: a hundred deaths
   * set down by those who saw them), within these bounds. Steep: a hundredfold between a land that met none and one that
   * buried thousands, so that what is found follows the sickness met and not which land the draw fell on.
   */
  seen: 100,
  seenLeast: 0.1,
  seenMost: 10,
} as const;

/** What a land has to find things with: each a figure it already keeps. */
export type SubstrateFacts = {
  /** The hottest its means reach (°C), where nothing burns; true where its world burns (no bound). */
  readonly reach: number | boolean;
  /** The heat a kilogram of the richest fuel at hand gives in its air (MJ/kg; 0: none at hand; -1: nothing burns on its world). */
  readonly fuelMj: number;
  /** The share of its hands not at winning food (0 … 1). */
  readonly spare: number;
  /** Its dead of sickness, ever, and the share of its people who read. */
  readonly sickDead: number;
  readonly readers: number;
};

/** Which forces a principle answers to, read from the principle. */
export type SubstrateAsks = {
  readonly energy: boolean;
  readonly surplus: boolean;
  /**
   * How far it is specialists' work (0 … 1), by how deep it lies in the tree (PRINCIPLE_DEPTH): a craft that rests on nothing
   * or on one thing is found by those who win their own food (a forager shapes wood and nets fish), and surplus bends nothing
   * of it; one that rests on four things deep or more is found by those whose food others win.
   */
  readonly specialists: number;
  readonly met: boolean;
};

const ENGINE_IDS: ReadonlySet<string> = new Set([
  ...FUNCTIONS["@engine"]!,
  ...FUNCTIONS["@works"]!,
]);

/**
 * An instrument: a means to measure (rules/letters.ts MEASURING) that is a made thing, found at a craft (a lens, a clock, a
 * current), not a reckoning found by those who rule or trade (a calendar, the stars' courses).
 */
function instrument(id: string): boolean {
  const d = PRINCIPLES.find((x) => x.id === id)?.drivers;
  return (
    MEASURING.has(id) && !!d && (d.crafters ?? 0) >= Math.max(d.leaders ?? 0, d.traders ?? 0, 1e-9)
  );
}

/**
 * Whether a principle of healing is found by looking at what is met: it needs an instrument itself, or grows straight from
 * one of healing that does (vaccination from the seeds of sickness seen).
 */
function looksAt(p: Principle, seen = new Set<string>()): boolean {
  if (fieldOf(p) !== "healing") return false;
  for (const need of p.needs)
    for (const id of need.split("|")) {
      if (instrument(id)) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      const q = PRINCIPLES.find((x) => x.id === id);
      if (q && looksAt(q, seen)) return true;
    }
  return false;
}

function asksOf(p: Principle): SubstrateAsks {
  const d = p.drivers,
    food = (d.farmers ?? 0) + (d.herders ?? 0) + (d.famine ?? 0),
    others = (d.crafters ?? 0) + (d.leaders ?? 0) + (d.traders ?? 0);
  return {
    energy:
      (p.effects.power ?? 0) > 0 ||
      (p.effects.industry ?? 0) > 0 ||
      p.needs.some((n) => n.split("|").some((id) => ENGINE_IDS.has(id))),
    surplus: others > food,
    specialists: dmath.clamp(
      ((PRINCIPLE_DEPTH.get(p.id) ?? 0) - SUBSTRATE.ownHands) /
        (SUBSTRATE.specialists - SUBSTRATE.ownHands),
      0,
      1,
    ),
    met: looksAt(p),
  };
}

/** Each principle's asking, read once. */
export const SUBSTRATE_ASKS: ReadonlyMap<string, SubstrateAsks> = new Map(
  PRINCIPLES.map((p) => [p.id, asksOf(p)]),
);

/** One force on a finding: what it was, the figure read, and how far it bent the chance (1: not at all). */
export type SubstratePart = { readonly name: string; readonly value: number; readonly k: number };

/** (A list kept for the answer: read at once by its caller.) */
const PARTS: SubstratePart[] = [];

/**
 * How readily a land finds a principle by what it has to find it with, against a land of the reference (1), and each force's
 * part. `ore`: how near its driver's ore lies (1 its own ground, less a neighbour's or a road's; null: it asks none). `heat`:
 * the heat it asks on this world (°C; undefined: none).
 */
export function substrateOf(
  p: Principle,
  f: SubstrateFacts,
  ore: number | null,
  heat?: number,
): { readonly k: number; readonly parts: readonly SubstratePart[] } {
  const asks = SUBSTRATE_ASKS.get(p.id);
  PARTS.length = 0;
  let k = 1;
  const part = (name: string, value: number, by: number) => {
    k *= by;
    if (Math.abs(by - 1) >= 0.05) PARTS.push({ name, value, k: by });
  };
  if (ore !== null)
    part(
      ore >= 1 ? "its ore in its own ground" : "its ore from a neighbour or a road",
      ore,
      ore >= 1 ? SUBSTRATE.oreOwn : SUBSTRATE.oreNear,
    );
  if (heat !== undefined && heat > 0 && typeof f.reach === "number" && f.reach > 0)
    part(
      "a heat well past what it asks",
      Math.round(f.reach),
      1 + (SUBSTRATE.heatMost - 1) * dmath.clamp(f.reach / heat - 1, 0, 1),
    );
  if (asks?.energy && f.fuelMj >= 0)
    part(
      f.fuelMj > 0 ? "the heat in the fuel at hand" : "no fuel at hand",
      Math.round(f.fuelMj * 10) / 10,
      dmath.clamp(f.fuelMj / SUBSTRATE.fuelMj, SUBSTRATE.energyLeast, SUBSTRATE.energyMost),
    );
  if (asks?.surplus && asks.specialists > 0)
    part(
      "hands its food leaves free",
      Math.round(f.spare * 100) / 100,
      1 +
        asks.specialists *
          (dmath.clamp(f.spare / SUBSTRATE.spare, SUBSTRATE.spareLeast, SUBSTRATE.spareMost) - 1),
    );
  if (asks?.met) {
    const seen = f.sickDead * f.readers;
    part(
      "the sickness it has met and set down",
      Math.round(seen),
      dmath.clamp(seen / SUBSTRATE.seen, SUBSTRATE.seenLeast, SUBSTRATE.seenMost),
    );
  }
  return { k, parts: PARTS };
}
