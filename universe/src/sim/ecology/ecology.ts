// Ecology (docs/architecture §18, the sim era): each peopled land's living world as
// three stocks its people draw on and that heal when let be — the wild (game and wild
// food, against what the land held untouched), the forest (against its first cover),
// the soil (against its first strength). Foragers thin the wild; fields are cleared
// from the forest; farming wears the soil unless the land rests its fields in turn or
// dungs them. Each regrows toward its first state as the pressure eases. Where the wild
// runs thin the great beasts are hunted out; where the forest is gone, wood is scarce.
// Beside the game stand its hunters (Phase 8 M77): the land's own hunting lineage, as
// many as its game can keep — fewer as the game is thinned, fewer still under a people
// who hunt them and guard their flocks from them, and driven out where they press hard;
// where they are about, they take a share of the flocks.
// And the rest of the web of eating (Phase 9 M84), each level set by what it eats and
// pressed by what eats it: the small game of the ground and the fields, the small hunters
// that live on it (and that farmers and herders drive off), the scavengers that live on
// the kills and the dead, the water's life. Where a level's hunters are gone, it grows
// past what it was: the game multiplies and browses the woods back; the small game eats
// the grain. Fished hard, the waters give less.
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
import { BIOME, isProvinceWorld, lives, offworldSite, type HomeWorld } from "../../gen/index.ts";
import { OCC, PRODUCTIVITY } from "../../rules/index.ts";
import type { Capacity } from "../population/model.ts";
import { provinceCapacity, type PopulationContext } from "../population/systems.ts";
import { loreOf } from "../lore/lore.ts";

const HUNT = defineStream("ecology.hunt");

export const ECOLOGY_EVENTS = {
  thinned: defineEventType("ecology.wild-thinned", 3),
  huntedOut: defineEventType("ecology.hunted-out", 4),
  huntersGone: defineEventType("ecology.hunters-gone", 4),
  flocksTaken: defineEventType("ecology.flocks-taken", 3),
  cleared: defineEventType("ecology.forest-cleared", 3),
  worn: defineEventType("ecology.soil-worn", 3),
  multiplied: defineEventType("ecology.game-multiplied", 3),
  grainEaten: defineEventType("ecology.grain-eaten", 3),
  fishFew: defineEventType("ecology.fish-few", 3),
  scavengersLeft: defineEventType("ecology.scavengers-left", 3),
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
  /** The land's hunting lineage (a species index, -1 none), and its hunters against as many as its untouched game kept. */
  readonly hunter: number;
  hunters: number;
  /** The event of the flocks' losses to the hunters turning heavy (null once they ease). */
  flocksTaken: Ref | null;
  /** The event of the land's hunters being driven out (null while they stand). */
  huntersLeft: Ref | null;
  /**
   * The web's other levels (M84), each against what it was untouched — more where what
   * eats it is gone: the small game of the ground and the fields; the land's small-hunting
   * lineage (-1 none) and its number; its scavenging lineage and theirs; the water's life
   * (-1 where the land has no water).
   */
  small: number;
  readonly lesserOf: number;
  lesser: number;
  readonly scavengerOf: number;
  carrion: number;
  fish: number;
  /** The events of the game multiplying, the grain eaten, the fish grown few (null once eased). */
  multiplied: Ref | null;
  grainEaten: Ref | null;
  fishFew: Ref | null;
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
      for (const r of [
        w.thinned,
        w.cleared,
        w.worn,
        w.flocksTaken,
        w.huntersLeft,
        w.multiplied,
        w.grainEaten,
        w.fishFew,
      ])
        if (r) refs.push(r);
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
        .string(w.worn ?? "")
        .int(w.hunter)
        .float(w.hunters)
        .string(w.flocksTaken ?? "")
        .string(w.huntersLeft ?? "")
        .float(w.small)
        .int(w.lesserOf)
        .float(w.lesser)
        .int(w.scavengerOf)
        .float(w.carrion)
        .float(w.fish)
        .string(w.multiplied ?? "")
        .string(w.grainEaten ?? "")
        .string(w.fishFew ?? "");
  }
  save(): unknown {
    return { lands: this.all() };
  }
  load(state: unknown): void {
    this.map.clear();
    for (const w of (state as { lands: Wilds[] }).lands)
      this.set({
        ...w,
        lost: [...w.lost],
        // (A save from before the hunters knew none.)
        hunter: w.hunter ?? -1,
        hunters: w.hunters ?? 0,
        flocksTaken: w.flocksTaken ?? null,
        // (And a save from before the web of eating knew none of its other levels.)
        huntersLeft: w.huntersLeft ?? null,
        small: w.small ?? 1,
        lesserOf: w.lesserOf ?? -1,
        lesser: w.lesser ?? 0,
        scavengerOf: w.scavengerOf ?? -1,
        carrion: w.carrion ?? 0,
        fish: w.fish ?? -1,
        multiplied: w.multiplied ?? null,
        grainEaten: w.grainEaten ?? null,
        fishFew: w.fishFew ?? null,
      });
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

/** The land's lineage of a niche: the first of it that lives there (-1 none). */
export function lineageOf(g: HomeWorld, cell: number, niche: string): number {
  for (const s of g.life.species)
    if (s.niche === niche && s.died === null && lives(g.life, cell, s.index)) return s.index;
  return -1;
}

/** The land's hunting lineage: the first of the hunters that live there (-1 none). */
export function hunterOf(g: HomeWorld, cell: number): number {
  return lineageOf(g, cell, "hunter");
}

/** Whether a land has water with life in it: a river, a lake or a coast. */
export function watersOf(g: HomeWorld, cell: number): boolean {
  if (g.water.river[cell] || g.water.lake[cell]) return true;
  for (let k = g.grid.offsets[cell]!; k < g.grid.offsets[cell + 1]!; k++)
    if (g.tectonics.elevation[g.grid.neighbours[k]!]! <= 0) return true;
  return false;
}

/** How a land's living world stands (as it was at first where no one has touched it). */
export function wildsOf(ctx: PopulationContext, cell: number): Wilds {
  const known = ecologyOf(ctx.world).get(cell);
  if (known) return known;
  const g = ctx.generated,
    off = offworldSite(g, cell),
    hunter = off ? -1 : hunterOf(g, cell),
    lesserOf = off ? -1 : lineageOf(g, cell, "small hunter"),
    scavengerOf = off ? -1 : lineageOf(g, cell, "scavenger");
  return {
    cell,
    wild: 1,
    forest: 1,
    soil: 1,
    firstForest: firstForest(ctx.generated, cell),
    lost: [],
    thinned: null,
    cleared: null,
    worn: null,
    hunter,
    hunters: hunter >= 0 ? 1 : 0,
    flocksTaken: null,
    huntersLeft: null,
    small: 1,
    lesserOf,
    lesser: lesserOf >= 0 ? 1 : 0,
    scavengerOf,
    carrion: scavengerOf >= 0 ? 1 : 0,
    fish: !off && watersOf(g, cell) ? 1 : -1,
    multiplied: null,
    grainEaten: null,
    fishFew: null,
  };
}

/** The share of a land's flocks its hunters take in a year, at their full number. */
export const FLOCK_LOSS = 0.08;

/** The share of a land's grain its small game eats, where it has grown past what it was. */
export function grainLost(w: Wilds): number {
  return GRAIN_LOSS * Math.max(0, w.small - 1);
}

/** What the wild's food is worth as the land's waters stand (fished hard, they give less). */
export function waterYield(w: Wilds): number {
  return w.fish < 0 ? 1 : 0.85 + 0.15 * w.fish;
}

/** What a land feeds as its living world stands: the wild's food by the wild, fields by the soil. */
export function living(c: Capacity, w: Wilds): Capacity {
  return {
    ...c,
    forage: c.forage * w.wild * waterYield(w),
    farm: c.farm * w.soil * (1 - grainLost(w)),
  };
}

/**
 * How far past what it was a level grows where what eats it is gone: the game (its
 * hunters gone), the small game (its small hunters gone); the share of its grain the
 * small game eats for each part it stands past what it was.
 */
const RELEASE = 0.2,
  SMALL_RELEASE = 0.3,
  GRAIN_LOSS = 0.15;

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
export function stepWilds(
  w: Wilds,
  take: number,
  farmed: number,
  rest: number,
  /** The share of the land's people who keep flocks (and guard them). */
  herding = 0,
): void {
  // A people living close to what the wild yields (taking more than three-fifths of it)
  // thin it, the more the harder they press; a wild pressed less grows back toward what
  // it was — and past it, where its hunters are thinned or gone.
  const over = Math.max(0, take - 0.6),
    hunted = w.hunter >= 0 ? Math.max(0, 1 - (w.lost.includes(w.hunter) ? 0 : w.hunters)) : 0,
    top = 1 + RELEASE * hunted;
  w.wild = Math.min(
    top,
    Math.max(0.05, w.wild + WILD_REGROWTH * (top - w.wild) - 0.5 * over * w.wild),
  );
  // And the fields take the wild's own ground: where most of a land is farmed, little
  // is left for game.
  const ground = 1 - 0.8 * farmed;
  w.wild = Math.max(0.05, Math.min(w.wild, ground * top));
  // The forest gives way to the fields fast, and comes back slowly — slower still where
  // the game has multiplied and browses its saplings.
  const standing = 1 - farmed,
    browsed = 1 - Math.min(0.8, 3 * Math.max(0, w.wild - 1));
  w.forest =
    standing < w.forest
      ? standing
      : Math.min(standing, w.forest + FOREST_REGROWTH * browsed * (1 - w.forest));
  w.soil = Math.min(
    1,
    Math.max(
      0.3,
      w.soil - 0.01 * farmed * (1 - Math.min(1, rest)) + SOIL_HEALING * (1 - w.soil) * (1 - farmed),
    ),
  );
  // The hunters follow their game — toward as many as the wild keeps, a few wandering in
  // where the game is there — and fall under a people who hunt them and guard their flocks.
  if (w.hunter >= 0 && !w.lost.includes(w.hunter)) {
    const guard = Math.min(1, take + 2 * herding);
    w.hunters = Math.max(
      0,
      Math.min(
        1.2,
        w.hunters +
          0.3 * w.hunters * (w.wild - w.hunters) +
          0.02 * (w.wild - w.hunters) -
          0.35 * guard * w.hunters,
      ),
    );
  }
  // The small game: of the wild ground and, more thickly, of the fields' grain; past what
  // it was where its small hunters are thinned; trapped where the foragers press hard.
  const lesserThinned =
      w.lesserOf >= 0 ? Math.max(0, 1 - (w.lost.includes(w.lesserOf) ? 0 : w.lesser)) : 0,
    smallTop = Math.min(1.4, (ground + 0.9 * farmed) * (1 + SMALL_RELEASE * lesserThinned));
  w.small = Math.min(
    1.4,
    Math.max(0.05, w.small + 0.3 * (smallTop - w.small) - 0.3 * over * w.small),
  );
  // The small hunters follow the small game, and give way to the farmers and herders who
  // guard their grain and their young stock from them.
  if (w.lesserOf >= 0 && !w.lost.includes(w.lesserOf)) {
    const guard = Math.min(1, 0.5 * farmed + herding + 0.5 * take),
      food = Math.min(1.2, w.small);
    w.lesser = Math.max(
      0,
      Math.min(
        1.2,
        w.lesser +
          0.3 * w.lesser * (food - w.lesser) +
          0.02 * (food - w.lesser) -
          0.4 * guard * w.lesser,
      ),
    );
  }
  // The scavengers live on the hunters' kills and the herds' own dead.
  if (w.scavengerOf >= 0 && !w.lost.includes(w.scavengerOf)) {
    const kills =
        w.hunter < 0 ? 0.55 : w.lost.includes(w.hunter) ? 0 : 0.55 * Math.min(1.2, w.hunters),
      target = Math.min(1.2, kills + 0.45 * Math.min(1.2, w.wild));
    w.carrion = Math.max(0, Math.min(1.2, w.carrion + 0.25 * (target - w.carrion)));
  }
  // The water's life comes back fast, but a people who fish hard take it faster.
  if (w.fish >= 0)
    w.fish = Math.min(
      1,
      Math.max(0.05, w.fish + 0.15 * (1 - w.fish) - 0.8 * Math.max(0, take - 0.5) * w.fish),
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
    // (Sealed halls on another world have no wild to thin, no forest, no open soil.)
    if (!pop || offworldSite(g, p.cell)) continue;
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
      rest = (lore.get(p.cell, "rotation") ? 0.6 : 0) + (lore.get(p.cell, "manuring") ? 0.4 : 0),
      herders = p.occupation(OCC.herder),
      herding = herders / pop;
    stepWilds(w, take, farmed, rest, herding);
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
    // Hunters pressed below a tithe of their number leave the land to its people.
    if (w.hunter >= 0 && !w.lost.includes(w.hunter) && w.hunters < 0.08) {
      const s = g.life.species[w.hunter]!;
      w.lost = [...w.lost, s.index].sort((a, b) => a - b);
      w.hunters = 0;
      w.huntersLeft = world.events.emit({
        type: ECOLOGY_EVENTS.huntersGone.type,
        subjects: [s.ref as Ref],
        place: p.ref,
        causes: causes(herders > 0 ? p.herding : w.thinned, s.ref as Ref),
        data: { beast: s.name, year },
      });
    }
    // The small hunters, too, driven off by those who guard their grain and stock.
    if (w.lesserOf >= 0 && !w.lost.includes(w.lesserOf) && w.lesser < 0.08) {
      const s = g.life.species[w.lesserOf]!;
      w.lost = [...w.lost, s.index].sort((a, b) => a - b);
      w.lesser = 0;
      world.events.emit({
        type: ECOLOGY_EVENTS.huntersGone.type,
        subjects: [s.ref as Ref],
        place: p.ref,
        causes: causes(p.cultivation ?? p.herding, s.ref as Ref),
        data: { beast: s.name, year },
      });
    }
    // The scavengers leave with the kills they lived on.
    if (w.scavengerOf >= 0 && !w.lost.includes(w.scavengerOf) && w.carrion < 0.08) {
      const s = g.life.species[w.scavengerOf]!;
      w.lost = [...w.lost, s.index].sort((a, b) => a - b);
      w.carrion = 0;
      world.events.emit({
        type: ECOLOGY_EVENTS.scavengersLeft.type,
        subjects: [s.ref as Ref],
        place: p.ref,
        causes: causes(w.huntersLeft ?? w.thinned, s.ref as Ref),
        data: { beast: s.name, year },
      });
    }
    // The game multiplied past what it was, its hunters thinned or gone.
    if (w.wild > 1.08 && !w.multiplied && w.hunter >= 0)
      w.multiplied = world.events.emit({
        type: ECOLOGY_EVENTS.multiplied.type,
        subjects: [g.life.species[w.hunter]!.ref as Ref],
        place: p.ref,
        causes: causes(w.huntersLeft ?? p.herding, p.ref),
        data: { beast: g.life.species[w.hunter]!.name, wild: Math.round(w.wild * 100) },
      });
    else if (w.wild < 1.02 && w.multiplied) w.multiplied = null;
    // The small game eats the grain, where its hunters are thinned and the fields are wide.
    const eaten = grainLost(w);
    if (eaten >= 0.02 && !w.grainEaten && p.knowsCultivation) {
      const small = lineageOf(g, p.cell, "seed-eater");
      w.grainEaten = world.events.emit({
        type: ECOLOGY_EVENTS.grainEaten.type,
        subjects: small >= 0 ? [g.life.species[small]!.ref as Ref] : [],
        place: p.ref,
        causes: causes(p.cultivation, p.ref),
        data: {
          beast: small >= 0 ? g.life.species[small]!.name : null,
          share: Math.round(eaten * 100),
        },
      });
    } else if (eaten < 0.005 && w.grainEaten) w.grainEaten = null;
    // Fished hard, the waters grow poor.
    if (w.fish >= 0 && w.fish < 0.4 && !w.fishFew)
      w.fishFew = world.events.emit({
        type: ECOLOGY_EVENTS.fishFew.type,
        place: p.ref,
        causes: causes(p.arrival, p.ref),
        data: { fish: Math.round(w.fish * 100) },
      });
    else if (w.fish > 0.7 && w.fishFew) w.fishFew = null;
    // Where they are many among the flocks, the herders' losses are told.
    const losses = FLOCK_LOSS * w.hunters;
    if (herders > 0 && losses >= 0.05 && !w.flocksTaken && w.hunter >= 0) {
      const s = g.life.species[w.hunter]!;
      w.flocksTaken = world.events.emit({
        type: ECOLOGY_EVENTS.flocksTaken.type,
        subjects: [s.ref as Ref],
        place: p.ref,
        causes: causes(s.ref as Ref, p.herding),
        data: { beast: s.name, share: Math.round(losses * 100) },
      });
    } else if (losses < 0.025 && w.flocksTaken) w.flocksTaken = null;
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
