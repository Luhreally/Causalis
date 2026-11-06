// Lodes that run out (E1, Classic 42). What a land holds of an ore is a real amount, in what its smelters win from it,
// more in a deposit by its richness; what lies deep is reached only by better means, and yields less for the depth.
// What is worked out at every depth still gives its old heaps a little to a people whose machines can sort them.
// Read off a world's own ores by their role: nothing here names a kind of world. Read a world's worst before changing
// a size: tools/e1-tally.ts.

export const LODE = {
  /** What a land's showing of each kind holds at the depth anyone can dig, in what its smelters and diggers make. */
  size: { copper: 7.5e7, tin: 3.75e6, iron: 3.75e7, coal: 5e8, oil: 2.5e8 } as Readonly<
    Record<string, number>
  >,
  /** A deposit holds this share of a showing for each part of its richness. */
  perRichness: 0.01,
  /** How much a lode has been dug when each depth is done: picks; engines; machines that think; and the heaps. */
  depths: [1, 8, 40, Infinity] as readonly number[],
  /** What a smelter's year yields at each depth, against the first. */
  grades: [1, 0.8, 0.6, 0.15] as readonly number[],
  /** Beyond its neighbours: where a lode near it is done, a land hauls from two lands off, for this much. */
  farReach: 0.35,
  /** How long a land's people feel a mine's end, and how hard it pushes them, by the share who worked it. */
  feltYears: 30,
  pushPerShare: 4,
  mostPush: 0.5,
  /** Who worked it, of a land's people, to be its whole trade (told in the Years, seldom). */
  wholeTrade: 0.02,
  greatEvery: 25,
} as const;

/** The kinds that run out: what the recipes dig. */
export const LODE_KINDS: readonly string[] = ["copper", "tin", "iron", "coal", "oil"];

/** How much a lode holds at the first depth, by how it lies (`richness` 0: a showing). */
export function lodeSize(kind: string, richness: number): number {
  const base = LODE.size[kind] ?? 1e9;
  return richness > 0 ? base * Math.max(1, richness * LODE.perRichness) : base;
}

/** The depth a people's means reach: 0 picks and fire-setting, 1 engines to pump and hoist, 2 machines that think. */
export const LODE_MEANS = 3;

/** What is done at a depth, in words: "picks could reach". */
export const LODE_DEPTH_WORDS: readonly string[] = [
  "as deep as picks could reach",
  "as deep as engines could reach",
  "as deep as anything could reach",
  "down to the old heaps",
];
