// A world's people's life table (Phase 4 M37): derived from the body of the lineage
// that rose to thought there (rules/species.ts `lifeHistoryOf`), kept per generated
// world (a pure function of it, never saved).
import type { World } from "../../kernel/index.ts";
import type { HomeWorld } from "../../gen/index.ts";
import {
  CLADES,
  HUMANLIKE,
  affordancesOf,
  lifeHistoryOf,
  type Affordances,
  type LifeHistory,
} from "../../rules/index.ts";
import { homePlanet } from "../planet/store.ts";

const LIVES = new Map<string, LifeHistory>();

/** The life table of a generated world's people (the upright apes' where it has none). */
export function peopleLife(g: HomeWorld): LifeHistory {
  let life = LIVES.get(g.digest);
  if (!life) {
    life = g.life.people ? lifeHistoryOf(g.life.people.body) : HUMANLIKE;
    if (LIVES.size > 64) LIVES.clear();
    LIVES.set(g.digest, life);
  }
  return life;
}

const AFFORDS = new Map<string, Affordances>();

/** What a generated world's people's body can do (an upright ape's where it has none). */
export function peopleAffords(g: HomeWorld): Affordances {
  let a = AFFORDS.get(g.digest);
  if (!a) {
    a = affordancesOf(g.life.people?.body ?? CLADES.find((c) => c.id === "ape")!.body);
    if (AFFORDS.size > 64) AFFORDS.clear();
    AFFORDS.set(g.digest, a);
  }
  return a;
}

/** The life table of a world's people. */
export function lifeOf(world: World): LifeHistory {
  return peopleLife(homePlanet(world).generated);
}
