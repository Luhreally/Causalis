// A court in numbers (Lives L5): pure. Who may hold a voice, how many, how near a rival is to moving and how likely
// they are to carry it. Nothing here is a title: whether a seat passes by blood or by voices comes from the realm's
// own orders and from how its people count kin, and every reason a rival has is a number history already holds. First
// guesses, measured on a fork of far saves, each a table to change.
export const COURT = {
  /** The groups a realm can have a voice of at court. */
  voices: ["the army", "the court", "the temple", "traders"],
  /** A group must hold this much of the realm's sway for one of them to be heard at court. */
  voiceLeast: 0.04,
  /** A voice comes to court at this many times the age of coming of age, more by this at the most, and stands down at this. */
  voiceAge: 1.5,
  voiceAgeMore: 1.5,
  voiceRetires: 3.75,
  /** A court holds one voice where rule is held alone, and this many more for each whole of the share the ruler must carry. */
  voicesByCarry: 6,
  /** How often a court is reckoned again (years): who is heard, who is heir, who wants the seat. */
  reckonEvery: 5,
  /** Of a reckoning, the chance a ruler with no child yet has one. */
  childChance: 0.6,
  /** Of a house's seat at court: the chance the ruler has a brother or a sister living, and how much of the court's sway they carry. */
  kinChance: 0.6,
  kinSway: 0.5,
  /** The most of a house at court beside the heir (older kin are let go). */
  kinMost: 2,
  /** A rival's wanting: their weight, and what a wrong, a regent's hold and a child heir add. */
  wantWeight: 0.35,
  wantWronged: 0.3,
  wantRegent: 0.2,
  wantChildHeir: 0.2,
  /** Under this no one at court wants the seat enough to be called a rival. */
  rivalLeast: 0.05,
  /** A rival is not replaced by anyone wanting it less than this more. */
  rivalStays: 0.08,
  /** A rival moves above this line; their yearly chance for each point above it. */
  line: 0.2,
  pace: 0.06,
  /** At a death, with the seat empty, a claim is made above this line; its chance for each point above it, and at the most. */
  claimLine: 0.2,
  claims: 0.5,
  claimMost: 0.45,
  /** Years after a plot found, one won, a claim, or a rival bought off, before anyone at court dares again. */
  quietFound: 18,
  quietWon: 14,
  quietClaim: 10,
  quietBought: 16,
  /** What a plot won costs the realm's standing, and what one found adds to it. */
  wonCost: 0.08,
  foundGain: 0.02,
  /** Of a plotter found, or a claimant beaten: the chance they flee to the far lands and raise them, and by their weight. */
  flees: 0.05,
  fleesWeight: 0.1,
  /** A ruler's word against a plotter: the least it costs in standing, and by the plotter's weight. */
  seizeLeast: 0.02,
  seizeWeight: 0.06,
  /** What buying a plotter off costs in standing: little, but it is seen. */
  buyCost: 0.03,
  /** A heir's choosing by your word costs this in standing where the voices lean elsewhere. */
  nameCost: 0.02,
  /** How much of a court's own record, and of those gone from it, is kept per court. */
  toldMost: 8,
  goneMost: 4,
} as const;

/** What a rule's standing does to a rival: as doubt in `coupDanger`, from the same number. */
export function doubtOf(legitimacy: number): number {
  return Math.max(0, Math.min(1, (0.62 - legitimacy) * 2));
}

/** A rival's weight at court, by their group's sway. */
export function weightOf(sway: number): number {
  return Math.min(1, 3 * sway);
}

/** How many of the groups a court hears, by the share of the voices a ruler must carry. */
export function voicesHeard(carry: number): number {
  return 1 + Math.round(carry * COURT.voicesByCarry);
}

/** The chance a plot carries the seat: a rival's weight and a rule doubted, against a people who keep to custom. */
export function plotOdds(weight: number, doubt: number, tradition: number): number {
  return Math.max(0.12, Math.min(0.72, 0.25 + 0.3 * weight + 0.4 * doubt - 0.3 * (tradition - 0.5)));
}

/** A plotter's yearly chance of moving, at a score. */
export function plotChance(score: number): number {
  return score > COURT.line ? COURT.pace * (score - COURT.line) : 0;
}

/** The chance a claim is made at a death, at a score. */
export function claimChance(score: number): number {
  return score > COURT.claimLine
    ? Math.min(COURT.claimMost, COURT.claims * (score - COURT.claimLine))
    : 0;
}

/** The chance a plotter found, or a claimant beaten, flees and raises the far lands. */
export function fleeChance(weight: number): number {
  return COURT.flees + COURT.fleesWeight * weight;
}

/** What a word against a plotter costs in standing. */
export function seizeCost(weight: number): number {
  return COURT.seizeLeast + COURT.seizeWeight * weight;
}
