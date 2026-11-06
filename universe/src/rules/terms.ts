// What a war is for and what its peace comes to, in numbers (W7): pure. A peace goes by how the war went (battles won
// against battles lost) and how far each side is spent; a tribute is a share of what the payer makes, never a share of
// what it needs to eat. First guesses, each a table to change, read over whole worlds (tools/w7-tally.ts).

export const TERMS = {
  /** A side this many battles ahead may name more than the land it holds. */
  edge: 2,
  /** A beaten side bends the knee only to one this many times its strength, this many battles ahead. */
  kneeRatio: 3,
  kneeEdge: 2,
  /** Who may hold vassals: this many at most, and no more than this share of the world's living realms is bound. */
  vassalsMost: 3,
  vassalShare: 0.2,
  /** A world with fewer living realms binds no one: someone has to be left to bind them. */
  realmsLeast: 4,
  /** An oath runs a generation or so, then ends by the world's clock. */
  oathYears: 40,
  /** What a vassal pays of what it makes (a tithe brings a seat about a twentieth of it). */
  oathShare: 0.015,
  /** A tribute, of what the payer makes: its least, for each battle ahead, for how far it is spent, its most. */
  tributeShare: 0.01,
  shareEdge: 0.003,
  shareSpent: 0.3,
  shareMost: 0.03,
  /** Who owes this many tributes owes no more: what it could not pay would only be owed. */
  owesMost: 2,
  /** How long a tribute runs: its least, for each battle ahead, its most. */
  tributeYears: 6,
  yearsEdge: 2,
  yearsMost: 20,
  /** A truce's years, when neither could win. */
  truceYears: 8,
  /** The most of what a realm made that can leave it in a year, to all it owes. */
  yearMost: 0.05,
  /** Three short years in a row, and it has stopped paying. */
  shortYears: 3,
  /** A year is short when less than this share of what was owed was paid. */
  shortShare: 0.5,
  /** What an unpaid tribute is remembered at: a reason for the next war. */
  unpaid: -0.5,
  /** A vassal rises at this share of its overlord's strength, by this chance a year. */
  riseAt: 0.8,
  riseChance: 0.15,
  /** A hungry host carries off this share of a land's grain with each battle won. */
  sack: 0.5,
  /** A war for tribute: its realm this many times stronger, and those who press for more this loud. */
  tributeRatio: 1.6,
  tributePress: 0.3,
  /** A temple this loud makes a war a holy one. */
  holyPress: 0.15,
  /** A winner this many times the loser's strength, one battle ahead, may ask tribute, or an oath. */
  askRatio: 2,
  kneeOutright: 6,
  /** A beaten attacker pays a defender only this many battles behind, and not at many times the defender's strength. */
  paysBackEdge: 2,
  paysBackRatio: 0.7,
} as const;

/** What a war is about. */
export type AimKind = "land" | "stores" | "back" | "holy" | "tribute" | "free" | "ally" | "claim";

/** What can bind after a peace. */
export type BondKind = "tribute" | "vassal" | "truce";

/** What a peace comes to: who came out ahead (0 the attacker, 1 the defender, null neither), and who then owes whom what. */
export type Deal = {
  readonly winner: 0 | 1 | null;
  readonly bond: BondKind | null;
  /** A tribute's or oath's share of what the payer makes. */
  readonly share: number;
  readonly years: number;
};

/** How a war went, as its peace reads it. */
export type WarEnd = {
  /** Battles the attacker won less those it lost. */
  readonly edge: number;
  /** The attacker's strength over the defender's. */
  readonly ratio: number;
  /** How far each is spent: its fallen over its people. */
  readonly spent: readonly [number, number];
  /** How many lands the attacker holds that it took in this war. */
  readonly lands: number;
  readonly aim: AimKind | null;
  /** Whether the aim was met. */
  readonly got: boolean;
  /** Whether the winner can bind the loser (see canBind). */
  readonly canBind: boolean;
};

const clamp = (lo: number, hi: number, x: number) => Math.max(lo, Math.min(hi, x));

/** A tribute's share and years: by the battles ahead and how far the payer is spent. */
export function tributeOf(margin: number, spent: number): { share: number; years: number } {
  return {
    share: clamp(
      TERMS.tributeShare,
      TERMS.shareMost,
      TERMS.tributeShare + TERMS.shareEdge * margin + TERMS.shareSpent * spent,
    ),
    years: clamp(
      TERMS.tributeYears,
      TERMS.yearsMost,
      TERMS.tributeYears + TERMS.yearsEdge * margin,
    ),
  };
}

/** What a peace comes to, from how the war went. */
export function dealOf(e: WarEnd): Deal {
  const winner: 0 | 1 | null = e.edge > 0 || e.got || e.lands > 0 ? 0 : e.edge < 0 ? 1 : null,
    none: Deal = { winner, bond: null, share: 0, years: 0 };
  if (winner === null) return { ...none, bond: "truce", years: TERMS.truceYears };
  const margin = Math.abs(e.edge),
    strength = winner === 0 ? e.ratio : 1 / Math.max(1e-6, e.ratio),
    spent = e.spent[1 - winner]!;
  // A host come for its friend asks nothing, and goes home under a truce (D1).
  if (e.aim === "ally") return { ...none, bond: "truce", years: TERMS.truceYears };
  // A rising that won is free, and asks nothing more.
  if (e.aim === "free" && winner === 0) return none;
  // A beaten attacker goes home under a truce: it pays only one who has beaten it badly and can hold it to it.
  if (winner === 1)
    return margin >= TERMS.paysBackEdge && strength >= TERMS.paysBackRatio
      ? { ...none, bond: "tribute", ...tributeOf(margin, spent) }
      : { ...none, bond: "truce", years: TERMS.truceYears };
  if (
    e.canBind &&
    ((margin >= TERMS.kneeEdge && strength >= TERMS.kneeRatio) ||
      (margin >= 1 && strength >= TERMS.kneeOutright))
  )
    return { ...none, bond: "vassal", share: TERMS.oathShare, years: TERMS.oathYears };
  if (margin >= TERMS.edge || (margin >= 1 && (e.aim === "tribute" || strength >= TERMS.askRatio)))
    return { ...none, bond: "tribute", ...tributeOf(margin, spent) };
  // Land ceded is the term where land was what they got.
  if (e.lands > 0) return none;
  return { ...none, bond: "truce", years: TERMS.truceYears };
}

/** An offer a ruler can make or demand. */
export type Offer =
  "truce" | "give-land" | "give-tribute" | "take-land" | "take-tribute" | "take-knee";

/** Why the other side says no, as a code, or null: they agree. */
export type Refusal = "winning" | "not-beaten" | "not-knee" | "cannot-bind" | "all" | null;

/**
 * What the other side says to an offer. `ahead` is the battles the one who offers has won less those they have lost;
 * `ratio` their strength over the other's; `refused` whether the other holds out regardless (reign.ts peaceRefused).
 */
export function answerOf(
  offer: Offer,
  ahead: number,
  ratio: number,
  refused: boolean,
  canBind: boolean,
): Refusal {
  switch (offer) {
    case "truce":
      return refused ? "winning" : null;
    case "give-land":
      return null;
    case "give-tribute":
      return ahead <= -4 ? "all" : null;
    case "take-land":
      return ahead >= 1 ? null : "not-beaten";
    case "take-tribute":
      return ahead >= TERMS.edge || (ahead >= 1 && ratio >= 1.5) ? null : "not-beaten";
    case "take-knee":
      if (ahead < TERMS.kneeEdge || ratio < TERMS.kneeRatio) return "not-knee";
      return canBind ? null : "cannot-bind";
  }
}
