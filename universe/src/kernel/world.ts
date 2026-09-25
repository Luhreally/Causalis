// The world container (docs/architecture §3, §36): the seed and its random
// numbers, the minter, the scheduler, the registered state stores, and the
// checkpoint hash chain, and the three logs every world keeps: history events,
// decision records and commands. It knows no domain: planets, peoples and wars
// live in the stores that sim registers here.
import { CommandLog, type Command, type CommandSpec } from "./command.ts";
import { Hasher } from "./hash.ts";
import { DecisionLog, EventLog, type RetentionOptions } from "./history.ts";
import { Minter, type Ref } from "./ref.ts";
import { Rng, type Seed } from "./rng.ts";
import { Scheduler, type AgendaHandler, type SystemSpec } from "./schedule.ts";
import { YEAR, type SimTime } from "./time.ts";

/** A piece of authoritative state with one owner. Every store hashes, saves and loads itself. */
export interface StateStore {
  /** Unique, dotted: "population.cells". The first word is its domain in the hash chain. */
  readonly name: string;
  /** The version of what save() returns; bump it with a migration (defineMigration). Default 1. */
  readonly schema?: number;
  hashInto(h: Hasher): void;
  save(): unknown;
  load(state: unknown): void;
}

/** One checkpoint: the hash of every domain, and the chain through all checkpoints so far. */
export type Checkpoint = {
  readonly t: number;
  readonly domains: readonly (readonly [string, string])[];
  readonly chain: string;
};

export type WorldOptions = {
  readonly start?: SimTime;
  /** Seconds between checkpoints; a standard year by default. */
  readonly checkpointEvery?: number;
  /** How long ordinary events are kept, and the importance of the chronicle. */
  readonly retention?: RetentionOptions;
};

const COMMAND_AGENDA = "kernel.command";

export class World {
  readonly seed: Seed;
  readonly rng: Rng;
  readonly minter = new Minter();
  readonly scheduler: Scheduler;
  readonly events: EventLog;
  readonly decisions: DecisionLog;
  readonly commands: CommandLog;
  /** How long ordinary history is kept, and the importance of the chronicle. */
  retention: RetentionOptions;
  private readonly pinners: (() => Iterable<Ref>)[] = [];
  private readonly stores = new Map<string, StateStore>();
  private readonly chain: Checkpoint[] = [];

  constructor(seed: Seed, options: WorldOptions = {}) {
    this.seed = seed;
    this.rng = new Rng(seed);
    this.scheduler = new Scheduler(options.start ?? (0 as SimTime));
    this.scheduler.addSystem({
      key: "999.checkpoint",
      every: options.checkpointEvery ?? YEAR,
      run: (t) => {
        this.checkpoint(t);
      },
    });
    const clock = () => this.scheduler.now;
    this.retention = options.retention ?? { window: 20 * YEAR, chronicle: 4 };
    this.events = this.register(new EventLog(this.minter, clock));
    this.decisions = this.register(new DecisionLog(this.minter, clock));
    this.commands = this.register(new CommandLog(this.minter));
    this.scheduler.addSystem({
      key: "990.history.compact",
      every: YEAR,
      run: (t) => {
        this.compactHistory(t);
      },
    });
    this.scheduler.addHandler({
      type: COMMAND_AGENDA,
      key: "000.commands",
      run: (item, t) => {
        const command = this.commands.get(item.subject as Ref);
        if (!command) throw new Error(`command ${item.subject} is not in the log`);
        this.commands.spec(command.type)!.apply(command, t);
      },
    });
  }

  get now(): SimTime {
    return this.scheduler.now;
  }

  register<S extends StateStore>(store: S): S {
    if (!/^[a-z][a-z0-9]*(\.[a-z0-9]+)*$/.test(store.name))
      throw new Error(`store name ${store.name}`);
    if (this.stores.has(store.name)) throw new Error(`store ${store.name} is registered twice`);
    this.stores.set(store.name, store);
    return store;
  }

  store<S extends StateStore>(name: string): S {
    const s = this.stores.get(name);
    if (!s) throw new Error(`no store ${name}`);
    return s as S;
  }

  storeNames(): string[] {
    return [...this.stores.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }

  system(spec: SystemSpec): void {
    this.scheduler.addSystem(spec);
  }

  handler(handler: AgendaHandler): void {
    this.scheduler.addHandler(handler);
  }

  /** Another store declares history it holds on to (a biography, the observer ledger). */
  addPinner(pins: () => Iterable<Ref>): void {
    this.pinners.push(pins);
  }

  /**
   * Forget ordinary history (docs/architecture §32). Roots are the chronicle
   * (events at or above the chronicle importance) and whatever other stores pin;
   * everything they reach through causes and decision factors is kept for ever.
   * Anything else is kept while younger than the window, then forgotten into
   * summaries and tombstones. Recent events do not keep their ancestors alive,
   * or one long chain of ordinary causes would keep all of history.
   */
  compactHistory(now: number): { events: number; decisions: number } {
    const kept = new Set<string>(),
      stack: Ref[] = [];
    const reach = (ref: Ref) => {
      if (kept.has(ref) || !(this.events.get(ref) || this.decisions.get(ref))) return;
      kept.add(ref);
      stack.push(ref);
    };
    for (const e of this.events.all()) if (e.importance >= this.retention.chronicle) reach(e.id);
    for (const pins of this.pinners) for (const ref of pins()) reach(ref);
    while (stack.length) {
      const ref = stack.pop()!,
        e = this.events.get(ref);
      if (e) for (const c of e.causes) reach(c.ref);
      else for (const cited of this.decisions.cited(ref)) reach(cited);
    }
    const young = (t: number) => now - t < this.retention.window;
    return {
      events: this.events.sweep((e) => kept.has(e.id) || young(e.t)),
      decisions: this.decisions.sweep((d) => kept.has(d.id) || young(d.t)),
    };
  }

  /** Declare a kind of command (a divine act, the hand, a time boundary). */
  defineCommand(spec: CommandSpec): void {
    this.commands.define(spec);
  }

  /**
   * Submit a command: validated, logged, and applied first in the moment one
   * second after now. Call only between moments.
   */
  submit(type: string, args: unknown): Command {
    if (this.scheduler.midMoment) throw new Error("commands are submitted between moments");
    const command = this.commands.record(type, args, this.now + 1);
    this.scheduler.schedule(command.t, COMMAND_AGENDA, command.id, null);
    return command;
  }

  /**
   * Rebuild history from a command log: run to just before each command's
   * moment, submit it there, and continue to the target. On a fresh world from
   * the same seed this reproduces the original run bit for bit.
   */
  replay(commands: readonly Command[], target: number): void {
    for (const c of commands) {
      this.runTo(c.t - 1);
      const again = this.submit(c.type, c.args);
      if (again.id !== c.id || again.t !== c.t)
        throw new Error(
          `replay diverged: ${c.id} at ${c.t} came back as ${again.id} at ${again.t}`,
        );
    }
    this.runTo(target);
  }

  /** The hash of each domain now: stores grouped by the first word of their name. */
  domainHashes(): [string, string][] {
    const byDomain = new Map<string, Hasher>();
    for (const name of this.storeNames()) {
      const domain = name.split(".")[0]!;
      let h = byDomain.get(domain);
      if (!h) byDomain.set(domain, (h = new Hasher()));
      h.string(name);
      this.stores.get(name)!.hashInto(h);
    }
    const kernel = new Hasher().int(this.now);
    for (const [code, n] of this.minter.state()) kernel.string(code).int(n);
    const agenda = this.scheduler.pending();
    kernel.int(agenda.length);
    for (const item of agenda)
      kernel
        .int(item.time)
        .string(item.type)
        .string(item.subject)
        .value(item.payload)
        .int(item.seq);
    return [
      ["kernel", kernel.hex()],
      ...[...byDomain.entries()].map(([d, h]) => [d, h.hex()] as [string, string]),
    ];
  }

  /** Record a checkpoint at time t (the scheduler does this every checkpoint period). */
  checkpoint(t: number): Checkpoint {
    const domains = this.domainHashes(),
      prev = this.chain.length ? this.chain[this.chain.length - 1]!.chain : "";
    const h = new Hasher().string(prev).int(t);
    for (const [d, hex] of domains) h.string(d).string(hex);
    const cp: Checkpoint = { t, domains, chain: h.hex() };
    this.chain.push(cp);
    return cp;
  }

  checkpoints(): readonly Checkpoint[] {
    return this.chain;
  }

  /** Put back a saved checkpoint chain (loading only). */
  restoreCheckpoints(chain: readonly Checkpoint[]): void {
    this.chain.length = 0;
    for (const c of chain) this.chain.push({ ...c });
  }

  /** Advance the world to a time (all at once). */
  runTo(target: number): void {
    this.scheduler.runTo(target);
  }

  /** Advance the world to a time in slices; see Scheduler.advance. */
  advance(target: number): Generator<void, void, void> {
    return this.scheduler.advance(target);
  }
}
