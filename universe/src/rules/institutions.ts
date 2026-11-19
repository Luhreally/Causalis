// Institutions (asked 2026-11-18: "why does this feel like a neverending process, why can't first principles just emerge it
// all"). Firms, a watch, courts, clergy, guilds, unions, schools, papers and underwriters were each a number or a page's words,
// and each would have been one more kind added by hand. They are one thing: people organised to do something others want, kept
// by whoever pays for it. So an organised body is told by a small basis, and nothing else is listed:
//   - what it DOES (INST_DOES): the want it serves or the rent it takes;
//   - who FUNDS it (INST_FUNDS): its members' dues, its customers, the seat's treasury, a great house's patronage, a faith's
//     tithes, plunder;
//   - whom it ANSWERS to, which follows from who pays (answersTo): members, owners, the seat, a house, a faith, no one;
//   - how its realm holds it (ORG_STANDING: outlawed and so hidden, let be, chartered).
// One rule forms them all (rules below, sim/order/institutions.ts): a thing is wanted in a land as far as its want goes unmet
// there (`need`, grain's worth a year, read off the world's own rows); each who could pay for it can pay so much (`pay`, by
// INST_FUNDS); the payer who can pay most keeps it, and so decides whom it answers to; it stands where what is paid keeps the
// fewest hands the work takes at that age (writing, coin, deals kept, readers, a town great enough), and is as large as the pay.
// A firm is "makes and sells a good, paid by its customers, answers to its owners"; a watch "keeps order, paid by the treasury,
// answers to the seat"; a guild "governs a trade, paid by dues, answers to its members"; none is written as a case: the words
// (instTitle) are read off the basis for the pages only. The groups that came before (rules/groups.ts: 25 kinds off 15 aims) and
// the underworld's three kinds are the same basis read from the other side, where the members themselves are the payers
// (basisOfAim, basisOfCrime).
// Pure tables and functions: no draws, nothing kept. Pages say what, who, cost and effect: never how.
import { dmath } from "../kernel/index.ts";
import type { OrgAim, OrgBasis } from "./groups.ts";

const clamp01 = (x: number): number => dmath.clamp(x, 0, 1);

/** What an organised body does. The first ten are formed by the rule here; the rest are read off the older groups. */
export const INST_DOES = [
  "make",
  "craft",
  "bargain",
  "order",
  "judge",
  "teach",
  "heal",
  "worship",
  "word",
  "insure",
  // (Read off what the groups and the underworld already keep: rules/groups.ts aims, rules/underworld.ts kinds.)
  "carry",
  "fight",
  "lend",
  "aid",
  "take",
  "deal",
  "govern",
  "rise",
] as const;
export type InstDoes = (typeof INST_DOES)[number];
export const DOES = Object.fromEntries(INST_DOES.map((a, i) => [a, i])) as Readonly<
  Record<InstDoes, number>
>;
/** How many of them the rule here forms (the first of INST_DOES). */
export const INST_FORMED = 10;

/** Who pays for it. */
export const INST_FUNDS = ["dues", "customers", "treasury", "patron", "tithes", "plunder"] as const;
export type InstFund = (typeof INST_FUNDS)[number];
export const FUND = Object.fromEntries(INST_FUNDS.map((a, i) => [a, i])) as Readonly<
  Record<InstFund, number>
>;

/** Whom it answers to. */
export const INST_ANSWERS = ["members", "owners", "seat", "house", "faith", "no one"] as const;
export type InstAnswers = (typeof INST_ANSWERS)[number];
export const ANSWERS = Object.fromEntries(INST_ANSWERS.map((a, i) => [a, i])) as Readonly<
  Record<InstAnswers, number>
>;

/** A body's basis: all that tells what it is. `standing` by ORG_STANDING (0 outlawed and hidden, 1 let be, 2 chartered). */
export type Basis = {
  readonly does: InstDoes;
  readonly fund: InstFund;
  readonly answers: InstAnswers;
  readonly standing: number;
};

/** Whom a body answers to: whoever pays for it. */
export function answersTo(fund: InstFund): InstAnswers {
  switch (fund) {
    case "dues":
      return "members";
    case "customers":
      return "owners";
    case "treasury":
      return "seat";
    case "patron":
      return "house";
    case "tithes":
      return "faith";
    case "plunder":
      return "no one";
  }
}

/** How a body's hold ended. */
export const INST_ENDS = [
  "failed",
  "withered",
  "suppressed",
  "taken over",
  "merged",
  "lost with its land",
] as const;
export type InstEnd = (typeof INST_ENDS)[number];

/**
 * What each thing done takes, whoever does it: the fewest hands that can do it at all (`least`), a hand's keep against a
 * working year (`keep`: a judge, a scholar and a printer cost more than a watchman), the least town that holds it, what its
 * land must have (writing; coin; deals kept, of 1; readers, of 1), which payers there are for it and how readily each pays
 * (`funds`, 0 … 1 of what they could), how far being large makes it cheaper (`scale`: 0 none; a works under one roof much, a
 * priest none), the most of one kind a realm keeps account of and the most in one land, and the building that houses it.
 * A table of what work is, not of what may exist: no row names a firm, a guild or a paper.
 */
export type DoesRow = {
  readonly least: number;
  readonly keep: number;
  readonly town: number;
  readonly writing: boolean;
  readonly coin: boolean;
  readonly deals: number;
  readonly readers: number;
  readonly funds: Readonly<Partial<Record<InstFund, number>>>;
  readonly scale: number;
  readonly most: number;
  readonly aLand: number;
  readonly place: string;
};
export const DOES_ROWS: Readonly<Record<InstDoes, DoesRow>> = {
  // (Making under one roof for sale: capital laid out before anything is sold, so coin and deals that are kept.)
  make: row(30, 1.2, 4000, true, true, 0.45, 0, { customers: 1, treasury: 0.3 }, 1, 3, 2, "works"),
  // (A trade governed by its own: a roll kept. The seat's leave and the gain are in what its crafters would win, read from
  // rules/labour.ts organised.)
  craft: row(20, 0.15, 2000, true, false, 0, 0, { dues: 1 }, 0, 2, 1, "hall"),
  bargain: row(40, 0.1, 4000, false, false, 0, 0.1, { dues: 1 }, 0.3, 2, 1, "works"),
  // (Order kept for pay. Where no treasury pays, those threatened keep their own: the groups' militia and vigilantes.)
  order: row(12, 1.2, 1500, false, false, 0, 0, { treasury: 1 }, 0.2, 2, 1, "watch"),
  judge: row(4, 3, 2000, true, false, 0, 0, { treasury: 1, tithes: 0.5 }, 0, 2, 1, "court"),
  teach: row(
    6,
    2,
    1500,
    true,
    false,
    0,
    0,
    { tithes: 0.8, treasury: 0.6, patron: 0.7, customers: 1 },
    0.3,
    2,
    1,
    "school",
  ),
  heal: row(
    6,
    2,
    3000,
    true,
    false,
    0,
    0,
    { tithes: 0.7, treasury: 0.8, customers: 1 },
    0.3,
    1,
    1,
    "hospital",
  ),
  worship: row(8, 1.2, 0, false, false, 0, 0, { tithes: 1 }, 0, 2, 1, "temple"),
  // (Word carried for those who read it: readers enough, in a town great enough to have news.)
  word: row(
    5,
    2,
    5000,
    true,
    true,
    0,
    0.12,
    { customers: 1, patron: 0.6 },
    0.6,
    3,
    2,
    "print-house",
  ),
  insure: row(5, 3, 5000, true, true, 0.55, 0, { customers: 1 }, 0.5, 1, 1, "hall"),
  // (The rest are not formed here: the groups' and the underworld's.)
  carry: row(12, 1.2, 0, false, false, 0, 0, { customers: 1 }, 0.5, 0, 0, "docks"),
  fight: row(12, 1.5, 0, false, false, 0, 0, { treasury: 1, plunder: 1 }, 0.2, 0, 0, "camp"),
  lend: row(12, 0.1, 0, false, false, 0, 0, { dues: 1, customers: 1 }, 0.2, 0, 0, "hall"),
  aid: row(12, 0.1, 0, false, false, 0, 0, { dues: 1 }, 0, 0, 0, "hall"),
  take: row(12, 1.5, 0, false, false, 0, 0, { plunder: 1 }, 0, 0, 0, "camp"),
  deal: row(12, 1.5, 0, false, false, 0, 0, { customers: 1 }, 0.3, 0, 0, "docks"),
  govern: row(12, 0.1, 0, false, false, 0, 0, { dues: 1 }, 0, 0, 0, "hall"),
  rise: row(12, 0.1, 0, false, false, 0, 0, { dues: 1, patron: 1 }, 0, 0, 0, "hall"),
};
function row(
  least: number,
  keep: number,
  town: number,
  writing: boolean,
  coin: boolean,
  deals: number,
  readers: number,
  funds: Partial<Record<InstFund, number>>,
  scale: number,
  most: number,
  aLand: number,
  place: string,
): DoesRow {
  return { least, keep, town, writing, coin, deals, readers, funds, scale, most, aLand, place };
}

/** The machinery's constants. */
export const INST = {
  /**
   * A realm's bodies are reckoned once in this many years, in its turn (a year after its groups), stepped as many at once: a
   * body's affairs are settled over years (five was tried: twice the system's year for the same bodies).
   */
  every: 10,
  /** The bodies a realm keeps account of (the rest too small to be named), the ended ones it remembers, a body's lands. */
  most: 14,
  gone: 4,
  lands: 3,
  /** How many may be founded in each five years of a reckoning's span. */
  rise: 2,
  riseYears: 5,
  /** How fast a body's hands move toward what its pay keeps, a year; what it spends a year of what it holds. */
  grow: 0.3,
  spends: 0.3,
  /** A body whose pay keeps fewer than this share of the fewest hands its work takes withers. */
  withers: 0.5,
  /** One of two that do the same in one land is taken over when its part falls under this share of the other's. */
  takenUnder: 0.3,
  /** A body may part in two at a head's passing when it is this many times the fewest hands, by this chance. */
  partsAt: 12,
  parts: 0.25,
  /** Of what a land's crafts sell, the margin a works' owners keep at the full (the rest is its hands' and its stock's). */
  margin: 0.1,
  /** How much more a hand makes under one roof at the full, before engines and with them (Smith's pins; the mill's floor). */
  roof: 0.04,
  roofEngines: 0.08,
  /** Of a land's crafters, the most its works hold before engines, and with them. */
  worksMost: 0.25,
  worksEngines: 0.7,
  /** What a governed trade adds to how far its crafters ask as one, at the full; how far it keeps a works out of its land. */
  governs: 0.3,
  resists: 0.6,
  /** A strike: the least of a land's crafters organised that can stop its works; the most of a year's work it costs them; the
   * share of their trade's rent it wins where it is not broken; the most ever won so; how fast what was won wears a year. */
  strikeLeast: 0.15,
  strikeCosts: 0.3,
  strikeWins: 0.04,
  wonMost: 0.12,
  wonFades: 0.03,
  /** Of what its treasury spends on its clerks, the part that keeps order, and the part that judges. */
  orderOf: 0.35,
  judgeOf: 0.1,
  /** Watchmen a thousand people a full watch keeps; judges and clerks a hundred thousand a full court keeps. */
  watchFull: 2,
  courtFull: 20,
  /** What an honest, full watch adds to its seat's reach over its lands, and a bought one takes. */
  reach: 0.04,
  /** How far a watch guards its land's roads, at the full (as a militia's guard does: rules/groups.ts roadGuarded). */
  guards: 0.5,
  /** Of what a land's courts leave undone, what a full, honest watch and court hold to; what bought judges lose of deals kept. */
  fills: 0.15,
  bought: 0.08,
  /** Those a full court holds a year, of each hundred thousand of its land, where its law keeps them and does not kill or fine. */
  held: 150,
  /** How much more readily a land with a house of higher learning inquires (as a learned society: ORG.inquiry). */
  inquiry: 0.25,
  /** How much further a land's healing reaches for a house of healing, at the full. */
  heals: 0.25,
  /** Of a land's deaths, the most alms and a common fund against loss spare (within the groups' ORG.spares). */
  spares: 0.008,
  /** What free voices that answer to their readers take from a seat's standing, at the full of its lands' grievance; what a
   * voice kept by a house near the seat adds. */
  tells: 0.04,
  praises: 0.015,
  /** A seat shuts the voices it does not keep where its word is less free than this; and seizes a works where its risk of
   * seizure is over this (society law, rules/holding.ts seizureRisk). */
  shuts: 0.25,
  seizes: 0.6,
} as const;

// —— The rule ————————————————————————————————————————————————————————————————————————————————————————————

/** What a land has that a body may need to exist: at that age and place. */
export type InstGround = {
  readonly writing: boolean;
  readonly coin: boolean;
  /** How far deals are kept (0 … 1), how many read (0 … 1), its market town (heads). */
  readonly deals: number;
  readonly readers: number;
  readonly town: number;
};

/** Whether a thing done can be kept as a body in a land at all, at its age. */
export function canStand(does: InstDoes, g: InstGround): boolean {
  const r = DOES_ROWS[does];
  return (
    (!r.writing || g.writing) &&
    (!r.coin || g.coin) &&
    g.deals >= r.deals &&
    g.readers >= r.readers &&
    g.town >= r.town
  );
}

/**
 * Who keeps a thing done in a land: of those who could pay (`pay`, grain's worth a year each could give, by INST_FUNDS), the one
 * whose pay, as readily as that payer gives for such work, is most. Null where no one pays.
 */
export function funderOf(
  does: InstDoes,
  pay: readonly number[],
): { fund: InstFund; pays: number } | null {
  const funds = DOES_ROWS[does].funds;
  let best: InstFund | null = null,
    most = 0;
  for (const [i, f] of INST_FUNDS.entries()) {
    const x = Math.max(0, pay[i] ?? 0) * (funds[f] ?? 0);
    if (x > most) {
      most = x;
      best = f;
    }
  }
  return best ? { fund: best, pays: most } : null;
}

/**
 * The hands a pay keeps (`pays`, grain's worth a year, at a working year of `wage`): each costs the work's keep, the less as
 * the body is large where its work gains by size (`scale`: a tenth off for each tenfold over its fewest, at the full).
 */
export function staffKept(does: InstDoes, pays: number, wage: number): number {
  const r = DOES_ROWS[does];
  if (!(pays > 0) || !(wage > 0)) return 0;
  const first = pays / (wage * r.keep),
    cheaper = first > r.least ? 1 - 0.1 * r.scale * Math.min(3, dmath.log10(first / r.least)) : 1;
  return first / cheaper;
}

/** How far a body is honest (0 … 1): its hands paid a living, a seat not itself for sale, someone who watches it, none who buy it. */
export function honestyOf(f: {
  /** What each of its hands is paid against a working year (1: a worker's year). */
  paid: number;
  corruption: number;
  /** Who can call it to account: written law, a voice for the governed, a free word (0 … 1). */
  oversight: number;
  /** How far its realm's officers are already bought (the underworld's collusion, 0 … 1). */
  bought: number;
}): number {
  const fed = clamp01(f.paid / 1.2);
  return clamp01(
    (0.25 + 0.75 * fed) *
      (1 - 0.6 * clamp01(f.corruption)) *
      (0.6 + 0.4 * clamp01(f.oversight)) *
      (1 - 0.7 * clamp01(f.bought)),
  );
}

/**
 * Whether a land's organised workers strike, and how hard (0: no; else the share of a year's work lost, at most
 * INST.strikeCosts): what they earn has fallen behind what it was or what a tiller earns (`lag`, 0 … 1), they are many enough
 * of its crafters to stop its works (`organised`), and their fund can keep them out.
 */
export function walkoutOf(f: { lag: number; organised: number; fund: number }): number {
  if (f.organised < INST.strikeLeast || f.lag < 0.1) return 0;
  return (
    INST.strikeCosts *
    clamp01(f.organised / 0.5) *
    clamp01(f.lag / 0.3) *
    (0.5 + 0.5 * clamp01(f.fund))
  );
}

/** Whether a strike is won (the works give) or broken: the seat's arms against it, its voice for it, how long its fund holds. */
export function walkoutWon(force: number, voice: number, fund: number): number {
  return clamp01(0.35 + 0.4 * clamp01(voice) - 0.45 * clamp01(force) + 0.3 * clamp01(fund));
}

/** How much more a land's crafters make for the part of them under a works' roof (1: none). */
export function roofGain(share: number, engines: boolean): number {
  return 1 + (engines ? INST.roofEngines : INST.roof) * clamp01(share);
}

// —— The words, read off the basis (pages only) ——————————————————————————————————————————————————————————

/** What each thing done is, said plainly: "it …". */
export const DOES_WORDS: Readonly<Record<InstDoes, string>> = {
  make: "makes and sells",
  craft: "governs a trade",
  bargain: "bargains for its workers' wages",
  order: "keeps order",
  judge: "judges",
  teach: "teaches and inquires",
  heal: "heals the sick",
  worship: "keeps worship and its rites",
  word: "carries word",
  insure: "shares out risk",
  carry: "carries goods and people",
  fight: "fights for pay",
  lend: "lends",
  aid: "cares for its own",
  take: "takes from others",
  deal: "carries what is forbidden",
  govern: "rules itself",
  rise: "seeks the seat",
};
/** A question a land's page asks of each: "Who … here". */
export const DOES_ASKS: Readonly<Record<InstDoes, string>> = {
  make: "Who makes its goods",
  craft: "Who governs its trades",
  bargain: "Who speaks for its workers",
  order: "Who keeps order",
  judge: "Who judges",
  teach: "Who teaches",
  heal: "Who heals",
  worship: "Who keeps its rites",
  word: "Who carries word",
  insure: "Who shares its risks",
  carry: "Who carries",
  fight: "Who fights for pay",
  lend: "Who lends",
  aid: "Who cares for its own",
  take: "Who preys on it",
  deal: "Who carries what is forbidden",
  govern: "Who rules themselves",
  rise: "Who seeks the seat",
};
export const FUND_WORDS: Readonly<Record<InstFund, string>> = {
  dues: "its members' dues",
  customers: "those who buy of it",
  treasury: "the seat's treasury",
  patron: "a great house's purse",
  tithes: "its faith's tithes",
  plunder: "what it takes",
};
export const ANSWERS_WORDS: Readonly<Record<InstAnswers, string>> = {
  members: "its members",
  owners: "its owners",
  seat: "the seat",
  house: "the house that keeps it",
  faith: "its faith",
  "no one": "no one",
};

/** What tells a body's title beside its basis: how large, at what age, of what. */
export type TitleFacts = {
  /** Its hands; whether its land writes, has engines, sends word by wire or air; how many read (0 … 1). */
  readonly staff: number;
  readonly writing: boolean;
  readonly engines: boolean;
  readonly signal: boolean;
  readonly readers: number;
  /** What it makes or whose trade it governs (a good's name, or ""); whether it inquires (a house of higher learning). */
  readonly of: string;
  readonly higher: boolean;
};

/**
 * A body's title, read off its basis: display only (nothing forms, acts or ends by these words). The same thing done is a
 * different word by who pays and how large: order kept for the treasury is a watch, and a constabulary once clerks keep its
 * rolls; teaching kept by tithes is a temple school, by a house a college, by its pupils a school, and a university where it
 * inquires and is large.
 */
export function instTitle(b: Basis, f: TitleFacts): string {
  const big = f.staff >= 10 * DOES_ROWS[b.does].least,
    of = f.of ? `${f.of} ` : "";
  switch (b.does) {
    case "make":
      return b.answers === "seat"
        ? `state ${of}works`
        : b.answers === "members"
          ? `${of}cooperative`
          : f.engines
            ? big
              ? `${of}company`
              : `${of}works`
            : big
              ? `${of}manufactory`
              : `${of}workshop`;
    case "craft":
      return b.standing === 2 ? `chartered ${of}guild` : `${of}guild`;
    case "bargain":
      return b.standing === 0
        ? "workers' combination"
        : f.engines
          ? `${of}workers' union`
          : `${of}journeymen's association`;
    case "order":
      return b.answers !== "seat"
        ? "guard"
        : f.writing && big
          ? f.engines
            ? "police"
            : "constabulary"
          : "watch";
    case "judge":
      return b.answers === "faith"
        ? "temple court"
        : b.answers === "members"
          ? "moot"
          : f.writing && big
            ? "courts of law"
            : "court";
    case "teach":
      return f.higher
        ? big
          ? "university"
          : b.answers === "house"
            ? "college"
            : "academy"
        : b.answers === "faith"
          ? "temple school"
          : b.answers === "seat"
            ? "public school"
            : b.answers === "house"
              ? "endowed school"
              : "school";
    case "heal":
      return b.answers === "faith"
        ? "hospice"
        : b.answers === "seat"
          ? "public hospital"
          : "physicians' hall";
    case "worship":
      return b.answers === "seat" ? "state clergy" : big ? "priesthood" : "clergy";
    case "word":
      return b.standing === 0
        ? "underground press"
        : f.signal
          ? b.answers === "house"
            ? "house broadcaster"
            : "news service"
          : f.engines
            ? b.answers === "house"
              ? "house paper"
              : "newspaper"
            : b.answers === "house"
              ? "house newsletter"
              : f.readers >= 0.3
                ? "gazette"
                : "newsletter";
    case "insure":
      return b.answers === "members" ? "mutual fund" : "underwriters";
    case "carry":
      return "carriers";
    case "fight":
      return "free company";
    case "lend":
      return b.answers === "members" ? "lending circle" : "bank";
    case "aid":
      return "mutual-aid society";
    case "take":
      return "band";
    case "deal":
      return "ring";
    case "govern":
      return "commune";
    case "rise":
      return "circle";
  }
}

/** A body's basis said in one line: what it does, who pays, whom it answers to. */
export function basisWords(b: Basis, of = ""): string {
  const does = b.does === "make" && of ? `${DOES_WORDS.make} ${of}` : DOES_WORDS[b.does];
  return `It ${does}, is kept by ${FUND_WORDS[b.fund]} and answers to ${ANSWERS_WORDS[b.answers]}.`;
}

// —— The older groups in the same basis ——————————————————————————————————————————————————————————————————

/**
 * A group of the older layer (rules/groups.ts) in this basis: what its first aim does, who pays (a rent taken is plunder; pay
 * from a realm, its treasury; a faith's own, its tithes; the rest its members' dues), and so whom it answers to. Its kind's
 * word stays the groups' own (orgKind); this only says the same thing in the general terms.
 */
export function basisOfAim(
  aim: OrgAim,
  f: { standing: number; patron: boolean; basis: OrgBasis; house?: boolean },
): Basis {
  const does: InstDoes =
      aim === "prey"
        ? f.patron
          ? "fight"
          : "take"
        : aim === "smuggle"
          ? "deal"
          : aim === "guard" || aim === "enforce"
            ? "order"
            : aim === "rule" || aim === "refuge"
              ? "govern"
              : aim === "aid"
                ? "aid"
                : aim === "lend"
                  ? "lend"
                  : aim === "trade"
                    ? "craft"
                    : aim === "worship"
                      ? "worship"
                      : aim === "hire"
                        ? "fight"
                        : aim === "inquire"
                          ? "teach"
                          : "rise",
    fund: InstFund =
      aim === "hire" || (aim === "prey" && f.patron)
        ? "treasury"
        : aim === "prey"
          ? "plunder"
          : aim === "smuggle"
            ? "customers"
            : aim === "office" && f.house
              ? "patron"
              : aim === "worship" && f.basis === "faith" && f.standing === 2
                ? "tithes"
                : "dues";
  // (A company answers to itself, whoever pays it this year: unpaid, it turns on the roads.)
  const answers: InstAnswers = aim === "hire" ? "no one" : answersTo(fund);
  return { does, fund, answers, standing: f.standing };
}

/** A crime group of the underworld (rules/underworld.ts GROUP_KINDS) in this basis. */
export function basisOfCrime(kind: "protection" | "cartel" | "badge"): Basis {
  return kind === "cartel"
    ? { does: "deal", fund: "customers", answers: "no one", standing: 0 }
    : kind === "badge"
      ? // (The seat's own, turned to its own account: paid by the treasury and by what it takes, answering to no one.)
        { does: "order", fund: "plunder", answers: "no one", standing: 0 }
      : { does: "order", fund: "plunder", answers: "no one", standing: 0 };
}
