// The home planet as a piece of world state (docs/architecture §11, §24). Its
// facts are generated — a pure function of the seed and the prior — so they are
// never saved; what is saved are deviations from them (a mined-out deposit, a
// drowned coast), of which there are none yet. The generation digest is part of
// the planet domain's hash, so every checkpoint proves that every engine
// regenerated the same world.
import {
  World,
  type Hasher,
  type RetentionOptions,
  type Seed,
  type StateStore,
} from "../../kernel/index.ts";
import { generateHomeWorld, PLANET_FREQUENCY, type HomeWorld } from "../../gen/index.ts";
import { PRIORS, type Prior } from "../../rules/index.ts";

export class HomePlanet implements StateStore {
  readonly name = "planet.home";
  readonly generated: HomeWorld;
  readonly prior: Prior;

  constructor(seed: Seed, prior: Prior, frequency = PLANET_FREQUENCY) {
    this.prior = prior;
    this.generated = generateHomeWorld(seed, prior, frequency);
  }

  hashInto(h: Hasher): void {
    h.string(this.prior.name).string(this.generated.digest);
  }

  save(): unknown {
    return { prior: this.prior.name, digest: this.generated.digest, deviations: [] };
  }

  load(state: unknown): void {
    const s = state as { prior: string; digest: string };
    if (s.prior !== this.prior.name)
      throw new Error(`the save's planet used the ${s.prior} prior, not ${this.prior.name}`);
    if (s.digest !== this.generated.digest)
      throw new Error(
        `this game regenerates a different planet from the seed (${this.generated.digest}, saved ${s.digest})`,
      );
  }
}

export type PlanetWorldOptions = {
  readonly prior?: Prior;
  readonly frequency?: number;
  /** What history keeps (docs/architecture §32). */
  readonly retention?: RetentionOptions;
};

/** A world holding only its home planet (Phase 1 builds people and places on it). */
export function makePlanetWorld(seed: Seed, options: PlanetWorldOptions = {}): World {
  const world = new World(seed, options.retention ? { retention: options.retention } : {});
  world.register(new HomePlanet(seed, options.prior ?? PRIORS.earthlike!, options.frequency));
  return world;
}

export function homePlanet(world: World): HomePlanet {
  return world.store<HomePlanet>("planet.home");
}
