// Deeds (asked 2026-11-19: "build the rest of the missing systems too in first principles fashion"). The groups, the bodies and
// the underworld each did what they do as a rate laid on a land: a group "kills so many a year", a court "holds so many", a
// voice "tells of its lands' grievance". None of it fell on anyone. This is the one rule under what was missing: an organised
// group or body ACTS ON SOMEONE OR SOMETHING THE WORLD KEEPS BY NAME, for its own aim, at a cost to itself, with a consequence
// that goes by the target's own rule:
//   - who it acts on is not chosen from a list of plots: it is whoever stands at the head of what its aim is against, within
//     its reach (AGAINST: those who would rise, the seat and those who keep its order; a pressed faith, the clergy that press
//     it; those who hold wrongdoers to account, the boss; those who take, the rich and the watch; those outside the law, the
//     judge, the watch and the voice that tell of them). A court's sentence, a voice's telling, a seat's shutting of a voice,
//     a works stopped by its hands are the same thing read from the body's side (sim/order/deeds.ts, sim/order/institutions.ts);
//   - whether it acts at all goes by how far what it does is against anyone (`will`), how hard it is pressed, and its numbers;
//   - how it goes is its reach against the target's guard: an honest, manned watch where the target is, the seat's hand;
//   - what it costs is men taken in the answer, the more the further the seat reaches;
//   - what follows is the target's own ending: a ruler's death passes the seat by its realm's rule (and may break it), one of
//     name is ended as their people keep them, a body's head is followed by another and its work is shaken.
// Pure tables and functions: no draws, nothing kept. Pages say what, who, cost and effect: never how.
import { dmath } from "../kernel/index.ts";
import type { OrgAim } from "./groups.ts";
import type { InstDoes } from "./institutions.ts";
import type { Domain } from "./notables.ts";

const clamp01 = (x: number): number => dmath.clamp(x, 0, 1);

/** Whom a deed may fall on: a realm's ruler, the head of a body that does a thing, one of name in a domain, a crime group's boss. */
export type DeedAt =
  | { readonly who: "ruler" }
  | { readonly who: "head"; readonly does: InstDoes }
  | { readonly who: "notable"; readonly domain: Domain }
  | { readonly who: "boss" };

/** How a blow went. */
export const STRIKE_OUTCOMES = ["killed", "survived", "foiled", "spared"] as const;
export type StrikeOutcome = (typeof STRIKE_OUTCOMES)[number];

export const DEED = {
  /** A group wholly against someone, pressed hard, of a full crew, strikes at them so often a year. */
  strikes: 0.025,
  /** The least of what a group does that is against anyone, for it to strike at all. */
  willLeast: 0.15,
  /** An aim is against anyone only where it is this much of what a group does (thousandths): a fifth, as an aim is counted among those that do it. */
  aimLeast: 200,
  /** A blow's reach at the full (hidden and armed), and what each lack takes of it. */
  reach: 0.6,
  open: 0.75,
  unarmed: 0.7,
  /** A target outside the lands a group holds is this much harder to come at. */
  far: 0.5,
  /** What guards each kind of target before any watch: a ruler's own guard, a body's head, one of name, a boss's men. */
  guardRuler: 0.3,
  guardHead: 0.15,
  guardNotable: 0.1,
  guardBoss: 0.3,
  /** What a full, honest watch where the target is adds to their guard; and the seat's reach where no watch is kept. */
  watch: 0.5,
  hand: 0.3,
  /** Of a blow that did not kill, the share found out before it fell (the rest fell and missed). */
  foiled: 0.5,
  /** Of its men, those taken in the answer: for a kill, a blow that missed, one found out; each as far as the seat reaches. */
  lostKilled: 0.15,
  lostMissed: 0.08,
  lostFoiled: 0.25,
  /** A body whose head is killed loses this share of its hands for a time (they leave, or lie low). */
  shakes: 0.15,
  /** Those outside the law strike at those who hunt and tell of them as far as they are hunted and not bought. */
  hunted: 0.6,
} as const;

/**
 * Whom each aim stands against, and how far (shares of the aim): a table of what an aim is against, not of plots. An aim not
 * here is against no one (aid, lending, trade, office, inquiry, a company's hire).
 */
export const AGAINST: Readonly<Partial<Record<OrgAim, readonly (readonly [DeedAt, number])[]>>> = {
  // (Those who would rise: the seat, those who keep its order, who commands its host.)
  rebel: [
    [{ who: "ruler" }, 0.5],
    [{ who: "head", does: "order" }, 0.3],
    [{ who: "notable", domain: "war" }, 0.2],
  ],
  // (A sworn few against the seat: the seat itself, and who judges for it.)
  conspire: [
    [{ who: "ruler" }, 0.7],
    [{ who: "head", does: "judge" }, 0.3],
  ],
  // (A faith pressed: the clergy that press it, and who speaks for the seat's faith. Only where it is pressed: `pressed`.)
  worship: [
    [{ who: "head", does: "worship" }, 0.6],
    [{ who: "notable", domain: "faith" }, 0.4],
  ],
  // (Those who hold wrongdoers to account where the courts do not: the boss, the notorious.)
  enforce: [
    [{ who: "boss" }, 0.7],
    [{ who: "notable", domain: "infamy" }, 0.3],
  ],
  // (Those who take: the rich on their road, the watch that hunts them. Mostly they avoid both.)
  prey: [
    [{ who: "notable", domain: "wealth" }, 0.2],
    [{ who: "head", does: "order" }, 0.1],
  ],
  // (Those who fled: who comes to take them back.)
  refuge: [[{ who: "head", does: "order" }, 0.2]],
};

/** Whom those outside the law strike at, as far as they are hunted and told of (rules/underworld.ts kinds; DEED.hunted). */
export const CRIME_AGAINST: readonly (readonly [DeedAt, number])[] = [
  [{ who: "head", does: "judge" }, 0.3],
  [{ who: "head", does: "order" }, 0.25],
  [{ who: "head", does: "word" }, 0.25],
  [{ who: "notable", domain: "law" }, 0.2],
];

/**
 * How far what a group does is against each kind of target (each 0 … 1; their sum is its will to strike): its aims in
 * thousandths (by ORG_AIMS, as `aimIndex` gives them), a faith's aim only where it is pressed.
 */
export function againstOf(
  aims: readonly number[],
  aimIndex: Readonly<Record<OrgAim, number>>,
  pressed: boolean,
): { at: DeedAt; weight: number }[] {
  const out: { at: DeedAt; weight: number }[] = [];
  for (const aim of Object.keys(AGAINST) as OrgAim[]) {
    const share = aims[aimIndex[aim]] ?? 0,
      a = share / 1000;
    if (share < DEED.aimLeast || (aim === "worship" && !pressed)) continue;
    for (const [at, share] of AGAINST[aim]!) out.push({ at, weight: a * share });
  }
  return out;
}

/**
 * The chance a group strikes at someone within `span` years: how far what it does is against anyone (`will`, 0 … 1), how hard
 * it is pressed (its realm's hand on it, its land's grievance: 0 … 1), and its men against a full crew.
 */
export function blowChance(
  will: number,
  pressed: number,
  members: number,
  crew: number,
  span: number,
): number {
  if (will < DEED.willLeast || !(members > 0)) return 0;
  const size = Math.min(1, dmath.sqrt(members / Math.max(1, 4 * crew))),
    rate = DEED.strikes * clamp01(will) * (0.4 + 0.6 * clamp01(pressed)) * size;
  return 1 - dmath.exp(-rate * Math.max(1, span));
}

/** What guards a target (0 … 0.95): their own guard by kind, and the watch where they are, or the seat's hand where none is kept. */
export function guardOf(
  at: DeedAt["who"],
  watch: { watch: number; honest: number } | null,
  capacity: number,
  own = 0,
): number {
  const base =
    at === "ruler"
      ? DEED.guardRuler
      : at === "head"
        ? DEED.guardHead
        : at === "boss"
          ? DEED.guardBoss
          : DEED.guardNotable;
  // (A boss is guarded by his own men, not by the watch.)
  const kept =
    at === "boss"
      ? 0
      : watch && watch.watch > 0
        ? DEED.watch * clamp01(watch.watch) * clamp01(watch.honest)
        : DEED.hand * clamp01(capacity);
  return dmath.clamp(base + kept + clamp01(own), 0, 0.95);
}

/** A blow's reach (0 … 1): hidden groups come nearer, armed ones strike surer, and a target beyond its lands is far. */
export function strikeReach(hidden: boolean, armed: boolean, near: boolean): number {
  return DEED.reach * (hidden ? 1 : DEED.open) * (armed ? 1 : DEED.unarmed) * (near ? 1 : DEED.far);
}

/** How a blow goes, for a draw `u` (0 … 1): killed by its reach past the guard; else found out, or fallen and missed. */
export function strikeOutcome(reach: number, guard: number, u: number): StrikeOutcome {
  const kill = clamp01(reach) * (1 - clamp01(guard));
  if (u < kill) return "killed";
  return u < kill + (1 - kill) * DEED.foiled * clamp01(guard + 0.2) ? "foiled" : "survived";
}

/** Of a group's men, the share taken in the answer to a blow, as far as the seat reaches. */
export function strikeCost(outcome: StrikeOutcome, capacity: number): number {
  const k =
    outcome === "killed"
      ? DEED.lostKilled
      : outcome === "foiled"
        ? DEED.lostFoiled
        : DEED.lostMissed;
  return k * (0.3 + 0.7 * clamp01(capacity));
}

// —— A court's sentence ————————————————————————————————————————————————————————————————————————————————————

/** What a court does with one brought before it. */
export const SENTENCES = ["fined", "held", "labour", "death"] as const;
export type Sentence = (typeof SENTENCES)[number];

export const JUSTICE = {
  /** Those a full court holds a year for each hundred thousand of its lands, at the mildest; how far a seat that holds by arms
   * holds more; how far killing in its land brings more before it. */
  harsher: 0.8,
  crime: 2,
  /** Of those a court holds, the part put to labour: under a seat that rules by decree, and elsewhere. */
  labourDecree: 0.5,
  labour: 0.1,
  /** Grievance a reckoning in a court's land at the full: judges bought, and a harsh seat with no voice to answer to. */
  grievesBought: 0.03,
  grievesHarsh: 0.03,
  /** The chance in a reckoning a full, honest court tries one notorious in its lands; a harsh seat's, one who speaks freely. */
  tries: 0.5,
  silences: 0.15,
  /** Those held by name a court keeps account of; the years one is held, at the least and the most. */
  inmates: 4,
  termLeast: 3,
  termMost: 20,
  /** What being tried for one's word adds to one's name (thousandths of the line). */
  martyr: 250,
} as const;

/** How harsh a realm's justice is (0 … 1): a seat that holds by arms, with no voice to answer to. */
export function harshOf(force: number, voice: number): number {
  return clamp01(0.6 * clamp01(force) + 0.4 * (1 - clamp01(voice)));
}

/**
 * A court's sentence on one before it, for a draw `u` (0 … 1): how grave the charge (0 … 1), how harsh its realm's justice,
 * how far its judges are bought (one with a purse buys a fine), whether its seat rules by decree (and puts the held to labour).
 */
export function sentenceOf(
  u: number,
  f: { grave: number; harsh: number; bought: number; purse: boolean; decree: boolean },
): Sentence {
  const fined = f.purse ? 0.7 * clamp01(f.bought) : 0.15 * (1 - clamp01(f.grave)),
    death = (1 - fined) * clamp01(f.grave) * (0.1 + 0.6 * clamp01(f.harsh)),
    labour = (1 - fined - death) * (f.decree ? JUSTICE.labourDecree : JUSTICE.labour);
  return u < fined
    ? "fined"
    : u < fined + death
      ? "death"
      : u < fined + death + labour
        ? "labour"
        : "held";
}

/** Those a court holds (heads): for the people its lands hold, as it is manned, as its realm's justice is harsh and its land killed in. */
export function heldBy(
  people: number,
  per: number,
  manned: number,
  harsh: number,
  killed: number,
): number {
  return (
    Math.max(0, people) *
    per *
    1e-5 *
    clamp01(manned) *
    (0.6 + JUSTICE.harsher * clamp01(harsh)) *
    (1 + Math.min(JUSTICE.crime, 2000 * Math.max(0, killed)))
  );
}

/** How far each aim is against anyone at all (the sum of its shares in AGAINST), by the aim's place in a list of aims. */
export function againstWeights(aimNames: readonly OrgAim[]): number[] {
  return aimNames.map((a) => (AGAINST[a] ?? []).reduce((n, [, share]) => n + share, 0));
}
