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
  FRAMES,
  PRINCIPLES,
  PROPULSION,
  SIGHT_STEPS,
  flyerOn,
  launcherFor,
  liftingEngine,
  rocketSightKm,
  toOrbit,
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
  const numbers = meansNumbers(g),
    engine = liftingEngine(numbers),
    radiusKm = EARTH_KM * g.planet.radius,
    wingsKm = engine ? flyerOn(engine, numbers).reachKm : 0,
    rocketKm = rocketSightKm(radiusKm);
  // From the air and from a rocket's height, hopping. A machine flies out and back from a field, and a rocket sees its
  // horizon from its height (√(2Rh)); with ships to carry either and its fuel, any shore its people know is a field, and
  // every land seen from one is the next, so a world is charted base by base: as Earth's was from the air, decades before
  // its first orbit, and as sounding rockets went up from ships at sea. A world whose air lifts no wing still charts
  // itself so by rocket before it reaches orbit. Without ships, only their own lands are fields; what lies further than
  // a reach from any land stays dark until orbit.
  // A rocket thrown on an arc sees along it: before orbit, a land's best launcher reaches some share ν of orbit's
  // speed, and a ballistic arc's best range over a sphere is ψ with sin(ψ/2) = ν²/(2 − ν²) (ν = 0.9: some 9,500 km on
  // the home world, as Earth's first long-range rocket flew two months before its first orbit). Its sight is that
  // range and the horizon at its end.
  const climb = toOrbit(g.system.bodies[0]!),
    needs = [...new Set([...PROPULSION, ...FRAMES].flatMap((x) => x.needs))],
    throws = new Map<string, number>();
  const throwKm = (knows: (id: string) => boolean): number => {
    const key = needs.map((id) => (knows(id) ? 1 : 0)).join("");
    let km = throws.get(key);
    if (km === undefined) {
      if (launcherFor(knows, climb.total)) km = Math.PI * radiusKm;
      else {
        let lo = 0,
          hi = climb.total;
        for (let i = 0; i < 24; i++) {
          const mid = (lo + hi) / 2;
          if (launcherFor(knows, mid)) lo = mid;
          else hi = mid;
        }
        const nu = Math.min(1, Math.max(0, lo - climb.gravityLoss - climb.dragLoss) / climb.orbit),
          x = (nu * nu) / (2 - nu * nu);
        km = 2 * Math.asin(Math.min(1, x)) * radiusKm;
      }
      throws.set(key, km);
    }
    return km;
  };
  const reachOf = (s: (typeof sources)[number]) =>
    Math.max(
      s.knows("rocketry") ? rocketKm + throwKm(s.knows) : 0,
      engine && s.knows("powered-wings") && s.knows(engine.id) ? wingsKm : 0,
    );
  const sees = sources.filter((s) => reachOf(s) > 0);
  if (sees.length) {
    const km = Math.max(...sees.map(reachOf));
    by = sees.some((s) => s.knows("rocketry")) && rocketKm >= wingsKm ? "rocket" : "wings";
    const cellKm = radiusKm * Math.sqrt((4 * Math.PI) / n),
      steps = Math.max(1, Math.min(30000, Math.floor(km / cellKm))),
      hop = sees.some((s) => s.ships >= 1),
      left = new Int32Array(n).fill(-1),
      fields: number[] = [];
    const field = (c: number) => {
      known[c] = 1;
      if (left[c]! < steps) {
        left[c] = steps;
        fields.push(c);
      }
    };
    for (const s of sees) field(s.cell);
    if (hop) for (let c = 0; c < n; c++) if (known[c] && land(c)) field(c);
    for (let f = 0; f < fields.length; f++) {
      const c = fields[f]!,
        b = left[c]!;
      if (b <= 0) continue;
      for (let k = g.grid.offsets[c]!; k < g.grid.offsets[c + 1]!; k++) {
        const m = g.grid.neighbours[k]!;
        if (m >= n) continue;
        known[m] = 1;
        const next = hop && land(m) ? steps : b - 1;
        if (next > left[m]!) {
          left[m] = next;
          fields.push(m);
        }
      }
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
