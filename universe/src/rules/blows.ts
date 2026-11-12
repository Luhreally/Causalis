// Where a battle's blows land and what they do (Phase 55's blows track, moved here from view/blows.ts
// in Phase 61 so the fight the hand takes a soldier into deals its blows by the same rule the battle
// views draw them by): the eight places a blow lands on a figure, by the rule of nines; of the blows
// that land on a place, the share that kill — by a hand's arm, an arrow, a dart, a bullet (rules/
// wounds.ts LETHAL, rules/anatomy.ts's limbs and head), a cannon's ball and a bursting shell; where a
// blow lands given what came of it; how many limbs are cut off at most; how many of a side's figures
// are drawn as its wounded who lived. view/blows.ts and view/battle.ts give these on as they were.
// Pure tables and functions.
import { CUTS_OFF, KILL, LIMB_KILL, MAIMED_AT, NINES } from "./anatomy.ts";
import { LETHAL, type Blow } from "./wounds.ts";

/** Where a blow lands (Phase 55): the rule of nines' places, each arm's hand apart. */
export type BlowPlace =
  "head" | "trunk" | "arm-l" | "arm-r" | "hand-l" | "hand-r" | "leg-l" | "leg-r";
/** The places, in order (each one's bit in the render's masks is 1 << its index). */
export const BLOW_PLACES: readonly BlowPlace[] = [
  "head",
  "trunk",
  "arm-l",
  "arm-r",
  "hand-l",
  "hand-r",
  "leg-l",
  "leg-r",
];

/** What struck: a hand's blow, an arrow or a dart (they stick), a bullet, a cannon's ball, a shell. */
export type Striker = "hand" | "arrow" | "dart" | "bullet" | "ball" | "shell";

/** A cannon's ball and a bursting shell kill as no hand does: on the head, the trunk, a limb. */
export const ORDNANCE_KILL = {
  ball: { head: 0.95, trunk: 0.95, limb: 0.4 },
  shell: { head: 0.95, trunk: 0.8, limb: 0.3 },
} as const;
/**
 * Of the dead, the share whose struck limb is cut off: by an axe or a sword, a cannon's ball, a
 * shell; a head struck so, this share of that (an axe,
 * a sword, a ball). Of a side, at most `most` parts cut off, the dead's and the living's together.
 */
export const SEVER = { edge: 0.42, ball: 0.65, shell: 0.6, head: 0.6, most: 60 } as const;
/**
 * Of a battle's dead, the share whose death took a part off, by what struck them (asked for
 * 2026-11-11: "each battle with swords and especially firearms should contain dismemberment"): an
 * axe's or a sword's edge; a cannon's ball, a bursting shell; a gun's round by the arm — a heavy
 * soft ball or a rifle's round breaks a limb past holding now and again, a machine gun's burst, many
 * rounds into one place, oftener. That blow is the one that killed, on the part it took
 * (severWeights).
 */
export const SEVERED = {
  edge: 0.3,
  ball: 0.5,
  shell: 0.45,
  shot: { musket: 0.12, rifle: 0.15, repeater: 0.15, autoloader: 0.18, automatic: 0.35 },
} as const;
/**
 * The share of the dead struck by `striker` (a hand's blow with `arm`, a gun's round from `arm`, a
 * ball, a shell) whose death took a part off. History's record of the fallen (host/wounds.ts) and the
 * battle drawn (view/blows.ts) read it alike, so the part a figure is seen to lose is the part their
 * page says they lost.
 */
export function severShare(striker: Striker, arm: string | undefined): number {
  switch (striker) {
    case "ball":
      return SEVERED.ball;
    case "shell":
      return SEVERED.shell;
    case "hand":
      return arm !== undefined && CUTS_OFF.has(arm) ? SEVERED.edge : 0;
    case "bullet":
      return arm !== undefined && Object.hasOwn(SEVERED.shot, arm)
        ? SEVERED.shot[arm as keyof typeof SEVERED.shot]
        : 0;
    default:
      return 0;
  }
}
/**
 * Where a blow that takes a part off takes it (weights in BLOW_PLACES' order): never the trunk; a
 * head by an edge or a ball, never by a round or a shell (they shatter one; they do not take it off);
 * a shell's and a ball's oftenest the legs, a round's the arms and hands.
 */
export function severWeights(striker: Striker): readonly number[] {
  switch (striker) {
    case "hand":
      return [0.14, 0, 0.19, 0.19, 0.1, 0.1, 0.14, 0.14];
    case "ball":
      return [0.12, 0, 0.17, 0.17, 0.06, 0.06, 0.21, 0.21];
    case "shell":
      return [0, 0, 0.18, 0.18, 0.07, 0.07, 0.25, 0.25];
    default:
      return [0, 0, 0.2, 0.2, 0.14, 0.14, 0.16, 0.16];
  }
}
/** The wounded who live drawn: at most this share of a side's figures that do not fall. */
export const HURT = { most: 0.8 } as const;

const isLimb = (p: BlowPlace) => p !== "head" && p !== "trunk";

/** Of blows that land on a place, the share that kill. */
export function killShare(place: BlowPlace, striker: Striker, blow: Blow): number {
  if (striker === "ball" || striker === "shell") {
    const k = ORDNANCE_KILL[striker];
    return place === "head" ? k.head : place === "trunk" ? k.trunk : k.limb;
  }
  return place === "head"
    ? Math.min(KILL.most, LETHAL[blow] * KILL.head)
    : place === "trunk"
      ? LETHAL[blow]
      : LIMB_KILL[blow];
}

/**
 * The weights of where a blow lands, given its outcome (in BLOW_PLACES' order): the nines, times
 * the share that kills (the dead) or that does not (the wounded who live); a maimed one's, on the
 * limbs alone (an axe's or a sword's by MAIMED_AT).
 */
export function placeWeights(
  outcome: "dead" | "wounded" | "maimed",
  striker: Striker,
  blow: Blow,
  cuts: boolean,
): number[] {
  return BLOW_PLACES.map((p) => {
    if (outcome === "maimed") {
      if (!isLimb(p)) return 0;
      if (cuts)
        return p.startsWith("hand")
          ? MAIMED_AT.hand
          : p.startsWith("arm")
            ? MAIMED_AT.arm
            : MAIMED_AT.leg;
      return NINES[p];
    }
    const k = killShare(p, striker, blow);
    return NINES[p] * (outcome === "dead" ? k : 1 - k);
  });
}

/** A place drawn by its weight (`r` 0 … 1). */
export function blowPlaceOf(weights: readonly number[], r: number): BlowPlace {
  const total = weights.reduce((a, b) => a + b, 0);
  let at = r * total;
  for (let i = 0; i < BLOW_PLACES.length; i++) {
    at -= weights[i]!;
    if (at < 0) return BLOW_PLACES[i]!;
  }
  return BLOW_PLACES[weights.findLastIndex((w) => w > 0)] ?? "trunk";
}

/**
 * How many of a side's figures are drawn as its wounded who lived: so many for so many men, at most
 * HURT.most of those that may be (its figures that do not fall: the one rule, bridge/roll.ts
 * battleFigures, so the roll names each of them).
 */
export function hurtFigures(wounded: number, eligible: number, per: number): number {
  return wounded > 0
    ? Math.max(
        0,
        Math.min(Math.floor(HURT.most * eligible), Math.round(wounded / Math.max(1, per))),
      )
    : 0;
}
