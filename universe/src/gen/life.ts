// A world's life by what it is made of (Phase 57): read from its kind, its chemistry's classes, its
// star's warmth and its own, and one draw of its ground for which way its first chemistry turned —
// never the seed's stream, nothing generated after the ground. A pure read, kept by its ground, never
// stored and never in a hash: the biosphere and history stay as they were. An Earth-like world's is
// Earth's own (EARTH_LIFE). And the life of a people of another star: of water, as every world one
// rose on is (gen/civilizations.ts: worlds with seas), its hand a draw of their own.
import { finish, hashString, mix } from "../kernel/index.ts";
import {
  EARTH_LIFE,
  PRIORS,
  lifeChemistryOf,
  type LifeChemistry,
  type LifeInputs,
} from "../rules/index.ts";
import { worldKindOf } from "./bodies.ts";
import { worldChemistry } from "./chemistry.ts";
import type { HomeWorld } from "./homeworld.ts";

/** Which way a life's first chemistry turned: a draw in [0, 1) of its key (a world's ground, a people's ref). */
export function handDraw(key: string): number {
  return finish(mix(hashString(`life ${key}`), 1), 11) / 4294967296;
}

/** What a world's life is read from: its kind, its chemistry's classes, its star, its warmth, its hand. */
export function lifeInputs(g: HomeWorld): LifeInputs {
  const chem = worldChemistry(g);
  return {
    kind: worldKindOf(g),
    carbon: chem.carbon,
    metals: chem.metals,
    silica: chem.silica,
    star: g.star.temperature,
    mean: g.planet.meanTemperature,
    hand: handDraw(g.ground),
  };
}

const KEPT = new Map<string, LifeChemistry>();

/** A world's life by what it is made of: Earth's own on an Earth-like world, else its own (kept by its ground). */
export function worldLife(g: HomeWorld): LifeChemistry {
  if ((PRIORS[g.prior]?.chemistry ?? "drawn") === "solar") return EARTH_LIFE;
  const kept = KEPT.get(g.ground);
  if (kept) return kept;
  const life = lifeChemistryOf(lifeInputs(g));
  KEPT.set(g.ground, life);
  if (KEPT.size > 16) KEPT.delete(KEPT.keys().next().value!);
  return life;
}

/**
 * The life of a people of another star: of water and oxygen, as a world with seas under a living
 * star's is, its pigment its star's (`star`, K), its hand a draw of their own.
 */
export function civLife(civ: { readonly ref: string }, star: number): LifeChemistry {
  return lifeChemistryOf({
    kind: "rocky",
    carbon: "oxide",
    metals: "solar",
    silica: "solar",
    star,
    mean: 15,
    hand: handDraw(civ.ref),
  });
}
