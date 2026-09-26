// The simulation host (docs/architecture §3, §30). It owns the world, runs it at
// the requested speed within a time budget per pump, and answers the protocol.
//
//  - Messages are handled only between moments: a query never sees half a moment.
//  - The wall clock sets how far the world should get, never what happens on the
//    way: stepping to any sequence of targets gives the same history (the
//    scheduler's guarantee), so pacing can change with the device and the frame.
//  - Interest, queries, subscriptions and frames only read. The purity test holds
//    the host to that.
import {
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  type SaveDocument,
  type Seed,
  type World,
} from "../kernel/index.ts";
import { spine, why, type Explanation } from "../causal/index.ts";
import {
  frameTransfer,
  type FrameArray,
  type FrameMessage,
  type Interest,
  type Port,
  type Query,
  type ToHost,
  type ToMain,
} from "../bridge/index.ts";
import { SaveSlots, decodeSave, encodeSave, type ByteStore } from "./storage.ts";

/** A frame's content. A `key` equal to the last frame sent for the view means nothing changed: it is not sent again. */
export type FramePayload = {
  readonly meta: unknown;
  readonly arrays: Record<string, FrameArray>;
  readonly key?: string;
};
export type FrameBuilder = (world: World, interest: Interest) => FramePayload;
export type QueryHandler = (world: World, args: unknown) => unknown;

/** A kind of universe the host can run: how to build it from a seed, and how to show and ask it. */
export type Universe = {
  readonly name: string;
  /** Part of the ruleset id; bump when the universe's rules change. */
  readonly version: string;
  readonly build: (seed: Seed) => World;
  readonly frames: Readonly<Record<string, FrameBuilder>>;
  readonly queries: Readonly<Record<string, QueryHandler>>;
  /**
   * Work that can be done early in spare time without changing anything the world
   * will do (warming pure caches); returns whether it found any. Optional.
   */
  readonly idle?: (world: World) => boolean;
  /** The view shown before the page says otherwise. */
  readonly defaultView: string;
};

export type HostOptions = {
  /** Milliseconds, for pacing only (performance.now in the worker, a fake in tests). */
  readonly clock: () => number;
  readonly storage?: ByteStore;
  /** Work budget per pump in milliseconds. */
  readonly budgetMs?: number;
  readonly frameEveryMs?: number;
  readonly statusEveryMs?: number;
};

type Subscription = {
  readonly query: Query;
  readonly everyMs: number;
  last: number;
  lastValue: string;
};

/** An explanation as plain data, expanded to a depth. */
export type WhyNode = {
  readonly ref: string;
  readonly claim: string;
  readonly basis: string;
  readonly t: number | null;
  readonly causes: readonly {
    readonly ref: string;
    readonly role: string;
    readonly weight: number;
    readonly node: WhyNode | null;
  }[];
};

export function serializeWhy(e: Explanation, depth: number): WhyNode {
  return {
    ref: e.ref,
    claim: e.claim,
    basis: e.basis,
    t: e.t,
    causes: e.causes.map((c) => ({
      ref: c.cause.ref,
      role: c.cause.role,
      weight: c.cause.weight,
      node: depth > 0 ? serializeWhy(c.next(), depth - 1) : null,
    })),
  };
}

/** Queries every universe answers. */
const BUILTIN_QUERIES: Record<string, QueryHandler> = {
  now: (world) => ({ t: world.now, checkpoints: world.checkpoints().length }),
  why: (world, args) => {
    const { ref, depth } = args as { ref: string; depth?: number };
    return serializeWhy(why(world, ref as never), Math.min(depth ?? 2, 8));
  },
  spine: (world, args) =>
    spine(world, (args as { ref: string }).ref as never).map((e) => ({
      ref: e.ref,
      claim: e.claim,
      basis: e.basis,
      t: e.t,
    })),
  "events.recent": (world, args) => {
    const n = Math.min((args as { n?: number } | undefined)?.n ?? 20, 200),
      all = world.events.all();
    return all.slice(-n).map((e) => ({
      id: e.id,
      t: e.t,
      type: e.type,
      importance: e.importance,
      place: e.place,
      causes: e.causes.map((c) => c.ref),
    }));
  },
  checkpoints: (world) => world.checkpoints().map((c) => ({ t: c.t, chain: c.chain })),
  hashes: (world) => world.domainHashes(),
};

export class SimHost {
  private readonly port: Port<ToHost, ToMain>;
  private readonly universes: Readonly<Record<string, Universe>>;
  private readonly options: Required<Omit<HostOptions, "storage">> & { storage: ByteStore | null };
  private universe: Universe | null = null;
  private world: World | null = null;
  private lineage: SaveDocument["lineage"] | undefined;
  private interest: Interest | null = null;
  private speed = 0;
  private simTarget = 0;
  private steps: Generator<void, void, void> | null = null;
  private stepsTarget = -1;
  private readonly inbox: ToHost[] = [];
  private readonly subscriptions = new Map<number, Subscription>();
  private lastPump: number;
  private lastFrame = -Infinity;
  private lastStatus = -Infinity;
  private frameSeq = 0;
  private lastFrameKey: string | null = null;
  private achievedWindow: { at: number; t: number }[] = [];
  private stepMs = 0;
  private busy = false;

  constructor(
    port: Port<ToHost, ToMain>,
    universes: Readonly<Record<string, Universe>>,
    options: HostOptions,
  ) {
    this.port = port;
    this.universes = universes;
    this.options = {
      clock: options.clock,
      storage: options.storage ?? null,
      budgetMs: options.budgetMs ?? 8,
      frameEveryMs: options.frameEveryMs ?? 100,
      statusEveryMs: options.statusEveryMs ?? 250,
    };
    this.lastPump = options.clock();
    port.onMessage((m) => this.inbox.push(m));
  }

  /** True when nothing is waiting and the world is paused or caught up: the loop may sleep. */
  get idle(): boolean {
    return this.inbox.length === 0 && !this.busy && (this.speed === 0 || !this.world);
  }

  /** The world the host runs (tests and tools only; the page never sees it). */
  get currentWorld(): World | null {
    return this.world;
  }

  private reply(id: number, value: unknown, transfer?: Transferable[]): void {
    this.port.post({ kind: "reply", id, ok: true, value }, transfer);
  }
  private fail(id: number, error: unknown): void {
    this.port.post({
      kind: "reply",
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  private ruleset(): string {
    return rulesetId(this.world!, this.universe!.version);
  }

  private setWorld(universe: Universe, world: World, lineage?: SaveDocument["lineage"]): void {
    // A new kind of universe starts on its own view; a loaded save keeps the one on screen.
    if (!this.interest || this.universe?.name !== universe.name)
      this.interest = { view: universe.defaultView, focus: null };
    this.universe = universe;
    this.world = world;
    this.lineage = lineage;
    this.steps = null;
    this.stepsTarget = -1;
    this.simTarget = world.now;
    this.achievedWindow = [];
    this.lastFrameKey = null;
  }

  /** Finish the moment in progress, if any (queries, commands and saves need a whole moment). */
  private finishMoment(): void {
    if (!this.world || !this.steps) return;
    while (this.world.scheduler.midMoment) if (this.steps.next().done) break;
  }

  private dropSteps(): void {
    this.finishMoment();
    this.steps = null;
    this.stepsTarget = -1;
  }

  private async handle(m: ToHost): Promise<void> {
    try {
      switch (m.kind) {
        case "start": {
          const universe = this.universes[m.universe];
          if (!universe) throw new Error(`no universe ${m.universe}`);
          this.setWorld(universe, universe.build(seedFromText(m.seed)));
          this.reply(m.id, { ruleset: this.ruleset() });
          return;
        }
        case "speed":
          this.speed = Math.max(0, m.secondsPerSecond);
          if (this.world) this.simTarget = this.world.now;
          return;
        case "interest":
          this.interest = m.interest;
          this.lastFrame = -Infinity;
          this.lastFrameKey = null;
          return;
        case "unsubscribe":
          this.subscriptions.delete(m.id);
          return;
      }
      const world = this.world;
      if (!world) throw new Error("no universe is running");
      switch (m.kind) {
        case "command": {
          this.dropSteps();
          const c = world.submit(m.type, m.args);
          // Carry the world to the command's own moment, so it has taken hold when the
          // reply arrives, even while time is paused.
          world.runTo(c.t);
          this.simTarget = Math.max(this.simTarget, world.now);
          this.reply(m.id, { id: c.id, t: c.t });
          return;
        }
        case "query":
          this.reply(m.id, this.answer(m.query));
          return;
        case "subscribe":
          this.subscriptions.set(m.id, {
            query: m.query,
            everyMs: Math.max(50, m.everyMs),
            last: -Infinity,
            lastValue: "",
          });
          return;
        case "advance": {
          this.dropSteps();
          if (m.to > world.now) world.runTo(m.to);
          this.simTarget = world.now;
          // A jump is not the clock's pace: measure the pace afresh from here.
          this.achievedWindow = [];
          this.reply(m.id, { t: world.now });
          return;
        }
        case "save": {
          if (!this.options.storage) throw new Error("this host has no storage");
          this.dropSteps();
          const bytes = await new SaveSlots(this.options.storage, m.name).write(this.document());
          this.reply(m.id, { bytes });
          return;
        }
        case "load": {
          if (!this.options.storage) throw new Error("this host has no storage");
          const universe = this.universe!;
          const got = await new SaveSlots(this.options.storage, m.name).read((doc) =>
            this.load(universe, doc),
          );
          if (!got) throw new Error(`no readable save named ${m.name}`);
          this.reply(m.id, { t: got.value.now, fellBack: got.fellBack });
          return;
        }
        case "export": {
          this.dropSteps();
          const bytes = await encodeSave(this.document());
          this.reply(m.id, bytes, [bytes.buffer as ArrayBuffer]);
          return;
        }
        case "import": {
          const doc = await decodeSave(m.bytes);
          const universe = this.universe!;
          this.reply(m.id, { t: this.load(universe, doc).now });
          return;
        }
      }
    } catch (error) {
      if ("id" in m) this.fail(m.id, error);
      else
        this.port.post({
          kind: "notice",
          text: error instanceof Error ? error.message : String(error),
          ref: null,
        });
    }
  }

  private document(): SaveDocument {
    return saveWorld(this.world!, this.ruleset(), { universe: this.universe!.name }, this.lineage);
  }

  private load(universe: Universe, doc: SaveDocument): World {
    const probe = universe.build(seedFromText(doc.seed)),
      ruleset = rulesetId(probe, universe.version);
    const loaded = loadWorld(doc, universe.build, ruleset, { allowRulesetChange: true });
    this.setWorld(universe, loaded.world, loaded.lineage);
    return loaded.world;
  }

  private answer(query: Query): unknown {
    const handler = this.universe!.queries[query.type] ?? BUILTIN_QUERIES[query.type];
    if (!handler) throw new Error(`no query ${query.type}`);
    return handler(this.world!, query.args);
  }

  private sendFrame(now: number): void {
    const world = this.world!,
      interest = this.interest!,
      build = this.universe!.frames[interest.view];
    if (!build) return;
    const payload = build(world, interest);
    this.lastFrame = now;
    const key = payload.key ? `${interest.view}|${payload.key}` : null;
    if (key && key === this.lastFrameKey) return;
    this.lastFrameKey = key;
    const frame: FrameMessage = {
      kind: "frame",
      view: interest.view,
      seq: ++this.frameSeq,
      t: world.now,
      meta: payload.meta,
      arrays: payload.arrays,
    };
    this.port.post(frame, frameTransfer(frame));
    this.lastFrame = now;
  }

  private sendUpdates(now: number): void {
    for (const [id, sub] of this.subscriptions) {
      if (now - sub.last < sub.everyMs) continue;
      sub.last = now;
      let value: unknown;
      try {
        value = this.answer(sub.query);
      } catch (error) {
        value = { error: error instanceof Error ? error.message : String(error) };
      }
      const text = JSON.stringify(value);
      if (text === sub.lastValue) continue;
      sub.lastValue = text;
      this.port.post({ kind: "update", id, t: this.world!.now, value });
    }
  }

  private sendStatus(now: number): void {
    const world = this.world;
    this.achievedWindow = this.achievedWindow.filter((s) => now - s.at <= 1000);
    const first = this.achievedWindow[0],
      achieved =
        first && world && now > first.at ? ((world.now - first.t) * 1000) / (now - first.at) : 0;
    this.port.post({
      kind: "status",
      universe: this.universe?.name ?? null,
      seed: world?.seed.text ?? null,
      t: world?.now ?? 0,
      speed: this.speed,
      achieved,
      stepMs: this.stepMs,
    });
    this.lastStatus = now;
  }

  /**
   * One turn of the host's loop: finish the moment in progress, handle waiting
   * messages, advance the world within the budget, and send what is due.
   */
  async pump(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const clock = this.options.clock,
        start = clock(),
        dt = Math.max(0, start - this.lastPump) / 1000;
      this.lastPump = start;
      this.finishMoment();
      while (this.inbox.length) await this.handle(this.inbox.shift()!);
      const world = this.world;
      if (!world) return;
      if (this.speed > 0) {
        // Where the world should be by now; a backlog of more than a second is dropped
        // (the device cannot keep up, so the world runs as fast as it can).
        this.simTarget = Math.min(
          Math.max(this.simTarget, world.now) + this.speed * dt,
          world.now + this.speed,
        );
        const target = Math.floor(this.simTarget);
        if (target > world.now) {
          if (!this.steps || this.stepsTarget !== target) {
            this.dropSteps();
            this.steps = world.advance(target);
            this.stepsTarget = target;
          }
          const deadline = start + this.options.budgetMs;
          while (clock() < deadline) {
            if (this.steps.next().done) {
              this.steps = null;
              this.stepsTarget = -1;
              break;
            }
          }
        }
      }
      // Time to spare: do early what the world will need, so it need not pause for it.
      if (this.universe?.idle && clock() < start + this.options.budgetMs / 2)
        this.universe.idle(world);
      this.finishMoment();
      this.stepMs = clock() - start;
      const now = clock();
      this.achievedWindow.push({ at: now, t: world.now });
      if (now - this.lastFrame >= this.options.frameEveryMs) this.sendFrame(now);
      this.sendUpdates(now);
      if (now - this.lastStatus >= this.options.statusEveryMs) this.sendStatus(now);
    } finally {
      this.busy = false;
    }
  }
}
