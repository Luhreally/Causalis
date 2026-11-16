// One person (round G, "the individual"; the bridge to a town mode of RimWorld's or Dwarf Fortress's detail). History counts a world's
// people by land and by work, never one by one; a person is someone the game names or watches (a ruler, one of a court, a holder of a
// town's line, one of a drawn home, one under the god's hand, one possessed) and is read when they are looked at, from their land's
// numbers and a seed of their own. Nothing here is kept and nothing flows back into the world's year: these are pure functions of what
// a person's world, land, home and seed already are, so the same person read twice is the same person.
//
// Each rule says what a thing does to a person; each world's own numbers say how much:
//   - what they are like comes of what their kind's body is (those who live close are warmer and keep their tempers; the long-lived are
//     slow to anger; a body big among its world's beasts goes boldly), of the ways of the people that raised them, of what befell their
//     land while they were young, and of their own draw;
//   - what they want is what any living thing needs (to eat, to be safe, to stand among its own, its kin, what it holds sacred, to know),
//     each weighed by who they are and met by what their land, their home and their law give them;
//   - their work over a life goes from the work they were raised to, by chance, by want, by skill and by whom they know, across the
//     work their land has;
//   - what they own is their household's share of what their land holds, by how its wealth is spread and their place in it;
//   - what could lead them wrong is want, what lies to hand, how far the law reaches and what holds them back.
// Pure: no draws of the world's streams (a person's own draws are the caller's keyed hash), nothing kept.
import { dmath } from "../kernel/index.ts";
import type { BodyPlan } from "./bodies.ts";
import { DAY_WAGE, SKILL_WORDS } from "./life.ts";
import { OCC } from "./species.ts";
import { BEARING } from "./children.ts";

const clamp01 = (x: number): number => dmath.clamp(x, 0, 1);
/** A draw of two units around nothing (-1 … 1), most near the middle: how people of one kind differ from one another. */
const bell = (a: number, b: number): number => a + b - 1;

// —— What they are like ————————————————————————————————————————————————————————————————————————————————————————

/** What a person is like, each 0 … 1 (0.5: as most of their people). */
export const SELF_TRAITS = [
  "boldness",
  "warmth",
  "temper",
  "conscience",
  "curiosity",
  "drive",
] as const;
export type SelfTrait = (typeof SELF_TRAITS)[number];
export type SelfTraits = Readonly<Record<SelfTrait, number>>;

/** Each trait's words: low, high, and what it is. */
export const SELF_TRAIT_WORDS: Readonly<
  Record<SelfTrait, { low: string; high: string; icon: string; what: string }>
> = {
  boldness: {
    low: "wary",
    high: "bold",
    icon: "🦁",
    what: "How readily they go where there is danger, or into what they don't know.",
  },
  warmth: {
    low: "cold",
    high: "warm",
    icon: "🤝",
    what: "How much others' good counts with them: kin, friends, strangers.",
  },
  temper: {
    low: "even-tempered",
    high: "quick to anger",
    icon: "🔥",
    what: "How fast a wrong turns to a fight.",
  },
  conscience: {
    low: "unscrupulous",
    high: "upright",
    icon: "⚖️",
    what: "How much it weighs with them to do what their people hold right, unseen.",
  },
  curiosity: {
    low: "incurious",
    high: "curious",
    icon: "🔍",
    what: "How much they want to know what they don't, and try what is new.",
  },
  drive: {
    low: "content",
    high: "driven",
    icon: "⛰️",
    what: "How much more they want than they have: more standing, more wealth, more mastery.",
  },
};

/** What a people's body gives every one of them, read from it (null: no people's body is known; upright apes' are taken). */
export type Nature = {
  /** How closely they live, 0 … 1 (a hive is 1). */
  readonly social: number;
  /** Body weight, kg. */
  readonly size: number;
  /** The longest a life runs, years. */
  readonly span: number;
  /** They eat flesh (all or in part). */
  readonly flesh: boolean;
  readonly warm: boolean;
  /** A hive: those born to it are of one mind. */
  readonly hive: boolean;
};

export function selfNature(b: BodyPlan | null | undefined): Nature {
  if (!b) return { social: 0.6, size: 60, span: 70, flesh: true, warm: true, hive: false };
  return {
    social: b.social,
    size: b.size,
    span: b.span,
    flesh: b.diet === "flesh" || b.diet === "both",
    warm: b.warm,
    hive: b.social >= 0.9 && b.size < 100 && b.medium !== "water",
  };
}

/** A people's ways, as they raised someone (sim/culture's eight, each 0 … 1). */
export type SelfWays = {
  readonly kinship: number;
  readonly hierarchy: number;
  readonly piety: number;
  readonly valour: number;
  readonly trade: number;
  readonly openness: number;
  readonly tradition: number;
  readonly thrift: number;
};
export const MIDDLE_WAYS: SelfWays = {
  kinship: 0.5,
  hierarchy: 0.5,
  piety: 0.5,
  valour: 0.5,
  trade: 0.5,
  openness: 0.5,
  tradition: 0.5,
  thrift: 0.5,
};

/** What someone grew up in. */
export type Upbringing = {
  readonly ways: SelfWays;
  /** How hungry their young years were: 0 never, 1 hungry most of them. */
  readonly hunger: number;
  /** How much war, fire and raiding their young years saw: 0 none, 1 much. */
  readonly danger: number;
  /** Their household's place in their land, 0 the poorest to 1 the richest. */
  readonly standing: number;
  /** Their land had writing as they grew. */
  readonly lettered: boolean;
};

/** How far one of a people differs from the next: a hive's are much alike. */
export function spreadOf(n: Nature): number {
  return n.hive ? 0.1 : 0.32 - 0.25 * Math.max(0, n.social - 0.6);
}

/**
 * What they are like: each trait from their kind's body, the ways they were raised in, what befell them young and their own draw
 * (`draw(i)`: a unit of their own, the same each time; two a trait).
 */
export function traitsOf(n: Nature, up: Upbringing, draw: (i: number) => number): SelfTraits {
  const w = up.ways,
    spread = spreadOf(n),
    own = (i: number) => spread * bell(draw(2 * i), draw(2 * i + 1)),
    // (A body big among the beasts of its world is less to be feared for: sixty kilos is an upright ape's.)
    big = dmath.clamp(dmath.log2(Math.max(1, n.size) / 60) / 3, -1, 1),
    // (The long-lived have the more time to wait.)
    long = dmath.clamp((n.span - 70) / 140, -0.4, 1);
  return {
    boldness: clamp01(
      0.5 +
        0.4 * (w.valour - 0.5) +
        0.12 * big +
        (n.flesh ? 0.04 : -0.04) +
        0.08 * up.danger +
        0.06 * (up.standing - 0.5) +
        own(0),
    ),
    warmth: clamp01(
      0.5 +
        0.45 * (n.social - 0.5) +
        0.3 * (w.kinship - 0.5) -
        0.1 * up.danger -
        0.06 * up.hunger +
        own(1),
    ),
    temper: clamp01(
      0.5 +
        0.25 * (w.valour - 0.5) -
        0.15 * (n.social - 0.5) -
        0.2 * long +
        0.15 * up.hunger +
        0.12 * up.danger +
        own(2),
    ),
    conscience: clamp01(
      0.5 +
        0.3 * (w.piety - 0.5) +
        0.25 * (w.tradition - 0.5) +
        0.2 * (n.social - 0.5) +
        0.08 * (w.kinship - 0.5) -
        0.12 * up.hunger +
        own(3),
    ),
    curiosity: clamp01(
      0.5 +
        0.45 * (w.openness - 0.5) -
        0.25 * (w.tradition - 0.5) +
        (up.lettered ? 0.06 : -0.04) +
        own(4),
    ),
    drive: clamp01(
      0.5 +
        0.3 * (w.hierarchy - 0.5) +
        0.3 * (w.trade - 0.5) +
        0.1 * (w.thrift - 0.5) +
        0.2 * up.hunger +
        0.1 * (0.5 - up.standing) +
        own(5),
    ),
  };
}

/** A trait in a word, where it is far enough from the middle to be worth one (null: as most are). */
export function traitWord(t: SelfTrait, v: number): string | null {
  return v <= 0.36 ? SELF_TRAIT_WORDS[t].low : v >= 0.64 ? SELF_TRAIT_WORDS[t].high : null;
}

// —— What they want ———————————————————————————————————————————————————————————————————————————————————————————————

export const WANT_KINDS = ["food", "safety", "standing", "kin", "faith", "knowing"] as const;
export type WantKind = (typeof WANT_KINDS)[number];
export const WANT_WORDS: Readonly<Record<WantKind, { icon: string; label: string }>> = {
  food: { icon: "🍞", label: "Enough to eat" },
  safety: { icon: "🛡️", label: "To be safe" },
  standing: { icon: "🏅", label: "Standing among their own" },
  kin: { icon: "👪", label: "Their kin about them" },
  faith: { icon: "🙏", label: "What they hold sacred" },
  knowing: { icon: "📜", label: "To know and to learn" },
};

/** What is true around a person that meets their wants or doesn't. */
export type WantFacts = {
  readonly nature: Nature;
  readonly ways: SelfWays;
  readonly child: boolean;
  /** Their age against their kind's span, 0 … 1. */
  readonly old: number;
  /** Their land's leanest month: what it ate of what it needed, 0 … 1. */
  readonly fed: number;
  /** Their household's day: what is left of what comes in, after food and rent, against a day's food for one (below 0: they go short). */
  readonly left: number;
  /** Their household's place in their land, 0 … 1, and their station's own (a ruler 1, one of a court 0.9; else 0). */
  readonly standing: number;
  readonly rank: number;
  /** War, raids and strikes on their land lately, 0 … 1; how little the law holds there, 0 … 1. */
  readonly danger: number;
  readonly lawless: number;
  /** Their kin: a partner living, children living, a parent living, someone close lost in the last few years. */
  readonly partnered: boolean;
  readonly children: number;
  readonly parents: boolean;
  readonly mourning: boolean;
  /** Their land keeps a faith; their realm forbids it. */
  readonly faith: boolean;
  readonly barred: boolean;
  /** Their land writes; how much of what can be known its people know, 0 … 1. */
  readonly lettered: boolean;
  readonly learned: number;
};

export type Want = {
  readonly kind: WantKind;
  /** How much it matters to them, 0 … 1. */
  readonly need: number;
  /** How far it is met, 0 … 1. */
  readonly met: number;
  /** need × what is not met: what presses on them. */
  readonly pressing: number;
};

/** Each of their wants, the most pressing first. */
export function wantsOf(t: SelfTraits, f: WantFacts): Want[] {
  const q = f.standing,
    lack = 1 - clamp01(f.fed),
    // (The poor go shortest in a lean year; the rich, last of all.)
    ownLack = lack * (1.6 - 1.2 * q),
    short = f.left < 0 ? Math.min(0.45, -f.left * 0.35) : 0,
    hive = f.nature.hive,
    want = (kind: WantKind, need: number, met: number): Want => {
      const n = clamp01(need),
        m = clamp01(met);
      return { kind, need: n, met: m, pressing: n * (1 - m) };
    };
  const out = [
    want("food", 0.75 + (f.nature.warm ? 0.2 : 0.05) + (f.child ? 0.05 : 0), 1 - ownLack - short),
    want(
      "safety",
      0.3 + 0.4 * (1 - t.boldness) + (f.child ? 0.15 : 0) + 0.15 * f.old,
      1 - 0.65 * f.danger - 0.3 * f.lawless,
    ),
    want(
      "standing",
      f.child ? 0.1 : 0.15 + 0.5 * t.drive + 0.25 * f.ways.hierarchy,
      0.1 + 0.9 * Math.max(q, f.rank),
    ),
    hive
      ? // (A hive's every one is kin to the rest, and they are all about them.)
        want("kin", 0.9, f.mourning ? 0.7 : 0.95)
      : want(
          "kin",
          0.2 + 0.45 * t.warmth + 0.25 * f.ways.kinship + (f.child ? 0.2 : 0),
          f.child
            ? (f.parents ? 0.85 : 0.3) - (f.mourning ? 0.3 : 0)
            : 0.2 +
                (f.partnered ? 0.35 : 0) +
                0.25 * Math.min(1, f.children / 2) +
                (f.parents ? 0.12 : 0) -
                (f.mourning ? 0.3 : 0),
        ),
    want(
      "faith",
      0.05 + 0.65 * f.ways.piety + 0.2 * t.conscience,
      f.faith ? (f.barred ? 0.2 : 0.9) : 0.35,
    ),
    want(
      "knowing",
      0.05 + 0.8 * t.curiosity,
      0.15 + (f.lettered ? 0.35 : 0) + 0.5 * clamp01(f.learned),
    ),
  ];
  return out.sort(
    (a, b) => b.pressing - a.pressing || WANT_KINDS.indexOf(a.kind) - WANT_KINDS.indexOf(b.kind),
  );
}

/** How a want stands, in a word. */
export function metWord(w: Want): string {
  return w.met >= 0.85 ? "met" : w.met >= 0.6 ? "mostly met" : w.met >= 0.35 ? "half met" : "unmet";
}

// —— Their work over a life ———————————————————————————————————————————————————————————————————————————————————————

/** A rank at a work by the years given to it (× their kind's span / 70): new to it, a hand, able, skilled, a master. */
export const RANK_YEARS: readonly number[] = [0, 2, 6, 12, 20];
export const rankWord = (rank: number): string => SKILL_WORDS[rank] ?? SKILL_WORDS[0]!;

/** Why someone came to a work. */
export type CareerWhy = "raised" | "chance" | "want" | "skill" | "kin" | "seat" | "lived";
export const CAREER_WHY: Readonly<Record<CareerWhy, string>> = {
  raised: "the work they were raised to",
  chance: "as chance had it",
  want: "when the old work no longer fed them",
  skill: "on the strength of their hands and head",
  kin: "through those they knew",
  seat: "to the seat",
  lived: "as the god lived it",
};

export type CareerStep = {
  /** The year they took it up. */
  readonly from: number;
  /** The year they left it (null: their work now, or when they died). */
  readonly to: number | null;
  readonly occupation: number;
  readonly why: CareerWhy;
  /** The rank they came to at it (0 … 4). */
  readonly rank: number;
};

export type CareerFacts = {
  readonly born: number;
  /** The year they are read in (now, or the year they died). */
  readonly year: number;
  readonly adulthood: number;
  readonly span: number;
  /** Their work in that year (an OCC), and since when, where history says (a seat, a line, a reign). */
  readonly occupation: number;
  readonly since: number | null;
  /** How they came to the seat, where they hold one. */
  readonly seated: boolean;
  /** Their land's work: each OCC and how many do it. */
  readonly kinds: readonly number[];
  readonly counts: readonly number[];
  readonly ways: SelfWays;
  readonly traits: SelfTraits;
  readonly standing: number;
  /** Hungry years in their working life, 0 … 1. */
  readonly hardTimes: number;
};

/** The years at a work that make each rank, for a kind whose life runs `span`. */
export function rankAt(years: number, span: number): number {
  const k = Math.max(0.3, span / 70);
  let r = 0;
  for (let i = 1; i < RANK_YEARS.length; i++) if (years >= RANK_YEARS[i]! * k) r = i;
  return r;
}

/** How likely one is to change their work in ten years of it, 0.03 … 0.6. */
export function mobilityOf(f: Pick<CareerFacts, "ways" | "traits" | "hardTimes">): number {
  return dmath.clamp(
    0.08 +
      0.25 * (f.ways.openness - 0.5) -
      0.2 * (f.ways.tradition - 0.5) -
      0.1 * (f.ways.kinship - 0.5) +
      0.2 * (f.traits.curiosity - 0.5) +
      0.1 * (f.traits.boldness - 0.5) +
      0.15 * f.hardTimes,
    0.03,
    0.6,
  );
}

/** Draw a work from a land's mix, not `not`, weighted toward the dearer the higher one stands (null: none other). */
function otherWork(f: CareerFacts, not: number, d: number): number | null {
  let all = 0;
  const w = f.kinds.map((k, i) => {
    if (k === not || k === OCC.leader) return 0;
    const pay = DAY_WAGE[k] ?? 1;
    const v = (f.counts[i] ?? 0) * dmath.pow(pay / 3, 2 * (f.standing - 0.5));
    all += v;
    return v;
  });
  if (all <= 0) return null;
  let pick = d * all;
  for (let i = 0; i < w.length; i++) {
    pick -= w[i]!;
    if (pick < 0) return f.kinds[i]!;
  }
  return null;
}

/**
 * Their work over their life, oldest first, ending at their work now: told back from it, a change at each decade of their working
 * years by how readily they change (their ways, their bent, hard times), each earlier work drawn from what their land does, and why
 * they changed read off the two works' pay and who they are (`draw(i)`: their own units).
 */
export function careerOf(f: CareerFacts, draw: (i: number) => number): CareerStep[] {
  const start = f.born + f.adulthood;
  if (f.year < start) return [];
  const seatFrom = f.since !== null ? Math.max(start, Math.min(f.year, f.since)) : null,
    mobility = mobilityOf(f),
    // (The years they changed: one decade of their working life at a time, a change at a keyed point in it.)
    changes: number[] = [];
  for (let d = 0; start + 10 * (d + 1) <= f.year && d < 12; d++)
    if (draw(10 + d) < mobility) changes.push(start + 10 * d + 3 + Math.floor(draw(30 + d) * 7));
  if (seatFrom !== null && seatFrom > start) {
    // (A seat is the last change; nothing changed after it.)
    while (changes.length && changes.at(-1)! >= seatFrom) changes.pop();
    changes.push(seatFrom);
  }
  // Back from now: each earlier work another of the land's.
  const works: number[] = [f.occupation];
  for (let k = changes.length - 1; k >= 0; k--) {
    const later = works[0]!,
      // (Before a seat at court or a throne, one of the few; else what the land does.)
      before =
        later === OCC.leader && seatFrom !== null && changes[k] === seatFrom
          ? f.standing >= 0.7 || draw(50 + k) < 0.4
            ? OCC.trader
            : (otherWork(f, later, draw(60 + k)) ?? later)
          : (otherWork(f, later, draw(60 + k)) ?? later);
    if (before === later) changes.splice(k, 1);
    else works.unshift(before);
  }
  const froms = [start, ...changes],
    // (Raised to it: those whose people keep to their kin's work, and the first.)
    raised = draw(70) < 0.35 + 0.3 * f.ways.kinship + 0.25 * f.ways.tradition;
  let carried = 0;
  return works.map((occupation, i) => {
    const from = froms[i]!,
      to = i + 1 < works.length ? froms[i + 1]! : null,
      years = (to ?? f.year) - from,
      // (Mastery of one work carries in part to the next.)
      rank = rankAt(years + carried, f.span);
    carried = 0.3 * (years + carried);
    let why: CareerWhy;
    if (i === 0) why = raised ? "raised" : "chance";
    else if (f.seated && i === works.length - 1) why = "seat";
    else {
      const was = DAY_WAGE[works[i - 1]!] ?? 1,
        now = DAY_WAGE[occupation] ?? 1;
      why =
        now < was && f.hardTimes > 0.2
          ? "want"
          : now > was && f.standing >= 0.6
            ? "kin"
            : now > was && f.traits.drive >= 0.55
              ? "skill"
              : "chance";
    }
    return { from, to, occupation, why, rank };
  });
}

// —— What they own and owe ——————————————————————————————————————————————————————————————————————————————————————

/** How a land's wealth lies among its households: a Pareto's tail, fatter the fewer it lies with. */
export function wealthTail(spread: number, caste: number): number {
  return dmath.clamp(1.15 + 2.6 * clamp01(spread) - 0.5 * clamp01(caste), 1.08, 4);
}

/**
 * What a household at `q` (0 the poorest … 1 the richest) holds against its land's mean a household: the slope of the land's
 * Lorenz curve there (1 − (1 − p)^(1 − 1/α)), whose mean over every household is 1. The richest two-hundredth are one band, each
 * holding that band's mean (a tail as fat as a few great houses' has no top household to hold all of it).
 */
export function shareAt(q: number, alpha: number): number {
  const a = Math.max(1.02, alpha),
    top = 0.995;
  return q < top ? (1 - 1 / a) * dmath.pow(1 - Math.max(0, q), -1 / a) : dmath.pow(1 - top, -1 / a);
}

/** The share of a land's wealth its richest tenth holds, by its tail. */
export function topTenth(alpha: number): number {
  const a = Math.max(1.02, alpha);
  return dmath.pow(0.1, 1 - 1 / a);
}

export type WealthFacts = {
  /** Their land's stores at usual worth, a head (in coin: a day's food), less what it owes; and what it owes the houses, a head. */
  readonly worthHead: number;
  readonly owedHead: number;
  /** Of every good of the land's stores, its worth a head (in coin). */
  readonly goods: readonly number[];
  /** How the realm's wealth is owned: among how many, how much the realm holds for all (rules/finance.ts); its people's rank. */
  readonly spread: number;
  readonly common: number;
  readonly caste: number;
  /** Their household's place, 0 … 1, its mouths, and whether they own their roof (by the land's law and their place). */
  readonly standing: number;
  readonly mouths: number;
  readonly ownsHome: boolean;
  /** What a home of theirs is worth (coin). */
  readonly homeWorth: number;
  /** Their household's day (coin): what is left after food and rent; and the rent they pay. */
  readonly left: number;
  readonly rent: number;
  /** One lived: their own purse, their own home (null: not lived). */
  readonly purse: number | null;
};

export type Holdings = {
  /** Their household's: its share of each good of the land's stores (coin), its roof, its coin. */
  readonly goods: readonly number[];
  readonly home: number;
  readonly coin: number;
  /** What it owes: its part of its land's debt to the houses, and what it has run short and not yet paid. */
  readonly debt: number;
  readonly arrears: number;
  /** What all of that comes to, less what it owes. */
  readonly net: number;
  /** Against its land's mean household (1: as the mean). */
  readonly against: number;
  /** What is held in common for everyone (a head), apart from their own. */
  readonly common: number;
  readonly alpha: number;
};

/** A lean season's days: what a household short every day runs up before a harvest or a better year. */
export const SHORT_DAYS = 90;
/** A good year's coin put by: the days of what is left a household keeps. */
export const KEPT_DAYS = 60;

export function holdingsOf(f: WealthFacts): Holdings {
  const alpha = wealthTail(f.spread, f.caste),
    against = shareAt(f.standing, alpha),
    own = (1 - clamp01(f.common)) * Math.max(1, f.mouths) * against,
    goods = f.goods.map((g) => Math.max(0, g) * own),
    home = f.ownsHome ? f.homeWorth : 0,
    coin = f.purse ?? Math.max(0, f.left) * KEPT_DAYS,
    // (What the land owes is owed by those who borrowed: half by the head, half by what each holds.)
    debt = Math.max(0, f.owedHead) * Math.max(1, f.mouths) * (0.5 + 0.5 * against),
    arrears = f.left < 0 ? -f.left * SHORT_DAYS : 0,
    held = goods.reduce((a, b) => a + b, 0) + home + coin;
  return {
    goods,
    home,
    coin,
    debt,
    arrears,
    net: held - debt - arrears,
    against,
    common: Math.max(0, f.worthHead) * clamp01(f.common),
    alpha,
  };
}

// —— What could lead them wrong ——————————————————————————————————————————————————————————————————————————————————

/** What one does against others or the law: takes, cheats, harms, defies. */
export const CRIME_KINDS = ["steal", "cheat", "harm", "defy"] as const;
export type CrimeKind = (typeof CRIME_KINDS)[number];
export const CRIME_WORDS: Readonly<Record<CrimeKind, string>> = {
  steal: "to take what isn't theirs",
  cheat: "to cheat on what they owe",
  harm: "to come to blows",
  defy: "to defy the rule",
};

/** Where they are, for what could lead them wrong (a town's year, as its court's record reads it). */
export type CrimeScene = {
  /** How hungry their land was, 0 … 1; whether a poor home there goes short. */
  readonly hungry: number;
  readonly short: boolean;
  /** How much lies to hand: a rich town, goods on the road, homes left open after war or fire, 0 … 1. */
  readonly opportunity: number;
  /** How far the law reaches there, 0 … 1 (a written law in a rightful realm's hand far; none, or a corrupt one, little). */
  readonly reach: number;
  /** How hard the rule is held against, 0 … 1 (grievance, a rule few hold rightful). */
  readonly grievance: number;
};

/** One person, for what could lead them wrong. */
export type CrimeSelf = {
  readonly traits: SelfTraits;
  /** Their household's place, 0 … 1. */
  readonly standing: number;
  /** How their food want and their faith want press (0 … 1). */
  readonly hunger: number;
  readonly faith: number;
};

/** How far each could lead them wrong, against one of their town whose every number is the middle (1). */
export function crimeLean(p: CrimeSelf, s: CrimeScene): Record<CrimeKind, number> {
  const t = p.traits,
    q = clamp01(p.standing),
    // (The poor feel a lean year and a short day first; the rich have the most to lose.)
    want = clamp01(s.hungry * (1.5 - q) + p.hunger) + (s.short ? 0.6 * (1 - q) : 0),
    held = 1.35 - t.conscience,
    law = 1.25 - 0.8 * clamp01(s.reach),
    lose = 1.15 - 0.6 * q,
    steal =
      (0.2 + 1.1 * want + 0.35 * t.drive) * held * (0.5 + clamp01(s.opportunity)) * law * lose,
    cheat = (0.2 + (s.short ? 0.6 : 0) * (1 - q) + 0.45 * t.drive) * held * law,
    harm =
      (0.15 + 0.9 * t.temper + 0.2 * t.boldness) * (1.3 - 0.6 * t.warmth) * (1.1 - 0.4 * s.reach),
    defy = (0.15 + 0.6 * t.boldness + 0.7 * clamp01(s.grievance) + 0.6 * p.faith) * (0.7 + 0.6 * q),
    // (One of their town whose every number is the middle.)
    mid = middleLean(s);
  return {
    steal: steal / mid.steal,
    cheat: cheat / mid.cheat,
    harm: harm / mid.harm,
    defy: defy / mid.defy,
  };
}

function middleLean(s: CrimeScene): Record<CrimeKind, number> {
  const want = clamp01(s.hungry) + (s.short ? 0.3 : 0),
    law = 1.25 - 0.8 * clamp01(s.reach);
  return {
    steal: (0.375 + 1.1 * want) * 0.85 * (0.5 + clamp01(s.opportunity)) * law * 0.85,
    cheat: (0.425 + (s.short ? 0.3 : 0)) * 0.85 * law,
    harm: 0.7 * (1.1 - 0.4 * s.reach),
    defy: 0.45 + 0.7 * clamp01(s.grievance),
  };
}

/** A lean in a word: how they stand beside the middle of their town. */
export function leanWord(x: number): string {
  return x >= 1.8
    ? "far more than most"
    : x >= 1.25
      ? "more than most"
      : x > 0.8
        ? "as most"
        : x > 0.5
          ? "less than most"
          : "far less than most";
}

// —— How a kind pairs ————————————————————————————————————————————————————————————————————————————————————————————

/**
 * How a kind pairs, read off its body and what its young need (asked of round C, "reproduction and kin by species"):
 *   for life: young that need years of care from two (an upright ape's carried a year and nursed two, grown at fifteen);
 *   a harem: young one parent can raise, of a big body that lives loosely, one holding several;
 *   for a season: young that need a little care (a clutch brooded a quarter-year), the pair parting when they can go;
 *   a brood: a hive, its young borne by one and raised by all;
 *   none: young left to the water (spawn), or that need no one.
 */
export const PAIRINGS = ["life", "harem", "season", "brood", "none"] as const;
export type Pairing = (typeof PAIRINGS)[number];

export const PAIRING_WORDS: Readonly<
  Record<Pairing, { name: string; line: string; heirs: string }>
> = {
  life: {
    name: "pairs for life",
    line: "Their young need years of care from two, so two raise them, and stay together.",
    heirs: "What they hold goes to their children.",
  },
  harem: {
    name: "one holds several",
    line: "One parent can raise their young, and the strongest of them keep several partners; most keep none.",
    heirs: "What they hold goes to the eldest of the strongest's young.",
  },
  season: {
    name: "pairs for a season",
    line: "Their young need care only until they can go, so a pair keeps together a season and parts.",
    heirs: "No one is heir by blood: what they hold goes back to those they work beside.",
  },
  brood: {
    name: "one bears for all",
    line: "One of them bears the young of all, and all of them raise the brood.",
    heirs:
      "Nothing is anyone's to leave: the hive keeps it, and the next who bears is raised by all.",
  },
  none: {
    name: "does not pair",
    line: "Their young are left to themselves from the first, so no one pairs and no one raises them.",
    heirs: "No one is heir by blood: what they hold goes back to those they work beside.",
  },
};

/** The lines of a town's roll that share a home and a family's name, by how its kind pairs (four, as upright apes live). */
export const HOME_LINES: Readonly<Record<Pairing, number>> = {
  life: 4,
  harem: 6,
  season: 3,
  brood: 12,
  none: 1,
};

/** The years a young holds its mother, carried and nursed or brooded, by how it is borne (an upright ape's three; a span's
 * worth): round C's own (rules/children.ts BEARING.holds), as the levy reads it. */
export const CARE_YEARS: Readonly<Record<string, number>> = BEARING.holds;

/** How much a kind's young need two raising them, 0 … 1 (an upright ape's near 1). */
export function twoNeeded(
  b: { readonly bearing: string; readonly young: number; readonly span: number } | null | undefined,
  adulthood: number,
): number {
  if (!b) return 0.92;
  const care = (CARE_YEARS[b.bearing] ?? 0) * (b.span / 70),
    // (Many at a birth is more to carry for one, one at a time the measure; long to grow up, the longer two are needed. Halved
    // at a single young, an upright ape of seventy years' span needed two by 0.46 and paired for a season, its homes three
    // lines where its towns draw four.)
    many = dmath.clamp(Math.max(1, b.young), 1, 3),
    long = dmath.clamp(adulthood / 15, 0.3, 2);
  return clamp01((care * long * many) / 3);
}

/** How a kind pairs (null body: an upright ape's). */
export function pairingOf(
  b:
    | {
        readonly bearing: string;
        readonly young: number;
        readonly span: number;
        readonly social: number;
        readonly size: number;
        readonly medium: string;
      }
    | null
    | undefined,
  adulthood: number,
): Pairing {
  if (!b) return "life";
  if (b.social >= 0.9 && b.size < 100 && b.medium !== "water") return "brood";
  if (b.bearing === "spawn") return "none";
  const two = twoNeeded(b, adulthood);
  if (two >= 0.5) return "life";
  if (two >= 0.12) return b.size >= 100 && b.social < 0.5 ? "harem" : "season";
  return "none";
}

/** How many partners one of a kind keeps now, by their pairing, their place and their draw (0 … 4). */
export function partnersOf(
  p: Pairing,
  grown: boolean,
  standing: number,
  draw: number,
  /** For life: whether they are wed (the keyed family says so). */
  wed: boolean,
): number {
  if (!grown) return 0;
  switch (p) {
    case "life":
      return wed ? 1 : 0;
    case "harem":
      // (The strongest few: the higher one stands, the likelier; and the more partners.)
      return draw < 0.15 + 0.5 * standing * standing
        ? 1 + Math.floor(standing * 3.5 * (0.6 + 0.4 * draw))
        : 0;
    case "season":
      // (A pair keeps together a season of the year: about a third of the grown are paired at any time.)
      return draw < 0.33 ? 1 : 0;
    default:
      return 0;
  }
}

/** The mouths of a household of their kind about one person, by their pairing, partners and young. */
export function householdOf(p: Pairing, partners: number, young: number): number {
  switch (p) {
    case "brood":
      // (A hive's cell: those who work and raise a brood together.)
      return 12;
    case "none":
      return 1;
    case "season":
      return 1 + partners + Math.min(young, 4);
    default:
      return 1 + partners + young;
  }
}
