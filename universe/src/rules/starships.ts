// Starships (docs/architecture §26, Phase 6 M57): the speed a ship can cruise at between
// the stars, from its drive by the rocket equation — half its speed-change spent getting
// up to speed, half braking at the far end — or, for a sail, what the beam behind it can
// give and a magnetic sail can take off at the end; and how long a crossing takes. Travel
// is slower than light; time's slowing below a third of light's speed is ignored.
import { dmath } from "../kernel/index.ts";
import { needsMet } from "./principles.ts";

/** Light's speed, km/s. */
export const LIGHT_KMS = 299_792;

export type StarDrive = {
  readonly id: string;
  readonly words: string;
  readonly needs: readonly string[];
  /** Exhaust speed as a share of light's (0: a sail, which carries no propellant). */
  readonly exhaust: number;
  /** A sail's cruise, as a share of light's. */
  readonly sail?: number;
};

export const STAR_DRIVES: readonly StarDrive[] = [
  { id: "fusion", words: "a fusion drive", needs: ["fusion-drive"], exhaust: 0.02 },
  {
    id: "sail",
    words: "a sail driven by beams of light",
    needs: ["beamed-sails"],
    exhaust: 0,
    sail: 0.12,
  },
  { id: "antimatter", words: "an antimatter drive", needs: ["antimatter-drive"], exhaust: 0.3 },
];

/** How much more a starship weighs full than empty, for each of its two burns. */
export const STAR_MASS_RATIO = 10;

/** A drive's cruising speed, as a share of light's. */
export function cruise(d: StarDrive): number {
  if (d.sail) return d.sail;
  // Both burns from one mass ratio each: up to speed, then down again.
  return Math.min(0.3, d.exhaust * dmath.log(STAR_MASS_RATIO));
}

/** The fastest drive a people who know these things can build, or null. */
export function starDriveFor(knows: (id: string) => boolean): StarDrive | null {
  let best: StarDrive | null = null;
  for (const d of STAR_DRIVES)
    if (needsMet(d, knows) && (!best || cruise(d) > cruise(best))) best = d;
  return best;
}

/** Years a crossing of `ly` light-years takes on a drive (the few years of speeding and braking included). */
export function crossingYears(ly: number, d: StarDrive): number {
  const v = cruise(d);
  // Speeding up and slowing down at a tenth of a g-ish: a year or so each for fast ships.
  return ly / v + 2 * Math.min(3, v * 10);
}

/** The longest crossing a people will send its own on: a sleeping crew, or generations. */
export function longestCrossing(knows: (id: string) => boolean): number {
  return knows("long-sleep") ? 300 : 120;
}
