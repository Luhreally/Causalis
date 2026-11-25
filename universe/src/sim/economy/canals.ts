// Canals dug (rules/canals.ts): which roads between two lands have one, the year and the event. A realm weighs
// each road within it once in CANAL.every years, by what last year's trade on it paid in carrying; a road with a
// canal carries at a river's cost (economy/systems.ts edges). A few numbers a canal, none a land.
import {
  YEAR,
  Hasher,
  defineEventType,
  dmath,
  yearOfMoment,
  type CauseRef,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { cellRef } from "../../gen/index.ts";
import { CANAL, G, GOODS, weighCanal } from "../../rules/index.ts";
import { loreOf } from "../lore/lore.ts";
import { politiesOf } from "../polity/polity.ts";
import { marketsOf, type PopulationContext } from "../population/systems.ts";
import { warsOf } from "../war/war.ts";

export const CANAL_EVENTS = {
  /** A realm dug a canal between two of its lands. */
  dug: defineEventType("economy.canal", 4),
};

/** A canal: the two lands it joins (the lesser first), the year its digging is done (it carries from then) and the event. */
export type Canal = {
  readonly a: number;
  readonly b: number;
  readonly year: number;
  readonly event: Ref;
};

const SPAN = 2 ** 24;
const keyOf = (a: number, b: number) => (a < b ? a * SPAN + b : b * SPAN + a);

export class CanalStore implements StateStore {
  readonly name = "economy.canals";
  private readonly map = new Map<number, Canal>();

  get size(): number {
    return this.map.size;
  }
  has(a: number, b: number): boolean {
    return this.map.size > 0 && this.map.has(keyOf(a, b));
  }
  between(a: number, b: number): Canal | undefined {
    return this.map.get(keyOf(a, b));
  }
  /** Whether a canal between two lands carries in a year: its digging done. */
  carries(a: number, b: number, year: number): boolean {
    const c = this.map.size > 0 ? this.map.get(keyOf(a, b)) : undefined;
    return !!c && c.year <= year;
  }
  add(c: Canal): void {
    this.map.set(keyOf(c.a, c.b), c);
  }
  all(): Canal[] {
    return [...this.map.values()].sort((x, y) => x.a - y.a || x.b - y.b);
  }
  pinned(): Ref[] {
    return this.all().map((c) => c.event);
  }
  hashInto(h: Hasher): void {
    for (const c of this.all()) h.int(c.a).int(c.b).int(c.year).string(c.event);
  }
  save(): unknown {
    return { canals: this.all() };
  }
  load(state: unknown): void {
    this.map.clear();
    for (const c of (state as { canals?: Canal[] } | null)?.canals ?? []) this.add({ ...c });
  }
}

export function canalsOf(world: World): CanalStore | null {
  return world.peek<CanalStore>("economy.canals") ?? null;
}

/** What carrying a unit of grain a hundred kilometres over flat ground costs, in grain (economy/systems.ts HAUL_PER_100KM). */
const HAUL = 0.08;

/** The kilometres and the rise between two neighbouring lands. */
function span(ctx: PopulationContext, a: number, b: number): { km: number; climb: number } {
  const g = ctx.generated,
    pa = g.grid.positions,
    dx = pa[3 * a]! - pa[3 * b]!,
    dy = pa[3 * a + 1]! - pa[3 * b + 1]!,
    dz = pa[3 * a + 2]! - pa[3 * b + 2]!;
  return {
    km: dmath.sqrt(dx * dx + dy * dy + dz * dz) * 6371 * g.planet.radius,
    climb: Math.abs(g.tectonics.elevation[a]! - g.tectonics.elevation[b]!),
  };
}

/** A road weighed for a canal: its two lands, what passed it, and how the weighing came out. */
export type CanalReading = {
  readonly a: number;
  readonly b: number;
  readonly km: number;
  readonly climb: number;
  readonly haul: number;
  readonly people: number;
  readonly weighed: ReturnType<typeof weighCanal>;
};

/**
 * Every road a realm could dig a canal along now, weighed: each road last year's trade passed between two
 * neighbouring lands of one realm at peace, neither already joined by rivers nor by a canal.
 */
export function canalsWeighed(ctx: PopulationContext): CanalReading[] {
  const { world, generated: g } = ctx,
    store = canalsOf(world),
    markets = marketsOf(world),
    out: CanalReading[] = [];
  if (!store || !markets.flows.length) return out;
  // What passed each road last year, in bulk: both ways together.
  const passed = new Map<number, number>();
  for (const f of markets.flows) {
    const k = keyOf(f.from, f.to);
    passed.set(k, (passed.get(k) ?? 0) + f.count * GOODS[f.good]!.bulk);
  }
  const realms = politiesOf(world),
    lore = loreOf(world),
    wars = warsOf(world),
    people = new Map<Ref, number>(),
    grain = new Map<Ref, number>();
  for (const [k, bulk] of [...passed].sort((x, y) => x[0] - y[0])) {
    const a = Math.floor(k / SPAN),
      b = k % SPAN;
    if (store.has(a, b) || markets.bySea(a, b)) continue;
    // (Neighbours by land only: a road, not a crossing.)
    let near = false;
    for (let j = g.grid.offsets[a]!; j < g.grid.offsets[a + 1]!; j++)
      if (g.grid.neighbours[j] === b) near = true;
    if (!near) continue;
    // (Rivers at both ends carry it already.)
    if (g.water.river[a] && g.water.river[b]) continue;
    const realm = realms.of(a);
    if (!realm || realms.of(b)?.ref !== realm.ref || wars.fighting(realm.ref).length) continue;
    const { km, climb } = span(ctx, a, b),
      eased = 1 - Math.min(0.7, Math.max(lore.effect(a, "haul"), lore.effect(b, "haul"))),
      haul = bulk * HAUL * (km / 100) * (1 + climb / 800) * eased;
    let folk = people.get(realm.ref);
    if (folk === undefined) {
      folk = 0;
      let stored = 0;
      for (const c of realm.members) {
        folk += ctx.provinces.get(c)?.total() ?? 0;
        stored += markets.get(c)?.stock[G.grain] ?? 0;
      }
      people.set(realm.ref, folk);
      grain.set(realm.ref, stored);
    }
    out.push({
      a,
      b,
      km,
      climb,
      haul,
      people: folk,
      weighed: weighCanal({
        km,
        climb,
        haul,
        people: folk,
        watered: !!(g.water.river[a] || g.water.river[b] || g.water.lake[a] || g.water.lake[b]),
        grain: grain.get(realm.ref)!,
      }),
    });
  }
  return out;
}

/** The year's digging, once in CANAL.every years: every road weighed, and dug where the trade saved is more than the work. */
export function canalYear(ctx: PopulationContext, t: SimTime): void {
  const year = yearOfMoment(t);
  if (year % CANAL.every !== 0) return;
  const { world } = ctx,
    store = canalsOf(world);
  if (!store) return;
  const markets = marketsOf(world),
    realms = politiesOf(world),
    spent = new Set<Ref>();
  for (const r of canalsWeighed(ctx)) {
    if (!r.weighed.dig) continue;
    const { a, b } = r,
      realm = realms.of(a)!;
    // (Its granaries as they stand now: an earlier canal of this year's has drawn on them.)
    let stored = 0;
    for (const c of realm.members) stored += markets.get(c)?.stock[G.grain] ?? 0;
    const w = spent.has(realm.ref)
      ? weighCanal({
          km: r.km,
          climb: r.climb,
          haul: r.haul,
          people: r.people,
          watered: true,
          grain: stored,
        })
      : r.weighed;
    if (!w.dig) continue;
    // The diggers' keep, paid out of its granaries, the fullest first.
    let left = Math.ceil(w.cost);
    for (const c of [...realm.members].sort(
      (x, y) =>
        (markets.get(y)?.stock[G.grain] ?? 0) - (markets.get(x)?.stock[G.grain] ?? 0) || x - y,
    )) {
      if (left <= 0) break;
      const m = markets.get(c);
      if (m) left -= m.take("used", G.grain, left);
    }
    spent.add(realm.ref);
    const opens = year + Math.ceil(w.years),
      route = markets.route(a, b) ?? markets.route(b, a) ?? null,
      decision = world.decisions.record({
        rule: "economy.canal",
        subject: realm.ref,
        outcome: { a, b },
        score: w.saved,
        threshold: w.cost,
        factors: [
          {
            name: `the trade passing: ${Math.round(r.haul)} in grain a year to carry, ${Math.round(w.saved)} saved in ${CANAL.horizon} years`,
            value: w.saved,
            contribution: w.saved,
            source: route ? { ref: route, role: "trigger", weight: 1 } : null,
          },
          {
            name: `the work: ${Math.round(r.km)} km of cut and ${Math.round(r.climb)} m of rise, ${Math.round(w.work)} person-years`,
            value: w.work,
            contribution: -w.cost,
            source: { ref: cellRef(0, a) as Ref, role: "constraint", weight: 0.5 },
          },
          {
            name: `its hands: ${Math.round(r.people * CANAL.hands)} diggers, ${Math.ceil(w.years)} years`,
            value: w.years,
            contribution: 0,
            source: { ref: realm.ref, role: "agent", weight: 1 },
          },
        ],
      }),
      causes: CauseRef[] = [{ ref: decision, role: "trigger", weight: 1 }];
    if (route) causes.push({ ref: route, role: "enabler", weight: 0.6 });
    const event = world.events.emit({
      type: CANAL_EVENTS.dug.type,
      importance: 4,
      place: cellRef(0, a) as Ref,
      subjects: [realm.ref, cellRef(0, a) as Ref, cellRef(0, b) as Ref],
      causes,
      data: {
        realm: realm.town,
        km: Math.round(r.km),
        climb: Math.round(r.climb),
        work: Math.round(w.work),
        years: Math.ceil(w.years),
        saves: Math.round(w.saved / CANAL.horizon),
        grain: Math.ceil(w.cost),
        opens,
        year,
      },
    });
    store.add({ a: Math.min(a, b), b: Math.max(a, b), year: opens, event });
  }
}

export function installCanals(world: World, ctx: () => PopulationContext): CanalStore {
  const store = world.register(new CanalStore());
  world.addPinner(() => store.pinned());
  // (After the year's trade is made and before its ledger closes: it reads the year's own flows.)
  world.system({ key: "127.economy.canals", every: YEAR, run: (t) => canalYear(ctx(), t) });
  return store;
}
