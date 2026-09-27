// Provinces (docs/architecture §5, §24: A1 cells): the planet as the simulation lives
// on it. The world is generated on a fine grid (40,962 cells, about 110 km apart on an
// Earth-sized world) — its plates, relief, climate, rivers, deep past and life — and
// people live in provinces of a coarser grid (4,002 cells, about 350 km apart), each
// gathering the fine cells nearest it. A province is the same planet seen at the scale
// people's lands are reckoned at: its ground, climate and life are its fine cells'
// (their land's, where land is most of it), its deposits theirs, the beasts and grasses
// that live in any of them live in it. The fine world stays with it, for the globe the
// observer looks at and for the regions drawn around a province's centre.
import { Hasher, sphereGrid, type SphereGrid } from "../kernel/index.ts";
import { BIOME } from "./climate.ts";
import type { HomeWorld } from "./homeworld.ts";
import type { Deposit } from "./deposits.ts";
import { BOUNDARY } from "./plates.ts";
import { SPECIES_WORDS } from "./biosphere.ts";

/** The province grid's frequency: 4,002 provinces over the whole planet. */
export const PROVINCE_FREQUENCY = 20;

/**
 * A land on another body of the system (Phase 5 M52): sealed halls a colony may be set
 * in. Offworld lands follow the planet's provinces in every per-land array (their data
 * the halls' inside: warm, watered, farmed under roofs, no wild), are neighbours only of
 * the other sites on their own body, and lie far from the planet's sphere.
 */
export type OffworldSite = {
  /** The body's index in the star's system (-1: a site kept for a ship and another star's world). */
  readonly body: number;
  /** Its place among its body's sites. */
  readonly site: number;
  /** The halls' floor, km². */
  readonly area: number;
};

/** Sites a colony may be set in on each body with ground, and the halls each holds (km²). */
export const SITES_PER_BODY = 3;
export const HALL_AREA = 2000;
/**
 * Lands kept for the ships that leave for other stars and the colonies they found there
 * (Phase 6 M59): which star and world each is set by the voyage, when it sails.
 */
export const STAR_SITES = 36;

export type ProvinceWorld = HomeWorld & {
  /** The world as generated, on its fine grid. */
  readonly fine: HomeWorld;
  /** For each fine cell, the province it belongs to. */
  readonly provinceOf: Int32Array;
  /** For each province, its fine cell nearest its centre (on its land, if it has land). */
  readonly centre: Int32Array;
  /** Each province's fine cells, in CSR form. */
  readonly childOffsets: Int32Array;
  readonly children: Int32Array;
  /** Lands on the system's other bodies, after the planet's own (cells base, base + 1, …). */
  readonly offworld: { readonly base: number; readonly sites: readonly OffworldSite[] };
};

/** The offworld site a land is, or null for a land of the planet. */
export function offworldSite(w: HomeWorld, cell: number): OffworldSite | null {
  if (!isProvinceWorld(w) || cell < w.offworld.base) return null;
  return w.offworld.sites[cell - w.offworld.base] ?? null;
}

export function isProvinceWorld(w: HomeWorld): w is ProvinceWorld {
  return "fine" in w;
}

/** The world as its people live on it: the fine world gathered into provinces. */
export function provinceWorld(fine: HomeWorld, frequency = PROVINCE_FREQUENCY): ProvinceWorld {
  const sphere = sphereGrid(frequency),
    n = sphere.count,
    // The system's bodies with ground to build on, three sites each.
    sites: OffworldSite[] = [];
  for (const b of fine.system.bodies)
    if (b.kind === "rocky" || b.kind === "moon")
      for (let s = 0; s < SITES_PER_BODY; s++)
        sites.push({ body: b.index, site: s, area: HALL_AREA });
  for (let s = 0; s < STAR_SITES; s++) sites.push({ body: -1, site: s, area: HALL_AREA });
  const N = n + sites.length,
    grid = withSites(sphere, sites, fine.planet.radius),
    f = fine.grid,
    P = grid.positions,
    FP = f.positions;
  // Each fine cell's province: a greedy walk to the nearest province centre.
  const provinceOf = new Int32Array(f.count);
  let near = 0;
  for (let c = 0; c < f.count; c++) {
    const x = FP[3 * c]!,
      y = FP[3 * c + 1]!,
      z = FP[3 * c + 2]!;
    for (;;) {
      let best = near,
        bestDot = P[3 * near]! * x + P[3 * near + 1]! * y + P[3 * near + 2]! * z;
      for (let k = grid.offsets[near]!; k < grid.offsets[near + 1]!; k++) {
        const m = grid.neighbours[k]!,
          d = P[3 * m]! * x + P[3 * m + 1]! * y + P[3 * m + 2]! * z;
        if (d > bestDot) {
          bestDot = d;
          best = m;
        }
      }
      if (best === near) break;
      near = best;
    }
    provinceOf[c] = near;
  }
  const childOffsets = new Int32Array(N + 1);
  for (let c = 0; c < f.count; c++) childOffsets[provinceOf[c]! + 1]!++;
  for (let p = 0; p < N; p++) childOffsets[p + 1] = childOffsets[p + 1]! + childOffsets[p]!;
  const children = new Int32Array(f.count),
    fill = childOffsets.slice(0, n);
  for (let c = 0; c < f.count; c++) children[fill[provinceOf[c]!]!++] = c;

  const t = fine.tectonics,
    cl = fine.climate,
    wa = fine.water,
    elevation = new Float32Array(N),
    temperature = new Float32Array(N),
    seasonality = new Float32Array(N),
    precipitation = new Float32Array(N),
    biome = new Uint8Array(N),
    plate = new Uint8Array(N),
    crust = new Uint8Array(N),
    boundary = new Uint8Array(N),
    across = new Int16Array(N).fill(-1),
    toBoundary = new Uint8Array(N).fill(255),
    river = new Uint8Array(N),
    lake = new Uint8Array(N),
    discharge = new Float32Array(N),
    filled = new Float32Array(N),
    flowTo = new Int32Array(N).fill(-1),
    coal = new Float32Array(N),
    oil = new Float32Array(N),
    coalAge = new Uint8Array(N).fill(255),
    oilAge = new Uint8Array(N).fill(255),
    present = new Uint32Array(SPECIES_WORDS * N),
    herdBeast = new Int16Array(N).fill(-1),
    seedGrass = new Int16Array(N).fill(-1),
    diversity = new Uint8Array(N),
    centre = new Int32Array(N).fill(-1);
  const life = fine.life,
    deep = fine.deep;
  for (let p = 0; p < n; p++) {
    const kids = children.subarray(childOffsets[p]!, childOffsets[p + 1]!);
    let landArea = 0,
      area = 0;
    for (const c of kids) {
      area += f.areas[c]!;
      if (t.elevation[c]! > 0) landArea += f.areas[c]!;
    }
    const land = landArea >= area / 2,
      own = [...kids].filter((c) => t.elevation[c]! > 0 === land);
    // Its ground and climate: its land's, if land is most of it; else its sea's.
    let wsum = 0,
      e = 0,
      temp = 0,
      season = 0,
      rain = 0;
    const biomes = new Map<number, number>();
    for (const c of own) {
      const a = f.areas[c]!;
      wsum += a;
      e += a * t.elevation[c]!;
      temp += a * cl.temperature[c]!;
      season += a * cl.seasonality[c]!;
      rain += a * cl.precipitation[c]!;
      biomes.set(cl.biome[c]!, (biomes.get(cl.biome[c]!) ?? 0) + a);
    }
    elevation[p] = e / wsum;
    // (A land province stands above the sea, however low its land.)
    if (land && elevation[p]! <= 0) elevation[p] = 1;
    temperature[p] = temp / wsum;
    seasonality[p] = season / wsum;
    precipitation[p] = rain / wsum;
    biome[p] = majority(biomes);
    // The plate, crust and nearest boundary of most of it.
    const plates = new Map<number, number>();
    let crustArea = 0,
      nearest = -1;
    for (const c of kids) {
      plates.set(t.plate[c]!, (plates.get(t.plate[c]!) ?? 0) + f.areas[c]!);
      if (t.crust[c]) crustArea += f.areas[c]!;
      if (nearest < 0 || t.toBoundary[c]! < t.toBoundary[nearest]!) nearest = c;
    }
    plate[p] = majority(plates);
    crust[p] = crustArea >= area / 2 ? 1 : 0;
    boundary[p] = t.boundary[nearest]!;
    across[p] = t.across[nearest]!;
    const steps = t.toBoundary[nearest]!;
    toBoundary[p] = steps === 255 ? 255 : Math.round(steps / 3.2);
    if (boundary[p] === BOUNDARY.none) toBoundary[p] = 255;
    // Its waters.
    let most = -1;
    for (const c of own) {
      if (wa.river[c]) river[p] = 1;
      if (wa.lake[c]) lake[p] = 1;
      if (most < 0 || wa.discharge[c]! > wa.discharge[most]!) most = c;
      filled[p] = Math.max(filled[p]!, wa.filled[c]!);
    }
    discharge[p] = wa.discharge[most]!;
    const down = wa.flowTo[most]!;
    if (land && down >= 0 && provinceOf[down] !== p) flowTo[p] = provinceOf[down]!;
    // What its deep past buried in it, and the age that buried most.
    let coalBest = -1,
      oilBest = -1;
    for (const c of kids) {
      coal[p] = coal[p]! + deep.coal[c]!;
      oil[p] = oil[p]! + deep.oil[c]!;
      if (deep.coal[c]! > coalBest) {
        coalBest = deep.coal[c]!;
        coalAge[p] = deep.coalAge[c]!;
      }
      if (deep.oil[c]! > oilBest) {
        oilBest = deep.oil[c]!;
        oilAge[p] = deep.oilAge[c]!;
      }
    }
    // What lives in any of it lives in it; the best of what can be tamed or sown.
    let beastWorth = -1,
      grassWorth = -1;
    for (const c of kids) {
      for (let w = 0; w < SPECIES_WORDS; w++)
        present[SPECIES_WORDS * p + w] =
          present[SPECIES_WORDS * p + w]! | life.present[SPECIES_WORDS * c + w]!;
      diversity[p] = Math.max(diversity[p]!, life.diversity[c]!);
      const beast = life.herdBeast[c]!,
        grass = life.seedGrass[c]!;
      if (beast >= 0) {
        const s = life.species[beast]!,
          worth = s.docility * s.growth;
        if (worth > beastWorth || (worth === beastWorth && beast < herdBeast[p]!)) {
          beastWorth = worth;
          herdBeast[p] = beast;
        }
      }
      if (grass >= 0) {
        const worth = life.species[grass]!.seed;
        if (worth > grassWorth || (worth === grassWorth && grass < seedGrass[p]!)) {
          grassWorth = worth;
          seedGrass[p] = grass;
        }
      }
    }
    // Its centre: the fine cell of its own ground nearest its middle.
    let best = own[0]!,
      bestDot = -Infinity;
    for (const c of own) {
      const d =
        P[3 * p]! * FP[3 * c]! + P[3 * p + 1]! * FP[3 * c + 1]! + P[3 * p + 2]! * FP[3 * c + 2]!;
      if (d > bestDot) {
        bestDot = d;
        best = c;
      }
    }
    centre[p] = best;
  }

  // The offworld halls inside: warm, watered, farmed, no wild; ground, not sea.
  for (let p = n; p < N; p++) {
    elevation[p] = 200;
    temperature[p] = 18;
    precipitation[p] = 800;
    biome[p] = BIOME.halls;
    crust[p] = 1;
  }
  // Steps inland, reckoned between provinces.
  const inland = new Uint8Array(N).fill(255),
    queue: number[] = [];
  for (let p = 0; p < n; p++)
    if (elevation[p]! <= 0) {
      inland[p] = 0;
      queue.push(p);
    }
  for (let h = 0; h < queue.length; h++) {
    const p = queue[h]!;
    for (let k = grid.offsets[p]!; k < grid.offsets[p + 1]!; k++) {
      const m = grid.neighbours[k]!;
      if (inland[m] === 255) {
        inland[m] = Math.min(254, inland[p]! + 1);
        queue.push(m);
      }
    }
  }
  const hotspots = [...new Set(t.hotspots.map((c) => provinceOf[c]!))].sort((a, b) => a - b);
  const deposits: Deposit[] = fine.deposits.map((d) => ({
    ...d,
    cell: provinceOf[d.cell]!,
    detail: { ...d.detail, spot: d.cell },
  }));
  const people = life.people ? { ...life.people, cell: provinceOf[life.people.cell]! } : null;
  return {
    prior: fine.prior,
    star: fine.star,
    planet: fine.planet,
    system: fine.system,
    grid,
    tectonics: {
      plates: t.plates,
      plate,
      crust,
      boundary,
      across,
      toBoundary,
      elevation,
      hotspots,
    },
    climate: { temperature, seasonality, precipitation, inland, bands: cl.bands, biome },
    water: { flowTo, discharge, river, lake, filled },
    deposits,
    deep: { ages: deep.ages, coal, oil, coalAge, oilAge },
    life: { species: life.species, present, herdBeast, seedGrass, diversity, people },
    digest: new Hasher().string(fine.digest).string("provinces").int(frequency).hex(),
    ground: fine.ground,
    fine,
    provinceOf,
    centre,
    childOffsets,
    children,
    offworld: { base: n, sites },
  };
}

/**
 * The province grid with the offworld sites after the planet's cells: each site a
 * neighbour of the others on its body, far off the sphere, its halls' floor its area.
 * The planet's own cells and count are as they were.
 */
function withSites(g: SphereGrid, sites: readonly OffworldSite[], radius: number): SphereGrid {
  const n = g.count,
    N = n + sites.length,
    positions = new Float64Array(3 * N),
    areas = new Float64Array(N),
    lat = new Float64Array(N),
    lon = new Float64Array(N),
    offsets = new Int32Array(N + 1),
    links: number[] = [];
  positions.set(g.positions);
  areas.set(g.areas);
  lat.set(g.lat);
  lon.set(g.lon);
  offsets.set(g.offsets);
  const rKm = 6371 * radius;
  for (let i = 0; i < sites.length; i++) {
    const c = n + i,
      s = sites[i]!;
    // Far from the planet (a hundred radii out, by body), so nothing there is near home.
    positions[3 * c] = 100 + s.body;
    positions[3 * c + 1] = 100;
    positions[3 * c + 2] = 100 + s.site;
    areas[c] = s.area / (rKm * rKm);
    for (let j = 0; j < sites.length; j++)
      // Sites on one body are neighbours; a ship's or another star's site stands alone.
      if (j !== i && s.body >= 0 && sites[j]!.body === s.body) links.push(n + j);
    offsets[c + 1] = g.neighbours.length + links.length;
  }
  const neighbours = new Int32Array(g.neighbours.length + links.length);
  neighbours.set(g.neighbours);
  neighbours.set(links, g.neighbours.length);
  return { ...g, positions, areas, lat, lon, offsets, neighbours };
}

/** The key with the greatest weight (ties to the lowest key). */
function majority(weights: Map<number, number>): number {
  let best = -1,
    most = -Infinity;
  for (const [k, w] of weights)
    if (w > most || (w === most && k < best)) {
      best = k;
      most = w;
    }
  return best;
}
