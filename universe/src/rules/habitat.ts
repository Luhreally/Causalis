// Habitability (docs/architecture §25, Phase 5 M51): another body against the colonists'
// own body. What its ground lacks — air to breathe, pressure, warmth or cool, shelter
// from radiation, water in the form the people need, a pull their bodies can bear — they
// must build and keep up: sealed halls, pressure hulls, heaters, buried vaults, flooded
// vaults for a people of the water. Each lack is a yearly upkeep in machines for every
// settler; a body whose upkeep is past bearing is not settled at all.
import { dmath } from "../kernel/index.ts";
import type { BodyPlan } from "./bodies.ts";
import { affordancesOf } from "./bodies.ts";

/** A body's ground as a colony reads it. */
export type Ground = {
  readonly kind: string;
  readonly gravity: number;
  readonly pressure: number;
  readonly temperature: number;
  readonly radiation: number;
  readonly air: string;
  readonly water: string;
};

/** One thing the colony must build against its ground, and its yearly upkeep a settler (machines). */
export type Need = { readonly id: string; readonly words: string; readonly upkeep: number };

/** Past this upkeep a settler a year, a body is not worth settling. */
export const MOST_UPKEEP = 10;

export type Habitability = {
  readonly livable: boolean;
  readonly needs: readonly Need[];
  /** Machines a settler a year to keep them alive there. */
  readonly upkeep: number;
  readonly because: readonly string[];
};

/**
 * What the colonists must build to live on a body, from its ground and their own body
 * (null body: upright apes, as at home), against the home world's pull.
 */
export function habitability(g: Ground, body: BodyPlan | null, homeGravity: number): Habitability {
  if (g.kind === "giant" || g.kind === "ice giant" || g.kind === "home")
    return {
      livable: false,
      needs: [],
      upkeep: Infinity,
      because: [g.kind === "home" ? "the home world itself" : "a giant: no ground to build on"],
    };
  const needs: Need[] = [],
    a = body ? affordancesOf(body) : null,
    // How well the colonists bear cold and heat (upright apes: middling).
    cold = a?.cold ?? 0.55,
    heat = a?.heat ?? 0.7,
    sea = body?.medium === "water";
  // Every other world's air (if any) is not the home world's: it must be made.
  needs.push({ id: "air", words: "air made and kept in sealed halls", upkeep: 1 });
  if (g.pressure < 0.05)
    needs.push({
      id: "pressure",
      words: "halls held at pressure against the empty sky",
      upkeep: 1,
    });
  else if (g.pressure > 10)
    needs.push({ id: "hulls", words: "hulls against a crushing air", upkeep: 4 });
  // Warmth: the colder the ground, the more heating; those who bear cold need less.
  if (g.temperature < -40)
    needs.push({
      id: "heat",
      words: "halls heated against the cold",
      upkeep: ((Math.min(250, -g.temperature) - 40) / 100) * (1.3 - cold),
    });
  else if (g.temperature > 50)
    needs.push({
      id: "cool",
      words: "halls cooled against the heat",
      upkeep: ((Math.min(500, g.temperature) - 50) / 60) * (1.3 - heat),
    });
  if (g.radiation > 3)
    needs.push({
      id: "shelter",
      words: "halls buried against radiation",
      upkeep: Math.min(2, dmath.log10(g.radiation)),
    });
  // Water in the form the people need: a people of the water must fill its halls.
  if (sea)
    needs.push(
      g.water === "seas"
        ? { id: "sea", words: "its own seas to live in", upkeep: 0 }
        : g.water === "ice"
          ? { id: "flood", words: "vaults flooded with melted ice", upkeep: 1.5 }
          : { id: "carried", words: "every drop of water carried from elsewhere", upkeep: 6 },
    );
  else if (g.water === "none")
    needs.push({ id: "carried", words: "water carried from elsewhere", upkeep: 2.5 });
  else if (g.water === "ice")
    needs.push({ id: "melt", words: "water melted from its ice", upkeep: 0.3 });
  // A pull too weak or too strong for bodies grown under the home world's.
  const pull = g.gravity / homeGravity;
  if (pull < 0.1)
    needs.push({
      id: "weak",
      words: "a pull too weak for bones and blood: exercise, spun halls",
      upkeep: 0.8,
    });
  else if (pull > 1.5)
    needs.push({
      id: "strong",
      words: "a pull too strong: bodies worn by their own weight",
      upkeep: 1.5 * (pull - 1.5) + 0.5,
    });
  const upkeep = needs.reduce((s, n) => s + n.upkeep, 0);
  return {
    livable: upkeep <= MOST_UPKEEP,
    needs,
    upkeep,
    because: needs.filter((n) => n.upkeep > 0).map((n) => n.words),
  };
}
