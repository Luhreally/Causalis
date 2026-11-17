// Care of the sick and of the old (the society sweep, asked 2026-11-16: "medicine as an institution (healers, hospitals, public
// health) on top of the existing healing and pathogens ... ageing of a population (pensions, care)"). Before it, a land's deaths
// were spared all the healing its people knew, every one of them alike, whoever they were, and the old worked until they died with
// no one keeping them. A rule says what a thing does; a land's own numbers say how much.
//   Healers (careSpend, healersPerThousand): a household spends on its sick as far as it has more than it eats, and more the further
//     above its bread it lives (est: one to three in a hundred of what it has near its bread, a tenth far above it: care is wanted the
//     more the more there is). A healer is kept at CARE.wage of a worker's earnings, so the healers a land keeps are what it spends
//     over what one costs.
//   Who they reach (careReach, careAccess): the more healers a head the nearer one is; the poor go without as far as wealth lies with
//     few, unless the temple's alms or the realm's public care pays for them; where no healer comes, kin tend their own, at a part of
//     what a healer's tending does.
//   What it spares (careSpared): what the land knows of healing (the lore's health, at most CARE.most of its deaths, as the reckoning
//     of deaths had it), further where its towns keep hospitals, as far as its care reaches its people.
//   The old (frailBand, keptOld): those past the age their body's deaths begin to climb (a band whose deaths come CARE_OLD.frail times
//     as often as its grown's fewest) no longer do a full year's work. They are kept by their kin as far as their kind raises its young
//     together and holds to its kin, and has young enough to spare for them; by the temple's alms; by what they put by, where money is
//     kept and lent; by a realm's pension. Those no one keeps die the sooner; where only their children would keep them, a people
//     wants more children (each a keeper in age).
//   A realm's provision (pensionWanted, publicCareWanted): it pays its old where its people are heard, the old are many among them and
//     their kin keep them the less, and it can keep a roll of who is owed (writing and clerks); it pays the care of its poor where they
//     are heard and many go untended. Each costs it what it pays.
// Pure functions of a land's and a realm's numbers.
import { dmath } from "../kernel/index.ts";
import type { LifeHistory } from "./species.ts";
import type { Pairing } from "./self.ts";

const clamp01 = (x: number): number => dmath.clamp(x, 0, 1);

export const CARE = {
  /** A household spends at least this share of what it has on its sick, and up to `more` again as it lives far above its bread. */
  least: 0.015,
  more: 0.1,
  /** A healer is kept at this many times a worker's earnings (est: a skilled hand's). */
  wage: 3,
  /** Healers for this many in a thousand put one within reach of all but a share 1/e of a land's people. */
  reach: 2,
  /** How far the poor go untended where all a land's wealth lies with one (Gini 1), with no alms and no public care. */
  poorShut: 0.8,
  /** What kin's tending does where no healer comes, of a healer's. */
  kin: 0.35,
  /** Of the temple's alms, the share of its poor's care a devout people's temple pays (at a piety of 1). */
  alms: 0.4,
  /** Hospitals in a land's towns make what is known of healing go this much further where all its people live near one. */
  hospital: 0.25,
  /** The people a town must have before it keeps a hospital (rules/buildings.ts "hospital"). */
  hospitalTown: 3000,
  /** The most of a land's deaths what it knows of healing spares (the population's own reckoning had it so), and with hospitals. */
  most: 0.3,
  mostWithHospitals: 0.36,
} as const;

/** What a household spends on its sick, a share of what it has: more the further above its bread it lives (surplus 0 … 1). */
export function careSpend(surplus: number): number {
  return CARE.least + CARE.more * dmath.pow(clamp01(surplus), 1.5);
}

/** The healers a land keeps, in a thousand of its people: what it spends over what one costs, its workers' share of its people. */
export function healersPerThousand(spend: number, workersShare: number): number {
  return (1000 * Math.max(0, spend) * clamp01(workersShare)) / CARE.wage;
}

/** The share of a land's people a healer is within reach of. */
export function careReach(healersPerThousand: number): number {
  return 1 - dmath.exp(-Math.max(0, healersPerThousand) / CARE.reach);
}

/**
 * Of a land's people, the share a healer tends when they fall sick (0 … 1): those within reach, less the poor shut out by what they
 * cannot pay as far as wealth lies with few, unless the temple's alms or the realm's public care pays for them; and the share their
 * kin's tending makes of it where no healer comes (`effective`).
 */
export function careAccess(
  reach: number,
  gini: number,
  alms: number,
  publicCare: number,
): { access: number; effective: number } {
  const paid = Math.max(clamp01(alms), clamp01(publicCare)),
    access = clamp01(reach) * (1 - CARE.poorShut * clamp01(gini) * (1 - paid));
  return { access, effective: CARE.kin + (1 - CARE.kin) * access };
}

/** The temple's alms for the sick and the old, by how devout a people is (0 … CARE.alms). */
export function almsOf(piety: number): number {
  return CARE.alms * clamp01(piety);
}

/**
 * The share of a land's deaths its care spares: what it knows of healing (the lore's health), the further where its people live near a
 * hospital, as far as its care reaches them.
 */
export function careSpared(known: number, hospitals: number, effective: number): number {
  const k = Math.min(CARE.most, Math.max(0, known)) * (1 + CARE.hospital * clamp01(hospitals));
  return Math.min(CARE.mostWithHospitals, k * clamp01(effective));
}

// —— The old ——————————————————————————————————————————————————————————————————————————————————————————————————

export const CARE_OLD = {
  /** The frail are those of a band whose deaths come this many times as often as the grown's fewest (Gompertz: est, sixty in an ape). */
  frail: 5,
  /** How far kin keep their old, by how a kind pairs: two who raised their young together, and a hive that keeps all its own. */
  kin: { life: 1, harem: 0.8, brood: 1, season: 0.3, none: 0 } as Readonly<Record<Pairing, number>>,
  /** The temple's alms for the old, of a devout people's. */
  temple: 0.35,
  /** What the old put by keeps of them, where money is kept and lent and they lived above their bread with wealth spread. */
  savings: 0.6,
  /** The grown under the frail age that a frail one needs to keep them: their kin's keeping falls as there are fewer. */
  support: 3,
  /** How far towns take the young from their old (the young go where the work is). */
  towns: 0.4,
  /** How much more the frail no one keeps die (est: a third to a half again). */
  neglect: 0.5,
  /** Living children wanted for age where only children keep the old (est: about one more; Nugent, Caldwell). */
  children: 0.8,
  /** A pension pays this share of a living. */
  pension: 0.5,
} as const;

/** The first band of a people's grown whose deaths come CARE_OLD.frail times as often as their fewest (the last band, failing that). */
export function frailBand(life: LifeHistory): number {
  let least = Infinity;
  for (let b = 0; b < life.bands.length; b++)
    if (life.bands[b]! >= life.adulthood) least = Math.min(least, life.mortality[b]!);
  if (!(least > 0)) return life.bands.length - 1;
  for (let b = 0; b < life.bands.length; b++)
    if (life.bands[b]! >= life.adulthood && life.mortality[b]! >= CARE_OLD.frail * least) return b;
  return life.bands.length - 1;
}

/** What a land's old have about them. */
export type OldMeans = {
  /** How a kind pairs; how far its people hold to kin (0 … 1). */
  readonly pairing: Pairing;
  readonly kinship: number;
  /** The share of its people in towns; its grown under the frail age for each frail one. */
  readonly towns: number;
  readonly support: number;
  /** How devout it is; whether money is kept and lent (1), only coined (0.4), or neither; its surplus over its bread; its Gini. */
  readonly piety: number;
  readonly money: number;
  readonly surplus: number;
  readonly gini: number;
  /** Its realm's pension (0 … 1 of its old paid one). */
  readonly pension: number;
};

/** Who keeps a land's old, the share no one keeps, and what follows of it. */
export type OldKept = {
  readonly kin: number;
  readonly temple: number;
  readonly savings: number;
  readonly pension: number;
  /** The share no one keeps. */
  readonly neglected: number;
  /** The share kept by other than their children (their own savings, the temple, the realm). */
  readonly security: number;
  /** Living children more a mother wants, to be kept in her age. */
  readonly want: number;
  /** How much more often the frail die than the life table has it. */
  readonly press: number;
};

export function keptOld(m: OldMeans): OldKept {
  const base = CARE_OLD.kin[m.pairing] ?? 0,
    kin =
      base *
      (0.6 + 0.4 * clamp01(m.kinship)) *
      (1 - CARE_OLD.towns * clamp01(m.towns)) *
      clamp01(m.support / CARE_OLD.support),
    temple = CARE_OLD.temple * clamp01(m.piety),
    savings = CARE_OLD.savings * clamp01(m.money) * clamp01(m.surplus) * (1 - clamp01(m.gini)),
    pension = clamp01(m.pension),
    others = (1 - temple) * (1 - savings) * (1 - pension),
    neglected = (1 - kin) * others,
    security = 1 - others;
  return {
    kin,
    temple,
    savings,
    pension,
    neglected,
    security,
    want: CARE_OLD.children * base * (1 - security),
    press: 1 + CARE_OLD.neglect * neglected,
  };
}

// —— A realm's provision ——————————————————————————————————————————————————————————————————————————————————————

/** What a realm weighs in paying its old and its poor's care. */
export type ProvisionSides = {
  /** How far its people are heard (holds' voice); whether it can keep a roll of who is owed (writing and clerks at its seat). */
  readonly voice: number;
  readonly roll: boolean;
  /** Of its people, the share frail; of its old, the share their kin keep; of its people, the share no healer tends. */
  readonly old: number;
  readonly kin: number;
  readonly untended: number;
  /** What its treasury takes of what its people make, beyond the tithe. */
  readonly burden: number;
};

/** How far a realm pays its old a pension (0 … 1 of them), and its parts. */
export function pensionWanted(s: ProvisionSides): { level: number; parts: [string, number][] } {
  if (!s.roll) return { level: 0, parts: [["no roll of who is owed", 0]] };
  const parts: [string, number][] = [
    ["its old, as far as they are heard", 1.2 * clamp01(s.voice) * clamp01(s.old / 0.12)],
    ["their kin keep them the less", 0.4 * (1 - clamp01(s.kin)) * clamp01(s.voice)],
    ["what its treasury already takes", -clamp01(s.burden)],
  ];
  return { level: clamp01(parts.reduce((a, [, v]) => a + v, 0)), parts };
}

/** How far a realm pays the care of those its healers do not reach (0 … 1), and its parts. */
export function publicCareWanted(s: ProvisionSides): { level: number; parts: [string, number][] } {
  if (!s.roll) return { level: 0, parts: [["no roll of who is owed", 0]] };
  const parts: [string, number][] = [
    ["the untended, as far as they are heard", 2 * clamp01(s.voice) * clamp01(s.untended)],
    ["what its treasury already takes", -clamp01(s.burden)],
  ];
  return { level: clamp01(parts.reduce((a, [, v]) => a + v, 0)), parts };
}
