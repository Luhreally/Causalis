// A town entered, three ways (town mode; asked 2026-11-25: "an auto management and like gameplay mode where i just
// observe the sim too"): by hand, as it was; watched, with no order given and the eye led to what happens; or run by the
// town's own head, who gives the very orders a player would. Which, is kept with the town's place (host/place.ts), out
// of the world's hash. What the host tells the page of each is here.

/** How a town entered is run: by the player's hand, by no one (watched), by its own head (stewarded). */
export const PLACE_MODES = ["hand", "watch", "steward"] as const;
export type PlaceMode = (typeof PLACE_MODES)[number];

/** Something worth the eye in a place: when (its clock), said in a line, and where. */
export type PlaceSight = {
  readonly t: number;
  readonly words: string;
  /** Who it is of (their number in the place; null: no one living), and the lot it is at (bridge/place.ts PLACE_AT). */
  readonly id: number | null;
  readonly lot: number;
  /** Where that is, said ("At the smithy", "In the fields"). */
  readonly where: string;
  /** The page that tells more (null: none). */
  readonly ref: string | null;
  /** How seldom its kind has come in this town, as far as its log remembers: the seldomer, the more it is worth the eye (0 … 1). */
  readonly rare: number;
  /** Until when it goes on (its clock; a fire fought, a burial held), where it does. */
  readonly until?: number;
};

/** An order the town's head would give now (sim/town/managed.ts), with the reason it is given for. */
export type StewardOrder = {
  readonly type: string;
  readonly args: Record<string, unknown>;
  /** What it is of, by which it is found again ("respond:firebreaks", "prio:412", "site:3", "shelter"). */
  readonly key: string;
  readonly why: string;
};

/** What a town watched, or stewarded, tells the page a few times a second. */
export type PlaceWatch = {
  readonly mode: PlaceMode;
  readonly t: number;
  /** What happened since the moment asked from, the oldest first; and what goes on now (a fire, a burial). */
  readonly sights: readonly PlaceSight[];
  /** The town's head, who stewards it: by name, their page, who they are in the place (null: it has none living). */
  readonly head: {
    readonly name: string;
    readonly ref: string;
    readonly id: number | null;
    /** What they are like, in a few words ("cautious, thrifty"). */
    readonly temper: string;
  } | null;
  /** The orders its head has decided on that have yet to be given (stewarded only). */
  readonly orders: readonly StewardOrder[];
  /** Whether it has orders standing (a town watched lives by those given it before, until they are taken back). */
  readonly managed: boolean;
};

/** One of a place's people the eye may go with: who, by name, what they are at and why, in words. */
export type PlaceWatched = {
  readonly id: number;
  readonly ref: string;
  readonly name: string;
  readonly words: string;
  readonly lot: number;
};
