// Woods through history (E1, Classic 19, 113, 119). What a land's own ground and rain can hold of woods is the
// world's own rule for where they stand (gen's `classify`), asked again at other rains and warmths: woods let alone
// fill what their land holds, slowly, and seed from the land beside them; a run of dry years kills what its rain no
// longer holds, fast; a long drying takes it slowly. No kind of world is named: what grows is read off its numbers,
// and only its words are its own. Read a world's worst before changing a rate: tools/e1-tally.ts.

export const GROVE = {
  /** A land is looked at once in so many years, each in its own turn. */
  every: 5,
  /** A year's growth, as a share of what is still to fill: from its own woods, and from the thickest beside it. */
  fill: 0.02,
  seed: 0.007,
  /** Below this a land has no seed of its own. */
  least: 0.02,
  /** A year's dying in a run of dry years, and under a long drying, as a share of what its rain no longer holds. */
  wither: 0.05,
  fade: 0.012,
  /** How far a land's woods move before anyone says so, and how far before the Years do; how seldom the Years do. */
  turn: 0.15,
  great: 0.35,
  greatEvery: 40,
  /** How many years a wood stays brown after a run of dry ones has taken it back (only its look). */
  brown: 12,
  /** How much harder a wood's edge feels an age's rain than its fields do: a tree lives on what the ground has laid by for years. */
  edge: 1.6,
  /** What a fire takes of a wood no one keeps, of what it passed through: a mosaic of what it passed over, and its seed. */
  burned: 0.3,
  /** A run of years this far under the age's rain is a run of dry years, not the age. */
  dryRun: 0.14,
  /** How the five-year mean of a year's rain spreads, where no one keeps the years. */
  runSpread: 0.1,
  /** A people of the water's beds: how cold and how warm a shelf bears them, and how far the age's swing moves that. */
  bedCold: 2,
  bedWarm: 34,
  bedSwing: 60,
} as const;

/** How far the long ages swing a land's rain (a share of it), and the waves they are made of: years, how wide across a world, how much of it. */
export const GROVE_LONG = {
  swing: 0.12,
  waves: [
    [720, 3.2, 0.6],
    [260, 5.5, 0.4],
  ] as readonly (readonly [number, number, number])[],
} as const;

/** The rains and warmings a land's table is read at (shares of its own rain; degrees over what it was). */
export const GROVE_RAINS: readonly number[] = [0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4];
export const GROVE_WARMS: readonly number[] = [0, 2, 4];

/** Index of a table of a land's shares by rain and warming. */
export const groveAt = (cell: number, rain: number, warm: number): number =>
  (cell * GROVE_RAINS.length + rain) * GROVE_WARMS.length + warm;

/** What a land holds at a rain and a warming, read between the table's rows. */
export function groveHolds(table: Float32Array, cell: number, rain: number, warm: number): number {
  const r = Math.max(0, Math.min(GROVE_RAINS.length - 1.001, (rain - 0.6) / 0.1)),
    w = Math.max(0, Math.min(GROVE_WARMS.length - 1.001, warm / 2)),
    r0 = Math.floor(r),
    w0 = Math.floor(w),
    fr = r - r0,
    fw = w - w0,
    at = (i: number, j: number) => table[groveAt(cell, i, j)]!;
  return (
    (at(r0, w0) * (1 - fr) + at(r0 + 1, w0) * fr) * (1 - fw) +
    (at(r0, w0 + 1) * (1 - fr) + at(r0 + 1, w0 + 1) * fr) * fw
  );
}

/** A year's growth or dying, over `years`: toward what its climate holds, and what its last run of years does. */
export function groveStep(
  reach: number,
  holds: number,
  holdsRun: number,
  beside: number,
  years: number,
): number {
  const target = Math.min(holds, holdsRun);
  if (reach > target) {
    const rate = holdsRun < holds ? GROVE.wither : GROVE.fade;
    return Math.max(target, reach - Math.min(1, rate * years) * (reach - target));
  }
  if (reach >= holds) return reach;
  const rate = (reach >= GROVE.least ? GROVE.fill : 0) + GROVE.seed * beside;
  return Math.min(holds, reach + Math.min(1, rate * years) * (holds - reach));
}

/** Why a land's woods moved, as a page says it. */
export type GroveWhy = "seeded" | "regrown" | "dry" | "age" | "warming" | "felled" | "fire";
export const GROVE_WHYS: readonly GroveWhy[] = [
  "seeded",
  "regrown",
  "dry",
  "age",
  "warming",
  "felled",
  "fire",
];

/** The words a world has for what stands in its woods, by what its people live in and what its life is. */
export type GroveWords = {
  /** "woods"; "weed beds". */
  readonly woods: string;
  /** "tree"; "frond". */
  readonly tree: string;
};

export function groveWords(water: boolean): GroveWords {
  return water ? { woods: "weed beds", tree: "frond" } : { woods: "woods", tree: "tree" };
}

/** Why, in a sentence's end ("as a run of dry years killed them"), of woods by name. */
export function groveWhyWords(why: GroveWhy, woods: string): string {
  const they = woods,
    // (Weed beds know no rain: what holds them is how cold their sea runs.)
    sea = woods.endsWith("weed beds");
  switch (why) {
    case "seeded":
      return sea
        ? `${they} spread along the shelf as the cold water allowed`
        : `${they} seeded outward into it as the rains allowed`;
    case "regrown":
      return `${they} grew back`;
    case "dry":
      return sea
        ? `a run of warm years killed what its sea no longer held`
        : `a run of dry years killed what its rain no longer held`;
    case "age":
      return sea
        ? `a long warming of its sea took what it no longer held`
        : `a long drying took what its rain no longer held`;
    case "warming":
      return sea
        ? `the warming moved its cold water, and ${they} went with it`
        : `the warming moved its rain and its warmth, and ${they} went with it`;
    case "felled":
      return sea
        ? `its people cut them and cleared the shelf`
        : `its people felled them and cleared the ground`;
    case "fire":
      return `fire went through them`;
  }
}
