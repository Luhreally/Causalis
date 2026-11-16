// A realm's money and what it fears (asked 2026-11-14: "bonds, diffrent citizens owning stocks from diffrent countires, like emergent
// cold war dynamics and like fear of communism or democracy like but all from first pricniples emergent data driven"). Nothing here is
// named for any of Earth's arrangements. A realm's way is five numbers, each 0 … 1: three of how it is held (rules/holds.ts: force,
// voice, word) and two of how its wealth is owned:
//   spread: among how many its wealth lies (0: a few great houses; 1: every household);
//   common: how much of it the realm itself holds for all (0: none, every thing someone's own; 1: all of it).
// From those, and from numbers the world already keeps, three things are reckoned, each a sum or a product whose parts are shown:
//   what a realm pays to borrow (yieldOf): its record of debts refused, what it owes against what it takes in, a war, how it is held;
//   how much one realm's rulers, owners or people fear another's way (threatOf): how unlike the two ways are, how well the other's is
//     seen to work, how far its own people are exposed to it, and how much those who hold the realm as it is would lose by it;
//   which realms stand in two camps (campsOf): where two great realms fear each other, who stands nearer which.
// A capitalist democracy, a commune under one ruler, a hive that holds all in common and decides as one: each is a place in the five
// numbers, read into words where a page shows it (ownWords, wayWords), and a people of another body lands where Earth's never did.
// Pure tables and functions.
import { dmath } from "../kernel/index.ts";
import type { BodyPlan } from "./bodies.ts";
import type { WaysRead } from "./holds.ts";
import { LEARNING, evidenceKept } from "./learn.ts";

/** How wealth is owned: the two numbers, in the order a realm keeps them. */
export const OWN_KINDS = ["spread", "common"] as const;
export type Own = (typeof OWN_KINDS)[number];
export const OWN: Readonly<Record<Own, number>> = { spread: 0, common: 1 };

/** A realm's way, as fear reads it: force, voice, word (rules/holds.ts), spread, common. */
export type Way = readonly [
  force: number,
  voice: number,
  word: number,
  spread: number,
  common: number,
];
export const WAY_NAMES = ["force", "voice", "word", "spread", "common"] as const;
/** How much each number weighs in how unlike two ways are. */
export const WAY_WEIGHTS: readonly number[] = [0.6, 1, 0.8, 0.8, 1];

export const FINANCE = {
  // —— Debt sold ——
  /** A year's interest on the debt of a realm with nothing against it. */
  base: 0.04,
  /** For each debt it refused, fading by half in `recordHalf` years, up to `recordMost` of them. */
  record: 0.05,
  recordHalf: 30,
  recordMost: 3,
  /** For each year's takings it owes, up to `burdenMost` years. */
  burden: 0.04,
  burdenMost: 3,
  /** At war. */
  war: 0.03,
  /** Where one decides alone, a debt can be refused at a word; where it binds itself to no one; and less where word moves freely. */
  alone: 0.05,
  wary: 0.03,
  seen: 0.02,
  /** While credit is dear after a house of lending failed (sim/credit CREDIT.dearer). */
  crisis: 0.06,
  /** Above this, no one buys. */
  shut: 0.3,
  /** A realm owing more than this many years' takings sells no more. */
  full: 2,
  /** Its own people take this share of what it sells, more as its wealth is widely held and its people thrifty. */
  home: 0.35,
  homeSpread: 0.3,
  homeThrift: 0.3,
  /** A people abroad puts at most this share of its seat's grain above half a year's food into one sale. */
  lend: 0.15,
  /** At most this many peoples abroad hold a realm's debt. */
  holders: 4,
  /** A part of each debt is paid back each year: one in this many. */
  term: 15,
  /**
   * A realm refuses its debt: having paid less than half its interest `missed` years running (a third of a generation); or `late`
   * years running while it owes `crushed` years of what it takes in; or beaten in a war, a year unpaid, owing `beaten` years' takings.
   * Each year unpaid makes new debt dearer by `arrears`, up to `arrearsMost` of them.
   */
  missed: 8,
  late: 2,
  crushed: 3,
  beaten: 1,
  arrears: 0.01,
  arrearsMost: 6,
  /** A realm whose lands hold under `leanMonths` months of food pays up to this much more: lenders see what there is to pay from. */
  lean: 0.12,
  leanMonths: 6,
  /** A debt refused is remembered this long, by lenders and on a realm's page: past it, it weighs a hundredth of what it did. */
  remembered: 200,
  /** Whom a realm cost is not its buyer again for this long. */
  burnt: 30,
  /** A realm that fears another this much borrows to arm against it: this share of a season's keep for its host, by its fear. */
  armAt: 0.35,
  arm: 0.25,
  /** And fields this much more of its men at the most (sim/war fieldShare). */
  fields: 0.03,
  /**
   * How much of the trade between two realms' lands a fear shuts, for each point of it (sim/economy trade): half at the most. A
   * fear is not a war: at 1 the greatest fear cut all trade, as a war's embargo does (so it stood until 2026-11-15).
   */
  shuts: 0.5,
  /** A realm buys the war debt of one that fights a realm whose way it fears, this much the readier for each point of fear. */
  backs: 2,

  // —— Shares held abroad ——
  /** The most of a realm's listed worth one people abroad comes to hold, were everything for it. */
  stake: 0.3,
  /** How far a holding moves toward what is wanted of it, a year. */
  stakePace: 0.2,
  /** All peoples abroad together hold at most this share. */
  abroad: 0.6,
  /** What a company pays its holders in a year, of what it is worth. */
  payout: 0.05,
  /** A realm this closed to strangers' holdings takes what they hold. */
  closed: 0.12,
  /** At most this many holders are kept by name; the rest are counted together. */
  kept: 4,

  // —— How wealth is owned ——
  ownPace: 0.3,
  ownLeast: 0.05,

  // —— Fear ——
  /** What the four parts' product is multiplied by, to a number 0 … 1. */
  fear: 6,
  /** A fear told (and acted on in pacts) at this and above; let go below `fearGone`. */
  feared: 0.35,
  fearGone: 0.2,
  /** A realm keeps this many of its fears. */
  fears: 3,
  /** What a fear takes from two realms' regard, at its most; what a fear shared by two alike gives. */
  regard: 0.45,
  shared: 0.3,
  /** Two realms are alike within this distance. */
  alike: 0.22,
  /** How far a fear moves word, arms and voice where those who rule would lose; and where the many would. */
  tightens: { word: -0.25, force: 0.15, voice: -0.1 },
  guards: { word: -0.1, force: 0.08, voice: 0 },
  /** Camps: two realms that fear each other at least this much between them, each with this share of the world's people or among its so many most peopled. */
  campFear: 0.5,
  campShare: 0.04,
  campGreat: 4,
  /** A realm leans to a pole when it stands this much nearer it than the other. */
  campLean: 0.06,
} as const;

const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
/** A number kept as a whole hundredth. */
const unit = (x: number) => Math.round(clamp(x) * 100) / 100;

// —— How wealth is owned ——————————————————————————————————————————————————————————————————————————————

/** What a realm's ownership is first read off, and pulled back toward: its land law, its people's ways, their body. */
export function firstOwn(
  /** Its land law's position (0 the lord's, 1 leased, 2 the tiller's own: sim/order/laws.ts). */
  land: number,
  w: WaysRead,
  body: BodyPlan | null | undefined,
): [number, number] {
  const social = body?.social ?? 0.6,
    // (Those who live as one keep one store; those who live apart, each their own.)
    together = (social - 0.6) * 0.8,
    hive = social >= 0.9 && (body?.size ?? 100) < 100 && body?.medium !== "water" ? 0.25 : 0;
  return [
    unit(0.2 + 0.2 * land + 0.3 * (0.5 - w.hierarchy) + 0.1 * (w.thrift - 0.5)),
    unit(0.18 + together + hive + 0.3 * (0.5 - w.trade) + 0.15 * (w.piety - 0.5)),
  ];
}

/** How a realm's wealth is owned, in words read off the two numbers and the people's body. */
export function ownWords(own: readonly number[], body: BodyPlan | null | undefined): string {
  const [spread, common] = own as [number, number],
    hive = (body?.social ?? 0) >= 0.9 && (body?.size ?? 100) < 100 && body?.medium !== "water",
    brood = (body?.young ?? 1) >= 4 && body?.bearing !== "live",
    house = hive ? "brood-chamber" : brood ? "brood" : "household";
  if (common >= 0.6)
    return hive ? "all held in the hive's one store" : "held in common by the realm";
  const whose =
    spread < 0.3
      ? `held by a few great ${house}s`
      : spread < 0.6
        ? `held by its propertied ${house}s`
        : `widely held, ${house} by ${house}`;
  return common >= 0.3 ? `part the realm's own, the rest ${whose}` : whose;
}

/** The bands an ownership number is told in (ownWords): crossing one is an event. */
export const OWN_BANDS: Readonly<Record<Own, readonly number[]>> = {
  spread: [0.3, 0.6],
  common: [0.3, 0.6],
};
export const ownBand = (k: Own, v: number) => OWN_BANDS[k].filter((b) => v >= b).length;

/** A way in a few words, for a camp's name or a fear's: who decides, and whose the wealth is. */
export function wayWords(way: Way): string {
  const [, voice, , spread, common] = way,
    who =
      voice < 0.2
        ? "one decides"
        : voice < 0.45
          ? "a few decide"
          : voice < 0.7
            ? "many decide"
            : "all decide",
    whose =
      common >= 0.6
        ? "wealth is the realm's"
        : spread < 0.3
          ? "wealth is a few's"
          : spread < 0.6
            ? "wealth is the propertied's"
            : "wealth is widely held";
  return `${who}, ${whose}`;
}

// —— What a realm pays to borrow ————————————————————————————————————————————————————————————————————

/** What a realm's yield is read off. */
export type Borrower = {
  /** The debts it refused, each as the years since. */
  readonly refused: readonly number[];
  /** What it owes, in years of what it takes in. */
  readonly burden: number;
  readonly atWar: boolean;
  readonly voice: number;
  readonly word: number;
  readonly trust: number;
  /** Credit dear: a house of lending failed lately. */
  readonly crisis: boolean;
  /** Years running it has left its interest unpaid (absent: none). */
  readonly unpaid?: number;
  /** The food its lands hold, in months of their eating (absent: enough). */
  readonly months?: number;
  /** How fast its prices rose last year (rules/money.ts; absent: they held): lenders are paid back in money worth less (Fisher). */
  readonly inflation?: number;
};

/** One part of a sum, for a page to show. */
export type Part = { readonly name: string; readonly value: number };

/** A year's interest a realm must offer, and each part of it. */
export function yieldOf(b: Borrower): { rate: number; parts: Part[] } {
  const record =
      FINANCE.record *
      Math.min(
        FINANCE.recordMost,
        b.refused.reduce(
          (s, years) => s + dmath.pow(0.5, Math.max(0, years) / FINANCE.recordHalf),
          0,
        ),
      ),
    parts: Part[] = [
      { name: "what any realm pays", value: FINANCE.base },
      { name: "debts it refused, remembered", value: record },
      {
        name: "what it owes against what it takes in",
        value: FINANCE.burden * Math.min(FINANCE.burdenMost, Math.max(0, b.burden)),
      },
      { name: "a war it fights", value: b.atWar ? FINANCE.war : 0 },
      { name: "how few could refuse it at a word", value: FINANCE.alone * (1 - clamp(b.voice)) },
      { name: "how little it binds itself", value: FINANCE.wary * (1 - clamp(b.trust)) },
      { name: "how freely word of its books moves", value: -FINANCE.seen * clamp(b.word) },
      { name: "credit dear since a house failed", value: b.crisis ? FINANCE.crisis : 0 },
      {
        name: "how little its lands have in store to pay from",
        value: FINANCE.lean * clamp(1 - (b.months ?? FINANCE.leanMonths) / FINANCE.leanMonths),
      },
      {
        name: "its money losing its worth",
        value: clamp(b.inflation ?? 0) * 0.9,
      },
      {
        name: "interest it has left unpaid",
        value: FINANCE.arrears * Math.min(FINANCE.arrearsMost, Math.max(0, b.unpaid ?? 0)),
      },
    ],
    rate =
      Math.round(
        Math.max(
          0.01,
          parts.reduce((s, p) => s + p.value, 0),
        ) * 10_000,
      ) / 10_000;
  return { rate, parts: parts.filter((p) => Math.abs(p.value) >= 0.0005) };
}

// —— Fear of another's way ——————————————————————————————————————————————————————————————————————————

/** How unlike two ways are, 0 … 1. */
export function wayDistance(a: Way, b: Way): number {
  let s = 0,
    w = 0;
  for (let k = 0; k < 5; k++) {
    s += WAY_WEIGHTS[k]! * (a[k]! - b[k]!) * (a[k]! - b[k]!);
    w += WAY_WEIGHTS[k]!;
  }
  return Math.sqrt(s / w);
}

/** Who in a realm would lose by another's way. */
export const LOSERS = [
  /** The few who decide: a say shared, word let loose, arms in many hands. */
  "those who rule it",
  /** The many who decide: their say taken, their words watched. */
  "its people, who have a say",
  /** The few who own: their wealth taken for all, or spread. */
  "the few who own it",
  /** The many who own a little: what is theirs taken for all, or gathered to a few. */
  "its households, who own their own",
  /** Those who hold the common store: it shared out into private hands. */
  "those who keep its common store",
] as const;

/** Who would lose, before a verb: "its people, who have a say, would lose" keeps its comma. */
export const losersBefore = (who: number): string => {
  const w = LOSERS[who] ?? LOSERS[0];
  return w.includes(",") ? `${w},` : w;
};

/** What each of a realm's holders would lose were it held and owned as another is: the greatest, and who. */
export function wouldLose(a: Way, b: Way): { loss: number; who: number; each: number[] } {
  const up = (x: number) => Math.max(0, x),
    [fa, va, wa, sa, ca] = a,
    [fb, vb, wb, sb, cb] = b,
    each = [
      (1 - va) * (up(vb - va) + 0.5 * up(wb - wa) + 0.3 * up(fa - fb)),
      va * (up(va - vb) + 0.5 * up(wa - wb)),
      (1 - sa) * (1 - ca) * (up(cb - ca) + 0.6 * up(sb - sa)),
      sa * (1 - ca) * (up(cb - ca) + 0.6 * up(sa - sb)),
      ca * up(ca - cb),
    ];
  let who = 0;
  for (let k = 1; k < each.length; k++) if (each[k]! > each[who]!) who = k;
  return { loss: clamp(each[who]!), who, each };
}

/** How a realm fares, as its neighbours see it: how its people eat, how quiet they are, what they hold a head. */
export type SeenFaring = {
  /** Months of food in store a head, against a year's (0 … 1). */
  readonly fed: number;
  /** One less its people's grievance (0 … 1). */
  readonly calm: number;
  /** What its stores hold a head, at their usual worth. */
  readonly rich: number;
  readonly people: number;
};

/** How well another's way is seen to work, against one's own: 0.5 where they fare alike and are of a size. */
export function seenToWork(mine: SeenFaring, theirs: SeenFaring): number {
  const rich = theirs.rich / Math.max(1e-9, mine.rich + theirs.rich) - 0.5,
    better = 0.5 + 0.6 * (theirs.fed - mine.fed) + 0.5 * (theirs.calm - mine.calm) + 0.8 * rich,
    // (A realm a tenth one's size is hardly looked to.)
    size = 0.5 + 0.5 * Math.min(1, (2 * theirs.people) / Math.max(1, mine.people + theirs.people));
  return clamp(clamp(better, 0.05, 1) * size);
}

/** How two realms meet, as exposure reads it. */
export type Meeting = {
  /** Lands along their border, against four (0 … 1). */
  readonly near: number;
  /** Trade between them, against the most diplomacy counts (0 … 1). */
  readonly trade: number;
  /** How alike their speech (0 … 1). */
  readonly tongue: number;
  /** What each one's people hold of the other's, against a sixth of it (0 … 1). */
  readonly stakes: number;
};

/** How far a realm's people are exposed to another's way: nearness, trade, speech, holdings; the more as word moves freely among them. */
export function exposure(m: Meeting, word: number): number {
  return clamp(
    (0.35 * m.near + 0.3 * m.trade + 0.15 * m.tongue + 0.2 * m.stakes) * (0.5 + clamp(word)),
  );
}

/** A fear, with its parts. */
export type Threat = {
  /** 0 … 1. */
  readonly level: number;
  readonly unlike: number;
  readonly works: number;
  readonly exposed: number;
  readonly loss: number;
  /** Who would lose the most (LOSERS). */
  readonly who: number;
  /** How far a people is drawn to the other's way: its exposure, by how much better the other is seen to fare (0 … 1). */
  readonly drawn: number;
};

/** How much a realm fears another's way: how unlike × how well it is seen to work × how exposed its people × what its holders would lose. */
export function threatOf(mine: Way, theirs: Way, works: number, exposed: number): Threat {
  const unlike = wayDistance(mine, theirs),
    { loss, who } = wouldLose(mine, theirs);
  return {
    level: unit(FINANCE.fear * unlike * works * exposed * loss),
    unlike,
    works,
    exposed,
    loss,
    who,
    drawn: clamp(exposed * Math.max(0, 2 * works - 1)),
  };
}

/**
 * What a fear does to how a realm is held (force, voice, word): those who decide answer a fear of their own loss; where the many
 * would lose, they guard themselves, more gently. (Whether a people is drawn to a way seen to fare better is no part of this: what
 * a realm has seen go well and ill, its own fate and its neighbours', is its evidence, rules/learn.ts.)
 */
export function fearMoves(mine: Way, t: Threat): [force: number, voice: number, word: number] {
  const few = t.who === 0 || t.who === 4 || (t.who === 2 && mine[1] < 0.45),
    by = few ? FINANCE.tightens : FINANCE.guards;
  return [by.force * t.level, by.voice * t.level, by.word * t.level];
}

// —— What a realm has seen of how wealth is owned ————————————————————————————————————————————————————————

/**
 * What a realm believes of its two numbers of owning, kept as its beliefs of how it is held are (rules/learn.ts Belief): for each,
 * the sum of its evidence for standing high on it and how much evidence that is, as of a year.
 */
export type OwnBelief = { a: number[]; n: number[]; at: number };

/** A piece of evidence of owning: how a realm stood on each number against the usual, times how it fared, by what it weighs. */
export function ownEvidence(
  own: readonly number[],
  usual: readonly number[],
  fared: number,
  weight: number,
): number[] {
  // (`|| 0`: never a nothing below nothing, which a save reads back as 0.)
  return [0, 1].map(
    (k) => weight * clamp(2 * ((own[k] ?? 0.5) - (usual[k] ?? 0.5)), -1, 1) * fared || 0,
  );
}

/** A belief of owning with a piece of evidence added in a year, what it had faded to then (half in LEARNING.half years). */
export function ownBelieved(
  b: OwnBelief | undefined,
  evidence: readonly number[],
  year: number,
): OwnBelief {
  const keep = b ? evidenceKept(year - b.at) : 1,
    round = (x: number) => Math.round(x * 1000) / 1000 || 0;
  return {
    a: [0, 1].map((k) => round((b?.a[k] ?? 0) * keep + (evidence[k] ?? 0))),
    n: [0, 1].map((k) => round((b?.n[k] ?? 0) * keep + Math.abs(evidence[k] ?? 0))),
    at: year,
  };
}

/** What a belief of owning asks of its number in a year: so much more, or less, wanted of it. */
export function ownPull(b: OwnBelief | undefined, k: number, year: number): number {
  if (!b) return 0;
  const keep = evidenceKept(year - b.at),
    n = (b.n[k] ?? 0) * keep;
  return n > 0 ? (LEARNING.learn * (b.a[k] ?? 0) * keep) / (n + LEARNING.prior) : 0;
}

// —— Camps ——————————————————————————————————————————————————————————————————————————————————————————

/** A realm as the camps read it. */
export type CampRealm = {
  readonly ref: string;
  readonly way: Way;
  readonly people: number;
  /** Whom it fears, and how much (0 … 1). */
  readonly fears: readonly { readonly of: string; readonly level: number }[];
  /** Those it is sworn to. */
  readonly sworn: readonly string[];
};

export type Camps = {
  /** The two poles, the greater first. */
  readonly poles: readonly [string, string];
  /** What the two fear of each other, added. */
  readonly fear: number;
  /** Each pole's camp, itself first. */
  readonly camps: readonly [readonly string[], readonly string[]];
  /** Those of neither. */
  readonly apart: readonly string[];
};

/**
 * The two camps of a world, where it has them: the two realms, each great enough, that fear each other the most between them; each
 * other realm with the pole it stands nearer in its way, where it fears the other pole or is sworn to one of that side. Null where
 * no two great realms fear each other enough.
 */
export function campsOf(realms: readonly CampRealm[]): Camps | null {
  const by = new Map(realms.map((r) => [r.ref, r])),
    great = new Set(greatRealms(realms).map((r) => r.ref)),
    fear = (a: CampRealm, b: string) => a.fears.find((f) => f.of === b)?.level ?? 0;
  let best: { a: CampRealm; b: CampRealm; fear: number; score: number } | null = null;
  // (A fear held by one alone of the two is read as well: a pair is found from either end.)
  for (const a of realms) {
    if (!great.has(a.ref)) continue;
    for (const f of a.fears) {
      const b = by.get(f.of);
      if (!b || !great.has(b.ref)) continue;
      const both = f.level + fear(b, a.ref);
      if (both < FINANCE.campFear) continue;
      const score = both * Math.min(a.people, b.people),
        [lo, hi] = a.ref < b.ref ? [a, b] : [b, a];
      if (
        !best ||
        score > best.score ||
        (score === best.score &&
          (lo.ref < best.a.ref || (lo.ref === best.a.ref && hi.ref < best.b.ref)))
      )
        best = { a: lo, b: hi, fear: both, score };
    }
  }
  if (!best) return null;
  const [x, y] = best.a.people >= best.b.people ? [best.a, best.b] : [best.b, best.a],
    camps: [string[], string[]] = [[x.ref], [y.ref]],
    side = new Map<string, 0 | 1>([
      [x.ref, 0],
      [y.ref, 1],
    ]);
  // Twice over: those bound to a pole, then those bound to one who stands with it. What binds a realm to a side is a fear of the
  // other pole, or an oath to one of this side; and it must stand nearer this side's pole in its way.
  for (let pass = 0; pass < 2; pass++) {
    const joins: [CampRealm, 0 | 1][] = [];
    for (const r of realms) {
      if (side.has(r.ref)) continue;
      const lean = wayDistance(r.way, y.way) - wayDistance(r.way, x.way),
        sworn = (k: 0 | 1) => (r.sworn.some((s) => side.get(s) === k) ? 0.3 : 0),
        forX = fear(r, y.ref) + sworn(0),
        forY = fear(r, x.ref) + sworn(1);
      if (lean > FINANCE.campLean && forX >= 0.15 && forX >= forY) joins.push([r, 0]);
      else if (-lean > FINANCE.campLean && forY >= 0.15 && forY >= forX) joins.push([r, 1]);
    }
    for (const [r, k] of joins) {
      side.set(r.ref, k);
      camps[k].push(r.ref);
    }
  }
  const apart = realms.filter((r) => !side.has(r.ref)).map((r) => r.ref);
  return { poles: [x.ref, y.ref], fear: best.fear, camps, apart };
}

/**
 * The realms great enough to be a pole: each with `campShare` of the world's people or more, and in any case the `campGreat` most
 * peopled (a world of hundreds of realms has no realm with a twentieth of its people, and still has its great ones).
 */
export function greatRealms<T extends { readonly ref: string; readonly people: number }>(
  realms: readonly T[],
): T[] {
  const all = realms.reduce((s, r) => s + r.people, 0),
    ranked = [...realms].sort((a, b) => b.people - a.people || (a.ref < b.ref ? -1 : 1));
  return ranked.filter((r, i) => i < FINANCE.campGreat || r.people >= FINANCE.campShare * all);
}

/** Whether a world's camps are two in earnest: each pole with at least one other beside it. */
export const campsStand = (c: Camps | null): boolean =>
  !!c && c.camps[0].length >= 2 && c.camps[1].length >= 2;
