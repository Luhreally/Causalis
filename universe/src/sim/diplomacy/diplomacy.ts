// Diplomacy (docs/architecture §21): what realms that meet — at a border, or down a
// trade road — think of each other, as a sum of terms that each name their
// source: a shared faith or rival ones, alike speech, trade between their lands,
// the land along their border, a famine that makes one covet the other's stores,
// a land one took from the other, a broken pact, a people who prize valour.
// Remembered wrongs fade over decades. Realms who think well of each other swear a
// pact; when their opinion sours, the pact breaks, naming the term that soured it.
// Realms who think ill are rivals — what war (M22) will read.
import {
  YEAR,
  defineEventType,
  defineKind,
  dmath,
  makeRef,
  yearOfMoment,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { tongueLikeness } from "../../gen/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import type { MarketStore } from "../economy/market.ts";
import { WAY, cultureOf } from "../culture/culture.ts";
import { POLITY_EVENTS, politiesOf, realmName, type Polity } from "../polity/polity.ts";
import { beliefOf } from "../belief/belief.ts";

export const RELATION = defineKind("rel", "two realms' regard", "structural");

export const DIPLOMACY_EVENTS = {
  pact: defineEventType("diplomacy.pact", 4),
  broken: defineEventType("diplomacy.broken", 4),
};

/** One reason a realm thinks well or ill of another, and what it rests on. */
export type Term = {
  readonly name: string;
  readonly value: number;
  readonly source: Ref | null;
};

/** A remembered wrong (or kindness): it fades with a half-life of thirty years. */
type Memory = {
  readonly name: string;
  readonly value: number;
  readonly year: number;
  readonly source: Ref;
};

export type Relation = {
  readonly a: Ref;
  readonly b: Ref;
  opinion: number;
  terms: Term[];
  pact: Ref | null;
};

/** Above this, realms swear a pact; below zero it breaks; below the negative, they are rivals. */
export const PACT = 0.4;
export const RIVALRY = -0.4;

const pairKey = (a: Ref, b: Ref) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export class DiplomacyStore implements StateStore {
  readonly name = "diplomacy.relations";
  private readonly relations = new Map<string, Relation>();
  private readonly memories = new Map<string, Memory[]>();

  get(a: Ref, b: Ref): Relation | undefined {
    return this.relations.get(pairKey(a, b));
  }

  set(r: Relation): void {
    this.relations.set(pairKey(r.a, r.b), r);
  }

  drop(key: string): void {
    this.relations.delete(key);
  }

  all(): Relation[] {
    return [...this.relations.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1)).map(([, r]) => r);
  }

  /** The relations a realm has. */
  of(realm: Ref): Relation[] {
    return this.all().filter((r) => r.a === realm || r.b === realm);
  }

  remember(a: Ref, b: Ref, m: Memory): void {
    const key = pairKey(a, b);
    this.memories.set(key, [...(this.memories.get(key) ?? []), m]);
  }

  /** What two realms remember of each other, faded to now. */
  remembered(a: Ref, b: Ref, year: number): Term[] {
    return (this.memories.get(pairKey(a, b)) ?? [])
      .map((m) => ({
        name: m.name,
        value: m.value * dmath.pow(0.5, (year - m.year) / 30),
        source: m.source,
      }))
      .filter((t) => Math.abs(t.value) > 0.02);
  }

  pinned(): Ref[] {
    const refs: Ref[] = [];
    for (const r of this.relations.values()) {
      if (r.pact) refs.push(r.pact);
      for (const t of r.terms) if (t.source) refs.push(t.source);
    }
    for (const ms of this.memories.values()) for (const m of ms) refs.push(m.source);
    return refs;
  }

  hashInto(h: Hasher): void {
    h.value(this.all());
    h.value([...this.memories.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1)));
  }

  save(): unknown {
    return {
      relations: this.all(),
      memories: [...this.memories.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1)),
    };
  }

  load(state: unknown): void {
    const s = state as { relations: Relation[]; memories: [string, Memory[]][] };
    this.relations.clear();
    for (const r of s.relations) this.set({ ...r, terms: [...r.terms] });
    this.memories.clear();
    for (const [k, ms] of s.memories) this.memories.set(k, [...ms]);
  }
}

export function diplomacyOf(world: World): DiplomacyStore {
  return world.store<DiplomacyStore>("diplomacy.relations");
}

/** The ref that answers "why do these two realms think of each other as they do?" */
export function relationRef(a: Ref, b: Ref): Ref {
  const [x, y] = a < b ? [a, b] : [b, a];
  return makeRef(RELATION, Number(x.split(":")[2]), Number(y.split(":")[2]));
}

/** The year's diplomacy: who meets whom, what they think, pacts sworn and broken. */
export function diplomacyYear(ctx: PopulationContext, t: SimTime): void {
  const { world, generated: g } = ctx,
    store = diplomacyOf(world),
    realms = politiesOf(world),
    culture = cultureOf(world),
    faiths = beliefOf(world),
    markets = world.store<MarketStore>("economy.markets"),
    year = yearOfMoment(t);

  // Lands taken: a land that left one realm and joined another this year is remembered by the one it left.
  const start = Math.max(0, t - YEAR),
    events = world.events.all();
  for (let i = events.length - 1; i >= 0 && events[i]!.t > start; i--) {
    const e = events[i]!;
    if (e.type !== POLITY_EVENTS.joined.type) continue;
    const from = (e.data as { from?: Ref | null } | null)?.from,
      to = e.subjects[0];
    if (from && to && from !== to)
      store.remember(from, to, { name: "a land they took", value: -0.35, year, source: e.id });
  }

  // Who meets whom: shared borders, and trade between their lands.
  const living = realms.living(),
    borders = new Map<string, { a: Polity; b: Polity; count: number }>(),
    trade = new Map<string, { volume: number; road: Ref | null }>();
  for (const p of living)
    for (const c of p.members)
      for (let k = g.grid.offsets[c]!; k < g.grid.offsets[c + 1]!; k++) {
        const q = realms.of(g.grid.neighbours[k]!);
        if (!q || q === p || q.ended !== null || p.ref > q.ref) continue;
        const key = pairKey(p.ref, q.ref),
          b = borders.get(key) ?? { a: p, b: q, count: 0 };
        b.count++;
        borders.set(key, b);
      }
  for (const f of markets.flows) {
    const p = realms.of(f.from),
      q = realms.of(f.to);
    if (!p || !q || p === q) continue;
    const key = pairKey(p.ref, q.ref),
      tr = trade.get(key) ?? { volume: 0, road: null };
    tr.volume += f.count;
    tr.road ??= markets.route(f.from, f.to) ?? null;
    trade.set(key, tr);
    if (!borders.has(key))
      borders.set(key, { a: p.ref < q.ref ? p : q, b: p.ref < q.ref ? q : p, count: 0 });
  }

  // What they think, term by term.
  const seen = new Set<string>();
  for (const [key, { a, b, count }] of [...borders.entries()].sort((x, y) =>
    x[0] < y[0] ? -1 : 1,
  )) {
    seen.add(key);
    const wa = culture.get(a.seat)!,
      wb = culture.get(b.seat)!,
      fa = faiths.of(a.seat),
      fb = faiths.of(b.seat),
      terms: Term[] = [];
    if (fa.faith && fa.faith === fb.faith)
      terms.push({ name: "a shared faith", value: 0.3, source: fa.event });
    else if (fa.faith && fb.faith)
      terms.push({ name: "rival faiths", value: -0.2, source: fb.event ?? fa.event });
    const like = tongueLikeness(wa.tongue, wb.tongue);
    terms.push({
      name: like >= 0.75 ? "alike speech" : "strange speech",
      value: (like - 0.75) * 1.2,
      source: null,
    });
    const tr = trade.get(key);
    if (tr)
      terms.push({
        name: "trade between them",
        value: Math.min(0.35, tr.volume / 600),
        source: tr.road,
      });
    if (count)
      terms.push({
        name: "the land along their border",
        value: -Math.min(0.3, 0.05 * count),
        source: null,
      });
    // A realm in famine covets a neighbour's stores.
    for (const hungry of [a, b]) {
      const famine = hungry.members
        .map((c) => ctx.provinces.get(c)?.lastFamine)
        .map((r) => (r ? world.events.get(r) : undefined))
        .find((e) => e && t - e.t <= 2 * YEAR);
      if (famine && count)
        terms.push({
          name: `${realmName(hungry)} covets their stores`,
          value: -0.25,
          source: famine.id,
        });
    }
    // A people who prize valour are feared by their neighbours.
    const valour = Math.max(wa.traits[WAY.valour]!, wb.traits[WAY.valour]!);
    if (valour > 0.58)
      terms.push({ name: "a people who prize valour", value: -(valour - 0.58) * 2, source: null });
    terms.push(...store.remembered(a.ref, b.ref, year));
    const opinion = Math.max(
      -1,
      Math.min(
        1,
        terms.reduce((s, x) => s + x.value, 0),
      ),
    );
    const before = store.get(a.ref, b.ref),
      relation: Relation = { a: a.ref, b: b.ref, opinion, terms, pact: before?.pact ?? null };
    // Pacts sworn and broken.
    if (!relation.pact && opinion > PACT) {
      const best = [...terms].sort((x, y) => y.value - x.value)[0]!;
      relation.pact = world.events.emit({
        type: DIPLOMACY_EVENTS.pact.type,
        subjects: [a.ref, b.ref],
        place: ctx.provinces.get(a.seat)?.ref ?? null,
        causes: best.source ? [{ ref: best.source, role: "enabler", weight: 1 }] : [],
        data: { a: realmName(a), b: realmName(b), reason: best.name },
      });
    } else if (relation.pact && opinion < 0) {
      const worst = [...terms].sort((x, y) => x.value - y.value)[0]!;
      const broken = world.events.emit({
        type: DIPLOMACY_EVENTS.broken.type,
        subjects: [a.ref, b.ref],
        place: ctx.provinces.get(a.seat)?.ref ?? null,
        causes: [
          { ref: relation.pact, role: "enabler", weight: 0.4 },
          ...(worst.source ? [{ ref: worst.source, role: "pressure" as const, weight: 0.6 }] : []),
        ],
        data: { a: realmName(a), b: realmName(b), reason: worst.name },
      });
      store.remember(a.ref, b.ref, { name: "a broken pact", value: -0.4, year, source: broken });
      relation.pact = null;
    }
    store.set(relation);
  }
  // Realms that no longer meet (or no longer are) keep no standing regard.
  for (const r of store.all()) {
    const key = pairKey(r.a, r.b);
    if (!seen.has(key)) store.drop(key);
  }
}

/** Teach a peopled world its diplomacy. */
export function installDiplomacy(world: World, ctx: () => PopulationContext): DiplomacyStore {
  const store = world.register(new DiplomacyStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "180.diplomacy.year", every: YEAR, run: (t) => diplomacyYear(ctx(), t) });
  return store;
}
