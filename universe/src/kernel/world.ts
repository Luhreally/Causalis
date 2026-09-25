// The world container (docs/architecture §3, §36): the seed and its random
// numbers, the minter, the scheduler, the registered state stores, and the
// checkpoint hash chain. It knows no domain: planets, peoples and wars live in
// the stores that sim registers here.
import { Hasher } from "./hash.ts";
import { Minter } from "./ref.ts";
import { Rng, type Seed } from "./rng.ts";
import { Scheduler, type AgendaHandler, type SystemSpec } from "./schedule.ts";
import { YEAR, type SimTime } from "./time.ts";

/** A piece of authoritative state with one owner. Every store hashes, saves and loads itself. */
export interface StateStore {
  /** Unique, dotted: "population.cells". The first word is its domain in the hash chain. */
  readonly name: string;
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
};

export class World {
  readonly seed: Seed;
  readonly rng: Rng;
  readonly minter = new Minter();
  readonly scheduler: Scheduler;
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

  /** Advance the world to a time (all at once). */
  runTo(target: number): void {
    this.scheduler.runTo(target);
  }

  /** Advance the world to a time in slices; see Scheduler.advance. */
  advance(target: number): Generator<void, void, void> {
    return this.scheduler.advance(target);
  }
}
