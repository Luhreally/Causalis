// The whole galaxy, as drawn (Phase 8 M80): its shape from the galaxy's own numbers — a
// bulge of old yellow stars at the middle, a thin disk thinning outward by its scale
// length, the young blue stars crowding its spiral arms — as a scatter of points, keyed so
// it always looks the same. Scenery: where the real stars lie, the host says when asked.
// One unit is a thousand light-years; the disk lies in x–z (the galaxy's x, y), home off
// the middle where the galaxy puts it.
import { finish, mix } from "../kernel/index.ts";
import type { GalaxyPlan } from "../bridge/index.ts";

/** Light-years to a unit. */
export const GALAXY_LY = 1000;

export type GalaxyPoints = {
  /** x, y, z a star (units). */
  readonly positions: Float32Array;
  /** r, g, b, a a star. */
  readonly colors: Uint8Array;
  readonly count: number;
  /** Where home lies (units). */
  readonly home: { readonly x: number; readonly z: number };
};

const unit = (key: number, i: number, j: number) =>
  (finish(mix(mix(key, i), j), 29) >>> 0) / 4294967296;

/** A roughly normal draw from two keyed uniforms. */
const normal = (a: number, b: number) =>
  Math.sqrt(-2 * Math.log(Math.max(1e-9, a))) * Math.cos(2 * Math.PI * b);

/** Where home lies on the drawn disk (units). */
export function homeOf(plan: GalaxyPlan): { x: number; z: number } {
  return {
    x: (plan.homeRadius * Math.cos(plan.homeAngle)) / GALAXY_LY,
    z: (plan.homeRadius * Math.sin(plan.homeAngle)) / GALAXY_LY,
  };
}

/** A point of the drawn disk (units) as light-years from home in the galaxy's plane. */
export function lyFromHome(plan: GalaxyPlan, x: number, z: number): { x: number; y: number } {
  const home = homeOf(plan);
  return { x: (x - home.x) * GALAXY_LY, y: (z - home.z) * GALAXY_LY };
}

/** The galaxy's stars as drawn: `count` of them, keyed by `key`. */
export function galaxyPoints(plan: GalaxyPlan, count: number, key = 7): GalaxyPoints {
  const positions = new Float32Array(count * 3),
    colors = new Uint8Array(count * 4),
    R = plan.radius / GALAXY_LY,
    scale = plan.scale / GALAXY_LY,
    tan = Math.tan((plan.pitch * Math.PI) / 180),
    put = (i: number, x: number, y: number, z: number, rgb: readonly [number, number, number]) => {
      positions[3 * i] = x;
      positions[3 * i + 1] = y;
      positions[3 * i + 2] = z;
      colors[4 * i] = Math.round(rgb[0] * 255);
      colors[4 * i + 1] = Math.round(rgb[1] * 255);
      colors[4 * i + 2] = Math.round(rgb[2] * 255);
      colors[4 * i + 3] = 255;
    };
  for (let i = 0; i < count; i++) {
    const u = (j: number) => unit(key, i, j);
    if (u(0) < 0.16) {
      // The bulge: a squat swarm of old stars.
      const r = Math.abs(normal(u(1), u(2))) * R * 0.07,
        a = 2 * Math.PI * u(3),
        y = normal(u(4), u(5)) * R * 0.035,
        warm = 0.8 + 0.2 * u(6);
      put(i, r * Math.cos(a), y, r * Math.sin(a), [1, 0.78 * warm, 0.45 * warm]);
      continue;
    }
    // The disk: outward by its scale length, most stars on its arms.
    const r = Math.min(R, -scale * Math.log(Math.max(1e-6, u(1))) + 0.05 * R),
      onArm = u(2) < 0.62,
      armAngle =
        Math.log(Math.max(1, r * GALAXY_LY)) / tan +
        (2 * Math.PI * Math.floor(u(3) * plan.arms)) / plan.arms,
      a = onArm ? armAngle + normal(u(4), u(5)) * 0.22 : 2 * Math.PI * u(4),
      y = normal(u(6), u(7)) * 0.3,
      young = onArm && u(8) < 0.55;
    put(
      i,
      r * Math.cos(a),
      y,
      r * Math.sin(a),
      young
        ? [0.62 + 0.2 * u(9), 0.74 + 0.15 * u(9), 1]
        : [1, 0.92 - 0.12 * u(9), 0.78 - 0.2 * u(9)],
    );
  }
  return { positions, colors, count, home: homeOf(plan) };
}

/** A star in plain words, by its light (as history names them): a red dwarf, a yellow star, a white dwarf. */
export function starWords(s: { spectral: string; remnant: boolean }): string {
  if (s.remnant) return "a white dwarf";
  switch (s.spectral[0]) {
    case "O":
    case "B":
      return "a blue star";
    case "A":
      return "a white star";
    case "F":
      return "a yellow-white star";
    case "G":
      return "a yellow star";
    case "K":
      return "an orange star";
    default:
      return "a red dwarf";
  }
}
