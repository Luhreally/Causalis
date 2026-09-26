// The galaxy and the playable cluster (docs/architecture §27, Phase 6 M56). The galaxy's
// shape comes from the seed (its disk, its arms, where home lies in it); its stars are not
// stored but drawn where they are needed: space is cut into cubes ten light-years a side,
// each holding as many stars as the density there makes likely (a keyed Poisson draw), and
// star k of sector s is a pure function of (seed, s, k) — untouched stars cost nothing.
// The cluster is the few thousand stars within some fifty light-years of home: the part of
// the galaxy that can be lived in. Home is star 0 of sector 0, as it has always been.
import { defineStream, dmath, makeRef, type Ref, type Rng } from "../kernel/index.ts";
import { STAR } from "./kinds.ts";

const GALAXY = defineStream("gen.galaxy");

/** The side of a sector, light-years. */
export const SECTOR_LY = 10;
/** Stars a cubic light-year near home, of every kind (the Sun's neighbourhood holds about this many). */
export const LOCAL_DENSITY = 0.004;
/** The cluster's radius, light-years. */
export const CLUSTER_LY = 50;

export type Galaxy = {
  /** The disk's radius and its scale length, light-years; how many spiral arms, and their pitch (degrees). */
  readonly radius: number;
  readonly scale: number;
  readonly arms: number;
  readonly pitch: number;
  /** Where home lies: its distance from the centre (ly) and angle round it (radians). */
  readonly homeRadius: number;
  readonly homeAngle: number;
};

export type GalaxyStar = {
  readonly ref: Ref;
  readonly sector: number;
  readonly k: number;
  /** Where it is, light-years from home (x, y in the disk's plane, z above it). */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly distance: number;
  /** Solar masses and luminosities; surface temperature (K); spectral class. */
  readonly mass: number;
  readonly luminosity: number;
  readonly temperature: number;
  readonly spectral: string;
  readonly ageGyr: number;
  /** A star past its own life: a white dwarf, dim and without living worlds. */
  readonly remnant: boolean;
};

export function makeGalaxy(rng: Rng): Galaxy {
  const u = (n: number) => rng.real(GALAXY, 0, 0, 0, n);
  const radius = 40_000 + 30_000 * u(0);
  return {
    radius,
    scale: radius * (0.18 + 0.06 * u(1)),
    arms: 2 + Math.floor(3 * u(2)),
    pitch: 10 + 15 * u(3),
    homeRadius: radius * (0.45 + 0.2 * u(4)),
    homeAngle: 2 * Math.PI * u(5),
  };
}

/** A sector's id from its cube (zig-zag coded, so home's sector is 0). */
export function sectorId(i: number, j: number, k: number): number {
  const zig = (n: number) => (n >= 0 ? 2 * n : -2 * n - 1);
  return zig(i) + zig(j) * 1024 + zig(k) * 1024 * 1024;
}

/** Stars a cubic light-year at a place (ly from home): the disk thins upward and outward. */
export function densityAt(g: Galaxy, x: number, y: number, z: number): number {
  const hx = g.homeRadius * dmath.cos(g.homeAngle) + x,
    hy = g.homeRadius * dmath.sin(g.homeAngle) + y,
    r = Math.sqrt(hx * hx + hy * hy),
    theta = dmath.atan2(hy, hx),
    // The arms: a logarithmic spiral, stars a quarter denser along it.
    arm = dmath.cos(
      g.arms * (theta - dmath.log(Math.max(1, r)) / dmath.tan((g.pitch * Math.PI) / 180)),
    ),
    disk =
      dmath.exp(-(r - g.homeRadius) / g.scale) * dmath.exp(-Math.abs(z) / 1000) * (1 + 0.25 * arm);
  return (
    (LOCAL_DENSITY * Math.max(0, disk)) /
    (1 +
      0.25 *
        dmath.cos(
          g.arms * (g.homeAngle - dmath.log(g.homeRadius) / dmath.tan((g.pitch * Math.PI) / 180)),
        ))
  );
}

/** A Poisson draw of mean m from one uniform (by the product of uniforms, keyed). */
function poisson(m: number, u: (n: number) => number): number {
  const limit = dmath.exp(-m);
  let n = 0,
    p = u(0);
  while (p > limit && n < 200) {
    n++;
    p *= u(n);
  }
  return n;
}

/**
 * A star's mass by the initial mass function (two power laws: most stars are small red
 * dwarfs, a few are bright and heavy), from a uniform draw.
 */
export function imfMass(u: number): number {
  // Kroupa: α = 1.3 from 0.08 to 0.5 solar masses, 2.3 from 0.5 to 20.
  const a1 = 1.3,
    a2 = 2.3,
    lo = 0.08,
    mid = 0.5,
    hi = 20,
    w1 = (dmath.pow(mid, 1 - a1) - dmath.pow(lo, 1 - a1)) / (1 - a1),
    // The second law joined to the first at 0.5.
    k2 = dmath.pow(mid, a2 - a1),
    w2 = (k2 * (dmath.pow(hi, 1 - a2) - dmath.pow(mid, 1 - a2))) / (1 - a2),
    x = u * (w1 + w2);
  const m =
    x < w1
      ? dmath.pow(x * (1 - a1) + dmath.pow(lo, 1 - a1), 1 / (1 - a1))
      : dmath.pow(((x - w1) * (1 - a2)) / k2 + dmath.pow(mid, 1 - a2), 1 / (1 - a2));
  return dmath.clamp(m, lo, hi);
}

function spectralOf(t: number): string {
  const classes: [number, string][] = [
    [30000, "O"],
    [10000, "B"],
    [7500, "A"],
    [6000, "F"],
    [5200, "G"],
    [3700, "K"],
    [0, "M"],
  ];
  return `${classes.find(([lo]) => t >= lo)![1]}V`;
}

/** The stars of one sector (never home: sector 0's first star is the home star, made elsewhere). */
export function sectorStars(rng: Rng, g: Galaxy, i: number, j: number, k: number): GalaxyStar[] {
  const id = sectorId(i, j, k),
    cx = (i + 0.5) * SECTOR_LY - SECTOR_LY / 2,
    cy = (j + 0.5) * SECTOR_LY - SECTOR_LY / 2,
    cz = (k + 0.5) * SECTOR_LY - SECTOR_LY / 2,
    mean = densityAt(g, cx, cy, cz) * SECTOR_LY * SECTOR_LY * SECTOR_LY,
    n = poisson(mean, (m) => rng.real(GALAXY, id, 1, 0, m)),
    out: GalaxyStar[] = [];
  // Home's own sector holds home (star 0) and its neighbours after it.
  const first = id === 0 ? 1 : 0;
  for (let s = first; s < n + first; s++) {
    const u = (m: number) => rng.real(GALAXY, id, 2, s, m),
      x = i * SECTOR_LY - SECTOR_LY / 2 + SECTOR_LY * u(0),
      y = j * SECTOR_LY - SECTOR_LY / 2 + SECTOR_LY * u(1),
      z = k * SECTOR_LY - SECTOR_LY / 2 + SECTOR_LY * u(2),
      mass = imfMass(u(3)),
      lifetime = 10 * dmath.pow(mass, -2.5),
      age = 0.2 + 12 * u(4),
      remnant = age > lifetime,
      luminosity = remnant ? 0.001 : mass < 0.43 ? 0.23 * dmath.pow(mass, 2.3) : dmath.pow(mass, 4),
      radius = remnant ? 0.012 : dmath.pow(mass, 0.8),
      temperature = remnant ? 8000 : 5778 * dmath.pow(luminosity / (radius * radius), 0.25);
    out.push({
      ref: makeRef(STAR, id, s),
      sector: id,
      k: s,
      x,
      y,
      z,
      distance: Math.sqrt(x * x + y * y + z * z),
      mass,
      luminosity,
      temperature,
      spectral: remnant ? "white dwarf" : spectralOf(temperature),
      ageGyr: age,
      remnant,
    });
  }
  return out;
}

/** The cluster: every star within `radius` light-years of home but home itself, nearest first. */
export function clusterStars(rng: Rng, g: Galaxy, radius = CLUSTER_LY): GalaxyStar[] {
  const reach = Math.ceil(radius / SECTOR_LY) + 1,
    out: GalaxyStar[] = [];
  for (let i = -reach; i <= reach; i++)
    for (let j = -reach; j <= reach; j++)
      for (let k = -reach; k <= reach; k++)
        for (const s of sectorStars(rng, g, i, j, k)) if (s.distance <= radius) out.push(s);
  return out.sort((a, b) => a.distance - b.distance || a.sector - b.sector || a.k - b.k);
}
