// The planet universes: "earth" (the earthlike prior) and "alien" (the open prior).
// The globe view's frame carries the planet's fields once — they do not change
// until people change them — and the page colours them by whichever lens is on.
import { makePlanetWorld, homePlanet } from "../sim/index.ts";
import { BIOME_NAMES, BOUNDARY, DEPOSIT_KINDS, cellRef, type HomeWorld } from "../gen/index.ts";
import { EARTHLIKE, OPEN, type Prior } from "../rules/index.ts";
import type { World } from "../kernel/index.ts";
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
    frames: { globe: (world) => globeFrame(world) },
    queries: {
      "planet.summary": (world) => summary(homePlanet(world).generated),
      cell: (world, args) => cell(homePlanet(world).generated, (args as { cell: number }).cell),
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
