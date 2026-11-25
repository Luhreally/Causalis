// A world's life by what it is made of (Phase 57): read from its kind, its chemistry's classes, its
// star's warmth and its own, and one draw of its ground for which way its first chemistry turned —
// never the seed's stream, nothing generated after the ground. A pure read, kept by its ground, never
// stored and never in a hash: the biosphere and history stay as they were. An Earth-like world's is
// Earth's own (EARTH_LIFE). And the life of a people of another star: of water, as every world one
// rose on is (gen/civilizations.ts: worlds with seas), its hand a draw of their own.
import { finish, hashString, mix } from "../kernel/index.ts";
import {
  EARTH_LIFE,
  KINDS,
  PRIORS,
  depositProcessOn,
  fossilOrigin,
  lifeChemistryOf,
  oreWords,
  type LifeChemistry,
  type LifeInputs,
} from "../rules/index.ts";
import { worldKindOf } from "./bodies.ts";
import { worldChemistry } from "./chemistry.ts";
import type { HomeWorld } from "./homeworld.ts";

/**
 * How a deposit was made, in this world's own words (rules/genesis.ts): its coal and oil the buried growth of
 * whatever its life is built of, where its life is read from its physics and any took hold; its metals by what its
 * own crust holds of them and how far its ground gathered them. Earth's, and a world made by the old tables, as
 * they were told.
 */
export function depositMaking(
  g: HomeWorld,
  d: { readonly kind: string; readonly process: string },
): string {
  const chem = worldChemistry(g),
    base = depositProcessOn(chem, d.kind) ?? d.process;
  if (chem.solar) return base;
  if (d.kind === "coal" || d.kind === "oil") {
    if (!g.physical || !g.life.species.length) return base;
    const f = fossilOrigin(worldLife(g), KINDS[worldKindOf(g)].burns);
    return d.kind === "coal" ? `${f.solid}; ${f.solidWords}` : `${f.liquid}; ${f.liquidWords}`;
  }
  // (An ice world's lie under its crust, beyond any digging: no gathering is told of what no one reaches.)
  const ore = chem.kind === "ammonia" || chem.kind === "methane" ? null : oreWords(chem, d.kind);
  return ore ? `${base}: ${ore}` : base;
}

/** Which way a life's first chemistry turned: a draw in [0, 1) of its key (a world's ground, a people's ref). */
export function handDraw(key: string): number {
  return finish(mix(hashString(`life ${key}`), 1), 11) / 4294967296;
}

/** What a world's life is read from: its kind, its chemistry's classes, its star, its warmth, its hand (and its numbers, B3). */
export function lifeInputs(g: HomeWorld): LifeInputs {
  const chem = worldChemistry(g),
    kind = worldKindOf(g);
  // (A world of another star entered: its life read from what was read of it from afar, and its hand as it was.)
  if (g.far)
    return {
      kind,
      carbon: chem.carbon,
      metals: chem.metals,
      silica: chem.silica,
      star: g.star.temperature,
      mean: g.planet.meanTemperature,
      hand: g.far.hand,
    };
  return {
    ...(g.physical
      ? { numbers: { o2: KINDS[kind].burns ? chem.o2 : 0, acid: kind === "sulfur" } }
      : {}),
    kind,
    carbon: chem.carbon,
    metals: chem.metals,
    silica: chem.silica,
    star: g.star.temperature,
    mean: g.planet.meanTemperature,
    hand: handDraw(g.ground),
    // (Its seas acid itself, where its numbers make them so: rules/solvent.ts.)
    ...(g.planet.liquid === "sulfuric-acid" ? { vitriol: true } : {}),
  };
}

const KEPT = new Map<string, LifeChemistry>();

/** A world's life by what it is made of: Earth's own on an Earth-like world, else its own (kept by its ground). */
export function worldLife(g: HomeWorld): LifeChemistry {
  if ((PRIORS[g.prior]?.chemistry ?? "drawn") === "solar") return EARTH_LIFE;
  const key = g.physical ? `${g.ground} read` : g.ground,
    kept = KEPT.get(key);
  if (kept) return kept;
  const life = lifeChemistryOf(lifeInputs(g));
  KEPT.set(key, life);
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
