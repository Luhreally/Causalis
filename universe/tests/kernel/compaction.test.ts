// The decade's reckoning (World.compactHistory) against the algorithm it replaced, kept here
// as the reference: random histories, run side by side through many reckonings, must keep and
// forget exactly the same events and decisions, and hold the same chronicle between decades —
// with pins taken and let go, events raised by hindsight long after, the aging reckoning
// turning over, tombstones let go, and a save and load in the middle.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DAY,
  YEAR,
  World,
  compareRefs,
  defineEventType,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  type CauseRef,
  type CauseRole,
  type Factor,
  type Ref,
  type RetentionOptions,
  type Seed,
} from "../../src/kernel/index.ts";

const TYPES = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => defineEventType(`reckon.e${i}`, i));
const ROLES: readonly CauseRole[] = ["trigger", "enabler", "pressure", "constraint", "agent"];

// ---------------------------------------------------------------------------
// The reference: World.compactHistory as it was before the index, word for word, on state of
// its own (what the world kept in `forever`, `shallow`, `foreverChronicle` and `agedAt`).
// ---------------------------------------------------------------------------

type Held = {
  forever: Set<string>;
  shallow: Set<string>;
  foreverChronicle: number;
  agedAt: number;
};

/** How often a history took the reckoning's rarer turns (counted by the reference). */
const seen = {
  reckonings: 0,
  /** The chronicle reckoned afresh: a new age, or a new chronicle. */
  afresh: 0,
  /** An old event kept only as a direct cause. */
  shallow: 0,
  /** One of those raised by hindsight into the chronicle and walked afresh. */
  rewalked: 0,
  /** A decision reached from a faded event, and passing the fading on. */
  fadedDecisions: 0,
  /** Kept only because a store pins it, or what it reaches. */
  pinned: 0,
  /** Pinned, and let go since. */
  released: 0,
  forgotten: 0,
  tombstonesDropped: 0,
};

function referenceCompact(
  world: World,
  st: Held,
  pinners: readonly (() => Iterable<Ref>)[],
  now: number,
): { events: number; decisions: number } {
  seen.reckonings++;
  const forever = st.forever,
    kept = new Set<string>(),
    aging = world.retention.aging;
  if (st.foreverChronicle !== world.retention.chronicle) {
    forever.clear();
    st.shallow.clear();
    st.foreverChronicle = world.retention.chronicle;
    seen.afresh++;
  }
  const reckoned = aging ? Math.floor(now / aging.every) * aging.every : -1;
  if (aging && reckoned !== st.agedAt) {
    forever.clear();
    st.shallow.clear();
    st.agedAt = reckoned;
    seen.afresh++;
  }
  const needs = (t: number) => {
    let need = world.retention.chronicle;
    if (aging && t <= st.agedAt)
      for (const s of aging.steps) if (st.agedAt - t >= s.after) need = Math.max(need, s.chronicle);
    return need;
  };
  const first = aging?.steps[0]?.after,
    old = (t: number) => first !== undefined && st.agedAt - t >= first;
  const walk = (roots: Iterable<Ref>, into: Set<string>) => {
    const stack: [Ref, boolean][] = [];
    const reach = (ref: Ref, fadedParent: boolean) => {
      if (into.has(ref) || forever.has(ref)) return;
      const e = world.events.get(ref),
        d = e ? undefined : world.decisions.get(ref);
      if (!e && !d) return;
      const faded = e ? old(e.t) && e.importance < needs(e.t) : fadedParent;
      if (fadedParent && (e ? faded : old(d!.t))) return;
      into.add(ref);
      if (e && faded && into === forever) st.shallow.add(ref);
      if (!e && faded) seen.fadedDecisions++;
      if (e && faded && into === forever) seen.shallow++;
      stack.push([ref, faded]);
    };
    for (const ref of roots) reach(ref, false);
    while (stack.length) {
      const [ref, faded] = stack.pop()!,
        e = world.events.get(ref);
      if (e) for (const c of e.causes) reach(c.ref, faded);
      else for (const cited of world.decisions.cited(ref)) reach(cited, faded);
    }
  };
  const joined: Ref[] = [];
  for (const ref of [...st.shallow]) {
    const e = world.events.get(ref as Ref);
    if (!e || e.importance < needs(e.t)) continue;
    st.shallow.delete(ref);
    forever.delete(ref);
    seen.rewalked++;
  }
  for (const e of world.events.all())
    if (e.importance >= needs(e.t) && !forever.has(e.id)) joined.push(e.id);
  walk(joined, forever);
  for (const pins of pinners) walk(pins(), kept);
  const young = (t: number) => now - t < world.retention.window;
  for (const e of world.events.all())
    if (kept.has(e.id) && !forever.has(e.id) && !young(e.t)) seen.pinned++;
  if (world.retention.tombstones !== undefined) {
    seen.tombstonesDropped += world.events.dropTombstones(now - world.retention.tombstones);
    seen.tombstonesDropped += world.decisions.dropTombstones(now - world.retention.tombstones);
  }
  const forgotten = {
    events: world.events.sweep((e) => forever.has(e.id) || kept.has(e.id) || young(e.t)),
    decisions: world.decisions.sweep((d) => forever.has(d.id) || kept.has(d.id) || young(d.t)),
  };
  seen.forgotten += forgotten.events + forgotten.decisions;
  return forgotten;
}

// ---------------------------------------------------------------------------
// Twins: worlds driven alike, one reckoning with the world's own compaction, one with the
// reference. Every reckoning's result is noted, to be compared after each.
// ---------------------------------------------------------------------------

/** What a store pins: refs it holds, handed over in one of several shapes. */
type Pins = { refs: unknown[]; shape: "array" | "generator" | "set" | "twice" };

function pinner(p: Pins): () => Iterable<Ref> {
  const refs = () => p.refs as Ref[];
  switch (p.shape) {
    case "array":
      return () => [...refs()];
    case "generator":
      return function* () {
        yield* refs();
      };
    case "set":
      return () => new Set(refs());
    case "twice":
      return () => [...refs(), ...refs().slice(0, 7)];
  }
}

type Twin = {
  readonly world: World;
  readonly st: Held | null;
  readonly results: { events: number; decisions: number }[];
};

function twin(
  world: World,
  pins: readonly Pins[],
  byReference: boolean,
  more: readonly ((world: World) => () => Iterable<Ref>)[] = [],
): Twin {
  const pinners = [...pins.map(pinner), ...more.map((m) => m(world))];
  for (const p of pinners) world.addPinner(p);
  const st: Held | null = byReference
    ? { forever: new Set(), shallow: new Set(), foreverChronicle: -1, agedAt: -1 }
    : null;
  const tw: Twin = { world, st, results: [] },
    own = world.compactHistory.bind(world);
  // (The scheduler's reckoning calls the world's compactHistory: the twin's goes in first.)
  Object.defineProperty(world, "compactHistory", {
    value: (now: number) => {
      const r = st ? referenceCompact(world, st, pinners, now) : own(now);
      tw.results.push(r);
      return r;
    },
  });
  return tw;
}

const byText = compareRefs as (a: string, b: string) => number;

/** What a twin holds between decades: kept for ever, and of those shallowly. */
function caches(tw: Twin): { forever: string[]; shallow: string[] } {
  if (tw.st)
    return { forever: [...tw.st.forever].sort(byText), shallow: [...tw.st.shallow].sort(byText) };
  const c = tw.world.historyCaches();
  return { forever: c.forever, shallow: c.shallow };
}

/** Two twins compared: a's reckonings from `from[0]` on, b's from `from[1]`. */
type Pair = { a: Twin; b: Twin; what: string; from: [number, number]; seen: number };

/** The twins have kept and forgotten alike, and (after a reckoning) hold the same. */
function alike(p: Pair): void {
  const { a, b, what, from } = p;
  for (const log of ["events", "decisions"] as const) {
    const x = a.world[log].save() as { digest: string },
      y = b.world[log].save() as { digest: string };
    // The digest folds in every forgetting, in order; the rest makes a failure readable.
    if (x.digest !== y.digest || a.world[log].all().length !== b.world[log].all().length)
      assert.deepEqual(x, y, `${what}: the ${log} kept and forgotten`);
  }
  if (a.results.length === p.seen) return;
  p.seen = a.results.length;
  assert.deepEqual(
    a.results.slice(from[0]),
    b.results.slice(from[1]),
    `${what}: as many forgotten at each reckoning`,
  );
  assert.deepEqual(caches(a), caches(b), `${what}: the chronicle held between decades`);
}

// ---------------------------------------------------------------------------
// Random histories.
// ---------------------------------------------------------------------------

/** A small seeded generator (mulberry32): the test chooses with it; the worlds never see it. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Options = {
  /** Also refs by odd text, refs to what is not minted yet, junk pinned, retention changed
   * midway, logs reloaded where they stand. */
  readonly wild: boolean;
  readonly years: number;
  /** The year of the save and load (the loaded twins run on beside the first). */
  readonly saveAt: number;
  /** The year an event is rewritten as the logs never write one (see `upset`), and how. */
  readonly upsetAt?: number;
  readonly upsetHow?: "id" | "time";
};

class History {
  readonly r: () => number;
  readonly opts: Options;
  readonly name: string;
  /** Every event and decision minted, in order (the same in every twin). */
  readonly events: Ref[] = [];
  readonly decisions: Ref[] = [];
  readonly pins: Pins[];
  retention: RetentionOptions;
  readonly twins: Twin[];
  readonly pairs: Pair[];
  t = 0;

  constructor(n: number, opts: Options) {
    this.r = random(n * 7919 + (opts.wild ? 104729 : 0));
    this.opts = opts;
    this.name = `${opts.wild ? "wild " : ""}history ${n}`;
    this.retention = this.someRetention();
    const shapes: Pins["shape"][] = ["array", "generator", "set", "twice"];
    this.pins = Array.from({ length: 1 + this.int(4) }, () => ({
      refs: [],
      shape: this.pick(shapes),
    }));
    const seed = seedFromText(this.name),
      own = twin(this.build(seed), this.pins, false),
      ref = twin(this.build(seed), this.pins, true);
    this.twins = [own, ref];
    this.pairs = [{ a: own, b: ref, what: this.name, from: [0, 0], seen: 0 }];
  }

  int(n: number): number {
    return Math.floor(this.r() * n);
  }
  chance(p: number): boolean {
    return this.r() < p;
  }
  pick<T>(xs: readonly T[]): T {
    return xs[this.int(xs.length)]!;
  }

  someRetention(): RetentionOptions {
    const chronicle = 3 + this.int(3);
    const steps = this.chance(0.5)
      ? [{ after: this.pick([20, 30, 45, 60]) * YEAR, chronicle: chronicle + 1 }]
      : [
          { after: this.pick([20, 30, 45]) * YEAR, chronicle: chronicle + 1 },
          { after: this.pick([70, 100, 140]) * YEAR, chronicle: Math.min(7, chronicle + 2) },
        ];
    return {
      window: this.pick([2, 5, 8, 12, 20, 30]) * YEAR,
      chronicle,
      ...(this.chance(0.5) ? { tombstones: this.pick([30, 60, 120]) * YEAR } : {}),
      ...(this.chance(0.8) ? { aging: { every: this.pick([20, 30, 50, 70]) * YEAR, steps } } : {}),
    };
  }

  build(seed: Seed): World {
    return new World(seed, { retention: this.retention });
  }

  /** A ref to cite or pin: mostly something real, young or old, live or long forgotten. */
  someRef(kind: "event" | "decision"): Ref | null {
    const xs = kind === "event" ? this.events : this.decisions;
    if (!xs.length) return null;
    // Recent ones most, but anything since the beginning.
    return xs[
      this.chance(0.6) ? xs.length - 1 - this.int(Math.min(xs.length, 60)) : this.int(xs.length)
    ]!;
  }

  /** A ref by odd text, of another kind, or not minted yet (wild histories). */
  oddRef(kind: "event" | "decision"): Ref | null {
    const xs = kind === "event" ? this.events : this.decisions,
      code = kind === "event" ? "ev" : "dec";
    switch (this.int(4)) {
      case 0: {
        // A leading zero: a well-formed ref no minted id is written as.
        const r = this.someRef(kind);
        return r ? (r.replace(/:(\d+)$/, ":0$1") as Ref) : null;
      }
      case 1:
        return `town:0:${1 + this.int(9)}` as Ref;
      case 2:
        // Not minted yet: an event may cite a decision to come, a decision an event — soon,
        // or a century on (so an old faded event may cite a young decision).
        return `${code}:0:${xs.length + 1 + this.int(this.chance(0.5) ? 4 : 600)}` as Ref;
      default:
        return `${code}:1:${this.int(3)}` as Ref;
    }
  }

  /** Whether the log would take ref as a cause of the next of its kind (earlier, if the same kind). */
  earlier(ref: Ref): boolean {
    const m = /^(ev|dec):(\d+):(\d+)$/.exec(ref);
    if (!m) return true;
    const n = Number(m[2]) * 4294967296 + Number(m[3]);
    return n < (m[1] === "ev" ? this.events : this.decisions).length + 1;
  }

  /** Every twin at time t (each reckons as it passes a decade). */
  advanceTo(t: number): void {
    this.t = t;
    for (const tw of this.twins) tw.world.runTo(t);
  }

  emit(): void {
    const roll = this.r(),
      importance = [0.25, 0.45, 0.6, 0.75, 0.85, 0.92, 0.97, 1].findIndex((p) => roll < p);
    const causes: CauseRef[] = [];
    for (let k = this.int(5); k > 0; k--) {
      const kind = this.chance(0.8) ? "event" : "decision",
        ref =
          this.opts.wild && this.chance(0.08)
            ? this.oddRef(this.chance(0.5) ? "event" : "decision")
            : this.someRef(kind);
      // (An event cites only earlier events: an odd ref the log would refuse is left out.)
      if (!ref || (ref.startsWith("ev:") && !this.earlier(ref))) continue;
      causes.push({ ref, role: this.pick(ROLES), weight: this.int(101) / 100 });
    }
    const spec = {
      type: TYPES[importance]!.type,
      importance,
      place: this.chance(0.7) ? (`place:0:${this.int(5)}` as Ref) : null,
      causes,
    };
    let minted: Ref | null = null;
    for (const tw of this.twins) {
      const id = tw.world.events.emit(spec);
      if (minted) assert.equal(id, minted, "the twins mint alike");
      minted = id;
    }
    this.events.push(minted!);
  }

  decide(): void {
    const factors: Factor[] = [];
    for (let k = 1 + this.int(8); k > 0; k--) {
      let source: CauseRef | null = null;
      if (this.chance(0.75)) {
        const ref =
          this.opts.wild && this.chance(0.1)
            ? this.oddRef(this.chance(0.7) ? "event" : "decision")
            : this.someRef(this.chance(0.75) ? "event" : "decision");
        // (A decision cites only earlier decisions.)
        if (ref && !(ref.startsWith("dec:") && !this.earlier(ref)))
          source = { ref, role: this.pick(ROLES), weight: this.int(101) / 100 };
      }
      factors.push({
        name: `f${this.int(12)}`,
        value: this.int(1000) / 10,
        contribution: (this.int(1000) - 400) / 10,
        source,
      });
    }
    const spec = {
      rule: "reckon.choose",
      subject: "place:0:1" as Ref,
      outcome: this.int(3),
      score: 1,
      threshold: 0.5,
      factors,
    };
    let minted: Ref | null = null;
    for (const tw of this.twins) {
      const id = tw.world.decisions.record(spec);
      if (minted) assert.equal(id, minted, "the twins mint alike");
      minted = id;
    }
    this.decisions.push(minted!);
  }

  /** A store takes hold of things, or lets them go. */
  pinAndRelease(): void {
    const p = this.pick(this.pins),
      roll = this.r();
    if (roll < 0.5)
      for (let k = 1 + this.int(6); k > 0; k--) {
        const ref =
          this.opts.wild && this.chance(0.1)
            ? this.chance(0.5)
              ? this.oddRef(this.chance(0.5) ? "event" : "decision")
              : this.pick([undefined, null, 17, ""] as unknown[])
            : this.someRef(this.chance(0.8) ? "event" : "decision");
        if (ref !== null) p.refs.push(ref);
      }
    else if (roll < 0.85)
      for (let k = 1 + this.int(5); k > 0 && p.refs.length; k--) {
        p.refs.splice(this.int(p.refs.length), 1);
        seen.released++;
      }
    else if (roll < 0.93) p.refs.reverse();
    else p.refs.length = 0;
  }

  /** What a world keeps changes, or its logs are reloaded where they stand (wild histories). */
  upheaval(): void {
    if (this.chance(0.5)) {
      const next = this.someRetention();
      // Half the time the same chronicle, so the old reckoning kept what it held.
      this.retention = this.chance(0.5) ? next : { ...next, chronicle: this.retention.chronicle };
      for (const tw of this.twins) tw.world.retention = this.retention;
    } else
      for (const tw of this.twins) {
        tw.world.events.load(JSON.parse(JSON.stringify(tw.world.events.save())));
        tw.world.decisions.load(JSON.parse(JSON.stringify(tw.world.decisions.save())));
      }
  }

  /**
   * Reload every twin's event log with one event's id written with a leading zero, as the
   * minter never writes one, or its time written as text: the index cannot mirror such a
   * log, and its world reckons by text.
   */
  upset(): void {
    for (const tw of this.twins) {
      const s = JSON.parse(JSON.stringify(tw.world.events.save())) as {
        events: { id: string; t: number | string }[];
      };
      const e = s.events[Math.floor(s.events.length / 2)];
      if (e && this.opts.upsetHow === "time") e.t = String(e.t);
      else if (e) e.id = e.id.replace(/:(\d+)$/, ":0$1");
      tw.world.events.load(s);
    }
  }

  /** Save the two twins and load each into a fresh world, which runs on beside them. */
  saveAndLoad(): void {
    const [own, ref] = this.twins as [Twin, Twin];
    const load = (tw: Twin) => {
      const ruleset = rulesetId(tw.world, "reckon"),
        doc = JSON.parse(JSON.stringify(saveWorld(tw.world, ruleset))) as ReturnType<
          typeof saveWorld
        >;
      return twin(
        loadWorld(doc, (seed) => this.build(seed), ruleset).world,
        this.pins,
        tw.st !== null,
      );
    };
    const own2 = load(own),
      ref2 = load(ref);
    this.twins.push(own2, ref2);
    this.pairs.push({ a: own2, b: ref2, what: `${this.name}, loaded`, from: [0, 0], seen: 0 });
    // A loaded world forgets as the one that never saved. (In a wild history the old reckoning
    // itself need not: the order it walks in can matter there, and a load changes the order.)
    if (!this.opts.wild)
      this.pairs.push({
        a: own2,
        b: own,
        what: `${this.name}, loaded or not`,
        from: [0, own.results.length],
        seen: 0,
      });
  }

  /** Run to the end; returns how many reckonings the first twin made. */
  run(): number {
    const end = this.opts.years * YEAR,
      saveAt = this.opts.saveAt * YEAR;
    while (this.t < end) {
      const roll = this.r(),
        dt =
          roll < 0.6
            ? 1 + this.int(30 * DAY)
            : roll < 0.9
              ? 1 + this.int(YEAR)
              : 1 + this.int(4 * YEAR);
      const next = Math.min(end, this.t + dt);
      if (this.t < saveAt && next >= saveAt) {
        this.advanceTo(saveAt);
        this.saveAndLoad();
      }
      const upsetAt = (this.opts.upsetAt ?? Infinity) * YEAR;
      if (this.t < upsetAt && next >= upsetAt) {
        this.advanceTo(upsetAt);
        this.upset();
      }
      this.advanceTo(next);
      for (let k = this.int(7); k > 0; k--) this.emit();
      for (let k = this.int(3); k > 0; k--) this.decide();
      if (this.chance(0.3)) this.pinAndRelease();
      if (this.opts.wild && this.chance(0.004)) this.upheaval();
      for (const p of this.pairs) alike(p);
    }
    return this.twins[0]!.results.length;
  }
}

test("where the order of the walk decides, both reckonings walk in the same order", () => {
  // An old event of no note (x) cites a decision made long after it (d: no world makes one,
  // as nothing cites a decision yet to be made), and d cites an older event still (c).
  // Reached through faded x, d passes the fading on and c is let go; reached first through
  // something young, c is kept. Which comes first is the walk's own order — every root,
  // then depth first, each one's causes in their order (a decision's by their text) — so
  // the two reckonings must walk alike for c to share one fate.
  const retention: RetentionOptions = {
    window: 5 * YEAR,
    chronicle: 3,
    aging: { every: 100 * YEAR, steps: [{ after: 50 * YEAR, chronicle: 5 }] },
  };
  const cause = (ref: Ref): CauseRef => ({ ref, role: "enabler", weight: 1 });
  const fates = new Map<string, boolean>();
  for (const via of ["event", "decision", "pins"] as const)
    for (const youngFirst of [false, true]) {
      // The first store holds c, x and d until the last year; the second, the roots.
      const keep: Pins = { refs: [], shape: "array" },
        roots: Pins = { refs: [], shape: "array" };
      const own = twin(new World(seedFromText("order"), { retention }), [keep, roots], false),
        ref = twin(new World(seedFromText("order"), { retention }), [keep, roots], true);
      const each = <T>(f: (w: World) => T): T => {
        const [a, b] = [f(own.world), f(ref.world)];
        assert.equal(a, b, "the twins mint alike");
        return a;
      };
      const at = (y: number) => each((w) => w.runTo(y * YEAR));
      const decide = (w: World, sources: readonly Ref[]) =>
        w.decisions.record({
          rule: "reckon.choose",
          subject: "place:0:1" as Ref,
          outcome: 0,
          score: 1,
          threshold: 0.5,
          factors: sources.map((r, i) => ({
            name: `f${i}`,
            value: 1,
            contribution: 2 - i,
            source: cause(r),
          })),
        });
      at(1);
      const c = each((w) => w.events.emit({ type: TYPES[0]!.type, importance: 0 }));
      at(2);
      // (d will be the first decision.)
      const x = each((w) =>
        w.events.emit({ type: TYPES[0]!.type, importance: 0, causes: [cause("dec:0:1" as Ref)] }),
      );
      keep.refs.push(c, x);
      at(80);
      const d = each((w) => decide(w, [c]));
      keep.refs.push(d);
      at(95);
      const young = each((w) =>
        w.events.emit({ type: TYPES[0]!.type, importance: 0, causes: [cause(d)] }),
      );
      const order = youngFirst ? [young, x] : [x, young];
      if (via === "event")
        roots.refs.push(
          each((w) =>
            w.events.emit({ type: TYPES[0]!.type, importance: 0, causes: order.map(cause) }),
          ),
        );
      // (A decision's causes go by their text, whatever their weight: x before young.)
      else if (via === "decision") roots.refs.push(each((w) => decide(w, order)));
      else roots.refs.push(...order);
      at(99);
      keep.refs.length = 0;
      at(100);
      assert.ok(own.world.events.get(x) && own.world.events.get(young), "x and young are kept");
      alike({ a: own, b: ref, what: `${via}, young first: ${youngFirst}`, from: [0, 0], seen: 0 });
      fates.set(`${via}, young first: ${youngFirst}`, own.world.events.get(c) !== undefined);
    }
  // Roots are walked last first, and so are an event's causes; a decision's by their text.
  assert.deepEqual(Object.fromEntries(fates), {
    "event, young first: false": true,
    "event, young first: true": false,
    "decision, young first: false": true,
    "decision, young first: true": true,
    "pins, young first: false": true,
    "pins, young first: true": false,
  });
});

test("a store that writes history while asked what it pins (as none should) forgets as before", () => {
  // What the logs gain while the reckoning runs is not in the index's marks: the sweep keeps
  // it as the text would (it is young), and the index takes the logs afresh after.
  const retention: RetentionOptions = {
    window: 5 * YEAR,
    chronicle: 4,
    tombstones: 30 * YEAR,
    aging: { every: 50 * YEAR, steps: [{ after: 20 * YEAR, chronicle: 5 }] },
  };
  const held: Pins = { refs: [], shape: "array" };
  const writer = (w: World) => () => {
    w.events.emit({ type: TYPES[0]!.type });
    w.decisions.record({
      rule: "reckon.asked",
      subject: "place:0:1" as Ref,
      outcome: 0,
      score: 1,
      threshold: 0.5,
      factors: [],
    });
    return [];
  };
  const own = twin(new World(seedFromText("writer"), { retention }), [held], false, [writer]),
    ref = twin(new World(seedFromText("writer"), { retention }), [held], true, [writer]);
  const pair: Pair = { a: own, b: ref, what: "a store that writes", from: [0, 0], seen: 0 };
  const r = random(17),
    recent: Ref[] = [];
  for (let y = 1; y <= 140; y++) {
    for (const tw of [own, ref]) tw.world.runTo(y * YEAR);
    alike(pair);
    for (let k = Math.floor(r() * 9); k > 0; k--) {
      const causes = recent
        .slice(-12)
        .filter(() => r() < 0.3)
        .slice(0, 6)
        .map((x): CauseRef => ({
          ref: x,
          role: ROLES[Math.floor(r() * ROLES.length)]!,
          weight: 1,
        }));
      const type = TYPES[Math.floor(r() * r() * 8)]!.type,
        [a, b] = [own, ref].map((tw) => tw.world.events.emit({ type, causes }));
      assert.equal(a, b, "the twins mint alike");
      recent.push(a!);
      if (r() < 0.2) held.refs.push(a!);
    }
    if (r() < 0.2) held.refs.splice(0, Math.floor(r() * 4));
  }
  assert.ok(own.results.length >= 13, `${own.results.length} reckonings`);
  assert.equal(own.world.historyCaches().byText, false, "reckoned over the index");
});

test("a log the index cannot mirror is reckoned by text from then on, as before", () => {
  for (let n = 1; n <= 6; n++) {
    const h = new History(n, {
      wild: n > 3,
      years: 220,
      saveAt: 1000,
      upsetAt: 40 + n * 15,
      upsetHow: n % 2 ? "id" : "time",
    });
    h.run();
    assert.equal(h.twins[0]!.world.historyCaches().byText, true, "reckoned by text");
  }
});

/** Every count of `seen` back to nothing; afterwards, what the histories went through. */
function counting(): () => typeof seen {
  for (const k of Object.keys(seen) as (keyof typeof seen)[]) seen[k] = 0;
  return () => ({ ...seen });
}

test("the reckoning keeps what the old reckoning kept, through random histories", () => {
  const took = counting();
  let events = 0;
  for (let n = 1; n <= 24; n++) {
    const h = new History(n, {
      wild: false,
      years: 260 + (n % 5) * 40,
      saveAt: 90 + (n % 7) * 20,
    });
    h.run();
    events += h.events.length;
    assert.equal(h.twins[0]!.world.historyCaches().byText, false, "reckoned over the index");
  }
  // Each of the reckoning's turns was taken, many times over.
  const s = took();
  assert.ok(events > 24 * 2000, `${events} events`);
  for (const [k, least] of [
    ["reckonings", 1000],
    ["afresh", 100],
    ["shallow", 1000],
    ["rewalked", 20],
    ["pinned", 1000],
    ["released", 1000],
    ["forgotten", 20000],
    ["tombstonesDropped", 1000],
  ] as const)
    assert.ok(s[k] >= least, `${k}: ${s[k]} (${JSON.stringify(s)})`);
  // (A decision passes on fading only when cited by an event older than itself, which no
  // world can make: see the wild histories.)
  assert.equal(s.fadedDecisions, 0);
});

test("and through wild ones: odd refs, refs ahead, junk pinned, retention changed, logs reloaded", () => {
  const took = counting();
  for (let n = 1; n <= 24; n++)
    new History(n, { wild: true, years: 200 + (n % 4) * 50, saveAt: 70 + (n % 5) * 20 }).run();
  const s = took();
  assert.ok(s.fadedDecisions >= 20, `fadedDecisions: ${s.fadedDecisions} (${JSON.stringify(s)})`);
});
