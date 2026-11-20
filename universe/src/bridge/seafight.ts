// A meeting of fleets watched (2026-11-19, the audit's "a battle at sea is a number": sim/war/fleets.ts keeps each as a thing).
// What history says of one: its two fleets, their tonnes as they met and what each lost, each one's flagship and who commanded,
// what each side's shipwrights knew that year, and who held the sea after. Looked at, never lived: the hulls drawn are the
// eye's, as many as its tonnes make of the ships its wrights could build, and those that go down are as many as history sank.

/** What a people's ships are, by what its shipwrights know: oars and a sail, planked hulls, ships that keep the sea, steam, hulls from its works. */
export type SeaRig = "oared" | "planked" | "tall" | "steam" | "works";

export type SeaFightSide = {
  readonly ref: string;
  readonly name: string;
  readonly color: readonly [number, number, number];
  /** Its tonnes as the fleets met, and those sunk. */
  readonly tons: number;
  readonly sunk: number;
  /** Its flagship (empty: it kept none), and whether she went down. */
  readonly flagship: string;
  readonly flagLost: boolean;
  /** Who commanded it (null: no one the world keeps by name), and their page where they are still kept. */
  readonly led: string | null;
  readonly ledRef: string | null;
  readonly rig: SeaRig;
  /** Whether its people knew powder: its ships fight with guns, from apart (else: hull to hull). */
  readonly guns: boolean;
  /** That in words: "tall ships with guns". */
  readonly ships: string;
};

export type SeaFightNear = {
  readonly event: string;
  readonly war: string;
  /** "The fleets of Lithiv and Pounholt meet"; when, and off which land (null: the open sea). */
  readonly title: string;
  readonly year: number;
  readonly cell: number | null;
  readonly off: string | null;
  readonly sides: readonly [SeaFightSide, SeaFightSide];
  readonly won: 0 | 1;
  /** The world's kind: its sea is that kind's liquid, and drawn in its colour. */
  readonly kind: string;
};

/** The event a meeting of fleets is watched from. */
export const SEA_FIGHT_TYPE = "war.fleet";
