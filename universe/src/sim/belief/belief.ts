// Belief (docs/architecture §19): faiths that read the world. Every people starts
// with the old beliefs of their kin. When something strikes them — the god's acts,
// the hand laid among them, a famine, a terrible drought, a new knowing — a devout
// people may take it as a sign and found a faith in the power it showed: the one
// who holds the rain, the giver of plenty, the bringer and the healer of sickness,
// the teacher, the one who walks among us. Faiths spread to neighbours who speak
// alike, faster down roads and within a holy seat's realm; they deepen devotion;
// and they are blamed — famine under a priest-king of the same faith breeds more
// grievance. A faith held far from where it began, by people of other speech,
// splits. Every founding, conversion and schism cites what caused it.
import {
  YEAR,
  defineEventType,
  defineKind,
  defineStream,
  yearOfMoment,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { tongueLikeness, tongueName } from "../../gen/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import type { MarketStore } from "../economy/market.ts";
import { WAY, cultureOf } from "../culture/culture.ts";
import { politiesOf } from "../polity/polity.ts";

export const FAITH = defineKind("faith", "faith", "minted");

export const BELIEF_EVENTS = {
  founded: defineEventType("belief.founded", 6),
  converted: defineEventType("belief.converted", 3),
  schism: defineEventType("belief.schism", 5),
};

/** What a faith holds to be the power behind the world. */
export const TENETS = [
  "rain",
  "plenty",
  "sickness",
  "healing",
  "teaching",
  "presence",
  "hunger",
  "fire",
] as const;
export type Tenet = (typeof TENETS)[number];

/** Who the faithful worship, by tenet. */
export const DEITIES: Readonly<Record<Tenet, string>> = {
  rain: "the one who holds the rain",
  plenty: "the giver of plenty",
  sickness: "the one who sends sickness",
  healing: "the healer",
  teaching: "the teacher",
  presence: "the one who walks among us",
  hunger: "the hungry god",
  fire: "the one who sends fire",
};

export type Faith = {
  readonly ref: Ref;
  /** The faithful's own name for themselves, in their founders' tongue. */
  readonly name: string;
  readonly tenet: Tenet;
  readonly founded: number;
  readonly event: Ref;
  readonly seat: number;
  /** The faith it split from, if a schism made it. */
  readonly from: Ref | null;
};

/** What a land believes, since when, and the event that brought it. */
export type Belief = { faith: Ref | null; since: number; event: Ref | null };

const OMEN = defineStream("belief.omen");
const SPREAD = defineStream("belief.spread");

/** Omens: what a people may take as a sign, by event type, and how strongly. */
function omenOf(type: string, data: unknown): { tenet: Tenet; strength: number } | null {
  const sign = (data as { sign?: number } | null)?.sign ?? 1,
    rain = (data as { rain?: number } | null)?.rain ?? 1000;
  switch (type) {
    case "act.rain":
      return { tenet: "rain", strength: 1 };
    case "act.harvest":
      return { tenet: sign < 0 ? "hunger" : "plenty", strength: 1 };
    case "act.plague":
      return { tenet: sign < 0 ? "sickness" : "healing", strength: 1 };
    case "act.inspire":
      return { tenet: "teaching", strength: 1 };
    case "hand.laid":
      return { tenet: "presence", strength: 1.2 };
    case "act.shrine":
      return { tenet: "presence", strength: 1 };
    case "act.fire":
      return { tenet: "fire", strength: 1 };
    case "act.spring":
      return { tenet: "plenty", strength: 1 };
    case "act.inspire-one":
      return { tenet: "teaching", strength: 1 };
    case "act.bless-one":
      return { tenet: "healing", strength: 0.8 };
    case "people.famine":
      return { tenet: "hunger", strength: 0.25 };
    case "weather.drought":
      return rain < 550 ? { tenet: "rain", strength: 0.15 } : null;
    case "knowledge.cultivation":
    case "knowledge.metalworking":
      return { tenet: "teaching", strength: 0.2 };
    default:
      return null;
  }
}

export class BeliefStore implements StateStore {
  readonly name = "belief.faiths";
  private list: Faith[] = [];
  private readonly held = new Map<number, Belief>();
  private readonly splits = new Map<string, number>();

  /** The year a faith last split (−∞ if never). */
  lastSplit(ref: Ref): number {
    return this.splits.get(ref) ?? -Infinity;
  }

  markSplit(ref: Ref, year: number): void {
    this.splits.set(ref, year);
  }

  /** The same faiths by ref. */
  private readonly byRef = new Map<string, Faith>();

  add(f: Faith): void {
    this.list.push(f);
    this.byRef.set(f.ref, f);
  }

  all(): readonly Faith[] {
    return this.list;
  }

  get(ref: Ref): Faith | undefined {
    return this.byRef.get(ref);
  }

  /** What a land believes (the old beliefs of their kin when no faith has come to them). */
  of(cell: number): Belief {
    return this.held.get(cell) ?? { faith: null, since: 0, event: null };
  }

  set(cell: number, b: Belief): void {
    this.held.set(cell, b);
  }

  /** The lands that hold a faith. */
  lands(faith: Ref): number[] {
    return [...this.held.entries()]
      .filter(([, b]) => b.faith === faith)
      .map(([c]) => c)
      .sort((a, b) => a - b);
  }

  pinned(): Ref[] {
    const refs = this.list.map((f) => f.event);
    for (const b of this.held.values()) if (b.event) refs.push(b.event);
    return refs;
  }

  hashInto(h: Hasher): void {
    h.value(this.list)
      .value([...this.held.entries()].sort((a, b) => a[0] - b[0]))
      .value([...this.splits.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)));
  }

  save(): unknown {
    return {
      faiths: this.list,
      held: [...this.held.entries()].sort((a, b) => a[0] - b[0]),
      splits: [...this.splits.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)),
    };
  }

  load(state: unknown): void {
    const s = state as { faiths: Faith[]; held: [number, Belief][]; splits: [string, number][] };
    this.list = [...s.faiths];
    this.byRef.clear();
    for (const f of this.list) this.byRef.set(f.ref, f);
    this.held.clear();
    for (const [c, b] of s.held) this.held.set(c, { ...b });
    this.splits.clear();
    for (const [f, y] of s.splits) this.splits.set(f, y);
  }
}

export function beliefOf(world: World): BeliefStore {
  return world.store<BeliefStore>("belief.faiths");
}

/** Faith names: "the Rain-keepers of Kirath" — the faithful's calling, in their tongue's words for a place. */
function faithName(tenet: Tenet, word: string): string {
  const calling: Readonly<Record<Tenet, string>> = {
    rain: "Rain-keepers",
    plenty: "Keepers of Plenty",
    sickness: "Fearers",
    healing: "Mended",
    teaching: "Learners",
    presence: "Witnesses",
    hunger: "Hungerers",
    fire: "Keepers of the Flame",
  };
  return `the ${calling[tenet]} of ${word}`;
}

/** The year's belief: omens found faiths, faiths spread, far faiths split, faith deepens devotion. */
export function beliefYear(ctx: PopulationContext, t: SimTime): void {
  const { world, generated: g } = ctx,
    store = beliefOf(world),
    culture = cultureOf(world),
    markets = world.store<MarketStore>("economy.markets"),
    year = yearOfMoment(t);

  // 1. Omens: what struck a people this year may found a faith.
  const start = Math.max(0, t - YEAR),
    events = world.events.all(),
    founded = new Set<number>();
  for (let i = events.length - 1; i >= 0 && events[i]!.t > start; i--) {
    const e = events[i]!,
      omen = omenOf(e.type, e.data);
    if (!omen || !e.place) continue;
    const cell = Number(e.place.split(":")[2]),
      ways = culture.get(cell),
      now = store.of(cell),
      current = now.faith ? store.get(now.faith) : undefined;
    if (!ways || founded.has(cell) || current?.tenet === omen.tenet) continue;
    // Hard years found faiths only among those of the old beliefs; the god's own acts can move anyone.
    if (current && omen.strength < 1) continue;
    const piety = ways.traits[WAY.piety]!,
      chance = omen.strength * Math.max(0, piety - 0.3) * 1.2;
    if (!(world.rng.real(OMEN, cell, t, i % 997) < chance)) continue;
    const ref = world.minter.mint(FAITH),
      name = faithName(
        omen.tenet,
        tongueName({ ...ways.tongue, seed: ways.tongue.seed ^ 0xfa17 }, cell),
      );
    const event = world.events.emit({
      type: BELIEF_EVENTS.founded.type,
      subjects: [ref],
      place: e.place,
      causes: [{ ref: e.id, role: "trigger", weight: 1 }],
      data: { name, tenet: omen.tenet },
    });
    store.add({ ref, name, tenet: omen.tenet, founded: year, event, seat: cell, from: now.faith });
    store.set(cell, { faith: ref, since: year, event });
    founded.add(cell);
  }

  // 2. Faiths spread to neighbours who speak alike: planned from the year's opening, then made.
  const converts: { cell: number; faith: Ref; via: number; chance: number }[] = [];
  const realms = world.storeNames().includes("polity.states") ? politiesOf(world) : null;
  for (const p of ctx.provinces.all()) {
    if (founded.has(p.cell) || !p.total()) continue;
    const mine = culture.get(p.cell),
      now = store.of(p.cell);
    if (!mine) continue;
    let best: (typeof converts)[number] | null = null;
    for (let k = g.grid.offsets[p.cell]!; k < g.grid.offsets[p.cell + 1]!; k++) {
      const n = g.grid.neighbours[k]!,
        theirs = store.of(n);
      if (!theirs.faith || theirs.faith === now.faith) continue;
      const other = culture.get(n);
      if (!other) continue;
      const like = tongueLikeness(mine.tongue, other.tongue),
        road = markets.route(p.cell, n) ? 1.5 : 1,
        realm = realms?.of(p.cell),
        holy =
          realm && realm.leadership === 3 && store.of(realm.seat).faith === theirs.faith ? 2 : 1,
        // Those who hold a faith already are slower to leave it than those of the old beliefs.
        hold = now.faith ? 0.3 : 1,
        chance = 0.05 * like * like * road * holy * hold * (0.5 + other.traits[WAY.piety]!);
      if (!best || chance > best.chance || (chance === best.chance && theirs.faith < best.faith))
        best = { cell: p.cell, faith: theirs.faith, via: n, chance };
    }
    if (best && world.rng.real(SPREAD, p.cell, t, 0) < best.chance) converts.push(best);
  }
  for (const c of converts) {
    const prov = ctx.provinces.get(c.cell)!,
      road = markets.route(c.cell, c.via);
    const event = world.events.emit({
      type: BELIEF_EVENTS.converted.type,
      subjects: [c.faith, prov.ref],
      place: prov.ref,
      causes: [
        { ref: store.of(c.via).event ?? store.get(c.faith)!.event, role: "trigger", weight: 0.6 },
        ...(road ? [{ ref: road, role: "enabler" as const, weight: 0.4 }] : []),
      ],
      data: { name: store.get(c.faith)!.name },
    });
    store.set(c.cell, { faith: c.faith, since: year, event });
  }

  // 3. A faith held far from its seat by people of other speech splits — at most once a century.
  if (year % 10 === 0)
    for (const f of [...store.all()]) {
      const seat = culture.get(f.seat);
      if (!seat || year - store.lastSplit(f.ref) < 100) continue;
      const far = store
        .lands(f.ref)
        .filter((c) => tongueLikeness(culture.get(c)!.tongue, seat.tongue) < 0.72);
      if (far.length < 3) continue;
      const first = far[0]!,
        there = culture.get(first)!,
        ref = world.minter.mint(FAITH),
        name = faithName(
          f.tenet,
          tongueName({ ...there.tongue, seed: there.tongue.seed ^ 0xfa17 }, first),
        );
      store.markSplit(f.ref, year);
      const event = world.events.emit({
        type: BELIEF_EVENTS.schism.type,
        subjects: [ref, f.ref],
        place: ctx.provinces.get(first)!.ref,
        causes: [{ ref: f.event, role: "enabler", weight: 1 }],
        data: { name, from: f.name },
      });
      store.add({ ref, name, tenet: f.tenet, founded: year, event, seat: first, from: f.ref });
      for (const c of far) store.set(c, { faith: ref, since: year, event });
    }

  // 4. Faith deepens devotion.
  for (const p of ctx.provinces.all()) {
    const b = store.of(p.cell),
      w = culture.get(p.cell);
    // A faith held for generations becomes part of who a people are.
    if (b.faith && w) w.base[WAY.piety] = Math.min(0.85, w.base[WAY.piety]! + 0.0005);
  }
}

/** Teach a peopled world its faiths. */
export function installBelief(world: World, ctx: () => PopulationContext): BeliefStore {
  const store = world.register(new BeliefStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "175.belief.year", every: YEAR, run: (t) => beliefYear(ctx(), t) });
  return store;
}
