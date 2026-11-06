// A land's creatures as its map draws them (Z1): which kinds, how many, the way they go across it, when; where they live; a beast at large. All a reading of what
// the world keeps: asked for, never told back.
import type { BeastPlan } from "./village.ts";

/** How a kind's way across a land goes through the year: its place along its whole way, how wide a stretch of it this land is; `still`: it stays the year round. */
export type HerdPass = {
  readonly rank: number;
  readonly width: number;
  readonly still?: true;
  /** The way it goes on a land's map at the warm of the year (a unit, in the map's own x and z). */
  readonly way: readonly [number, number];
};

export type LandHerd = HerdPass & {
  /** Its page. */
  readonly ref: string;
  readonly name: string;
  readonly niche: string;
  readonly size: number;
  readonly wool: boolean;
  readonly body: BeastPlan | null;
  /** How many are drawn. */
  readonly n: number;
};

export type LandDen = {
  readonly ref: string;
  readonly kind: "den" | "burrow" | "roost" | "nest";
  /** Its own draw, for where on the land's ground it lies. */
  readonly key: number;
  readonly name: string;
};

export type LandBeast = {
  readonly ref: string;
  readonly name: string;
  readonly kind: string;
  readonly size: number;
  readonly wool: boolean;
  readonly body: BeastPlan | null;
  /** The tile of the town that knows it. */
  readonly tile: number;
};

export type LandHerds = {
  readonly cell: number;
  /** Changes when what is drawn does. */
  readonly key: string;
  readonly herds: readonly LandHerd[];
  readonly dens: readonly LandDen[];
  readonly beast: LandBeast | null;
  /** A people of the water's: they swim, and its dens lie on the sea's floor. */
  readonly undersea: boolean;
};
