// The wars of the year as the globe draws them (Phase 9 M87): each war's sides in their
// colours, the men each fields and its arms (their counters, Phase 11 M101), the land its host
// marches from and the land it marches for (fine-grid spots), and the battles fought lately —
// where, whether the attacker won, how many fell.
import type { Arms } from "./arms.ts";

/**
 * What a realm's host is made of (Phase 12 M110): what it strikes with (a spear, a sword, a
 * bow…), what guards it (a shield, mail…), what carries it (its feet, horses, chariots) — its
 * design's parts, by their ids.
 */
export type HostKinds = { readonly arm: string; readonly guard: string; readonly mount: string };

/** A side of a war: its realm, its name and colour, the men it fields, its arms, its host's kinds. */
export type WarSide = {
  readonly ref: string;
  readonly name: string;
  readonly color: readonly [number, number, number];
  readonly fields: number;
  readonly arms: Arms | null;
  readonly host: HostKinds | null;
};

/** A realm at peace, its garrison standing at its seat (Phase 12 M110). */
export type Garrison = {
  readonly realm: string;
  readonly name: string;
  readonly color: readonly [number, number, number];
  /** Its seat: a spot of the globe's fine grid. */
  readonly spot: number;
  readonly fields: number;
  readonly host: HostKinds | null;
};

export type WarsMap = {
  readonly year: number;
  /** The realms at peace, the greatest first, their garrisons at their seats. */
  readonly garrisons: readonly Garrison[];
  readonly wars: readonly {
    readonly ref: string;
    readonly attacker: WarSide;
    readonly defender: WarSide;
    /** Where the attacker's host sets out (its land nearest what it wants), and what it wants. */
    readonly from: number;
    readonly to: number;
    readonly declared: number;
    /** The year it ended (null: still fought). */
    readonly ended: number | null;
    /** The defender's seat, if it is under siege (a victory there, the seat still held): its spot. */
    readonly siege: number | null;
    readonly battles: readonly {
      readonly spot: number;
      readonly year: number;
      readonly won: boolean;
      readonly fallen: number;
      readonly event: string;
    }[];
  }[];
};
