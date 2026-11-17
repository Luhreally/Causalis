// Who a town's buildings belong to, as far as it shows (asked 2026-11-17: "can you make it so the leaders houses and the rich
// houses look notably different"): how unevenly its land's wealth is held and whether its people drive (by which its homes
// sort into the well-off's ground and the poor's: the same reading its lots' pages give), its realm's seat (its hall of law
// the ruler's, grown with the realm's age and lands), the great houses seated in it (each a hall of its own on a lot near the
// square, sized by its share of the houses' wealth), and the homes of its key figures. Read by the host from what history
// keeps (host/rank.ts); nothing here is saved, and both views draw from it.
import { HEART_BLOCKS, QUARTER, quarterOf } from "./sites.ts";

type Rgb = readonly [number, number, number];

/** A realm's seat in a town: its hall the ruler's. `grade`: 0 a hall, 1 a palace, 2 a palace with wings. */
export type RankSeat = {
  readonly realm: string;
  readonly name: string;
  /** The ruler's page. */
  readonly ruler: string;
  readonly color: Rgb;
  readonly grade: 0 | 1 | 2;
  /** The ruler's own house, on which lot, where no hall of law stands in the seat yet (absent: the hall is theirs). */
  readonly lot?: number;
};

/** A great house's hall in a town: on which lot, in whose colours, how great (its share of the realm's houses' wealth, 0 … 1). */
export type RankHall = {
  readonly lot: number;
  readonly name: string;
  /** Its page (absent: none kept). */
  readonly ref?: string;
  readonly color: Rgb;
  readonly share: number;
};

/** A key figure's home in a town: which lot, whose, and what they are. */
export type RankMark = {
  readonly lot: number;
  readonly ref: string;
  readonly name: string;
  readonly title: string;
  /** Its colour, its roof and pennant in it (absent: its seat's, else gold). */
  readonly color?: Rgb;
};

export type TownRank = {
  /** How unevenly its land's wealth is held (Gini, 0 … 1; 0: not reckoned). */
  readonly gini: number;
  /** Its people drive: the well-off live out at the high edge. */
  readonly drives: boolean;
  readonly seat?: RankSeat;
  readonly halls?: readonly RankHall[];
  readonly marks?: readonly RankMark[];
  /** What its land's well-off and its halls build in, past its own way of building (absent: that way). */
  readonly stuff?: "stone" | "brick" | "concrete";
};

/** From what Gini a town's pages say who holds which ground (its homes are drawn apart from RANK_SORTS, a little). */
export const RANK_SAID = 0.3;

/** How unevenly a land's wealth must be held for its people to sort themselves by ground; and at which it shows the most. */
// (On "first light" at year 300 a town's land has a Gini of 0.17 at the median, 0.28 at the ninth tenth, 0.34 at the
// hundredth's top: sorted from 0.15, a little; told apart the most from 0.4.)
export const RANK_SORTS = 0.15,
  RANK_STEEP = 0.4;

/** How far a town's homes are told apart by wealth (0 none … 1 the most), from how unevenly its land's wealth is held. */
export function rankSteep(gini: number): number {
  return Math.max(0, Math.min(1, 0.15 + (0.85 * (gini - RANK_SORTS)) / (RANK_STEEP - RANK_SORTS)));
}

/** The ground a home stands on, as wealth sorts it. */
export type HomeGround = "heart" | "high" | "high-edge" | "tall-heart" | "lee-edge" | "water-edge";

/**
 * Whose ground a home's lot is, where its land's wealth is held unevenly enough to sort its people (null: no one's in
 * particular): before engines the well-off hold the heart and the high ground near it, the poor the edge downwind and the low
 * ground by the water; once its people drive the well-off move out to the high edge, and the tall homes by the square are
 * those who cannot.
 */
export function homeGround(
  seed: number,
  lot: number,
  whole: number,
  level: number,
  gini: number,
  drives: boolean,
): HomeGround | null {
  if (gini < RANK_SORTS) return null;
  const b = Math.floor(lot / 8),
    q = quarterOf(seed, b),
    blocks = Math.max(1, Math.ceil(whole / 8)),
    heart = b < HEART_BLOCKS,
    near = b < Math.max(HEART_BLOCKS * 3, blocks / 3),
    edge = b >= blocks / 2;
  if (!drives && heart) return "heart";
  if (!drives && q === QUARTER.high && near) return "high";
  if (drives && q === QUARTER.high && edge) return "high-edge";
  if (drives && heart && level >= 3) return "tall-heart";
  if (q === QUARTER.lee && edge) return "lee-edge";
  if (q === QUARTER.water && edge) return "water-edge";
  return null;
}

/** Whether a ground is the well-off's (1), the poor's (-1) or neither (0). */
export function groundWealth(g: HomeGround | null): -1 | 0 | 1 {
  return g === "heart" || g === "high" || g === "high-edge"
    ? 1
    : g === "lee-edge" || g === "water-edge" || g === "tall-heart"
      ? -1
      : 0;
}

/** A share in words: "a fifth", "a third", "most". */
export function shareWords(share: number): string {
  if (share >= 0.6) return "most";
  if (share >= 0.42) return "half";
  if (share >= 0.29) return "a third";
  if (share >= 0.22) return "a quarter";
  if (share >= 0.17) return "a fifth";
  if (share >= 0.08) return "a tenth";
  return "a small part";
}
