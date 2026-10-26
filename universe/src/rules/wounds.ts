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
// meteor's figure has no source and sits between fire and quake. Pure tables and functions.
import { dmath } from "../kernel/index.ts";

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
export const STRIKE_HURT = { fire: 2, quake: 3, meteor: 1.2, flood: 0.4 } as const;

/** The care a host's wounded get: the sum of the weights of the principles known (0 to 1). */
export function woundCare(known: (principle: string) => boolean): number {
  let care = 0;
  for (const [principle, weight] of CARE_PRINCIPLES) {
    if (known(principle)) care += weight;
  }
  return Math.min(1, care);
}

/** What struck a side: the foe's blow and shock; the side's protection, care and body (kg). */
export type Struck = {
  readonly blow: Blow;
  readonly shock: number;
  readonly protection: number;
  readonly care: number;
  readonly size: number;
};

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

/** Of the struck, the share killed outright on the field. */
function killedOutright(s: Struck): number {
  const turned = 1 - TURN[s.blow] * dmath.clamp(s.protection, 0, 1);
  return Math.min(
    1,
    WOUNDS.vital * LETHAL[s.blow] * bodyFactor(s.size) * turned * shockFactor(s.shock),
  );
}

/** Of the struck (killed or wounded), the share killed: on the field and of their wounds after. */
export function fallenShare(s: Struck): number {
  const killed = killedOutright(s),
    later = DIED_OF_WOUNDS[s.blow] * (1 - WOUNDS.save * dmath.clamp(s.care, 0, 1));
  return dmath.clamp(killed + (1 - killed) * later, WOUNDS.least, WOUNDS.most);
}

/** Wounded who live for each one who falls: (1 − F) / F. */
export function woundedPerFallen(s: Struck): number {
  const f = fallenShare(s);
  return (1 - f) / f;
}

/** Of the wounded who live, the share maimed. */
export function maimedShare(blow: Blow, care: number): number {
  const [least, most] = MAIMED_BOUNDS;
  return dmath.clamp(MAIM[blow] * (1 - SALVAGE[blow] * dmath.clamp(care, 0, 1)), least, most);
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
  return { wounded, maimed: Math.round(wounded * maimedShare(s.blow, s.care)) };
}

/** The wounded a strike leaves: its dead times the strike's ratio, rounded. */
export function strikeHurt(kind: keyof typeof STRIKE_HURT, dead: number): number {
  return Math.round(dead * STRIKE_HURT[kind]);
}
