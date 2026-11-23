// What a blow does to a body (Phase 55 M224): of the struck, how many fall, on the field and of
// their wounds after; of the wounded who live, how many lose a limb, an eye or a hand; and how much
// full care saves. The shares come from these sources. The rule of nines (Wallace, 1951) puts the
// head and trunk, where the vital organs lie, at 45% of the body's surface. Beebe and DeBakey's
// Battle Casualties (1952) finds that the bullet kills the largest share of those it hits. The
// Towton grave of 1461 (Fiorato, Boylston and Knüsel, 2000) shows blade and point wounds. Gabriel
// and Metz's From Sumer to Rome (1991) puts the ancient wounded at about three for each one killed.
// The Medical and Surgical History of the War of the Rebellion (1870–88) counts 275,175 Union
// wounded to 110,070 dead, with about 60,000 amputations of 476,000 wounded; the US Army's Second
// World War figures count 670,846 wounded to 291,557 battle deaths. The history of care (the Edwin
// Smith papyrus, c. 1600 BC; Paré's ligature, 1545; Nightingale's sanitation at Scutari, 1855; and
// Lister's antisepsis, 1867, which cut amputation deaths from 45% to 15%) shows that care cuts the
// deaths that follow a wound, never the deaths on the field. The strikes of the world follow Coburn
// and Spence (2002), the NFPA's home fire counts and Jonkman and Kelman (2005) on floods; the
// meteor's figure has no source and sits between fire and quake.
// The shares are what a blow of a reference energy does to a body of sixty kilograms (the breadth round, 2026-11-23): a blow's
// harm is read off the energy it delivers against what the arms the tables stand for deliver (a musket's ball, a sword's cut),
// to a power under one (wound ballistics: a wound deepens with energy, but the vital share is soon reached); a muscle-driven
// arm delivers as its wielder's body is heavy (Hill 1950: a muscle's work in a stroke goes as its mass), a gun or a beam its
// own; armour turns the less of a blow the more energy it carries; a body's own shell or scales guard it under what it wears
// (sim/war/fell.ts hostTerms), a bigger body has more between skin and organs, and a cold-blooded body, whose flesh asks less of
// its blood, dies less of its wounds after (bleeding and shock kill more slowly). Earth's people and arms come out as the
// sources have them; another body or arm differs by these facts. Pure tables and functions.
import { dmath } from "../kernel/index.ts";
import { ballOf } from "./means.ts";

/**
 * How a blow harms: by an edge (a cut), a point (a thrust), a blunt weight, a ball, a crushing
 * bite or grip, or fire.
 */
export type Blow = "edge" | "point" | "blunt" | "shot" | "crush" | "fire";

/** Each arm's blow, by its realization id (rules/designs.ts). An arm not listed strikes blunt. */
export const BLOW_OF: Readonly<Record<string, Blow>> = {
  club: "blunt",
  spear: "point",
  axe: "edge",
  sword: "edge",
  bow: "point",
  "horn-bow": "point",
  musket: "shot",
  rifle: "shot",
  repeater: "shot",
  autoloader: "shot",
  automatic: "shot",
  "beam-rifle": "fire",
  "beam-lance": "fire",
  // (Arms of a people of the water, F1: a long dart pierces; a lance of sound burns as a blow within.)
  "gas-dart": "point",
  "sound-lance": "fire",
  claws: "edge",
  mandibles: "crush",
  tusks: "crush",
  grapple: "crush",
  "shell-darts": "point",
};

/** The constants of the body and of its care. */
export const WOUNDS = {
  /** The share of the body's surface that lies over the brain, heart, great vessels and gut. */
  vital: 0.45,
  /** The most of those who would die of their wounds that full care saves. */
  save: 0.7,
  /** The least share of the struck who fall: at most 4.5 wounded for each one who falls. */
  least: 1 / 5.5,
  /** The most share of the struck who fall: at least 1.2 wounded for each one who falls. */
  most: 1 / 2.2,
  /** The body, in kilograms, that the tables are set for: an upright ape. */
  size: 60,
} as const;

/** Of blows that land on the vital share, the share that kill outright. */
export const LETHAL: Readonly<Record<Blow, number>> = {
  edge: 0.35,
  point: 0.45,
  blunt: 0.25,
  shot: 0.55,
  crush: 0.45,
  fire: 0.3,
};

/** How much of a blow full protection turns aside (shot goes through mail and plate). */
export const TURN: Readonly<Record<Blow, number>> = {
  edge: 0.6,
  point: 0.45,
  blunt: 0.3,
  shot: 0.15,
  crush: 0.2,
  fire: 0.2,
};

/** Of the wounded, the share who die of it later without care (bleeding, sepsis, gangrene). */
export const DIED_OF_WOUNDS: Readonly<Record<Blow, number>> = {
  edge: 0.1,
  point: 0.18,
  blunt: 0.08,
  shot: 0.2,
  crush: 0.15,
  fire: 0.2,
};

/** Of the wounded who live, the share who lose a limb, an eye or a hand, without care. */
export const MAIM: Readonly<Record<Blow, number>> = {
  edge: 0.1,
  point: 0.06,
  blunt: 0.04,
  shot: 0.14,
  crush: 0.12,
  fire: 0.03,
};

/** How much of that full care saves. */
export const SALVAGE: Readonly<Record<Blow, number>> = {
  edge: 0.1,
  point: 0.3,
  blunt: 0.3,
  shot: 0.6,
  crush: 0.3,
  fire: 0.2,
};

/** The least and the most share of the wounded who live that can be maimed. */
export const MAIMED_BOUNDS = [0.02, 0.25] as const;

/** The principles (rules/principles.ts ids) that care for the wounded, and how much each gives. */
export const CARE_PRINCIPLES: readonly (readonly [principle: string, weight: number])[] = [
  ["herbalism", 0.25],
  ["medicine", 0.35],
  ["sanitation", 0.15],
  ["germs", 0.25],
];

/** Wounded who live per death, by the kind of strike: fires, quakes, meteors and floods. */
export const STRIKE_HURT = { fire: 2, quake: 3, meteor: 1.2, flood: 0.4, raid: 2 } as const;

/** The care a host's wounded get: the sum of the weights of the principles known (0 to 1). */
export function woundCare(known: (principle: string) => boolean): number {
  let care = 0;
  for (const [principle, weight] of CARE_PRINCIPLES) {
    if (known(principle)) care += weight;
  }
  return Math.min(1, care);
}

/**
 * What struck a side: the foe's blow and shock; the side's protection, care and body (kg). Where the foe's arm is named, the
 * energy it delivers is read off it (a muscle-driven arm's by the size of the body that wields it: the struck's own people's,
 * as a home world's battles are fought, unless its wielder is named); else the blow strikes at its reference energy. Cold: the struck
 * body is cold-blooded.
 */
export type Struck = {
  readonly blow: Blow;
  readonly shock: number;
  readonly protection: number;
  readonly care: number;
  readonly size: number;
  readonly arm?: string | null;
  readonly wielder?: number;
  readonly cold?: boolean;
};

/**
 * The energy each blow's shares stand for (J): a sword's cut (60 to 130 J), a spear's thrust, a club's swing, a musket's ball
 * (rules/means.ts ballOf, 2,480 J), a jaw's crushing bite, a beam's pulse (est.).
 */
export const BLOW_JOULES: Readonly<Record<Blow, number>> = {
  edge: 100,
  point: 80,
  blunt: 120,
  shot: 2480,
  crush: 200,
  fire: 3000,
};

/**
 * The energy each arm not a gun delivers (J), for a wielder of sixty kilograms where its own muscle drives it (est. from
 * reconstructions: a self bow's arrow 40 to 80 J, a war bow's about 100 J; an axe's swing; a spear's thrust; a bite, a tusk's
 * thrust, a grip). A gun's is its ball's (rules/means.ts ballOf). An arm not named strikes at its blow's reference.
 */
export const ARM_JOULES: Readonly<Record<string, number>> = {
  club: 120,
  spear: 80,
  axe: 130,
  sword: 100,
  bow: 60,
  "horn-bow": 90,
  claws: 60,
  mandibles: 200,
  tusks: 400,
  grapple: 150,
  "shell-darts": 40,
  "gas-dart": 200,
  "sound-lance": 800,
  "beam-rifle": 3000,
  "beam-lance": 5000,
};

/** The arms whose energy is not their wielder's muscle: guns, beams, a dart driven by gas, a lance of sound. */
const NOT_MUSCLE: ReadonlySet<string> = new Set([
  "gas-dart",
  "sound-lance",
  "beam-rifle",
  "beam-lance",
]);

/**
 * How a blow's harm goes with its energy (J): a blow kills once it carries enough to reach what lies under the skin, and past
 * that more energy adds less (1 − e^(−E/E0), against the same at the blow's reference). E0 is the energy that reaches the vital
 * organs most of the time (est.: a cut or a bite about its reference, a ball long past it — every gun's ball goes through a body,
 * so Earth's guns from the musket to the automatic kill alike of those they strike, as the sources find). And the share of a blow
 * armour turns falls as the blow's energy rises past its reference, to a fourth power.
 */
export const REACHES: Readonly<Record<Blow, number>> = {
  edge: 100,
  point: 60,
  blunt: 150,
  shot: 400,
  crush: 200,
  fire: 1500,
};
export const DOSE = { least: 0.3, most: 2, through: 0.25 } as const;
/** How much less a cold-blooded body dies of its wounds after. */
export const COLD_BLEEDS = 0.7;

/** The energy an arm delivers (J), wielded by a body of so many kilograms: its ball's, its own, or its muscle's for its size. */
export function armJoules(arm: string | null | undefined, blow: Blow, wielder: number): number {
  if (arm === null || arm === undefined) return BLOW_JOULES[blow];
  const ball = ballOf(arm);
  if (ball) return ball.joules;
  const own = Object.hasOwn(ARM_JOULES, arm) ? ARM_JOULES[arm]! : BLOW_JOULES[blow];
  return NOT_MUSCLE.has(arm) ? own : own * dmath.clamp(wielder / WOUNDS.size, 0.2, 5);
}

/** A blow's harm against its reference's, from its energy against its reference (REACHES): 1 at the reference. */
export function harmOf(blow: Blow, dose: number): number {
  if (dose === 1) return 1;
  const e0 = REACHES[blow] / BLOW_JOULES[blow],
    reached = (x: number) => 1 - dmath.exp(-x / e0);
  return dmath.clamp(reached(Math.max(0, dose)) / reached(1), DOSE.least, DOSE.most);
}

/** A blow's energy against its reference: 1 at the reference, where no arm is named. */
export function doseOf(s: Struck): number {
  if (s.arm === null || s.arm === undefined) return 1;
  return armJoules(s.arm, s.blow, s.wielder ?? s.size) / BLOW_JOULES[s.blow];
}

/**
 * The blow an arm strikes with, by its realization id. No arm, or an arm not listed, strikes
 * blunt.
 */
export function blowOf(arm: string | null | undefined): Blow {
  if (arm === null || arm === undefined || !Object.hasOwn(BLOW_OF, arm)) return "blunt";
  return BLOW_OF[arm] ?? "blunt";
}

/** How hard a blow lands, from its shock: 0.6 with none, 1.3 at the most the tables allow. */
function shockFactor(shock: number): number {
  return 0.6 + 0.5 * dmath.clamp(shock, 0, 1.4);
}

/** The share of the vital surface a body has: a smaller body has less between skin and organs. */
function bodyFactor(size: number): number {
  return dmath.clamp(dmath.cbrt(WOUNDS.size / Math.max(1, size)), 0.6, 1.5);
}

/** Of the struck, the share killed outright on the field: the more the energy, the more, and the less armour turns of it. */
function killedOutright(s: Struck): number {
  const dose = doseOf(s),
    harm = harmOf(s.blow, dose),
    through = dose === 1 ? 1 : dmath.clamp(dmath.pow(dose, -DOSE.through), 0.6, 1.4),
    turned = 1 - Math.min(0.95, TURN[s.blow] * dmath.clamp(s.protection, 0, 1) * through);
  return Math.min(
    1,
    WOUNDS.vital * LETHAL[s.blow] * harm * bodyFactor(s.size) * turned * shockFactor(s.shock),
  );
}

/** Of the struck (killed or wounded), the share killed: on the field and of their wounds after. */
export function fallenShare(s: Struck): number {
  const killed = killedOutright(s),
    later =
      DIED_OF_WOUNDS[s.blow] *
      (1 - WOUNDS.save * dmath.clamp(s.care, 0, 1)) *
      (s.cold ? COLD_BLEEDS : 1);
  return dmath.clamp(killed + (1 - killed) * later, WOUNDS.least, WOUNDS.most);
}

/** Wounded who live for each one who falls: (1 − F) / F. */
export function woundedPerFallen(s: Struck): number {
  const f = fallenShare(s);
  return (1 - f) / f;
}

/** Of the wounded who live, the share maimed: by the blow, its energy against its reference (`dose`), and care. */
export function maimedShare(blow: Blow, care: number, dose = 1): number {
  const [least, most] = MAIMED_BOUNDS,
    // (A blow of more energy shatters more of a limb than can be saved: as its harm, to the same power.)
    harm = harmOf(blow, dose);
  return dmath.clamp(
    MAIM[blow] * harm * (1 - SALVAGE[blow] * dmath.clamp(care, 0, 1)),
    least,
    most,
  );
}

/**
 * A side's wounded and maimed, from its fallen and its field (the men there, the risen counted).
 */
export function sideWounds(
  fallen: number,
  field: number,
  s: Struck,
): { wounded: number; maimed: number } {
  const wounded =
    fallen > 0
      ? Math.max(0, Math.min(field - fallen, Math.round(fallen * woundedPerFallen(s))))
      : 0;
  return { wounded, maimed: Math.round(wounded * maimedShare(s.blow, s.care, doseOf(s))) };
}

/** The wounded a strike leaves: its dead times the strike's ratio, rounded. */
export function strikeHurt(kind: keyof typeof STRIKE_HURT, dead: number): number {
  return Math.round(dead * STRIKE_HURT[kind]);
}

/**
 * How much of a blow a body's own covering turns, worn under whatever it wears (as rules/designs.ts's own-shell and own-scales
 * guard a host that wears nothing else; fur and feathers a little).
 */
export const OWN_GUARD: Readonly<Record<string, number>> = {
  shell: 0.6,
  scales: 0.35,
  fur: 0.05,
  feathers: 0.05,
};

/**
 * A side's guard with its body's own covering under what it wears: each turns its share of what the other lets through. Where
 * what it wears is its own covering (its guard part is of its body), that is counted once.
 */
export function guardWith(worn: number, skin: string, ownWorn: boolean): number {
  const own = ownWorn || !Object.hasOwn(OWN_GUARD, skin) ? 0 : OWN_GUARD[skin]!;
  return own > 0 ? 1 - (1 - dmath.clamp(worn, 0, 1)) * (1 - own) : worn;
}
