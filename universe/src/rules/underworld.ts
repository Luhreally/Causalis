// The underworld (asked 2026-11-16: "do like modern day violent mexican cartels ever emerge or have the first principles to emerge?
// italian mob type things?", then street gangs and police gangs). Organised crime is not a kind of people: it is a firm that sells
// what the state does not, or forbids, and it rises wherever that is worth selling and there are men to sell it. Each rule here says
// what an incentive does; a realm's own numbers (how safe its holdings are and how far its deals are kept, the trade worth guarding,
// what it forbids and what that does to a price, its reach and its officers' price, its idle young men and the veterans of its last
// war, its towns' poor quarters) say how it plays out. Four roads, one set of principles:
//   - protection (Gambetta, Varese): where property is unsafe and deals are not held to, those who trade will pay for someone to hold
//     them, and men skilled in violence and idle (a levy come home from a war, the young poor) can sell it. A protector takes a cut,
//     settles disputes and enforces the deals the courts do not; it gains those it protects a little where there are no courts, and
//     taxes them everywhere;
//   - smuggling rent (the economics of prohibition): a ban makes a price wedge, and the wedge times the volume is a rent. It is taken
//     where the realm's reach is weak and its officers can be bought, most of all on a border with a rich market that bans;
//   - the street (Thrasher, Sampson, Wilson): many young men, few legal openings, weak informal control (kin broken, families without
//     a roof, newcomers), quarters set apart by speech or faith, and a police that reaches little make small gangs of a neighbourhood,
//     living on the retail of what is forbidden and petty theft; they ally into federations against a rival bloc, mostly along identity;
//   - the badge (Rampart): a crackdown given licence because results are demanded, under weak oversight (little voice, no free word,
//     courts that are the seat's), with a rich rent within reach (what is seized, the street market, protection from their own
//     crackdown) turns its enforcers into a crew of their own: a shakedown crew, or where the seat wants results and answers to no one,
//     a death squad.
// Violence follows structure: a valuable rent held by two or more close in strength is fought over (a turf war); one dominant group,
// or a pact with the state, keeps the peace (the pax mafiosa); a boss taken by a crackdown leaves rival successors. The state answers
// by its reach, its standing and the voice of the harmed, or colludes where its officers are bought; ending a ban ends the rent.
// Pure tables and functions: no draws, nothing kept (sim/order/underworld.ts keeps a realm's underworld). Pages say what, who, cost
// and effect: never how any crime is done.
import { dmath } from "../kernel/index.ts";
import type { LifeHistory } from "./species.ts";

const clamp01 = (x: number): number => dmath.clamp(x, 0, 1);

/** The kinds of crime group a realm keeps account of. */
export const GROUP_KINDS = ["protection", "cartel", "badge"] as const;
export type GroupKind = (typeof GROUP_KINDS)[number];

/** What a group lives on (bits of a group's `rackets`). */
export const RACKETS = [
  "protection",
  "smuggling",
  "extortion",
  "kidnapping",
  "theft",
  "shakedown",
  "killing",
] as const;
export type Racket = (typeof RACKETS)[number];
export const racketBit = (r: Racket): number => 1 << RACKETS.indexOf(r);

/** How a group's hold ended. */
export const GROUP_ENDS = [
  "crushed",
  "withered",
  "absorbed",
  "split",
  "exposed",
  "fallen with its realm",
  "disarmed",
  // (Its war lost, its lands and the men it had left gone to the victor; broken by soldiers that had taken its boss.)
  "taken over",
  "put down",
] as const;
export type GroupEnd = (typeof GROUP_ENDS)[number];

/** The machinery's constants. */
export const UNDER = {
  /** A realm's underworld is reckoned once in this many years, in its turn, stepped as many years at once. */
  every: 5,
  /** The groups a realm keeps account of, the federations, the ended ones it remembers, a group's lands, the wars it remembers. */
  most: 6,
  feds: 3,
  gone: 4,
  lands: 8,
  wars: 4,
  /** The most groups of one road (the rest are too small to be named). */
  ofRoad: 3,
  /** What a protector takes of a protected trade's worth (est: the pizzo, 2–10% of a shop's takings in Palermo). */
  cut: 0.06,
  /**
   * What an unguarded trade loses where nothing at all is held, to theft, seizure and deals broken (est: a quarter of its worth). A
   * trader pays a protector's cut only where what unsafety would take of him is more: where holdings are safe and deals held, no cut
   * is worth paying and no protector has a market.
   */
  lost: 0.25,
  /**
   * How what the seat leaves uncovered turns into a protector's custom: a deal is left to a protector where the seat's officers and
   * courts reach neither of its two parties, so the share of dealings that want one goes as the uncovered share to this power (2:
   * the two parties reached each on their own). Where the seat covers four deals in five, one in twenty-five is left; where it
   * covers a third, nearly half.
   */
  neither: 2,
  /** A protection group rises where the pull (want of protection times men to sell it) reaches this. */
  riseProtect: 0.05,
  /**
   * A smuggling group rises where the rent taken reaches this share of what its people earn (est: one part in two thousand,
   * which keeps some twenty men in 100,000 of its people at UNDER.keep: the American mob at its height under a strong state,
   * some five thousand sworn and their associates in 180 million. It stood at four in a thousand, 150 men in 100,000, the
   * density of Sicily's or Mexico's at their worst, as the least a cartel could be: set while tools no one used were carried
   * over every border and the rent of slipping past a tariff came to more than all its people earned in the median realm that
   * had one. Of honest trade that rent is a few parts in ten thousand, and no realm of first light reached the old line.)
   */
  riseRent: 0.0005,
  /** The fewest men a group is: a rent that cannot keep so many keeps no group. */
  crew: 20,
  /** A group's man costs this many of a working man's years a year (his keep, his risk, his arms). */
  keep: 1.6,
  /** How much dearer a man is to keep where the crackdown bites in full: a hunted man is paid for his risk of the cell or the
   * grave, and a group that cannot pay it loses him (est: several times his keep). */
  hunted: 3,
  /** A road's groups wither where its pull falls below this share of the line at which one would rise. */
  withers: 0.5,
  /** The most of what its treasury takes in that a realm spends on a crackdown: past it, it is given up as far as it cannot be paid. */
  afford: 0.1,
  /** Of a realm's men who are skilled in violence and idle, the most a group can recruit. */
  recruit: 0.5,
  /** What a group spends a year of what it holds (its keep, its bribes, its show). */
  spends: 0.25,
  /** How fast shares of a rent move toward each group's strength, a year. */
  pace: 0.25,
  /**
   * Of a group's men, the share killed a year in an open turf war, and at peace (est: Mexico 2007–2020, some 20 to 30 thousand
   * killed a year among perhaps 150 thousand in the cartels and their rivals; Sicily's second mafia war, some 1,000 dead among a
   * few thousand men of honour over three years).
   */
  killWar: 0.08,
  killPeace: 0.004,
  /** The most of a land's people its underworld kills in a year (five in a thousand: several times the worst city's year on record). */
  killMost: 0.005,
  /**
   * The most of its own lands' people a group's men come to be (est: two in a hundred; the Sicilian mafia's sworn men were about
   * one in a thousand of the island, a city's gangs at their worst one or two in a hundred of it): its men are of the people
   * where it holds, whatever the rent it takes there would keep.
   */
  thick: 0.02,
  /** The most rivals a group's men each fight at once in a war (a small group among great ones is not killed many times over a year). */
  warMost: 3,
  /** Others killed for each of a group's men killed (bystanders, police, those who would not pay). */
  bystanders: 0.6,
  /** A turf war is told from this much, and its end below the second. */
  /** A war fought on halves in these years; a peace made wears off by half in these. */
  warHalf: 5,
  paxHalf: 25,
  /**
   * How much of a road's strength must have changed hands since a peace for that peace to be as worn as its years alone would
   * have it (a fifth; est, no source: a peace divides a rent by what each could take of it, and it is a side grown or shrunk
   * past what it was dealt, or one that was no party to it, that breaks it).
   */
  shifted: 0.2,
  /**
   * How far a seat that hunts a road's groups cuts their war short: so much off the years it halves in, at the full (est: the
   * second war of Sicily's mafia, ended within three years by the arrests that led to the great trial; Mexico's roads, fought for
   * fifteen years and more where the state's hand does not reach).
   */
  cutShort: 0.6,
  warAt: 0.3,
  warEnds: 0.12,
  /**
   * A war is lost by the side whose men, or whose weight on its road, have fallen under this part of the other's: it is taken over, its lands and the men it
   * has left the victor's (est, no source: a clear margin; the Sicilian second war's losers were a few hundred against the
   * Corleonesi's alliance of thousands when their families were dissolved or given new heads).
   */
  beaten: 0.5,
  /**
   * Of what a road's war would kill at the same strain, the share its feuds kill while it is not at war: quarrels over a rent are
   * settled or bought off until one side breaks the peace (est: Mexico's killings tied to its cartels, some one to two thousand a
   * year under the old pacts against fifteen thousand and more once the roads were fought for).
   */
  feud: 0.15,
  /** A group falls from the named below this weight among its road's groups. */
  least: 0.05,
  /** The most of a boss's chance of being taken a year at a full crackdown (est: Mexico's kingpin strategy took some two dozen of 37 named in six years). */
  decap: 0.15,
  /** A group holding this share of its kind's rent in its realm (thousandths) rules its trade: its boss taken is a thing the
   * chronicle keeps (at first light's 1500, one group in eight). */
  great: 500,
  /** Of a group's men a full crackdown takes a year (arrested, killed, turned). */
  arrests: 0.12,
  /** What a full crackdown costs a year for each of the groups' men it faces, in working men's years (police, courts, prisons). */
  crackCost: 1.2,
  /** How far collusion takes the edge off a crackdown, and what of the groups' income goes to officers and judges. */
  bribes: 0.2,
  /** How much a corrupt pact with the state cools a turf war. */
  pax: 0.7,
  /** How far a crackdown that bites makes a road's groups keep their quarrels below the killing that draws it (est: Cosa Nostra's
   * "submersion" after the maxi-trial: Palermo's killings fell some tenfold while its rackets went on). */
  lowered: 0.8,
  /** How far a seat's reach alone, with no crackdown, has a road's groups answer for their killing as a crackdown would. */
  answered: 0.5,
  /** How far protection gains a trade's deals kept where courts are absent, and what extortion takes of a holding's safety. */
  enforces: 0.25,
  extorts: 0.6,
  /** Grievance a year in a land: so many times the share of its people killed a year, and the share of its trade extorted. */
  grievesKilling: 40,
  grievesExtortion: 0.25,
  /** What open killing in a realm's lands takes of its standing: a hundredth of this for each killing a year in a thousand of its people, at most `standingMost`. */
  standingKilling: 30,
  standingMost: 0.2,
  /** What a badge crew found out takes of its realm's standing, fading over `scandalYears`. */
  scandal: 0.15,
  scandalYears: 12,
  /** Street gangs: a town has poor quarters from this many people; one small gang for so many young men at the full pull. */
  town: 2000,
  gangOf: 120,
  /** A town's gangs fight by how many they are to this many of its people (ten and more to it: at the worst). */
  fightTown: 20000,
  /** A federation forms where a realm's towns hold this many gangs of one identity; it reaches a town with this many. */
  fedForm: 8,
  fedTown: 2,
  /** The fewest towns with so many gangs that a federation binds. */
  fedTowns: 2,
  /** Of the young in a town's gangs, the share killed a year at the worst (est: the worst of Chicago's and Los Angeles' gang years). */
  streetKill: 0.01,
  /** Of a town's gangs' young, the share jailed a year by a court that jails, at full reach. */
  jailed: 0.08,
  /**
   * What a seat's reach is worth against those outside the law where it keeps a watch (sim/order/institutions.ts): with one
   * unmanned or wholly bought, this part of it; with one full and honest, this much more. Where it keeps none, its reach as it is.
   */
  watchLeast: 0.7,
  watchGives: 0.55,
  /** How far a crooked watch adds to what its officers are bought for, and to how readily its enforcers turn to their own. */
  crookedBuys: 0.5,
  crookedTurns: 1,
  /** How far a town's killings keep newcomers from it. */
  deters: 6,
} as const;

// —— Who wants protection, and who can sell it ————————————————————————————————————————————————————————————

/**
 * What passes a land's shops and stalls in a year (grain's worth): all it uses that is not food, the food of those who do not
 * grow, herd or gather their own (`growers`: the share of its workers who do), and what it sells on to other lands. It is what a
 * protector's cut is a cut of, and what makes a land's people traders with something to guard. (What its markets send and take
 * across its borders is not it: that counts a good each time it moves and nothing that is made and sold in one town. Read so,
 * with half of all that moved for "trade", a world of unsold tools carried from land to land had three times what its people
 * earned passing its stalls, and an honest one a seventh.)
 */
export function takings(f: {
  readonly food: number;
  readonly other: number;
  readonly sentOn: number;
  readonly growers: number;
}): number {
  return (
    Math.max(0, f.other) + Math.max(0, f.food) * (1 - clamp01(f.growers)) + Math.max(0, f.sentOn)
  );
}

/** What a realm's traders and holders want of private protection (0 … 1). */
export type ProtectionFacts = {
  /** How safe a holding is from its ruler and from others (society's law row), and how far a deal is held to (0 … 1). */
  readonly secure: number;
  readonly deals: number;
  /** What passes its shops and stalls (`takings`), and what its people earn (grain's worth a year). */
  readonly trade: number;
  readonly earned: number;
  /** How far its seat reaches its lands (0 … 1). */
  readonly capacity: number;
};

/**
 * The want of private protection (0 … 1): as far as holdings are unsafe and deals not held past the point where a protector's cut is
 * worth paying (what unsafety would take, UNDER.lost of a trade at the worst, against UNDER.cut), among those who have a trade worth
 * guarding, and only as far as the seat's own reach does not supply it: a protector sells what the state does not, and where its
 * officers and courts reach every land there is nothing left to sell (Gambetta: the mafia as the trade in a protection the state fails
 * to give).
 */
export function protectionWanted(f: ProtectionFacts): number {
  const unsafe = 1 - (0.5 * clamp01(f.secure) + 0.5 * clamp01(f.deals)),
    pays = UNDER.cut / UNDER.lost,
    paid = clamp01((unsafe - pays) / (1 - pays)),
    rich = f.trade > 0 ? clamp01((2 * f.trade) / (f.trade + Math.max(1, f.earned))) : 0;
  return clamp01(paid * (0.3 + 0.7 * rich) * dmath.pow(1 - clamp01(f.capacity), UNDER.neither));
}

/** What one land's traders and holders want of private protection: its realm's law, and what is the land's own. */
export type LandProtectionFacts = ProtectionFacts & {
  /** How far the seat reaches this land (0 … 1), how far its officers are bought, how far its rule is held rightful. */
  readonly reach: number;
  readonly corruption: number;
  readonly legitimacy: number;
  /** How far this land counts the seat's people its own (0 … 1), and how far it is held against its will (0 … 1). */
  readonly kin: number;
  readonly occupied: number;
  /** Of what is traded there, the share the law forbids: its deals no court will hold. */
  readonly illegal: number;
};

/**
 * The want of private protection in one land (0 … 1). Of its lawful trade: as far as holdings are unsafe and deals not held past
 * where a protector's cut is worth paying, and only as far as the seat does not supply it there: its reach in that land, as far as
 * its courts are trusted (not bought, its rule held rightful, the land's people counted its own and not held down). Of its forbidden
 * trade, all of it: no court holds a deal in what the law forbids, however far the seat reaches (Gambetta; Reuter on illegal
 * markets).
 */
export function protectionWantedIn(f: LandProtectionFacts): number {
  const unsafe = 1 - (0.5 * clamp01(f.secure) + 0.5 * clamp01(f.deals)),
    pays = UNDER.cut / UNDER.lost,
    paid = clamp01((unsafe - pays) / (1 - pays)),
    rich = f.trade > 0 ? clamp01((2 * f.trade) / (f.trade + Math.max(1, f.earned))) : 0,
    trust =
      (1 - clamp01(f.corruption)) *
      (0.5 + 0.5 * clamp01(f.legitimacy)) *
      (0.5 + 0.5 * clamp01(f.kin)) *
      (1 - clamp01(f.occupied)),
    lawful = paid * (0.3 + 0.7 * rich) * dmath.pow(1 - clamp01(f.reach) * trust, UNDER.neither),
    illegal = clamp01(f.illegal);
  return clamp01(lawful * (1 - illegal) + illegal);
}

/** Who could sell it: the men of a realm skilled in violence and idle, each a share of its people. */
export type ViolentFacts = {
  /** Veterans of a war ended in the last few years, come home with nothing to go to. */
  readonly veterans: number;
  /** Its young men, its crafts idle (0 … 1), its poorest fifth's want (0 … 1: 0 where they hold a fifth of all). */
  readonly young: number;
  readonly idle: number;
  readonly poor: number;
  /** Those on the street. */
  readonly street: number;
};

/** The pool of men skilled in violence and idle (a share of its people), and how ready the supply is (0 … 1). */
export function violentIdle(f: ViolentFacts): { pool: number; supply: number } {
  const pool =
    Math.max(0, f.veterans) +
    Math.max(0, f.young) * clamp01(0.5 * clamp01(f.idle) + 0.5 * clamp01(f.poor)) +
    0.3 * Math.max(0, f.street);
  return { pool, supply: clamp01(pool * 12) };
}

// —— The rent of what is forbidden ————————————————————————————————————————————————————————————————————————

/**
 * The rent a ban makes (grain's worth a year): what its users pay, of which the risk's part is the wedge over what it would cost
 * allowed. `risk` is how much dearer a ban makes it at full (sim/money/intox.ts RISK).
 */
export function banRent(worth: number, barred: number, risk: number): number {
  const b = clamp01(barred);
  return Math.max(0, worth) * ((risk * b) / (1 + risk * b));
}

/** The share of a rent those outside the law can take: where the seat's reach is weak and its officers can be bought. */
export function rentCaptured(capacity: number, corruption: number): number {
  return clamp01((1 - clamp01(capacity)) * (0.35 + clamp01(corruption)) * 1.2);
}

// —— Violence from structure ——————————————————————————————————————————————————————————————————————————————

/**
 * How hard a road's groups fight over its rent (0 … 1): by how close the two greatest are (a duopoly or a fragmented market fights;
 * one dominant does not), less a pact with the state, and less the more a crackdown bites (they keep below the killing that draws it). Its concentration (Herfindahl) is given back.
 */
export function turfWar(
  shares: readonly number[],
  pact: number,
  hunted = 0,
): { war: number; herfindahl: number } {
  const s = [...shares].filter((x) => x > 0).sort((a, b) => b - a),
    all = s.reduce((a, x) => a + x, 0);
  if (s.length < 2 || all <= 0) return { war: 0, herfindahl: s.length ? 1 : 0 };
  const n = s.map((x) => x / all),
    h = n.reduce((a, x) => a + x * x, 0),
    close = n[1]! / n[0]!;
  return {
    war: clamp01(
      close *
        (1 - h) *
        2.4 *
        (1 - UNDER.pax * clamp01(pact)) *
        (1 - UNDER.lowered * clamp01(hunted)),
    ),
    herfindahl: h,
  };
}

/**
 * How far a road's groups are hunted for their killing (0 … 1): by a crackdown as it bites, and, short of one, by a seat whose
 * hand and courts reach its towns (a killing answered is bad business: where the law reaches, quarrels are settled or bought off,
 * and it is where no one answers for the dead that roads are fought over in the open). Half as far as a crackdown would.
 */
export function huntedFor(bites: number, reach: number): number {
  const b = clamp01(bites);
  return b + (1 - b) * UNDER.answered * clamp01(reach);
}

/**
 * A town's newcomers (0 … 1), of those it holds beyond its trades and their kin (`draw` times them, rules/urban.ts): those still
 * coming, as far as it draws more than it holds; a town come to what it draws holds their children, who are its own, and only
 * the fifth of them that any town's comings and goings are.
 */
export function newcomersOf(draw: number, target: number): number {
  if (!(draw > 1)) return 0;
  const beyond = (draw - 1) / (draw + 1),
    coming = clamp01(0.2 + 4 * Math.max(0, target / draw - 1));
  return clamp01(beyond * coming);
}

/**
 * Of a beaten group's men, those its victor takes and the rest: the victor's men come to no more than `room` (UNDER.thick of
 * the people of the lands it holds with those it takes), and what the beaten has past that is not the victor's to keep.
 * The rest make a group of their own where they are a crew's worth (UNDER.crew), and scatter where fewer (the sim's to say).
 */
export function takeoverMen(
  victor: number,
  beaten: number,
  room: number,
): { taken: number; rest: number } {
  const had = Math.max(0, Math.round(beaten)),
    taken = Math.max(0, Math.min(had, Math.round(room) - Math.round(victor)));
  return { taken, rest: had - taken };
}

/**
 * How far a road's strength has changed hands between two reckonings of its groups' shares of it (0 … 1; each a list of a group
 * and its share in thousandths): half of all the shares have moved by, a group in one list alone by its whole share.
 */
export function balanceMoved(
  then: readonly (readonly [number, number])[],
  now: readonly (readonly [number, number])[],
): number {
  let moved = 0;
  for (const [id, share] of now)
    moved += Math.abs(share - (then.find((x) => x[0] === id)?.[1] ?? 0));
  for (const [id, share] of then) if (!now.some((x) => x[0] === id)) moved += share;
  return clamp01(moved / 2000);
}

/**
 * How far a road's peace has worn (0: just made, or nothing changed since; 1: gone): a peace is a rent divided at the strength
 * each side was found to have, by the war it ended. The years wear it (UNDER.paxHalf: those who made it go, those who come
 * were not at the war), but only as far as the strength it was made on has moved since (`moved`, balanceMoved, full at
 * UNDER.shifted): a side grown past its part, one shrunk below what it holds, one that was no party to it. Groups that stand
 * as they stood have nothing to learn from fighting again.
 */
export function peaceWorn(years: number, moved: number): number {
  return (1 - dmath.pow(0.5, Math.max(0, years) / UNDER.paxHalf)) * clamp01(moved / UNDER.shifted);
}

/**
 * Of a war's heat at the start of `years`, its mean over them as it tires by half every `half` years (0 … 1): what a war
 * reckoned once for those years is fought at through them.
 */
export function tiringOver(half: number, years: number): number {
  if (!(half > 0) || !(years > 0)) return 1;
  return (half / (years * Math.LN2)) * (1 - dmath.pow(0.5, years / half));
}

/** The men a road's groups lose a year, and the others they kill, for their men and how hard they fight. */
export function killingsOf(members: number, war: number): number {
  return (
    Math.max(0, members) * (UNDER.killPeace + UNDER.killWar * clamp01(war)) * (1 + UNDER.bystanders)
  );
}

// —— The state's answer ———————————————————————————————————————————————————————————————————————————————————

export type CrackdownFacts = {
  readonly capacity: number;
  readonly legitimacy: number;
  /** How far its people are heard and word moves (0 … 1). */
  readonly voice: number;
  readonly word: number;
  /** The harm done: killings a year in a thousand of its people, and the share of its trade extorted. */
  readonly killings: number;
  readonly extortion: number;
  /** How far its officers are bought by the groups (0 … 1). */
  readonly collusion: number;
};

/** How hard a realm cracks down (0 … 1): by its reach and its standing, as far as the harmed are heard, less what is bought off. */
export function crackdownOf(f: CrackdownFacts): number {
  const harmed = clamp01(2 * f.killings + 2 * f.extortion),
    heard = 0.25 + clamp01(f.voice) + 0.5 * clamp01(f.word);
  return clamp01(
    clamp01(f.capacity) *
      (0.4 + clamp01(f.legitimacy)) *
      (0.15 + harmed * heard) *
      (1 - 0.8 * clamp01(f.collusion)),
  );
}

/**
 * How far a realm's officers and judges are bought (0 … 1): where they are bought already, the more the groups have to pay them
 * with (their income against the treasury's), less where word would tell of it; a great house that shelters a group the more.
 */
export function collusionOf(
  corruption: number,
  paying: number,
  word: number,
  house: boolean,
): number {
  return clamp01(
    clamp01(corruption) * 1.6 * (0.3 + clamp01(paying * 3)) * (1 - 0.5 * clamp01(word)) +
      (house ? 0.1 : 0),
  );
}

/** The chance a boss is taken within `span` years: by the crackdown, less where a house or the officers shelter the group. */
export function bossTaken(crackdown: number, sheltered: number, span: number): number {
  const a = UNDER.decap * clamp01(crackdown) * (1 - 0.7 * clamp01(sheltered));
  return 1 - dmath.pow(1 - a, Math.max(1, span));
}

/** How many rival successors a taken boss leaves, for a group's men and a draw u (0 … 1): a large group splits into more. */
export function successorsOf(members: number, u: number): number {
  const most = members >= 600 ? 3 : members >= 150 ? 2 : 1;
  return 1 + Math.floor(clamp01(u) * most);
}

// —— The street ———————————————————————————————————————————————————————————————————————————————————————————

export type StreetFacts = {
  /** Its young men, a share of the town's people. */
  readonly young: number;
  /** Its crafts idle, its poorest fifth's want (0 … 1). */
  readonly idle: number;
  readonly poor: number;
  /** Its people on the street, the share who came from elsewhere, how far its quarters are set apart by speech or faith. */
  readonly street: number;
  readonly newcomers: number;
  readonly apart: number;
  /** How far its police reach, how far its elders, temple and kin hold sway (0 … 1). */
  readonly reach: number;
  readonly informal: number;
  /** Who need what they take, a share of its people (the street's market). */
  readonly dependent: number;
};

/** The pull of the street (0 … 1): young men without openings, beyond the hold of kin and police, in quarters set apart. */
export function streetPull(f: StreetFacts): number {
  const young = clamp01(f.young / 0.09),
    openings = 0.2 + 0.5 * clamp01(f.idle) + 0.5 * clamp01(f.poor),
    loose = 0.3 + 2 * clamp01(f.street) + clamp01(f.newcomers) + clamp01(f.apart),
    market = 1 + 4 * clamp01(f.dependent);
  return clamp01(
    young *
      openings *
      loose *
      market *
      (1 - 0.7 * clamp01(f.reach)) *
      (1 - 0.5 * clamp01(f.informal)) *
      0.9,
  );
}

/**
 * How hard a town's gangs fight (0 … 1): respect and retaliation, the more as they are many and close in strength (two rival
 * federations in one town most of all), the more where arms are cheap, the less where elders and kin hold sway and work returns.
 */
export function streetFight(
  gangs: number,
  rival: boolean,
  arms: number,
  informal: number,
  idle: number,
): number {
  const many = clamp01(Math.max(0, gangs - 1) / 10);
  return clamp01(
    (0.2 + many) *
      (rival ? 1.6 : 1) *
      (0.4 + 0.8 * clamp01(arms)) *
      (1 - 0.5 * clamp01(informal)) *
      (0.6 + 0.6 * clamp01(idle)),
  );
}

// —— The badge ——————————————————————————————————————————————————————————————————————————————————————————————

export type BadgeFacts = {
  readonly crackdown: number;
  /** How far its people are heard, word moves, its courts stand apart from the seat (0 … 1), and how hard it is held. */
  readonly voice: number;
  readonly word: number;
  readonly courts: number;
  readonly force: number;
  /** What is within the enforcers' reach: what they seize and the street's market, a share of what its people earn. */
  readonly within: number;
};

/** How far a crackdown's enforcers turn to their own (0 … 1): licence under weak oversight, a rent in reach. */
export function badgePull(f: BadgeFacts): number {
  const oversight = 0.4 * clamp01(f.voice) + 0.3 * clamp01(f.word) + 0.3 * clamp01(f.courts);
  return clamp01(
    clamp01(f.crackdown) *
      (1 - oversight) *
      (0.4 + clamp01(f.force)) *
      clamp01(0.3 + 40 * Math.max(0, f.within)) *
      1.6,
  );
}

/** Whether a crew kills those it hunts outside the law: the seat wants results and answers to no voice. */
export const deathSquad = (force: number, voice: number, crackdown: number): boolean =>
  force >= 0.6 && voice < 0.25 && crackdown >= 0.3;

/** The chance a crew is found out within `span` years: by free word, a court of its own, a rival house, the killings it leaves. */
export function exposedWithin(
  f: { word: number; courts: number; rival: number; killings: number },
  span: number,
): number {
  const a = clamp01(
    0.06 * clamp01(f.word) +
      0.05 * clamp01(f.courts) +
      0.05 * clamp01(f.rival) +
      0.04 * clamp01(f.killings * 2),
  );
  return 1 - dmath.pow(1 - a, Math.max(1, span));
}

// —— Who is young ——————————————————————————————————————————————————————————————————————————————————————————

/** Whether an age band is of the young grown (fifteen to thirty, for upright apes): those the street and the gangs take. */
export function youngBand(life: LifeHistory, band: number): boolean {
  const at = life.bands[band] ?? 0;
  return at >= life.adulthood && at < 2 * life.adulthood;
}

// —— A group's means (asked 2026-11-16: "do cartels use materials science and make stronger stuff?") ————————————————
// What a group can get of arms, armour and carriers, hidden carriage and guarded word: as good as its realm can make, bought with
// its wealth; better only where its wealth outbids the state's own budget and buys from abroad. Pages say what, who, cost and
// effect, never how anything is made or used.

/** The four parts of a group's means. */
export const GEAR_PARTS = ["arms", "armour", "hidden", "word"] as const;
export type MeansPart = (typeof GEAR_PARTS)[number];

export const GEAR = {
  /** What a part at its best costs a year for each of a group's men, in working men's years (its keep, its renewal). */
  cost: 0.35,
  /** A group buys toward its realm's best as far as it holds this many years of its means' cost. */
  years: 4,
  /** How far above its realm's best a group whose wealth outbids the state's budget can buy from abroad. */
  abroad: 0.25,
  /** How much its arms and armour add to its strength in a turf war, and take off the men a crackdown takes. */
  armsFight: 0.4,
  armourFight: 0.2,
  againstCrackdown: 0.35,
  /** How much more a crackdown costs the state for a group's arms at their best (the security dilemma). */
  dilemma: 0.5,
  /** What its hidden carriage adds to what slips past borders and blockades, at its best. */
  slips: 0.2,
  /** How far its guarded word shelters its boss from being taken, at its best. */
  guards: 0.5,
} as const;

/** What a group can get of each part (0 … 1): its realm's best, bought as far as its wealth holds, more where it outbids the state. */
export function meansBought(
  best: Readonly<Record<MeansPart, number>>,
  wealth: number,
  yearCost: number,
  budget: number,
): Record<MeansPart, number> {
  const buy = yearCost > 0 ? clamp01(wealth / (yearCost * GEAR.years)) : 0,
    outbid = budget > 0 ? GEAR.abroad * clamp01(wealth / budget - 1) : 0,
    out = {} as Record<MeansPart, number>;
  for (const k of GEAR_PARTS) out[k] = clamp01(Math.min(1, clamp01(best[k]) + outbid) * buy);
  return out;
}

// —— The iron law of prohibition (Cowan) ——————————————————————————————————————————————————————————————————————————
// Under a ban that is enforced, the risk and the cost of carrying go by bulk, not by dose: the trade favours the most compact, most
// potent form it can get, and once its people's chemistry allows, made forms over grown ones. Where the ban ends, sellers sell by
// dose and taste again, and the strength drifts back over a generation. Only economics and effects: never how any form is made.

export const POTENCY = {
  /** How far a grown form can be refined (doses per bulk against the plant's own), by its people's craft of healing and chemistry. */
  herbs: 1.5,
  medicine: 2.5,
  chemistry: 3,
  /** How much stronger a made form can be than the grown (est: the gap between a plant's leaf and its refined alkaloid, again). */
  made: 30,
  /** How fast the trade moves toward the strength its premium rewards, a year; how fast it drifts back where legal. */
  pace: 0.08,
  legal: 0.03,
  /** The premium at which half the way to the strongest is worth it. */
  half: 0.25,
  /** The premium from which made forms pay, and how fast their share moves. */
  madeFrom: 0.25,
  madePace: 0.1,
  /** Deaths of those who take too much: so much more for each fold of strength, and for made forms (a sharp step). */
  deaths: 0.12,
  madeDeaths: 1.5,
  /** Those who come to need it: so much more for each fold of strength, and for made forms. */
  binds: 0.04,
  madeBinds: 0.3,
  /** At its strongest, the share of what is barred that slips past for its little bulk. */
  slips: 0.3,
  /** How much a fold of strength lowers the price of a dose (its bulk's cost spread over more doses). */
  cheaper: 0.3,
} as const;

/** The premium on bulk a ban makes (0 … 1): forbidden, and hunted (its crackdown and blockades and its seat's reach). */
export function riskPremium(barred: number, hunted: number): number {
  return clamp01(clamp01(barred) * (0.3 + 0.7 * clamp01(hunted)));
}

/** How strong a trade's forms can be (doses per bulk against the grown), grown and made, by what its people know. */
export function potencyCap(k: {
  herbs: boolean;
  medicine: boolean;
  chemistry: boolean;
  canMake: boolean;
}): { grown: number; made: number } {
  const grown =
    1 +
    (k.herbs ? POTENCY.herbs - 1 : 0) +
    (k.medicine ? POTENCY.medicine - 1 : 0) +
    (k.chemistry ? POTENCY.chemistry - 1 : 0);
  return { grown, made: k.canMake ? POTENCY.made : grown };
}

/** The strength the premium rewards, up to what can be had. */
export function potencyTarget(premium: number, most: number): number {
  const p = clamp01(premium);
  return 1 + (Math.max(1, most) - 1) * (p / (p + POTENCY.half));
}

/** A trade's strength `years` on: toward what is rewarded, or back toward the grown where it is legal. */
export function potencyAfter(was: number, target: number, years: number, legal: boolean): number {
  const pace = legal ? POTENCY.legal : POTENCY.pace,
    to = legal ? 1 : Math.max(1, target),
    k = 1 - dmath.pow(1 - pace, Math.max(0, years));
  return Math.max(1, was + (to - was) * k);
}

/** The share of made forms a premium rewards, where they can be made at all. */
export function madeTarget(premium: number, canMake: boolean): number {
  return canMake ? clamp01((clamp01(premium) - POTENCY.madeFrom) * 2) : 0;
}

/** How much more a land's people die of it, and come to need it, for its strength and its made share (each ≥ 1). */
export function potencyHarm(potency: number, made: number): { deaths: number; binds: number } {
  const folds = dmath.log2(Math.max(1, potency));
  return {
    deaths: 1 + POTENCY.deaths * folds + POTENCY.madeDeaths * clamp01(made),
    binds: 1 + POTENCY.binds * folds + POTENCY.madeBinds * clamp01(made),
  };
}

/** The share of what is barred that slips past for its little bulk (0 … POTENCY.slips). */
export function bulkSlip(potency: number): number {
  return POTENCY.slips * (1 - 1 / Math.max(1, potency));
}

/** What a dose costs against its grown form's price, for its strength. */
export function dosePrice(potency: number): number {
  return 1 / dmath.pow(Math.max(1, potency), POTENCY.cheaper);
}

// —— Escalation: when a seat sends soldiers, and what comes of it (asked 2026-11-16: "does the army go to war with them?") ————
// A seat turns from its police to its soldiers where a group THREATENS it: its armed men are more than its police can meet (the
// more where it holds the seat's own land), the killing is high, or it takes a great part of what the seat raises. What the seat
// has to send (soldiers enough to meet the group's men, the treasury, a host not at war abroad) only ever holds it back: a group
// is not fought because it is small and easily met. A rule that needs to be seen to act and a ruler whose ways favour force
// answer a threat the harder, and make none. The soldiers go home once its police can meet what is left of the group. (Before,
// soldiers enough to meet a group's men counted FOR sending them and holding the seat's land was defiance whatever the group's
// strength: soldiers were sent at six weighings in ten, against groups their police outmatched thirteen to one at the tenth.)
// The same weighing can choose to leave the group be, or to make a pact with it. What comes of an operation is the
// structure's own: a boss taken splinters a great group, soldiers under no oversight abuse and turn crews, a realm that jails many
// knits its gangs in the jails, a long war of attrition ends in a truce, a weak group lays down its arms on terms, a crushed one
// leaves its men and turf to its rivals, and a group richer than the state buys the operation off.

export const ESCALATE = {
  /** The most operations a realm runs at once, and the ended ones it remembers. */
  most: 2,
  gone: 3,
  /** A realm's police: so many in a thousand of its people, as far as its seat reaches. */
  police: 4,
  /**
   * What weighs for sending soldiers: a group's armed men past what its police can meet (full at twice them), the more where it
   * holds the seat's own land; and the rent it takes, full at so great a part of what the seat raises.
   */
  outmatched: 0.5,
  defied: 0.3,
  rent: 0.5,
  rentFull: 0.25,
  /** The share of its host a realm sends at most, and soldiers for each of the group's men at most. */
  hostShare: 0.15,
  perMan: 3,
  /** What a soldier sent costs a year, in working men's years. */
  cost: 1.2,
  /**
   * Of a group's men the share an operation's soldiers could take a year at full odds, and of the soldiers the share they lose
   * were the group their match (est: Mexico's army lost some forty to fifty soldiers a year of fifty thousand and more sent, one
   * in a thousand, against groups it outmatched three to one and more; at three in a hundred, the soldiers' own dead were a third
   * of all an operation killed).
   */
  takes: 0.25,
  loses: 0.004,
  /**
   * Of a group's men an operation takes, the share killed in the fighting; the rest are seized alive (est: Mexico 2007–2012, some
   * three to four thousand gunmen killed by the state's forces a year against well over twenty thousand arrested).
   */
  killed: 0.15,
  /** Others killed for each of the group's men killed in the fighting; of its lands' people, the share driven from their homes a year at full. */
  bystanders: 0.5,
  displaced: 0.01,
  /** How hard an operation bites on its group (against a crackdown's own). */
  bite: 0.8,
  /** After so many years a war of attrition that has not broken its group is ended by a truce; how long a truce holds. */
  attrition: 10,
  truce: 10,
  /** What a truce cuts of its group's killing, and what it costs a seat's standing once known. */
  calms: 0.6,
  known: 0.1,
  /** A group with fewer men than this share of the soldiers sent lays down its arms on terms. */
  terms: 0.15,
  /** A group whose wealth reaches so many years of the state's revenue buys the operation off. */
  buys: 1.5,
  /** The years after an operation ends before a seat weighs sending its soldiers again. */
  rest: 10,
  /** How many more of a town's gangs' young are jailed in an operation. */
  jails: 3,
} as const;

export type EscalationFacts = {
  /** The group's armed men against the police its seat can send (≥ 0), the killing (a year, in a thousand of the realm's people). */
  readonly outmatch: number;
  /** The soldiers it could send, by their arms, against the group's men by theirs (1: an even fight). */
  readonly match: number;
  readonly killings: number;
  /** Whether it holds the seat's own land: its open defiance, as far as its police cannot meet it there. */
  readonly defies: boolean;
  /** The years of an operation's cost its reserve holds, and whether its host is at war abroad. */
  readonly afford: number;
  readonly atWar: boolean;
  /** Its rule held rightful, how hard it is held, what is skimmed, the group's wealth against the treasury's revenue. */
  readonly legitimacy: number;
  readonly force: number;
  readonly corruption: number;
  readonly paying: number;
};

/** How far a seat would send soldiers, make a pact, or leave a group be (each a score; the greatest is chosen), and the parts. */
export function escalation(f: EscalationFacts): {
  army: number;
  pact: number;
  leave: number;
  parts: [string, number][];
} {
  // (The threat: what a group does to the seat or to what it raises. Its rent counts as far as the seat's officers are not its own.)
  const past = clamp01(f.outmatch - 1),
    threats: [string, number][] = [
      ["the group's armed men outmatch its police", ESCALATE.outmatched * past],
      ["the group openly defies the seat", f.defies ? ESCALATE.defied * past : 0],
      ["the killing in its lands", clamp01(f.killings * 2)],
      [
        "the rent it takes against what the seat raises",
        ESCALATE.rent * clamp01(f.paying / ESCALATE.rentFull) * (1 - clamp01(f.corruption)),
      ],
    ],
    threat = threats.reduce((s, [, v]) => s + v, 0),
    // (How far there is a threat to answer at all: a seat's temper makes none.)
    stirred = clamp01(threat / 0.25);
  const parts: [string, number][] = [
    ...threats,
    ["soldiers too few to meet its men", 0.8 * (clamp01(f.match / 3) - 1)],
    ["the treasury to pay for it", 0.2 * clamp01(f.afford) - 0.3],
    ["its host at war abroad", f.atWar ? -3 : 0],
    ["a rule that needs to be seen to act", 0.4 * clamp01(0.6 - f.legitimacy) * stirred],
    ["a ruler whose ways favour force", 0.3 * clamp01(f.force - 0.4) * stirred],
    ["officers and judges the group has bought", -1.2 * clamp01(f.corruption)],
  ];
  const army = parts.reduce((s, [, v]) => s + v, 0),
    pact = clamp01(f.corruption) * 0.8 + 0.4 * clamp01(f.paying) - 0.1,
    leave = 0.25;
  return { army, pact, leave, parts };
}

/** What a year of an operation does: of the group's men, the share taken or killed; of the soldiers, the share lost. */
export function fightOdds(
  soldiers: number,
  soldierArms: number,
  men: number,
  menArms: number,
): {
  taken: number;
  lost: number;
} {
  const s = Math.max(0, soldiers) * (0.5 + clamp01(soldierArms)),
    g = Math.max(0, men) * (0.5 + clamp01(menArms)),
    odds = s + g > 0 ? s / (s + g) : 0;
  return { taken: ESCALATE.takes * odds, lost: ESCALATE.loses * (1 - odds) };
}

/** A seat's reach against those outside the law as its watch makes it (0 … 1): how far it is manned (0 … 1), how honest (0 … 1). */
export function policedReach(reach: number, manned: number, honest: number): number {
  return clamp01(
    clamp01(reach) * (UNDER.watchLeast + UNDER.watchGives * clamp01(manned) * clamp01(honest)),
  );
}
