// A fight of the underworld watched (asked for 2026-11-16: "why cant I click to watch gang wars yet either? like they recorded but
// i cant watch?"): what history says of one — a war between two crime groups over a rent, soldiers sent against a group and their
// clashes with it, two federations of street gangs standing against each other — read off the event that tells it and the records
// kept of its groups: who, how many of their men were in that land, what they carry, how many died, and who came out holding it.
// Looked at, never lived: the scene drawn of it is the eye's, and what it shows dying and winning is what history says.
import type { Arms } from "./arms.ts";
import type { HostKinds } from "./wars.ts";

/** What kind of fight: a war over a rent, soldiers in a quarter, street gangs. */
export type StreetFightKind = "turf" | "army" | "street";

/** One side of it: a crime group, the realm's soldiers, a crew of its own enforcers, a federation's gangs. */
export type StreetFightSide = {
  /** Its page (a group's, a federation's, an operation's), its name as told, and its colour. */
  readonly ref: string;
  readonly name: string;
  readonly color: readonly [number, number, number];
  readonly as: "gang" | "soldiers" | "badge" | "street";
  /** Its men in that land, as history counts them, and of them (or with them) those who fell. */
  readonly men: number;
  readonly fallen: number;
  /** Its realm's arms (its heraldry) where it is the realm's or armed as well as its soldiers, and the kinds a figure is armed by. */
  readonly arms: Arms | null;
  readonly host: HostKinds | null;
  /** That in words: "arms as good as the realm's soldiers, armoured carriers"; "the realm's arms". */
  readonly gear: string;
};

export type StreetFight = {
  /** The event that tells it, and the page the scene opens. */
  readonly event: string;
  readonly page: string;
  readonly kind: StreetFightKind;
  /** "The Varro family against the Grey crew"; where and when. */
  readonly title: string;
  readonly year: number;
  readonly cell: number;
  readonly land: string;
  /** The town it is seen in: the greatest of its land's. */
  readonly town: string;
  readonly townName: string;
  readonly sides: readonly [StreetFightSide, StreetFightSide];
  /** Those killed who were of neither side (caught between), where history counts them; else 0. */
  readonly others: number;
  /** Who came out holding it (null: neither, or not yet: still fought when it was read). */
  readonly won: 0 | 1 | null;
  /** Still under way as the world stands. */
  readonly open: boolean;
  /** What it was, who, what it cost and what came of it — never how it was fought. */
  readonly words: {
    readonly what: string;
    readonly who: string;
    readonly cost: string;
    readonly effect: string;
  };
};

/** The events a fight of the underworld is watched from. */
export const STREET_FIGHT_TYPES: readonly string[] = [
  "underworld.war",
  "underworld.pax",
  "underworld.clash",
  "underworld.operation",
  "underworld.army-took",
  "underworld.feud",
];
