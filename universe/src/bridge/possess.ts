// One of a town's people possessed (Phase 60): what the page sends to take a body, steer it a second
// at a time and let it go (the commands `possess.take`, `possess.input`, `possess.release`), and what
// the host answers of the small world about it (the queries `possess.now`, `possess.live`). The page
// builds the scene from what it draws (view/possess.ts) and draws the bodies the host steps; the
// host keeps the world (sim/hand/possess.ts) and tells it in words (host/possess.ts).

/** Where a body is drawn, and how it goes: metres from the town's middle, radians, the view's task (view/village.ts TASKS' index; -1 none), its walking pace (m/s). */
export type PossessAt = {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly task: number;
  readonly pace: number;
};

/** One of the hand's people near the one taken: who (Agent.id), where, and their day's way ahead — step, x, z, yaw, task each (at most twelve). */
export type PossessNear = PossessAt & { readonly id: number; readonly ways: readonly number[] };

/** One coming into the small world at a step of the second sent (0 … 19); one in it already takes the way given. */
export type PossessJoin = PossessNear & { readonly when: number };

/** A place of the town's work or stores (rules/possess.ts WorkPlace): its kind, where one stands at it, which way they face; a field row's breadth and depth. */
export type PossessPlace = {
  readonly kind: "forge" | "wheel" | "loom" | "row" | "granary" | "rack" | "boards" | "shop";
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly w?: number;
  readonly d?: number;
};

/** `possess.take`: the one taken and where; his trade and the day's thing it makes ("" none); those near; the town's solids (seven numbers each, view/ground.ts Solid) and places. */
export type PossessTakeArgs = {
  readonly agent: number;
  readonly at: PossessAt;
  readonly trade: string;
  readonly form: string;
  readonly near: readonly PossessNear[];
  readonly solids: readonly number[];
  readonly places: readonly PossessPlace[];
};

/** `possess.input` (twenty bids exactly) and `possess.release` (at most twenty): the step they begin at, the bids in letters, those joining. */
export type PossessInputArgs = {
  readonly step: number;
  readonly steps: string;
  readonly joins?: readonly PossessJoin[];
};

/** The one possessed and the town about him, as taken (`possess.now`; null: no one is). */
export type PossessNow = {
  readonly agent: number;
  /** His page ("agent:<id>"), his name, his town's ref and name. */
  readonly ref: string;
  readonly name: string;
  readonly town: string;
  readonly townName: string;
  /** The world's moment he was taken at; the step kept (seconds sent × 20). */
  readonly from: number;
  readonly step: number;
  /** Where he was taken: the middle of where he may go (metres). */
  readonly x: number;
  readonly z: number;
  readonly trade: string;
  readonly form: string;
  readonly places: readonly PossessPlace[];
  /** Those in the small world now (Agent.id), him first. */
  readonly bodies: readonly number[];
  readonly ended: string;
};

/** A body of the small world as the page draws it. */
export type PossessBody = {
  /** The hand's person it is (Agent.id). */
  readonly id: number;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  /** How it moves (m/s): the page carries it on between the steps it is told. */
  readonly vx: number;
  readonly vz: number;
  /** What it is doing (rules/possess.ts BODY_DOINGS: "way", "hand", "work", "talk"…). */
  readonly doing: string;
  /** The view's task it stands at (view/village.ts TASKS' index; -1 none). */
  readonly task: number;
  /** What it carries, as a figure carries it (view/work.ts CARRIES: "tool", "sack", "pots", "cloth", "sheaf"); null nothing. */
  readonly carry: string | null;
  /** A word over it ("💬", "Thief!"); "" none. */
  readonly say: string;
};

/** One of the four acts under the right thumb, always in its own place: what it is, whether it can be done now, and why or why not in words. */
export type PossessOffer = {
  /** The act's code (rules/possess.ts HAND_ACT), sent in the bid. */
  readonly act: number;
  readonly icon: string;
  readonly label: string;
  readonly can: boolean;
  readonly words: string;
};

/** The strip at the top while possessed: who he is, what, his strength left, what he carries, his body in a line. */
export type PossessStrip = {
  readonly name: string;
  /** "a smith of Sairis, 34" */
  readonly what: string;
  /** Strength left: 0 … 1. */
  readonly strength: number;
  readonly carries: string;
  /** His body in a line ("whole"; "struck: his left arm"): the slot wave 5's Body model draws into. */
  readonly body: string;
};

/** The small world as the host steps it ahead by the bids not yet sent (`possess.live`). */
export type PossessLive = {
  /** The step it stands at; the step kept (the last second sent ends at it). */
  readonly step: number;
  readonly kept: number;
  /** Its bodies, the one possessed first. */
  readonly bodies: readonly PossessBody[];
  /** Things lying on the ground: where, what, as a figure would carry it. */
  readonly lying: readonly {
    readonly x: number;
    readonly z: number;
    readonly what: string;
    readonly carry: string | null;
  }[];
  readonly offers: readonly PossessOffer[];
  /** What the last act came to, in words, at which step, and whether it went as bid (null: nothing yet). */
  readonly told: { readonly words: string; readonly step: number; readonly good: boolean } | null;
  readonly strip: PossessStrip;
  /** What he has done so far: things made, those struck down, words, goods taken. */
  readonly deeds: {
    readonly made: number;
    readonly struck: number;
    readonly spoke: number;
    readonly took: number;
  };
  /** Why it ended ("": it goes on; "down": he was struck down). */
  readonly ended: string;
};
