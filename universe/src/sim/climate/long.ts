// The long ages of rain (E1): a world's rain swings slowly, over hundreds of years, in great belts that go round it, so a
// wet age here is a dry one elsewhere. No state: a pure function of the world, the land and the year. Its woods' edge goes
// with it, its people's fields a little too, its dry years come oftener. Read a world's worst before changing how far it
// swings: tools/e1-tally.ts.
import { defineStream, dmath } from "../../kernel/index.ts";
import { GROVE_LONG } from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";

const LONG = defineStream("climate.long");

type Swing = {
  /** A wave's direction across the globe (radians a world's radius) and its phase; its period in years. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly phase: number;
  readonly years: number;
  readonly share: number;
};

// A world's own swings, by what it was generated from: a pure function, kept.
const KEPT = new Map<string, readonly Swing[]>();

function swingsOf(ctx: PopulationContext): readonly Swing[] {
  const key = ctx.generated.digest,
    kept = KEPT.get(key);
  if (kept) return kept;
  const { rng } = ctx.world,
    made = GROVE_LONG.waves.map(([years, wide, share], i) => {
      const a = rng.real(LONG, i, 0, 0) * 2 * Math.PI,
        b = (rng.real(LONG, i, 0, 1) - 0.5) * Math.PI,
        cosB = dmath.cos(b);
      return {
        x: wide * cosB * dmath.cos(a),
        y: wide * dmath.sin(b),
        z: wide * cosB * dmath.sin(a),
        phase: rng.real(LONG, i, 0, 2) * 2 * Math.PI,
        years: years * (0.8 + 0.4 * rng.real(LONG, i, 0, 3)),
        share,
      };
    });
  KEPT.set(key, made);
  if (KEPT.size > 16) KEPT.delete(KEPT.keys().next().value!);
  return made;
}

/** How a land's rain stands in this age, as a share of what it usually is (near 1, at most a little over a tenth away). */
export function longRain(ctx: PopulationContext, cell: number, year: number): number {
  const P = ctx.generated.grid.positions,
    px = P[3 * cell]!,
    py = P[3 * cell + 1]!,
    pz = P[3 * cell + 2]!;
  let sum = 0;
  for (const s of swingsOf(ctx))
    sum +=
      s.share *
      dmath.sin((2 * Math.PI * year) / s.years + s.phase + s.x * px + s.y * py + s.z * pz);
  return 1 + GROVE_LONG.swing * sum;
}
