// Great storms and landslides in play (breadth round, 2026-11-23; the rules are rules/storms.ts). Once a year, as the year's rain is
// known, each peopled coast beside a sea warm enough to breed great storms, at a latitude its world's turning spins them in, may be
// struck: as likely as its sea's warmth and its world's spin there make it, one draw a coast a year. Each peopled steep land may see
// its slopes fail: as likely as its steepness, its year's rain against its usual and the woods left to bind it make it. Either drowns
// or buries a share of that year's harvest (kept with the floods' drowned fields, planet/floods.ts, so the year's food and its
// pages read them as they read a flood's) and kills a few; a storm wets the stores too. A people of the water is struck in its own
// seas (its beds and pens torn up); nothing slides under the sea.
//
// What is kept: the last few dozen, a tally for ever. Nothing grows with history.
import {
  YEAR,
  defineEventType,
  defineStream,
  dmath,
  yearOfMoment,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { cellRef, isProvinceWorld, keptKey, type ProvinceWorld } from "../../gen/index.ts";
import {
  slideChance,
  slideHarm,
  cycloneChance,
  cycloneHarm,
  cycloneSize,
  cycloneSpin,
} from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { deathsIn, grieve, spill } from "../acts/disasters.ts";
import { landSlope } from "../ecology/ground.ts";
import { ecologyOf } from "../ecology/ecology.ts";
import { floodsOf } from "./floods.ts";
import { lessened } from "../lore/lessons-store.ts";

const STORMS = defineStream("planet.storms");

export const STORM_EVENTS = {
  /** A great storm came ashore. */
  storm: defineEventType("planet.storm", 4),
  /** A land's slopes failed. */
  slide: defineEventType("planet.landslide", 3),
};

/** The most kept for the pages. */
export const STRUCK_KEPT = 48;

export type Struck = {
  readonly kind: "storm" | "slide";
  readonly cell: number;
  readonly year: number;
  /** Its greatness (hundredths), its dead, the share of the harvest it took (thousandths). */
  readonly size: number;
  readonly dead: number;
  readonly fields: number;
  readonly event: Ref;
};

export class StormStore implements StateStore {
  readonly name = "planet.storms";
  struck: Struck[] = [];
  tally = { storms: 0, slides: 0, dead: 0 };
  dormant(): boolean {
    return !this.tally.storms && !this.tally.slides;
  }
  pinned(): Ref[] {
    return this.struck.map((s) => s.event);
  }
  hashInto(h: Hasher): void {
    if (!this.dormant()) h.value({ s: this.struck, t: this.tally });
  }
  save(): unknown {
    return this.dormant() ? {} : { struck: this.struck, tally: this.tally };
  }
  load(state: unknown): void {
    const s = (state ?? {}) as Partial<{ struck: Struck[]; tally: StormStore["tally"] }>;
    this.struck = (s.struck ?? []).map((x) => ({ ...x }));
    this.tally = { storms: 0, slides: 0, dead: 0, ...s.tally };
  }
}

export function stormsOf(world: World): StormStore | null {
  return world.peek<StormStore>("planet.storms") ?? null;
}

/** A world's storm coasts and steep lands, read once from its ground (never state). */
type Exposed = {
  /** Coasts a storm can reach: their cell, their warmest neighbouring sea's warmth, their spin. */
  readonly coasts: Float64Array;
  /** Lands steep enough to slide: their cell and slope. */
  readonly steep: Float64Array;
};
const EXPOSED = new Map<string, Exposed>();

function exposedOf(ctx: PopulationContext): Exposed {
  const g = ctx.generated as ProvinceWorld,
    key = `${keptKey(g)} ${g.grid.count} ${ctx.medium}`;
  let x = EXPOSED.get(key);
  if (x) return x;
  const water = ctx.medium === "water",
    coasts: number[] = [],
    steep: number[] = [];
  for (let c = 0; c < g.offworld.base; c++) {
    const up = g.tectonics.elevation[c]! > 0,
      lat = (g.grid.lat[c]! * 180) / Math.PI,
      spin = cycloneSpin(lat, g.planet.dayHours);
    if (spin > 0) {
      // (A land people's coast: its warmest sea beside it; a water people's own sea is its warmth.)
      let sea = water && !up ? g.climate.temperature[c]! : -Infinity;
      if (up)
        for (let k = g.grid.offsets[c]!; k < g.grid.offsets[c + 1]!; k++) {
          const m = g.grid.neighbours[k]!;
          if (g.tectonics.elevation[m]! <= 0) sea = Math.max(sea, g.climate.temperature[m]!);
        }
      if (cycloneChance(sea, spin) > 0) coasts.push(c, sea, spin);
    }
    if (up && !water) {
      const s = landSlope(ctx, c);
      if (slideChance(s, 1.6, 0) > 0) steep.push(c, s);
    }
  }
  x = { coasts: Float64Array.from(coasts), steep: Float64Array.from(steep) };
  EXPOSED.set(key, x);
  if (EXPOSED.size > 6) EXPOSED.delete(EXPOSED.keys().next().value!);
  return x;
}

/** The share of a land's harvest on its plain a storm or slide is counted of, as a flood's is: all of it. */
const ALL = 1;

function strike(
  ctx: PopulationContext,
  store: StormStore,
  t: SimTime,
  kind: "storm" | "slide",
  cell: number,
  size: number,
  harm: { fields: number; dead: number; stores?: number },
  data: Record<string, number | boolean>,
): void {
  const { world } = ctx,
    p = ctx.provinces.get(cell)!,
    year = yearOfMoment(t),
    // (Fewer where they have learned to raise their floors and flee the water, as from a flood: lore/lessons.ts.)
    spared = lessened(world, cellRef(0, cell), "flood", year),
    dead = deathsIn(ctx, cell, Math.round(p.total() * harm.dead * spared), t);
  if (harm.stores) spill(ctx, cell, harm.stores);
  // (Its harvest drowned or buried, kept with the floods' so the year's food and the pages read it: planet/floods.ts.)
  const floods = floodsOf(world);
  floods?.drowned.push([cell, t + YEAR, Math.round(1000 * harm.fields * ALL)]);
  const event = world.events.emit({
    type: kind === "storm" ? STORM_EVENTS.storm.type : STORM_EVENTS.slide.type,
    importance: dead >= 1000 ? 5 : size >= 2 ? 4 : 3,
    subjects: [p.ref],
    place: p.ref,
    causes: [{ ref: cellRef(0, cell), role: "constraint", weight: 1 }],
    data: {
      ...data,
      dead,
      size: Math.round(size * 100) / 100,
      fields: Math.round(harm.fields * 100),
    },
  });
  grieve(world, cell, 0.04 * Math.min(3, size), event);
  store.struck.push({
    kind,
    cell,
    year,
    size: Math.round(size * 100),
    dead,
    fields: Math.round(1000 * harm.fields),
    event,
  });
  if (store.struck.length > STRUCK_KEPT) store.struck.shift();
  if (kind === "storm") store.tally.storms++;
  else store.tally.slides++;
  store.tally.dead += dead;
}

/** The year's great storms and landslides (107.planet.storms, as the year's rain is known). */
export function stormsYear(ctx: PopulationContext, t: SimTime): void {
  const store = stormsOf(ctx.world);
  if (!store || !isProvinceWorld(ctx.generated)) return;
  const { world } = ctx,
    x = exposedOf(ctx),
    eco = ecologyOf(world);
  for (let i = 0; i < x.coasts.length; i += 3) {
    const cell = x.coasts[i]!,
      p = ctx.provinces.get(cell);
    if (!p || p.total() <= 0) continue;
    const chance = cycloneChance(x.coasts[i + 1]!, x.coasts[i + 2]!);
    if (!(world.rng.real(STORMS, cell, t, 0) < chance)) continue;
    const size = cycloneSize(world.rng.real(STORMS, cell, t, 1));
    strike(ctx, store, t, "storm", cell, size, cycloneHarm(size), {
      sea: Math.round(x.coasts[i + 1]! * 10) / 10,
      chance: Math.round(chance * 1000) / 1000,
    });
  }
  for (let i = 0; i < x.steep.length; i += 2) {
    const cell = x.steep[i]!,
      p = ctx.provinces.get(cell);
    if (!p || p.total() <= 0) continue;
    const forest = eco.get(cell)?.forest ?? 1,
      chance = slideChance(x.steep[i + 1]!, p.rain / 1000, forest);
    if (!(world.rng.real(STORMS, cell, t, 2) < chance)) continue;
    const size = 1 + 0.5 * -dmath.log(Math.max(1e-9, world.rng.real(STORMS, cell, t, 3)));
    strike(ctx, store, t, "slide", cell, size, slideHarm(size), {
      slope: Math.round(x.steep[i + 1]! * 1000) / 1000,
      rain: p.rain,
      woods: Math.round(forest * 100),
    });
  }
}

/** A land's storms and slides kept, newest first (its page). */
export function struckOn(world: World, cell: number): Struck[] {
  return (stormsOf(world)?.struck ?? []).filter((s) => s.cell === cell).reverse();
}

/** Teach a peopled world its storms and slopes. */
export function installStorms(world: World, ctx: () => PopulationContext): StormStore {
  const store = world.register(new StormStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "107.planet.storms", every: YEAR, run: (t) => stormsYear(ctx(), t) });
  return store;
}
