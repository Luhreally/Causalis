// The wars of the year as the globe draws them (Phase 9 M87): each war's sides in their
// colours, the men each fields and its arms (their counters, Phase 11 M101), the land its host
// marches from and the land it marches for (fine-grid spots), and the battles fought lately —
// where, whether the attacker won, how many fell.
import type { Arms } from "./arms.ts";
import type { BattleOutcome } from "./battle.ts";
import type { VillagePlan } from "./village.ts";

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

/** How near a land's middle its heart lies (km). */
export const HEART_REACH = 60;

/**
 * A land's heart, where the battles for it are fought before and its sieges laid about: the greatest
 * of its towns within HEART_REACH of its middle, else the town nearest that (a land's greatest town
 * lies a median 95 km from its map's middle on "first light" in year 120, often at the map's edge;
 * its nearest, 31 km).
 */
export function heartTown<T extends { x: number; z: number; population: number; ref: string }>(
  towns: readonly T[],
): T | null {
  let best: T | null = null;
  for (const t of towns)
    if (
      Math.hypot(t.x, t.z) <= HEART_REACH &&
      (!best ||
        t.population > best.population ||
        (t.population === best.population && t.ref < best.ref))
    )
      best = t;
  if (best) return best;
  for (const t of towns) if (!best || Math.hypot(t.x, t.z) < Math.hypot(best.x, best.z)) best = t;
  return best;
}

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
  /** Whose soldiers they are: the world's people's figure (Phase 34: their heads in their own hide). */
  readonly body?: VillagePlan["body"];
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
    /**
     * Where its next battle will be fought, as things stand (Phase 40 M203: the land its attacker
     * wants most now, as history will choose it at the year's turn; null: none, or the war over),
     * and the attacker's land nearest it (where its host musters for it).
     */
    readonly next?: number | null;
    readonly muster?: number;
    /** Each side's seat (spots; -1: none). */
    readonly seats?: { readonly attacker: number; readonly defender: number };
    /** The names of the lands it is fought over and from, by their spots ("Lithiv's land"). */
    readonly places?: readonly { readonly spot: number; readonly name: string }[];
    readonly battles: readonly {
      readonly spot: number;
      readonly year: number;
      readonly won: boolean;
      readonly fallen: number;
      /** Its wounded who lived, both sides together (Phase 55; absent in older saves). */
      readonly wounded?: number;
      readonly event: string;
      /** The land its host came on it from (a war watched unfolding, M195: its masses face that way). */
      readonly from?: number;
      /** What it won: the field, a siege laid, a land taken, a seat stormed — or held (M203). */
      readonly outcome?: BattleOutcome;
      /** Whether it was fought at the defender's seat, about its walls. */
      readonly seat?: boolean;
    }[];
  }[];
};
