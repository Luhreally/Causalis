// Lore (docs/architecture §22): what each land knows of the principles. A land
// finds a principle when it knows what the principle needs and the people who
// would find it are there — crafters at the wheel, farmers at the plough, leaders
// at the reckoning of seasons — pushed by what presses them (a famine) and allowed
// by what the land holds (a river, the sea, hills, an ore within reach). Finding
// is a recorded decision whose factors cite those drivers. What one land knows its
// neighbours learn, the more readily with alike speech, a road between them and a
// realm in common, faster once writing is known. The older roots — sowing and
// smelting copper — are known by the systems that found them. A land's lore sums
// into effects the owning systems read: yields, keeping, crafts, carrying, health,
// a realm's reach, written law.
import {
  YEAR,
  defineEventType,
  defineStream,
  yearOfMoment,
  type CauseRef,
  type Factor,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { cellRef, seamRef, surfaceOre, tongueLikeness } from "../../gen/index.ts";
import {
  EFFECTS,
  OCC,
  PRINCIPLES,
  PRINCIPLE_INDEX,
  type Effect,
  type Principle,
} from "../../rules/index.ts";

/** Each effect's place in a land's totals. */
const EFFECT_INDEX: ReadonlyMap<string, number> = new Map(EFFECTS.map((e, i) => [e, i]));
import type { PopulationContext } from "../population/systems.ts";
import type { MarketStore } from "../economy/market.ts";
import { cultureOf } from "../culture/culture.ts";
import { politiesOf } from "../polity/polity.ts";

export const LORE_EVENTS = {
  found: defineEventType("lore.found", 5),
  learned: defineEventType("lore.learned", 2),
};

const FIND = defineStream("lore.find");
/**
 * The pace of finding: a principle's rate is how readily one people well placed to
 * find it would, and a peopled continent holds many peoples. This keeps the tree
 * unfolding over centuries rather than decades.
 */
export const LORE_PACE = 0.02;
/** How readily a land learns what a neighbour knows, in a year, before speech and roads. */
export const LEARNING = 0.03;
const LEARN = defineStream("lore.learn");

export type Known = { readonly year: number; readonly event: Ref };

export class LoreStore implements StateStore {
  readonly name = "lore.known";
  private readonly known = new Map<number, Map<string, Known>>();
  /** Each land's effects, summed from what it knows (derived; rebuilt as lore grows). */
  private readonly totals = new Map<number, Float64Array>();

  get(cell: number, id: string): Known | undefined {
    return this.known.get(cell)?.get(id);
  }

  /** What a land knows, in the order it came to know it (roots excluded). */
  of(cell: number): [string, Known][] {
    return [...(this.known.get(cell)?.entries() ?? [])].sort(
      (a, b) => a[1].year - b[1].year || (a[0] < b[0] ? -1 : 1),
    );
  }

  learn(cell: number, id: string, k: Known, p: Principle): void {
    let m = this.known.get(cell);
    if (!m) this.known.set(cell, (m = new Map()));
    m.set(id, k);
    const t = this.totals.get(cell) ?? new Float64Array(EFFECTS.length);
    EFFECTS.forEach((e, i) => (t[i] = t[i]! + (p.effects[e] ?? 0)));
    this.totals.set(cell, t);
  }

  /** A land's total of an effect. */
  effect(cell: number, e: Effect): number {
    return this.totals.get(cell)?.[EFFECT_INDEX.get(e)!] ?? 0;
  }

  pinned(): Ref[] {
    const refs: Ref[] = [];
    for (const m of this.known.values()) for (const k of m.values()) refs.push(k.event);
    return refs;
  }

  hashInto(h: Hasher): void {
    for (const cell of [...this.known.keys()].sort((a, b) => a - b))
      h.int(cell).value(this.of(cell));
  }

  save(): unknown {
    return {
      known: [...this.known.keys()].sort((a, b) => a - b).map((c) => [c, this.of(c)]),
    };
  }

  load(state: unknown): void {
    this.known.clear();
    this.totals.clear();
    const byId = new Map(PRINCIPLES.map((p) => [p.id, p]));
    for (const [cell, list] of (state as { known: [number, [string, Known][]][] }).known)
      for (const [id, k] of list) this.learn(cell, id, k, byId.get(id)!);
  }
}

export function loreOf(world: World): LoreStore {
  return world.store<LoreStore>("lore.known");
}

/** Whether a land knows a principle: the roots by the older systems, the rest by its lore. */
export function knows(ctx: PopulationContext, cell: number, id: string): boolean {
  if (id === "cultivation") return !!ctx.provinces.get(cell)?.knowsCultivation;
  if (id === "metalworking")
    return !!ctx.world.store<MarketStore>("economy.markets").get(cell)?.metalworking;
  return !!loreOf(ctx.world).get(cell, id);
}

/** The land within two steps that holds an ore, if any: own land first. */
// Which land within two steps holds an ore: a pure function of the generated world, kept.
const ORE_NEAR = new Map<string, number | null>();
function oreNear(ctx: PopulationContext, cell: number, kind: string): number | null {
  const key = `${ctx.generated.digest}:${cell}:${kind}`;
  if (ORE_NEAR.has(key)) return ORE_NEAR.get(key)!;
  if (ORE_NEAR.size > 100_000) ORE_NEAR.clear();
  const found = findOreNear(ctx, cell, kind);
  ORE_NEAR.set(key, found);
  return found;
}
function findOreNear(ctx: PopulationContext, cell: number, kind: string): number | null {
  const g = ctx.generated,
    has = (c: number) =>
      ctx.generated.deposits.some((d) => d.cell === c && d.kind === kind) || surfaceOre(g, c, kind);
  if (has(cell)) return cell;
  const near: number[] = [];
  for (let k = g.grid.offsets[cell]!; k < g.grid.offsets[cell + 1]!; k++) {
    const n = g.grid.neighbours[k]!;
    near.push(n);
    for (let j = g.grid.offsets[n]!; j < g.grid.offsets[n + 1]!; j++)
      near.push(g.grid.neighbours[j]!);
  }
  return [...new Set(near)].sort((a, b) => a - b).find(has) ?? null;
}

/** The lore's year: each land may find one principle and learn one from a neighbour. */
export function loreYear(ctx: PopulationContext, t: SimTime): void {
  const { world, generated: g } = ctx,
    store = loreOf(world),
    culture = cultureOf(world),
    markets = world.store<MarketStore>("economy.markets"),
    realms = politiesOf(world),
    year = yearOfMoment(t);
  type Plan = { cell: number; p: Principle; found: boolean; factors: Factor[]; causes: CauseRef[] };
  const plans: Plan[] = [];
  for (const prov of ctx.provinces.all()) {
    if (!prov.total()) continue;
    const cell = prov.cell,
      open = PRINCIPLES.filter(
        (p) => p.rate > 0 && !store.get(cell, p.id) && p.needs.every((n) => knows(ctx, cell, n)),
      );
    if (!open.length) continue;
    // Finding: the first principle whose drivers carry it, in the tree's order.
    const famine = (() => {
        const e = prov.lastFamine ? world.events.get(prov.lastFamine) : undefined;
        return e && t - e.t <= 3 * YEAR ? e.id : null;
      })(),
      town = ctx.settlements.inProvince(cell).find((s) => s.market),
      coast = (() => {
        for (let k = g.grid.offsets[cell]!; k < g.grid.offsets[cell + 1]!; k++)
          if (g.tectonics.elevation[g.grid.neighbours[k]!]! <= 0) return true;
        return false;
      })();
    let found: Plan | null = null;
    for (const p of open) {
      const d = p.drivers;
      if (d.river && !g.water.river[cell]) continue;
      if (d.coast && !coast) continue;
      if (d.hills && g.tectonics.elevation[cell]! < 600) continue;
      const ore = d.ore ? oreNear(ctx, cell, d.ore) : null;
      if (d.ore && ore === null) continue;
      const terms: [string, number, number, CauseRef | null][] = [
        ["crafters", d.crafters ?? 0, Math.min(1, prov.occupation(OCC.crafter) / 50), null],
        ["farmers", d.farmers ?? 0, Math.min(1, prov.occupation(OCC.farmer) / 400), null],
        ["herders", d.herders ?? 0, Math.min(1, prov.occupation(OCC.herder) / 60), null],
        ["traders", d.traders ?? 0, Math.min(1, prov.occupation(OCC.trader) / 30), null],
        ["leaders", d.leaders ?? 0, Math.min(1, prov.occupation(OCC.leader) / 20), null],
        [
          "a famine",
          d.famine ?? 0,
          famine ? 1 : 0,
          famine ? { ref: famine, role: "pressure", weight: 1 } : null,
        ],
        [
          "a market town",
          d.town ?? 0,
          town ? 1 : 0,
          town?.market ? { ref: town.market, role: "enabler", weight: 1 } : null,
        ],
      ];
      const drive = terms.reduce((s, [, w, v]) => s + w * v, 0),
        chance = p.rate * (0.2 + drive) * LORE_PACE;
      if (!(world.rng.real(FIND, cell, t, PRINCIPLE_INDEX.get(p.id)!) < chance)) continue;
      const factors: Factor[] = terms
        .filter(([, w, v]) => w * v > 0)
        .map(([name, w, v, source]) => ({ name, value: v, contribution: w * v, source }));
      if (ore !== null)
        factors.push({
          name: `${d.ore} within reach`,
          value: ore === cell ? 1 : 0.5,
          contribution: 0.5,
          // Coal and oil cite what laid them down: the field, or the age that buried it.
          source: {
            ref:
              ((d.ore === "coal" || d.ore === "oil") && (seamRef(g, ore, d.ore) as Ref | null)) ||
              cellRef(0, ore),
            role: "enabler",
            weight: 1,
          },
        });
      found = { cell, p, found: true, factors: factors.slice(0, 6), causes: [] };
      break;
    }
    if (found) {
      plans.push(found);
      continue;
    }
    // Learning: the principle a neighbour knows that this land most readily takes up.
    const mine = culture.get(cell);
    let best: { p: Principle; from: number; chance: number } | null = null;
    for (let k = g.grid.offsets[cell]!; k < g.grid.offsets[cell + 1]!; k++) {
      const n = g.grid.neighbours[k]!;
      if (!ctx.provinces.get(n)?.total()) continue;
      // Only a neighbour who knows something this land does not can teach it.
      if (!open.some((p) => store.get(n, p.id))) continue;
      const theirs = culture.get(n),
        like = mine && theirs ? tongueLikeness(mine.tongue, theirs.tongue) : 0.5,
        road = markets.route(cell, n) ? 2 : 1,
        kin = realms.of(cell) && realms.of(cell) === realms.of(n) ? 1.5 : 1,
        written = 1 + Math.max(store.effect(cell, "learning"), store.effect(n, "learning"));
      for (const p of open) {
        if (!store.get(n, p.id)) continue;
        const chance = LEARNING * like * like * road * kin * written;
        if (!best || chance > best.chance || (chance === best.chance && n < best.from))
          best = { p, from: n, chance };
      }
    }
    if (best && world.rng.real(LEARN, cell, t, 0) < best.chance) {
      const road = markets.route(cell, best.from);
      plans.push({
        cell,
        p: best.p,
        found: false,
        factors: [],
        causes: [
          { ref: store.get(best.from, best.p.id)!.event, role: "trigger", weight: 0.7 },
          ...(road ? [{ ref: road, role: "enabler" as const, weight: 0.3 }] : []),
        ],
      });
    }
  }
  for (const plan of plans) {
    const place = cellRef(0, plan.cell);
    let causes = plan.causes;
    if (plan.found) {
      const decision = world.decisions.record({
        rule: "lore.find",
        subject: place,
        outcome: { principle: plan.p.id },
        score: plan.p.rate,
        threshold: 0,
        factors: plan.factors,
      });
      causes = [{ ref: decision, role: "trigger", weight: 1 }];
    }
    const event = world.events.emit({
      type: plan.found ? LORE_EVENTS.found.type : LORE_EVENTS.learned.type,
      place,
      causes,
      data: { principle: plan.p.id },
    });
    store.learn(plan.cell, plan.p.id, { year, event }, plan.p);
  }
}

/** Teach a peopled world its lore. */
export function installLore(world: World, ctx: () => PopulationContext): LoreStore {
  const store = world.register(new LoreStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "157.lore.year", every: YEAR, run: (t) => loreYear(ctx(), t) });
  return store;
}
