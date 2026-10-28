// The home planet as a piece of world state (docs/architecture §11, §24). Its
// facts are generated — a pure function of the seed and the prior — so they are
// never saved; what is saved are deviations from them (a mined-out deposit, a
// drowned coast, or a god's brush stroke). The generation digest is part of
// the planet domain's hash, so every checkpoint proves that every engine
// regenerated the same world.
import {
  World,
  Hasher,
  type Ref,
  type RetentionOptions,
  type Seed,
  type StateStore,
} from "../../kernel/index.ts";
import {
  generateHomeWorld,
  DEPOSIT_KINDS,
  PLANET_FREQUENCY,
  PROVINCE_FREQUENCY,
  provinceWorld,
  type ProvinceWorld,
} from "../../gen/index.ts";
import { PRIORS, type Prior } from "../../rules/index.ts";
import {
  readSurface,
  writeSurface,
  refreshSurface,
  surfaceDeposits,
  type SurfacePatch,
} from "./surface.ts";

export type BrushStroke = {
  event: Ref;
  kind: string;
  cells: number[];
  provinces: number[];
  t: number;
  dead: number;
};

export class HomePlanet implements StateStore {
  readonly name = "planet.home";
  /** The planet as its people live on it: provinces, each gathering the fine cells nearest it (`.fine` is the world as generated). */
  readonly generated: ProvinceWorld;
  readonly prior: Prior;
  private patches = new Map<number, SurfacePatch>();
  private originals = new Map<number, SurfacePatch>();
  private coarseOriginals = new Map<number, { ground: SurfacePatch; centre: number }>();
  private strokes: BrushStroke[] = [];
  private surfaceDigest = "";
  private readonly baseDeposits: number;

  get surfaceKey(): string {
    return this.surfaceDigest
      ? `${this.generated.digest}:${this.surfaceDigest}`
      : this.generated.digest;
  }
  brushStrokes(): readonly BrushStroke[] {
    return this.strokes;
  }
  recordStroke(stroke: BrushStroke): void {
    this.strokes.push(stroke);
  }
  surface(cell: number): SurfacePatch {
    return structuredClone(this.patches.get(cell) ?? readSurface(this.generated.fine, cell));
  }
  nextDeposit(): number {
    return this.generated.fine.deposits.length;
  }
  changeSurface(patches: readonly SurfacePatch[]): void {
    for (const p of patches) {
      if (!this.originals.has(p.cell))
        this.originals.set(p.cell, readSurface(this.generated.fine, p.cell));
      const province = this.generated.provinceOf[p.cell]!;
      if (!this.coarseOriginals.has(province))
        this.coarseOriginals.set(province, {
          ground: readSurface(this.generated, province),
          centre: this.generated.centre[province]!,
        });
    }
    for (const p of patches) {
      this.patches.set(p.cell, structuredClone(p));
      writeSurface(this.generated.fine, p);
    }
    refreshSurface(
      this.generated,
      patches.map((p) => p.cell),
    );
    const all = [...this.patches.values()].sort((a, b) => a.cell - b.cell);
    surfaceDeposits(this.generated, all, this.baseDeposits);
    this.surfaceDigest = all.length ? new Hasher().value(all).hex() : "";
  }

  constructor(seed: Seed, prior: Prior, frequency = PLANET_FREQUENCY) {
    this.prior = prior;
    this.generated = provinceWorld(
      generateHomeWorld(seed, prior, frequency),
      // About a tenth as many provinces as fine cells (fewer on a coarse test world).
      Math.max(2, Math.min(PROVINCE_FREQUENCY, Math.round(frequency / 3.2))),
    );
    this.baseDeposits = this.generated.fine.deposits.length;
  }

  hashInto(h: Hasher): void {
    h.string(this.prior.name).string(this.generated.digest);
    if (this.patches.size) h.value([...this.patches.values()].sort((a, b) => a.cell - b.cell));
    if (this.strokes.length) h.value(this.strokes);
  }

  save(): unknown {
    return {
      prior: this.prior.name,
      digest: this.generated.digest,
      deviations: [...this.patches.values()].sort((a, b) => a.cell - b.cell),
      ...(this.strokes.length ? { strokes: this.strokes } : {}),
    };
  }

  load(state: unknown): void {
    const s = state as {
      prior: string;
      digest: string;
      deviations?: SurfacePatch[];
      strokes?: BrushStroke[];
    };
    if (s.prior !== this.prior.name)
      throw new Error(`the save's planet used the ${s.prior} prior, not ${this.prior.name}`);
    if (s.digest !== this.generated.digest)
      throw new Error(
        `this game regenerates a different planet from the seed (${this.generated.digest}, saved ${s.digest})`,
      );
    const patches = s.deviations ?? [];
    if (!Array.isArray(patches) || patches.length > this.generated.fine.grid.count)
      throw new Error("invalid saved ground");
    for (const p of patches) {
      if (
        !p ||
        !Number.isInteger(p.cell) ||
        p.cell < 0 ||
        p.cell >= this.generated.fine.grid.count ||
        ![
          p.elevation,
          p.temperature,
          p.precipitation,
          p.seasonality,
          p.biome,
          p.river,
          p.lake,
          p.filled,
          p.discharge,
          p.beast,
          p.grass,
          p.diversity,
        ].every(Number.isFinite) ||
        !Array.isArray(p.present) ||
        p.present.length !== 3 ||
        !p.present.every(Number.isInteger)
      )
        throw new Error("invalid saved ground cell");
      if (
        p.ore &&
        (!DEPOSIT_KINDS.includes(p.ore.kind) ||
          !Number.isInteger(p.ore.index) ||
          p.ore.index < this.baseDeposits ||
          !Number.isFinite(p.ore.richness) ||
          p.ore.richness <= 0)
      )
        throw new Error("invalid saved ore");
    }
    const indices = patches.flatMap((p) => (p.ore ? [p.ore.index] : [])).sort((a, b) => a - b);
    if (indices.some((n, i) => n !== this.baseDeposits + i))
      throw new Error("invalid saved ore order");
    for (const p of this.originals.values()) writeSurface(this.generated.fine, p);
    for (const [cell, p] of this.coarseOriginals) {
      writeSurface(this.generated, p.ground);
      this.generated.centre[cell] = p.centre;
    }
    this.patches.clear();
    this.surfaceDigest = "";
    surfaceDeposits(this.generated, [], this.baseDeposits);
    this.changeSurface(patches);
    this.strokes = structuredClone(s.strokes ?? []);
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
