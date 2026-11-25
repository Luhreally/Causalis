// Launch economics from physics (docs/architecture §25, Phase 5 M48): the speed a rocket
// must gain to reach orbit from a world's ground — orbital speed from its gravity and
// radius, and what gravity and air take on the way up — and, by the rocket equation, what
// share of a launcher's mass reaches orbit for an engine's exhaust speed and a frame's dry
// weight, staged as best serves. A heavy world asks more speed than a weak engine can give
// at any price; it reaches orbit later, on a better drive, or not at all.
import { dmath } from "../kernel/index.ts";
import { needsMet } from "./principles.ts";

/** A world's ground as a launch needs it: pull (g), radius (home radii), air (bar). */
export type LaunchWorld = {
  readonly gravity: number;
  readonly radius: number;
  readonly pressure: number;
};

/** The speed to reach low orbit from the ground, km/s, and its parts. */
export function toOrbit(w: LaunchWorld): {
  orbit: number;
  gravityLoss: number;
  dragLoss: number;
  total: number;
} {
  // v = √(g R): 7.9 km/s for the home world.
  const orbit = Math.sqrt(w.gravity * 9.81 * w.radius * 6.371e6) / 1000,
    // Climbing out against the pull, the longer the stronger it is; pushing through air.
    gravityLoss = 1.3 * w.gravity,
    dragLoss = 0.2 * Math.sqrt(Math.max(0, w.pressure));
  return { orbit, gravityLoss, dragLoss, total: orbit + gravityLoss + dragLoss };
}

/** An engine: what it needs known, its exhaust speed (km/s) and what a tonne of its propellant costs. */
export type Propulsion = {
  readonly id: string;
  readonly words: string;
  readonly needs: readonly string[];
  readonly exhaust: number;
  readonly propellantCost: number;
};
/** A frame: what it needs known, its dry share of each stage's mass, what a tonne of it costs. */
export type Frame = {
  readonly id: string;
  readonly words: string;
  readonly needs: readonly string[];
  readonly dry: number;
  readonly cost: number;
};

export const PROPULSION: readonly Propulsion[] = [
  {
    id: "powder",
    words: "powder rockets",
    needs: ["rocketry"],
    exhaust: 2.2,
    propellantCost: 0.05,
  },
  {
    id: "kerosene",
    words: "engines burning oil with liquid air",
    needs: ["rocketry", "engines"],
    exhaust: 3.1,
    propellantCost: 0.02,
  },
  {
    // Hydrogen and oxygen parted from water by current: a people of the water's own fuel.
    id: "parted-water",
    words: "engines burning water parted by current",
    needs: ["rocketry", "electronics"],
    exhaust: 4.3,
    propellantCost: 0.05,
  },
  {
    id: "atomic",
    words: "engines heated by the atom",
    needs: ["nuclear-drive"],
    exhaust: 8.5,
    propellantCost: 0.4,
  },
];

export const FRAMES: readonly Frame[] = [
  { id: "iron-frame", words: "frames of steel", needs: ["rocketry", "steel"], dry: 0.13, cost: 1 },
  {
    id: "refined-frame",
    words: "frames of current-refined metal",
    needs: ["rocketry", "refined-metals"],
    dry: 0.12,
    cost: 1,
  },
  {
    id: "light-frame",
    words: "light frames, reckoned to the gram",
    needs: ["rocketry", "electronics", "guidance"],
    dry: 0.08,
    cost: 1.4,
  },
];

/** The share of a launch's mass that reaches the speed, staged in n equal stages (0: it cannot). */
export function payloadFraction(
  speed: number,
  exhaust: number,
  dry: number,
  stages: number,
): number {
  // Each stage gives its share of the speed; its mass ratio is e^(Δv/ve) (the rocket
  // equation); what is left over its own dry weight carries the stages above.
  const ratio = dmath.exp(speed / (stages * exhaust)),
    left = (1 / ratio - dry) / (1 - dry);
  return left <= 0 ? 0 : dmath.pow(left, stages);
}

/** What a launch costs per tonne reaching the speed, and how it is staged; Infinity if it cannot. */
export function costPerTonne(
  speed: number,
  p: Propulsion,
  f: Frame,
): { stages: number; fraction: number; cost: number } {
  let best = { stages: 0, fraction: 0, cost: Infinity };
  for (let stages = 1; stages <= 4; stages++) {
    const fraction = payloadFraction(speed, p.exhaust, f.dry, stages);
    if (fraction <= 0) continue;
    // Tonnes launched for a tonne carried: the frames and the propellant, and each stage
    // more to build and join.
    const cost =
      ((f.dry * f.cost + (1 - f.dry) * p.propellantCost) / fraction) * (1 + 0.25 * (stages - 1));
    if (cost < best.cost) best = { stages, fraction, cost };
  }
  return best;
}

/** No launch is worth making that lifts less than this share of its mass (two hundred tonnes a tonne). */
export const LEAST_FRACTION = 0.005;

export type Launcher = {
  readonly propulsion: Propulsion;
  readonly frame: Frame;
  readonly stages: number;
  /** The share of its mass that reaches the speed. */
  readonly fraction: number;
  /** What a tonne reaching the speed costs, in machines. */
  readonly cost: number;
  readonly speed: number;
};

/**
 * The cheapest launcher a people who know these things can build for this speed (km/s),
 * or null: none they could build would lift enough to be worth it.
 */
export function launcherFor(
  knows: (id: string) => boolean,
  speed: number,
  // (And the frames a people's own made stuffs give them: sim/lore/materials.ts madeFrames.)
  made: readonly Frame[] = [],
): Launcher | null {
  let best: Launcher | null = null;
  for (const p of PROPULSION) {
    if (!needsMet(p, knows)) continue;
    for (const f of made.length ? [...FRAMES, ...made] : FRAMES) {
      if (!needsMet(f, knows)) continue;
      const c = costPerTonne(speed, p, f);
      if (c.fraction < LEAST_FRACTION) continue;
      if (!best || c.cost < best.cost - 1e-12)
        best = {
          propulsion: p,
          frame: f,
          stages: c.stages,
          fraction: c.fraction,
          cost: c.cost,
          speed,
        };
    }
  }
  return best;
}

/**
 * What it costs to set a tonne down on another body: lifted to orbit by the cheapest
 * launcher, then carried by a ship staged for the route's speed (the rocket equation
 * again, from orbit). Null: no drive the people know can make the crossing worth it.
 */
export function delivered(
  knows: (id: string) => boolean,
  toOrbitSpeed: number,
  routeSpeed: number,
): { lift: Launcher; ship: Launcher; cost: number } | null {
  const lift = launcherFor(knows, toOrbitSpeed),
    ship = launcherFor(knows, routeSpeed);
  if (!lift || !ship) return null;
  // Every tonne set down took 1/fraction tonnes lifted to orbit, and the ship's own cost.
  return { lift, ship, cost: lift.cost / ship.fraction + ship.cost };
}

// —— What launches leave aloft ——————————————————————————————————————————————————————————————————————

/**
 * Orbital debris (the breadth round). Of every tonne lifted a share stays up dead: spent stages, shrouds, craft
 * past their work (`left`, est: a twentieth). The thin air at the heights flown drags it down in time: at Earth in
 * some sixty years (`earthYears`, est for the crowded heights of 600 to 900 km), sooner under a heavier air and all
 * but never over an airless world. Dead things also strike each other, and each strike makes more: the fragments
 * aloft F obey dF/dt = what launches leave + c·F² − F/τ, which settles only while what is left aloft is under a
 * critical mass D* = 1/(4cτ) (Kessler and Cour-Palais 1978). `critical`: that mass at Earth's τ (tonnes, est).
 * Past it the strikes outrun the air: a cascade. `felt`: under this share of the critical mass no one flying
 * notices. `lossTonnes`: the fragments aloft at which a launch program has lost 63 in 100 of its craft (est).
 * `shield`: what armour, watching and dodging add to a launch's cost at the critical mass. `dare`: past this chance
 * of losing its craft no realm launches at all, and the sky is left to clear.
 */
export const DEBRIS = {
  left: 0.05,
  earthYears: 60,
  mostYears: 10000,
  critical: 1000,
  felt: 0.25,
  lossTonnes: 20000,
  shield: 0.25,
  dare: 0.5,
} as const;

/** Years a dead thing stays aloft over a world: Earth's by its air's weight (the heavier, the sooner down). */
export function aloftYears(airBar: number): number {
  return airBar <= 0
    ? DEBRIS.mostYears
    : Math.min(DEBRIS.mostYears, DEBRIS.earthYears / Math.max(1e-6, airBar));
}

/** What a world's launches have left aloft, and what it does to the next. */
export type Debris = {
  /** Dead mass left by launches and not yet fallen (tonnes), and the fragments aloft once they have struck each other. */
  readonly left: number;
  readonly fragments: number;
  /** The dead mass past which strikes outrun the air here (tonnes), and how far toward it this stands. */
  readonly critical: number;
  readonly load: number;
  /** Whether the strikes outrun the air: a cascade. */
  readonly cascade: boolean;
  /** What a launch costs against a clear sky's (1: nothing more), and the chance a program's craft are lost. */
  readonly costs: number;
  readonly loss: number;
};

export const CLEAR_SKY: Debris = Object.freeze({
  left: 0,
  fragments: 0,
  critical: DEBRIS.critical,
  load: 0,
  cascade: false,
  costs: 1,
  loss: 0,
});

/**
 * A world's debris in a year, from every launch it has made: each a year and the tonnes it lifted. A reading of
 * the launches alone: nothing is kept.
 */
export function debrisOf(
  lifts: readonly { readonly year: number; readonly tonnes: number }[],
  year: number,
  airBar: number,
): Debris {
  if (!lifts.length) return CLEAR_SKY;
  const tau = aloftYears(airBar);
  let left = 0;
  for (const l of lifts)
    if (l.year <= year) left += DEBRIS.left * l.tonnes * dmath.exp(-(year - l.year) / tau);
  // (The critical mass goes as 1/τ: where the air clears slowly, less starts a cascade.)
  const critical = (DEBRIS.critical * DEBRIS.earthYears) / tau,
    load = left / critical,
    cascade = load >= 1,
    // (The settled root of the balance while there is one; past it, growing with the overload.)
    fragments = cascade ? 2 * left * load : (2 * left) / (1 + Math.sqrt(1 - load)),
    felt = load >= DEBRIS.felt;
  return {
    left,
    fragments,
    critical,
    load,
    cascade,
    costs: felt ? 1 + DEBRIS.shield * Math.min(4, fragments / (2 * critical)) : 1,
    loss: felt ? 1 - dmath.exp(-fragments / DEBRIS.lossTonnes) : 0,
  };
}
