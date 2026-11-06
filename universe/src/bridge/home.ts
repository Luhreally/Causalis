// A home looked into (Lives L6): what the view is given to draw, read and furnished in the host when it is opened and let go when it
// is closed. Nothing of it is kept.

/** What a thing is made of, its shape and what a room is for, as rules/dwelling.ts names them (the bridge leans on no rules). */
export type DwellingStuff =
  | "wood"
  | "reed"
  | "hide"
  | "cloth"
  | "clay"
  | "metal"
  | "stone"
  | "earth"
  | "shell"
  | "glass"
  | "works"
  | "kelp"
  | "wax"
  | "none";
export type DwellingShape =
  | "bed"
  | "pallet"
  | "hollow"
  | "hearth"
  | "pit"
  | "stove"
  | "pot"
  | "jar"
  | "chest"
  | "table"
  | "mat"
  | "seat"
  | "longseat"
  | "lamp"
  | "bulb"
  | "loom"
  | "bench"
  | "wheel"
  | "tool"
  | "arm"
  | "shelf"
  | "rug"
  | "hanging"
  | "books"
  | "mirror"
  | "clock"
  | "screen"
  | "bath"
  | "basin"
  | "strongbox"
  | "coldbox"
  | "rubble"
  | "beam";
export type RoomUse = "all" | "hearth" | "sit" | "sleep" | "store" | "work" | "wash";
export type DwellingRoom = {
  readonly use: RoomUse;
  /** Its middle and its measures (metres): round rooms are as wide as `w`. */
  readonly x: number;
  readonly z: number;
  readonly w: number;
  readonly d: number;
  readonly round: boolean;
  /** Which floor it lies on (0 the lowest). */
  readonly floor: number;
};
export type DwellingWall = {
  readonly ax: number;
  readonly az: number;
  readonly bx: number;
  readonly bz: number;
};
export type DwellingThing = {
  /** Its number in the home: its page's. */
  readonly n: number;
  readonly need: string;
  readonly why: string;
  readonly way: string;
  readonly name: string;
  readonly stuff: DwellingStuff;
  readonly shape: DwellingShape;
  readonly coin: number;
  readonly room: number;
  /** Where it stands (metres), which way it turns, its measures. */
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly w: number;
  readonly d: number;
  readonly h: number;
};
export type Dwelling = {
  readonly rooms: readonly DwellingRoom[];
  readonly walls: readonly DwellingWall[];
  readonly things: readonly DwellingThing[];
  /** How far it spreads, each way from its middle (metres). */
  readonly halfW: number;
  readonly halfD: number;
  /** What was spent. */
  readonly spent: number;
};

export type HomeInside = {
  /** Its page. */
  readonly ref: string;
  readonly town: string;
  readonly townName: string;
  /** Its number (a lot of the town's plan, or past them for a village's ring), its lot (-1: none), its place among the plan's homes (-1: none). */
  readonly n: number;
  readonly lot: number;
  readonly home: number;
  readonly title: string;
  readonly line: string;
  readonly state: "stands" | "rising" | "fell" | "razed" | "open";
  readonly level: number;
  /** How many storeys it has and which one this family's is (0: it has the whole of it). */
  readonly storeys: number;
  readonly storey: number;
  readonly form: string;
  readonly walls: string;
  readonly roof: string;
  readonly pitch: number;
  /** World units to a metre of its rooms: a body drawn in them fits them. */
  readonly scale: number;
  readonly medium: "land" | "shore" | "water";
  /** What they can spend on what they keep, and what it comes to. */
  readonly coin: number;
  readonly spent: number;
  /** Those living there, as places in the plan's people. */
  readonly residents: readonly number[];
  readonly noHouses: boolean;
  readonly dwelling: Dwelling;
};

/** A town's homes as its lens colours them (Lives L6): read off the one reckoning, nothing kept. */
export type HomeMoney = {
  readonly town: string;
  readonly year: number;
  /** Each home or ruin drawn, by its number: a lot's, or past any lot one of a village's ring. */
  readonly n: readonly number[];
  /** What each can spend, in coin (below nothing: a ruin). */
  readonly coin: readonly number[];
  /** 1: its people pay to live there. */
  readonly lets: readonly number[];
  /** How many homes stand at each of `words`, and how many are ruins. */
  readonly counts: readonly number[];
  readonly ruins: number;
  readonly words: readonly string[];
  /** The town's own spread, the ramp's two ends, in coin: from nearly its least to nearly its most. */
  readonly lo: number;
  readonly hi: number;
  /** Who holds them, as the law of land says: all a lord's, all leased, all their own, some of each; halls; not told; none stand. */
  readonly tenure: "lord" | "leased" | "owned" | "mixed" | "halls" | "untold" | "none";
};
