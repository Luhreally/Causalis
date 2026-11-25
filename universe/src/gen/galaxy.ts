// The galaxy and the playable cluster (docs/architecture §27, Phase 6 M56). The galaxy's
// shape comes from the seed (its disk, its arms, where home lies in it); its stars are not
// stored but drawn where they are needed: space is cut into cubes ten light-years a side,
// each holding as many stars as the density there makes likely (a keyed Poisson draw), and
// star k of sector s is a pure function of (seed, s, k) — untouched stars cost nothing.
// The cluster is the few thousand stars within some fifty light-years of home: the part of
// the galaxy that can be lived in. Home is star 0 of sector 0, as it has always been.
import { defineStream, dmath, makeRef, type Ref, type Rng } from "../kernel/index.ts";
import { STAR_LIFE, roguesAStar, starLifetime } from "../rules/index.ts";
import { STAR } from "./kinds.ts";

const GALAXY = defineStream("gen.galaxy");
/** The young clusters' own draws (the sweep, Nature lane): no draw of the field's stars moves. */
const NURSERY = defineStream("gen.galaxy.nursery");

/**
 * Where stars are being born now (the sweep, Nature lane). The galaxy's field stars were born over its twelve billion years
 * (their ages drawn evenly over them, as before), and a star of eight Suns lives some fifty million: so every heavy field star
 * is long dead. Heavy stars shine only where star-forming is recent: in young clusters, born together out of one cloud in the
 * arms' crests and scattered within a hundred million years (Lada & Lada 2003: most stars are born in such clusters). Some
 * half a percent of the disk's stars are younger than that (est: the Milky Way's present star-forming, some two Suns a year,
 * against its stars, some fifty billion Suns: 0.1 Gyr × 2 / 50 ≈ 0.4%); a sector at an arm's crest holds a cluster this often,
 * one between arms none.
 */
export const NURSERIES = {
  /** A sector's chance of holding a young cluster, at an arm's crest (its mean over the disk some three eighths of this). */
  chance: 0.0012,
  /** Its members, on the mean (the field's own stars of the sector besides). */
  stars: 40,
  /** Its age, billions of years: from a cluster just out of its cloud to one scattering. */
  youngest: 0.002,
  oldest: 0.1,
  /** Its members' births spread about its age, as a share of it. */
  spread: 0.1,
  /** Under this age (billions of years) a star's worlds are still forming, molten, under the rain of what is left over. */
  forming: 0.1,
} as const;

/** The most stars a sector holds (a star's key in its sector is below 64: gen/system.ts foreignPlanets). */
const SECTOR_MOST = 63;

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
  /** How much of its hydrogen a star of its universe burns against ours (rules/laws.ts; absent: ours). */
  readonly burn?: number;
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

export function makeGalaxy(rng: Rng, burn = 1): Galaxy {
  const u = (n: number) => rng.real(GALAXY, 0, 0, 0, n);
  const radius = 40_000 + 30_000 * u(0);
  return {
    // (Its universe's stars' burning, where not ours: rules/laws.ts.)
    ...(burn !== 1 ? { burn } : {}),
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

/** Where a place (ly from home) lies against the arms: 1 at an arm's crest, −1 midway between two. */
export function armAt(g: Galaxy, x: number, y: number): number {
  const hx = g.homeRadius * dmath.cos(g.homeAngle) + x,
    hy = g.homeRadius * dmath.sin(g.homeAngle) + y,
    r = Math.sqrt(hx * hx + hy * hy),
    theta = dmath.atan2(hy, hx);
  // The arms: a logarithmic spiral, stars a quarter denser along it.
  return dmath.cos(
    g.arms * (theta - dmath.log(Math.max(1, r)) / dmath.tan((g.pitch * Math.PI) / 180)),
  );
}

/** Stars a cubic light-year at a place (ly from home): the disk thins upward and outward. */
export function densityAt(g: Galaxy, x: number, y: number, z: number): number {
  const hx = g.homeRadius * dmath.cos(g.homeAngle) + x,
    hy = g.homeRadius * dmath.sin(g.homeAngle) + y,
    r = Math.sqrt(hx * hx + hy * hy),
    arm = armAt(g, x, y),
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

/**
 * The stars of a galaxy's whole disk (its density summed over it: the disk thinning outward by its scale length and upward by a
 * thousand light-years), and the worlds without a star that drift among them: what each star's giants threw out
 * (rules/rings.ts), for a star of the mean mass of the stars' births.
 */
export function galaxyStars(g: Galaxy): number {
  return (
    LOCAL_DENSITY * dmath.exp(g.homeRadius / g.scale) * 2 * Math.PI * g.scale * g.scale * 2 * 1000
  );
}
export function galaxyRogues(g: Galaxy): number {
  let mass = 0;
  for (let i = 0; i < 64; i++) mass += imfMass((i + 0.5) / 64) / 64;
  return galaxyStars(g) * roguesAStar(mass);
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
      mass = imfMass(u(3));
    out.push(starOf(g, id, s, x, y, z, mass, 0.2 + 12 * u(4)));
  }
  // A young cluster, where the sector holds one (never home's own: home's neighbours are as they were).
  if (id === 0) return out;
  const crest = (1 + armAt(g, cx, cy)) / 2,
    v = (m: number) => rng.real(NURSERY, id, 0, 0, m);
  if (v(0) >= NURSERIES.chance * crest * crest) return out;
  const age = NURSERIES.youngest + (NURSERIES.oldest - NURSERIES.youngest) * v(1),
    members = Math.min(
      SECTOR_MOST - out.length - first,
      poisson(NURSERIES.stars, (m) => rng.real(NURSERY, id, 1, 0, m)),
    );
  for (let s = out.length + first, last = s + members; s < last; s++) {
    const u = (m: number) => rng.real(NURSERY, id, 2, s, m),
      x = i * SECTOR_LY - SECTOR_LY / 2 + SECTOR_LY * u(0),
      y = j * SECTOR_LY - SECTOR_LY / 2 + SECTOR_LY * u(1),
      z = k * SECTOR_LY - SECTOR_LY / 2 + SECTOR_LY * u(2);
    out.push(
      starOf(g, id, s, x, y, z, imfMass(u(3)), age * (1 + NURSERIES.spread * (2 * u(4) - 1))),
    );
  }
  return out;
}

/** A star by its mass and age: shining, or what is left of it past its life (a white dwarf, or past eight Suns a neutron star). */
function starOf(
  g: Galaxy,
  id: number,
  s: number,
  x: number,
  y: number,
  z: number,
  mass: number,
  age: number,
): GalaxyStar {
  const lifetime = starLifetime(mass, g.burn),
    remnant = age > lifetime,
    luminosity = remnant ? 0.001 : mass < 0.43 ? 0.23 * dmath.pow(mass, 2.3) : dmath.pow(mass, 4),
    radius = remnant ? 0.012 : dmath.pow(mass, 0.8),
    temperature = remnant ? 8000 : 5778 * dmath.pow(luminosity / (radius * radius), 0.25);
  return {
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
    spectral: remnant
      ? mass >= STAR_LIFE.supernova
        ? "neutron star"
        : "white dwarf"
      : spectralOf(temperature),
    ageGyr: age,
    remnant,
  };
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
