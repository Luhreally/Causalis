// History (docs/architecture §12, §32): events, decision records and the typed
// causes that link them. Causes are recorded at the point of decision, by the
// system that made it — never guessed afterwards from "the latest event of that
// type" (Classic's habit, which made its why-trees lie).
import { COLD_ROWS, ColdDecisions, ColdEvents, codeOf, type WrittenDecisions } from "./cold.ts";
import { Hasher, hexOf } from "./hash.ts";
import { compareRefs, defineKind, kindCodeOf, isRef, type Minter, type Ref } from "./ref.ts";
import { YEAR, type SimTime } from "./time.ts";

export const EVENT = defineKind("ev", "event", "minted");
export const DECISION = defineKind("dec", "decision", "minted");
export const COMMAND = defineKind("cmd", "command", "minted");

export type CauseRole = "trigger" | "enabler" | "pressure" | "constraint" | "agent";
const ROLES: ReadonlySet<string> = new Set([
  "trigger",
  "enabler",
  "pressure",
  "constraint",
  "agent",
]);

/** Why something happened: a reference to an earlier event, decision, fact, flow, generator or command. */
export type CauseRef = { readonly ref: Ref; readonly role: CauseRole; readonly weight: number };

export const MAX_CAUSES = 6;
export const MAX_SUBJECTS = 4;

export type HistoryEvent = {
  readonly id: Ref;
  readonly t: number;
  readonly type: string;
  importance: number;
  readonly subjects: readonly Ref[];
  readonly place: Ref | null;
  readonly causes: readonly CauseRef[];
  readonly data: unknown;
};

/** What is kept of an event that has been forgotten: enough to say what and where. */
export type Tombstone = {
  readonly id: Ref;
  readonly t: number;
  readonly type: string;
  readonly place: Ref | null;
  readonly subjects: readonly Ref[];
};

/** The summaries as a save keeps them, type by type (by place, then decade, within each). */
type FoldedColumns = readonly {
  readonly type: string;
  readonly place: readonly string[];
  readonly decade: readonly number[];
  readonly n: readonly number[];
}[];

/** Forgotten events, folded by place and decade: how many of each type. */
export type Summary = {
  readonly place: string;
  readonly decade: number;
  counts: Record<string, number>;
};

export type EventTypeSpec = { readonly type: string; readonly importance: number };
const EVENT_TYPES = new Map<string, EventTypeSpec>();

/** Declare an event type and its usual importance (0 trivia … 7 world-changing). */
export function defineEventType(type: string, importance: number): EventTypeSpec {
  if (!/^[a-z][a-z0-9]*(\.[a-z0-9-]+)+$/.test(type))
    throw new Error(`event type ${type} must be dotted words`);
  if (EVENT_TYPES.has(type)) throw new Error(`event type ${type} is defined twice`);
  checkImportance(importance);
  const spec = Object.freeze({ type, importance });
  EVENT_TYPES.set(type, spec);
  return spec;
}

export function eventType(type: string): EventTypeSpec | undefined {
  return EVENT_TYPES.get(type);
}

/** Every declared event type, in type order (part of the ruleset's identity). */
export function eventTypes(): EventTypeSpec[] {
  return [...EVENT_TYPES.values()].sort((a, b) => (a.type < b.type ? -1 : a.type > b.type ? 1 : 0));
}

function checkImportance(i: number): void {
  if (!Number.isInteger(i) || i < 0 || i > 7)
    throw new Error(`importance ${i} must be an integer 0–7`);
}

function refNumber(ref: Ref): number {
  const parts = ref.split(":");
  return Number(parts[1]) * 4294967296 + Number(parts[2]);
}

function checkCauses(causes: readonly CauseRef[], selfKind: string, selfNumber: number): void {
  if (causes.length > MAX_CAUSES)
    throw new Error(`at most ${MAX_CAUSES} causes, got ${causes.length}`);
  for (const c of causes) {
    if (!isRef(c.ref)) throw new Error(`cause ${c.ref} is not a reference`);
    if (!ROLES.has(c.role)) throw new Error(`cause role ${c.role}`);
    if (!(c.weight >= 0 && c.weight <= 1))
      throw new Error(`cause weight ${c.weight} must be in [0, 1]`);
    // A cause of the same kind must be earlier: causes are never later than their effect.
    if (kindCodeOf(c.ref) === selfKind && refNumber(c.ref) >= selfNumber)
      throw new Error(`cause ${c.ref} is not earlier than its effect`);
  }
}

function hashCauses(h: Hasher, causes: readonly CauseRef[]): void {
  h.int(causes.length);
  for (const c of causes) h.string(c.ref).string(c.role).float(c.weight);
}

/**
 * A log's digest once `id` is forgotten (new Hasher().string(digest).string("forget")
 * .string(id).hex()), as its lanes: read from the last forgetting's lanes where a sweep has
 * them, so thousands forgotten at once write the digest out only at the end.
 */
function forgetting(
  lanes: readonly [number, number] | null,
  digest: string,
  id: Ref,
): [number, number] {
  const h = new Hasher();
  return (lanes ? h.hexDigits(lanes) : h.string(digest)).string("forget").string(id).lanes();
}

export type EmitSpec = {
  readonly type: string;
  readonly importance?: number;
  readonly subjects?: readonly Ref[];
  readonly place?: Ref | null;
  readonly causes?: readonly CauseRef[];
  readonly data?: unknown;
};

export type RetentionOptions = {
  /** How long ordinary events and decisions stay, in seconds. */
  readonly window: number;
  /** Events at or above this importance are kept for ever (the chronicle). */
  readonly chronicle: number;
  /**
   * How long the tombstone of a forgotten event or decision stays, in seconds after it
   * happened (for ever when absent): the summaries still count it by place and decade.
   */
  readonly tombstones?: number;
  /**
   * The chronicle thins with age (Phase 6 M65: history over millennia): an event older
   * than `after` (seconds) is kept for ever only at this importance or more. Applied on a
   * fixed schedule (`every` seconds of the world's time), so a world saved and loaded keeps
   * the same history as one that ran on. Absent: every chronicle event is kept for ever.
   */
  readonly aging?: {
    readonly every: number;
    readonly steps: readonly { readonly after: number; readonly chronicle: number }[];
  };
};

/**
 * An event gone cold (kernel/cold.ts) as it reads: when it was, of what type and how much it
 * mattered from typed arrays beside it, the rest from its block when asked. Made when asked for
 * and let go at once: a reckoning may move its row, and it finds it again.
 */
class ColdEvent implements HistoryEvent {
  // (Private to the language: a copy of one, by a worker's post, must not take the log with it.)
  readonly #log: EventLog;
  readonly #serial: number;
  #row: number;
  #epoch: number;

  constructor(log: EventLog, row: number) {
    this.#log = log;
    this.#row = row;
    this.#epoch = log.epoch;
    this.#serial = log.cold.serial[row]!;
  }

  /** Its row now. */
  #at(): number {
    if (this.#epoch !== this.#log.epoch) {
      this.#row = this.#log.cold.rowOf(this.#serial);
      this.#epoch = this.#log.epoch;
    }
    return this.#row;
  }

  get id(): Ref {
    return `ev:0:${this.#serial}` as Ref;
  }
  get t(): number {
    return this.#log.cold.t[this.#at()]!;
  }
  get type(): string {
    const c = this.#log.cold;
    return c.words.wordOf(c.type[this.#at()]!);
  }
  get importance(): number {
    return this.#log.cold.importance[this.#at()]!;
  }
  get subjects(): readonly Ref[] {
    return this.#log.cold.subjects(this.#at());
  }
  get place(): Ref | null {
    const c = this.#log.cold,
      p = c.place[this.#at()]!;
    return p < 0 ? null : (c.words.wordOf(p) as Ref);
  }
  get causes(): readonly CauseRef[] {
    return this.#log.cold.causes(this.#at());
  }
  get data(): unknown {
    return this.#log.cold.data(this.#at());
  }
  /** As JSON writes an event. */
  toJSON(): HistoryEvent {
    return this.#log.cold.plain(this.#at());
  }
}

/**
 * The event log. What is kept is decided by the world's history compaction
 * (World.compactHistory): the chronicle, whatever it reaches through causes, what
 * other stores pin, and anything younger than the retention window. The rest
 * fold into per-place, per-decade summaries and leave a tombstone. What is kept and
 * old is held cold: see kernel/cold.ts.
 */
export class EventLog {
  readonly name = "history.events";
  /** Saved packed by column (kernel/pack.ts): its events, tombstones and summaries are long lists. */
  readonly packed = true;
  /** The events not yet cold, oldest first (they follow every cold one). */
  private events: HistoryEvent[] = [];
  private readonly index = new Map<string, HistoryEvent>();
  /** The events gone cold. */
  readonly cold = new ColdEvents();
  /** Rises each time a row of the log may have moved: an event made earlier finds itself again. */
  epoch = 0;
  /** Rises when the log is replaced whole, or swept from outside its reckoning (see HistoryIndex). */
  generation = 0;
  /** Every live event as all() gives it, while nothing has moved. */
  private whole: HistoryEvent[] | null = null;
  private wholeEpoch = -1;
  private tombstones: Tombstone[] = [];
  /** The tombstones by id, made when first asked for (a reckoning lays thousands at once). */
  private tombIndex: Map<string, Tombstone> | null = null;
  /**
   * Every change the log has seen — each event as it was emitted, each rise in
   * importance, each forgetting — folded in as it happened, so a checkpoint hashes
   * the log in constant time however long history grows.
   */
  private digest = "";
  /** The summaries by place, then decade. */
  private folded = new Map<string, Map<number, Summary>>();
  private readonly minter: Minter;
  private readonly clock: () => SimTime;

  constructor(minter: Minter, clock: () => SimTime) {
    this.minter = minter;
    this.clock = clock;
  }

  /** Record an event now. Returns its reference. */
  emit(spec: EmitSpec): Ref {
    const type = EVENT_TYPES.get(spec.type);
    if (!type) throw new Error(`event type ${spec.type} is not defined`);
    const importance = spec.importance ?? type.importance;
    checkImportance(importance);
    const subjects = spec.subjects ?? [];
    if (subjects.length > MAX_SUBJECTS) throw new Error(`at most ${MAX_SUBJECTS} subjects`);
    const id = this.minter.mint(EVENT),
      causes = spec.causes ?? [];
    checkCauses(causes, EVENT.code, refNumber(id));
    const event: HistoryEvent = {
      id,
      t: this.clock(),
      type: spec.type,
      importance,
      subjects: [...subjects],
      place: spec.place ?? null,
      causes: causes.map((c) => ({ ...c })),
      data: spec.data ?? null,
    };
    this.events.push(event);
    this.index.set(id, event);
    const h = new Hasher()
      .string(this.digest)
      .string(id)
      .int(event.t)
      .string(event.type)
      .int(importance)
      .string(event.place ?? "");
    h.int(event.subjects.length);
    for (const s of event.subjects) h.string(s);
    hashCauses(h, event.causes);
    h.value(event.data);
    // Hindsight: an important event lends significance to the events it cites.
    if (importance >= 3)
      for (const c of causes) {
        if (c.role !== "trigger" && c.role !== "pressure" && c.role !== "agent") continue;
        const cited = this.index.get(c.ref);
        if (cited) {
          const raised = Math.max(cited.importance, importance - 2);
          if (raised !== cited.importance) h.string(cited.id).int(raised);
          cited.importance = raised;
        } else if (this.cold.n) this.raiseCold(h, c.ref, importance - 2);
      }
    this.digest = h.hex();
    return id;
  }

  /** Hindsight on an event gone cold, if the cause is one. */
  private raiseCold(h: Hasher, ref: Ref, least: number): void {
    const c = this.cold,
      code = codeOf(ref),
      row = code > 0 ? c.rowOf(code) : -1;
    if (row < 0 || c.importance[row]! >= least) return;
    h.string(ref).int(least);
    c.importance[row] = least;
    c.raised.set(code, least);
  }

  get(id: Ref): HistoryEvent | undefined {
    const hot = this.index.get(id);
    if (hot || !this.cold.n) return hot;
    const code = codeOf(id),
      row = code > 0 ? this.cold.rowOf(code) : -1;
    return row < 0 ? undefined : new ColdEvent(this, row);
  }

  tombstone(id: Ref): Tombstone | undefined {
    if (!this.tombIndex) this.tombIndex = new Map(this.tombstones.map((t) => [t.id, t]));
    return this.tombIndex.get(id);
  }

  /**
   * Live events, oldest first. Once any has gone cold this makes one small object for each of
   * those (they read from their blocks only what is asked of them): for pages and tools. What runs
   * every year walks back from the end with count and at.
   */
  all(): readonly HistoryEvent[] {
    const n = this.cold.n;
    if (!n) return this.events;
    if (!this.whole || this.wholeEpoch !== this.epoch) {
      const whole = new Array<HistoryEvent>(n);
      for (let r = 0; r < n; r++) whole[r] = new ColdEvent(this, r);
      this.whole = whole;
      this.wholeEpoch = this.epoch;
    }
    const whole = this.whole;
    for (let i = whole.length - n; i < this.events.length; i++) whole.push(this.events[i]!);
    return whole;
  }

  /** How many events are live: all().length, without making it. */
  get count(): number {
    return this.cold.n + this.events.length;
  }

  /** The live event at a place in the log: all()[i], without making it. */
  at(i: number): HistoryEvent {
    const n = this.cold.n;
    return i < n ? new ColdEvent(this, i) : this.events[i - n]!;
  }

  /** How many events are cold (the first so many in the log). */
  get coldCount(): number {
    return this.cold.n;
  }

  /** An event's importance, by its place in the log. */
  importanceAt(i: number): number {
    const n = this.cold.n;
    return i < n ? this.cold.importance[i]! : this.events[i - n]!.importance;
  }

  /** An event not yet cold, by its place among those. */
  hotAt(i: number): HistoryEvent {
    return this.events[i]!;
  }

  /**
   * The events before `before` go cold, a block's worth at a time (the rest wait for more), as
   * long as each is as the log writes it and in the minter's order.
   */
  freeze(before: number, rows = COLD_ROWS): void {
    let done = 0;
    for (;;) {
      const hot = this.events;
      if (hot.length - done < rows || hot[done + rows - 1]!.t >= before) break;
      let last = this.cold.n ? this.cold.serial[this.cold.n - 1]! : 0;
      if (done) last = codeOf(hot[done - 1]!.id);
      for (let k = 0; k < rows; k++) {
        if (!ColdEvents.fits(hot[done + k]!, last)) return this.settle(done);
        last = codeOf(hot[done + k]!.id);
      }
      this.cold.freeze(hot.slice(done, done + rows));
      for (let k = 0; k < rows; k++) this.index.delete(hot[done + k]!.id);
      done += rows;
    }
    this.settle(done);
  }

  /** The first `done` events have gone cold. */
  private settle(done: number): void {
    if (!done) return;
    this.events = this.events.slice(done);
    this.epoch++;
  }

  /** Write again the cold blocks a share of whose rows are forgotten, at most `most` of them. */
  tidy(most: number, rows = COLD_ROWS): void {
    this.cold.tidy(most, rows);
  }

  summaries(): Summary[] {
    return [...this.folded.values()]
      .flatMap((byDecade) => [...byDecade.values()])
      .sort((a, b) => (a.place !== b.place ? (a.place < b.place ? -1 : 1) : a.decade - b.decade));
  }

  /** Forget every event `keep` rejects; returns how many were forgotten. */
  sweep(keep: (e: HistoryEvent) => boolean): number {
    const n = this.cold.n,
      forgotten = this.sweepAt((i) => keep(i < n ? new ColdEvent(this, i) : this.events[i - n]!));
    this.generation++;
    return forgotten;
  }

  /** Forget every event at a place `keep` rejects (the places are the log's before the sweep). */
  sweepAt(keep: (i: number) => boolean): number {
    let forgotten = 0,
      lanes: [number, number] | null = null;
    const c = this.cold,
      n = c.n;
    if (n) {
      let w = 0;
      for (let r = 0; r < n; r++) {
        if (keep(r)) {
          if (w !== r) c.move(r, w);
          w++;
          continue;
        }
        forgotten++;
        const id = `ev:0:${c.serial[r]!}` as Ref,
          p = c.place[r]!;
        lanes = forgetting(lanes, this.digest, id);
        this.bury(
          id,
          c.t[r]!,
          c.words.wordOf(c.type[r]!),
          p < 0 ? null : (c.words.wordOf(p) as Ref),
          c.subjects(r),
        );
        c.blocks[c.block[r]!]!.dead++;
      }
      c.n = w;
    }
    const survivors: HistoryEvent[] = [],
      hot = this.events;
    for (let i = 0; i < hot.length; i++) {
      const e = hot[i]!;
      if (keep(n + i)) {
        survivors.push(e);
        continue;
      }
      forgotten++;
      this.index.delete(e.id);
      lanes = forgetting(lanes, this.digest, e.id);
      this.bury(e.id, e.t, e.type, e.place, e.subjects);
    }
    if (lanes) this.digest = hexOf(lanes);
    this.events = survivors;
    this.epoch++;
    return forgotten;
  }

  /** What is left of a forgotten event: its tombstone, and a count in its place's decade. */
  private bury(
    id: Ref,
    t: number,
    type: string,
    place: Ref | null,
    subjects: readonly Ref[],
  ): void {
    const tomb: Tombstone = { id, t, type, place, subjects };
    this.tombstones.push(tomb);
    this.tombIndex?.set(id, tomb);
    const where = place ?? "",
      decade = Math.floor(t / (10 * YEAR));
    let byDecade = this.folded.get(where);
    if (!byDecade) this.folded.set(where, (byDecade = new Map()));
    let s = byDecade.get(decade);
    if (!s) byDecade.set(decade, (s = { place: where, decade, counts: {} }));
    s.counts[type] = (s.counts[type] ?? 0) + 1;
  }

  /** Let go the tombstones of events that happened before `before` (their summaries stay); returns how many. */
  dropTombstones(before: number): number {
    // (Tombstones are laid as things are forgotten, not in the order they happened.)
    const kept = this.tombstones.filter((t) => t.t >= before),
      n = this.tombstones.length - kept.length;
    if (!n) return 0;
    if (this.tombIndex)
      for (const t of this.tombstones) if (t.t < before) this.tombIndex.delete(t.id);
    this.tombstones = kept;
    this.digest = new Hasher().string(this.digest).string("drop").int(before).int(n).hex();
    return n;
  }

  hashInto(h: Hasher): void {
    // The summaries are folded from forgotten events, which the digest already holds.
    h.string(this.digest).int(this.count).int(this.tombstones.length);
  }

  save(): unknown {
    return {
      events: this.events,
      tombstones: this.tombstones,
      folded: this.foldedColumns(),
      digest: this.digest,
      ...(this.cold.blocks.length ? { cold: this.cold.save() } : {}),
    };
  }

  /** The summaries as a save keeps them: each type's counts by place and decade, by column. */
  private foldedColumns(): FoldedColumns {
    const byType = new Map<string, { place: string[]; decade: number[]; n: number[] }>();
    for (const s of this.summaries())
      for (const [type, n] of Object.entries(s.counts)) {
        let e = byType.get(type);
        if (!e) byType.set(type, (e = { place: [], decade: [], n: [] }));
        e.place.push(s.place);
        e.decade.push(s.decade);
        e.n.push(n);
      }
    return [...byType.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .map(([type, e]) => ({ type, ...e }));
  }

  load(state: unknown): void {
    const s = state as {
      events: HistoryEvent[];
      tombstones: Tombstone[];
      /** By column; or, in a save from before Phase 63, whole. */
      folded?: FoldedColumns;
      summaries?: Summary[];
      digest: string;
      /** What had gone cold (none in a save from before Phase 63, whose events are all as they are). */
      cold?: unknown;
    };
    this.digest = s.digest;
    this.events = s.events.map((e) => ({ ...e }));
    this.cold.load(s.cold ?? { blocks: [], words: [], raised: [] });
    this.whole = null;
    this.epoch++;
    this.generation++;
    this.index.clear();
    for (const e of this.events) this.index.set(e.id, e);
    this.tombstones = [...s.tombstones];
    this.tombIndex = null;
    this.folded = new Map();
    for (const c of s.folded ?? [])
      for (let k = 0; k < c.place.length; k++) {
        const place = c.place[k]!,
          decade = c.decade[k]!;
        let byDecade = this.folded.get(place);
        if (!byDecade) this.folded.set(place, (byDecade = new Map()));
        let x = byDecade.get(decade);
        if (!x) byDecade.set(decade, (x = { place, decade, counts: {} }));
        x.counts[c.type] = c.n[k]!;
      }
    for (const x of s.summaries ?? []) {
      let byDecade = this.folded.get(x.place);
      if (!byDecade) this.folded.set(x.place, (byDecade = new Map()));
      byDecade.set(x.decade, { ...x, counts: { ...x.counts } });
    }
  }
}

/** One input of a decision: its value, its share of the score, and where the value came from. */
export type Factor = {
  readonly name: string;
  readonly value: number;
  readonly contribution: number;
  readonly source: CauseRef | null;
};

export type DecisionRecord = {
  readonly id: Ref;
  readonly t: number;
  readonly rule: string;
  readonly subject: Ref;
  readonly outcome: unknown;
  readonly score: number;
  readonly threshold: number;
  readonly factors: readonly Factor[];
};

export const MAX_FACTORS = 6;

export type DecisionTombstone = {
  readonly id: Ref;
  readonly t: number;
  readonly rule: string;
  readonly subject: Ref;
};

/**
 * Decision records: an important choice with the factors that made it, so the
 * explainer can say "declared war because the claim on the deposit weighed 40,
 * the grievance 25, the army ratio 30, against a threshold of 80". Only the
 * strongest factors are kept.
 */
export class DecisionLog {
  readonly name = "history.decisions";
  /** Saved packed by column (kernel/pack.ts). */
  readonly packed = true;
  /** The records not yet cold, oldest first (they follow every cold one). */
  private records: DecisionRecord[] = [];
  private readonly index = new Map<string, DecisionRecord>();
  /** The records gone cold (kernel/cold.ts). */
  readonly cold = new ColdDecisions();
  /** Rises when the log is replaced whole, or swept from outside its reckoning (see HistoryIndex). */
  generation = 0;
  private tombstones: DecisionTombstone[] = [];
  /** Every record and every forgetting, folded in as it happened (see EventLog). */
  private digest = "";
  /** The tombstones by id, made when first asked for (see EventLog). */
  private tombIndex: Map<string, DecisionTombstone> | null = null;
  private readonly minter: Minter;
  private readonly clock: () => SimTime;

  constructor(minter: Minter, clock: () => SimTime) {
    this.minter = minter;
    this.clock = clock;
  }

  record(spec: {
    rule: string;
    subject: Ref;
    outcome: unknown;
    score: number;
    threshold: number;
    factors: readonly Factor[];
  }): Ref {
    const id = this.minter.mint(DECISION);
    const factors = [...spec.factors]
      .sort((a, b) => {
        const d = Math.abs(b.contribution) - Math.abs(a.contribution);
        return d !== 0 ? d : a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
      })
      .slice(0, MAX_FACTORS);
    checkCauses(
      factors.flatMap((f) => (f.source ? [f.source] : [])),
      DECISION.code,
      refNumber(id),
    );
    const rec: DecisionRecord = {
      id,
      t: this.clock(),
      rule: spec.rule,
      subject: spec.subject,
      outcome: spec.outcome,
      score: spec.score,
      threshold: spec.threshold,
      factors,
    };
    this.records.push(rec);
    this.index.set(id, rec);
    const h = new Hasher()
      .string(this.digest)
      .string(id)
      .int(rec.t)
      .string(rec.rule)
      .string(rec.subject)
      .value(rec.outcome)
      .float(rec.score)
      .float(rec.threshold);
    h.int(rec.factors.length);
    for (const f of rec.factors) {
      h.string(f.name).float(f.value).float(f.contribution);
      if (f.source) hashCauses(h, [f.source]);
      else h.int(0);
    }
    this.digest = h.hex();
    return id;
  }

  get(id: Ref): DecisionRecord | undefined {
    const hot = this.index.get(id);
    if (hot || !this.cold.n) return hot;
    const code = codeOf(id),
      row = code < 0 ? this.cold.rowOf(-code) : -1;
    return row < 0 ? undefined : this.cold.record(row);
  }

  /** Every live record, oldest first (those gone cold read back from their blocks: for tests and tools). */
  all(): readonly DecisionRecord[] {
    const n = this.cold.n;
    if (!n) return this.records;
    const out = new Array<DecisionRecord>(n);
    for (let r = 0; r < n; r++) out[r] = this.cold.record(r);
    return out.concat(this.records);
  }

  /** How many records are live. */
  get count(): number {
    return this.cold.n + this.records.length;
  }

  /** How many are cold (the first so many in the log). */
  get coldCount(): number {
    return this.cold.n;
  }

  /** A record not yet cold, by its place among those. */
  hotAt(i: number): DecisionRecord {
    return this.records[i]!;
  }

  /** The records before `before` go cold, a block's worth at a time: see EventLog.freeze. */
  freeze(before: number, rows = COLD_ROWS): void {
    let done = 0;
    for (;;) {
      const hot = this.records;
      if (hot.length - done < rows || hot[done + rows - 1]!.t >= before) break;
      let last = this.cold.n ? this.cold.serial[this.cold.n - 1]! : 0;
      if (done) last = -codeOf(hot[done - 1]!.id);
      let fits = true;
      for (let k = 0; k < rows && fits; k++) {
        fits = ColdDecisions.fits(hot[done + k]!, last);
        last = -codeOf(hot[done + k]!.id);
      }
      if (!fits) break;
      this.cold.freeze(hot.slice(done, done + rows));
      for (let k = 0; k < rows; k++) this.index.delete(hot[done + k]!.id);
      done += rows;
    }
    if (done) this.records = this.records.slice(done);
  }

  /** Write again the cold blocks a share of whose rows are forgotten, at most `most` of them. */
  tidy(most: number, rows = COLD_ROWS): void {
    this.cold.tidy(most, rows);
  }

  /** The causes a decision points at, as CauseRefs weighted by the factors' shares. */
  causesOf(id: Ref): CauseRef[] {
    const rec = this.get(id);
    if (!rec) return [];
    const total = rec.factors.reduce((s, f) => s + Math.abs(f.contribution), 0) || 1;
    return rec.factors.flatMap((f) =>
      f.source
        ? [{ ref: f.source.ref, role: f.source.role, weight: Math.abs(f.contribution) / total }]
        : [],
    );
  }

  tombstone(id: Ref): DecisionTombstone | undefined {
    if (!this.tombIndex) this.tombIndex = new Map(this.tombstones.map((t) => [t.id, t]));
    return this.tombIndex.get(id);
  }

  /** What a decision cites (its factors' sources), in order. */
  cited(id: Ref): Ref[] {
    const rec = this.get(id);
    return rec
      ? rec.factors.flatMap((f) => (f.source ? [f.source.ref] : [])).sort(compareRefs)
      : [];
  }

  /** Forget every decision `keep` rejects, leaving tombstones; returns how many. */
  sweep(keep: (d: DecisionRecord) => boolean): number {
    const n = this.cold.n,
      forgotten = this.sweepAt((i) => keep(i < n ? this.cold.record(i) : this.records[i - n]!));
    this.generation++;
    return forgotten;
  }

  /** Forget every decision at a place `keep` rejects (the places are the log's before the sweep). */
  sweepAt(keep: (i: number) => boolean): number {
    let forgotten = 0,
      lanes: [number, number] | null = null;
    const c = this.cold,
      n = c.n;
    if (n) {
      let w = 0;
      for (let r = 0; r < n; r++) {
        if (keep(r)) {
          if (w !== r) c.move(r, w);
          w++;
          continue;
        }
        forgotten++;
        const id = `dec:0:${c.serial[r]!}` as Ref;
        lanes = forgetting(lanes, this.digest, id);
        const tomb: DecisionTombstone = {
          id,
          t: c.t[r]!,
          rule: c.ruleOf(r),
          subject: c.subjectOf(r),
        };
        this.tombstones.push(tomb);
        this.tombIndex?.set(id, tomb);
        c.blocks[c.block[r]!]!.dead++;
      }
      c.n = w;
    }
    const survivors: DecisionRecord[] = [],
      hot = this.records;
    for (let i = 0; i < hot.length; i++) {
      const r = hot[i]!;
      if (keep(n + i)) {
        survivors.push(r);
        continue;
      }
      forgotten++;
      this.index.delete(r.id);
      lanes = forgetting(lanes, this.digest, r.id);
      const tomb: DecisionTombstone = { id: r.id, t: r.t, rule: r.rule, subject: r.subject };
      this.tombstones.push(tomb);
      this.tombIndex?.set(r.id, tomb);
    }
    if (lanes) this.digest = hexOf(lanes);
    this.records = survivors;
    return forgotten;
  }

  /** Let go the tombstones of decisions made before `before`; returns how many. */
  dropTombstones(before: number): number {
    // (Tombstones are laid as things are forgotten, not in the order they happened.)
    const kept = this.tombstones.filter((t) => t.t >= before),
      n = this.tombstones.length - kept.length;
    if (!n) return 0;
    if (this.tombIndex)
      for (const t of this.tombstones) if (t.t < before) this.tombIndex.delete(t.id);
    this.tombstones = kept;
    this.digest = new Hasher().string(this.digest).string("drop").int(before).int(n).hex();
    return n;
  }

  hashInto(h: Hasher): void {
    h.string(this.digest).int(this.count).int(this.tombstones.length);
  }

  save(): unknown {
    // (All a save keeps of a decision is what "why" tells, warm or cold: nothing else reads one.)
    const written = this.cold.written(this.records);
    return {
      ...(written ? { written } : { records: this.records }),
      tombstones: this.tombstones,
      digest: this.digest,
      ...(this.cold.blocks.length ? { cold: this.cold.save() } : {}),
    };
  }

  load(state: unknown): void {
    const s = state as {
      records?: DecisionRecord[];
      written?: WrittenDecisions;
      tombstones: DecisionTombstone[];
      digest: string;
      cold?: unknown;
    };
    this.digest = s.digest;
    this.records = s.written ? this.cold.unwritten(s.written) : [...(s.records ?? [])];
    this.cold.load(s.cold ?? { blocks: [], words: [] });
    this.generation++;
    this.index.clear();
    for (const r of this.records) this.index.set(r.id, r);
    this.tombstones = [...s.tombstones];
    this.tombIndex = null;
  }
}
