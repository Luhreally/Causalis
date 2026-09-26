// Ecology (docs/architecture §18, the sim era): each peopled land's living world as
// three stocks its people draw on and that heal when let be — the wild (game and wild
// food, against what the land held untouched), the forest (against its first cover),
// the soil (against its first strength). Foragers thin the wild; fields are cleared
// from the forest; farming wears the soil unless the land rests its fields in turn or
// dungs them. Each regrows toward its first state as the pressure eases. Where the wild
// runs thin the great beasts are hunted out; where the forest is gone, wood is scarce.
// What each stock stands at feeds the year's food, and each turn is history.
import {
  YEAR,
  Hasher,
  defineEventType,
  defineStream,
  dmath,
  yearOfMoment,
  type CauseRef,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { BIOME, isProvinceWorld, lives, type HomeWorld } from "../../gen/index.ts";
import { OCC, PRODUCTIVITY } from "../../rules/index.ts";
import type { Capacity } from "../population/model.ts";
import { provinceCapacity, type PopulationContext } from "../population/systems.ts";
import { loreOf } from "../lore/lore.ts";

const HUNT = defineStream("ecology.hunt");

export const ECOLOGY_EVENTS = {
  thinned: defineEventType("ecology.wild-thinned", 3),
  huntedOut: defineEventType("ecology.hunted-out", 4),
  cleared: defineEventType("ecology.forest-cleared", 3),
  worn: defineEventType("ecology.soil-worn", 3),
};

/** A land's living world: each stock against what it was before anyone took from it. */
export type Wilds = {
  readonly cell: number;
  /** The wild's game and food, the forest's cover and the soil's strength, 0..1 of their first. */
  wild: number;
  forest: number;
  soil: number;
  /** The forest the land had at first (a share of it), for the wood it gives. */
  readonly firstForest: number;
  /** The lineages hunted out of it (species indices). */
  lost: number[];
  /** The events of each stock's last turn for the worse (null once it has recovered). */
  thinned: Ref | null;
  cleared: Ref | null;
  worn: Ref | null;
};

export class EcologyStore implements StateStore {
  readonly name = "ecology.lands";
  private readonly map = new Map<number, Wilds>();

  get(cell: number): Wilds | undefined {
    return this.map.get(cell);
  }
  set(w: Wilds): void {
    this.map.set(w.cell, w);
  }
  all(): Wilds[] {
    return [...this.map.values()].sort((a, b) => a.cell - b.cell);
  }
  pinned(): Ref[] {
    const refs: Ref[] = [];
    for (const w of this.map.values())
      for (const r of [w.thinned, w.cleared, w.worn]) if (r) refs.push(r);
    return refs;
  }
  hashInto(h: Hasher): void {
    for (const w of this.all())
      h.int(w.cell)
        .float(w.wild)
        .float(w.forest)
        .float(w.soil)
        .value(w.lost)
        .string(w.thinned ?? "")
        .string(w.cleared ?? "")
        .string(w.worn ?? "");
  }
  save(): unknown {
    return { lands: this.all() };
  }
  load(state: unknown): void {
    this.map.clear();
    for (const w of (state as { lands: Wilds[] }).lands) this.set({ ...w, lost: [...w.lost] });
  }
}

export function ecologyOf(world: World): EcologyStore {
  return world.store<EcologyStore>("ecology.lands");
}

const FORESTS: ReadonlySet<number> = new Set([
  BIOME.borealForest,
  BIOME.temperateForest,
  BIOME.temperateRainforest,
  BIOME.tropicalDryForest,
  BIOME.tropicalRainforest,
]);

/** The share of a land that was forest before anyone cleared it. */
export function firstForest(g: HomeWorld, cell: number): number {
  if (!isProvinceWorld(g)) return FORESTS.has(g.climate.biome[cell]!) ? 1 : 0;
  let forest = 0,
    land = 0;
  for (let k = g.childOffsets[cell]!; k < g.childOffsets[cell + 1]!; k++) {
    const c = g.children[k]!,
      a = g.fine.grid.areas[c]!;
    if (g.fine.tectonics.elevation[c]! <= 0) continue;
    land += a;
    if (FORESTS.has(g.fine.climate.biome[c]!)) forest += a;
  }
  return land > 0 ? forest / land : 0;
}

/** How a land's living world stands (as it was at first where no one has touched it). */
export function wildsOf(ctx: PopulationContext, cell: number): Wilds {
  return (
    ecologyOf(ctx.world).get(cell) ?? {
      cell,
      wild: 1,
      forest: 1,
      soil: 1,
      firstForest: firstForest(ctx.generated, cell),
      lost: [],
      thinned: null,
      cleared: null,
      worn: null,
    }
  );
}

/** What a land feeds as its living world stands: the wild's food by the wild, fields by the soil. */
export function living(c: Capacity, w: Wilds): Capacity {
  return { ...c, forage: c.forage * w.wild, farm: c.farm * w.soil };
}

/** The wild's regrowth, a share of what is missing each year; the forest's; the soil's. */
const WILD_REGROWTH = 0.08,
  FOREST_REGROWTH = 0.02,
  SOIL_HEALING = 0.02;

/**
 * A year of a land's living world: the wild regrows and is hunted (`take`, what the
 * foragers eat against what the wild yields as it stands); the forest gives way to the fields (`farmed`, the
 * share of the land's farming in use) fast and comes back slowly; the soil wears under
 * the fields unless they are rested in turn or dunged (`rest`, 0..1), and heals where
 * they lie fallow.
 */
export function stepWilds(w: Wilds, take: number, farmed: number, rest: number): void {
  // A people living close to what the wild yields (taking more than three-fifths of it)
  // thin it, the more the harder they press; a wild pressed less grows back toward what
  // it was.
  const over = Math.max(0, take - 0.6);
  w.wild = Math.min(1, Math.max(0.05, w.wild + WILD_REGROWTH * (1 - w.wild) - 0.5 * over * w.wild));
  // And the fields take the wild's own ground: where most of a land is farmed, little
  // is left for game.
  w.wild = Math.max(0.05, Math.min(w.wild, 1 - 0.8 * farmed));
  // The forest gives way to the fields fast, and comes back slowly.
  const standing = 1 - farmed;
  w.forest =
    standing < w.forest
      ? standing
      : Math.min(standing, w.forest + FOREST_REGROWTH * (1 - w.forest));
  w.soil = Math.min(
    1,
    Math.max(
      0.3,
      w.soil - 0.01 * farmed * (1 - Math.min(1, rest)) + SOIL_HEALING * (1 - w.soil) * (1 - farmed),
    ),
  );
}

/** The ecology's year: each stock drawn on and healing; its turns for the worse told. */
export function ecologyYear(ctx: PopulationContext, t: SimTime): void {
  const { world, generated: g } = ctx,
    store = ecologyOf(world),
    lore = loreOf(world),
    year = yearOfMoment(t);
  for (const p of ctx.provinces.all()) {
    const pop = p.total();
    if (!pop) continue;
    const w = wildsOf(ctx, p.cell),
      c = provinceCapacity(ctx, p.cell),
      // What the foragers take of what the wild yields, and how much of the land's
      // farming its fields use.
      // The share of what the wild yields as it stands that the foragers gather (as the
      // year's food reckons it: the more gatherers, the less each finds).
      take =
        1 -
        dmath.exp(
          -(p.occupation(OCC.forager) * PRODUCTIVITY[OCC.forager]! * ctx.life.appetite) /
            Math.max(1, c.forage * w.wild),
        ),
      farmed = Math.min(
        1,
        (p.occupation(OCC.farmer) * PRODUCTIVITY[OCC.farmer]! * ctx.life.appetite) /
          Math.max(1, c.farm),
      ),
      rest = (lore.get(p.cell, "rotation") ? 0.6 : 0) + (lore.get(p.cell, "manuring") ? 0.4 : 0);
    stepWilds(w, take, farmed, rest);
    store.set(w);

    // Their turns for the worse, told once (and again only after they recover).
    const causes = (...refs: (Ref | null)[]): CauseRef[] =>
      refs.flatMap((r, i) =>
        r
          ? [
              {
                ref: r,
                role: i === 0 ? "trigger" : "enabler",
                weight: i === 0 ? 0.7 : 0.3,
              } as CauseRef,
            ]
          : [],
      );
    if (w.wild < 0.4 && !w.thinned)
      w.thinned = world.events.emit({
        type: ECOLOGY_EVENTS.thinned.type,
        place: p.ref,
        causes: causes(p.arrival, p.ref),
        data: { wild: Math.round(w.wild * 100) },
      });
    else if (w.wild > 0.7 && w.thinned) w.thinned = null;
    if (w.firstForest > 0.2 && w.forest < 0.3 && !w.cleared)
      w.cleared = world.events.emit({
        type: ECOLOGY_EVENTS.cleared.type,
        place: p.ref,
        causes: causes(p.cultivation, p.ref),
        data: { forest: Math.round(w.forest * 100) },
      });
    else if (w.forest > 0.6 && w.cleared) w.cleared = null;
    if (w.soil < 0.7 && !w.worn)
      w.worn = world.events.emit({
        type: ECOLOGY_EVENTS.worn.type,
        place: p.ref,
        causes: causes(p.cultivation, p.ref),
        data: { soil: Math.round(w.soil * 100) },
      });
    else if (w.soil > 0.9 && w.worn) w.worn = null;
    // The great beasts breed so slowly that steady hunting takes them long before food runs
    // short: a land hunted at over a third of what its wild yields loses them, year by year.
    if (take > 0.35)
      for (const s of g.life.species) {
        if (s.niche !== "great beast" || s.died !== null || w.lost.includes(s.index)) continue;
        if (!lives(g.life, p.cell, s.index)) continue;
        if (!(world.rng.real(HUNT, p.cell, t, s.index) < 0.15)) continue;
        w.lost = [...w.lost, s.index].sort((a, b) => a - b);
        world.events.emit({
          type: ECOLOGY_EVENTS.huntedOut.type,
          subjects: [s.ref as Ref],
          place: p.ref,
          causes: causes(w.thinned, s.ref as Ref),
          data: { beast: s.name, year },
        });
      }
  }
}

/** Teach a peopled world its ecology. */
export function installEcology(world: World, ctx: () => PopulationContext): EcologyStore {
  const store = world.register(new EcologyStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "115.ecology.year", every: YEAR, run: (t) => ecologyYear(ctx(), t) });
  return store;
}
