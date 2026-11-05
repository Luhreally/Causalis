// A fight among the stars as the view reads it (Phase 67): who fought, what each had, where, and what
// the record says came of it. Plain data, made by host/starfight.ts from what history holds; the ships,
// their places and their fates are the view's, hashed from `id`, and never enter history.
import type { Visitor } from "./village.ts";
import type { HostKinds } from "./wars.ts";

export type FightRgb = readonly [number, number, number];
/** A realm's war on another people (`space.starwars`), or a people's fleet raiding (`peoplesOf().raids`). */
export type FightRoad = "starwar" | "raid";
export type FightArm = "beam" | "missile";
/** What a side has in the sky: a fleet, platforms in orbit and no ships, or nothing. */
export type FightSky = "fleet" | "platforms" | "none";
export type FightDrive = "none" | "fusion" | "sail" | "antimatter";

export type FightSide = {
  /** Its page: `pol:…` or `civ:…`. */
  readonly ref: string;
  readonly kind: "realm" | "people";
  /** Short: "Shisten", "the Kregraanok". */
  readonly name: string;
  /** Who they are, in a few words: "the commonwealth of Mothonanon", "trunked giants, 29.9 light-years out". */
  readonly words: string;
  readonly color: FightRgb;
  /** The record's number (the battle event's, to a tenth). */
  readonly strength: number;
  /** What history says the fleet cost in machines (null: it gives only a strength). */
  readonly machines: number | null;
  /** Its home world's pull (g), what its body lives in, its lineage (null: not known). */
  readonly gravity: number;
  readonly medium: "land" | "shore" | "water";
  readonly clade: string | null;
  readonly drive: FightDrive;
  readonly arm: FightArm;
  /** Which beam arm it is, for its colour (armLook): null where it fires missiles. */
  readonly beamArm: "beam-rifle" | "beam-lance" | null;
  /** Whether machine minds fly its ships. */
  readonly minds: boolean;
  readonly sky: FightSky;
};

/** Where it was fought: a world of another star, or over a land of the home world. */
export type FightPlace =
  | {
      readonly kind: "foreign";
      readonly star: string;
      readonly planet: number;
      readonly words: string;
    }
  | { readonly kind: "home"; readonly cell: number; readonly spot: number; readonly words: string };

/** A raid that came down: the only kind of star war the record carries to the ground. */
export type StarLanding = {
  /** The town (`town:0:n`) and its name, its land, its people as it stands now. */
  readonly town: string;
  readonly townName: string;
  readonly cell: number;
  readonly people: number;
  /** The record's dead, in the whole land. */
  readonly dead: number;
  /** The share of the land's homes it burned (peoples.ts: 0.1). */
  readonly razed: number;
  readonly raiders: {
    readonly ref: string;
    readonly name: string;
    readonly kind: string;
    readonly body: Visitor["body"];
    readonly color: FightRgb;
  };
  readonly defenders: {
    readonly ref: string;
    readonly name: string;
    readonly color: FightRgb;
    /** Its host's kinds in the raid's year (host/arms.ts: hostKinds). */
    readonly host: HostKinds | null;
  };
};

export type StarFightPlan = {
  /** A war's `swar:0:n`, or a raid's event ref. */
  readonly id: string;
  readonly road: FightRoad;
  readonly year: number;
  readonly sailed: number;
  readonly attacker: FightSide;
  readonly defender: FightSide;
  /** Whether the attacker won. */
  readonly won: boolean;
  readonly place: FightPlace;
  /** The page of the fight itself (an event). */
  readonly event: string;
  /** The war's page, where it is a war's. */
  readonly war: string | null;
  /** The record's own sentence of what happened. */
  readonly claim: string;
  /** The record's own sentence of why. */
  readonly why: string;
  readonly landing: StarLanding | null;
  /** The world's year now, in which the town is drawn. */
  readonly nowYear: number;
};

/** One row of the list of fights. */
export type StarFightEntry = {
  readonly id: string;
  readonly road: FightRoad;
  readonly year: number;
  readonly attacker: string;
  readonly defender: string;
  readonly attackerColor: FightRgb;
  readonly defenderColor: FightRgb;
  readonly won: boolean;
  readonly strength: number;
  readonly defence: number;
  /** The record's dead (0: none recorded). */
  readonly dead: number;
  /** The town it came down on (null: it stayed in the sky). */
  readonly town: string | null;
  /** Whether both sides had something in the sky to fight with. */
  readonly ships: boolean;
  readonly claim: string;
  /** The page to open from its name. */
  readonly page: string;
};

export type StarFightList = {
  /** Newest first, at most 60; every one that came down is kept. */
  readonly fights: readonly StarFightEntry[];
  /** How many have been fought, in all. */
  readonly total: number;
  /** How many fleets are still under way. */
  readonly open: number;
  /** The one best to watch (null: none fought). */
  readonly best: string | null;
  /** The first fought in this world's history (null: none), and its year. */
  readonly first: string | null;
  readonly firstYear: number | null;
};
