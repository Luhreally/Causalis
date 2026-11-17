// Floods in play (the sweep, Nature lane; the rules are rules/floods.ts). Once a year, as the year's rain is known (105.weather
// .rain), each peopled floodplain (a land a river runs through, its slopes gentle) may see its river overrun it: as likely as its
// year's rain against its usual and the woods left on its ground make it, one draw a plain a year. A flood drowns that year's
// fields by its greatness (population/systems.ts foodMonth: floodYield, exactly 1 where none rose), wets its stores, drowns a
// few (fewer where they have raised their floors: lore/lessons.ts), and lays its silt on the ground (ecology/ground.ts, as the
// silt a river carries down is laid). It is told as the god's own flood is (acts/disasters.ts `act.flood`, `natural` in its
// data), so the lessons, the pages and the memory that follow a flood follow these.
//
// What is kept: this year's drowned fields, the last few dozen floods, a tally for ever.
import {
  YEAR,
  defineStream,
  yearOfMoment,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { cellRef, isProvinceWorld, keptKey, type ProvinceWorld } from "../../gen/index.ts";
import { FLOOD, floodChance, floodHarm, floodSize } from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { DISASTER_EVENTS, deathsIn, grieve, spill } from "../acts/disasters.ts";
import { groundOf, landSlope } from "../ecology/ground.ts";
import { ecologyOf } from "../ecology/ecology.ts";
import { lessened } from "../lore/lessons-store.ts";

const FLOODS = defineStream("planet.floods");

/** The most floods kept for the pages. */
export const FLOODS_KEPT = 48;

export type Flood = {
  readonly cell: number;
  readonly year: number;
  /** Its greatness (hundredths: 100 its usual), its dead, the share of the harvest it drowned (thousandths). */
  readonly size: number;
  readonly dead: number;
  readonly fields: number;
  readonly event: Ref;
};

export type FloodTally = { floods: number; dead: number };

const PLAINS = new Map<string, Int32Array>();

/** A world's floodplains: the lands a river runs through, their slopes gentle (read once from its ground, never state). */
export function floodplains(ctx: PopulationContext): Int32Array {
  const g = ctx.generated as ProvinceWorld;
  const key = `${keptKey(g)} ${g.grid.count} ${ctx.medium}`;
  let p = PLAINS.get(key);
  if (p) return p;
  const out: number[] = [];
  if (ctx.medium !== "water")
    for (let c = 0; c < g.offworld.base; c++)
      if (
        g.tectonics.elevation[c]! > 0 &&
        g.water.river[c] === 1 &&
        landSlope(ctx, c) <= FLOOD.plain
      )
        out.push(c);
  p = Int32Array.from(out);
  PLAINS.set(key, p);
  if (PLAINS.size > 6) PLAINS.delete(PLAINS.keys().next().value!);
  return p;
}

export class FloodStore implements StateStore {
  readonly name = "planet.floods";
  floods: Flood[] = [];
  tally: FloodTally = { floods: 0, dead: 0 };
  /** This year's drowned fields: [cell, the moment they are sown again, thousandths of the harvest taken]. */
  drowned: [number, number, number][] = [];
  /** (The drowned by their land, read off the list as it stands: not state. Asked for every land every month.) */
  private drownedBy: {
    of: [number, number, number][];
    n: number;
    by: Map<number, [number, number][]>;
  } | null = null;
  /** A land's drowned fields now: [the moment they are sown again, thousandths taken]. */
  drownedIn(cell: number): readonly [number, number][] | undefined {
    let k = this.drownedBy;
    if (!k || k.of !== this.drowned || k.n !== this.drowned.length) {
      const by = new Map<number, [number, number][]>();
      for (const [c, until, loss] of this.drowned) {
        const l = by.get(c);
        if (l) l.push([until, loss]);
        else by.set(c, [[until, loss]]);
      }
      this.drownedBy = k = { of: this.drowned, n: this.drowned.length, by };
    }
    return k.by.get(cell);
  }

  dormant(): boolean {
    return !this.tally.floods && !this.drowned.length;
  }
  pinned(): Ref[] {
    return this.floods.map((f) => f.event);
  }
  hashInto(h: Hasher): void {
    if (!this.dormant()) h.value({ f: this.floods, t: this.tally, d: this.drowned });
  }
  save(): unknown {
    return this.dormant() ? {} : { floods: this.floods, tally: this.tally, drowned: this.drowned };
  }
  load(state: unknown): void {
    const s = (state ?? {}) as Partial<{
      floods: Flood[];
      tally: FloodTally;
      drowned: [number, number, number][];
    }>;
    this.floods = (s.floods ?? []).map((f) => ({ ...f }));
    this.tally = { floods: 0, dead: 0, ...s.tally };
    this.drowned = (s.drowned ?? []).map((d) => [d[0], d[1], d[2]]);
  }
}

export function floodsOf(world: World): FloodStore | null {
  return world.hasStore("planet.floods") ? world.store<FloodStore>("planet.floods") : null;
}

/** What a flood left of a land's harvest this year (exactly 1 where none rose). */
export function floodYield(world: World, cell: number): number {
  const store = floodsOf(world);
  if (!store || !store.drowned.length) return 1;
  const now = world.now;
  let k = 1;
  const mine = store.drownedIn(cell);
  if (mine) for (const [until, loss] of mine) if (now < until) k *= 1 - loss / 1000;
  return k;
}

/** The flood whose drowned fields a land still goes short by (null where none). */
export function floodBehind(world: World, cell: number): Ref | null {
  const store = floodsOf(world);
  if (!store || floodYield(world, cell) >= 1) return null;
  for (let i = store.floods.length - 1; i >= 0; i--)
    if (store.floods[i]!.cell === cell) return store.floods[i]!.event;
  return null;
}

/** The year's floods (106.planet.floods, as the year's rain is known). */
export function floodsYear(ctx: PopulationContext, t: SimTime): void {
  const store = floodsOf(ctx.world);
  if (!store || !isProvinceWorld(ctx.generated)) return;
  const { world } = ctx,
    year = yearOfMoment(t);
  if (store.drowned.length) store.drowned = store.drowned.filter((d) => d[1] > t);
  const eco = ecologyOf(world);
  for (const cell of floodplains(ctx)) {
    const p = ctx.provinces.get(cell);
    if (!p || p.total() <= 0) continue;
    const chance = floodChance(p.rain / 1000, eco.get(cell)?.forest ?? 1);
    if (!(world.rng.real(FLOODS, cell, t, 0) < chance)) continue;
    const size = floodSize(world.rng.real(FLOODS, cell, t, 1)),
      harm = floodHarm(size),
      spared = lessened(world, cellRef(0, cell), "flood", year),
      dead = deathsIn(ctx, cell, Math.round(p.total() * harm.dead * spared), t);
    spill(ctx, cell, harm.stores);
    // (Of the fields on its plain: a land's harvest is not all grown beside its river. Counted of all of it, a great flood left a
    // tenth of a land's year, and half first light's late famines without a drought stood in a flood's year.)
    store.drowned.push([cell, t + YEAR, Math.round(1000 * harm.fields * FLOOD.onPlain)]);
    const ground = groundOf(world)?.get(cell);
    if (ground) {
      ground.silt = Math.round(ground.silt + 1e6 * harm.silt);
      groundOf(world)!.set(ground);
    }
    const event = world.events.emit({
      type: DISASTER_EVENTS.flood.type,
      // (Most floods are a plain's ordinary sorrow; one that drowns a thousand is history's.)
      importance: dead >= 1000 ? 5 : size >= 2 ? 4 : 3,
      subjects: [p.ref],
      place: p.ref,
      causes: [],
      data: {
        natural: true,
        dead,
        lands: 1,
        size: Math.round(size * 100) / 100,
        fields: Math.round(harm.fields * FLOOD.onPlain * 100),
        rain: p.rain,
      },
    });
    grieve(world, cell, 0.05 * Math.min(3, size), event);
    store.floods.push({
      cell,
      year,
      size: Math.round(size * 100),
      dead,
      fields: Math.round(1000 * harm.fields * FLOOD.onPlain),
      event,
    });
    if (store.floods.length > FLOODS_KEPT) store.floods.shift();
    store.tally.floods++;
    store.tally.dead += dead;
  }
}

/** A land's floods kept, newest first (its page). */
export function floodsOn(world: World, cell: number): Flood[] {
  return (floodsOf(world)?.floods ?? []).filter((f) => f.cell === cell).reverse();
}

/** Teach a peopled world its rivers' floods. */
export function installFloods(world: World, ctx: () => PopulationContext): FloodStore {
  const store = world.register(new FloodStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "106.planet.floods", every: YEAR, run: (t) => floodsYear(ctx(), t) });
  return store;
}
