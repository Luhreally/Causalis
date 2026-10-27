// The world container (docs/architecture §3, §36): the seed and its random
// numbers, the minter, the scheduler, the registered state stores, and the
// checkpoint hash chain, and the three logs every world keeps: history events,
// decision records and commands. It knows no domain: planets, peoples and wars
// live in the stores that sim registers here.
import { TWO32, hi32, lo32 } from "./bits.ts";
import { CommandLog, type Command, type CommandSpec } from "./command.ts";
import { Hasher } from "./hash.ts";
import {
  DECISION,
  DecisionLog,
  EVENT,
  EventLog,
  type DecisionRecord,
  type HistoryEvent,
  type RetentionOptions,
} from "./history.ts";
import { Minter, compareRefs, makeRef, type Kind, type Ref } from "./ref.ts";
import { Rng, type Seed } from "./rng.ts";
import { Scheduler, type AgendaHandler, type SystemSpec } from "./schedule.ts";
import { YEAR, type SimTime } from "./time.ts";

/** A piece of authoritative state with one owner. Every store hashes, saves and loads itself. */
export interface StateStore {
  /** Unique, dotted: "population.cells". The first word is its domain in the hash chain. */
  readonly name: string;
  /** The version of what save() returns; bump it with a migration (defineMigration). Default 1. */
  readonly schema?: number;
  /**
   * An observer's store (what the player has looked at, docs/architecture §14): saved
   * with the world but never part of its hash, because looking must not change history.
   */
  readonly observational?: boolean;
  /**
   * Whether a save keeps what save() gives packed by column (kernel/pack.ts): for a store of
   * long lists of records, which load back as JSON would give them.
   */
  readonly packed?: boolean;
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
  /**
   * What the chronicle keeps for ever. A chronicle event is never forgotten, nor anything
   * it reaches, and no event or decision changes what it cites — so this only grows, and
   * each reckoning walks only from what joined the chronicle since the last. A cache of
   * history, not part of it: a loaded world starts it afresh. (Held here as text only by a
   * world reckoning the long way, `legacy`; otherwise as bits of `index`.)
   */
  private readonly forever = new Set<string>();
  /**
   * Of those, the old events kept only as the direct cause of something (their own causes
   * not walked, as they had faded): if hindsight later raises one, it is walked again as
   * the chronicle's own — as a world loaded then would walk it.
   */
  private readonly shallow = new Set<string>();
  private foreverChronicle = -1;
  /** When the kept history was last reckoned by age (its rebuild's time), or -1. */
  private agedAt = -1;
  /**
   * The history logs by serial number, with what the reckoning holds between decades
   * (`forever` and `shallow`) as bits beside them: see HistoryIndex. A cache, never saved.
   */
  private index: HistoryIndex | null = new HistoryIndex();
  /**
   * Set for good when the logs hold what the index cannot mirror exactly (see
   * HistoryIndex.sync): the reckoning then walks the logs by their text.
   */
  private legacy = false;

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
    // Forgetting is reckoned once a decade: an ordinary event nothing keeps goes once it
    // is older than the window, at the next reckoning.
    this.scheduler.addSystem({
      key: "990.history.compact",
      every: 10 * YEAR,
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

  /** Whether a store of this name is registered (cheap: for checks on the hot path). */
  hasStore(name: string): boolean {
    return this.stores.has(name);
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

  /**
   * Another store declares history it holds on to (a biography, the observer ledger). It is
   * asked while history is reckoned, and should only read.
   */
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
    if (this.index && !this.index.sync(this.events.all(), this.decisions.all(), this.minter))
      this.reckonByText();
    return this.index ? this.compactIndexed(now, this.index) : this.compactByText(now);
  }

  /**
   * The reckoning over the index: the same walks as compactByText, root by root and cause
   * by cause in the same order, testing the same things — only looked up by serial number
   * in typed arrays rather than by text in maps. (What it keeps is what that keeps, bit for
   * bit: tests/kernel/compaction.test.ts holds the two together through random histories.)
   */
  private compactIndexed(now: number, ix: HistoryIndex): { events: number; decisions: number } {
    const aging = this.retention.aging;
    if (this.foreverChronicle !== this.retention.chronicle) {
      ix.clear(IN_F | SHALLOW);
      this.foreverChronicle = this.retention.chronicle;
    }
    const reckoned = aging ? Math.floor(now / aging.every) * aging.every : -1;
    if (aging && reckoned !== this.agedAt) {
      ix.clear(IN_F | SHALLOW);
      this.agedAt = reckoned;
    }
    const r: Reckoning = {
      now,
      window: this.retention.window,
      chronicle: this.retention.chronicle,
      aging,
      agedAt: this.agedAt,
      first: aging?.steps[0]?.after,
    };
    // What each event's age asks of it now, which have faded, which decisions are old, what
    // is young: marked once for the whole reckoning (nothing changes while it runs). The
    // chronicle's new members, in the log's order, are walked into `forever` — any one kept
    // shallowly and since raised among them, walked afresh from itself.
    const joined = ix.mark(this.events.all(), r);
    ix.walk(IN_F, joined, joined.length);
    this.pinners.forEach((pins, p) => ix.walkPinned(p, pins()));
    if (this.retention.tombstones !== undefined) {
      this.events.dropTombstones(now - this.retention.tombstones);
      this.decisions.dropTombstones(now - this.retention.tombstones);
    }
    return {
      events: ix.sweep(this.events, ix.ev, r),
      decisions: ix.sweep(this.decisions, ix.dec, r),
    };
  }

  /** From now on reckon by text (compactByText), carrying over what the index held. */
  private reckonByText(): void {
    const ix = this.index!;
    this.legacy = true;
    this.index = null;
    this.forever.clear();
    this.shallow.clear();
    ix.each(IN_F, (ref) => this.forever.add(ref));
    ix.each(SHALLOW, (ref) => this.shallow.add(ref));
  }

  /**
   * What the reckoning holds on to between decades: the refs kept for ever, and of those
   * the old events kept only shallowly (for tests and probes; a cache, not history).
   */
  historyCaches(): { forever: Ref[]; shallow: Ref[]; byText: boolean } {
    let forever: Ref[] = [],
      shallow: Ref[] = [];
    if (this.index) {
      this.index.each(IN_F, (ref) => forever.push(ref));
      this.index.each(SHALLOW, (ref) => shallow.push(ref));
    } else {
      forever = [...this.forever] as Ref[];
      shallow = [...this.shallow] as Ref[];
    }
    return {
      forever: forever.sort(compareRefs),
      shallow: shallow.sort(compareRefs),
      byText: this.legacy,
    };
  }

  /** The reckoning by text: the algorithm the index mirrors, kept for logs it cannot mirror. */
  private compactByText(now: number): { events: number; decisions: number } {
    const forever = this.forever,
      kept = new Set<string>(),
      aging = this.retention.aging;
    if (this.foreverChronicle !== this.retention.chronicle) {
      forever.clear();
      this.shallow.clear();
      this.foreverChronicle = this.retention.chronicle;
    }
    // The chronicle thins with age, reckoned afresh on a fixed schedule: an event is kept
    // for ever by the importance its age asked at the last reckoning (new ones by the base).
    const reckoned = aging ? Math.floor(now / aging.every) * aging.every : -1;
    if (aging && reckoned !== this.agedAt) {
      forever.clear();
      this.shallow.clear();
      this.agedAt = reckoned;
    }
    const needs = (t: number) => {
      let need = this.retention.chronicle;
      if (aging && t <= this.agedAt)
        for (const s of aging.steps)
          if (this.agedAt - t >= s.after) need = Math.max(need, s.chronicle);
      return need;
    };
    // Ancestry fades with age as the chronicle does: past the first step of aging, an event
    // below what its age asks (and a decision that old) is kept only as a direct cause of
    // something kept that has not faded — its own why opens one step, and beyond it the
    // past is forgotten into the summaries like any other.
    const first = aging?.steps[0]?.after,
      old = (t: number) => first !== undefined && this.agedAt - t >= first;
    // Everything `roots` reaches that is not already kept for ever, into `into`. A
    // decision passes on whether the event citing it had faded.
    const walk = (roots: Iterable<Ref>, into: Set<string>) => {
      const stack: [Ref, boolean][] = [];
      const reach = (ref: Ref, fadedParent: boolean) => {
        if (into.has(ref) || forever.has(ref)) return;
        const e = this.events.get(ref),
          d = e ? undefined : this.decisions.get(ref);
        if (!e && !d) return;
        const faded = e ? old(e.t) && e.importance < needs(e.t) : fadedParent;
        if (fadedParent && (e ? faded : old(d!.t))) return;
        into.add(ref);
        if (e && faded && into === forever) this.shallow.add(ref);
        stack.push([ref, faded]);
      };
      for (const ref of roots) reach(ref, false);
      while (stack.length) {
        const [ref, faded] = stack.pop()!,
          e = this.events.get(ref);
        if (e) for (const c of e.causes) reach(c.ref, faded);
        else for (const cited of this.decisions.cited(ref)) reach(cited, faded);
      }
    };
    // The chronicle (an event joins it when it happens, or later when hindsight raises it)...
    const joined: Ref[] = [];
    // (One kept shallowly and since raised is walked afresh, from itself.)
    for (const ref of [...this.shallow]) {
      const e = this.events.get(ref as Ref);
      if (!e || e.importance < needs(e.t)) continue;
      this.shallow.delete(ref);
      forever.delete(ref);
    }
    for (const e of this.events.all())
      if (e.importance >= needs(e.t) && !forever.has(e.id)) joined.push(e.id);
    walk(joined, forever);
    // ...and what the other stores hold on to, for as long as they do.
    for (const pins of this.pinners) walk(pins(), kept);
    const young = (t: number) => now - t < this.retention.window;
    // Tombstones of what was forgotten long ago go too (the summaries keep the count).
    if (this.retention.tombstones !== undefined) {
      this.events.dropTombstones(now - this.retention.tombstones);
      this.decisions.dropTombstones(now - this.retention.tombstones);
    }
    return {
      events: this.events.sweep((e) => forever.has(e.id) || kept.has(e.id) || young(e.t)),
      decisions: this.decisions.sweep((d) => forever.has(d.id) || kept.has(d.id) || young(d.t)),
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
      if (this.stores.get(name)!.observational) continue;
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

// The reckoning's index. Forgetting walks from the chronicle and from all the stores pin,
// through the causes of events and the factors of decisions. Done by text, each step of
// that walk was a few lookups in maps of a hundred thousand strings, and late in a long
// history the walk was most of a decade's work. The index holds each live event and
// decision by its minted serial number (event N is "ev:0:N"), its causes resolved once to
// serials when it enters (an event's causes and a decision's factors never change), and
// the reckoning's sets as bits beside it. It is a cache of the logs: it follows each log's
// array as the log appends to it, and starts afresh when a log replaces it (a load).

/** A byte of marks per serial. */
const LIVE = 1, // in its log now
  IN_F = 2, // kept for ever (World.forever)
  SHALLOW = 4, // of those, an old event kept only as a direct cause (World.shallow)
  KEPT = 8, // reached this reckoning from what the stores pin
  FADED = 16, // an old event below what its age asks, this reckoning
  OLD = 32, // a decision past the first step of aging, this reckoning
  YOUNG = 64; // younger than the window, this reckoning

/** The largest serial a cause can be resolved to (codes are ± serials in an Int32Array). */
const MAX_SERIAL = 0x7fffffff;

/** What a reckoning asks of each age, fixed while it runs. */
type Reckoning = {
  readonly now: number;
  readonly window: number;
  readonly chronicle: number;
  readonly aging: RetentionOptions["aging"];
  /** When the chronicle was last thinned (World.agedAt). */
  readonly agedAt: number;
  /** The age at the first step of aging, if any. */
  readonly first: number | undefined;
};

/** What its age asks of an event of time t (compactByText's `needs`). */
function needOf(r: Reckoning, t: number): number {
  let need = r.chronicle;
  if (r.aging && t <= r.agedAt)
    for (const s of r.aging.steps) if (r.agedAt - t >= s.after) need = Math.max(need, s.chronicle);
  return need;
}

/** Whether time t is past the first step of aging (compactByText's `old`). */
function isOld(r: Reckoning, t: number): boolean {
  return r.first !== undefined && r.agedAt - t >= r.first;
}

/** Whether time t is younger than the window (compactByText's `young`). */
function isYoung(r: Reckoning, t: number): boolean {
  return r.now - t < r.window;
}

const EV_PREFIX = [...`${EVENT.code}:`].map((c) => c.charCodeAt(0)),
  DEC_PREFIX = [...`${DECISION.code}:`].map((c) => c.charCodeAt(0));

function prefixed(ref: string, prefix: readonly number[]): number {
  if (ref.length <= prefix.length) return -1;
  for (let k = 0; k < prefix.length; k++) if (ref.charCodeAt(k) !== prefix[k]) return -1;
  return prefix.length;
}

/** Whether ref[start, end) is a number as the minter writes one: digits, no leading zero. */
function plainDigits(ref: string, start: number, end: number): boolean {
  const n = end - start;
  return n >= 1 && n <= 10 && (n === 1 || ref.charCodeAt(start) !== 48);
}

/**
 * What a reference is to the index: +N for event N, −N for decision N, 0 for anything
 * else. Only the text the minter writes ("ev:0:N") is an event's: a ref with a leading
 * zero, or of another kind, is no event or decision, as no lookup by text would find one.
 */
function codeOf(ref: unknown): number {
  if (typeof ref !== "string") return 0;
  let i = prefixed(ref, EV_PREFIX),
    sign = 1;
  if (i < 0) {
    i = prefixed(ref, DEC_PREFIX);
    sign = -1;
    if (i < 0) return 0;
  }
  const n = ref.length;
  let a = 0,
    start = i;
  for (; i < n; i++) {
    const c = ref.charCodeAt(i);
    if (c === 58) break;
    if (c < 48 || c > 57) return 0;
    a = a * 10 + (c - 48);
  }
  if (i >= n || !plainDigits(ref, start, i) || a >= TWO32) return 0;
  let b = 0;
  start = ++i;
  for (; i < n; i++) {
    const c = ref.charCodeAt(i);
    if (c < 48 || c > 57) return 0;
    b = b * 10 + (c - 48);
  }
  if (!plainDigits(ref, start, i) || b >= TWO32) return 0;
  const serial = a * TWO32 + b;
  return serial >= 1 && serial <= MAX_SERIAL ? sign * serial : 0;
}

/** One log's mirror: marks and resolved causes by serial, and the log's order by position. */
class Lane {
  readonly kind: Kind;
  flags = new Uint8Array(1024);
  /** Where each one's causes start in the index's pool, and how many. */
  kidAt = new Int32Array(1024);
  kidN = new Uint8Array(1024);
  /** The serial at each position of the log's array, and when it happened. */
  ser = new Int32Array(1024);
  t = new Float64Array(1024);
  n = 0;
  /** The log's array this follows (the log makes a new one when it forgets or loads), or null. */
  arr: readonly unknown[] | null = null;

  constructor(kind: Kind) {
    this.kind = kind;
  }

  /** Room for serial s. */
  hold(s: number): void {
    if (s < this.flags.length) return;
    const cap = Math.max(this.flags.length * 2, s + 1);
    const flags = new Uint8Array(cap),
      kidAt = new Int32Array(cap),
      kidN = new Uint8Array(cap);
    flags.set(this.flags);
    kidAt.set(this.kidAt);
    kidN.set(this.kidN);
    this.flags = flags;
    this.kidAt = kidAt;
    this.kidN = kidN;
  }

  /** Room for position i. */
  place(i: number): void {
    if (i < this.ser.length) return;
    const cap = Math.max(this.ser.length * 2, i + 1);
    const ser = new Int32Array(cap),
      t = new Float64Array(cap);
    ser.set(this.ser);
    t.set(this.t);
    this.ser = ser;
    this.t = t;
  }
}

class HistoryIndex {
  readonly ev = new Lane(EVENT);
  readonly dec = new Lane(DECISION);
  /** Every live event's and decision's causes as codes (see codeOf), each run at its kidAt. */
  private pool = new Int32Array(4096);
  private poolLen = 0;
  /** How much of the pool belongs to live events and decisions (the rest is let go at a repack). */
  private poolLive = 0;
  /** The walk's stack: each one reached, and whether it had faded (see walk). */
  private stack = new Int32Array(1024);
  private stackFaded = new Uint8Array(1024);
  private sp = 0;
  private readonly cited: Ref[] = [];
  /**
   * What each store pinned at the last reckoning, in its order, with each ref's code: a ref
   * handed over again (the same text, mostly the very same string) is not read again.
   */
  private readonly pinned: { refs: unknown[]; codes: Int32Array }[] = [];

  /**
   * Bring the index up to the logs: what they appended since, or everything afresh if a
   * log replaced its array. False if it cannot mirror them exactly — an id not as the
   * minter writes it, one out of the order the minter hands them out, a time that is not a
   * number, causes or factors not as the logs write them.
   */
  sync(
    events: readonly HistoryEvent[],
    decisions: readonly DecisionRecord[],
    minter: Minter,
  ): boolean {
    const E = this.ev,
      D = this.dec;
    if (events !== E.arr || decisions !== D.arr || events.length < E.n || decisions.length < D.n) {
      // Afresh: nothing is live until the logs say so; what is kept for ever stays (it is
      // the reckoning's own, as World.forever is).
      for (const lane of [E, D]) {
        const flags = lane.flags;
        for (let s = 0; s < flags.length; s++) flags[s]! &= IN_F | SHALLOW;
        lane.n = 0;
        lane.arr = null;
      }
      this.poolLen = 0;
      this.poolLive = 0;
    } else if (this.poolLen > 2 * this.poolLive + 4096) this.repack();
    const lastEvent = minter.count(EVENT),
      lastDecision = minter.count(DECISION);
    // (A log loaded from damaged data, with causes or factors not as the log writes them, is
    // left to the reckoning by text, to fail, or not, as it always did.)
    for (let i = E.n; i < events.length; i++) {
      const e = events[i]!,
        causes = e.causes;
      if (!Array.isArray(causes) || !this.enter(E, i, codeOf(e.id), e.t, lastEvent)) return false;
      if (!this.resolve(E, i, causes.length)) return false;
      for (const c of causes) {
        if (!c) return false;
        this.pool[this.poolLen++] = codeOf(c.ref);
      }
    }
    for (let i = D.n; i < decisions.length; i++) {
      const d = decisions[i]!,
        factors = d.factors;
      if (!Array.isArray(factors) || !this.enter(D, i, -codeOf(d.id), d.t, lastDecision))
        return false;
      // What it cites, in DecisionLog.cited's order.
      const cited = this.cited;
      cited.length = 0;
      for (const f of factors) {
        if (!f) return false;
        if (f.source) cited.push(f.source.ref);
      }
      cited.sort(compareRefs);
      if (!this.resolve(D, i, cited.length)) return false;
      for (const ref of cited) this.pool[this.poolLen++] = codeOf(ref);
    }
    E.arr = events;
    D.arr = decisions;
    return true;
  }

  /**
   * Serial s, of time t, enters at position i of its lane, if it may: in the order the
   * minter hands them out, minted, and of a time that is a number (which never changes).
   */
  private enter(lane: Lane, i: number, s: number, t: unknown, last: number): boolean {
    if (s < 1 || s > last || (i > 0 && s <= lane.ser[i - 1]!) || typeof t !== "number")
      return false;
    lane.hold(s);
    lane.place(i);
    if (lane.flags[s]! & LIVE) return false;
    lane.flags[s] = (lane.flags[s]! & (IN_F | SHALLOW)) | LIVE;
    lane.ser[i] = s;
    lane.t[i] = t;
    lane.n = i + 1;
    return true;
  }

  /** Room in the pool for the n causes of the one at position i, which start there. */
  private resolve(lane: Lane, i: number, n: number): boolean {
    if (n > 255) return false;
    const s = lane.ser[i]!;
    if (this.poolLen + n > this.pool.length) {
      const pool = new Int32Array(Math.max(this.pool.length * 2, this.poolLen + n));
      pool.set(this.pool.subarray(0, this.poolLen));
      this.pool = pool;
    }
    lane.kidAt[s] = this.poolLen;
    lane.kidN[s] = n;
    this.poolLive += n;
    return true;
  }

  /** Let go of the causes of what has been forgotten. */
  private repack(): void {
    let live = 0;
    for (const lane of [this.ev, this.dec])
      for (let i = 0; i < lane.n; i++) live += lane.kidN[lane.ser[i]!]!;
    const from = this.pool,
      pool = new Int32Array(Math.max(4096, live * 2));
    let at = 0;
    for (const lane of [this.ev, this.dec])
      for (let i = 0; i < lane.n; i++) {
        const s = lane.ser[i]!,
          start = lane.kidAt[s]!,
          n = lane.kidN[s]!;
        lane.kidAt[s] = at;
        pool.set(from.subarray(start, start + n), at);
        at += n;
      }
    this.pool = pool;
    this.poolLen = this.poolLive = at;
  }

  /**
   * This reckoning's marks: which events have faded by what their age asks, which decisions
   * are old, what is young. Returns the events that join the chronicle now, in the log's
   * order — an event kept shallowly that now stands in it leaves `forever`, to be walked
   * afresh from itself.
   */
  mark(events: readonly HistoryEvent[], r: Reckoning): number[] {
    const joined: number[] = [],
      E = this.ev,
      D = this.dec;
    let flags = E.flags,
      ser = E.ser,
      time = E.t;
    for (let i = 0; i < E.n; i++) {
      const s = ser[i]!,
        t = time[i]!,
        importance = events[i]!.importance,
        need = needOf(r, t);
      let f = flags[s]! & (LIVE | IN_F | SHALLOW);
      if (importance >= need) {
        if (f & SHALLOW) f &= ~(SHALLOW | IN_F);
        if (!(f & IN_F)) joined.push(s);
      } else if (isOld(r, t) && importance < need) f |= FADED;
      if (isYoung(r, t)) f |= YOUNG;
      flags[s] = f;
    }
    flags = D.flags;
    ser = D.ser;
    time = D.t;
    for (let i = 0; i < D.n; i++) {
      const s = ser[i]!,
        t = time[i]!;
      let f = flags[s]! & (LIVE | IN_F | SHALLOW);
      if (isOld(r, t)) f |= OLD;
      if (isYoung(r, t)) f |= YOUNG;
      flags[s] = f;
    }
    return joined;
  }

  /** Take marks off everything (the reckoning starting afresh). */
  clear(bits: number): void {
    for (const lane of [this.ev, this.dec]) {
      const flags = lane.flags;
      for (let s = 0; s < flags.length; s++) flags[s]! &= ~bits;
    }
  }

  /** Every ref marked so, events first, each as the minter wrote it. */
  each(bit: number, f: (ref: Ref) => void): void {
    for (const lane of [this.ev, this.dec]) {
      const flags = lane.flags;
      for (let s = 1; s < flags.length; s++)
        if (flags[s]! & bit) f(makeRef(lane.kind, hi32(s), lo32(s)));
    }
  }

  /**
   * Mark `into` everything the first `count` roots reach (as codes) that is neither marked
   * so already nor kept for ever. World.compactByText's walk to the letter: every root
   * reached first, then depth first, each one's causes in their order; an old event below
   * what its age asks is kept only as a direct cause of something that has not faded, and a
   * decision passes on whether the event citing it had faded.
   */
  walk(into: number, roots: ArrayLike<number>, count: number): void {
    const eAt = this.ev.kidAt,
      eN = this.ev.kidN,
      dAt = this.dec.kidAt,
      dN = this.dec.kidN,
      pool = this.pool;
    this.sp = 0;
    for (let i = 0; i < count; i++) this.reach(roots[i]!, false, into);
    while (this.sp > 0) {
      const sp = --this.sp,
        code = this.stack[sp]!,
        fade = this.stackFaded[sp] === 1,
        at = code > 0 ? eAt[code]! : dAt[-code]!,
        n = code > 0 ? eN[code]! : dN[-code]!;
      for (let k = 0; k < n; k++) this.reach(pool[at + k]!, fade, into);
    }
  }

  /** A step of the walk: the one `code` is, reached from a root or as a cause, if it may be. */
  private reach(code: number, fadedParent: boolean, into: number): void {
    let fade: boolean;
    if (code > 0) {
      const flags = this.ev.flags;
      if (code >= flags.length) return;
      const f = flags[code]!;
      if (!(f & LIVE) || f & (into | IN_F)) return;
      fade = (f & FADED) !== 0;
      if (fadedParent && fade) return;
      flags[code] = f | into | (fade && into === IN_F ? SHALLOW : 0);
    } else if (code < 0) {
      const flags = this.dec.flags,
        s = -code;
      if (s >= flags.length) return;
      const f = flags[s]!;
      if (!(f & LIVE) || f & (into | IN_F)) return;
      if (fadedParent && f & OLD) return;
      flags[s] = f | into;
      fade = fadedParent;
    } else return;
    if (this.sp === this.stack.length) {
      const stack = new Int32Array(this.sp * 2),
        faded = new Uint8Array(this.sp * 2);
      stack.set(this.stack);
      faded.set(this.stackFaded);
      this.stack = stack;
      this.stackFaded = faded;
    }
    this.stack[this.sp] = code;
    this.stackFaded[this.sp++] = fade ? 1 : 0;
  }

  /** Mark KEPT all that store p's pins reach (as walk does), reading each pin's code once. */
  walkPinned(p: number, pins: Iterable<unknown>): void {
    const last = this.pinned[p],
      before = last?.refs ?? [],
      known = last?.codes,
      m = before.length,
      refs: unknown[] = [];
    let codes = new Int32Array(Math.max(64, m)),
      n = 0,
      j = 0,
      misses = 0,
      budget = m;
    for (const ref of pins) {
      let code: number;
      if (j < m && before[j] === ref) {
        code = known![j++]!;
        misses = 0;
      } else {
        code = codeOf(ref);
        // New, or some let go since: find it ahead by its code, a little way — or, after a
        // run of misses (many let go), as far as one look over the last pins allows.
        if (code !== 0 && j < m) {
          const far = ++misses > 32 && budget > 0,
            end = Math.min(m, j + (far ? budget : 16));
          let k = j;
          while (k < end && known![k] !== code) k++;
          if (far) {
            budget -= k - j;
            misses = 0;
          }
          if (k < end) {
            j = k + 1;
            misses = 0;
          }
        }
      }
      if (n === codes.length) {
        const grown = new Int32Array(n * 2);
        grown.set(codes);
        codes = grown;
      }
      refs.push(ref);
      codes[n++] = code;
    }
    this.pinned[p] = { refs, codes };
    // (Each pin read first, then all reached: as the walk by text reaches every root before
    // it follows any, the same.)
    this.walk(KEPT, codes, n);
  }

  /**
   * Forget through the log everything neither kept for ever, nor reached, nor young (the
   * marks of this reckoning), and follow the log's new array.
   */
  sweep<T extends { readonly id: Ref; readonly t: number }>(
    log: { all(): readonly T[]; sweep(keep: (x: T) => boolean): number },
    lane: Lane,
    r: Reckoning,
  ): number {
    const arr = lane.arr,
      n = lane.n,
      ser = lane.ser,
      time = lane.t,
      flags = lane.flags,
      kidN = lane.kidN;
    let at = 0,
      w = 0,
      odd = false;
    const forgotten = log.sweep((x) => {
      const i = at++;
      if (i >= n || arr![i] !== x) {
        // (Never: the log sweeps its array in order, and nothing is added while a
        // reckoning runs. Were it so, keep exactly what the text would, and start afresh.)
        odd = true;
        const c = codeOf(x.id),
          marks = c > 0 ? this.ev.flags : this.dec.flags,
          s = c > 0 ? c : -c;
        return (s > 0 && s < marks.length && (marks[s]! & (IN_F | KEPT)) !== 0) || isYoung(r, x.t);
      }
      const s = ser[i]!,
        f = flags[s]!;
      if (f & (IN_F | KEPT | YOUNG)) {
        ser[w] = s;
        time[w++] = time[i]!;
        return true;
      }
      flags[s] = f & (IN_F | SHALLOW);
      this.poolLive -= kidN[s]!;
      return false;
    });
    const now = log.all();
    lane.n = w;
    lane.arr = odd || at !== n || now.length !== w ? null : now;
    return forgotten;
  }
}
