// A faith's head, and the faith against a ruler (asked 2026-11-22: "a faith has a seat but no person heading it"). A faith that
// is held by a people is led by someone of it, and how that one is found is the faith's own: what its creed holds of rank and kin
// and what its founders' people kept, read off the faith's facts, never written as a case:
//   - a LINE: rank and kin both kept (rank and kinship past the middle, as its creed and its seat's people hold them): the head's
//     heir after them, of their family; a people whose bodies live as one keep a line of their kind and no person;
//   - CHOSEN: rank kept, kin not: its clergy raise the one of them who stands highest in the faith;
//   - a COUNCIL: rank not kept: its elders, the eldest of them speaking for it;
//   - the LEARNED: a faith that holds the power behind the world to know (rules/faith.ts TENET_POWERS knows past a half): the most
//     learned of its faithful.
// A faith held across realms is a hierarchy over them, and a ruler may want what it holds in his: who names its priests in his
// lands, what his people give it, whose word his people keep. Whether a ruler presses it (CLASH below; no draw) reads who the head
// is to him (of another realm, at war with his), how he holds his realm (by arms), whether he keeps another faith than the
// faithful he rules, how far the faith claims over rulers (its rank), how strong its clergy are in his lands, the head's standing,
// and against it, how far his rule is doubted (a doubted ruler needs the faith's blessing). Past `opens` the ruler contests it;
// a contest settles below `settles`; a ruler who holds by arms takes the naming of its priests (`invests`); a faith that claims
// over rulers casts him out past `casts`; one cast out for `breaksAfter` years whose realm holds it in more than one land, past
// `breaks`, breaks from the faith: its lands keep their own (a schism through the faiths' own split). A ruler cast out is
// reconciled by his death or yielding (his rule doubted past `yields`).
// Pure tables and functions.
import { dmath } from "../kernel/index.ts";

export const FAITH_FORMS = ["line", "chosen", "council", "learned"] as const;
export type FaithForm = (typeof FAITH_FORMS)[number];

/** How a faith finds its head, from its creed's pull on rank and kin (hundredths), its seat's people's ways (0 … 1), and whether its power knows. */
export function faithForm(f: {
  readonly creedRank: number;
  readonly creedKin: number;
  readonly rank: number;
  readonly kin: number;
  readonly knows: number;
  readonly hive: boolean;
}): FaithForm {
  if (f.hive) return "line";
  if (f.knows >= 0.5) return "learned";
  const rank = f.rank + f.creedRank / 100,
    kin = f.kin + f.creedKin / 100;
  if (rank >= 0.55 && kin >= 0.55) return "line";
  if (rank >= 0.5) return "chosen";
  return "council";
}

export const FAITH_HEAD = {
  /** A faith's head is weighed against each realm that holds it once in so many years, each faith in its own year. */
  every: 5,
  /** A realm is weighed where at least this share of its people keep the faith, or its seat does. */
  least: 0.25,
  /** The standing one newly raised to head a faith stands at (thousandths of the line), and what heading it adds a year. */
  raised: 1500,
  /** A line's heir is born so many of a generation after the one before. */
  heir: 0.9,
} as const;

/** What weighs on a ruler's pressing a faith that is held in his realm (each 0 … 1). */
export type ClashRead = {
  /** The head is of another realm. */
  readonly abroad: number;
  /** How far the ruler holds his realm by arms (rules/holds.ts force). */
  readonly force: number;
  /** The ruler's seat keeps another faith than these faithful. */
  readonly other: number;
  /** How far the faith claims over rulers: its rank, as its creed and its seat's people hold it. */
  readonly claims: number;
  /** How strong its clergy are in the ruler's lands that keep it. */
  readonly clergy: number;
  /** The head's standing, saturating. */
  readonly standing: number;
  /** The ruler is at war with the head's realm. */
  readonly war: number;
  /** How far his rule is doubted (1 − its standing with its people). */
  readonly doubt: number;
  /** A concord made with this head (by this ruler or one before him) stands: what was between them is settled. */
  readonly concord?: number;
};

export const CLASH = {
  opens: 0.5,
  settles: 0.3,
  /** A ruler who holds by arms past this, pressing past `opens`, takes the naming of its priests. */
  invests: 0.6,
  /** Past this, a faith that claims over rulers at least `claimsLeast` casts the ruler out. */
  casts: 0.62,
  claimsLeast: 0.45,
  /** One cast out so many years, pressing past `breaks`, whose realm holds the faith in more than one land, breaks from it. */
  breaksAfter: 10,
  breaks: 0.62,
  /** A ruler cast out whose rule is doubted past this yields. */
  yields: 0.6,
  /** What a ruler cast out loses of his standing with those of his people who keep the faith (rules: order legitimacy). */
  standing: 0.15,
  /** The grief of the faithful in his lands when he is cast out. */
  grief: 0.05,
} as const;

/** The parts of a ruler's pressing a faith, in the order told: name, value, what it adds. */
export function clashParts(r: ClashRead): { name: string; value: number; by: number }[] {
  return [
    // (A head abroad weighs on a ruler as far as the faith claims over rulers: one that claims nothing asks nothing of him.)
    {
      name: "its head, of another realm, claims over rulers",
      value: r.abroad * r.claims,
      by: 0.3 * r.abroad * r.claims,
    },
    { name: "a ruler who holds by arms", value: r.force, by: 0.2 * r.force },
    { name: "a ruler of another faith over its faithful", value: r.other, by: 0.25 * r.other },
    { name: "its clergy strong in his lands", value: r.clergy, by: 0.15 * r.clergy },
    { name: "its head stands high", value: r.standing, by: 0.1 * r.standing },
    { name: "at war with its head's realm", value: r.war, by: 0.2 * r.war },
    { name: "a rule doubted, that needs its blessing", value: r.doubt, by: -0.25 * r.doubt },
    { name: "a concord made with its head", value: r.concord ?? 0, by: -0.2 * (r.concord ?? 0) },
  ];
}

export function clashScore(r: ClashRead): number {
  return clashParts(r).reduce((s, p) => s + p.by, 0);
}

/** How far a faith claims over rulers (0 … 1): its rank as its creed (hundredths) and its seat's people (0 … 1) hold it. */
export function claimsOf(creedRank: number, rank: number): number {
  return dmath.clamp(rank + creedRank / 100, 0, 1);
}
