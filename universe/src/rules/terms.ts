// What a war is for and what its peace comes to, in numbers (W7): pure. A peace is a bargain struck by the war's reckoning
// (dealOf): who is ahead by its chance, what the one behind would give up rather than fight on, and what the one ahead can hold
// it to at its reach. A tribute is a share of what the payer makes, never a share of what it needs to eat.

export const TERMS = {
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
  /** Of the loser's host, the share it must stand down for the term's years (0 where none is asked). */
  readonly disarm?: number;
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
  /** What a year of the war has cost each, as a share of what it has (warReckoning), and what each had at stake in it. */
  readonly yearly: readonly [number, number];
  readonly stakes: readonly [number, number];
  /** The attacker's chance of winning as the war's reckoning reads it (warReckoning); read off the edge and the ratio where not given. */
  readonly chance?: number;
  /** How surely each side could hold the other to terms at its reach (0 … 1): its seat's capacity, and its bread carried there. */
  readonly hold?: readonly [number, number];
  /** How far each side's own people hold its rule rightful (0 … 1): a realm whose people would not fight on for it can be bound. */
  readonly standing?: readonly [number, number];
};

/** The most of its host a beaten realm can be made to stand down. */
export const DISARM_MOST = 0.8;

/** The attacker's chance as warReckoning reads it, from the battles' edge alone where their count is not known. */
export function chanceOfEnd(e: Pick<WarEnd, "edge" | "ratio" | "chance">): number {
  if (e.chance !== undefined) return clamp(0, 1, e.chance);
  const record = clamp(0, 1, 0.5 + e.edge / (2 * (Math.abs(e.edge) + 2)));
  return 0.5 * record + 0.5 * (e.ratio / (1 + e.ratio));
}

/**
 * How a war stands for each side, read off what it has cost them and what it is worth to them, never by a count of years or a
 * draw (round E, order). Each side's cost so far is its fallen over its people, and every year of war its host kept from work
 * over its people (at the least a two-hundredth: a year of war is never free); its stake is what it came for or stands to lose,
 * as a share of what it has. The attacker's chance of winning is half its battles' record (won over fought, from even) and
 * half its strength over its foe's. It gives up when what the war has cost it has come to what winning is worth, by that
 * chance; the defender yields when its cost has come to what losing would take, by the other.
 */
export function warReckoning(e: {
  readonly won: number;
  readonly fought: number;
  readonly ratio: number;
  readonly costs: readonly [number, number];
  readonly stakes: readonly [number, number];
  /** How near a siege it holds is to taking its land (0 … 1: its walls open, or its stores within a year of gone). */
  readonly taking?: number;
}): { readonly chance: number; readonly quits: boolean; readonly yields: boolean } {
  const field = 0.5 * ((e.won + 1) / (e.fought + 2)) + 0.5 * (e.ratio / (1 + e.ratio)),
    // (A town near falling is near won: neither side reckons the war as if its walls stood whole.)
    chance = field + (1 - field) * clamp(0, 1, e.taking ?? 0);
  return {
    chance,
    quits: e.costs[0] >= chance * e.stakes[0],
    yields: e.costs[1] >= (1 - chance) * e.stakes[1],
  };
}

/** The least a year of war costs a side, as a share of what it has: its fields and its trade, whatever its host. */
export const WAR_YEAR_LEAST = 0.005;

const clamp = (lo: number, hi: number, x: number) => Math.max(lo, Math.min(hi, x));

/**
 * A tribute's share and years, from what the war cost the one who pays (round E, order): it pays a year of what a year of the
 * war was costing it (it would rather pay that than fight on), for as many years as it would have taken the war to cost it what
 * it had at stake; within the least and the most a tribute is.
 */
export function tributeOf(yearly: number, stake: number): { share: number; years: number } {
  return {
    share: clamp(TERMS.tributeShare, TERMS.shareMost, yearly),
    years: Math.round(clamp(TERMS.tributeYears, TERMS.yearsMost, stake / Math.max(1e-6, yearly))),
  };
}

/**
 * What a peace comes to, from how the war went, as a bargain (Fearon, Rationalist Explanations for War, 1995). Each side's chance is
 * the war's reckoning. The one ahead has an edge, `adv`, of twice its chance less one. The one behind gives up what fighting on
 * would cost it: its stake by the other's edge, and a year more of the war. The winner can ask no more than it can hold the loser
 * to (its edge times its hold on it at its reach). The loser becomes its vassal where the winner's hold outweighs how far its
 * own people hold its rule rightful, and the winner can bind it. It pays a tribute where what the winner can collect of one is
 * worth more to it than a year of the war. Its host is stood down as far as the winner can hold it to that, against how strong
 * that host still is. Neither ahead, or nothing worth the asking: a truce. Land held stays held.
 */
export function dealOf(e: WarEnd): Deal {
  const chance = chanceOfEnd(e),
    took = e.got || e.lands > 0,
    winner: 0 | 1 | null = chance > 0.5 || took ? 0 : chance < 0.5 ? 1 : null,
    none: Deal = { winner, bond: null, share: 0, years: 0 },
    truce: Deal = { ...none, bond: "truce", years: TERMS.truceYears };
  if (winner === null) return truce;
  // A host come for its friend asks nothing, and goes home under a truce (D1). A rising that won is free, and asks nothing more.
  if (e.aim === "ally") return truce;
  if (e.aim === "free" && winner === 0) return none;
  const loser = (1 - winner) as 0 | 1,
    adv = Math.max(0, winner === 0 ? 2 * chance - 1 : 1 - 2 * chance),
    conceded = adv * clamp(0, 1, e.stakes[loser]!) + e.yearly[loser]!,
    enforce = adv * clamp(0, 1, e.hold?.[winner] ?? 1),
    // (How strong the loser's host still is against the winner's: what standing it down is worth to the winner.)
    threat = winner === 0 ? 1 / Math.max(1e-6, e.ratio) : e.ratio,
    disarm = clamp(0, DISARM_MOST, enforce * Math.min(1, threat)),
    plain: Deal = took ? none : truce,
    withArms = (d: Deal, years: number): Deal =>
      disarm > 0.005 ? { ...d, disarm, years: d.years || years } : d;
  if (conceded < WAR_YEAR_LEAST || enforce <= 0) return plain;
  if (e.canBind && enforce > clamp(0, 1, e.standing?.[loser] ?? 0.6))
    return withArms(
      { ...none, bond: "vassal", share: TERMS.oathShare, years: TERMS.oathYears },
      TERMS.oathYears,
    );
  const t = tributeOf(e.yearly[loser]!, conceded);
  if (enforce * t.share * t.years > e.yearly[winner]!)
    return withArms({ ...none, bond: "tribute", ...t }, t.years);
  return withArms(plain, TERMS.truceYears);
}

/** An offer a ruler can make or demand. */
export type Offer =
  "truce" | "give-land" | "give-tribute" | "take-land" | "take-tribute" | "take-knee";

/** Why the other side says no, as a code, or null: they agree. */
export type Refusal = "winning" | "not-beaten" | "not-knee" | "cannot-bind" | "all" | null;

/**
 * What the other side says to an offer, by the same bargain a peace is made by (dealOf), the one who offers counted first.
 * `ahead` is the battles the one who offers has won less those they have lost; `ratio` their strength over the other's;
 * `refused` whether the other holds out regardless (reign.ts peaceRefused). `war` is what the war's reckoning reads, the one who
 * offers first, where it is known: what each has at stake, what a year of it costs each, its chance, and how surely each could
 * hold the other to terms. A demand is met where the bargain would give at least as much. A gift is refused only by one whose
 * hold on the giver outweighs how far the giver's people hold its rule rightful: it means to take it all.
 */
export function answerOf(
  offer: Offer,
  ahead: number,
  ratio: number,
  refused: boolean,
  canBind: boolean,
  war: Partial<Pick<WarEnd, "stakes" | "yearly" | "chance" | "hold" | "standing">> = {},
): Refusal {
  const end: WarEnd = {
      edge: ahead,
      ratio,
      spent: [0, 0],
      lands: 0,
      aim: "land",
      got: false,
      canBind,
      yearly: war.yearly ?? [0.02, 0.02],
      stakes: war.stakes ?? [0.2, 0.2],
      ...(war.chance !== undefined ? { chance: war.chance } : {}),
      ...(war.hold ? { hold: war.hold } : {}),
      ...(war.standing ? { standing: war.standing } : {}),
    },
    chance = chanceOfEnd(end),
    deal = () => dealOf(end),
    bound = () => dealOf({ ...end, canBind: true });
  switch (offer) {
    case "truce":
      return refused ? "winning" : null;
    case "give-land":
      return null;
    case "give-tribute":
      return (1 - 2 * chance) * (end.hold?.[1] ?? 1) > (end.standing?.[0] ?? 0.6) ? "all" : null;
    case "take-land":
      return chance > 0.5 ? null : "not-beaten";
    case "take-tribute": {
      const d = deal();
      return d.winner === 0 && (d.bond === "tribute" || d.bond === "vassal") ? null : "not-beaten";
    }
    case "take-knee":
      if (bound().bond !== "vassal") return "not-knee";
      return canBind ? null : "cannot-bind";
  }
}
