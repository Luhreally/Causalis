// Who does what, by the body that bears and the work a land asks (the society sweep, asked 2026-11-16: "gender roles and kin roles
// from a species' body and its labour"). Before it, every grown one of a people worked the same work, bearer or not, and what a child
// cost its mother's work was nothing. Now:
//   How different the sexes' bodies are (dimorphismOf) comes of the contest its pairing sets: what a bearer puts into each young, how
//     free the sires are of raising them, and how far one strong body can hold several bearers to itself (sexual selection: est, apes
//     that keep harems are half again as heavy in the male); where two raise their young together, a little; where a hive's one bears
//     for all, its workers are one body. Reckoned against the upright apes' quarter, which is Earth's.
//   What the fields ask of strength (fieldStrength): the plough, drawn and held, asks for the upper body's (Boserup: hoe fields were
//     worked by all, ploughed fields by the stronger); the hunt asks some; machines ask none.
//   How much of a bearer's work goes beyond the home (rolesTarget): the years her young do not hold her (round C's bearingHeld, as many
//     young as her people now bear); of those, the work she can do as well as any (less as fields ask a strength her body lacks);
//     less again where work moves off the family's own fields into shops and works where she cannot keep her young by her, and back
//     as schooling opens the work of the head and machines do the heavy.
//   A people's way holds what its work once asked long after (est: the plough's ways show in its daughters' work a millennium on): the
//     norm moves toward the work's target a fiftieth a year (ROLES.pace).
//   What it costs (forgone): a mother whose work is away from home gives it up for each child; that is a child's cost (Becker), the
//     more as work lies in towns and works.
// Pure functions.
import { dmath } from "../kernel/index.ts";
import { CARE_YEARS, pairingOf, twoNeeded } from "./self.ts";
import { OCC } from "./species.ts";

const clamp01 = (x: number): number => dmath.clamp(x, 0, 1);

/**
 * What the contest among those who sire turns on (est; fitted so that an ape of a hundred and sixty kilos that keeps a harem, its
 * young needing two by three tenths, differs 0.8, where an upright ape differs a quarter).
 */
export const CONTEST = {
  /** How far the upright apes' sexes differ (Earth's measure: the rest are reckoned against it). */
  ape: 0.25,
  /** How much the contest grows as sires are free of the young (their whole effort free: once again). */
  free: 1,
  /** And as one strong body can hold several bearers for itself. */
  hold: 7.4,
  /** The weight (kg) at which a body is half as able to hold others off as the heaviest. */
  heavy: 100,
} as const;

/** The body's facts the contest reads. */
type ContestBody = {
  readonly bearing: string;
  readonly young: number;
  readonly span: number;
  readonly social: number;
  readonly size: number;
  readonly medium: string;
};

/** The upright ape's, the measure. */
const APE: ContestBody = {
  bearing: "live",
  young: 1,
  span: 70,
  social: 0.8,
  size: 60,
  medium: "land",
};

/**
 * How hard those who sire contest for those who bear, before it is set against the apes': what a bearer puts into each young (the
 * years it holds her, against a live-bearer's: where she puts in nothing, as those that spawn, there is no one worth the contest),
 * by how free the sires are of raising them (rules/self.ts twoNeeded) and how far one strong body can hold several bearers to
 * itself (the heavier, and the less its kind lives in a crowd).
 */
function contestOf(b: ContestBody, adulthood: number): number {
  const invest = (CARE_YEARS[b.bearing] ?? 0) / (CARE_YEARS.live ?? 1),
    free = 1 - twoNeeded(b, adulthood),
    hold = (b.size / (b.size + CONTEST.heavy)) * (1 - clamp01(b.social));
  return invest * (1 + CONTEST.free * free + CONTEST.hold * free * hold);
}

/**
 * How far the sexes' bodies differ (0: one body; 1: as far as any kind's), from the contest of its pairing: sexual selection
 * makes the sex that contests for partners the larger, by how hard the contest is. A hive's workers, who do not breed, are one
 * body. The upright apes' is Earth's quarter exactly (null: theirs).
 */
export function dimorphismOf(b: ContestBody | null | undefined, adulthood: number): number {
  if (!b) return CONTEST.ape;
  if (pairingOf(b, adulthood) === "brood") return 0;
  return clamp01((CONTEST.ape * contestOf(b, adulthood)) / contestOf(APE, 15));
}

export const ROLES = {
  /** A mother's work given up as her young hold her: the share of her bearing years they hold, by this. */
  held: 1.2,
  /** How far a strength-asking field shuts out the weaker body, at the most different bodies. */
  strength: 0.9,
  /** How far work moved into towns and works, away from the home, shuts out those who keep young. */
  towns: 0.5,
  /** How far schooling and machines open work again, of the years free of young. */
  schooled: 0.45,
  /** The share of the way a people's norm goes toward what its work asks in a year (a fiftieth: some centuries to come round). */
  pace: 0.02,
  /** What a child costs (rules/children.ts childCost) where all its mother's work is away from home and given up for it. */
  cost: 0.6,
} as const;

/** What a land's fields and hunt ask of strength (0 … 1): the plough the most, the hoe little, machines none. */
export function fieldStrength(cultivating: boolean, plough: boolean, machines: number): number {
  const asks = !cultivating ? 0.3 : plough ? 0.7 : 0.25;
  return asks * (1 - clamp01(machines));
}

/** What sets how much of a bearer's work goes beyond the home. */
export type RoleMeans = {
  /** The share of her bearing years her young hold her, as many as her people bear now. */
  readonly held: number;
  readonly dimorphism: number;
  readonly strength: number;
  /** The share of its people in towns, of them who read, of its work engines do. */
  readonly towns: number;
  readonly readers: number;
  readonly machines: number;
};

/** The share of a bearer's work, of one who does not bear, that her land's work would have of her now (0.05 … 0.95). */
export function rolesTarget(m: RoleMeans): number {
  const free = dmath.clamp(1 - ROLES.held * clamp01(m.held), 0.1, 1),
    fields = free * (1 - ROLES.strength * clamp01(m.dimorphism) * clamp01(m.strength)),
    away =
      fields * (1 - ROLES.towns * clamp01(m.towns) * (1 - clamp01(m.readers))) +
      ROLES.schooled * clamp01(m.readers) * clamp01(m.machines) * free;
  return dmath.clamp(away, 0.05, 0.95);
}

/** A people's norm, `years` on toward what its work asks. */
export function normStep(norm: number, target: number, years: number): number {
  return norm + (1 - dmath.pow(1 - ROLES.pace, Math.max(0, years))) * (target - norm);
}

/** What a child costs its mother's work (rules/children.ts childCost's third part): as far as her work is away from home. */
export function forgone(norm: number, towns: number, machines: number): number {
  return ROLES.cost * clamp01(norm) * clamp01(clamp01(towns) + clamp01(machines));
}

/** The share of a realm's seats a people's bearers hold, by their norm and how different their bodies are: the odds a ruler or one of a court is a bearer. */
export function bearersRule(norm: number, dimorphism: number): number {
  return clamp01(0.5 * clamp01(norm) * (1 - 0.5 * clamp01(dimorphism)) + 0.02);
}

// —— Who of a land's grown does which work, by sex (asked of the sweep: "occupations split by sex") ————————————————————————

/**
 * How readily one who bears takes up each work against one who does not (by OCC; 1: as readily): the fields, flocks and hunt as far
 * as they ask a strength her body lacks (rolesTarget's own term); crafts done at home in the villages as readily as any, and in the
 * towns' shops and works as far as her people's norm takes her beyond the home; trade and rule, which are beyond the home, by the norm.
 */
export function bearerWork(
  norm: number,
  dimorphism: number,
  strength: number,
  towns: number,
): number[] {
  const fields = dmath.clamp(1 - ROLES.strength * clamp01(dimorphism) * clamp01(strength), 0.05, 1),
    beyond = dmath.clamp(norm, 0.05, 1),
    crafts = 1 - clamp01(towns) + clamp01(towns) * beyond,
    w = [1, fields, fields, fields, crafts, beyond, beyond];
  return w.slice(0, Object.keys(OCC).length);
}

/**
 * A land's work shares split between those who bear and those who do not (each row summing to 1), so that together they do the
 * land's work in its shares and each takes up its works as readily as `w` says: fitted to both, row and column, in turn (iterative
 * proportional fitting, twelve rounds).
 */
export function splitBySex(
  targets: readonly number[],
  bearers: number,
  others: number,
  w: readonly number[],
): [number[], number[]] {
  const n = targets.length,
    sum = targets.reduce((a, x) => a + Math.max(0, x), 0),
    want = targets.map((x) => (sum > 0 ? Math.max(0, x) / sum : 0)),
    total = Math.max(0, bearers) + Math.max(0, others),
    zero = () => new Array<number>(n).fill(0);
  if (total <= 0 || sum <= 0) return [zero(), zero()];
  const f = want.map((x, o) => x * (w[o] ?? 1) * Math.max(0, bearers)),
    m = want.map((x) => x * Math.max(0, others));
  for (let k = 0; k < 12; k++) {
    for (let o = 0; o < n; o++) {
      const c = f[o]! + m[o]!;
      if (c > 0) {
        const s = (want[o]! * total) / c;
        f[o] = f[o]! * s;
        m[o] = m[o]! * s;
      }
    }
    const sf = f.reduce((a, x) => a + x, 0),
      sm = m.reduce((a, x) => a + x, 0);
    for (let o = 0; o < n; o++) {
      if (sf > 0) f[o] = (f[o]! * bearers) / sf;
      if (sm > 0) m[o] = (m[o]! * others) / sm;
    }
  }
  return [
    f.map((x) => (bearers > 0 ? x / bearers : 0)),
    m.map((x) => (others > 0 ? x / others : 0)),
  ];
}
