// Those left unable to work (the last gaps, 2026-11-24). Before it the maimed of a battle were counted and went home to work as
// they had, and a land's settled sicknesses and foul air killed and left no one weakened. A rule says what a thing does; a land's
// own numbers say how much.
//   Who is left unable: for each of the grown a mishap kills, some live on unable (the hazard is the grown's fewest deaths in
//   their kind's life table, what kills them before age does); a sickness settled in a land leaves some of the grown it does not
//   kill weak for good; foul air leaves some short of breath; and its realm's maimed come home from its wars.
//   How many there are at once: those made so each year, by the years they live on. Those no one keeps (kin, temple, savings or a
//   realm's pension: the same keepers as the old's, rules/care.ts keptOld) die the sooner, so a land that keeps its unable has more
//   of them living, and bears them: they leave its workers and are fed as its children are.
// Pure functions of a land's numbers.
import { dmath } from "../kernel/index.ts";

export const DISABLED = {
  /** Left unable for each of the grown a mishap kills (est: falls, burns, the plough and the axe). */
  perMishap: 0.15,
  /** Left weak for good among the grown, for each of the young a settled sickness kills a year (est). */
  perSick: 0.1,
  /** Of a land's grown, those its air leaves short of breath a year at its foulest (est). */
  perSmoke: 0.002,
  /** How much sooner those no one keeps die (the frail's neglect, rules/care.ts CARE_OLD.neglect). */
  neglect: 0.5,
  /** The most of a land's grown reckoned unable. */
  most: 0.25,
  /** A land whose unable are this share of its grown is told, and again only after they fall under half of it. */
  told: 0.05,
} as const;

/** What leaves a land's grown unable. */
export type DisabledMeans = {
  /** The grown's fewest deaths a year in their kind's life table (what kills before age does). */
  readonly hazard: number;
  /** Of its young, the share its settled sicknesses kill a year; how foul its air is (0 … 1). */
  readonly endemic: number;
  readonly smoke: number;
  /** Its realm's maimed still living, for each of its grown. */
  readonly maimed: number;
  /** The years one of its grown has left on the mean. */
  readonly years: number;
  /** The share of what is known of healing its care brings to bear (0 … 1), and the share of its unable no one keeps. */
  readonly spared: number;
  readonly neglected: number;
};

/** A land's unable: their share of its grown, by what made them so (mishap, sickness, foul air, war), and the share kept. */
export type Disabled = {
  readonly share: number;
  readonly mishap: number;
  readonly sick: number;
  readonly smoke: number;
  readonly war: number;
  readonly kept: number;
};

export function disabledOf(m: DisabledMeans): Disabled {
  const neglected = dmath.clamp(m.neglected, 0, 1),
    // (Those no one keeps live on 1 / (1 + neglect) as long.)
    lived = Math.max(0, m.years) * (1 - (neglected * DISABLED.neglect) / (1 + DISABLED.neglect)),
    healed = 1 - dmath.clamp(m.spared, 0, 1),
    mishap = Math.max(0, m.hazard) * DISABLED.perMishap * healed * lived,
    sick = Math.max(0, m.endemic) * DISABLED.perSick * healed * lived,
    smoke = dmath.clamp(m.smoke, 0, 1) * DISABLED.perSmoke * lived,
    war = Math.max(0, m.maimed),
    all = mishap + sick + smoke + war,
    k = all > DISABLED.most ? DISABLED.most / all : 1;
  return {
    share: all * k,
    mishap: mishap * k,
    sick: sick * k,
    smoke: smoke * k,
    war: war * k,
    kept: 1 - neglected,
  };
}

/** Of a realm's maimed in a war ended so many years ago (0: still fought), the share still living, of grown with `years` left. */
export function maimedLiving(since: number, years: number): number {
  return years > 0 ? dmath.clamp(1 - Math.max(0, since) / years, 0, 1) : 0;
}
