// What crosses a border unseen, ware by ware (asked 2026-11-16: "why is it only what calms that I see smuggled, everything else is
// always zero"). Before, a realm kept one share smuggled "of what it bars or taxes", and no page could say of what. Now a ware is
// smuggled across a border where its wedge beats the risk of carrying it:
//   the wedge: the realm's tariff on goods from abroad; its sanctions on a realm it fears (that realm's goods); war (trade with the
//     enemy forbidden: every good the enemy's side holds cheaper); a house's licence over the trade (its holder's markup); its law on
//     what calms, wakes, brings visions and eases pain, kind by kind; and arms, where a realm held hard bars them to its people;
//   the risk: the odds of being caught (rules/money.ts smuggled), and how hard the ware is to hide and carry for its worth. A load of
//     tin or tools is worth a dozen of grain and hides in a cart; grain is worth its bulk only (the cost of carrying it unseen is
//     the cost of carrying it at all). So what is worth much for its bulk slips past first: metals, tools, clothes, machines, what
//     calms or eases, arms.
// Pure tables and functions.
import { dmath } from "../kernel/index.ts";
import { GOODS } from "./goods.ts";
import { INTOX_BULK, INTOX_KINDS, INTOX_WORDS } from "./intox.ts";

/** The wares a realm's contraband is told in: every good (GOODS order), then each kind of intoxicant, then arms. */
export const WARE_INTOX = GOODS.length;
export const WARE_ARMS = GOODS.length + INTOX_KINDS.length;
export const WARE_COUNT = WARE_ARMS + 1;

/** A ware in words ("tin", "what eases pain", "arms"). */
export function wareName(ware: number): string {
  if (ware < WARE_INTOX) return GOODS[ware]?.name ?? "a good";
  if (ware < WARE_ARMS) return INTOX_WORDS[INTOX_KINDS[ware - WARE_INTOX]!].name;
  return "arms";
}

/** Arms' worth for their bulk against grain's (est: a sword or a musket is worth months of food and weighs a few kilograms). */
export const ARMS_DENSITY = 30;

/** A ware's worth for its bulk against grain's (grain: 1). */
export function wareDensity(ware: number): number {
  if (ware < WARE_INTOX) {
    const g = GOODS[ware];
    return g ? g.value / Math.max(0.05, g.bulk) : 1;
  }
  return ware < WARE_ARMS ? 1 / INTOX_BULK : ARMS_DENSITY;
}

/** The worth for bulk at which carrying a ware unseen costs as a realm's trade as a whole does (est: tools', a cart's load of them). */
export const DENSE = 15;

/**
 * What carrying a ware unseen costs against a realm's trade as a whole (rules/money.ts smuggled, `carry`): the more for its bulk
 * against its worth (grain nearly four times, tools once, what eases pain half), within 0.3 … 4.
 */
export function carryCost(density: number): number {
  return dmath.clamp(dmath.sqrt(DENSE / Math.max(0.01, density)), 0.3, 4);
}

/** Why a ware is smuggled: the wedge that set it. */
export const CONTRA_CAUSES = [
  "tariff",
  "sanction",
  "war",
  "licence",
  "law",
  "excise",
  "harm",
] as const;
export type ContraCause = (typeof CONTRA_CAUSES)[number];
export const CONTRA_WHY: Readonly<Record<ContraCause, string>> = {
  tariff: "its tariff on goods from abroad",
  sanction: "its sanctions on a realm it fears",
  war: "war: trade with the enemy forbidden",
  licence: "a house's licence over the trade",
  law: "its law against it",
  excise: "its excise on it",
  harm: "it bars arms to its people",
};

/**
 * How far a realm bars arms to its people (0 … 1): a realm held by force fears its people armed, the less as they are heard and
 * word moves freely (est: the gun laws of a garrison state against a commonwealth's militia).
 */
export function armsBarred(force: number, voice: number, word: number): number {
  return dmath.clamp(2 * (force - 0.5) - voice - 0.5 * word, 0, 1);
}

/**
 * The trade that would cross between two lands at war in a ware, had war not forbidden it, as trade weighs it (sim/economy trade):
 * a share of what the cheaper side can spare, as far as the gap beyond carrying it pays (est: a quarter of a land's spare a year).
 */
export function wouldCross(spare: number, gap: number, price: number): number {
  if (spare <= 0 || gap <= 0 || price <= 0) return 0;
  return 0.25 * spare * Math.min(1, (2 * gap) / price);
}

/**
 * A realm's trade gone underground, told once a realm: the first ware that a sanction, a war, a licence, its law or its bar on arms
 * drives across its borders unseen, at least this share of it, worth at least this share of what its markets deal in a year. (What
 * slips past a tariff is ordinary, and told once as smuggling.)
 */
export const UNDERGROUND: {
  readonly share: number;
  readonly worth: number;
  readonly causes: readonly ContraCause[];
} = { share: 0.5, worth: 0.01, causes: ["sanction", "war", "licence", "law", "harm"] };
