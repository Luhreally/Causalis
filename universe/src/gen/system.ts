// The home star's system (docs/architecture §24–25, Phase 5 M46): the other planets and
// the moons, from the seed and the prior, by textbook relations — orbits spaced outward
// from the home world, rock inside the frost line and gas giants beyond it, Kepler's
// third law for their years, surface gravity and escape speed from mass and radius,
// whether a body holds its air (its escape speed against the air's thermal speed), the
// warmth that air adds, where water lies as seas or ice, and how much of the star's and
// the sky's radiation reaches the ground. The home planet is the one already made; the
// others are drawn on a stream of their own, so the home world is untouched by them.
// Positions at any time are analytic (Kepler's equation), never integrated.
import { defineStream, dmath, type Ref, type Rng } from "../kernel/index.ts";
import { AU_KM, orbitXY, type Prior, type Range } from "../rules/index.ts";
import type { Planet, Star } from "./bodies.ts";
import { moonRef, planetRef } from "./kinds.ts";

const SYSTEM = defineStream("gen.system");

/** How much air a body keeps at its surface. */
export type Air = "none" | "trace" | "thin" | "thick" | "crushing" | "breathable";
/** Where its water lies. */
export type Water = "none" | "ice" | "seas";
export type BodyKind = "home" | "rocky" | "giant" | "ice giant" | "moon";

export type Orbit = {
  /** What it goes round: the star, or a planet. */
  readonly around: Ref;
  /** Semi-major axis: astronomical units about the star, thousands of km about a planet. */
  readonly a: number;
  readonly e: number;
  /** Argument of periapsis and mean anomaly at the chronicle's opening, radians. */
  readonly periapsis: number;
  readonly phase: number;
  /** Its year (or month, for a moon), days. */
  readonly periodDays: number;
};

export type SystemBody = {
  readonly ref: Ref;
  /** Its place in the list: the home world 0, the other planets outward, then the moons. */
  readonly index: number;
  /** A catalogue name: the planet's numeral outward from the star, a moon's letter after it. */
  readonly designation: string;
  readonly kind: BodyKind;
  readonly orbit: Orbit;
  /** Earth masses and radii; surface gravity in g; escape speed, km/s. */
  readonly mass: number;
  readonly radius: number;
  readonly gravity: number;
  readonly escape: number;
  /** Mean surface temperature, °C (at the cloud tops for a giant). */
  readonly temperature: number;
  /** Surface pressure, bar (a giant has no surface: its deep air is crushing). */
  readonly pressure: number;
  readonly air: Air;
  readonly water: Water;
  /** Radiation at the surface against the home world's (1). */
  readonly radiation: number;
  /** Why it is as it is, in words (each clause a textbook law read on its numbers). */
  readonly because: readonly string[];
};

export type StarSystem = {
  /** The frost line, AU: inside it rock, beyond it ice and gas. */
  readonly frostLine: number;
  /** Every body: the home world first, the other planets outward, then the moons. */
  readonly bodies: readonly SystemBody[];
};

/** The thermal speed of nitrogen at 300 K, km/s: a body must hold six times its air's to keep it. */
const THERMAL_300K = 0.517;

const draw = (rng: Rng, r: Range, subject: number, n: number) =>
  rng.range(r[0], r[1], SYSTEM, subject, 0, 0, n);

/** Radius from mass: rock, ice giants, and gas giants (whose size hardly grows with mass). */
function radiusOf(kind: BodyKind, mass: number): number {
  if (kind === "giant") return 11.2 * dmath.pow(mass / 318, 0.05);
  if (kind === "ice giant") return dmath.pow(mass, 0.48);
  return dmath.pow(mass, 0.27);
}

/** The Roman numeral of a planet's place outward from the star. */
function numeral(n: number): string {
  const r: [number, string][] = [
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let out = "";
  for (const [v, s] of r)
    while (n >= v) {
      out += s;
      n -= v;
    }
  return out;
}

/**
 * The ground of a body with no life on it: its equilibrium warmth from the star (at
 * `au`), whether its escape speed holds an air against the air's thermal speed, how
 * much air its volatiles make, the greenhouse warming of that air, its water and its
 * radiation.
 */
function surface(
  star: Star,
  kind: BodyKind,
  au: number,
  mass: number,
  radius: number,
  volatiles: number,
): Pick<SystemBody, "temperature" | "pressure" | "air" | "water" | "radiation" | "because"> {
  const because: string[] = [],
    albedo = kind === "giant" || kind === "ice giant" ? 0.4 : 0.25,
    flux = star.luminosity / (au * au),
    equilibrium = 278.6 * dmath.pow(flux, 0.25) * dmath.pow(1 - albedo, 0.25),
    escape = 11.19 * Math.sqrt(mass / radius);
  if (kind === "giant" || kind === "ice giant") {
    because.push(
      `${kind === "giant" ? "a giant of gas" : "a giant of ice"}: no ground under its air`,
    );
    return {
      temperature: equilibrium - 273.15,
      pressure: 1000,
      air: "crushing",
      water: "none",
      radiation: 50,
      because,
    };
  }
  // A body holds an air if its escape speed is six times the thermal speed of nitrogen
  // at its warmth; less, and the air boils away over the ages.
  const thermal = THERMAL_300K * Math.sqrt(equilibrium / 300),
    holds = escape >= 6 * thermal,
    // An air is the weight of its column: the volatiles a body gave off, gathered over a
    // surface its gravity sets, pressed down by that gravity — the square of its pull.
    gravity = mass / (radius * radius),
    made = volatiles * volatiles * 90 * gravity * gravity,
    pressure = holds ? made : Math.min(made, 0.0005 * volatiles);
  because.push(
    holds
      ? `its escape speed, ${escape.toFixed(1)} km/s, holds an air (six times ${thermal.toFixed(2)} km/s, the air's own speed at its warmth)`
      : `its escape speed, ${escape.toFixed(1)} km/s, is too low to hold an air at its warmth`,
  );
  // The warmth an air adds: about thirty-three degrees for one bar of the home world's
  // kind, rising less than in step with thicker air.
  const greenhouse = pressure > 0.001 ? 33 * dmath.pow(pressure, 0.6) : 0,
    temperature = equilibrium + greenhouse - 273.15;
  if (greenhouse > 100)
    because.push(`its thick air holds its warmth: ${Math.round(greenhouse)}° over the star's`);
  const air: Air =
    pressure < 0.001
      ? "none"
      : pressure < 0.05
        ? "trace"
        : pressure < 0.5
          ? "thin"
          : pressure < 10
            ? "thick"
            : "crushing";
  // Seas where it is warm enough to melt and its air presses on them; ice where cold
  // enough and water ever came (with volatiles, or beyond the frost line).
  const water: Water =
    temperature > 0 && temperature < 100 && pressure > 0.05 && volatiles > 0.2
      ? "seas"
      : temperature < 0 && (volatiles > 0.02 || au > 2.7 * Math.sqrt(star.luminosity))
        ? "ice"
        : "none";
  if (water === "ice") because.push("cold enough that its water lies frozen");
  if (water === "seas") because.push("warm enough, under its air, for water to lie in seas");
  // Radiation at the ground: the star's (by the light it gets) and the sky's, less what
  // an air stops (the home world's bar of air stops nearly all), against the home world's.
  const radiation = ((0.3 + 0.7 * flux) * dmath.exp(-4 * pressure)) / dmath.exp(-4);
  if (radiation > 3) because.push("too little air to stop the star's and the sky's radiation");
  return { temperature, pressure, air, water, radiation, because };
}

type Drawn = {
  a: number;
  mass: number;
  kind: BodyKind;
  volatiles: number;
  moons: number;
};

/**
 * The system of the home star: the home planet as made, the others drawn (from the
 * prior's template, or freely), and moons about them.
 */
export function makeSystem(rng: Rng, prior: Prior, star: Star, home: Planet): StarSystem {
  const sp = prior.system,
    frostLine = 2.7 * Math.sqrt(star.luminosity),
    others: Drawn[] = [];
  if (sp.template) {
    sp.template.forEach((t, i) =>
      others.push({
        a: home.orbitAu * draw(rng, t.a, 10 + i, 0),
        mass: draw(rng, t.mass, 10 + i, 1),
        kind: t.kind,
        volatiles: draw(rng, t.volatiles, 10 + i, 2),
        moons: Math.round(draw(rng, t.moons, 10 + i, 3)),
      }),
    );
  } else {
    const inner = Math.round(draw(rng, sp.inner, 1, 0)),
      outer = Math.round(draw(rng, sp.outer, 1, 1));
    let a = home.orbitAu;
    for (let i = 0; i < inner; i++) {
      a /= draw(rng, sp.spacing, 20 + i, 0);
      if (a < 0.04) break;
      others.push({
        a,
        mass: draw(rng, [0.03, 2.5], 20 + i, 1),
        kind: "rocky",
        // Most worlds keep little to make an air of; a few a great deal.
        volatiles: dmath.pow(draw(rng, [0, 1], 20 + i, 2), 3),
        moons: Math.round(draw(rng, [0, 1.2], 20 + i, 3)),
      });
    }
    a = home.orbitAu;
    for (let i = 0; i < outer; i++) {
      a *= draw(rng, sp.spacing, 40 + i, 0);
      // Past the frost line ice gathers too: gas giants first, then giants of ice.
      const kind: BodyKind = a < frostLine ? "rocky" : a < 3.5 * frostLine ? "giant" : "ice giant";
      others.push({
        a,
        mass:
          kind === "rocky"
            ? draw(rng, [0.03, 2], 40 + i, 1)
            : kind === "giant"
              ? draw(rng, [40, 900], 40 + i, 1)
              : draw(rng, [8, 30], 40 + i, 1),
        kind,
        volatiles: dmath.pow(draw(rng, [0, 1], 40 + i, 2), 3),
        moons: Math.round(
          kind === "rocky"
            ? draw(rng, [0, 2.4], 40 + i, 3)
            : kind === "giant"
              ? draw(rng, [2, 6], 40 + i, 3)
              : draw(rng, [1, 4], 40 + i, 3),
        ),
      });
    }
  }
  // Every planet numbered outward from the star (the home world among them).
  const homeMoons = Math.round(draw(rng, sp.homeMoons, 0, 0)),
    all = [
      ...others.map((d, i) => ({ d, i: i + 1 })),
      {
        d: {
          a: home.orbitAu,
          mass: home.mass,
          kind: "home" as BodyKind,
          volatiles: 0,
          moons: homeMoons,
        },
        i: 0,
      },
    ].sort((x, y) => x.d.a - y.d.a || x.i - y.i),
    place = new Map(all.map((x, k) => [x.i, numeral(k + 1)]));
  const planets: { body: SystemBody; moons: number }[] = [
    {
      moons: homeMoons,
      body: {
        ref: planetRef(0),
        index: 0,
        designation: place.get(0)!,
        kind: "home",
        orbit: {
          around: star.ref as Ref,
          a: home.orbitAu,
          e: draw(rng, [0, 0.03], 2, 0),
          periapsis: draw(rng, [0, dmath.TAU], 2, 1),
          phase: draw(rng, [0, dmath.TAU], 2, 2),
          periodDays: home.yearDays,
        },
        mass: home.mass,
        radius: home.radius,
        gravity: home.gravity,
        escape: 11.19 * Math.sqrt(home.mass / home.radius),
        temperature: home.meanTemperature,
        pressure: 1,
        air: "breathable",
        water: "seas",
        radiation: 1,
        because: ["the world the people arose on, its air made breathable by its life"],
      },
    },
  ];
  // The other planets in the order they were drawn (their ordinals stay put however
  // they number outward).
  others.forEach((p, k) => {
    const n = k + 1,
      radius = radiusOf(p.kind, p.mass),
      s = surface(star, p.kind, p.a, p.mass, radius, p.volatiles),
      subject = 100 + n;
    planets.push({
      moons: p.moons,
      body: {
        ref: planetRef(n),
        index: n,
        designation: place.get(n)!,
        kind: p.kind,
        orbit: {
          around: star.ref as Ref,
          a: p.a,
          e: draw(rng, [0, p.kind === "rocky" ? 0.2 : 0.08], subject, 0),
          periapsis: draw(rng, [0, dmath.TAU], subject, 1),
          phase: draw(rng, [0, dmath.TAU], subject, 2),
          periodDays: 365.25 * Math.sqrt((p.a * p.a * p.a) / star.mass),
        },
        mass: p.mass,
        radius,
        gravity: p.mass / (radius * radius),
        escape: 11.19 * Math.sqrt(p.mass / radius),
        temperature: s.temperature,
        pressure: s.pressure,
        air: s.air,
        water: s.water,
        radiation: s.radiation,
        because: [
          p.a < frostLine
            ? `inside the frost line (${frostLine.toFixed(1)} AU), where only rock and metal gathered`
            : `beyond the frost line (${frostLine.toFixed(1)} AU), where ice gathered too`,
          ...s.because,
        ],
      },
    });
  });
  // Moons about each planet in turn, the home world's first.
  const bodies: SystemBody[] = planets.map((p) => p.body);
  let m = 0;
  for (const { body: parent, moons } of planets) {
    const giant = parent.kind === "giant" || parent.kind === "ice giant";
    // The first moon's distance in thousands of km, by the planet's size.
    let a = (parent.index === 0 ? 60 : giant ? 5 : 8) * parent.radius * 6.371;
    for (let j = 0; j < moons; j++) {
      const subject = 1000 + m,
        great = parent.index === 0 && j === 0,
        mass = great
          ? draw(rng, [0.008, 0.02], subject, 0)
          : giant
            ? draw(rng, [0.0003, 0.03], subject, 0)
            : draw(rng, [0.00001, 0.002], subject, 0),
        radius = radiusOf("moon", mass),
        // Few moons keep much to make an air of (one in the outer system in several).
        volatiles =
          parent.orbit.a > frostLine
            ? dmath.pow(draw(rng, [0, 1], subject, 1), 3)
            : draw(rng, [0, 0.1], subject, 1),
        s = surface(star, "moon", parent.orbit.a, mass, radius, volatiles);
      if (j > 0) a *= draw(rng, [1.5, 2.2], subject, 2);
      bodies.push({
        ref: moonRef(parent.index, j),
        index: bodies.length,
        designation: `${parent.designation}${String.fromCharCode(97 + j)}`,
        kind: "moon",
        orbit: {
          around: parent.ref,
          a,
          e: draw(rng, [0, 0.06], subject, 3),
          periapsis: draw(rng, [0, dmath.TAU], subject, 4),
          phase: draw(rng, [0, dmath.TAU], subject, 5),
          // Kepler's third law about the planet (the home world's great moon: about a month).
          periodDays: 27.32 * Math.sqrt(dmath.pow(a / 384.4, 3) / parent.mass),
        },
        mass,
        radius,
        gravity: mass / (radius * radius),
        escape: 11.19 * Math.sqrt(mass / radius),
        temperature: s.temperature,
        pressure: s.pressure,
        air: s.air,
        water: s.water,
        radiation: s.radiation,
        because: [`a moon of ${parent.designation}`, ...s.because],
      });
      m++;
    }
  }
  return { frostLine, bodies };
}

/** Where a body is at sim time t (seconds): about the star, in AU, in the plane of the system. */
export function positionAt(system: StarSystem, index: number, t: number): { x: number; y: number } {
  const b = system.bodies[index]!,
    { x, y } = orbitXY(b.orbit, t);
  if (b.kind !== "moon") return { x, y };
  // A moon's orbit is in thousands of km about its planet.
  const parent = system.bodies.findIndex((p) => p.ref === b.orbit.around),
    at = positionAt(system, parent, t),
    k = 1000 / AU_KM;
  return { x: at.x + x * k, y: at.y + y * k };
}
