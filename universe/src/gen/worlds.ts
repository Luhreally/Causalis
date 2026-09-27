// Worlds in depth (Phase 8 M81): any body of a star's system — the home star's other
// planets and moons, another star's worlds — made whole on demand from what is known of it
// (its mass and size, how far from its star, its warmth, its air and its water). A rocky
// world or moon gets plates and relief (a small or airless one its craters too), a climate
// by latitude, seas where its water lies liquid and ice where it lies frozen; a giant, the
// bands of its clouds and a storm. Pure and keyed: the same body is the same world on
// every engine, and looking at it never makes it part of history.
import {
  Rng,
  defineStream,
  dmath,
  seedFromText,
  sphereGrid,
  type SphereGrid,
} from "../kernel/index.ts";
import type { Planet, Star } from "./bodies.ts";
import { makeClimate } from "./climate.ts";
import { makeTectonics } from "./plates.ts";
import type { BodyKind, SystemBody } from "./system.ts";

const WORLDS = defineStream("gen.worlds");

/** The grid a world in depth is drawn on: 10,242 cells (a quarter of the home world's). */
export const WORLD_FREQUENCY = 32;

/** What a cell of a world is covered by: bare ground, sea, ice. */
export const COVER = { ground: 0, sea: 1, ice: 2 } as const;

export type OtherWorld = {
  readonly ref: string;
  readonly kind: BodyKind;
  readonly grid: SphereGrid;
  /** Relief above its datum (m) and warmth (°C), cell by cell; what covers each cell. */
  readonly elevation: Float32Array;
  readonly temperature: Float32Array;
  /** Rain a year (mm), where an air carries it. */
  readonly precipitation: Float32Array;
  readonly cover: Uint8Array;
  /** The craters stamped on it (an airless or small world's), and a giant's cloud bands and storm. */
  readonly craters: number;
  readonly bands: number;
  /** The storm's latitude (radians) and size (radians), a giant's. */
  readonly storm: { readonly lat: number; readonly lon: number; readonly size: number } | null;
  /** A keyed tint of its ground (0 … 1): which of its kind's colours its rock takes. */
  readonly tint: number;
};

/**
 * Make a body whole: `au` is its distance from its star (a moon's, its planet's), `seed`
 * the universe's (so another universe's same-named body is another world).
 */
export function otherWorld(
  body: SystemBody,
  star: Pick<Star, "luminosity" | "ref">,
  au: number,
  seed: string,
  frequency = WORLD_FREQUENCY,
): OtherWorld {
  const grid = sphereGrid(frequency),
    n = grid.count,
    rng = new Rng(seedFromText(`${seed} world ${body.ref}`)),
    u = (k: number) => rng.real(WORLDS, 0, 0, 0, k),
    giant = body.kind === "giant" || body.kind === "ice giant";
  if (giant) {
    // No ground: an even sphere of cloud tops, banded, a storm in one band.
    const bands = 4 + Math.floor(7 * u(0));
    return {
      ref: body.ref,
      kind: body.kind,
      grid,
      elevation: new Float32Array(n),
      temperature: new Float32Array(n).fill(body.temperature),
      precipitation: new Float32Array(n),
      cover: new Uint8Array(n),
      craters: 0,
      bands,
      storm:
        u(1) < 0.7
          ? { lat: (u(2) - 0.5) * 1.2, lon: u(3) * 2 * Math.PI, size: 0.08 + 0.12 * u(4) }
          : null,
      tint: u(5),
    };
  }
  // The planet record the ground's generators take: its own numbers, the rest keyed.
  const moon = body.kind === "moon",
    planet: Planet = {
      ref: body.ref,
      star: star.ref,
      orbitAu: au,
      yearDays: body.orbit.periodDays,
      // (A moon keeps a face to its planet: its day is its month.)
      dayHours: moon ? body.orbit.periodDays * 24 : 8 + 40 * u(0),
      tilt: moon ? 2 * u(1) : 35 * u(1),
      mass: body.mass,
      radius: body.radius,
      gravity: body.gravity,
      insolation: star.luminosity / (au * au),
      albedo: 0.3,
      greenhouse: 0,
      meanTemperature: body.temperature,
      oceanFraction:
        body.water === "seas" ? 0.35 + 0.45 * u(2) : body.water === "ice" ? 0.08 + 0.25 * u(2) : 0,
      // Small worlds cool to a single lid; large ones break into plates.
      plateCount: body.mass >= 0.3 ? 4 + Math.floor(9 * u(3)) : 2,
      continental: 0.3 + 0.3 * u(4),
    },
    tectonics = makeTectonics(grid, rng, planet),
    elevation = Float32Array.from(tectonics.elevation);
  // Craters where no thick air wore them away: many on the airless, fewer under thin air.
  const craters = body.air === "none" || body.air === "trace" ? 60 : body.air === "thin" ? 20 : 0;
  const P = grid.positions;
  for (let k = 0; k < craters; k++) {
    const z = 2 * rng.real(WORLDS, 1, k, 0, 0) - 1,
      a = 2 * Math.PI * rng.real(WORLDS, 1, k, 1, 0),
      r = Math.sqrt(1 - z * z),
      cx = r * dmath.cos(a),
      cy = z,
      cz = r * dmath.sin(a),
      // Sizes run from a few cells to a great basin, most of them small.
      size = 0.03 + 0.25 * dmath.pow(rng.real(WORLDS, 1, k, 2, 0), 3),
      depth = 800 + 3000 * size,
      rim = dmath.cos(size),
      outer = dmath.cos(size * 1.35);
    for (let c = 0; c < n; c++) {
      const dot = P[3 * c]! * cx + P[3 * c + 1]! * cy + P[3 * c + 2]! * cz;
      if (dot < outer) continue;
      // A bowl inside, a raised rim about it.
      elevation[c] =
        elevation[c]! +
        (dot >= rim
          ? (-depth * (dot - rim)) / (1 - rim)
          : depth * 0.3 * (1 - (rim - dot) / (rim - outer)));
    }
  }
  // (No colder than space itself allows.)
  const climate = makeClimate(grid, planet, elevation),
    temperature = climate.temperature.map((t) => Math.max(-270, t)),
    // Rain only where there are seas to raise it and an air to carry it.
    precipitation =
      body.water === "seas" ? Float32Array.from(climate.precipitation) : new Float32Array(n);
  // What covers it: seas where water lies liquid under its air, ice where it lies frozen
  // (and on the cold poles of a wet world).
  const cover = new Uint8Array(n),
    cap = Math.min(0.95, Math.max(0.5, 0.95 + body.temperature / 400));
  for (let c = 0; c < n; c++) {
    const low = elevation[c]! <= 0,
      t = temperature[c]!;
    cover[c] =
      body.water === "seas"
        ? low
          ? t < -2
            ? COVER.ice
            : COVER.sea
          : t < -12
            ? COVER.ice
            : COVER.ground
        : body.water === "ice"
          ? // Frozen seas in the lowlands, and caps about the poles — wider the colder it is.
            low || Math.abs(grid.positions[3 * c + 1]!) > cap
            ? COVER.ice
            : COVER.ground
          : COVER.ground;
  }
  return {
    ref: body.ref,
    kind: body.kind,
    grid,
    elevation,
    temperature,
    precipitation,
    cover,
    craters,
    bands: 0,
    storm: null,
    tint: u(5),
  };
}
