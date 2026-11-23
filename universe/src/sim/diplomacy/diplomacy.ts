// Diplomacy (docs/architecture §21): what realms that meet — at a border, or down a
// trade road — think of each other, as a sum of terms that each name their
// source: a shared faith or rival ones, alike speech, trade between their lands,
// the land along their border, a famine that makes one covet the other's stores,
// a land one took from the other, a broken pact, a people who prize valour more than
// their neighbour does.
// Remembered wrongs fade over decades. Realms who think well of each other swear a
// pact; when their opinion sours, the pact breaks, naming the term that soured it.
// Realms who think ill are rivals — what war (M22) will read.
import { SpyStore, spiesYear } from "../war/spies.ts";
import { warsOf } from "../war/war.ts";
import { COUNCILS, CouncilStore, councilsYear, sitTogether } from "./councils.ts";
import {
  YEAR,
  defineEventType,
  defineKind,
  dmath,
  makeRef,
  yearOfMoment,
  type Hasher,
  type HistoryEvent,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { tongueLikeness } from "../../gen/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import type { MarketStore } from "../economy/market.ts";
import { WAY, cultureOf } from "../culture/culture.ts";
import { LAW, POLITY_EVENTS, politiesOf, realmName, type Polity } from "../polity/polity.ts";
import { beliefOf } from "../belief/belief.ts";
import { GOODS, HOLD, HOLDING, OUTCOME } from "../../rules/index.ts";
import { orderOf } from "../order/order.ts";
import { blamesOutsiders, holdOf } from "../order/holds.ts";
import { fearOf, financeOf, stakesBetween, topFear, wayOf } from "../finance/finance.ts";
import { FINANCE, wayDistance } from "../../rules/index.ts";

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
  /** The realm that covets the other's stores, where this term is that hunger (war.ts reads who would march for them). */
  readonly hungry?: Ref;
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

/** A remembered wrong fades by half every thirty years, and is forgotten below this. */
const FORGOTTEN = 0.02;
const faded = (m: Memory, year: number) => m.value * dmath.pow(0.5, (year - m.year) / 30);

/** Below this, two realms are rivals. */
export const RIVALRY = -0.4;
/**
 * What a pact is worth to each of two realms (the breadth round), and so whether it is sworn or kept: what each thinks of the
 * other; a foe they share, by how far it outweighs the two of them together (a pact is first a bulwark: the balance of power);
 * against what binding itself costs it, the wars the other is fighting now, into which it would be called. Sworn where it is
 * worth more than PACT to both; broken where it is worth less than nothing to either.
 */
export const PACT = 0.4;
export const ALLY = {
  /** A shared foe as strong as the two together adds this much. */
  foe: 0.35,
  /** Each war the other fights costs this much, up to `drawnMost`. */
  drawn: 0.12,
  drawnMost: 0.36,
} as const;

/** What a pact is worth to one side: its regard, a shared foe's weight (0 … 1), the other's wars. */
export function pactWorth(opinion: number, sharedFoe: number, otherWars: number): number {
  return (
    opinion +
    ALLY.foe * Math.max(0, Math.min(1, sharedFoe)) -
    Math.min(ALLY.drawnMost, ALLY.drawn * Math.max(0, otherWars))
  );
}

/** More realms than a year's reckoning ever numbers: two realms' numbers as one. */
const REALM_SPAN = 2 ** 24;
const pairKey = (a: Ref, b: Ref) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * What the trade between two realms is worth to how they think of each other: as much as it is of the living of the lesser of
 * the two (what passed between their lands last year, in grain's worth, against what the lesser's lands used in the year: its
 * food eaten, its goods worn out and worked up). A share of something, so the same of a hamlet's realm and an empire's, of a
 * world of gluts and one of want: it stood as units of goods against a fixed 600, which a glutted world's pairs all reached
 * (the world before the society sweep: 122 of 207 pairs at year 60) and an honest early world's hardly ever, whatever the
 * trade was to them. Full at `full` (est: before engines all a realm traded abroad was a few parts in a hundred of what it
 * lived on, shared among all it traded with, so a fortieth of its living passing between it and ONE other is as bound by
 * trade as two such realms come to be; and among the pairs of states of the last century, as Oneal and Russett counted them,
 * the less bound side's trade with the other is a few parts in a thousand of its product at the middle and two or three in a
 * hundred among the most bound, with fewer wars between them all the way up). First light's pairs that trade: 2 to 5 parts in
 * a thousand at the median through its first century, 12 to 22 in the most bound tenth (scratchpad/release/dp.mts).
 * What passed between them is each good counted once, not at every border it crossed (sim/economy/market.ts boundOf).
 */
export const TRADE_TIE = { most: 0.35, full: 1 / 40 } as const;
export function tradeTie(worth: number, lesserUse: number): number {
  if (!(worth > 0) || !(lesserUse > 0)) return 0;
  return TRADE_TIE.most * Math.min(1, worth / lesserUse / TRADE_TIE.full);
}

/**
 * What a people's valour costs the regard between it and a neighbour: the fear of the one who prizes it less. Read against the
 * NEIGHBOUR'S OWN valour, a margin past it, and only of a people who do prize it (past `prized`: 0.5 is the middle of the way):
 * so a neighbour at the middle fears from `prized` up, as the term first stood, and one as martial fears nothing. (It stood as
 * the greater of the two against a fixed 0.58 whoever the other was, from when every people began at the middle of every way:
 * on a world whose peoples mostly prize valour, first light, where 83 seats of 131 stood past it at year 60, it set 169 pairs
 * of 236 against each other, each for prizing what the other prized too, and took more regard than rival faiths, strange
 * speech and borders together.) `by` regard for each part of valour past the line.
 */
export const VALOUR_FEARED = { prized: 0.58, margin: 0.08, by: 2 } as const;
export function valourFeared(greater: number, lesser: number): number {
  const line = Math.max(VALOUR_FEARED.prized, lesser + VALOUR_FEARED.margin);
  return greater > line ? (greater - line) * VALOUR_FEARED.by : 0;
}

export class DiplomacyStore implements StateStore {
  readonly name = "diplomacy.relations";
  /** Saved packed by column (kernel/pack.ts). */
  readonly packed = true;
  private readonly relations = new Map<string, Relation>();
  private readonly memories = new Map<string, Memory[]>();
  /** The relations in the order of their keys, and each realm's, kept until one is set or dropped (read by every realm each year). */
  private sorted: Relation[] | null = null;
  private byRealm: Map<Ref, Relation[]> | null = null;
  /**
   * (When each realm's relations were last written, as a count of writes: what is kept of a reading of them, a realm's
   * interests, is kept by it. Not state: it only ever grows, so nothing kept before a load is taken for fresh after.)
   */
  private readonly written = new Map<Ref, number>();
  private writes = 0;

  get(a: Ref, b: Ref): Relation | undefined {
    return this.relations.get(pairKey(a, b));
  }

  /** The relation of a pair by its key, where the key is in hand (the year's reckoning spells each pair's once). */
  keyed(key: string): Relation | undefined {
    return this.relations.get(key);
  }

  /** A count that moves whenever any of a realm's relations is set, dropped or told changed (`touch`). */
  writtenOf(realm: Ref): number {
    return this.written.get(realm) ?? 0;
  }

  /** A relation changed where it stands (its opinion, its terms): told, so that what was read of it is read again. */
  touch(r: Relation): void {
    this.written.set(r.a, ++this.writes);
    this.written.set(r.b, this.writes);
  }

  set(r: Relation, key = pairKey(r.a, r.b)): void {
    if (this.relations.get(key) !== r) this.sorted = this.byRealm = null;
    this.relations.set(key, r);
    this.touch(r);
  }

  drop(key: string): void {
    const r = this.relations.get(key);
    if (!r) return;
    this.relations.delete(key);
    this.sorted = this.byRealm = null;
    this.touch(r);
  }

  private ordered(): Relation[] {
    return (this.sorted ??= [...this.relations.entries()]
      .sort((x, y) => (x[0] < y[0] ? -1 : 1))
      .map(([, r]) => r));
  }

  all(): Relation[] {
    return [...this.ordered()];
  }

  /** The relations a realm has. */
  of(realm: Ref): Relation[] {
    if (!this.byRealm) {
      const by = new Map<Ref, Relation[]>();
      for (const r of this.ordered()) {
        for (const x of r.a === r.b ? [r.a] : [r.a, r.b]) {
          let l = by.get(x);
          if (!l) by.set(x, (l = []));
          l.push(r);
        }
      }
      this.byRealm = by;
    }
    return [...(this.byRealm.get(realm) ?? [])];
  }

  remember(a: Ref, b: Ref, m: Memory): void {
    const key = pairKey(a, b);
    this.memories.set(key, [...(this.memories.get(key) ?? []), m]);
  }

  /**
   * What two realms remember of each other, faded to now: each kind of wrong once, at
   * its strongest — a second war renews the bitterness of the first, it does not double it.
   */
  remembered(a: Ref, b: Ref, year: number, key = pairKey(a, b)): Term[] {
    const ms = this.memories.get(key);
    if (!ms) return [];
    const strongest = new Map<string, Term>();
    for (const m of ms) {
      const t = { name: m.name, value: faded(m, year), source: m.source },
        held = strongest.get(m.name);
      if (Math.abs(t.value) > FORGOTTEN && (!held || Math.abs(t.value) > Math.abs(held.value)))
        strongest.set(m.name, t);
    }
    return [...strongest.values()];
  }

  /** Let go of what has faded past remembering. */
  forget(year: number): void {
    // (A list none of which has faded stays as it is: most do, most years.)
    for (const [key, ms] of this.memories) {
      let kept = 0;
      for (const m of ms) if (Math.abs(faded(m, year)) > FORGOTTEN) kept++;
      if (kept === ms.length) continue;
      if (kept)
        this.memories.set(
          key,
          ms.filter((m) => Math.abs(faded(m, year)) > FORGOTTEN),
        );
      else this.memories.delete(key);
    }
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
    this.sorted = this.byRealm = null;
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
  store.forget(year);

  // Lands taken: a land that left one realm and joined another this year is remembered by the one it left.
  const start = Math.max(0, t - YEAR),
    events = world.events;
  for (let i = events.count - 1; i >= 0 && events.at(i).t > start; i--) {
    const e = events.at(i);
    if (e.type !== POLITY_EVENTS.joined.type) continue;
    const from = (e.data as { from?: Ref | null } | null)?.from,
      to = e.subjects[0];
    if (from && to && from !== to)
      store.remember(from, to, { name: "a land they took", value: -0.35, year, source: e.id });
  }

  // Who meets whom: shared borders, and trade between their lands.
  // (Each pair is found under a number of its two realms, the lesser by ref first, and its key spelt once when all are found:
  // spelt for every border and every flow, some seven thousand keys a year, the spelling was a sixth of the year's diplomacy.)
  type Met = {
    a: Polity;
    b: Polity;
    count: number;
    traded: boolean;
    volume: number;
    road: Ref | null;
  };
  const living = realms.living(),
    met = new Map<number, Met>(),
    numbers = new Map<Polity, number>(),
    numberOf = (p: Polity): number => {
      let n = numbers.get(p);
      if (n === undefined) numbers.set(p, (n = numbers.size));
      return n;
    },
    metOf = (lesser: Polity, greater: Polity): Met => {
      const at = numberOf(lesser) * REALM_SPAN + numberOf(greater);
      let m = met.get(at);
      if (!m)
        met.set(
          at,
          (m = { a: lesser, b: greater, count: 0, traded: false, volume: 0, road: null }),
        );
      return m;
    },
    // (What a realm's lands used last year, in grain's worth: asked only of those that trade, once each.)
    uses = new Map<Ref, number>(),
    useOf = (p: Polity): number => {
      let u = uses.get(p.ref);
      if (u === undefined) {
        u = 0;
        for (const c of p.members) {
          const m = markets.get(c);
          if (m) for (let k = 0; k < GOODS.length; k++) u += m.book("used", k) * GOODS[k]!.value;
        }
        uses.set(p.ref, u);
      }
      return u;
    };
  for (const p of living)
    for (const c of p.members)
      for (let k = g.grid.offsets[c]!; k < g.grid.offsets[c + 1]!; k++) {
        const q = realms.of(g.grid.neighbours[k]!);
        if (!q || q === p || q.ended !== null || p.ref > q.ref) continue;
        metOf(p, q).count++;
      }
  for (let i = 0; i < markets.flows.length; i++) {
    const f = markets.flows[i]!,
      p = realms.of(f.from),
      q = realms.of(f.to);
    if (!p || !q || p === q) continue;
    const tr = p.ref < q.ref ? metOf(p, q) : metOf(q, p);
    tr.traded = true;
    tr.volume += markets.boundAt(i) * GOODS[f.good]!.value;
    tr.road ??= markets.route(f.from, f.to) ?? null;
  }

  // What they think, term by term.
  // (What is read of one realm alone is read once for all the pairs it is of, six of them at the middle and two dozen at the
  // most: nothing the pairs' reckoning writes (their relations, pacts sworn and broken) is any of it.)
  type Side = {
    famine: HistoryEvent | undefined;
    trust: number;
    blamed: ReturnType<typeof blamesOutsiders>;
    /** Its people, and the wars it fights now (what a pact with it would draw one into). */
    might: number;
    wars: number;
  };
  // (Whom each realm counts its rivals, as last year's regard stood: a foe two of them share is a reason to bind.)
  const rivals = new Map<Ref, Ref[]>();
  for (const r of store.all())
    if (r.opinion < RIVALRY) {
      (rivals.get(r.a) ?? rivals.set(r.a, []).get(r.a)!).push(r.b);
      (rivals.get(r.b) ?? rivals.set(r.b, []).get(r.b)!).push(r.a);
    }
  const wars = world.hasStore("war.wars") ? warsOf(world) : null,
    mights = new Map<Ref, number>(),
    mightOf = (ref: Ref): number => {
      let m = mights.get(ref);
      if (m === undefined) {
        m = 0;
        const q = realms.get(ref);
        if (q && q.ended === null)
          for (const c of q.members) m += ctx.provinces.get(c)?.total() ?? 0;
        mights.set(ref, m);
      }
      return m;
    },
    /** The greatest foe two realms share, by its people over theirs together (0 … 1), and who. */
    sharedFoe = (a: Polity, b: Polity): { weight: number; foe: Ref | null } => {
      const ra = rivals.get(a.ref),
        rb = rivals.get(b.ref);
      if (!ra || !rb) return { weight: 0, foe: null };
      let best = 0,
        foe: Ref | null = null;
      for (const c of ra)
        if (rb.includes(c)) {
          const w = mightOf(c) / Math.max(1, mightOf(a.ref) + mightOf(b.ref));
          if (w > best || (w === best && foe !== null && c < foe)) [best, foe] = [w, c];
        }
      return { weight: Math.min(1, best), foe };
    };
  const sides = new Map<Polity, Side>(),
    sideOf = (p: Polity): Side => {
      let s = sides.get(p);
      if (!s) {
        let famine: HistoryEvent | undefined;
        for (const c of p.members) {
          const last = ctx.provinces.get(c)?.lastFamine,
            e = last ? world.events.get(last) : undefined;
          if (e && t - e.t <= 2 * YEAR) {
            famine = e;
            break;
          }
        }
        s = {
          famine,
          trust: holdOf(world, p.ref, HOLD.trust),
          blamed: blamesOutsiders(world, p.ref, year),
          might: mightOf(p.ref),
          wars: wars ? wars.fighting(p.ref).length : 0,
        };
        sides.set(p, s);
      }
      return s;
    };
  const seen = new Set<string>();
  for (const [key, pair] of [...met.values()]
    .map((m) => [pairKey(m.a.ref, m.b.ref), m] as const)
    .sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
    const { a, b, count } = pair;
    seen.add(key);
    const wa = culture.get(a.seat)!,
      wb = culture.get(b.seat)!,
      fa = faiths.of(a.seat),
      fb = faiths.of(b.seat),
      terms: Term[] = [];
    if (fa.faith && fa.faith === fb.faith)
      terms.push({ name: "a shared faith", value: 0.3, source: fa.event });
    else if (fa.faith && fb.faith) {
      terms.push({ name: "rival faiths", value: -0.2, source: fb.event ?? fa.event });
      // A devout realm ruled by the sacred law holds a rival faith at its border an affront.
      const zealot = [a, b]
        .map((p) => ({
          p,
          zeal:
            p.law === LAW.indexOf("the sacred")
              ? (culture.get(p.seat)!.traits[WAY.piety]! - 0.55) * 2
              : 0,
        }))
        .sort((x, y) => y.zeal - x.zeal || (x.p.ref < y.p.ref ? -1 : 1))[0]!;
      if (zealot.zeal > 0)
        terms.push({
          name: `the zeal of ${realmName(zealot.p)}`,
          value: -Math.min(0.25, zealot.zeal),
          source: faiths.of(zealot.p.seat).event ?? null,
        });
    }
    const like = tongueLikeness(wa.tongue, wb.tongue);
    terms.push({
      name: like >= 0.75 ? "alike speech" : "strange speech",
      value: (like - 0.75) * 1.2,
      source: null,
    });
    const tr = pair.traded ? pair : undefined,
      tie = tr ? tradeTie(tr.volume, Math.min(useOf(a), useOf(b))) : 0;
    if (tr && tie > 0) terms.push({ name: "trade between them", value: tie, source: tr.road });
    if (count)
      terms.push({
        name: "the land along their border",
        value: -Math.min(0.3, 0.05 * count),
        source: null,
      });
    // A realm in famine covets a neighbour's stores.
    const sa = sideOf(a),
      sb = sideOf(b);
    for (const hungry of [a, b]) {
      const famine = (hungry === a ? sa : sb).famine;
      if (famine && count)
        terms.push({
          name: `the hunger of ${realmName(hungry)} for their stores`,
          value: -0.25,
          source: famine.id,
          hungry: hungry.ref,
        });
    }
    // A people who prize valour are feared by a neighbour who prizes it less: by how far past the neighbour's own (rules
    // VALOUR_FEARED). Two who prize it alike know each other's measure; it is not, of itself, ill will toward every neighbour.
    const [va, vb] = [wa.traits[WAY.valour]!, wb.traits[WAY.valour]!],
      dread = valourFeared(Math.max(va, vb), Math.min(va, vb));
    if (dread > 0)
      terms.push({
        name: `the valour of ${realmName(va >= vb ? a : b)}`,
        value: -dread,
        source: null,
      });
    // How far each binds itself to others (rules/holds.ts trust): one wary of every pact holds back; two who bind freely draw close.
    const ta = sa.trust,
      tb = sb.trust,
      wary = Math.min(ta, tb);
    if (wary < 0.3)
      terms.push({
        name: `the wariness of ${realmName(ta <= tb ? a : b)}`,
        value: -(0.3 - wary) * 1.2,
        source: orderOf(world)?.of(ta <= tb ? a.ref : b.ref)?.taught?.[0]?.event ?? null,
      });
    else if (wary >= 0.65)
      terms.push({ name: "two realms that bind freely", value: 0.1, source: null });
    // (Two who sit in one council of realms think the better of each other: sim/diplomacy/councils.ts.)
    const council = sitTogether(world, a.ref, b.ref);
    if (council)
      terms.push({
        name: `sitting together in ${council.name}`,
        value: COUNCILS.regard,
        source: council.event,
      });
    // A people who laid its own woes at outsiders' door looks on its neighbours the darker (rules/holds.ts blame "theirs").
    for (const side of [a, b]) {
      const blamed = (side === a ? sa : sb).blamed;
      if (blamed)
        terms.push({
          name: `${realmName(side)} blaming outsiders for ${OUTCOME.get(blamed.taught.what)?.words ?? "its woes"}`,
          value: -HOLDING.grudgeBy * blamed.fresh,
          source: blamed.taught.event,
        });
    }
    // Another's way feared (sim/finance): the one who fears draws back; two alike who fear the same realm draw together; and what
    // each one's people hold of the other's is a reason to keep the peace.
    const money = financeOf(world);
    if (money) {
      const ab = fearOf(world, a.ref, b.ref),
        ba = fearOf(world, b.ref, a.ref),
        fear = Math.max(ab, ba);
      if (fear >= FINANCE.fearGone) {
        const [who, whom] = ab >= ba ? [a, b] : [b, a];
        terms.push({
          name: `the fear ${realmName(who)} has of how ${realmName(whom)} is held`,
          value: -FINANCE.regard * fear,
          source: money.of(who.ref)?.toldEvent ?? null,
        });
      }
      const fa = topFear(world, a.ref),
        fb = topFear(world, b.ref);
      if (fa && fb && fa.of === fb.of && fa.of !== a.ref && fa.of !== b.ref) {
        const both = Math.min(fa.level, fb.level) / 100,
          third = realms.get(fa.of);
        if (
          both >= FINANCE.fearGone &&
          third &&
          wayDistance(wayOf(world, a.ref), wayOf(world, b.ref)) <= FINANCE.alike
        )
          terms.push({
            name: `a fear they share of how ${realmName(third)} is held`,
            value: FINANCE.shared * both,
            source: money.of(a.ref)?.toldEvent ?? null,
          });
      }
      const stakes = stakesBetween(world, a.ref, b.ref);
      if (stakes >= 0.02)
        terms.push({
          name: "what their peoples hold of each other's",
          value: Math.min(0.2, stakes),
          source: null,
        });
    }
    for (const x of store.remembered(a.ref, b.ref, year, key)) terms.push(x);
    const opinion = Math.max(
      -1,
      Math.min(
        1,
        terms.reduce((s, x) => s + x.value, 0),
      ),
    );
    const before = store.keyed(key),
      relation: Relation = { a: a.ref, b: b.ref, opinion, terms, pact: before?.pact ?? null };
    // Pacts sworn and broken, by what one is worth to each (pactWorth): their regard, a foe they share, the wars each would be
    // drawn into.
    const shared = sharedFoe(a, b),
      worth = Math.min(
        pactWorth(opinion, shared.weight, sb.wars),
        pactWorth(opinion, shared.weight, sa.wars),
      );
    if (!relation.pact && worth > PACT) {
      const foe =
          shared.foe && shared.weight * ALLY.foe >= 0.1 ? realms.get(shared.foe) : undefined,
        best = [...terms].sort((x, y) => y.value - x.value)[0]!,
        reason = foe ? `a foe they share, ${realmName(foe)}` : best.name,
        source = foe ? foe.event : best.source;
      relation.pact = world.events.emit({
        type: DIPLOMACY_EVENTS.pact.type,
        subjects: [a.ref, b.ref],
        place: ctx.provinces.get(a.seat)?.ref ?? null,
        causes: source ? [{ ref: source, role: "enabler", weight: 1 }] : [],
        data: { a: realmName(a), b: realmName(b), reason },
      });
    } else if (relation.pact && worth < 0) {
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
    store.set(relation, key);
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
  world.system({ key: "186.diplomacy.year", every: YEAR, run: (t) => diplomacyYear(ctx(), t) });
  // (Bodies of realms that arise from treaties made again and again: sim/diplomacy/councils.ts.)
  const councils = world.register(new CouncilStore());
  world.addPinner(() => councils.pinned());
  world.system({ key: "186.diplomacy.councils", every: YEAR, run: (t) => councilsYear(ctx(), t) });
  // (Spies sent into the realms a realm most has reason to watch: sim/war/spies.ts.)
  world.register(new SpyStore());
  world.system({ key: "186.diplomacy.spies", every: YEAR, run: (t) => spiesYear(ctx(), t) });
  return store;
}
