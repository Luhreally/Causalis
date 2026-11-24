// A people's numbers from its body and its land (the breadth round, 2026-11-23: "derive sexes, birth ratio, life history and
// household size from the people's body and ecology facts"). Before it every people was born 0.488 girls, lived four and a
// half to a home, wed as freely after a war that killed its young men as before, and lived as long whatever it knew. Now:
//   How two raise the young (rules/self.ts pairingOf) says how far a people's births wait on a mate (PAIRED): wholly where they
//     pair for life, a third where for a season, little where the strongest hold several, not at all where none pairs or a
//     hive's one bears for all. The sexes are born so as to be even when grown as far as that holds (rules/species.ts
//     girlsAtBirth), and the bodies' difference (rules/roles.ts DIMORPHISM) says how many more of the sires' young die.
//   A hearth (`hearthOf`) is a bearer from her first young until her last is grown, and those she keeps: her young, her mate as
//     her kind pairs, the old. Read off the people's own life table at plenty, so a short-lived, many-young people lives many
//     to a hearth and a pairless one alone; first light's apes come out near four and a half, as the homes of before.
//   The marriage market (`matedShare`): a land short of grown sires, after a war or a going-out of young men, bears the less
//     as far as its births wait on a mate, against the balance its table bears at (its fertility is already that balance's).
//   A body takes to its land (`adaptedOf`): newcomers to the thin air of the heights and to the cold die the more until their
//     lines have lived there some generations (the high Andes' and Tibet's peoples; the Spanish of Potosí lost their young).
//   Living long (`longerLived`): what a people knows of the body past what its care already spares the sick (the health its
//     lore gives over the three-tenths care can use) slows the wearing of its old, up to half their deaths.
//   A dynastic match (`matchChanceOf`): as often as a house has children grown to give (its own heirs a generation), by what
//     an alliance is worth to it now (regard, a sworn pact, a foe in common), as far as its people's ways bind by kin; shared
//     among all it might give them to. The two must be of the two sexes (`sexesMustDiffer`) only where the tie's claim passes
//     by their children.
// Pure functions.
import { dmath } from "../kernel/index.ts";
import { bandWidth, girlsOf, riskUnder, youngLost, type LifeHistory } from "./species.ts";
import { householdOf, type Pairing } from "./self.ts";

const clamp01 = (x: number): number => dmath.clamp(x, 0, 1);

/** How far a people's births wait on a mate, by how it pairs (0: not at all; 1: every one). */
export const PAIRED: Readonly<Record<Pairing, number>> = {
  life: 1,
  // (About a third of the grown are paired at any time: rules/self.ts partnersOf.)
  season: 0.33,
  // (The strongest few hold several: a sire short is a bearer held by another.)
  harem: 0.1,
  brood: 0,
  none: 0,
};

export const DEMOGRAPHY = {
  /** Thin air: deaths x (1 + this x the air lost) on a body not taken to it (at 4,000 m, about half as many again). */
  heights: 1.5,
  /** The height over which the air thins by e (m). */
  airScale: 8400,
  /** How much of the cold's toll on the ill-clothed a body taken to its land is spared. */
  cold: 0.5,
  /** Generations for a body to take to its land by e (lines selected, young grown up in it). */
  generations: 10,
  /** The health a people's lore gives that its care can use (sim/population/systems.ts healedIn's 0.3); past it, the old's. */
  careUses: 0.3,
  /** The most of the old's deaths that knowing the body spares. */
  longest: 0.5,
  /** How much of what it knows past what care uses spares the old, a unit of it. */
  longBy: 2,
} as const;

/** The grown sires to a grown bearer that a life table bears at (its fertility is that balance's), at plenty. */
export function evenOf(life: LifeHistory): number {
  const g = girlsOf(life),
    sf = 1 - youngLost(life),
    sm = 1 - youngLost(life, life.boyRisk ?? 1);
  return g > 0 && sf > 0 ? ((1 - g) * sm) / (g * sf) : 1;
}

/**
 * Of a land's births, the share born as its sexes now stand (0 … 1): where it has fewer grown sires to a bearer than its table
 * bears at, as many fewer as its births wait on a mate. More sires bear no more.
 */
export function matedShare(pairing: Pairing, sires: number, bearers: number, even: number): number {
  if (bearers <= 0 || even <= 0) return 1;
  const short = Math.max(0, 1 - sires / bearers / even);
  return 1 - PAIRED[pairing] * clamp01(short);
}

/**
 * The mouths of a hearth, of a people at plenty: its people over its hearths. A hearth is a bearer from her first young (the
 * age at which half of her people's first bearing is done) until her last young is grown, with her mate as her kind keeps one;
 * a hive's cell and a pairless one's are as rules/self.ts householdOf says.
 */
export function hearthOf(life: LifeHistory, pairing: Pairing): number {
  if (pairing === "brood" || pairing === "none") return householdOf(pairing, 0, 0);
  const bands = life.bands.length,
    g = girlsOf(life),
    boy = life.boyRisk ?? 1;
  // The stable ages at plenty: each band's share of a cohort, by how many live to it and how long it is.
  let peak = 0,
    first = -1,
    last = -1;
  for (let b = 0; b < bands; b++) peak = Math.max(peak, life.fertility[b]!);
  for (let b = 0; b < bands; b++)
    if (life.fertility[b]! >= peak / 2) {
      if (first < 0) first = b;
      last = b;
    }
  if (first < 0) return householdOf(pairing, 0, 0);
  const lastGrown = life.bands[last]! + bandWidth(last, life) + life.adulthood,
    live = [1, 1];
  let people = 0,
    hearths = 0,
    sires = 0;
  for (let b = 0; b < bands; b++) {
    const w = bandWidth(b, life),
      lo = life.bands[b]!;
    for (let s = 0; s < 2; s++) {
      const m = s === 1 && lo < life.adulthood ? boy : 1,
        d = Math.min(0.999, riskUnder(life.mortality[b]!, m)),
        // (The band's people: those come into it, living on through its years.)
        stay = d > 0 ? (1 - dmath.pow(1 - d, w)) / d : w,
        n = (s === 0 ? g : 1 - g) * live[s]! * stay;
      people += n;
      if (s === 0 && b >= first && lo < lastGrown) hearths += n;
      if (s === 1 && lo >= life.adulthood) sires += n;
      live[s] = live[s]! * dmath.pow(1 - d, w);
    }
  }
  // (Where they pair for a season, a sire not in a hearth keeps one of his own.)
  const alone = pairing === "season" ? (1 - PAIRED.season) * sires : 0;
  return hearths + alone > 0 ? people / (hearths + alone) : 1;
}

/** How far a land's people have taken to it (0 … 1), by the generations their lines have lived there. */
export function adaptedOf(years: number, generation: number): number {
  const gens = Math.max(0, years) / Math.max(1, generation);
  return clamp01(1 - dmath.exp(-gens / DEMOGRAPHY.generations));
}

/** What the thin air of a height does to the deaths of a people of the air not taken to it (1 at the sea's height). */
export function heightsToll(elevation: number, adapted: number): number {
  if (!(elevation > 0)) return 1;
  return heightsTollOf(heightsLost(elevation), adapted);
}
/** Of a height's air, the share lost against the sea's (0 at the sea's height and below): heightsToll's own reading of it. */
export function heightsLost(elevation: number): number {
  return elevation > 0 ? 1 - dmath.exp(-elevation / DEMOGRAPHY.airScale) : 0;
}
/** heightsToll of a land above the sea, from the share of its air lost (heightsLost). */
export function heightsTollOf(lost: number, adapted: number): number {
  return 1 + DEMOGRAPHY.heights * lost * (1 - clamp01(adapted));
}

/** The share of the cold's toll on the ill-clothed that a land's people still feel, as far as they have taken to it. */
export function coldFelt(adapted: number): number {
  return 1 - DEMOGRAPHY.cold * clamp01(adapted);
}

/** What knowing the body does to the old's deaths (x; 1 where a people knows no more of it than its care uses). */
export function longerLived(health: number): number {
  const past = Math.max(0, health - DEMOGRAPHY.careUses);
  return 1 - Math.min(DEMOGRAPHY.longest, DEMOGRAPHY.longBy * past);
}

/** The first band of a life table's old: where its deaths are past twice the least of its grown. */
export function oldBandOf(life: LifeHistory): number {
  let least = Infinity;
  for (let b = 0; b < life.bands.length; b++)
    if (life.bands[b]! >= life.adulthood) least = Math.min(least, life.mortality[b]!);
  for (let b = 0; b < life.bands.length; b++)
    if (life.bands[b]! >= life.adulthood && life.mortality[b]! > 2 * least) return b;
  return life.bands.length;
}

/** What two realms' alliance is worth to a house now (0 … 1): their regard, a pact sworn, a foe they fight in common. */
export function allianceWorth(regard: number, sworn: boolean, foeShared: boolean): number {
  return clamp01(0.5 * clamp01(regard) + (sworn ? 0.3 : 0) + (foeShared ? 0.4 : 0));
}

/**
 * The yearly chance a house gives one of its own to a match with another: its children grown to give a year (its heirs a
 * generation), the share of them its people's ways give to bind by kin, by what this alliance is worth over all it might give
 * them to (`among`: those it thinks well enough of).
 */
export function matchChanceOf(
  heirs: number,
  generation: number,
  kin: number,
  worth: number,
  among: number,
): number {
  const given = Math.max(0, heirs) / Math.max(1, generation);
  return clamp01((given * clamp01(kin) * clamp01(worth)) / Math.max(1, among));
}

/**
 * Whether the two of a match must be of the two sexes: where the tie's claim passes by the children of the two (a wedding's, as
 * rules/kinforms.ts says), and the people's bodies need two to bear. A tie whose claim passes otherwise (a fostering, a graft, a
 * brood given) may be of any two.
 */
export function sexesMustDiffer(byChildren: boolean, twoToBear: boolean): boolean {
  return byChildren && twoToBear;
}
