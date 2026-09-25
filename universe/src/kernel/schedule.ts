// The step driver (docs/architecture §7). Three kinds of work, one total order:
//
//  - systems run on a cadence (`every` seconds, at `offset` within the period);
//  - agenda items run at a moment (an army arrives, a ship docks, a flood comes);
//  - both run, at each moment, in the order of their literal order keys
//    ("040.population", "060.economy"), then systems before agenda items, then
//    by subject, then by the order they were scheduled.
//
// Order keys are written down, never implied by registration order, so adding a
// system cannot silently reorder the others. Advancing is a generator that yields
// after each piece of work: a host may run it in slices of any size and the
// world comes out the same bit for bit.
import type { SimTime } from "./time.ts";

export type SystemSpec = {
  /** Literal order key, e.g. "040.population.births". Unique. */
  readonly key: string;
  /** Period in seconds. */
  readonly every: number;
  /** Offset within the period, in [0, every). */
  readonly offset?: number;
  readonly run: (t: SimTime) => void;
};

type System = SystemSpec & { readonly offset: number; next: number; off: boolean };

export type AgendaItem = {
  readonly time: number;
  readonly type: string;
  readonly subject: string;
  readonly payload: unknown;
  readonly seq: number;
};

export type AgendaHandler = {
  readonly type: string;
  readonly key: string;
  readonly run: (item: AgendaItem, t: SimTime) => void;
};

const KEY_PATTERN = /^\d{3}(\.[a-z0-9-]+)+$/;

function byText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The first moment after t that is ≡ offset (mod every). */
function nextDue(t: number, every: number, offset: number): number {
  return (Math.floor((t - offset) / every) + 1) * every + offset;
}

export class Scheduler {
  private readonly systems: System[] = [];
  private readonly handlers = new Map<string, AgendaHandler>();
  private agenda: AgendaItem[] = [];
  private seq = 0;
  private time: number;
  private inMoment = false;

  constructor(start: SimTime) {
    this.time = start;
  }

  /** The time of the last completed moment (or of the moment in progress). */
  get now(): SimTime {
    return this.time as SimTime;
  }

  /** True while a moment's work is part done: the world must not be saved or queried then. */
  get midMoment(): boolean {
    return this.inMoment;
  }

  addSystem(spec: SystemSpec): void {
    if (!KEY_PATTERN.test(spec.key))
      throw new Error(`order key ${spec.key} must look like "040.population.births"`);
    if (this.systems.some((s) => s.key === spec.key))
      throw new Error(`two systems have the order key ${spec.key}`);
    if (!Number.isSafeInteger(spec.every) || spec.every <= 0)
      throw new Error(`${spec.key}: every must be a positive integer`);
    const offset = spec.offset ?? 0;
    if (!Number.isSafeInteger(offset) || offset < 0 || offset >= spec.every)
      throw new Error(`${spec.key}: offset must be an integer in [0, every)`);
    this.systems.push({
      ...spec,
      offset,
      next: nextDue(this.time, spec.every, offset),
      off: false,
    });
    this.systems.sort((a, b) => byText(a.key, b.key));
  }

  /** Switch a system off or on (debugging and A/B tools only; it is not part of history). */
  setEnabled(key: string, on: boolean): void {
    const system = this.systems.find((s) => s.key === key);
    if (!system) throw new Error(`no system ${key}`);
    system.off = !on;
  }

  systemKeys(): string[] {
    return this.systems.map((s) => s.key);
  }

  /** Every agenda type with a handler, in order. */
  handlerTypes(): string[] {
    return [...this.handlers.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }

  addHandler(handler: AgendaHandler): void {
    if (!KEY_PATTERN.test(handler.key))
      throw new Error(`order key ${handler.key} must look like "070.floods"`);
    if (this.handlers.has(handler.type))
      throw new Error(`agenda type ${handler.type} has two handlers`);
    this.handlers.set(handler.type, handler);
  }

  /** Put an item on the agenda. Time must be after the current moment. */
  schedule(time: number, type: string, subject: string, payload: unknown = null): void {
    if (!Number.isSafeInteger(time) || time <= this.time)
      throw new Error(`agenda time ${time} must be an integer after now (${this.time})`);
    if (!this.handlers.has(type)) throw new Error(`no handler for agenda type ${type}`);
    const item: AgendaItem = { time, type, subject, payload, seq: this.seq++ };
    // Keep the agenda sorted by its total order; insertion is O(n), fine for thousands.
    let lo = 0,
      hi = this.agenda.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.compareItems(this.agenda[mid]!, item) <= 0) lo = mid + 1;
      else hi = mid;
    }
    this.agenda.splice(lo, 0, item);
  }

  private compareItems(a: AgendaItem, b: AgendaItem): number {
    if (a.time !== b.time) return a.time - b.time;
    const ka = this.handlers.get(a.type)!.key,
      kb = this.handlers.get(b.type)!.key;
    if (ka !== kb) return byText(ka, kb);
    if (a.subject !== b.subject) return byText(a.subject, b.subject);
    return a.seq - b.seq;
  }

  /** The agenda, in order (for saving and inspection). */
  pending(): readonly AgendaItem[] {
    return this.agenda;
  }

  /** The time of the next moment with work, or Infinity. */
  nextMoment(): number {
    let t = this.agenda.length ? this.agenda[0]!.time : Infinity;
    for (const s of this.systems) if (s.next < t) t = s.next;
    return t;
  }

  /**
   * Advance to `target`, running every moment up to and including it. Yields
   * after each piece of work, and once more at the end of each moment (with
   * midMoment false), so a host can slice it across frames and stop only
   * between moments.
   */
  *advance(target: number): Generator<void, void, void> {
    if (!Number.isSafeInteger(target) || target < this.time)
      throw new Error(`cannot advance to ${target} from ${this.time}`);
    for (;;) {
      const t = this.nextMoment();
      if (t > target) break;
      this.time = t;
      this.inMoment = true;
      // The moment's work, merged by order key: systems first at equal keys.
      let si = 0;
      for (;;) {
        while (si < this.systems.length && this.systems[si]!.next !== t) si++;
        const system = si < this.systems.length ? this.systems[si]! : null;
        const item = this.agenda.length && this.agenda[0]!.time === t ? this.agenda[0]! : null;
        if (!system && !item) break;
        const itemKey = item ? this.handlers.get(item.type)!.key : "";
        if (system && (!item || byText(system.key, itemKey) <= 0)) {
          system.next = nextDue(t, system.every, system.offset);
          si++;
          if (!system.off) {
            system.run(t as SimTime);
            yield;
          }
        } else if (item) {
          this.agenda.shift();
          this.handlers.get(item.type)!.run(item, t as SimTime);
          yield;
        }
      }
      this.inMoment = false;
      yield;
    }
    this.time = target;
  }

  /** Advance to target in one call. */
  runTo(target: number): void {
    const steps = this.advance(target);
    while (!steps.next().done);
  }

  /** Scheduler state for saving: the time, the sequence counter and the agenda. */
  save(): { time: number; seq: number; agenda: AgendaItem[] } {
    if (this.inMoment) throw new Error("cannot save the scheduler in the middle of a moment");
    return { time: this.time, seq: this.seq, agenda: this.agenda.map((i) => ({ ...i })) };
  }

  load(state: { time: number; seq: number; agenda: readonly AgendaItem[] }): void {
    this.time = state.time;
    this.seq = state.seq;
    this.agenda = state.agenda.map((i) => ({ ...i }));
    for (const s of this.systems) s.next = nextDue(this.time, s.every, s.offset);
  }
}
