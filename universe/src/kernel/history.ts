// History (docs/architecture §12, §32): events, decision records and the typed
// causes that link them. Causes are recorded at the point of decision, by the
// system that made it — never guessed afterwards from "the latest event of that
// type" (Classic's habit, which made its why-trees lie).
import { Hasher } from "./hash.ts";
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
};

/**
 * The event log. What is kept is decided by the world's history compaction
 * (World.compactHistory): the chronicle, whatever it reaches through causes, what
 * other stores pin, and anything younger than the retention window. The rest
 * fold into per-place, per-decade summaries and leave a tombstone.
 */
export class EventLog {
  readonly name = "history.events";
  private events: HistoryEvent[] = [];
  private readonly index = new Map<string, HistoryEvent>();
  private tombstones: Tombstone[] = [];
  private readonly tombIndex = new Map<string, Tombstone>();
  /**
   * Every change the log has seen — each event as it was emitted, each rise in
   * importance, each forgetting — folded in as it happened, so a checkpoint hashes
   * the log in constant time however long history grows.
   */
  private digest = "";
  private folded = new Map<string, Summary>();
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
        const cited = this.index.get(c.ref);
        if (cited && (c.role === "trigger" || c.role === "pressure" || c.role === "agent")) {
          const raised = Math.max(cited.importance, importance - 2);
          if (raised !== cited.importance) h.string(cited.id).int(raised);
          cited.importance = raised;
        }
      }
    this.digest = h.hex();
    return id;
  }

  get(id: Ref): HistoryEvent | undefined {
    return this.index.get(id);
  }

  tombstone(id: Ref): Tombstone | undefined {
    return this.tombIndex.get(id);
  }

  /** Live events, oldest first. */
  all(): readonly HistoryEvent[] {
    return this.events;
  }

  summaries(): Summary[] {
    return [...this.folded.values()].sort((a, b) =>
      a.place !== b.place ? (a.place < b.place ? -1 : 1) : a.decade - b.decade,
    );
  }

  /** Forget every event `keep` rejects; returns how many were forgotten. */
  sweep(keep: (e: HistoryEvent) => boolean): number {
    let forgotten = 0;
    const survivors: HistoryEvent[] = [];
    for (const e of this.events) {
      if (keep(e)) {
        survivors.push(e);
        continue;
      }
      forgotten++;
      this.index.delete(e.id);
      this.digest = new Hasher().string(this.digest).string("forget").string(e.id).hex();
      const tomb: Tombstone = {
        id: e.id,
        t: e.t,
        type: e.type,
        place: e.place,
        subjects: e.subjects,
      };
      this.tombstones.push(tomb);
      this.tombIndex.set(e.id, tomb);
      const place = e.place ?? "",
        decade = Math.floor(e.t / (10 * YEAR)),
        key = `${place}|${decade}`;
      let s = this.folded.get(key);
      if (!s) this.folded.set(key, (s = { place, decade, counts: {} }));
      s.counts[e.type] = (s.counts[e.type] ?? 0) + 1;
    }
    this.events = survivors;
    return forgotten;
  }

  hashInto(h: Hasher): void {
    // The summaries are folded from forgotten events, which the digest already holds.
    h.string(this.digest).int(this.events.length).int(this.tombstones.length);
  }

  save(): unknown {
    return {
      events: this.events,
      tombstones: this.tombstones,
      summaries: this.summaries(),
      digest: this.digest,
    };
  }

  load(state: unknown): void {
    const s = state as {
      events: HistoryEvent[];
      tombstones: Tombstone[];
      summaries: Summary[];
      digest: string;
    };
    this.digest = s.digest;
    this.events = s.events.map((e) => ({ ...e }));
    this.index.clear();
    for (const e of this.events) this.index.set(e.id, e);
    this.tombstones = [...s.tombstones];
    this.tombIndex.clear();
    for (const t of this.tombstones) this.tombIndex.set(t.id, t);
    this.folded = new Map(
      s.summaries.map((x) => [`${x.place}|${x.decade}`, { ...x, counts: { ...x.counts } }]),
    );
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
  private records: DecisionRecord[] = [];
  private readonly index = new Map<string, DecisionRecord>();
  private tombstones: DecisionTombstone[] = [];
  /** Every record and every forgetting, folded in as it happened (see EventLog). */
  private digest = "";
  private readonly tombIndex = new Map<string, DecisionTombstone>();
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
    return this.index.get(id);
  }

  all(): readonly DecisionRecord[] {
    return this.records;
  }

  /** The causes a decision points at, as CauseRefs weighted by the factors' shares. */
  causesOf(id: Ref): CauseRef[] {
    const rec = this.index.get(id);
    if (!rec) return [];
    const total = rec.factors.reduce((s, f) => s + Math.abs(f.contribution), 0) || 1;
    return rec.factors.flatMap((f) =>
      f.source
        ? [{ ref: f.source.ref, role: f.source.role, weight: Math.abs(f.contribution) / total }]
        : [],
    );
  }

  tombstone(id: Ref): DecisionTombstone | undefined {
    return this.tombIndex.get(id);
  }

  /** What a decision cites (its factors' sources), in order. */
  cited(id: Ref): Ref[] {
    const rec = this.index.get(id);
    return rec
      ? rec.factors.flatMap((f) => (f.source ? [f.source.ref] : [])).sort(compareRefs)
      : [];
  }

  /** Forget every decision `keep` rejects, leaving tombstones; returns how many. */
  sweep(keep: (d: DecisionRecord) => boolean): number {
    const survivors: DecisionRecord[] = [];
    let forgotten = 0;
    for (const r of this.records) {
      if (keep(r)) {
        survivors.push(r);
        continue;
      }
      forgotten++;
      this.index.delete(r.id);
      this.digest = new Hasher().string(this.digest).string("forget").string(r.id).hex();
      const tomb: DecisionTombstone = { id: r.id, t: r.t, rule: r.rule, subject: r.subject };
      this.tombstones.push(tomb);
      this.tombIndex.set(r.id, tomb);
    }
    this.records = survivors;
    return forgotten;
  }

  hashInto(h: Hasher): void {
    h.string(this.digest).int(this.records.length).int(this.tombstones.length);
  }

  save(): unknown {
    return { records: this.records, tombstones: this.tombstones, digest: this.digest };
  }

  load(state: unknown): void {
    const s = state as {
      records: DecisionRecord[];
      tombstones: DecisionTombstone[];
      digest: string;
    };
    this.digest = s.digest;
    this.records = [...s.records];
    this.index.clear();
    for (const r of this.records) this.index.set(r.id, r);
    this.tombstones = [...s.tombstones];
    this.tombIndex.clear();
    for (const t of this.tombstones) this.tombIndex.set(t.id, t);
  }
}
