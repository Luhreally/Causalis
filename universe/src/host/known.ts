// What a people knows of its world's surface (signals, docs/architecture/first-principles-plan.md, "Signals", asked 2026-11-11: "the whole world
// should technically be explored before they reach space ... the stuff that gets them to space would be able to sense all this
// other uninhabited land"). Seeing far is a function (rules/signals.ts SIGHT_WAYS), and this is its reading: from each land its
// people hold or have held, what its ways of seeing reach as its lore stood in a year. Their own lands and those about them; the
// coasts their ships come to, and a way inland from each; what their machines fly over and back; what a rocket sees from its
// height; and once a land of theirs has something in orbit, all of it. Read from lore, which only grows, so what was seen stays
// seen. A reading only: history never reads it, and it is in no hash.
import { YEAR, type World } from "../kernel/index.ts";
import { isProvinceWorld, meansNumbers, type HomeWorld } from "../gen/index.ts";
import {
  PRINCIPLES,
  SIGHT_STEPS,
  flyerOn,
  liftingEngine,
  rocketSightKm,
  type Principle,
} from "../rules/index.ts";
import { SEA_STEPS, homePlanet, loreOf, populationContext } from "../sim/index.ts";

/** What a people knows of its world's surface in a year. */
export type KnownWorld = {
  readonly year: number;
  /** Each home cell: 1 where known. */
  readonly known: Uint8Array;
  /** The share of its surface known, of its land, of its seas. */
  readonly share: number;
  readonly land: number;
  readonly sea: number;
  /** The furthest way of seeing any of its lands has (rules/signals.ts SIGHT_WAYS ids). */
  readonly by: string;
};

const byId: ReadonlyMap<string, Principle> = new Map(PRINCIPLES.map((p) => [p.id, p]));
const EARTH_KM = 6371;

/** The cells of a world's own face (lands on other bodies come after them). */
export function homeCells(g: HomeWorld): number {
  return isProvinceWorld(g) ? g.offworld.base : g.grid.offsets.length - 1;
}

const kept = new WeakMap<World, { key: string; read: KnownWorld }>();

/** What its people know of their world in a year (left out: now). */
export function knownWorld(world: World, atYear?: number): KnownWorld {
  const now = Math.floor(world.now / YEAR),
    year = atYear ?? now,
    lore = loreOf(world),
    ctx = populationContext(world),
    key = `${year}:${world.events.count}`,
    k = kept.get(world);
  if (atYear === undefined && k?.key === key) return k.read;
  const g = homePlanet(world).generated,
    n = homeCells(g),
    water = ctx.medium === "water",
    land = (c: number) => g.tectonics.elevation[c]! > 0,
    known = new Uint8Array(n),
    // (What each land knew by the year: lore only grows, so a year's is its entries up to then.)
    sources: { cell: number; knows: (id: string) => boolean; ships: number }[] = [];
  const seen = new Set<number>();
  const addSource = (cell: number) => {
    if (cell >= n || seen.has(cell)) return;
    seen.add(cell);
    const ids = new Set<string>();
    let ships = 0;
    for (const [id, kn] of lore.entries(cell))
      if (kn.year <= year) {
        ids.add(id);
        ships += byId.get(id)?.effects.ships ?? 0;
      }
    sources.push({ cell, knows: (id) => ids.has(id), ships });
  };
  for (const p of ctx.provinces.all()) if (p.total() && p.settledYear <= year) addSource(p.cell);
  for (const c of lore.cells()) {
    for (const [, kn] of lore.entries(c))
      if (kn.year <= year) {
        addSource(c);
        break;
      }
  }
  sources.sort((a, b) => a.cell - b.cell);
  let by = "feet";
  const read = (): KnownWorld => {
    let all = 0,
      onLand = 0,
      landCells = 0,
      onSea = 0;
    for (let c = 0; c < n; c++) {
      const l = land(c);
      if (l) landCells++;
      if (!known[c]) continue;
      all++;
      if (l) onLand++;
      else onSea++;
    }
    return {
      year,
      known,
      share: all / Math.max(1, n),
      land: onLand / Math.max(1, landCells),
      sea: onSea / Math.max(1, n - landCells),
      by,
    };
  };
  const done = (r: KnownWorld) => {
    if (atYear === undefined) kept.set(world, { key, read: r });
    return r;
  };
  // From orbit, all of it.
  if (sources.some((s) => s.knows("orbital-flight"))) {
    known.fill(1);
    by = "orbit";
    return done(read());
  }
  // Over ground and sea, each cell with the most steps still to go: walked from their lands, sailed from their coasts.
  const onGround = new Int8Array(n).fill(-1),
    onWater = new Int8Array(n).fill(-1),
    queue: number[] = [];
  const reachGround = (c: number, b: number) => {
    known[c] = 1;
    if (b > onGround[c]!) {
      onGround[c] = b;
      queue.push(c);
    }
  };
  const reachWater = (c: number, b: number) => {
    known[c] = 1;
    if (b > onWater[c]!) {
      onWater[c] = b;
      queue.push(c);
    }
  };
  for (const s of sources) {
    if (water) reachWater(s.cell, SIGHT_STEPS.feet);
    else reachGround(s.cell, SIGHT_STEPS.feet);
    const range = SEA_STEPS[Math.min(SEA_STEPS.length - 1, Math.floor(s.ships))]!;
    if (range > 0) {
      if (by === "feet") by = "ships";
      for (let j = g.grid.offsets[s.cell]!; j < g.grid.offsets[s.cell + 1]!; j++) {
        const m = g.grid.neighbours[j]!;
        if (m < n && !land(m)) reachWater(m, range);
      }
      if (water) reachWater(s.cell, range);
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i]!,
      ground = onGround[c]!,
      sea = onWater[c]!;
    for (let j = g.grid.offsets[c]!; j < g.grid.offsets[c + 1]!; j++) {
      const m = g.grid.neighbours[j]!;
      if (m >= n) continue;
      if (land(m)) {
        // (Over ground, a step less; from the sea, ashore and a way in, for a people of the land.)
        if (ground > 0) reachGround(m, ground - 1);
        if (sea > 0) {
          if (water) known[m] = 1;
          else reachGround(m, SIGHT_STEPS.inland);
        }
      } else {
        known[m] = 1;
        if (sea > 0) reachWater(m, sea - 1);
      }
    }
  }
  // From the air, and from a rocket's height: every cell within reach of a land that has them.
  const numbers = meansNumbers(g),
    engine = liftingEngine(numbers),
    radiusKm = EARTH_KM * g.planet.radius,
    wingsKm = engine ? flyerOn(engine, numbers).reachKm : 0,
    rocketKm = rocketSightKm(radiusKm),
    p = g.grid.positions;
  for (const s of sources) {
    const km = Math.max(
      s.knows("rocketry") ? rocketKm : 0,
      engine && s.knows("powered-wings") && s.knows(engine.id) ? wingsKm : 0,
    );
    if (km <= 0) continue;
    by = s.knows("rocketry") && rocketKm >= wingsKm ? "rocket" : by === "rocket" ? by : "wings";
    // (A chord on a unit sphere for the arc of km over the world's radius.)
    const chord = 2 * Math.sin(Math.min(Math.PI, km / radiusKm) / 2),
      within = chord * chord,
      a = s.cell;
    for (let c = 0; c < n; c++) {
      if (known[c]) continue;
      const dx = p[3 * a]! - p[3 * c]!,
        dy = p[3 * a + 1]! - p[3 * c + 1]!,
        dz = p[3 * a + 2]! - p[3 * c + 2]!;
      if (dx * dx + dy * dy + dz * dz <= within) known[c] = 1;
    }
  }
  return done(read());
}

/** The share of its world's surface its people know now. */
export function knownShare(world: World): number {
  return Math.round(1000 * knownWorld(world).share) / 1000;
}

/** What its people knew of their world the year before one of its lands first had orbit, and in that year (null: none has). */
export function knownAtOrbit(
  world: World,
): { year: number; before: { share: number; land: number; by: string }; at: number } | null {
  const lore = loreOf(world),
    n = homeCells(homePlanet(world).generated);
  let first: number | null = null;
  for (let c = 0; c < n; c++) {
    const k = lore.get(c, "orbital-flight");
    if (k && (first === null || k.year < first)) first = k.year;
  }
  if (first === null) return null;
  const before = knownWorld(world, first - 1),
    at = knownWorld(world, first);
  const r = (x: number) => Math.round(1000 * x) / 1000;
  return {
    year: first,
    before: { share: r(before.share), land: r(before.land), by: before.by },
    at: r(at.share),
  };
}

/** The home cells its people do not know now: what the map leaves dark. */
export function unknownCells(world: World): number[] {
  const { known } = knownWorld(world),
    out: number[] = [];
  for (let c = 0; c < known.length; c++) if (!known[c]) out.push(c);
  return out;
}
