// A world's people's life table (Phase 4 M37): derived from the body of the lineage
// that rose to thought there (rules/species.ts `lifeHistoryOf`), kept per generated
// world (a pure function of it, never saved).
import type { World } from "../../kernel/index.ts";
import type { HomeWorld } from "../../gen/index.ts";
import { HUMANLIKE, lifeHistoryOf, type LifeHistory } from "../../rules/index.ts";
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

/** The life table of a world's people. */
export function lifeOf(world: World): LifeHistory {
  return peopleLife(homePlanet(world).generated);
}
