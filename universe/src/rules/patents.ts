// Who may use what is found (breadth round, 2026-11-23): grants of sole use, the hold of what a land has built on, and what a
// spy carries home.
//   A grant (a patent): a realm whose seat keeps written records may give a finder sole use of what it found for a term. A finder
//     without one has its use alone only until others copy it, a year or two; with one, for the term. What that is worth to it is
//     the use's worth over those years, discounted by what waiting is worth to its people (rules/thrift.ts), and those who find
//     answer to their reward, a little (INVENTION_ELASTICITY): its finders find the more. Its own lands learn from each other
//     the slower while the grant runs, as some who would take it up will not pay its holder. A realm grants while what its finders
//     gain is more than what its learners lose; it lets grants lapse when it is the other way. The term is as long as its people
//     look ahead: a year's worth no nearer than a tenth of now, at most.
//   Lock-in: a land that has built on one way of doing a thing (its tools, works and habits for it) takes up a rival way the
//     slower while what it built still stands: the new way's gain against the old way's gain still standing, worn out over the
//     life of what was built.
//   Theft: a spy placed in a realm (sim/war/spies.ts) sees what is worked there openly, and may bring home a craft its own realm's
//     seat lacks and could hold; the more as the realm it is in lets word pass.
// Pure tables and functions.
import { dmath } from "../kernel/index.ts";
import { PRINCIPLES, type Effect, type Principle } from "./principles.ts";

/** How far finding answers to its reward (est: the elasticity of invention to what it earns, small; studies of patent reforms). */
export const INVENTION_ELASTICITY = 0.2;
/** Years a finder has its use alone before it is copied, with no grant (est). */
export const LEAD_YEARS = 2;
/** Of those in a realm who would take up a granted craft while its term runs, the share who will not pay its holder (est). */
export const GRANT_HOLD = 0.5;
/** How long what a land built for a way of doing a thing lasts (est: tools, works and the habits of a trade, a generation or two). */
export const BUILT_LIFE = 40;
/** How fast a realm's tallies of finding and learning fade a year (a memory of a generation). */
export const RIGHTS_FADE = 0.95;

/** The term of a grant (years): as far as its people look ahead, until a year then is worth a tenth of one now; 5 … 40. */
export function grantTerm(preference: number): number {
  return Math.round(dmath.clamp(dmath.log(10) / Math.max(1e-3, preference), 5, 40));
}

/** What `years` of a use is worth now, a year's use 1, discounted at `preference`. */
function worthOver(years: number, preference: number): number {
  const r = Math.max(1e-4, preference);
  return (1 - dmath.exp(-r * years)) / r;
}

/** How much more a realm's finders find under its grants: their reward over the term against over their lead, to the elasticity. */
export function grantPull(preference: number): number {
  const term = grantTerm(preference);
  return dmath.pow(
    worthOver(term, preference) / worthOver(LEAD_YEARS, preference),
    INVENTION_ELASTICITY,
  );
}

/** Whether a realm's grants pay it: its finders' gain (finds × the pull) against its learners' loss (learning within × the hold). */
export function grantsPay(finds: number, learnedWithin: number, preference: number): boolean {
  return finds * (grantPull(preference) - 1) > learnedWithin * GRANT_HOLD;
}

/**
 * What a principle does that another way of doing stands in for, not adds to (the effects of a kind of engine, arm, ship or
 * signal: one drives a works, or arms a host, instead of the other). What raises a yield, a store, a craft's make or a people's
 * health adds to what else does, and holds nothing back.
 */
export const RIVAL_EFFECTS: readonly Effect[] = [
  "power",
  "renewable",
  "arms",
  "armour",
  "mounts",
  "ships",
  "sieges",
  "signal",
];

/**
 * Each principle's rivals: those that do some of what it does in another way (an effect of RIVAL_EFFECTS both raise) and that it
 * does not stand on (it does not need them, nor they it). A land that holds a rival has built on it.
 */
export const RIVALS: ReadonlyMap<string, readonly Principle[]> = (() => {
  const out = new Map<string, Principle[]>(),
    does = (p: Principle) => RIVAL_EFFECTS.filter((e) => (p.effects[e] ?? 0) > 0);
  const by = new Map<string, Principle[]>();
  for (const p of PRINCIPLES) for (const e of does(p)) (by.get(e) ?? by.set(e, []).get(e)!).push(p);
  // (What each stands on, all the way down, by any of its roads.)
  const index = new Map(PRINCIPLES.map((p) => [p.id, p])),
    under = new Map<string, Set<string>>(),
    below = (p: Principle, path: Set<string>): Set<string> => {
      const had = under.get(p.id);
      if (had) return had;
      const out = new Set<string>();
      if (path.has(p.id)) return out;
      path.add(p.id);
      for (const n of p.needs)
        for (const x of n.split("|")) {
          out.add(x);
          const q = index.get(x);
          if (q) for (const y of below(q, path)) out.add(y);
        }
      path.delete(p.id);
      under.set(p.id, out);
      return out;
    };
  const needs = (a: Principle, b: Principle) =>
    below(a, new Set()).has(b.id) || below(b, new Set()).has(a.id);
  for (const p of PRINCIPLES) {
    const list: Principle[] = [];
    for (const e of does(p))
      for (const q of by.get(e)!) if (q !== p && !needs(p, q) && !list.includes(q)) list.push(q);
    if (list.length) out.set(p.id, list);
  }
  return out;
})();

/** What a principle shares of its rival's doing: the effects both raise, its own gain and the rival's. */
function shared(p: Principle, q: Principle): { mine: number; theirs: number } {
  let mine = 0,
    theirs = 0;
  for (const e of RIVAL_EFFECTS) {
    const a = p.effects[e] ?? 0,
      b = q.effects[e] ?? 0;
    if (a > 0 && b > 0) {
      mine += a;
      theirs += b;
    }
  }
  return { mine, theirs };
}

/** Each principle's rivals with what each way gains of the effects they share (RIVALS, `shared`): read once. */
const RIVAL_GAINS = new Map<string, { q: Principle; mine: number; theirs: number }[]>(
  [...RIVALS].map(([id, list]) => {
    const p = PRINCIPLES.find((x) => x.id === id)!;
    return [id, list.map((q) => ({ q, ...shared(p, q) }))];
  }),
);
/** What still stands of a rival's gain, a whole year at a time since it was taken up (exp(-age / BUILT_LIFE)). */
const WORN = Float64Array.from({ length: 30 * BUILT_LIFE + 1 }, (_, a) =>
  dmath.exp(-a / BUILT_LIFE),
);
function worn(age: number): number {
  return Number.isInteger(age) && age < WORN.length ? WORN[age]! : dmath.exp(-age / BUILT_LIFE);
}

/**
 * How readily a land takes up a principle against what it built on its rivals (1: nothing holds it): the new way's gain against
 * that gain and the gain still standing of the rival it built on most, worn out over BUILT_LIFE since the land took it up. `since(id)`: the year it
 * took a rival up, or undefined where it does not hold it.
 */
export function lockedIn(
  p: Principle,
  year: number,
  since: (id: string) => number | undefined,
): { hold: number; by: Principle | null } {
  const rivals = RIVAL_GAINS.get(p.id);
  if (!rivals) return { hold: 1, by: null };
  let gain = 0,
    by: Principle | null = null,
    most = 0;
  for (const r of rivals) {
    const y = since(r.q.id);
    if (y === undefined) continue;
    const standing = r.theirs * worn(Math.max(0, year - y));
    // (The rival it built on most is what holds it: one works, one host's arms, replaced at a time.)
    if (standing > most) [most, by, gain] = [standing, r.q, r.mine];
  }
  return most > 0 && gain > 0 ? { hold: gain / (gain + most), by } : { hold: 1, by: null };
}

/** lockedIn's hold alone. */
export function lockHold(
  p: Principle,
  year: number,
  since: (id: string) => number | undefined,
): number {
  const rivals = RIVAL_GAINS.get(p.id);
  if (!rivals) return 1;
  let gain = 0,
    most = 0;
  for (const r of rivals) {
    const y = since(r.q.id);
    if (y === undefined) continue;
    const standing = r.theirs * worn(Math.max(0, year - y));
    if (standing > most) [most, gain] = [standing, r.mine];
  }
  return most > 0 && gain > 0 ? gain / (gain + most) : 1;
}
