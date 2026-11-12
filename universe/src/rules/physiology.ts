// What a body can do on a world, from physics (B0 of the life plan, docs/architecture/asks-2026-11-12-plan.md
// Part B): the weight a frame bears against the pull, lift against weight, a lifting gas against the air, the
// largest body a way of breathing can feed, drag in a liquid, warmth kept against a surface, and the senses a
// world allows. Each is a pure function with real figures, checked against Earth's own animals (an elephant, a
// hummingbird, a squid and a beetle are possible on Earth; a six-tonne flier is not: tests/rules/physiology.test.ts).
// Where a figure is an estimate (a fossil's weight, a muscle's sustained power, the largest shell a moult allows),
// it is marked so here and in `ESTIMATES`, and a page that cites it says so. Nothing reads these yet: B3 will.
import { dmath } from "../kernel/index.ts";

/** Earth's pull at the ground, m/s². */
export const G0 = 9.81;
/** The gas constant, J/(mol·K). */
export const R_GAS = 8.314;

/** What holds a body's shape. */
export type Frame = "none" | "shell" | "bones" | "needles" | "gas";

/**
 * The heaviest land body each frame has carried on Earth, kg: inner bones the greatest sauropods' (about 70 t,
 * an estimate from their bones); an outer jointed shell the largest arthropods' (Arthropleura, about 50 kg, an
 * estimate: a shell must be moulted, and a soft new one cannot hold a heavy body up); a body held by its own
 * pressure the greatest land worms' and snails' (about 1.5 kg); a mesh of needles a sponge's (it does not stand
 * on land: 0.5 kg, an estimate); a gas-filled frame light and hollow, as a bird's bones are taken to their end
 * (an estimate: 20 kg).
 */
export const LARGEST_ON_EARTH: Readonly<Record<Frame, number>> = {
  bones: 70_000,
  shell: 50,
  none: 1.5,
  needles: 0.5,
  gas: 20,
};

/**
 * The heaviest body a frame bears on land under a pull (Earth's 1): at the stress Earth's largest bear, a body's
 * length goes as one over the pull (stress ∝ density × pull × length), so its weight as the pull to the minus
 * third. In a liquid a body near its own density weighs a twentieth of itself (an estimate: most swimmers are
 * within 5% of their water's density), so a frame bears far more, up to the greatest whale's 190 t, which its
 * food, not its frame, holds to.
 */
export function largestFrame(frame: Frame, gravity: number, inLiquid = false): number {
  const pull = Math.max(0.05, gravity),
    land = LARGEST_ON_EARTH[frame] * dmath.pow(pull, -3);
  return inLiquid ? Math.min(190_000 * dmath.pow(pull, -1), land * 8000) : land;
}

/** Whether a frame bears a body's weight under a pull, and how near its bound it stands (1: at it). */
export function frameBears(
  frame: Frame,
  mass: number,
  gravity: number,
  inLiquid = false,
): { readonly ok: boolean; readonly load: number; readonly largest: number } {
  const largest = largestFrame(frame, gravity, inLiquid);
  return { ok: mass <= largest, load: mass / largest, largest };
}

/** A gas's or an air's density, kg/m³: its pressure (bar), its molar mass (g/mol) and warmth (K). */
export function gasDensity(pressureBar: number, molarMass: number, kelvin: number): number {
  return (pressureBar * 1e5 * molarMass * 1e-3) / (R_GAS * Math.max(1, kelvin));
}

/**
 * Lifted against weight by beating wings (an estimate in its details): the slowest speed its wings bear it at
 * (lift = weight at a lift coefficient of 1.6, a bird's or a bat's best), the power that speed costs against a
 * lift-to-drag of 8 (a flapping flier's), and what its flight muscles give (a fifth of its weight, at 100 W a
 * kilo held up for long: an estimate from birds and bats). It flies if what they give is at least what flight
 * costs. Wings `area` m², `mass` kg, air `density` kg/m³, `gravity` in Earth's.
 */
export function flight(
  mass: number,
  area: number,
  density: number,
  gravity: number,
): {
  readonly flies: boolean;
  readonly speed: number;
  readonly needs: number;
  readonly gives: number;
  /** Weight it can lift beside its own at the slowest speed, kg (0: none). */
  readonly spare: number;
} {
  const weight = mass * G0 * gravity,
    speed = Math.sqrt((2 * weight) / Math.max(1e-9, density * area * 1.6)),
    needs = (weight * speed) / 8,
    gives = mass * 0.2 * 100;
  return {
    flies: gives >= needs,
    speed,
    needs,
    gives,
    spare: gives > needs ? mass * (dmath.pow(gives / needs, 2 / 3) - 1) : 0,
  };
}

/**
 * Wings as a flier of a weight grows them, m²: as the greatest fliers' do (Quetzalcoatlus, about 250 kg on 10 m²:
 * an estimate), area going as weight to the two thirds.
 */
export function wingsFor(mass: number): number {
  return 10 * dmath.pow(mass / 250, 2 / 3);
}

/**
 * What a bag of lifting gas lifts in an air, kg: its volume (m³) times the air's density less the gas's, at the
 * air's pressure (bar) and warmth (K), each gas by its molar mass (g/mol).
 */
export function gasLift(
  volume: number,
  pressureBar: number,
  airMolar: number,
  gasMolar: number,
  kelvin: number,
): number {
  return (
    volume *
    Math.max(0, gasDensity(pressureBar, airMolar, kelvin) - gasDensity(pressureBar, gasMolar, kelvin))
  );
}

/** How a body takes in its oxidant. */
export type Breathing = "skin" | "tubes" | "gills" | "lungs";

/**
 * The largest body each way of breathing feeds in Earth's air (0.21 bar of oxygen), kg. By its skin alone, the
 * largest lungless salamanders' (about 0.1 kg); by tubes through its body, the heaviest insects' (a goliath beetle,
 * 0.1 kg); gills and lungs, which pump, feed the greatest of all (a whale shark's 20 t, a whale's 190 t). Skin and
 * tubes bring oxidant by diffusion, so the depth they reach goes as its pressure and the body's weight as its cube
 * (an estimate, borne out by the Carboniferous's 35% oxygen and its 70 cm dragonflies).
 */
export const BREATHING_CEILING: Readonly<Record<Breathing, number>> = {
  skin: 0.1,
  tubes: 0.1,
  gills: 20_000,
  lungs: 190_000,
};

/** The largest body a way of breathing feeds at a pressure of oxidant (bar; Earth's air 0.21), kg. */
export function breathingCeiling(how: Breathing, oxidantBar: number): number {
  const base = BREATHING_CEILING[how];
  if (how === "gills" || how === "lungs")
    return oxidantBar > 0.02 ? base : base * dmath.pow(oxidantBar / 0.02, 3);
  return base * dmath.pow(Math.max(0, oxidantBar) / 0.21, 3);
}

/** The drag on a body in a liquid or an air, N: ½ ρ v² C A (its density kg/m³, speed m/s, drag coefficient, front area m²). */
export function drag(density: number, speed: number, area: number, coefficient = 0.1): number {
  return 0.5 * density * speed * speed * coefficient * area;
}

/** The Reynolds number of a body going through a fluid: ρ v L / μ (viscosity Pa·s); under about 1 it swims as a microbe does. */
export function reynolds(density: number, speed: number, length: number, viscosity: number): number {
  return (density * speed * length) / Math.max(1e-9, viscosity);
}

/**
 * How fast a swimmer can go for long, m/s: where the power its muscles hold (`watts`) meets drag times speed,
 * v = (2P / (ρ C A))^⅓. A streamlined body's coefficient is about 0.1, a squid's in its own jet about 0.3 (estimates).
 */
export function cruiseSpeed(watts: number, density: number, area: number, coefficient = 0.1): number {
  return dmath.cbrt((2 * Math.max(0, watts)) / Math.max(1e-9, density * coefficient * area));
}

/** A body's skin, m²: about a tenth of its weight (kg) to the two thirds (Meeh's rule for mammals; an estimate for others). */
export function surfaceOf(mass: number): number {
  return 0.1 * dmath.pow(Math.max(1e-6, mass), 2 / 3);
}

/** The heat a warm body can make for long, W: five times its resting rate, Kleiber's 3.4 W a kilo to the ¾ (an estimate). */
export function heatMade(mass: number): number {
  return 5 * 3.39 * dmath.pow(Math.max(1e-6, mass), 0.75);
}

/**
 * The insulation of a coat, m²·K/W, for a body of a weight: a bare skin's boundary 0.08 at a few grams, a thick hide's more (as weight to the 0.1); a coat thicker on a larger
 * body (as a mammal's fur goes with weight to about the 0.2: an estimate), fur 0.17 at a few grams, feathers 0.2.
 */
export function insulationOf(coat: "bare" | "fur" | "feathers" | "blubber", mass: number): number {
  const grow = dmath.pow(Math.max(1e-4, mass) / 0.002, 0.2);
  return coat === "bare"
    ? 0.08 * Math.sqrt(grow)
    : coat === "fur"
      ? 0.17 * grow
      : coat === "feathers"
        ? 0.2 * grow
        : 0.1 * grow * 2;
}

/**
 * Whether a warm body of a weight keeps its warmth (`body` °C, a mammal's 37) in the cold (`air` °C): the heat it
 * makes against what its skin loses through its coat, A ΔT / R. Returns the ratio (≥ 1: it keeps warm).
 */
export function keepsWarm(
  mass: number,
  air: number,
  coat: "bare" | "fur" | "feathers" | "blubber",
  body = 37,
): number {
  const lost = (surfaceOf(mass) * Math.max(0.1, body - air)) / insulationOf(coat, mass);
  return heatMade(mass) / lost;
}

/** The smallest warm body that keeps its warmth in the cold (`air` °C) in a coat, kg (bisected over weights). */
export function smallestWarm(air: number, coat: "bare" | "fur" | "feathers" | "blubber"): number {
  let lo = 1e-4,
    hi = 1e5;
  if (keepsWarm(lo, air, coat) >= 1) return lo;
  if (keepsWarm(hi, air, coat) < 1) return Infinity;
  for (let i = 0; i < 60; i++) {
    const mid = Math.sqrt(lo * hi);
    if (keepsWarm(mid, air, coat) >= 1) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** What a world gives its senses: its star's warmth (K), its air (bar), whether its life is in a liquid and what that liquid is, whether it has a field. */
export type SenseWorld = {
  readonly star: number;
  readonly pressure: number;
  readonly liquid: "water" | "salt water" | "ammonia" | "methane" | "oil" | null;
  readonly field?: boolean;
};

/** The senses a world allows, each with its figure. */
export type Senses = {
  /** Where its star's light is brightest, nm (Wien's law), and the band a sighted body sees in. */
  readonly peakNm: number;
  readonly band: "near infrared" | "red" | "visible" | "blue";
  /** Whether sound carries in its air (a near vacuum carries none: Mars's 0.006 bar barely). */
  readonly hearing: boolean;
  /** How far a loud call carries in the air, about, m (an estimate: Earth's 1 km for a call at 1 bar). */
  readonly callCarries: number;
  /** Whether its liquid carries a current a body can feel (salt water and ammonia do; methane and oil do not). */
  readonly electric: boolean;
  /** Whether a body can feel the world's field. */
  readonly magnetic: boolean;
};

/** The senses a world allows. */
export function sensesOf(w: SenseWorld): Senses {
  const peakNm = 2.898e6 / Math.max(500, w.star),
    band = peakNm > 760 ? "near infrared" : peakNm > 620 ? "red" : peakNm > 450 ? "visible" : "blue";
  return {
    peakNm,
    band,
    hearing: w.pressure >= 0.01 || w.liquid !== null,
    callCarries: w.pressure < 0.01 ? 0 : 1000 * Math.sqrt(w.pressure),
    electric: w.liquid === "salt water" || w.liquid === "ammonia" || w.liquid === "water",
    magnetic: !!w.field,
  };
}

/** Which of the figures above are estimates, as a page says it. */
export const ESTIMATES: readonly string[] = [
  "the largest frames on Earth beside bones (a shell's 50 kg, a worm's 1.5 kg, needles' and gas frames')",
  "a swimmer's weight in its liquid, a twentieth of itself",
  "a flier's muscle (a fifth of its weight, at 100 W a kilo) and its lift-to-drag of 8",
  "the greatest flier's wings (10 m² on 250 kg)",
  "breathing by skin and tubes reaching as the oxidant's pressure, a body's weight as its cube",
  "drag coefficients (0.1 streamlined, 0.3 a squid's)",
  "skin by Meeh's rule outside mammals; heat made at five times Kleiber's rate; a coat's thickness by weight",
  "how far a call carries in an air",
];
