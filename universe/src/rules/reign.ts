// A ruler's station in numbers (Lives L4): pure. What a ruler can do is read off what the world says they hold,
// not listed by title. Whether they hold their seat by birth or by others' leave and whether rule is theirs alone
// or shared set the share of the realm's voices they must carry; the realm's standing says how far they are heard;
// whether anything is written says whether a word can be law at all. First guesses, each a table to change.

/** How rule passes, by SUCCESSION: 0 is by birth, the rest by others' leave. Who leads, by LEADERSHIP: 1 and 2 are shared. */
const BY_BIRTH = 0,
  SHARED: readonly number[] = [1, 2];

export const REIGN = {
  /** Below this standing a ruler's word stops at the seat's door (the order's own line for a crisis of standing). */
  wordLine: 0.3,
  /** Below this no one marches for them. */
  marchLine: 0.2,
  /** The share of the voices owed for holding the seat by others' leave, and for sharing rule. */
  carryByLeave: 0.25,
  carryShared: 0.25,
  /** What a decree costs in standing: at the least, and by the sway against it. */
  decreeLeast: 0.02,
  decreeAgainst: 0.1,
  /** How much grievance a word not wanted adds in a land past the seat's reach, by the sway against it. */
  pastReach: 0.4,
  /** What going to war costs in standing: at the least, breaking a pact, with no grievance to name. */
  warLeast: 0.02,
  warPact: 0.08,
  warNoCause: 0.04,
  /** What a peace does to standing, the prize won or the war lost. */
  peaceWon: 0.03,
  peaceLost: -0.03,
  /** Of a realm's sway, how much of each group leans to war (+) or from it (-) before any demand. */
  warLeans: {
    "the army": 0.5,
    "the court": 0.1,
    "the temple": 0,
    farmers: -0.2,
    herders: -0.1,
    crafters: -0.1,
    traders: -0.2,
  } as Readonly<Record<string, number>>,
  /** How much a rivalry, and a pact, count among the voices. */
  warHatred: 0.5,
  warPactVoices: 0.3,
  /** A marriage between two houses: remembered at this much, and this much more by how their peoples count kin. */
  tieLeast: 0.1,
  tieKin: 0.5,
  /** Halved where a seat is not held by birth: it binds two people, not two houses. */
  tieNoHouse: 0.5,
  /** A people who count kin less than this keep no houses to join. */
  noHouses: 0.15,
  /** A house thinks this ill of you and gives you no one (of realms that meet, most stand under diplomacy's -0.4 for rivals: a match is how that is mended; a quarter stand under this). */
  wedRefused: -0.85,
  /** A second match with a house is not made while the first is this fresh (years: a memory's half-life). */
  wedAgain: 30,
  /** The most a tithe can be set to, the least, and a step (polity.ts weighs it within the same bounds). */
  titheLeast: 2,
  titheMost: 15,
  titheStep: 2,
  /** A foe who is winning this many more battles holds out, unless weary or long at it (war.ts's own lines). */
  peaceEdge: 2,
  peaceWeary: 0.02,
  peaceYears: 6,
} as const;

/** The share of a realm's voices a ruler must have for them (0: they rule alone, and are answered at once). */
export function mustCarry(leadership: number, succession: number): number {
  return (
    (succession === BY_BIRTH ? 0 : REIGN.carryByLeave) +
    (SHARED.includes(leadership) ? REIGN.carryShared : 0)
  );
}

/** The share of the voices for a thing (all of them, where no one speaks either way). */
export function carried(forIt: number, against: number): number {
  const all = forIt + against;
  return all > 0 ? forIt / all : 1;
}

/** What a word costs in standing, by the sway against it. */
export function decreeCost(against: number): number {
  return REIGN.decreeLeast + REIGN.decreeAgainst * against;
}

/** What going to war costs in standing. */
export function warCost(pact: boolean, grievance: boolean): number {
  return REIGN.warLeast + (pact ? REIGN.warPact : 0) + (grievance ? 0 : REIGN.warNoCause);
}

/** What a marriage of state is remembered at, in what two realms think of each other (0: their peoples keep no houses). */
export function tieOf(
  kinship: number,
  otherKinship: number,
  byBirth: boolean,
  otherByBirth: boolean,
): number {
  const kin = (kinship + otherKinship) / 2;
  if (Math.min(kinship, otherKinship) < REIGN.noHouses) return 0;
  const tie = REIGN.tieLeast + REIGN.tieKin * kin;
  return Math.round(100 * tie * (byBirth && otherByBirth ? 1 : REIGN.tieNoHouse)) / 100;
}

/** Why a foe will not hear of peace (null: they will). Their edge is battles they won less those you won. */
export function peaceRefused(
  foeAttacks: boolean,
  edge: number,
  years: number,
  weary: number,
  prizeWon: boolean,
): "winning" | null {
  if (!foeAttacks || prizeWon) return null;
  return edge >= REIGN.peaceEdge && weary <= REIGN.peaceWeary && years < REIGN.peaceYears
    ? "winning"
    : null;
}
