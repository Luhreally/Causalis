// Intoxicants (Round B, asked 2026-11-16: "are drugs in the game and that nuance to society and civs?"). What a world's own life makes
// that acts on its people's nerves, and what a people makes of it. A rule says what a thing does; a world's life says what there is.
//   What there is (intoxAvailable): a plant makes compounds to keep from being eaten, the more where growth is rich and eaters many
//     (warm, wet, crowded lands: Earth's tropics hold the most alkaloids). Each lineage that grows (a seed grass, a light-eater) may
//     hold one kind of its own, and, a great clade, others besides (INTOX_ALSO); a ferment calms wherever its life makes sugar and
//     its people brew. They act only on a body of the same
//     liquid and hand as the life that made them: none on a world whose life is not the people's own.
//   Who takes it (intoxUse): as much as there is, as far as a people wants it (its rites for what brings visions, its toil and its
//     hours for what wakes, its wounds and sickness for what eases pain, its hardship for what calms), less what a law forbids.
//   What it gives and costs (intoxEffects): rites kept, pain eased, work done awake; and those who come to need it, the work they
//     lose, the deaths of the few who take too much.
//   Who forbids it (prohibits): the temple where its rites do not use it and the court where its people's work is lost to it, by how
//     hard the realm is held and how little its people have a voice, against the traders and treasury who live by its trade and the
//     many who take it, as far as they are heard.
//   Cartels (cartel): where it is forbidden, worth much and the realm's reach is weak, those who carry it organise to carry it.
// Pure tables and functions. Pages say what, who, cost and effect: never how anything is made.
import { dmath } from "../kernel/index.ts";

/** What a compound does to a nervous system like its makers' eaters'. */
export const INTOX_KINDS = ["calming", "waking", "visions", "easing"] as const;
export type IntoxKind = (typeof INTOX_KINDS)[number];
export const INTOX_WORDS: Readonly<Record<IntoxKind, { name: string; does: string }>> = {
  calming: {
    name: "what calms",
    does: "slows and soothes; taken at feasts and to forget hardship",
  },
  waking: { name: "what wakes", does: "keeps the tired awake and the hungry working" },
  visions: {
    name: "what brings visions",
    does: "opens the mind to sights and voices; kept for rites",
  },
  easing: {
    name: "what eases pain",
    does: "dulls pain and brings sleep; a healer's and a sufferer's",
  },
};
/**
 * How each kind binds those who take it (the share of steady users who come to need it), how much of a dependent's work it takes,
 * and how many of its dependents a year it kills (est: alcohol and opiates bind a tenth to a quarter of steady users; stimulants
 * fewer; the visionary next to none, and kill next to none).
 */
export const INTOX_HOLD: Readonly<
  Record<IntoxKind, { binds: number; work: number; kills: number }>
> = {
  calming: { binds: 0.12, work: 0.25, kills: 0.004 },
  waking: { binds: 0.08, work: -0.1, kills: 0.001 },
  visions: { binds: 0.01, work: 0.1, kills: 0.0002 },
  easing: { binds: 0.22, work: 0.45, kills: 0.008 },
};

/** Of a world's growing lineages, the share that holds each kind (est: of Earth's flowering plants, some 1 in 5 makes an active alkaloid). */
export const INTOX_LINEAGE = 0.2;
/**
 * Of a world's growing lineages, the share that holds each other kind besides the one it may hold of its own: a lineage is a great
 * clade, and a clade makes several defences (est: Earth's nightshades hold what eases pain and what brings visions both; its
 * mallows' kin both what wakes and what calms). Without it a world of nine lineages lacked what wakes two times in three.
 */
export const INTOX_ALSO = 0.15;

/** What a land's own life puts within reach of each kind (0 … 1), read from what grows there and how richly. */
export function intoxAvailable(
  lineages: readonly IntoxKind[],
  growth: number,
  eaters: number,
  ferment: boolean,
  acts: boolean,
): Record<IntoxKind, number> {
  const out = { calming: 0, waking: 0, visions: 0, easing: 0 } as Record<IntoxKind, number>;
  if (!acts) return out;
  // (Defences are thicker where growth is rich and the eaters many.)
  const rich = dmath.clamp(growth, 0, 1) * (0.5 + 0.5 * dmath.clamp(eaters / 8, 0, 1));
  for (const k of lineages) out[k] = dmath.clamp(out[k] + 0.6 * rich + 0.2, 0, 1);
  if (ferment) out.calming = Math.max(out.calming, 0.8);
  return out;
}

/** What a people wants of each kind, from its ways and its years (each 0 … 1). */
export type IntoxWants = {
  readonly piety: number;
  readonly toil: number;
  readonly pain: number;
  readonly hardship: number;
};

/** The share of a land's people who would take each kind steadily were it within reach and allowed: by their ways and years. */
export function intoxWant(w: IntoxWants): Record<IntoxKind, number> {
  return {
    calming: 0.2 + 0.4 * w.hardship,
    waking: 0.1 + 0.5 * w.toil,
    visions: 0.05 + 0.25 * w.piety,
    easing: 0.05 + 0.5 * w.pain,
  };
}

/** The share of those who want a kind that a law keeps from it (0 … 0.7). */
export const lawKeeps = (barred: number): number => 0.7 * dmath.clamp(barred, 0, 1);

/**
 * The share of a land's people who take each kind steadily: what there is, what they want, less what a law keeps from them (one law
 * for all four, or each kind's own: a realm may forbid what brings visions and only tax what calms).
 */
export function intoxUse(
  have: Readonly<Record<IntoxKind, number>>,
  w: IntoxWants,
  barred: number | Readonly<Record<IntoxKind, number>>,
): Record<IntoxKind, number> {
  const want = intoxWant(w),
    out = {} as Record<IntoxKind, number>;
  for (const k of INTOX_KINDS) {
    const kept = 1 - lawKeeps(typeof barred === "number" ? barred : barred[k]);
    out[k] = dmath.clamp(have[k] * want[k] * kept, 0, 0.6);
  }
  return out;
}

/** What one kind's steady takers cost a people, a share of its people each (dependent, work lost, deaths a year): INTOX_HOLD. */
export function kindCost(
  k: IntoxKind,
  use: number,
): { dependent: number; lost: number; deaths: number } {
  const h = INTOX_HOLD[k],
    d = use * h.binds;
  return {
    dependent: d,
    lost: h.work >= 0 ? d * h.work : use * h.work * 0.2,
    deaths: d * h.kills,
  };
}

/** What a land's use gives and costs it in a year. */
export type IntoxEffects = {
  /** Of its people, the share who need it. */
  readonly dependent: number;
  /** Of its workers' work, the share lost (less what waking gives). */
  readonly lost: number;
  /** Of its people, the share who die of it in a year. */
  readonly deaths: number;
  /** How far its rites draw on it (0 … 1), and its sufferers' pain eased. */
  readonly rites: number;
  readonly eased: number;
};

export function intoxEffects(use: Readonly<Record<IntoxKind, number>>): IntoxEffects {
  let dependent = 0,
    lost = 0,
    deaths = 0;
  for (const k of INTOX_KINDS) {
    const d = use[k] * INTOX_HOLD[k].binds;
    dependent += d;
    lost += INTOX_HOLD[k].work >= 0 ? d * INTOX_HOLD[k].work : use[k] * INTOX_HOLD[k].work * 0.2;
    deaths += d * INTOX_HOLD[k].kills;
  }
  return {
    dependent: dmath.clamp(dependent, 0, 1),
    lost: dmath.clamp(lost, -0.05, 0.5),
    deaths: dmath.clamp(deaths, 0, 0.01),
    rites: dmath.clamp(use.visions * 3, 0, 1),
    eased: dmath.clamp(use.easing * 2, 0, 1),
  };
}

/** Those who would forbid it and those who would keep it, as a realm weighs a law against it. */
export type BarSides = {
  /** The temple's sway, and how far its rites draw on what is forbidden (a faith that uses it does not forbid it). */
  readonly temple: number;
  readonly rites: number;
  /** The court's sway, and the work its people lose to it. */
  readonly court: number;
  readonly lost: number;
  /** How hard the realm is held (force), how far its people are heard (voice), how far word moves freely (word). */
  readonly force: number;
  readonly voice: number;
  readonly word: number;
  /** The traders' sway; what its treasury takes of it, as a share of what it takes in; the share of its people who take it. */
  readonly traders: number;
  readonly excise: number;
  readonly users: number;
};

/**
 * How far a realm forbids intoxicants (0 … 1) and its parts: the temple whose rites do not use them and the court whose people's work
 * they take, pressing the harder the more the realm is held by force and the less its people speak; the traders and the treasury who
 * live by them, and their takers as far as they have a voice and word moves, against it.
 */
export function prohibits(s: BarSides): { level: number; parts: [string, number][] } {
  const parts: [string, number][] = [
    ["the temple, whose rites do not use them", 1.2 * s.temple * (1 - s.rites)],
    ["the court, whose people's work they take", 3 * s.court * s.lost],
    ["a realm held hard", 0.4 * (s.force - 0.5)],
    ["traders who live by their trade", -1.2 * s.traders],
    ["what its treasury takes of them", -2 * s.excise],
    ["their takers, as far as they are heard", -s.users * (0.3 + s.voice + 0.5 * s.word)],
  ];
  const sum = parts.reduce((a, [, v]) => a + v, 0);
  return { level: dmath.clamp(sum, 0, 1), parts };
}

/**
 * How strongly those who carry a forbidden trade organise (0 … 1): where it is forbidden, its trade is worth much against what else
 * its carriers could earn, and the realm's reach is weak and its officers can be bought.
 */
export function cartel(
  barred: number,
  profit: number,
  capacity: number,
  corruption: number,
): number {
  return dmath.clamp(
    barred *
      dmath.clamp(profit, 0, 2) *
      (1 - dmath.clamp(capacity, 0, 1)) *
      (0.4 + dmath.clamp(corruption, 0, 1)) *
      1.5,
    0,
    1,
  );
}

/** How heavy a dose's worth is against grain (it goes a long way: est: a year's steady use weighs a few kilograms). */
export const INTOX_BULK = 0.02;
/** A realm lays at most this on its sale, or keeps it to itself where it holds its trade. */
export const EXCISE_MOST = 0.4;
