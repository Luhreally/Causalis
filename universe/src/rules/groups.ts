// Groups (asked 2026-11-16, after cartels, the mafia, the Bloods and Crips and the Rampart crew each had to be asked for by name:
// "why did i have to explain this to you and the first principles didnt just emerge them itself"). Every institution so far was
// built as a system of its own; this is the general principle under them, collective action (Olson, Ostrom, Gambetta, Tilly):
//   - a group forms where people share a stake: a rent to capture, a threat to fend off, a good only many can give, or a belief or
//     an identity to keep;
//   - each member's gain must beat what organising costs him. That cost grows with the group's size and falls with what already
//     binds its people (kin, a shared people or faith, writing, deals that are kept, a focal leader), and a large group's common
//     gain is felt by each only as far as what it gives is his alone (selective incentives): a public good draws few, a private one
//     many;
//   - a group's kind is not chosen from a list: it is read from what it mostly does, its aims weighed by the stakes in its reach and
//     the means it holds. Twelve aims (prey, smuggle, guard, enforce, rule, aid, lend, trade, worship, hire, rebel, conspire) on land
//     or at sea, outlawed, let be or chartered, armed or not, of kin, a people, a faith, a trade or veterans: those preying on rich
//     sea trade where navies are weak are pirates, and privateers where a realm at war licenses them against its foe's ships; those
//     preying on roads the seat cannot reach are brigands; idle veterans whom a realm at war will pay are a free company, and the
//     same company unpaid turns to preying on the roads; a faith's people aggrieved under a seat that holds its temple make a sect,
//     and hidden where its faith is outlawed. A group's aims move each reckoning with the stakes, so a company becomes brigands and
//     a mutual-aid society a revolutionary circle without anyone naming the turn.
// What is built already is left to its own system, each a seam a later pass may fold in as a specialisation of this one: a realm's
// great families are its houses (rules/houses.ts); selling protection, smuggling cartels, street gangs and crews of the realm's own
// enforcers are the underworld's (rules/underworld.ts); crafts' guilds and workers' unions are labour's (rules/labour.ts); a faith's
// own temple is belief's (rules/temple.ts). No group here takes selling protection or smuggling as its first aim (either may be a
// second), and none is a guild, a union, a house or a temple.
// Pure tables and functions: no draws, nothing kept (sim/order/groups.ts keeps a realm's groups). Pages say what, who, cost and
// effect: never how any crime is done or any weapon used.
import { dmath } from "../kernel/index.ts";

const clamp01 = (x: number): number => dmath.clamp(x, 0, 1);

/** What a group can do: its aims. */
export const ORG_AIMS = [
  "prey",
  "smuggle",
  "guard",
  "enforce",
  "rule",
  "aid",
  "lend",
  "trade",
  "worship",
  "hire",
  "rebel",
  "conspire",
  // (Asked 2026-11-16 to close the gaps: seeking office by votes, a refuge held by those who fled, inquiry and the free word.)
  "office",
  "refuge",
  "inquire",
] as const;
export type OrgAim = (typeof ORG_AIMS)[number];
export const AIM = Object.fromEntries(ORG_AIMS.map((a, i) => [a, i])) as Readonly<
  Record<OrgAim, number>
>;

/** What binds a group's people before it forms. */
export const ORG_BASES = [
  "kin",
  "folk",
  "faith",
  "trade",
  "veterans",
  "learned",
  "poor",
  "fled",
  "interest",
] as const;
export type OrgBasis = (typeof ORG_BASES)[number];

/** How a realm holds a group: outlawed, let be, chartered (licensed, hired, granted its rights). */
export const ORG_STANDING = ["outlawed", "let be", "chartered"] as const;

/** How a group's hold ended. */
export const ORG_ENDS = ["crushed", "withered", "merged", "won", "fallen with its realm"] as const;
export type OrgEnd = (typeof ORG_ENDS)[number];

/**
 * The words a group's kind is told by, read off what it does (`orgKind`). Not a list of what may exist: each is a reading of an
 * aim on land or at sea, under a standing, of a basis, armed or not; a group's page tells its whole mix of aims.
 */
export const ORG_KINDS = [
  "brigands",
  "pirates",
  "privateers",
  "raiders",
  "smugglers",
  "militia",
  "vigilantes",
  "commune",
  "mutual-aid society",
  "confraternity",
  "brotherhood",
  "lending circle",
  "merchant league",
  "sect",
  "hidden sect",
  "free company",
  "sea company",
  "revolutionary circle",
  "insurgents",
  "resistance",
  "lodge",
  "party",
  "maroon community",
  "monastic order",
  "learned society",
] as const;
export type OrgKind = (typeof ORG_KINDS)[number];

/** The machinery's constants. */
export const ORG = {
  /**
   * A realm's groups are reckoned once in this many years, in its turn, stepped as many years at once (every rate is by the
   * years stepped). Two groups may rise in each `riseYears` of a reckoning's span, and one party. (Ten years was tried,
   * 2026-11-17: 4.6 ms a year at 1,500 where five is 7.6, the turn itself being the cost, some 160 µs a realm with no part
   * of it over a fifth; and first light's realms 137 at 1,000 and 217 at 1,500 where five gave 154 and more. Five stands.)
   */
  every: 5,
  riseYears: 5,
  /** The groups a realm keeps account of, their federations, the ended ones it remembers, a group's lands. */
  most: 8,
  feds: 2,
  gone: 4,
  lands: 4,
  /** The most groups of one first aim (the rest too small to be named). */
  ofAim: 3,
  /** The fewest members a group is. */
  crew: 12,
  /** Where organising begins to cost more for its size (members), and the cost a member a year there (working years) in a group
   * held together by nothing but the stake: meetings, dues, watching that others pay their part. */
  small: 40,
  cost: 0.05,
  /** What a plotter against the seat risks a year where its hand reaches wholly (working years): taken, his living lost. */
  hunted: 0.5,
  /** A full-timer's keep (working years a year: his living, his risk, his kit), as the underworld's crews are kept. */
  keep: 1.5,
  /** Of a realm's men skilled in violence and idle, the most its armed groups can take; of the rest, the share who join a cause. */
  recruit: 0.4,
  /** What a group spends a year of what it holds. */
  spends: 0.3,
  /** How fast a group's aims move toward the stakes in its reach, and its members toward what its stake keeps, a year. */
  turn: 0.2,
  grow: 0.35,
  /**
   * What a stake it does not yet serve is worth to a group against one it does: what it has built (its men's skills, its kit, its
   * name and its standing with those it serves) is for what it does, and must be built again for another (est: a quarter).
   */
  retool: 0.25,
  /** A second aim is told in its kind from this share of what it does, and kept there while it holds the lesser (thousandths). */
  second: 250,
  secondKept: 180,
  /** A group keeps its first aim while that is at least this share of what it now does most: it turns once, not back and forth. */
  firstKept: 0.67,
  /** Of a trade on roads or at sea within a preying group's reach, the most it can take a year (est: the Barbary corsairs and the
   * Caribbean's buccaneers at their height took a few in a hundred of the trade that passed; brigands on unpoliced roads as much). */
  catch: 0.05,
  /** The least of a road or a sea left unwatched that keeps a preying crew. */
  unwatched: 0.2,
  /** The most of a land's trade preying can take, all groups together. */
  takeMost: 0.15,
  /** Those a preying group kills a year, for each of its men (travellers, crews and guards, its own). */
  preyKills: 0.03,
  /** A group's man of an armed aim killed a year at the worst of its fighting. */
  fightKills: 0.02,
  /** What guarding and enforcing fill of a land's law (of what its courts leave undone), at the full. */
  fills: 0.3,
  /** What guarding takes off preying in the same land, at the full. */
  wards: 0.6,
  /** Of a land's deaths, the most a mutual-aid society spares (the sick nursed, the widow fed, the dead buried), and of its
   * roofless, the most it takes in. */
  spares: 0.04,
  shelters: 0.3,
  /** A free company's man is worth this many levied men in battle. */
  veteran: 1.5,
  /** The most a realm's hired strength adds to what it fields. */
  hiredMost: 0.25,
  /** What revolutionary groups add to the danger of a rising, at the full, and conspirators to a coup's. */
  rising: 0.25,
  plot: 0.15,
  /** Grievance a year in a sect's lands at the full, where its faith is pressed. */
  grievesSect: 0.02,
  /** How far a sect turns its lands' people from the seat's faith a year, at the full. */
  converts: 0.01,
  /** How far communes and brigands thin the seat's reach, at the full. */
  thins: 0.1,
  /** A realm cracks down on what it outlaws: the share of an outlawed group's men taken a year at a full crackdown. */
  taken: 0.15,
  /**
   * A group outlawed by name (a decree: the god's, its ruler's, its realm's own) has its realm's hand turned on it as far as the
   * realm reaches it and can act (its capacity by its seat's reach over the group's lands: sim/order/grouphand.ts namedBite): of
   * those its stakes would gather, this share at a full bite stay away for fear, and its crackdown takes of it at the least the
   * bite itself. An outlawing the realm cannot carry where the group is does little.
   */
  fears: 0.6,
  /** A federation forms of this many groups of one first aim. */
  fedOf: 2,
  /** How far a party's organisation holds its interest's votes to its own candidate, and adds to what is given him. */
  discipline: 0.3,
  turnout: 0.2,
  /** How far an organised interest weighs more in who the seat must pay. */
  partyWeighs: 0.5,
  /** How far a refuge's broken ground keeps its realm's hand off it. */
  hides: 0.7,
  /** How much more readily a land inquires where a learned society holds, and takes up what a land of another realm knows. */
  inquiry: 0.3,
  corresponds: 0.6,
  /** What a monastic order spares of its land's deaths, of what aid would. */
  cloisterSpares: 0.5,
} as const;

// —— What binds, and what organising costs ————————————————————————————————————————————————————————————————

/** What binds a group's people before it forms, each 0 … 1. */
export type OrgBinding = {
  /** How far its people count kin, and live among them. */
  readonly kin: number;
  /** One people, one faith among them (0: as mixed as can be). */
  readonly folk: number;
  readonly faith: number;
  /** Writing at hand (lists, dues, letters between towns). */
  readonly writing: number;
  /** How far deals are kept in its land. */
  readonly trust: number;
  /** A focal leader: a captain, a preacher, a house, an elder known to all. */
  readonly leader: number;
};

/** How much easier organising is for what already binds (1: nothing binds; at most some 4). */
export function cohesionOf(b: OrgBinding): number {
  return (
    1 +
    0.8 * clamp01(b.kin) +
    0.5 * clamp01(b.folk) +
    0.6 * clamp01(b.faith) +
    0.5 * clamp01(b.writing) +
    0.6 * clamp01(b.trust) +
    0.4 * clamp01(b.leader)
  );
}

/** What organising costs a member a year (working years) in a group of `n`: more as it grows, less as more binds it. */
export function organisingCost(n: number, cohesion: number): number {
  return (ORG.cost * dmath.sqrt(Math.max(1, n) / ORG.small)) / Math.max(1, cohesion);
}

/**
 * How far a member feels a group's gain as his own (0 … 1): what only members get (`selective`), and of the rest, his share of a
 * good all share, which is felt the less as the group is large (Olson). A small group feels its common gain; a large one only what
 * is its members' alone.
 */
export function feltGain(selective: number, n: number): number {
  const s = clamp01(selective);
  return s + (1 - s) * Math.min(1, ORG.small / Math.max(1, n));
}

/** How much of each aim's gain is its members' alone (loot, pay, a payout, a loan, a league's rights; a belief kept together). */
export const SELECTIVE: Readonly<Record<OrgAim, number>> = {
  prey: 1,
  smuggle: 1,
  guard: 0.25,
  enforce: 0.15,
  rule: 0.2,
  aid: 0.9,
  lend: 1,
  trade: 0.7,
  worship: 0.55,
  hire: 1,
  rebel: 0.1,
  conspire: 0.5,
  // (A party's offices and favours for its own; a refuge's freedom, its own; a society's standing, letters and the learned met.)
  office: 0.35,
  refuge: 1,
  inquire: 0.6,
};

/** Aims whose members live by them (kept from what the group takes) rather than giving their spare hours. */
export const FULL_TIME: ReadonlySet<OrgAim> = new Set(["prey", "smuggle", "hire"]);

/** Of those who share a stake, the share who would ever take part at the full (the rest at most give their name). */
export const ENGAGED: Readonly<Record<OrgAim, number>> = {
  prey: 1,
  smuggle: 1,
  hire: 1,
  guard: 0.12,
  enforce: 0.05,
  rule: 0.1,
  aid: 0.3,
  lend: 0.2,
  trade: 0.3,
  worship: 0.25,
  rebel: 0.04,
  conspire: 0.01,
  office: 0.05,
  refuge: 0.5,
  inquire: 0.5,
};

/**
 * The members a common stake gathers: of the `eligible` who share it (the engaged share at most), as many as make the most of what
 * its members gain together over what holding together costs them (each one's felt gain, working years a year from `perHead`,
 * falls as it grows and his part of organising rises), and none where even a crew would not gain. A public good so gathers a small
 * circle; a gain only members get, a great society.
 */
export function joinedOf(aim: OrgAim, perHead: number, eligible: number, cohesion: number): number {
  const most = Math.max(0, eligible) * ENGAGED[aim];
  if (!(perHead > 0) || most < ORG.crew) return 0;
  const s = clamp01(SELECTIVE[aim]),
    c = Math.max(1, cohesion);
  // (Sizes from a crew to its most, each a step of a quarter again: the best of them. The steps are the same for every stake, so
  // each one's root is taken once for all: SIZES.)
  let best = 0,
    at = 0;
  for (let i = 0; ; i++) {
    const step = i < SIZES.length ? SIZES[i]! : Infinity,
      last = step >= most,
      n = last ? most : step,
      root = last && step !== most ? dmath.sqrt(Math.max(1, n) / ORG.small) : ROOTS[i]!,
      x =
        n *
        (perHead * (s + (1 - s) * Math.min(1, ORG.small / Math.max(1, n))) - (ORG.cost * root) / c);
    if (x > best) {
      best = x;
      at = n;
    }
    if (last) break;
  }
  return best > 0 ? at : 0;
}

/** The sizes joinedOf tries (a crew, and each a quarter again up to more than any land holds), and each one's organisingCost root. */
const SIZES: readonly number[] = (() => {
  const out: number[] = [];
  for (let n: number = ORG.crew; n < 1e15; n *= 1.25) out.push(n);
  return out;
})();
const ROOTS: readonly number[] = SIZES.map((n) => dmath.sqrt(Math.max(1, n) / ORG.small));

/**
 * The men a rent keeps full-time (`take`, grain's worth a year, at a wage of `wage`): each costs his keep and his part of
 * organising; at most the pool there is to take them from.
 */
export function crewOf(take: number, wage: number, cohesion: number, pool: number): number {
  if (!(take > 0) || !(wage > 0)) return 0;
  const first = take / (wage * ORG.keep),
    each = wage * (ORG.keep + organisingCost(first, cohesion));
  return Math.max(0, Math.min(take / each, Math.max(0, pool)));
}

// —— What each aim is worth ——————————————————————————————————————————————————————————————————————————————

/**
 * What preying can take of a trade (grain's worth a year): the trade in its reach, as far as no one guards it, and as far as those
 * who would take it are not hunted down by the same guards (a road watched nineteen parts in twenty leaves a twentieth unwatched,
 * and the crew that works it is caught nineteen times in twenty: preying on policed roads is worth next to nothing).
 */
export function preyTake(trade: number, guarded: number): number {
  const open = 1 - clamp01(guarded);
  // (Watched more than four parts in five, a road or a sea keeps no crew at all: each is taken within a season or two, and in a
  // land of millions the little left unwatched would else keep a named band in every one.)
  if (open < ORG.unwatched) return 0;
  return Math.max(0, trade) * ORG.catch * open * open;
}

/** How far a sea trade is guarded: a navy's ships against the trade they must cover, and its havens' reach. */
export function seaGuarded(navy: number, needed: number, reach: number): number {
  const cover = needed > 0 ? clamp01(navy / needed) : 1;
  return clamp01(0.75 * cover + 0.25 * clamp01(reach));
}

/** How far roads are guarded: the seat's reach in a land, and a militia or a league that rides with its carts. */
export function roadGuarded(reach: number, warded: number): number {
  return clamp01(clamp01(reach) * 0.85 + 0.15 + clamp01(warded) * ORG.wards);
}

/**
 * What a realm at war will pay for soldiers it cannot levy (grain's worth a year): the men short of what its foes field, at a
 * soldier's keep, as far as its treasury has it.
 */
export function hirePay(short: number, wage: number, purse: number): number {
  return Math.max(0, Math.min(Math.max(0, short) * wage * ORG.keep, Math.max(0, purse) * 0.3));
}

/**
 * What a household gains a year from a common fund against death, sickness and the street (working years): the risk it carries
 * of losing a grown worker's years, of falling ill, of losing its roof, less what the seat and kin already give.
 */
export function aidWorth(f: {
  deaths: number;
  sick: number;
  roofless: number;
  care: number;
  kin: number;
}): number {
  const risk = 8 * Math.max(0, f.deaths) + 0.5 * Math.max(0, f.sick) + 2 * Math.max(0, f.roofless);
  return risk * (1 - 0.7 * clamp01(f.care)) * (1 - 0.5 * clamp01(f.kin));
}

/** What a threat to fend off is worth a household a year (working years): what is taken from it, and the share killed. */
export function guardWorth(taken: number, killed: number, reach: number): number {
  return (Math.max(0, taken) + 20 * Math.max(0, killed)) * (1 - 0.7 * clamp01(reach));
}

/** What holding to the law where courts do not is worth (working years a household): wrongs left unjudged. */
export function enforceWorth(
  killed: number,
  wrongs: number,
  courts: number,
  deals: number,
): number {
  return (
    (30 * Math.max(0, killed) + 0.2 * clamp01(wrongs)) *
    (1 - clamp01(courts)) *
    (0.5 + 0.5 * (1 - clamp01(deals)))
  );
}

/** What ruling itself is worth a town far from its seat (working years a household): order the seat does not bring, its own dues kept. */
export function ruleWorth(reach: number, town: number, taxed: number): number {
  const big = clamp01(Math.max(0, town) / 20000);
  return (1 - clamp01(reach)) * big * (0.15 + 0.5 * clamp01(taxed));
}

/** What a loan where none lends is worth (working years a household): the want of credit, less what lenders already give. */
export function lendWorth(credit: number, poor: number, trust: number): number {
  return 0.12 * (1 - clamp01(credit)) * (0.3 + clamp01(poor)) * (0.4 + 0.6 * clamp01(trust));
}

/** What a merchants' league is worth a merchant (working years): safe passage and rights its seat cannot give, among many towns. */
export function tradeWorth(trade: number, earned: number, reach: number, towns: number): number {
  const rich = earned > 0 ? clamp01(trade / earned) : 0;
  return rich * (1 - 0.8 * clamp01(reach)) * clamp01(Math.max(0, towns - 1) / 4) * 0.6;
}

/**
 * What keeping a faith together against its seat is worth (working years a household): its people's grievance, as far as the seat
 * holds another faith or holds its temple, more where the faith is outlawed and must be kept in secret.
 */
export function worshipWorth(grievance: number, pressed: number, piety: number): number {
  return clamp01(grievance) * clamp01(pressed) * (0.3 + clamp01(piety)) * 0.4;
}

/**
 * What a rising is worth those who would rise (working years a household): their grievance, as far as the seat is doubted and
 * gives no voice, and harder where it holds its arms close; a foreign hand holding the land the more.
 */
export function rebelWorth(f: {
  grievance: number;
  doubt: number;
  voice: number;
  force: number;
  occupied: number;
}): number {
  const g = clamp01(f.grievance),
    shut = 1 - clamp01(f.voice);
  return (
    (g * (0.3 + clamp01(f.doubt)) * shut * (0.6 + 0.6 * clamp01(f.force)) +
      0.8 * clamp01(f.occupied) * (0.3 + g)) *
    0.5
  );
}

/**
 * What keeping a secret against the seat is worth its few (working years): standing kept from them (no voice, offices closed), word
 * that cannot move, ideas the seat forbids; the more where those few have the learning to meet in writing.
 */
export function conspireWorth(f: {
  shut: number;
  word: number;
  ideas: number;
  doubt: number;
}): number {
  return (
    clamp01(f.shut) *
    (1 - clamp01(f.word)) *
    (0.3 + clamp01(f.ideas)) *
    (0.4 + clamp01(f.doubt)) *
    1.5
  );
}

// —— Means, and what a group does with them ——————————————————————————————————————————————————————————————

/** What a group holds: men under arms, ships, a purse, a faith held in common, secrecy (bits). */
export const MEANS = ["arms", "ships", "purse", "faith", "secret"] as const;
export const meansBit = (m: (typeof MEANS)[number]): number => 1 << MEANS.indexOf(m);

/** How far each aim can be served by what a group holds (1: wholly; an aim none of its means serves is out of its reach). */
const FIT: Readonly<Record<OrgAim, readonly (typeof MEANS)[number][]>> = {
  prey: ["arms", "ships"],
  smuggle: ["ships", "purse", "secret"],
  guard: ["arms"],
  enforce: ["arms", "secret"],
  rule: ["arms", "purse"],
  aid: ["purse", "faith"],
  lend: ["purse"],
  trade: ["purse", "ships"],
  worship: ["faith", "secret"],
  hire: ["arms", "ships"],
  rebel: ["arms", "secret", "faith"],
  conspire: ["secret", "purse"],
  office: ["purse"],
  refuge: ["arms", "secret"],
  inquire: ["purse", "secret"],
};

/** How far a group's means reach an aim (none where none of them serves it: a group turns to an aim only as it comes to its means). */
export function aimFit(aim: OrgAim, means: number): number {
  let n = 0;
  for (const m of FIT[aim]) if (means & meansBit(m)) n++;
  return n === 0 ? 0 : Math.min(1, 0.6 + 0.4 * (n - 1));
}

/**
 * A group's aims, moved toward the stakes in its reach (`worth`, each aim's value to it, grain's worth a year) as its means fit
 * them: the aims it had stay in part (what a group does is a habit), the rest go to what pays. In thousandths, summing to 1000.
 */
export function aimsToward(
  had: readonly number[],
  worth: readonly number[],
  means: number,
  pace: number,
): number[] {
  // (A stake it serves pulls in full; one it does not yet, at what its means are worth turned to it: ORG.retool.)
  const want = ORG_AIMS.map(
      (a, i) =>
        Math.max(0, worth[i] ?? 0) *
        aimFit(a, means) *
        (ORG.retool + (1 - ORG.retool) * Math.min(1, (had[i] ?? 0) / 1000 / 0.25)),
    ),
    all = want.reduce((s, x) => s + x, 0),
    p = clamp01(pace);
  const out = ORG_AIMS.map((_, i) => {
    const h = (had[i] ?? 0) / 1000,
      w = all > 0 ? want[i]! / all : h;
    return h + (w - h) * p;
  });
  const sum = out.reduce((s, x) => s + x, 0) || 1;
  return out.map((x) => Math.round((x / sum) * 1000));
}

/** A group's first aim, kept while it does it near as much as what it now does most (ORG.firstKept). */
export function keptFirstAim(aims: readonly number[], had: number): OrgAim {
  const now = firstAim(aims),
    h = ORG_AIMS[had];
  if (!h || h === now || h === "smuggle") return now;
  return (aims[had] ?? 0) >= ORG.firstKept * (aims[AIM[now]] ?? 0) ? h : now;
}

/** A group's first aim: the one it does most (never selling protection or smuggling, the underworld's, while another is held). */
export function firstAim(aims: readonly number[]): OrgAim {
  let best = -1,
    at = AIM.aid;
  for (const [i, a] of ORG_AIMS.entries()) {
    if (a === "smuggle") continue;
    const w = aims[i] ?? 0;
    if (w > best) {
      best = w;
      at = i;
    }
  }
  return best > 0 || !((aims[AIM.smuggle] ?? 0) > 0) ? ORG_AIMS[at]! : "smuggle";
}

/** What a group's kind is told by, read off what it does and holds. */
export type OrgKindFacts = {
  readonly aim: OrgAim;
  /** Its second aim (thousandths), for a group that does two things nearly as much. */
  readonly second: OrgAim | null;
  readonly sea: boolean;
  readonly armed: boolean;
  readonly standing: number;
  readonly basis: OrgBasis;
  /** A realm at war pays or licenses it against its foe. */
  readonly patron: boolean;
  /** The land it rises in is held by a foreign hand. */
  readonly occupied: boolean;
  /** Its faith is its seat's own, kept apart under a rule of its own on a land it holds. */
  readonly cloister?: boolean;
};

/** A group's kind, read off what it does (see ORG_KINDS: each a reading, not a choice). */
export function orgKind(f: OrgKindFacts): OrgKind {
  switch (f.aim) {
    case "prey":
      return f.sea ? (f.patron ? "privateers" : "pirates") : f.patron ? "raiders" : "brigands";
    case "smuggle":
      return "smugglers";
    case "guard":
      return f.second === "rule" ? "commune" : "militia";
    case "enforce":
      return "vigilantes";
    case "rule":
      return "commune";
    case "aid":
      return f.basis === "faith"
        ? "confraternity"
        : f.standing === 0 || f.second === "conspire"
          ? "brotherhood"
          : "mutual-aid society";
    case "lend":
      return "lending circle";
    case "trade":
      return "merchant league";
    case "worship":
      // (A faith's own people withdrawn to keep it under a rule of their own, not pressed by their seat: an order.)
      return f.cloister ? "monastic order" : f.standing === 0 ? "hidden sect" : "sect";
    case "hire":
      return f.sea ? "sea company" : "free company";
    case "rebel":
      return f.occupied ? "resistance" : f.armed ? "insurgents" : "revolutionary circle";
    case "conspire":
      return "lodge";
    case "office":
      return "party";
    case "refuge":
      return "maroon community";
    case "inquire":
      return f.standing === 0 ? "lodge" : "learned society";
  }
}

/** Whether a realm would outlaw a group of this aim (what preys, rises or plots against it; a faith it presses). */
export function outlawedAim(aim: OrgAim, pressed: boolean): boolean {
  return (
    aim === "prey" ||
    aim === "smuggle" ||
    aim === "rebel" ||
    aim === "conspire" ||
    aim === "refuge" ||
    (aim === "worship" && pressed)
  );
}

/**
 * What a party is worth to those of an interest who would carry it (working years a household): its people's say in who governs,
 * as wide as voice is and as great as their sway, where no great house speaks for them already.
 */
export function officeWorth(voice: number, sway: number, spoken: boolean): number {
  return spoken ? 0 : 0.25 * clamp01(voice) * clamp01(sway * 3);
}

/**
 * What a refuge is worth those who would flee to it (working years a head): the bondage or the law fled, as far as the land is
 * hard to reach (broken ground, far from its seat, beyond its reach) and holds no war.
 */
export function refugeWorth(bound: number, hunted: number, hard: number, war: boolean): number {
  return (2 * clamp01(bound) + clamp01(hunted)) * clamp01(hard) * (war ? 0.3 : 1) * 0.6;
}

/** How hard a land is to reach from its seat (0 … 1): its broken ground (metres of relief), how far it lies, how little its seat reaches it. */
export function hardToReach(relief: number, steps: number, reach: number): number {
  return clamp01(
    0.45 * clamp01(Math.max(0, relief) / 600) +
      0.3 * clamp01(Math.max(0, steps) / 6) +
      0.25 * (1 - clamp01(reach)),
  );
}

/**
 * What withdrawing to keep a faith under a rule of its own is worth its devout (working years a household): their piety, as far
 * as its temple teaches and has clergy to send, where land lies open or far.
 */
export function cloisterWorth(piety: number, teaching: number, room: number): number {
  const p = clamp01(piety);
  return 0.12 * p * p * (0.3 + clamp01(teaching)) * clamp01(room);
}

/** What a society of the learned is worth one of them (working years): inquiry shared, letters between towns, the free word. */
export function inquireWorth(word: number, writing: number, ideas: number): number {
  return writing > 0 ? 0.3 * (0.3 + clamp01(word)) * (0.6 + 0.4 * clamp01(ideas)) : 0;
}

/** How hard a realm turns on the groups it outlaws (0 … 1): its reach and standing, against the harm they do. */
export function suppressionOf(capacity: number, legitimacy: number, harm: number): number {
  return clamp01(clamp01(capacity) * (0.4 + clamp01(legitimacy)) * (0.2 + clamp01(harm * 4)));
}

/** The chance a group's leader dies or falls within `span` years (`yearly`, his own year's chance), or is taken by a crackdown. */
export function leaderLost(yearly: number, crackdown: number, span: number): number {
  const a = clamp01(yearly + 0.06 * clamp01(crackdown));
  return 1 - dmath.pow(1 - a, Math.max(1, span));
}
