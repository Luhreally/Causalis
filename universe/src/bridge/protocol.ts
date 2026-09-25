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
  | { readonly kind: "import"; readonly id: number; readonly bytes: Uint8Array }
  /** Run the world to a time at once (tests, tools and the skip). */
  | { readonly kind: "advance"; readonly id: number; readonly to: number };

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

export type ToMain =
  | FrameMessage
  | { readonly kind: "reply"; readonly id: number; readonly ok: true; readonly value: unknown }
  | { readonly kind: "reply"; readonly id: number; readonly ok: false; readonly error: string }
  | { readonly kind: "update"; readonly id: number; readonly t: number; readonly value: unknown }
  | Status
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
