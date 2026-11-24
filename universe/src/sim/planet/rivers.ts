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
  dmath,
  defineEventType,
  defineStream,
  yearOfMoment,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { WATER, cellRef, refineRegion, type ProvinceWorld, type Region } from "../../gen/index.ts";
import { PROVINCE_TILE_KM, REGION_SIZE, regionOf, regionReady } from "../population/systems.ts";
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

/** The ground about each town and village of `land` on its map `r` (WATER of the tiles within AVULSION.clear of each). */
function townGround(ctx: PopulationContext, land: number, r: Region): string {
  let out = "";
  const n = r.size,
    d = AVULSION.clear;
  for (const v of ctx.settlements.inProvince(land)) {
    const x = v.tile % n,
      y = Math.floor(v.tile / n);
    for (let j = Math.max(0, y - d); j <= Math.min(n - 1, y + d); j++)
      for (let i = Math.max(0, x - d); i <= Math.min(n - 1, x + d); i++)
        out += r.water[j * n + i] === WATER.land ? "." : "~";
  }
  return out;
}

/**
 * Whether moving the river from `from` to `to` would leave every town and village dry: read on the maps of the lands with towns
 * whose maps could change (a map reaches some 0.71 of its side from its land's centre, and a river entering it from beyond its
 * edge is led in by the stretch it flows from), with the stretches set as they would be and then put back as they were.
 * Nothing of the world's ground is changed, and nothing kept.
 */
function townsDry(ctx: PopulationContext, from: number, to: number): boolean {
  const g = ctx.generated as ProvinceWorld,
    f = g.fine,
    P = f.grid.positions,
    R = 6371 * f.planet.radius,
    dot = (a: number, b: number) =>
      P[3 * a]! * P[3 * b]! + P[3 * a + 1]! * P[3 * b + 1]! + P[3 * a + 2]! * P[3 * b + 2]!,
    // (The farthest a neighbour of either stretch stands, as an angle.)
    step = Math.max(
      ...[from, to].flatMap((c) => {
        const out: number[] = [];
        for (let k = f.grid.offsets[c]!; k < f.grid.offsets[c + 1]!; k++)
          out.push(dmath.acos(dmath.clamp(dot(c, f.grid.neighbours[k]!), -1, 1)));
        return out;
      }),
    ),
    // (A cell this near a map's centre surely has tiles of it; this far, surely none.)
    inner = (0.5 * REGION_SIZE * PROVINCE_TILE_KM) / R - step,
    outer = (0.71 * REGION_SIZE * PROVINCE_TILE_KM) / R + step,
    angle = (a: number, b: number) => dmath.acos(dmath.clamp(dot(a, b), -1, 1)),
    down = f.water.flowTo,
    lands: number[] = [];
  // A map's water is read off its own tiles' heights, and off the rivers that enter it from beyond its edge: a stretch outside
  // it that flows into it. Only a map where either stretch may be such can change, and only a map with a town is read.
  for (let l = 0; l < g.offworld.base; l++) {
    const c = g.centre[l]!;
    if (angle(c, from) > outer + step && angle(c, to) > outer + step) continue;
    const may = [from, to].some(
      (u) => angle(c, u) >= inner && down[u]! >= 0 && angle(c, down[u]!) <= outer,
    );
    if (may && ctx.settlements.inProvince(l).length) lands.push(l);
  }
  if (!lands.length) return true;
  const before = lands.map((l) =>
      townGround(
        ctx,
        l,
        regionReady(ctx, l)
          ? regionOf(ctx, l)
          : refineRegion(f, g.centre[l]!, REGION_SIZE, PROVINCE_TILE_KM),
      ),
    ),
    river = f.water.river,
    flow = f.water.discharge,
    was = [river[from]!, river[to]!, flow[from]!, flow[to]!] as const;
  river[from] = 0;
  river[to] = 1;
  flow[from] = was[3];
  flow[to] = was[2];
  try {
    return lands.every(
      (l, i) =>
        townGround(ctx, l, refineRegion(f, g.centre[l]!, REGION_SIZE, PROVINCE_TILE_KM)) ===
        before[i],
    );
  } finally {
    river[from] = was[0];
    river[to] = was[1];
    flow[from] = was[2];
    flow[to] = was[3];
  }
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
  // Nothing built stands in water afterwards: where the new way would run through a town or village, its banks held.
  if (!townsDry(ctx, best.from, best.to)) {
    return null;
  }
  const home = homePlanet(world),
    left = home.surface(best.from),
    taken = home.surface(best.to),
    carried = left.discharge;
  left.river = 0;
  left.discharge = taken.discharge;
  taken.river = 1;
  taken.discharge = carried;
  home.changeSurface([left, taken]);
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
