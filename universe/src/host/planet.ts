// The planet universes: "earth" (the earthlike prior) and "alien" (the open prior).
// The globe view's frame carries the planet's fields once — they do not change
// until people change them — and the page colours them by whichever lens is on.
import { makePlanetWorld, homePlanet } from "../sim/index.ts";
import {
  BIOME_NAMES,
  BOUNDARY,
  DEPOSIT_KINDS,
  WATER,
  cellRef,
  refineRegion,
  type HomeWorld,
  type Region,
} from "../gen/index.ts";
import { EARTHLIKE, OPEN, type Prior } from "../rules/index.ts";
import { parseRef, type Ref, type World } from "../kernel/index.ts";
import type { Universe } from "./host.ts";

const BOUNDARY_WORDS = ["none", "converging", "spreading", "sliding"];

function globeFrame(world: World) {
  const g = homePlanet(world).generated,
    n = g.grid.count,
    deposit = new Int16Array(n).fill(-1);
  for (const d of g.deposits) deposit[d.cell] = DEPOSIT_KINDS.indexOf(d.kind);
  return {
    key: g.digest,
    meta: {
      frequency: g.grid.frequency,
      plates: g.tectonics.plates.map((p) => ({ continental: p.continental })),
      depositKinds: DEPOSIT_KINDS,
      biomeNames: BIOME_NAMES,
    },
    arrays: {
      elevation: Float32Array.from(g.tectonics.elevation),
      temperature: Float32Array.from(g.climate.temperature),
      precipitation: Float32Array.from(g.climate.precipitation),
      biome: Uint8Array.from(g.climate.biome),
      plate: Uint8Array.from(g.tectonics.plate),
      river: Uint8Array.from(g.water.river),
      lake: Uint8Array.from(g.water.lake),
      deposit: Uint8Array.from(deposit, (v) => (v < 0 ? 255 : v)),
    },
  };
}

// Regions are pure functions of the world and a cell: kept for re-use, never saved.
const REGIONS = new Map<string, Region>();
function region(g: HomeWorld, center: number): Region {
  if (!Number.isInteger(center) || center < 0 || center >= g.grid.count)
    throw new Error(`no place ${center}`);
  const key = `${g.digest}:${center}`;
  let r = REGIONS.get(key);
  if (!r) {
    if (REGIONS.size >= 4) REGIONS.delete(REGIONS.keys().next().value!);
    REGIONS.set(key, (r = refineRegion(g, center)));
  }
  return r;
}

function regionFrame(world: World, focus: string | null) {
  const g = homePlanet(world).generated,
    center = focus ? parseRef(focus as Ref).b : 0,
    r = region(g, center),
    deposit = new Uint8Array(r.size * r.size).fill(255);
  for (const d of r.deposits) deposit[d.tile] = DEPOSIT_KINDS.indexOf(g.deposits[d.deposit]!.kind);
  return {
    key: r.ref,
    meta: {
      ref: r.ref,
      center,
      size: r.size,
      tileKm: r.tileKm,
      lat: (g.grid.lat[center]! * 180) / Math.PI,
      lon: (g.grid.lon[center]! * 180) / Math.PI,
    },
    arrays: {
      elevation: Float32Array.from(r.elevation),
      biome: Uint8Array.from(r.biome),
      water: Uint8Array.from(r.water),
      fertility: Uint8Array.from(r.fertility, (f) => Math.round(f * 255)),
      deposit,
    },
  };
}

const WATER_WORDS = ["", "the sea", "a river", "a lake"];

function tile(g: HomeWorld, center: number, t: number) {
  const r = region(g, center);
  if (!Number.isInteger(t) || t < 0 || t >= r.size * r.size) throw new Error(`no tile ${t}`);
  const d = r.deposits.find((x) => x.tile === t),
    deposit = d ? g.deposits[d.deposit]! : null;
  return {
    tile: t,
    x: t % r.size,
    y: Math.floor(t / r.size),
    tileKm: r.tileKm,
    elevation: r.elevation[t]!,
    temperature: r.temperature[t]!,
    precipitation: r.precipitation[t]!,
    biome: BIOME_NAMES[r.biome[t]!],
    water: WATER_WORDS[r.water[t]!],
    fertility: r.fertility[t]!,
    parent: cellRef(0, r.parent[t]!),
    deposit: deposit
      ? {
          ref: deposit.ref,
          kind: deposit.kind,
          richness: deposit.richness,
          process: deposit.process,
        }
      : null,
    sea: r.water[t] === WATER.sea,
  };
}

function summary(g: HomeWorld) {
  const s = g.star,
    p = g.planet;
  return {
    prior: g.prior,
    star: {
      ref: s.ref,
      spectral: s.spectral,
      mass: s.mass,
      luminosity: s.luminosity,
      ageGyr: s.ageGyr,
    },
    planet: {
      ref: p.ref,
      mass: p.mass,
      gravity: p.gravity,
      orbitAu: p.orbitAu,
      yearDays: p.yearDays,
      dayHours: p.dayHours,
      tilt: p.tilt,
      meanTemperature: p.meanTemperature,
      oceanFraction: p.oceanFraction,
      plates: g.tectonics.plates.length,
    },
    deposits: g.deposits.length,
    cells: g.grid.count,
  };
}

function cell(g: HomeWorld, c: number) {
  if (!Number.isInteger(c) || c < 0 || c >= g.grid.count) throw new Error(`no place ${c}`);
  const t = g.tectonics,
    plate = t.plates[t.plate[c]!]!,
    d = g.deposits.find((x) => x.cell === c);
  return {
    cell: c,
    ref: cellRef(0, c),
    lat: (g.grid.lat[c]! * 180) / Math.PI,
    lon: (g.grid.lon[c]! * 180) / Math.PI,
    elevation: t.elevation[c]!,
    temperature: g.climate.temperature[c]!,
    seasonality: g.climate.seasonality[c]!,
    precipitation: g.climate.precipitation[c]!,
    biome: BIOME_NAMES[g.climate.biome[c]!],
    plate: { ref: plate.ref, index: plate.index, continental: plate.continental },
    boundary: t.toBoundary[c]! <= 3 ? BOUNDARY_WORDS[t.boundary[c]!] : "none",
    river: g.water.river[c] === 1,
    lake: g.water.lake[c] === 1,
    deposit: d ? { ref: d.ref, kind: d.kind, richness: d.richness, process: d.process } : null,
  };
}

function planetUniverse(name: string, prior: Prior): Universe {
  return {
    name,
    version: `${name}-1`,
    defaultView: "globe",
    build: (seed) => makePlanetWorld(seed, { prior }),
    frames: {
      globe: (world) => globeFrame(world),
      region: (world, interest) => regionFrame(world, interest.focus),
    },
    queries: {
      "planet.summary": (world) => summary(homePlanet(world).generated),
      cell: (world, args) => cell(homePlanet(world).generated, (args as { cell: number }).cell),
      tile: (world, args) => {
        const a = args as { center: number; tile: number };
        return tile(homePlanet(world).generated, a.center, a.tile);
      },
      deposits: (world) =>
        homePlanet(world).generated.deposits.map((d) => ({
          ref: d.ref,
          kind: d.kind,
          cell: d.cell,
          richness: d.richness,
        })),
    },
  };
}

export const EARTH = planetUniverse("earth", EARTHLIKE);
export const ALIEN = planetUniverse("alien", OPEN);
