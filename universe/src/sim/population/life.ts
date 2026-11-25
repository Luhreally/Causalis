// A world's people's life table (Phase 4 M37): derived from the body of the lineage
// that rose to thought there (rules/species.ts `lifeHistoryOf`), kept per generated
// world (a pure function of it, never saved).
import type { World } from "../../kernel/index.ts";
import { worldKindOf, type HomeWorld } from "../../gen/index.ts";
import {
  CLADES,
  dimorphismOf,
  HUMANLIKE,
  PAIRED,
  affordancesOf,
  boyRiskOf,
  evenOf,
  generationOf,
  hearthOf,
  oldBandOf,
  kindBurns,
  lifeHistoryOf,
  pairingOf,
  type Affordances,
  type BodyPlan,
  type LifeHistory,
  type Pairing,
} from "../../rules/index.ts";
import { homePlanet } from "../planet/store.ts";

const LIVES = new Map<string, LifeHistory>();

/** The life table of a body's people (the upright apes' where there is none): any people's of a world, by its own body. */
export function lifeOfBody(body: BodyPlan | null | undefined): LifeHistory {
  // (Its sexes as its kind pairs: how many more of the sires' young die, how far its births wait on a mate. The pairing reads
  // the coming of age the table itself takes, a fifteenth of seventy years of span.)
  // (How far its sexes' bodies differ comes of the contest that pairing sets: rules/roles.ts dimorphismOf.)
  const grown = body ? Math.max(1, Math.round((15 * body.span) / 70)) : 15,
    pairing = body ? pairingOf(body, grown) : null;
  return body && pairing
    ? lifeHistoryOf(body, boyRiskOf(dimorphismOf(body, grown)), PAIRED[pairing])
    : HUMANLIKE;
}

/** The life table of a generated world's people (the upright apes' where it has none). */
export function peopleLife(g: HomeWorld): LifeHistory {
  let life = LIVES.get(g.digest);
  if (!life) {
    life = lifeOfBody(g.life.people?.body);
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
    const body = affordancesOf(g.life.people?.body ?? CLADES.find((c) => c.id === "ape")!.body);
    // (Fire wants an air to burn in: none where nothing burns, whatever the hands — Phase 56.)
    a = kindBurns(worldKindOf(g)) ? body : { ...body, fire: false };
    if (AFFORDS.size > 64) AFFORDS.clear();
    AFFORDS.set(g.digest, a);
  }
  return a;
}

/** The life table of a world's people. */
export function lifeOf(world: World): LifeHistory {
  return peopleLife(homePlanet(world).generated);
}

type Kin = {
  readonly pairing: Pairing;
  readonly hearth: number;
  readonly even: number;
  /** The years of a generation (rules/houses.ts generationOf), and the first band of its old (rules/demography.ts oldBandOf). */
  readonly generation: number;
  readonly oldBand: number;
};
const KIN = new Map<string, Kin>();

/**
 * How a generated world's people pair, how many live at a hearth (rules/demography.ts hearthOf: four in a home of before, as
 * rules/dwelling.ts FAMILY_SIZE had it, came out near four for first light's apes), and the grown sires to a bearer its table
 * bears at (evenOf). Kept per world, a pure function of it.
 */
export function peopleKin(g: HomeWorld): Kin {
  let k = KIN.get(g.digest);
  if (!k) {
    const life = peopleLife(g),
      pairing = pairingOf(g.life.people?.body, life.adulthood);
    k = {
      pairing,
      hearth: hearthOf(life, pairing),
      even: evenOf(life),
      generation: generationOf(life),
      oldBand: oldBandOf(life),
    };
    if (KIN.size > 64) KIN.clear();
    KIN.set(g.digest, k);
  }
  return k;
}

/** The mouths of a hearth among a world's people. */
export function familySizeOf(world: World): number {
  return peopleKin(homePlanet(world).generated).hearth;
}
