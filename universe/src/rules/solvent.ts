// Which liquid lies on a world's face, from its numbers (the breadth round's "solvents and world kinds"): its
// warmth, the weight of its air, and what its crust and air hold. A liquid lies where the world is warmer than its
// freezing and cooler than its boiling under that air (Clausius and Clapeyron's law from each liquid's own heat of
// boiling), and where the air weighs more than the liquid's triple point (liquid carbon dioxide wants five bar).
// Of the liquids that could lie there, the one the world holds most of fills its seas. The kinds of rules/kinds.ts
// are cases of this reading: water on rock, oil where a carbon disk left no water, sour water under sulfur
// volcanoes, ammonia water and methane far out. Others fall out of the same numbers: ethane seas where the ground
// no longer brings up methane as fast as the star's light breaks it, liquid carbon dioxide under a heavy cold air,
// sulfuric acid where water has boiled away, molten salts on a world hot enough, and none at all.
import { dmath } from "../kernel/index.ts";

/** A liquid a world's seas can be of. */
export type SolventId =
  | "water"
  | "acid-water"
  | "ammonia-water"
  | "crude"
  | "methane"
  | "ethane"
  | "sulfuric-acid"
  | "carbon-dioxide"
  | "salt";

/**
 * A liquid's own numbers (measured): where it freezes (its triple point, K, and the least air it is liquid under,
 * bar), a point on its boiling curve (K at `atBar`), the heat boiling takes (kJ/mol) and the warmth past which no
 * weight of air keeps it liquid (its critical point, K).
 */
export type SolventFacts = {
  readonly name: string;
  readonly freezeK: number;
  readonly tripleBar: number;
  readonly boilK: number;
  readonly atBar: number;
  readonly heat: number;
  readonly criticalK: number;
};

export const SOLVENTS: Readonly<Record<SolventId, SolventFacts>> = {
  water: {
    name: "water",
    freezeK: 273.15,
    tripleBar: 0.0061,
    boilK: 373.15,
    atBar: 1,
    heat: 40.7,
    criticalK: 647,
  },
  // (Water sour with sulfuric acid freezes and boils about where water does.)
  "acid-water": {
    name: "acid water",
    freezeK: 273.15,
    tripleBar: 0.0061,
    boilK: 373.15,
    atBar: 1,
    heat: 40.7,
    criticalK: 647,
  },
  // (Water with a third of ammonia: the eutectic at −97 °C.)
  "ammonia-water": {
    name: "ammonia water",
    freezeK: 176,
    tripleBar: 0.001,
    boilK: 300,
    atBar: 1.5,
    heat: 30,
    criticalK: 500,
  },
  // (Light oils and tars: a crude's lighter part sets to wax about where water freezes.)
  crude: {
    name: "oil",
    freezeK: 273.15,
    tripleBar: 0.0001,
    boilK: 373.15,
    atBar: 1.2,
    heat: 35,
    criticalK: 700,
  },
  methane: {
    name: "liquid methane",
    freezeK: 90.7,
    tripleBar: 0.117,
    boilK: 111.7,
    atBar: 1,
    heat: 8.2,
    criticalK: 190.6,
  },
  ethane: {
    name: "liquid ethane",
    freezeK: 90.4,
    tripleBar: 0.00001,
    boilK: 184.6,
    atBar: 1,
    heat: 14.7,
    criticalK: 305.3,
  },
  // (Past its boiling under one bar it comes apart into steam and sulfur trioxide, whatever the air's weight.)
  "sulfuric-acid": {
    name: "sulfuric acid",
    freezeK: 283.5,
    tripleBar: 0.000001,
    boilK: 610,
    atBar: 1,
    heat: 50,
    criticalK: 610,
  },
  // (It has no liquid under one bar: dry ice goes straight to gas. Its boiling curve starts at its triple point.)
  "carbon-dioxide": {
    name: "liquid carbon dioxide",
    freezeK: 216.6,
    tripleBar: 5.18,
    boilK: 216.6,
    atBar: 5.18,
    heat: 15.3,
    criticalK: 304.1,
  },
  // (Rock salt, the commonest of a rocky crust's salts.)
  salt: {
    name: "molten salt",
    freezeK: 1074,
    tripleBar: 0.0003,
    boilK: 1738,
    atBar: 1,
    heat: 170,
    criticalK: 3400,
  },
};

export const SOLVENT_IDS = Object.keys(SOLVENTS) as readonly SolventId[];

/** The gas constant, kJ/(mol·K). */
const R = 0.008314;

/** Where a liquid boils under an air of this weight (K): Clausius and Clapeyron's law, never past its critical point. */
export function boilAt(id: SolventId, bar: number): number {
  const s = SOLVENTS[id],
    inv = 1 / s.boilK - (R * dmath.log(Math.max(1e-9, bar) / s.atBar)) / s.heat;
  return inv <= 0 ? s.criticalK : Math.min(s.criticalK, 1 / inv);
}

/** The weight of a liquid's own vapour over it at a warmth (bar): the same law read the other way. */
export function vapourBar(id: SolventId, kelvin: number): number {
  const s = SOLVENTS[id];
  return s.atBar * dmath.exp((-s.heat / R) * (1 / Math.max(1, kelvin) - 1 / s.boilK));
}

/** The warmth a liquid is liquid between under an air of this weight (K), or null where the air is too thin for it. */
export function liquidBand(id: SolventId, bar: number): readonly [number, number] | null {
  const s = SOLVENTS[id];
  if (bar < s.tripleBar) return null;
  const boil = boilAt(id, bar);
  return boil > s.freezeK ? [s.freezeK, boil] : null;
}

/** How much of each liquid's stuff a world holds, as shares to be compared (0 or absent: none). */
export type Held = Partial<Record<SolventId, number>>;

/** How far a world's warmest and coldest places stand from its mean, as a share of it (Earth's: 288 K, 300 at its equator). */
export const FACE_SPREAD = 0.05;
/** The least share of a liquid's stuff that makes seas of it. */
export const LEAST_HELD = 0.005;

export type Stable = {
  /** The liquid on its face (null: none). */
  readonly liquid: SolventId | null;
  /** The band it is liquid in under this air (K). */
  readonly band: readonly [number, number] | null;
  /** Every liquid it holds that could lie there, most held first. */
  readonly could: readonly SolventId[];
  /** Why, in words. */
  readonly why: string;
};

const c = (k: number) => `${Math.round(k - 273.15)} °C`.replace("-", "−");

/**
 * The liquid stable on a world's face: of what it holds, those liquid somewhere between its coldest and warmest
 * places under its air; of those, the one it holds most of.
 */
export function stableLiquid(i: {
  readonly kelvin: number;
  readonly bar: number;
  readonly holds: Held;
}): Stable {
  const lo = i.kelvin * (1 - FACE_SPREAD),
    hi = i.kelvin * (1 + FACE_SPREAD),
    held = SOLVENT_IDS.filter((id) => (i.holds[id] ?? 0) >= LEAST_HELD).sort(
      (a, b) => i.holds[b]! - i.holds[a]!,
    ),
    could = held.filter((id) => {
      const band = liquidBand(id, i.bar);
      return !!band && hi > band[0] && lo < band[1];
    }),
    liquid = could[0] ?? null;
  if (liquid) {
    const band = liquidBand(liquid, i.bar)!,
      rest = could.slice(1).map((id) => SOLVENTS[id].name);
    return {
      liquid,
      band,
      could,
      why: `${SOLVENTS[liquid].name} is liquid from ${c(band[0])} to ${c(band[1])} under its air of ${bars(i.bar)}, and it stands at ${c(i.kelvin)}${rest.length ? `; it holds less of ${rest.join(" and ")}` : ""}`,
    };
  }
  // (Why not, by the liquid it holds most of.)
  const most = held[0];
  if (!most)
    return { liquid: null, band: null, could, why: "it holds nothing that could lie as a liquid" };
  const band = liquidBand(most, i.bar),
    s = SOLVENTS[most];
  return {
    liquid: null,
    band: null,
    could,
    why: !band
      ? `its air of ${bars(i.bar)} is too thin for ${s.name}, which wants ${bars(s.tripleBar)}: it goes from ice to gas`
      : hi <= band[0]
        ? `at ${c(i.kelvin)} its ${s.name} is frozen (it melts at ${c(band[0])})`
        : `at ${c(i.kelvin)} its ${s.name} has boiled away (it boils at ${c(band[1])} under its air)`,
  };
}

function bars(bar: number): string {
  return `${bar >= 10 ? Math.round(bar) : bar >= 0.1 ? bar.toFixed(1) : bar.toPrecision(1)} bar`;
}

/**
 * What a world's ground gives up, Earth's 1 (an estimate, as gen/origin.ts heatOf): its rock's heat by its pull,
 * run down by e in some three billion years.
 */
export function groundGiving(gravity: number, ageGyr: number): number {
  return gravity * dmath.exp(-(ageGyr - 4.5) / 3);
}

/** What a home world gathered and what made it, as its seed and its star say. */
export type HomeMaking = {
  /** What it gathered past its star's snow line (water where it gathered none of the others). */
  readonly gathered: "water" | "sulfur" | "ammonia" | "methane";
  /** Its disk held more carbon than oxygen: its oxygen is bound up, and water is scarce. */
  readonly carbonDisk: boolean;
  /** The share of its face its liquid would cover. */
  readonly seas: number;
  /** What its ground gives up (groundGiving). */
  readonly giving: number;
  /** Where it stands (K) and under what air (bar). */
  readonly kelvin: number;
  readonly bar: number;
};

/** The share of a cold world's air that is methane (Titan's: about a twentieth). */
export const METHANE_AIR = 0.05;

/**
 * The acid a sulfur-volcano world's ground gives its face for each of Earth's ground's giving, as a share of its
 * face to set beside its seas' (est: its rock kneaded three times as hard as Earth's, gen/origin.ts heatOf, and some
 * four parts in a hundred of a face for each).
 */
export const VENTED = 0.12;

/** The share of a carbon world's liquid that is water (rules/biochem.ts DRY_SOLVENT). */
const DRY = 0.01;

/**
 * What a home world holds of each liquid. Water by its seas, a hundredth of it where a carbon disk bound its
 * oxygen, with oil in its place; sour with acid where it gathered sulfur, and all acid where its volcanoes give more
 * of it than it has water. Ammonia water where it gathered ammonia.
 * Where it gathered methane, its star's light makes ethane of it, and its seas are the two mixed: methane lies in
 * them only as far as the methane of its air (a twentieth of it, as Titan's) presses against methane's own vapour
 * at its warmth (Raoult's law), and the rest is ethane, which boils seventy degrees higher and stays down. Cold,
 * its seas are mostly methane; a few degrees warmer, most of its methane is in its air and its seas are ethane.
 * Every air holds some carbon dioxide and every rock some salt.
 */
export function homeHolds(m: HomeMaking): Held {
  const wet = m.carbonDisk ? DRY : 1,
    held: Record<string, number> = { "carbon-dioxide": 0.02, salt: 0.02 };
  if (m.carbonDisk) held.crude = 1;
  if (m.gathered === "sulfur") {
    // (Its volcanoes' sulfur, burned and wetted, is sulfuric acid: as much as its kneaded ground gives up, VENTED of
    // its face's worth for each of Earth's. Where that is more than its water, the water is all bound into the acid.)
    held["acid-water"] = m.seas * wet;
    held["sulfuric-acid"] = VENTED * m.giving;
  } else held.water = m.seas * wet;
  if (m.gathered === "ammonia") held["ammonia-water"] = 1;
  if (m.gathered === "methane") {
    // (Above every other: these are not in dispute where it is cold enough for them, where all else is frozen.)
    const methane = Math.min(1, (METHANE_AIR * m.bar) / vapourBar("methane", m.kelvin));
    held.methane = 2 * methane;
    held.ethane = 2 * (1 - methane);
  }
  return held as Held;
}

/** A body of a star's system, as its numbers are read from afar (gen/system.ts). */
export type BodyNumbers = {
  readonly kind: string;
  /** Mean warmth, °C; its air's weight, bar. */
  readonly temperature: number;
  readonly pressure: number;
  readonly water: string;
  /** Whether it lies past its star's frost line (where ices gathered). */
  readonly pastFrost: boolean;
};

/**
 * What a body of a star's system holds: water where its numbers say seas or ice; past the frost line ammonia with
 * it and methane with ethane, each where it is cold enough to have been kept; carbon dioxide by its air's weight (a
 * heavy air over rock is mostly that, as Venus's); sulfuric acid where such an air has no water left; salt in any rock.
 */
export function bodyHolds(b: BodyNumbers): Held {
  if (b.kind === "giant" || b.kind === "ice giant" || b.kind === "belt") return {};
  const kelvin = b.temperature + 273.15,
    held: Record<string, number> = { salt: 0.02 };
  if (b.water === "seas") held.water = 1;
  else if (b.water === "ice") held.water = 0.5;
  if (b.pressure > 0.001) held["carbon-dioxide"] = Math.min(0.9, 0.02 * b.pressure);
  if (b.pressure >= 10 && b.water === "none") held["sulfuric-acid"] = 0.01 * b.pressure;
  if (b.pastFrost && b.water === "ice") {
    if (kelvin < 240) held["ammonia-water"] = 0.3;
    if (kelvin < 200 && b.pressure > 0.1) {
      held.methane = 0.6;
      held.ethane = 0.4;
    }
  }
  return held as Held;
}

/** The liquid on a system body's face, from its numbers. */
export function bodyLiquid(b: BodyNumbers): Stable {
  if (b.kind === "giant" || b.kind === "ice giant")
    return { liquid: null, band: null, could: [], why: "a giant: it has no face to hold a sea" };
  return stableLiquid({
    kelvin: b.temperature + 273.15,
    bar: b.pressure,
    holds: bodyHolds(b),
  });
}
