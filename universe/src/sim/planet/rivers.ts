// Rivers that move (breadth round, 2026-11-23; the rules are rules/rivers.ts). A river on a flat plain lays its silt in its own bed
// and on its banks, so over the years its bed comes to stand above the plain beside it; a great flood that breaks its banks there
// may not go back, and the river takes the lower way (an avulsion: the Yellow River's twenty-odd in three thousand years). So, when
// a flood of AVULSION.size or more overruns a peopled floodplain (planet/floods.ts), a stretch of its channel there may leave its
// bed for a neighbouring lower stretch of the plain that joins the same river above and below it: as likely as the flood's
// greatness, the plain's flatness and the silt its ground holds make it, one draw a great flood. The old bed is dry ground, the
// new one the river's; the ground's departure is kept as every other is (planet/store.ts changeSurface, so every reading kept by
// the world's ground reads it anew), and told with the flood that did it. Never where it would put water about a town or village
// on any land's map: there the banks held, and nothing built stands in a new bed.
//
// What is kept: the last few dozen moves, a tally for ever; the beds themselves in the planet's own departures.
import {
  defineEventType,
  defineStream,
  yearOfMoment,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { WATER, cellRef, type ProvinceWorld } from "../../gen/index.ts";
import { regionOf } from "../population/systems.ts";
import { AVULSION, avulsionChance } from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { homePlanet } from "./store.ts";
import { groundOf } from "../ecology/ground.ts";

const RIVERS = defineStream("planet.rivers");

export const RIVER_EVENTS = {
  /** A river left its bed for a lower way across its plain. */
  moved: defineEventType("planet.river-moved", 4),
};

export type RiverMove = {
  readonly year: number;
  /** The land it moved in, the fine stretch it left and the one it took. */
  readonly land: number;
  readonly from: number;
  readonly to: number;
  readonly event: Ref;
};

export class RiverStore implements StateStore {
  readonly name = "planet.rivers";
  moves: RiverMove[] = [];
  tally = 0;
  dormant(): boolean {
    return !this.tally;
  }
  pinned(): Ref[] {
    return this.moves.map((m) => m.event);
  }
  hashInto(h: Hasher): void {
    if (!this.dormant()) h.value({ m: this.moves, t: this.tally });
  }
  save(): unknown {
    return this.dormant() ? {} : { moves: this.moves, tally: this.tally };
  }
  load(state: unknown): void {
    const s = (state ?? {}) as Partial<{ moves: RiverMove[]; tally: number }>;
    this.moves = (s.moves ?? []).map((m) => ({ ...m }));
    this.tally = s.tally ?? 0;
  }
}

export function riversOf(world: World): RiverStore | null {
  return world.peek<RiverStore>("planet.rivers") ?? null;
}

/** A land's rivers' moves kept, newest first (its page). */
export function riverMovesOn(world: World, land: number): RiverMove[] {
  return (riversOf(world)?.moves ?? []).filter((m) => m.land === land).reverse();
}

/** The ground about each town and village of `lands` (WATER of their maps' tiles within AVULSION.clear of each), in one string. */
function townGround(ctx: PopulationContext, lands: readonly number[]): string {
  let out = "";
  for (const land of lands) {
    const towns = ctx.settlements.inProvince(land);
    if (!towns.length) continue;
    const r = regionOf(ctx, land),
      n = r.size,
      d = AVULSION.clear;
    for (const v of towns) {
      const x = v.tile % n,
        y = Math.floor(v.tile / n);
      for (let j = Math.max(0, y - d); j <= Math.min(n - 1, y + d); j++)
        for (let i = Math.max(0, x - d); i <= Math.min(n - 1, x + d); i++)
          out += r.water[j * n + i] === WATER.land ? "." : "~";
    }
  }
  return out;
}

/**
 * After a flood of `size` on a floodplain `land` (its event `flood`): whether a stretch of its river leaves its bed, and where to.
 * Returns the move's event, or null.
 */
export function riverAfterFlood(
  ctx: PopulationContext,
  land: number,
  size: number,
  slope: number,
  flood: Ref,
  t: SimTime,
): Ref | null {
  const store = riversOf(ctx.world);
  if (!store || size < AVULSION.size) return null;
  const { world } = ctx,
    g = ctx.generated as ProvinceWorld,
    f = g.fine,
    silt = (groundOf(world)?.get(land)?.silt ?? 0) / 1e6,
    chance = avulsionChance(size, slope, silt);
  if (!(world.rng.real(RIVERS, land, t, 0) < chance)) return null;
  // (Each stretch of the land's channel, and the lowest dry stretch beside it that touches the channel both above and below it.)
  const river = f.water.river,
    up = f.tectonics.elevation,
    flow = f.water.discharge;
  let best: { from: number; to: number; drop: number } | null = null;
  for (let k = g.childOffsets[land]!; k < g.childOffsets[land + 1]!; k++) {
    const c = g.children[k]!;
    if (river[c] !== 1 || up[c]! <= 0) continue;
    const above: number[] = [],
      below: number[] = [];
    for (let j = f.grid.offsets[c]!; j < f.grid.offsets[c + 1]!; j++) {
      const m = f.grid.neighbours[j]!;
      if (river[m] !== 1) continue;
      if (flow[m]! < flow[c]!) above.push(m);
      else below.push(m);
    }
    if (!above.length || !below.length) continue;
    for (let j = f.grid.offsets[c]!; j < f.grid.offsets[c + 1]!; j++) {
      const n = f.grid.neighbours[j]!;
      if (river[n] === 1 || f.water.lake[n] === 1 || up[n]! <= 0) continue;
      if (up[n]! > up[c]! + AVULSION.above) continue;
      const touches = (list: number[]) =>
        list.some((m) => {
          for (let i = f.grid.offsets[n]!; i < f.grid.offsets[n + 1]!; i++)
            if (f.grid.neighbours[i] === m) return true;
          return false;
        });
      if (!touches(above) || !touches(below)) continue;
      const drop = up[c]! - up[n]!;
      if (!best || drop > best.drop || (drop === best.drop && n < best.to))
        best = { from: c, to: n, drop };
    }
  }
  if (!best) return null;
  // (The lands whose maps may hold either stretch: theirs and those about them. A river entering a map from beyond its edge is
  // led in by the planet's river, so the ground of a map beside the move may change too.)
  const near = new Set<number>();
  for (const c of [best.from, best.to]) {
    const l = g.provinceOf[c]!;
    near.add(l);
    for (let k = g.grid.offsets[l]!; k < g.grid.offsets[l + 1]!; k++)
      near.add(g.grid.neighbours[k]!);
  }
  const lands = [...near].filter((l) => l < g.offworld.base).sort((a, b) => a - b),
    before = townGround(ctx, lands),
    home = homePlanet(world),
    was = [home.surface(best.from), home.surface(best.to)],
    left = home.surface(best.from),
    taken = home.surface(best.to),
    carried = left.discharge;
  left.river = 0;
  left.discharge = taken.discharge;
  taken.river = 1;
  taken.discharge = carried;
  home.changeSurface([left, taken]);
  // Nothing built stands in water afterwards: where the new way would run through a town or village, its banks held.
  if (townGround(ctx, lands) !== before) {
    home.changeSurface(was);
    return null;
  }
  const p = ctx.provinces.get(land),
    event = world.events.emit({
      type: RIVER_EVENTS.moved.type,
      importance: 4,
      subjects: p ? [p.ref] : [],
      place: cellRef(0, land),
      causes: [
        { ref: flood, role: "trigger", weight: 0.7 },
        { ref: cellRef(0, land), role: "constraint", weight: 0.3 },
      ],
      data: {
        size: Math.round(size * 100) / 100,
        slope: Math.round(slope * 10000) / 10000,
        silt: Math.round(silt * 1000) / 1000,
        drop: Math.round(best.drop),
      },
    });
  store.moves.push({ year: yearOfMoment(t), land, from: best.from, to: best.to, event });
  if (store.moves.length > AVULSION.kept) store.moves.shift();
  store.tally++;
  return event;
}

/** Teach a peopled world its rivers' moves (stepped by its floods: planet/floods.ts). */
export function installRivers(world: World): RiverStore {
  const store = world.register(new RiverStore());
  world.addPinner(() => store.pinned());
  return store;
}
