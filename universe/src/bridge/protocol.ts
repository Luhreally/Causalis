// The protocol between the page and the simulation host (docs/architecture §30).
// In: commands, the camera's interest, queries, subscriptions, speed, saves.
// Out: presentation frames (designed for what is shown, carried in transferable
// typed arrays), replies, subscription updates, status and notices. Nothing that
// travels out can be used to write back; the only way in is a command.

/** What the camera is presenting: a view and its focus. Presentation only — it never changes history. */
export type Interest = {
  readonly view: string;
  readonly focus: string | null;
  readonly params?: Readonly<Record<string, unknown>>;
};

export type Query = { readonly type: string; readonly args?: unknown };

export type FrameArray = Float32Array | Float64Array | Int32Array | Uint32Array | Uint8Array;

export type ToHost =
  | {
      readonly kind: "start";
      readonly id: number;
      readonly universe: string;
      readonly seed: string;
    }
  | { readonly kind: "command"; readonly id: number; readonly type: string; readonly args: unknown }
  | { readonly kind: "speed"; readonly secondsPerSecond: number }
  | { readonly kind: "interest"; readonly interest: Interest }
  | { readonly kind: "query"; readonly id: number; readonly query: Query }
  | {
      readonly kind: "subscribe";
      readonly id: number;
      readonly query: Query;
      readonly everyMs: number;
    }
  | { readonly kind: "unsubscribe"; readonly id: number }
  | { readonly kind: "save"; readonly id: number; readonly name: string }
  | { readonly kind: "load"; readonly id: number; readonly name: string }
  | { readonly kind: "export"; readonly id: number }
  /** The saves kept: each one's world, time and size. */
  | { readonly kind: "saves"; readonly id: number }
  /** A kept world put away for good: both its slots and its index. */
  | { readonly kind: "deleteSave"; readonly id: number; readonly name: string }
  /** Whether life arises on a seed's world, and people in time (no world need be running). */
  | { readonly kind: "life"; readonly id: number; readonly universe: string; readonly seed: string }
  /** What a seed's world allows, read from what it holds (no world need be running: Phase 65). */
  | {
      readonly kind: "reading";
      readonly id: number;
      readonly universe: string;
      readonly seed: string;
    }
  /** Whether a seed is worth reading for an age: a glance, far cheaper than reading it. */
  | {
      readonly kind: "glance";
      readonly id: number;
      readonly universe: string;
      readonly seed: string;
      readonly target: string;
    }
  /** The rules a universe's worlds now run by, for a catalogue run under them or under others. */
  | { readonly kind: "ruleset"; readonly id: number; readonly universe: string }
  | { readonly kind: "import"; readonly id: number; readonly bytes: Uint8Array }
  /** Run the world to a time at once (tests, tools and the skip). */
  | { readonly kind: "advance"; readonly id: number; readonly to: number }
  /**
   * Run the world to a time a little each turn, telling how far it has come ("jumping"), answered
   * when it arrives or is stopped: for a far year, behind a screen that says so (Phase 63).
   */
  | { readonly kind: "jump"; readonly id: number; readonly to: number }
  /** Stop a jump where it stands (the world is whole there, and may be taken up from there). */
  | { readonly kind: "jumpStop" };

export type FrameMessage = {
  readonly kind: "frame";
  readonly view: string;
  readonly seq: number;
  readonly t: number;
  readonly meta: unknown;
  readonly arrays: Readonly<Record<string, FrameArray>>;
};

export type Status = {
  readonly kind: "status";
  readonly universe: string | null;
  readonly seed: string | null;
  readonly t: number;
  /** Requested sim seconds per real second (0 = paused). */
  readonly speed: number;
  /** Sim seconds per real second actually achieved over the last second. */
  readonly achieved: number;
  /** Milliseconds of simulation work in the last pump. */
  readonly stepMs: number;
};

/** How far a jump has come: the world's time, where it is bound, the work so far (ms). */
export type JumpProgress = {
  readonly kind: "jumping";
  readonly t: number;
  readonly to: number;
  readonly ms: number;
};

export type ToMain =
  | FrameMessage
  | { readonly kind: "reply"; readonly id: number; readonly ok: true; readonly value: unknown }
  | { readonly kind: "reply"; readonly id: number; readonly ok: false; readonly error: string }
  | { readonly kind: "update"; readonly id: number; readonly t: number; readonly value: unknown }
  | Status
  | JumpProgress
  | { readonly kind: "notice"; readonly text: string; readonly ref: string | null };

/** One end of a message channel: a worker, the worker's own scope, or an in-thread pair. */
export interface Port<In, Out> {
  post(message: Out, transfer?: Transferable[]): void;
  onMessage(handler: (message: In) => void): void;
  close(): void;
}

/** The typed arrays of a frame, to hand over (not copy) when it is posted. */
export function frameTransfer(frame: FrameMessage): Transferable[] {
  return Object.values(frame.arrays).map((a) => a.buffer as ArrayBuffer);
}

/**
 * Whether life arises on a seed's world: any living thing, and a people in time; and, where none
 * does, why, in a few words ("its seas frozen over, −32 °C on average").
 */
export type SeedLife = {
  readonly living: boolean;
  readonly peopled: boolean;
  readonly words: string;
  /**
   * The world it makes (Phase 35, for a new world's form): its star's class and warmth (kelvin),
   * its pull (g), its mean warmth (°C), the share of it under sea; and its kind, where it is not a
   * rocky world ("🟠 a methane world": Phase 56).
   */
  readonly world?: {
    readonly star: string;
    readonly kelvin: number;
    readonly gravity: number;
    readonly warmth: number;
    readonly seas: number;
    readonly kind?: string;
  };
};

/** What a seed's world allows of an age, read from what it holds (Phase 65: "Can it?"). */
export type SeedAge = {
  readonly id: string;
  readonly icon: string;
  /** The age, as this world's means would name it. */
  readonly name: string;
  readonly allowed: boolean;
  /** Why it is open, or what shuts it. */
  readonly why: string;
  /** What would slow it, where it is open. */
  readonly hard?: string;
};

/** What a seed's matter could later do: a function asked of it, met or not (Phase 65). */
export type SeedFunction = {
  readonly id: string;
  readonly icon: string;
  readonly name: string;
  readonly later: boolean;
  readonly met: boolean;
  readonly why: string;
};

/** "Can it?": a seed's world read with no history run: what it holds, and the ages that allows. */
export type SeedReading = {
  readonly universe: string;
  readonly seed: string;
  readonly living: boolean;
  readonly peopled: boolean;
  /** Why not, where it is not peopled. */
  readonly words: string;
  readonly world?: SeedLife["world"];
  /** How many lands its first people reach. */
  readonly lands: number;
  readonly medium: string;
  readonly fire: boolean;
  readonly kind: string;
  readonly ages: readonly SeedAge[];
  /** The furthest age it allows (null: none). */
  readonly furthest: string | null;
  readonly functions: readonly SeedFunction[];
};

/** A save as the saves page lists it: which world, how far on, how big, under how many rulesets. */
export type SaveMeta = {
  readonly name: string;
  readonly universe: string;
  readonly seed: string;
  /** The world's time, seconds. */
  readonly t: number;
  readonly bytes: number;
  /** How many rulesets its history has run under (more than one: carried to newer rules). */
  readonly rulesets: number;
  /** When it was written (the device's clock, milliseconds; for ordering the list only). */
  readonly savedAt: number;
  readonly count: number;
};
