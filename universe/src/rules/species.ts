// Life histories and occupations (docs/architecture §15, §17). The upright apes'
// table is Earth's; any other people's is derived from its body (Phase 4 M37,
// `lifeHistoryOf`). Rates are yearly and pre-modern — a total fertility near five,
// four children in ten dying before fifteen, few living past seventy — with time
// compressed as the chronicle compresses it (bands to iron in centuries, not
// millennia): at plenty a people grows about three-quarters of a hundredth a year.

import { dmath } from "../kernel/index.ts";
import { affordancesOf, type BodyPlan } from "./bodies.ts";

export type LifeHistory = {
  readonly name: string;
  /** Lower edge of each age band, in years; the last band is open-ended. */
  readonly bands: readonly number[];
  /** Births per woman per year in each band, at plenty. */
  readonly fertility: readonly number[];
  /** Chance of dying within a year in each band, at plenty. */
  readonly mortality: readonly number[];
  /** Age at which a child takes up an occupation. */
  readonly adulthood: number;
  /** Food a person eats, against an upright ape (1: a unit a month). */
  readonly appetite: number;
  /** How wide the last, open-ended band is taken to be, in years. */
  readonly oldest: number;
  /** What the young of the first band eat, against the grown (the smaller the more are born). */
  readonly young: number;
  /**
   * Of those born, the share who will bear (Fisher's balance, `girlsAtBirth`): a little under half where the young of those who
   * sire die the more before they are grown. Absent on a table made by hand: 0.488.
   */
  readonly girls?: number;
  /** How much more the young of those who sire die before they are grown than those who will bear (`boyRiskOf`; 1 where absent). */
  readonly boyRisk?: number;
};

export const HUMANLIKE: LifeHistory = {
  name: "humanlike",
  bands: [0, 5, 10, 15, 20, 30, 40, 50, 60, 70],
  fertility: [0, 0, 0, 0.1, 0.22, 0.18, 0.06, 0, 0, 0],
  mortality: [0.085, 0.015, 0.008, 0.01, 0.014, 0.018, 0.024, 0.04, 0.075, 0.16],
  adulthood: 15,
  appetite: 1,
  oldest: 10,
  young: 1,
  // (Fisher's balance on the table itself, the apes pairing for life and their bodies differing a quarter: `girlsAtBirth(HUMANLIKE,
  // boyRiskOf(0.25))`, held by a test.)
  girls: 0.488,
  boyRisk: 1.094,
};

export const BANDS = HUMANLIKE.bands.length;
export const SEXES = 2;
export const FEMALE = 0;
export const MALE = 1;

/** How people live. Children are dependents until adulthood. */
export const OCCUPATIONS = [
  "dependent",
  "forager",
  "farmer",
  "herder",
  "crafter",
  "trader",
  "leader",
] as const;
export type Occupation = (typeof OCCUPATIONS)[number];
export const OCC = {
  dependent: 0,
  forager: 1,
  farmer: 2,
  herder: 3,
  crafter: 4,
  trader: 5,
  leader: 6,
} as const;

/** Food a worker of each occupation brings in a year when land allows (dependents: none). */
// A worker must feed their dependents too: about 1.6 people in a young society.
export const PRODUCTIVITY: readonly number[] = [0, 2.0, 3.2, 2.4, 0, 0, 0];

/** Width in years of each age band (the last as its life history says). */
export function bandWidth(band: number, life: LifeHistory = HUMANLIKE): number {
  const lo = life.bands[band]!,
    hi = life.bands[band + 1];
  return hi === undefined ? life.oldest : hi - lo;
}

/**
 * The chance of dying within `months` for one whose chance within a year is `p` (a
 * yearly chance compounds over the months, not adds: at a chance of four in five a
 * year, a month's is one in eight, not one in fifteen).
 */
export function deathWithin(p: number, months: number): number {
  return 1 - dmath.pow(1 - Math.min(0.999, p), months / 12);
}

/**
 * A yearly chance of death under conditions that make death m times as pressing (hunger,
 * cold, plague; herb-lore and medicine below one): m scales the hazard, so the chance of
 * living the year is raised to the m-th power. For a small chance this is m times it;
 * a chance near certainty — a spawning people's young — is neither pushed past it nor,
 * by a little medicine, turned into near-certain survival.
 */
export function riskUnder(p: number, m: number): number {
  return 1 - dmath.pow(1 - Math.min(0.999, p), m);
}

/** The band an age falls in, by a life history's bands. */
export function bandOf(age: number, life: LifeHistory = HUMANLIKE): number {
  let b = 0;
  while (b + 1 < life.bands.length && life.bands[b + 1]! <= age) b++;
  return b;
}

/**
 * How the grown die, by the body (Gompertz and Makeham): a hazard that takes them at any age alike, and a wearing that doubles
 * every so many years. The hazard a year goes as the body's pace of living, its size to the minus quarter power (Kleiber's law
 * for each kilo: a small body is taken the oftener) and half for cold blood; the wearing's doubling time is a share of its span.
 * The upright apes': some eight in a thousand a year at any age, and a wearing that doubles every nine years.
 */
export const SENESCENCE = {
  /** The apes' hazard a year, at any grown age (their table's fewest deaths, at ten to fifteen). */
  hazard: 0.008,
  /** Their wearing a year at birth, and how fast it grows a year of age (it doubles every nine). */
  wear: 0.00068,
  grows: 0.077,
  /** A cold-blooded body's pace of living against a warm one's of its size. */
  cold: 0.5,
  /** The least of the apes' share of wearing a body's is reckoned at: one all but wholly taken by hazard still wears. */
  least: 0.1,
} as const;

/** A body's pace of living against the upright apes': its size to the minus quarter power, halved for cold blood. */
export function livingPace(size: number, warm: boolean): number {
  return dmath.pow(Math.max(0.01, size) / 60, -0.25) * (warm ? 1 : SENESCENCE.cold);
}

/** The apes' wearing a year at an age (Gompertz), `k`: the body's span against their seventy years. */
const wearAt = (age: number, k: number): number =>
  (SENESCENCE.wear / k) * dmath.exp((SENESCENCE.grows / k) * age);

/** The deaths that bring the apes from grown to their span, summed (their table's own, fifteen to seventy). */
function apesToSpan(): number {
  let sum = 0;
  for (let b = 0; b < HUMANLIKE.bands.length - 1; b++)
    if (HUMANLIKE.bands[b]! >= HUMANLIKE.adulthood)
      sum += HUMANLIKE.mortality[b]! * (HUMANLIKE.bands[b + 1]! - HUMANLIKE.bands[b]!);
  return sum;
}

/**
 * The grown's chance of dying within a year in each band of a body's life (0 for the bands of its young), from its size and its
 * pace of living: its hazard at every age, and its wearing over it, as much of the apes' as brings as many of its kind to its
 * span as of theirs to theirs. So a small warm body dies mostly of hazard, at any age nearly alike; a large or a cold-blooded
 * one mostly of age, late and together.
 */
export function grownMortality(
  body: { readonly size: number; readonly warm: boolean; readonly span: number },
  bands: readonly number[],
  adulthood: number,
): number[] {
  const k = body.span / 70,
    hazard = SENESCENCE.hazard * livingPace(body.size, body.warm),
    mid = (b: number) =>
      b + 1 < bands.length ? (bands[b]! + bands[b + 1]!) / 2 : bands[b]! + 5 * k,
    width = (b: number) => (b + 1 < bands.length ? bands[b + 1]! - bands[b]! : 0);
  let years = 0,
    worn = 0;
  for (let b = 0; b < bands.length; b++)
    if (bands[b]! >= adulthood) {
      years += width(b);
      worn += wearAt(mid(b), k) * width(b);
    }
  // (What its hazard leaves of the deaths that bring it to its span is its wearing's.)
  const share = worn > 0 ? Math.max(SENESCENCE.least, (apesToSpan() - hazard * years) / worn) : 1;
  return bands.map((at, b) =>
    at >= adulthood ? Math.min(0.95, hazard + share * wearAt(mid(b), k)) : 0,
  );
}

/**
 * A people's life table from its body: its bands and its coming of age the upright apes' by its span; its young's deaths
 * theirs by its span, its grown's from its size and its pace of living (`grownMortality`); fertility by its fecundity, with
 * the young's first years the more perilous as more are born, so that a people at
 * plenty grows at its own body's pace (`plentyPace`: the apes' by its size to the minus
 * quarter power, as life's fastest growth scales; a short life bears more and loses more
 * of its young, it does not outbreed its size: a pace doubled for a half-long life
 * compounds over centuries into billions); appetite by its size (three-quarters of a
 * power, as life's metabolism scales) and halved for cold blood; its sexes born as
 * Fisher's balance says (`girlsAtBirth`), the young of those who sire dying the more as
 * the sexes' bodies differ (`boyRisk`: `boyRiskOf` by how the kind pairs, read where the
 * pairing is: sim/population/life.ts peopleLife; `paired`, how far it needs two). The canonical upright
 * ape's is Earth's table itself.
 */
export function lifeHistoryOf(body: BodyPlan, boyRisk = 1, paired = 1): LifeHistory {
  if (body.clade === "ape" && body.span === 70 && body.size === 60 && body.young === 1)
    return HUMANLIKE;
  const k = body.span / 70,
    f = affordancesOf(body).fecundity,
    bands: number[] = [];
  for (const b of HUMANLIKE.bands)
    bands.push(Math.max(bands.length ? bands.at(-1)! + 1 : 0, Math.round(b * k)));
  const adulthood = Math.max(1, Math.round(HUMANLIKE.adulthood * k)),
    grown = grownMortality(body, bands, adulthood);
  // The first years as perilous as they must be for the people to grow at its own pace:
  // solved on the simulation's own reckoning (`growthOf`).
  const shaped = (infant: number): LifeHistory => {
      const life: LifeHistory = {
        name: body.clade,
        bands,
        fertility: HUMANLIKE.fertility.map((x) => (x * f) / k),
        mortality: HUMANLIKE.mortality.map((x, i) =>
          i === 0 ? infant : bands[i]! >= adulthood ? grown[i]! : Math.min(0.95, x / k),
        ),
        adulthood,
        appetite: dmath.pow(body.size / 60, 0.75) * (body.warm ? 1 : 0.5),
        oldest: Math.max(1, Math.round(10 * k)),
        // Born many at a time, the young are born small: they eat the less.
        young: Math.min(1, 1 / Math.max(1, f)),
      };
      return { ...life, girls: girlsAtBirth(life, boyRisk, paired), boyRisk };
    },
    target = apesGrowth() * plentyPace(body.size);
  let lo = Math.min(0.95, HUMANLIKE.mortality[0]! / k),
    // (As many as all but one in two thousand: a cold-blooded spawner whose grown die late loses its young so.)
    hi = 0.9995;
  if (growthOf(shaped(lo)) <= target) return shaped(lo);
  for (let n = 0; n < 40; n++) {
    const mid = (lo + hi) / 2;
    if (growthOf(shaped(mid)) > target) lo = mid;
    else hi = mid;
  }
  return shaped((lo + hi) / 2);
}

/**
 * How fast a body's people can grow at plenty, against the upright apes' (Fenchel 1974: life's fastest growth falls as its
 * size to the minus quarter power, from a mite to a whale). Held within 0.6 … 1.6 of the apes': the chronicle's pace is the
 * apes', and a people far faster or slower would not keep it.
 */
export function plentyPace(size: number): number {
  return dmath.clamp(dmath.pow(Math.max(1, size) / 60, -0.25), 0.6, 1.6);
}

/**
 * How much more the young of those who sire die before they are grown, by how far the sexes' bodies differ (rules/roles.ts
 * DIMORPHISM): the larger sex grows the faster and the riskier, and dies the more (Clutton-Brock, Albon and Guinness 1985), by
 * three-eighths of the difference (the apes, who differ a quarter, lose about a tenth more of their boys: Coale and Demeny's
 * West tables at a life of twenty-five years, boys 0.43 dead before fifteen to girls' 0.40).
 */
export function boyRiskOf(dimorphism: number): number {
  return 1 + 0.375 * dmath.clamp(dimorphism, 0, 1);
}

/** Of those born to a life table, the share who die before they are grown, at plenty, with deaths `m` times as pressing. */
export function youngLost(life: LifeHistory, m = 1): number {
  let live = 1 - diedInBirthYear(riskUnder(life.mortality[0]!, m));
  for (let b = 0; b < life.bands.length && life.bands[b]! < life.adulthood; b++) {
    const w = Math.min(bandWidth(b, life), life.adulthood - life.bands[b]!);
    live *= dmath.pow(
      1 - Math.min(0.999, riskUnder(life.mortality[b]!, m)),
      b === 0 ? Math.max(0, w - 1) : w,
    );
  }
  return dmath.clamp(1 - live, 0, 1);
}

/**
 * Of those born, the share who will bear (Fisher 1930). Where two must raise the young (`paired`, 1 for those who pair for life:
 * rules/self.ts twoNeeded's pairing), a parent who bore the sex that dies the less before it is grown would leave it short of
 * mates: the sexes are born so as to be even when grown, more of the sex that dies the more. Where none pairs, each sex costs its
 * parents alike and the balance is half and half whoever dies after. Between, by how far the young need two.
 */
export function girlsAtBirth(life: LifeHistory, boyRisk: number, paired = 1): number {
  const sf = 1 - youngLost(life),
    sm = 1 - youngLost(life, boyRisk),
    even = sf + sm > 0 ? sm / (sf + sm) : 0.5,
    p = dmath.clamp(paired, 0, 1);
  return p * even + (1 - p) * 0.5;
}

/** The share of a life table's born who will bear (0.488 on a table that does not say). */
export function girlsOf(life: LifeHistory): number {
  return life.girls ?? 0.488;
}

/**
 * How fast a people grows a year at plenty, reckoned as the simulation reckons a land
 * at plenty: once a year, the year's births at once (those of them who die within it
 * as the first years' chance spread over the year says), every band's deaths at its
 * yearly chance, and a width-th of each band growing into the next at the year's end.
 */
export function growthOf(life: LifeHistory, years = 300): number {
  const bands = life.bands.length,
    newborn = 1 - diedInBirthYear(life.mortality[0]!);
  let n = new Array<number>(bands).fill(0),
    at = 1;
  n[3] = 1000;
  for (let y = 0; y < years; y++) {
    let births = 0;
    for (let b = 0; b < bands; b++) births += n[b]! * life.fertility[b]!;
    n = n.map((x, b) => x * (1 - Math.min(1, life.mortality[b]!)));
    n[0] = n[0]! + births * girlsOf(life) * newborn;
    const moved = n.map((x, b) => (b < bands - 1 ? x / bandWidth(b, life) : 0));
    for (let b = 0; b < bands; b++) {
      n[b] = n[b]! - moved[b]!;
      if (b + 1 < bands) n[b + 1] = n[b + 1]! + moved[b]!;
    }
    // Keep the numbers in range (only the growth matters).
    const total = n.reduce((a, x) => a + x, 0);
    if (y >= years - 100) at *= total / 1000;
    n = n.map((x) => (x * 1000) / total);
  }
  return dmath.log(at) / 100;
}

let APES = NaN;
/** The upright apes' growth at plenty, reckoned once. */
function apesGrowth(): number {
  if (APES !== APES) APES = growthOf(HUMANLIKE);
  return APES;
}

/** Of the young born through a year reckoned at once, the share who die within it (births spread over the year). */
export function diedInBirthYear(p: number): number {
  const q = Math.min(0.999, p);
  return q > 0 ? 1 - q / -dmath.log(1 - q) : 0;
}
