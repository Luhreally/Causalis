// What binds realms when it is called on (D1), in numbers: pure. A call goes out when a realm is attacked; each one bound to it weighs what it owes against
// what coming would cost. A people who fear one realm enough gather against it. A marriage gives a claim, and a claim comes to something by how the realm
// the seat stands empty in thinks of the one who comes forward. Word carried and kept makes a realm's reading of another's host truer. First guesses, each a
// table to change, read over whole worlds (tools/d1-tally.ts).

export const TIES = {
  /** No more than this many come to one war: no chain is longer than one, for a war a call began calls no one. */
  callMost: 4,
  /** What each bond asks, as a chance before what coming would cost. */
  comes: { overlord: 0.85, vassal: 0.8, league: 0.7, pact: 0.6, kin: 0.35 },
  /** A foe this many times the strength of the one called is feared, and more with each time past it. */
  fearFoe: 2.5,
  fearStep: 0.12,
  fearMost: 0.6,
  /** A war of one's own leaves little to send. */
  spent: 0.4,
  /** Years since a realm's last war weigh by this at the most. */
  weary: 0.35,
  /** Who thinks less of the caller than this comes the less. */
  coldAt: 0.2,
  coldBy: 0.6,
  /** Hating the foe brings one the more, by this, up to this. */
  hateBy: 0.4,
  hateMost: 0.25,
  /** A people who prize valour come the more. */
  valourBy: 0.3,
  chanceLeast: 0.03,
  chanceMost: 0.97,
  /** What a call answered is remembered at, and what one refused is; what refusal costs a ruler's standing. */
  cameAt: 0.25,
  refusedAt: -0.3,
  shame: 0.04,
  /** How long a call is kept to read (years): after that its war's page tells only who came. */
  callYears: 100,

  /** A marriage between two who think this well of each other, by this chance a year; a house makes this many at once. */
  matchAt: 0.25,
  matchChance: 0.012,
  matchesMost: 2,
  /** Once a marriage is this old, no one of it is left to come forward. */
  claimYears: 60,
  /** A tie for a people with no houses: what their way of it is remembered at. */
  tieOther: 0.12,
  /** Where no court names anyone, the share of deaths that leave a house with no one. */
  heirless: 0.12,
  /** A realm passes to the other house when it thinks at least this well of it, and is no stronger than this share of it. */
  passRegard: 0.1,
  passShare: 0.8,
  /** One comes forward and takes the seat when the realm thinks at least this of them. */
  seatRegard: -0.1,
  /** A claim is fought for when the claimant's realm is this share of the other's strength or more. */
  warShare: 0.8,
  /** What a seat passed by is remembered at. */
  passedByAt: -0.25,

  /** A realm is feared at this share of the world's strength, having won this many battles in the years read. */
  fearShare: 0.12,
  fearWon: 2,
  fearYears: 40,
  /** Those at least this many times weaker fear it, and this many or more gather. */
  fearRatio: 2,
  leagueLeast: 3,
  leagueMost: 6,
  /** A world with fewer realms gathers no one. */
  leagueRealms: 8,
  /** By this chance at each look (every five years). */
  leagueChance: 0.3,
  /** The fear has gone when its share falls below this part of what it was, or when it is this many years old. */
  leagueFade: 0.6,
  leagueYears: 60,
  /** Years after one ends before another may gather. */
  leagueRest: 50,
  /** A league holds its enemy back from its members by this. */
  leagueHold: 0.5,

  /** A reading of another realm's host without word kept, and with: at most this far off, as a power of e. */
  misread: 0.35,
  misreadKept: 0.05,
  /** A reading is off by this much or more when it is worth telling. */
  misreadTold: 1.15,
  /** An embassy between two sworn realms, by this chance a year; a realm keeps this many. */
  embassyChance: 0.008,
  embassiesMost: 3,
  /** How long an envoy is kept to be seen (years). */
  envoyYears: 8,
  /** A ruler's envoy asking a pact is heard at this regard and above. */
  envoyPactAt: 0.15,
  /** What a gift carried is remembered at. */
  giftAt: 0.08,
} as const;

/** What ties one realm to another that has been attacked. */
export type TieBond = keyof typeof TIES.comes;

/** Why one called did as it did. */
export type CallWhy =
  "bound" | "afraid" | "spent" | "weary" | "cold" | "court" | "truce" | "sworn" | "both" | "noway";

/** Those reasons that mean it could not come at all: not remembered against it. */
export const COULD_NOT: ReadonlySet<CallWhy> = new Set(["truce", "sworn", "both", "noway"]);

const clamp = (lo: number, hi: number, x: number) => Math.max(lo, Math.min(hi, x));

/** How one called stands, as the call reads it. */
export type CallStanding = {
  readonly bond: TieBond;
  /** The foe's strength over theirs. */
  readonly foeRatio: number;
  /** What they think of the one calling, and of the foe. */
  readonly regard: number;
  readonly foeRegard: number;
  /** The wars they fight now. */
  readonly wars: number;
  /** How rested from their last war, 0 to 1. */
  readonly rested: number;
  readonly valour: number;
};

/** The chance they come, and what most stands against it. */
export function callOdds(s: CallStanding): { chance: number; against: CallWhy } {
  const afraid = clamp(0, TIES.fearMost, (s.foeRatio - TIES.fearFoe + 1) * TIES.fearStep),
    // (Those of a compact swore because they fear it: it doesn't hold them back.)
    sworn = s.bond === "overlord" || s.bond === "vassal",
    afraidBy = s.bond !== "league" && s.foeRatio >= TIES.fearFoe ? afraid * (sworn ? 0.5 : 1) : 0,
    spent = s.wars > 0 ? TIES.spent : 0,
    weary = (1 - clamp(0, 1, s.rested)) * TIES.weary,
    // (An oath is kept by those who love each other no more than by those who do; it asks only a little less of them.)
    cold = Math.max(0, TIES.coldAt - s.regard) * TIES.coldBy * (sworn ? 0.25 : 1),
    hate = Math.min(TIES.hateMost, Math.max(0, -s.foeRegard) * TIES.hateBy),
    chance = clamp(
      TIES.chanceLeast,
      TIES.chanceMost,
      TIES.comes[s.bond] +
        hate +
        (s.valour - 0.5) * TIES.valourBy -
        afraidBy -
        spent -
        weary -
        cold,
    ),
    worst: [CallWhy, number][] = [
      ["afraid", afraidBy],
      ["spent", spent],
      ["weary", weary],
      ["cold", cold],
    ];
  worst.sort((a, b) => b[1] - a[1]);
  return { chance, against: worst[0]![1] > 0.03 ? worst[0]![0] : "court" };
}

/** What can bind two houses, by what their peoples are. */
export type TieForm = "wed" | "foster" | "brood" | "graft";

/** What comes of a claim on a seat, by how the realm stands to the one who comes forward. */
export type ClaimEnd = "passes" | "seated" | "war" | "passedby";

/** Which way a claim goes. `share` is the realm's strength over the claimant's realm's; `draw` 0 to 1 (a realm's mind is not a sum). */
export function claimEnd(
  form: TieForm,
  regard: number,
  share: number,
  reach: boolean,
  draw: number,
): ClaimEnd {
  // A people who choose keep their choosing: one fostered among them can be named, and no one can march on it.
  if (form === "foster") return regard >= TIES.seatRegard && draw < 0.7 ? "seated" : "passedby";
  if (regard >= TIES.passRegard && share <= TIES.passShare && draw < 0.6) return "passes";
  if (regard >= TIES.seatRegard && draw < 0.85) return "seated";
  if (form === "wed" && reach && 1 / Math.max(1e-6, share) >= TIES.warShare) return "war";
  return "passedby";
}

/** Whether a realm has grown to be feared. */
export function isFeared(share: number, won: number): boolean {
  return share >= TIES.fearShare && won >= TIES.fearWon;
}
