// Houses: the families, cronies and grifters who keep power for themselves (round H, asked 2026-11-16: "is it only optimizing for
// what produces a lot? what about selfish grifters and families that wanna keep the power to themselves"). A ruler does not rule
// for the realm's output; a ruler rules to keep the seat, and keeps it by paying those whose backing it cannot do without. Each rule
// here says what that incentive does; a realm's own numbers (who holds its sway, how widely its choices are carried, whether it
// chooses at all, how its people count kin, what its land holds, what its treasury takes) say how it plays out:
//   - the selectorate and the winning coalition: those with a say in who rules, and the fewest of them whose backing is enough. A
//     ruler buys that backing the cheapest way: the groups whose sway comes with the fewest heads first (Bueno de Mesquita's W and S,
//     read off the sway sim/polity/interests.ts already gives, not off a named kind of rule);
//   - private goods against public: a grain given to a member of a small coalition is worth a whole grain to one whose backing
//     counts; a grain spent on what all share reaches the coalition only in their share of all. The fewer the coalition, the more of
//     what the seat hands out goes as favours, offices, grants and the skim;
//   - the loyalty norm: one of the coalition left out by a challenger's own is left with nothing, so the smaller the coalition out
//     of the selectorate, the less a ruler need pay to hold it, and the more of the favours the ruler's own house keeps;
//   - offices as favours: kin put in office where favours are how the seat pays, unless a written test chooses them, word carries
//     what is done, or the people keep no houses at all;
//   - grants: the crown's licences and the customs it farms out go to the houses that court it hardest, as far as its favours are
//     private and its reach can make a licence hold; a lone licensee asks what a lone seller asks;
//   - inheritance: an estate is kept whole where rank must be kept and the land is full (every son a farm of his own is no longer to
//     be had), and parted among heirs where land is open; the heirs a line has are what its people's life table gives;
//   - caste is standing held by birth: the share of offices held by houses whose titles pass with their blood;
//   - those who rise from outside: a demagogue on grievance, as far as word carries it; a grifter on the skim, where offices are for
//     sale and coin makes buying them easy;
//   - how a hold ends: purged by a crown that holds the arms and fears it, overthrown by the people, wed into a greater house as its
//     line fails, or dead out of heirs. Its estate goes to the crown, or to the house that took it in.
// Pure tables and functions: no draws, nothing kept (sim/order/houses.ts keeps a realm's houses).
import { dmath } from "../kernel/index.ts";
import type { LifeHistory } from "./species.ts";

const clamp01 = (x: number): number => dmath.clamp(x, 0, 1);

/** The machinery's constants. */
export const HOUSES = {
  /** The great houses a realm keeps account of (the rest are the many), and the ended ones it remembers. */
  most: 6,
  gone: 3,
  /** A realm is reckoned once in this many years, in its turn, stepped as many years at once. */
  every: 5,
  /** A group with less of a realm's sway than this has no say in who rules: it is outside the selectorate. */
  heard: 0.02,
  /** The share of sway a coalition must hold where no choice is put to the people: more than half. */
  needs: 0.5,
  /**
   * How much more a grain spent on what all share (roads, order, relief) is worth to a realm's people, all told, than one handed to
   * a single member of its coalition (est., from public works' returns against their cost): what tips a large coalition's favours
   * toward the public.
   */
  publicWorth: 8,
  /** The most of the favours a ruler's own house keeps, where its coalition is wholly loyal (the loyalty norm at one). */
  crownKeeps: 0.5,
  /** What a house spends a year of what it holds: its keep, its show, its clients (est., a great household's outgoings). */
  spends: 0.12,
  /** A group holding this share of a coalition's sway or more has a great house of its own. */
  riseLeast: 0.08,
  /** What a house rising holds at first: so many years of what it would take in. */
  stakeYears: 5,
  /** The most of a realm's trade the crown can put under licence, and of its customs it can farm out. */
  grantMost: 0.4,
  farmMost: 0.6,
  /** What a customs farmer takes above what it hands the crown, a share of what passes (est., the tax farms' margins). */
  farmMargin: 0.25,
  /** How far the rents of licences and farms, a share of what a realm's people earn, breed grievance a year in its lands. */
  rentGrieves: 0.6,
  /** Where a written test chooses who holds office, how much less often kin hold it; how much less where word carries freely. */
  examined: 0.6,
  seen: 0.4,
  /** At this caste or more a house rising is titled: its standing passes with its blood. */
  titled: 0.45,
  /** A house with less than this share of the greatest's power, its line failing, is taken into another by marriage. */
  wedBelow: 0.35,
  /** A cadet line is founded at an estate's parting only with this share of the main line's wealth or more. */
  cadetLeast: 0.25,
  /** A crown that holds the arms purges a house whose power reaches this share of its own; how fast a year at most. */
  purgeAt: 0.8,
  purgeRate: 0.25,
  /** What of a purged house's wealth the crown seizes (the rest is spent, hidden or burned). */
  seized: 0.6,
  /** A demagogue's following moves this share of the way to what grievance would give it, a year. */
  following: 0.2,
  /** A demagogue rises at this following, and is gone below the second. */
  riseFollowing: 0.15,
  endFollowing: 0.05,
  /** A grifter rises where its take reaches this, and is exposed below the second. */
  riseGrift: 0.1,
  endGrift: 0.04,
} as const;

/** Where a house's power came from: one of the realm's groups, the seat itself, or from outside them. */
export const HOUSE_ORIGINS = [
  "crown",
  "the court",
  "the army",
  "the temple",
  "traders",
  "crafters",
  "farmers",
  "herders",
  "demagogue",
  "grifter",
  "cadet",
] as const;
export type HouseOrigin = (typeof HOUSE_ORIGINS)[number];

/** How a house's hold ended. */
export const HOUSE_ENDS = ["purged", "overthrown", "wed", "died out", "faded", "exposed"] as const;
export type HouseEnd = (typeof HOUSE_ENDS)[number];

/** Origins whose wealth is in land: they take its rent. */
export const LANDED_HOUSES: ReadonlySet<HouseOrigin> = new Set([
  "crown",
  "the court",
  "farmers",
  "herders",
  "cadet",
]);

// —— Who a ruler must pay ——————————————————————————————————————————————————————————————————————————————————

/** One of a realm's groups as the coalition weighs it: its share of sway and its heads. */
export type SwayGroup = { readonly group: string; readonly sway: number; readonly heads: number };

/** Who a ruler must pay: its selectorate and winning coalition (heads), each group's part of the coalition, the loyalty norm. */
export type Coalition = {
  /** Those with a say in who rules (heads). */
  readonly selectorate: number;
  /** The fewest of them whose backing is enough (heads). */
  readonly winning: number;
  /** All the groups' heads: the realm's working people. */
  readonly all: number;
  /** Each group in the coalition, and the share of its heads in it (0 … 1). */
  readonly members: readonly (readonly [string, number])[];
  /** 1 − W/S: how little a member left out by a challenger can hope for (0 … 1). */
  readonly loyalty: number;
};

/**
 * Who a ruler must pay. The selectorate is every head of a group heard at all, or, where a choice is put to its people
 * (`franchise`), every one of them; where rule passes by acclaim, those who acclaim at the seat as well (`crowd`). The winning
 * coalition is bought cheapest first: the groups whose sway comes with the fewest heads, until it holds `need` of the sway (more
 * than half, or the winner's share where the people chose), the last group only in part.
 */
export function coalitionOf(
  groups: readonly SwayGroup[],
  need: number,
  franchise: boolean,
  crowd = 0,
): Coalition {
  const heard = groups.filter((g) => g.sway >= HOUSES.heard && g.heads > 0),
    all = groups.reduce((s, g) => s + Math.max(0, g.heads), 0),
    selectorate = franchise
      ? all
      : Math.min(all, heard.reduce((s, g) => s + g.heads, 0) + Math.max(0, crowd));
  const cheapest = [...heard].sort(
      (a, b) => a.heads / a.sway - b.heads / b.sway || (a.group < b.group ? -1 : 1),
    ),
    members: [string, number][] = [];
  let held = 0,
    winning = 0;
  for (const g of cheapest) {
    if (held >= need) break;
    const part = Math.min(1, (need - held) / g.sway);
    members.push([g.group, part]);
    winning += part * g.heads;
    held += part * g.sway;
  }
  const s = Math.max(1, selectorate);
  return {
    selectorate,
    winning,
    all,
    members,
    loyalty: clamp01(1 - winning / s),
  };
}

/**
 * The share of what the seat hands out that goes as favours to its coalition, not to what all share: a grain to one of the
 * coalition is worth a grain to them, a grain on what all share is worth `publicWorth` grains among all, of which the coalition
 * has its share. 1 / (1 + publicWorth × W / N).
 */
export function privateShare(winning: number, all: number): number {
  return 1 / (1 + (HOUSES.publicWorth * Math.max(0, winning)) / Math.max(1, all));
}

/** What of the favours the ruler's own house keeps: as much as its coalition is loyal. */
export const crownKeep = (loyalty: number): number => HOUSES.crownKeeps * clamp01(loyalty);

// —— Offices, grants and rents ——————————————————————————————————————————————————————————————————————————————

/** What decides who holds office. */
export type OfficeFacts = {
  /** How far favours are how the seat pays (privateShare). */
  readonly favours: number;
  /** Whether a written test chooses its clerks (writing and clerks at its seat). */
  readonly examined: boolean;
  /** How freely word moves (rules/holds.ts word). */
  readonly word: number;
  /** How hard rank has set (sim/order caste). */
  readonly caste: number;
  /** Whether its people keep houses at all (they count kin past the line: rules/reign.ts noHouses). */
  readonly houses: boolean;
};

/** The share of a realm's offices held by the great houses' kin (0 … 1): nepotism, as an office is a favour. */
export function kinInOffice(f: OfficeFacts): number {
  if (!f.houses) return 0;
  return clamp01(
    clamp01(f.favours) *
      (1 - (f.examined ? HOUSES.examined : 0)) *
      (1 - HOUSES.seen * clamp01(f.word)) *
      (0.6 + 0.4 * clamp01(f.caste)),
  );
}

/** The share of a realm's trade the crown puts under licence: as its favours are private, as far as its reach makes one hold. */
export function licensed(favours: number, capacity: number): number {
  return HOUSES.grantMost * clamp01(favours) * clamp01(capacity);
}

/** The share of its customs a crown farms out: as its favours are private, and as little as it can measure what crosses. */
export function farmedOut(favours: number, measured: number): number {
  return HOUSES.farmMost * clamp01(favours) * (1 - clamp01(measured));
}

/**
 * What a licence yields its holder, a share of the trade it covers: what a lone seller asks of buyers who can go without as much
 * as they can do with (an elasticity of one: 1 / 2), held down by what comes from abroad (rules/labour.ts lerner, alone).
 */
export function licenceRent(imported: number): number {
  return 0.5 * (1 - 0.8 * clamp01(imported));
}

/**
 * How houses share what they court for (offices, licences, a farm): each by what it can bring to bear (its wealth), the more as it
 * is of the coalition, the more again as its title gives it a claim (a contest of favour, Tullock's: shares by outlay).
 */
export function courtedShares(
  houses: readonly {
    readonly wealth: number;
    readonly inside: boolean;
    readonly titled: boolean;
  }[],
  caste: number,
): number[] {
  const weight = houses.map(
      (h) => Math.max(0, h.wealth) * (h.inside ? 1 : 0.3) * (h.titled ? 1 + clamp01(caste) : 1),
    ),
    sum = weight.reduce((s, w) => s + w, 0);
  return weight.map((w) => (sum > 0 ? w / sum : 0));
}

// —— Inheritance ————————————————————————————————————————————————————————————————————————————————————————

/**
 * The share of an estate parted among a house's heirs at its head's death (0: kept whole for one; 1: shared out alike): kept whole
 * where rank must be kept and the land is full, shared out where land is open (`open`: room a head, rules/labour.ts Binding) and
 * kin are counted widely.
 */
export function parted(caste: number, open: number, kinship: number): number {
  const full = 1 / (1 + Math.max(0, open));
  return clamp01(0.9 - 0.6 * clamp01(caste) - 0.5 * full + 0.3 * (clamp01(kinship) - 0.5));
}

/** The width of a life table's band (its last is `oldest` wide). */
const bandWidth = (life: LifeHistory, b: number): number =>
  b + 1 < life.bands.length ? life.bands[b + 1]! - life.bands[b]! : life.oldest;

/** The band a life table puts an age in. */
function bandAt(life: LifeHistory, age: number): number {
  let b = 0;
  while (b + 1 < life.bands.length && life.bands[b + 1]! <= age) b++;
  return b;
}

/** The heirs a line can look for at its head's death: children born over a life who live to be grown, at plenty. */
export function heirsExpected(life: LifeHistory): number {
  let born = 0,
    grown = 1;
  for (let b = 0; b < life.bands.length; b++) {
    born += (life.fertility[b] ?? 0) * bandWidth(life, b);
    if (life.bands[b]! < life.adulthood)
      grown *= dmath.pow(
        1 - (life.mortality[b] ?? 0),
        Math.min(bandWidth(life, b), life.adulthood - life.bands[b]!),
      );
  }
  return born * grown;
}

/** The age at which a people bear on the mean: one generation. */
export function generationOf(life: LifeHistory): number {
  let n = 0,
    at = 0;
  for (let b = 0; b < life.bands.length; b++) {
    const f = (life.fertility[b] ?? 0) * bandWidth(life, b);
    n += f;
    at += f * (life.bands[b]! + bandWidth(life, b) / 2);
  }
  return n > 0 ? at / n : life.adulthood * 2;
}

/** The chance one of age `age` dies within `span` years, by the life table. */
export function diesWithin(life: LifeHistory, age: number, span: number): number {
  let live = 1;
  for (let k = 0; k < span; k++) live *= 1 - (life.mortality[bandAt(life, age + k)] ?? 0);
  return clamp01(1 - live);
}

/** The chance a line of `expected` heirs on the mean has exactly `n` (Poisson). */
export function heirsChance(expected: number, n: number): number {
  let p = dmath.exp(-Math.max(0, expected));
  for (let k = 1; k <= n; k++) p *= expected / k;
  return p;
}

/** How many heirs a line has, for a draw `u` (0 … 1) against the Poisson of its expected (at most nine). */
export function heirsFor(expected: number, u: number): number {
  let n = 0,
    sum = heirsChance(expected, 0);
  while (u > sum && n < 9) {
    n++;
    sum += heirsChance(expected, n);
  }
  return n;
}

// —— Those who rise from outside ———————————————————————————————————————————————————————————————————————————

/** What a demagogue's following would come to: the realm's grievance, carried as far as its word carries and its rule is doubted. */
export type GrievanceFacts = {
  /** Its lands' grievance, by their people (0 … 1). */
  readonly grievance: number;
  /** What its taxes beyond what is borne breed (money's taxGrievance). */
  readonly taxed: number;
  /** Its seat's Gini, above a people of farmers alike (0.35). */
  readonly unequal: number;
  /** How freely word moves (0 … 1); how far its rule is held rightful (0 … 1). */
  readonly word: number;
  readonly legitimacy: number;
};

/** The share of a realm's people a demagogue would carry (0 … 1). */
export function followingWanted(f: GrievanceFacts): number {
  const sore = clamp01(f.grievance + 2 * f.taxed + Math.max(0, f.unequal - 0.35));
  return clamp01(sore * (0.3 + 0.7 * clamp01(f.word)) * (1.3 - clamp01(f.legitimacy)));
}

/** What a grifter takes: of what is skimmed, where offices are for sale (a reach too thin to watch them) and coin buys them. */
export function griftWanted(
  corruption: number,
  capacity: number,
  coin: boolean,
  justice: number,
): number {
  return clamp01(
    1.5 * clamp01(corruption) * (1 - clamp01(capacity)) * (coin ? 1 : 0.4) * (1 - 0.2 * justice),
  );
}

// —— How a hold ends ——————————————————————————————————————————————————————————————————————————————————————

/**
 * The chance a crown purges a house in a year: as its power nears the crown's own past `purgeAt`, as far as the crown keeps the
 * arms (force) and its choices are carried by few (a voice that must be carried widely stays its hand).
 */
export function purgeChance(power: number, crown: number, force: number, voice: number): number {
  const threat = power / Math.max(1e-6, crown);
  return clamp01(
    HOUSES.purgeRate * Math.max(0, threat - HOUSES.purgeAt) * clamp01(force) * (1 - clamp01(voice)),
  );
}

/** How far the greatest of the other houses outweighs the crown's own (0: not at all … 1: wholly): what a coup could ride. */
export function rivalWeight(greatest: number, crown: number): number {
  const sum = greatest + crown;
  return sum > 0 ? clamp01((greatest - crown) / sum) : 0;
}
