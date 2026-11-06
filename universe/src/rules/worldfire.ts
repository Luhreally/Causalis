// Arms past the greatest fire (War past the line, W6; asked for 2026-11-05: "theres technially more powerful stuff like planet
// destoryers and star wars type stuff, but yk make it high stakes that everyone feels like real life"). The same rule one rung up
// and then two: a fire carried to another world, a world's whole sky burned, a world unmade. What each takes is read off the target's
// own numbers and what a people commands off a drive's speed or a star's light, by one function and no list: energy is half a mass
// by its speed squared; a star's light is its output by the share of it gathered; a sky is its air, by its pressure, its size and
// its pull, warmed through; a world is its binding energy (rules/greatfire.ts `unmakeMj`). Every strength is one game number, an
// estimate, the size of what any encyclopedia says of great impacts and stars. How such things are made is no part of this game.
// It is not the top of any ladder either: energy goes on. Pure tables and functions.
import { dmath } from "../kernel/index.ts";
import { FIRE, chanceOfFall, unmakeMj, worksChance } from "./greatfire.ts";
import { mirrorKw } from "./late.ts";
import { LIGHT_KMS } from "./starships.ts";

/** A rung past the town's: a fire carried to another world, a sky burned, a world unmade. */
export type Rung = "carried" | "sky" | "world";
/** The rungs, from the least. */
export const RUNGS: readonly Rung[] = ["carried", "sky", "world"];

export const FAR = {
  /** What a great hull of war weighs (kg, est), and how many a fleet goes in (`FLEET_HULLS`): its own speed is the strike. */
  hullKg: 1e8,
  hulls: 3,
  /** What it takes to warm a kilogram of air through, enough to burn a sky (J, est: some 100 degrees at air's heat). */
  airJKg: 1e5,
  /** How long gathered light is turned on one mark (years, est: a generation's turning). */
  gatherYears: 25,
  /** A great works to turn a star's light: years, and what it takes of the realm's machines, iron and fuel in each (est: most of all it has, over generations). */
  worksYears: 60,
  worksShare: 0.02,
  /** Only a realm with this share of the machines of the world's richest can pay for one (est). */
  worksRich: 0.5,
  /** How much rarer this is begun than the greatest fire's own works (est). */
  worksRare: 0.04,
  /** How badly a fleet's odds must read before the world holds its breath, by rung (0 … 1, est): higher, the greater the fire. */
  line: { carried: FIRE.crisisLine, sky: 0.62, world: 0.75 } as Readonly<Record<Rung, number>>,
  /** How long after a year everyone held their breath before the next (years, est): wars between the stars are many, and a world cannot hold it every generation. */
  quiet: 60,
  /** How much rarer than the town's each rung is loosed (est): each more rarely than the one before. */
  rarer: { carried: 0.25, sky: 0.05, world: 0.004 } as Readonly<Record<Rung, number>>,
  /** How deep a first of each rung sets the world's dread (est). */
  dread: { carried: 0.7, sky: 0.85, world: 0.97 } as Readonly<Record<Rung, number>>,
  /** What of a world's people die of a sky burned, and how long its fields lie under it (years, est). */
  skyDead: 0.5,
  skyYears: 30,
  /** What a people of the stars could do in answer, of the striker's people, once it has sailed this long (est), and over how long it comes to that. */
  answerShare: 0.012,
  answerYears: 400,
} as const;

/** A world as these numbers read it. */
export type FarWorld = {
  /** Its pull against Earth's, its radius against Earth's, its air in bars. */
  readonly pull: number;
  readonly radius: number;
  readonly airBar: number;
};

/** What a people commands, in MJ: all its greatest fire, its fleet's own speed, its star's light gathered; and whether its great works is done. */
export type Command = {
  readonly fireMj: number;
  readonly hullMj: number;
  readonly lightMj: number;
  readonly works: boolean;
};

/** What a fleet of great hulls brings at its cruise (MJ): half the mass by its speed squared. */
export function hullMj(shareOfLight: number): number {
  const v = shareOfLight * LIGHT_KMS * 1000;
  return (0.5 * FAR.hullKg * FAR.hulls * v * v) / 1e6;
}

/** What it takes to burn a world's whole sky (MJ): its air, by its pressure over its pull across its whole face, warmed through. No air: nothing can (Infinity). */
export function skyMj(w: FarWorld): number {
  if (w.airBar <= 0) return Infinity;
  const R = 6.371e6 * w.radius,
    airKg = (w.airBar * 1e5 * 4 * Math.PI * R * R) / (w.pull * 9.81);
  return (airKg * FAR.airJKg) / 1e6;
}

/** What a star's light brings, from so many km² of mirrors so far out, gathered over so many years (MJ). */
export function lightMj(km2: number, luminosity: number, au: number, years: number): number {
  return (mirrorKw(km2, luminosity, au) * 1e3 * 365.25 * 86400 * years) / 1e6;
}

/** The most a people can bring to one mark now: its star's light only once its great works is done. */
export const bestMj = (c: Command): number =>
  Math.max(c.hullMj, c.works ? c.lightMj : 0, c.fireMj > 0 ? FIRE.mj : 0);

/** The highest rung a people can reach on a world, by the numbers (null: none). */
export function rungOf(c: Command, w: FarWorld): Rung | null {
  const best = Math.max(c.hullMj, c.works ? c.lightMj : 0);
  if (best >= unmakeMj(w)) return "world";
  if (best >= skyMj(w)) return "sky";
  return c.fireMj > 0 ? "carried" : null;
}

/** What a rung takes on a world (MJ). */
export const needOf = (rung: Rung, w: FarWorld): number =>
  rung === "world" ? unmakeMj(w) : rung === "sky" ? skyMj(w) : FIRE.mj;

/** How a war between the stars reads to the one who sent the fleet (0 … 1): the share of its fleet's odds against it. */
export const farGoing = (strength: number, defence: number): number =>
  defence / Math.max(1e-6, strength + defence);

/** The chance a ruler looses a rung, at the brink: the town's own sum, and each rung rarer. */
export function chanceOfRung(rung: Rung, i: Parameters<typeof chanceOfFall>[0]): number {
  return chanceOfFall(i) * FAR.rarer[rung];
}

/** What a people of the stars could answer with, as a share of the striker's people: more, the longer it has sailed. Nothing before it sails. */
export const farAnswerShare = (yearsSailing: number): number =>
  yearsSailing <= 0 ? 0 : FAR.answerShare * Math.min(1, yearsSailing / FAR.answerYears);

/** What a realm's reasons come to, to begin turning its star's light: the greatest fire's own sum, and far rarer. */
export function farWorksChance(i: Parameters<typeof worksChance>[0]): number {
  return worksChance(i) * FAR.worksRare;
}

/** The world's dread after a rung falls: its first sets it deep; another of one already fallen deepens it a little, as the town's does. */
export const dreadAfter = (rung: Rung, was: number, first: boolean): number =>
  first ? Math.max(was, FAR.dread[rung]) : Math.min(0.99, was + FIRE.dreadMore / 3);

/** What it is called, from the point its people reached: by its world's own sun. */
export function rungName(rung: Rung, w: { readonly sunWm2: number }): string {
  if (rung === "carried") return w.sunWm2 < 400 ? "the dawn carried" : "the sun carried";
  if (rung === "sky") return w.sunWm2 < 400 ? "the long smother" : "the sky's burning";
  return w.sunWm2 < 400 ? "the last dusk" : "the unmaking";
}

/** A great energy in words: "1.2 × 10^18 MJ". */
export function mjWords(mj: number): string {
  if (!Number.isFinite(mj)) return "more than anything can bring";
  if (mj <= 0) return "nothing";
  let e = Math.floor(dmath.log(mj) / dmath.log(10)),
    m = Math.round((mj / dmath.pow(10, e)) * 10) / 10;
  if (m >= 10) {
    m /= 10;
    e += 1;
  }
  return `${m} × 10^${e} MJ`;
}

/** One number against another, in words a page can say: "one part in 190 million" or "2.3 times over". */
export function shareWords(have: number, need: number): string {
  if (!Number.isFinite(need)) return "there is no sky there to burn";
  if (have <= 0) return "nothing at all";
  const k = have / need;
  if (k >= 1) return `${k >= 10 ? Math.round(k) : k.toFixed(1)} times over`;
  const part = need / have;
  if (part < 1000) return `one part in ${Math.round(part)}`;
  if (part < 1e6) return `one part in ${Math.round(part / 1000)} thousand`;
  if (part < 1e9) return `one part in ${Math.round(part / 1e6)} million`;
  if (part < 1e12) return `one part in ${Math.round(part / 1e9)} billion`;
  return `one part in 10^${Math.round(dmath.log(part) / dmath.log(10))}`;
}
