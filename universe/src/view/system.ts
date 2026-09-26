// The system view (Phase 5 M46): the star and its worlds laid out for the eye. A pure
// function of the plan and the time. Distances are drawn by their square root against
// the home world's (so the small inner worlds and the far giants share one screen);
// moons are set just beyond their planet, in the direction they truly lie; sizes by the
// fifth root of the radius. Units are scene units on the plane y = 0.
import { orbitXY } from "../rules/index.ts";
import type { SystemPlan, SystemPlanBody } from "../bridge/index.ts";

export type Rgb = readonly [number, number, number];

export type SystemSpot = {
  readonly index: number;
  readonly x: number;
  readonly z: number;
  readonly size: number;
  readonly color: Rgb;
};

/** The scene distance of the home world from the star. */
export const HOME_DISTANCE = 6;
export const STAR_SIZE = 0.7;

/** A body's colour, from what it is: seas and life, heat, ice, gas. */
export function bodyColor(b: SystemPlanBody): Rgb {
  if (b.kind === "home") return [0.25, 0.5, 0.85];
  if (b.kind === "giant") return [0.8, 0.68, 0.5];
  if (b.kind === "ice giant") return [0.55, 0.75, 0.85];
  if (b.temperature > 300) return [0.9, 0.75, 0.45];
  if (b.water === "ice") return [0.85, 0.88, 0.92];
  if (b.water === "seas") return [0.3, 0.55, 0.7];
  if (b.air === "thick" || b.air === "crushing") return [0.85, 0.7, 0.4];
  return b.temperature > 50 ? [0.6, 0.55, 0.5] : [0.72, 0.45, 0.35];
}

/** A body's drawn size. */
export function bodySize(b: SystemPlanBody): number {
  return 0.24 * Math.pow(b.radius, 0.35) * (b.kind === "moon" ? 0.8 : 1);
}

/** How far out the farthest planet is drawn (for fitting the camera). */
export function systemExtent(plan: SystemPlan): number {
  const home = plan.bodies[0]!.a;
  let far = home;
  for (const b of plan.bodies) if (b.around < 0) far = Math.max(far, b.a * (1 + b.e));
  return HOME_DISTANCE * Math.sqrt(far / home);
}

function compress(x: number, y: number, home: number): { x: number; z: number } {
  const r = Math.hypot(x, y);
  if (r === 0) return { x: 0, z: 0 };
  const k = (HOME_DISTANCE * Math.sqrt(r / home)) / r;
  return { x: x * k, z: y * k };
}

/** Where each body is drawn at sim time t. */
export function systemSpec(plan: SystemPlan, t: number): SystemSpot[] {
  const home = plan.bodies[0]!.a,
    at: { x: number; z: number }[] = [];
  const out: SystemSpot[] = [];
  plan.bodies.forEach((b, i) => {
    const p = orbitXY(b, t);
    if (b.around < 0) at[i] = compress(p.x, p.y, home);
    else {
      // Beyond the planet's drawn size, a step further for each moon out.
      const parent = plan.bodies[b.around]!,
        base = at[b.around]!,
        order = plan.bodies.filter((m, j) => m.around === b.around && j < i).length,
        r = Math.hypot(p.x, p.y) || 1,
        d = bodySize(parent) + 0.18 + 0.16 * order;
      at[i] = { x: base.x + (p.x / r) * d, z: base.z + (p.y / r) * d };
    }
    out.push({ index: i, x: at[i]!.x, z: at[i]!.z, size: bodySize(b), color: bodyColor(b) });
  });
  return out;
}

/** Each planet's orbit as a ring of points (x, z pairs), drawn once. */
export function orbitRings(plan: SystemPlan, points = 96): Float32Array[] {
  const home = plan.bodies[0]!.a;
  return plan.bodies
    .filter((b) => b.around < 0)
    .map((b) => {
      const ring = new Float32Array(points * 2);
      for (let k = 0; k < points; k++) {
        const t = (k / points) * b.periodDays * 86_400,
          p = orbitXY({ ...b, phase: 0 }, t),
          c = compress(p.x, p.y, home);
        ring[k * 2] = c.x;
        ring[k * 2 + 1] = c.z;
      }
      return ring;
    });
}

/** A body's facts in words. */
export function bodyFacts(b: SystemPlanBody, star: SystemPlan["star"]): string[] {
  const around = b.around < 0 ? `the star (${star.spectral})` : "its planet";
  return [
    b.around < 0
      ? `${b.a.toFixed(2)} AU from ${around}; a year of ${b.periodDays >= 1000 ? `${(b.periodDays / 365.25).toFixed(1)} home years` : `${Math.round(b.periodDays)} days`}`
      : `${Math.round(b.a * 1000).toLocaleString("en")} km from ${around}; round it in ${b.periodDays.toFixed(1)} days`,
    `${b.mass >= 1 ? b.mass.toFixed(1) : b.mass.toPrecision(2)} times the home world's mass; gravity ${b.gravity.toFixed(2)} g; escape speed ${b.escape.toFixed(1)} km/s`,
    b.kind === "giant" || b.kind === "ice giant"
      ? `${Math.round(b.temperature)} °C at the cloud tops; no ground to stand on`
      : `${Math.round(b.temperature)} °C on the ground; ${b.air === "none" ? "no air" : `${b.air} air (${b.pressure < 0.01 ? b.pressure.toExponential(1) : b.pressure.toFixed(2)} bar)`}; ${b.water === "none" ? "no water" : b.water === "ice" ? "water as ice" : "seas"}`,
    b.kind === "giant" || b.kind === "ice giant"
      ? "its belts of radiation deadly"
      : `radiation ${b.radiation < 1.5 ? "about as at home" : `${Math.round(b.radiation)} times the home world's`}`,
  ];
}
