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
  dmath,
  defineStream,
  yearOfMoment,
  type CauseRef,
  type Factor,
  Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import {
  cellRef,
  functionsOf,
  meansNumbers,
  meansOfWorld,
  seamRef,
  surfaceOre,
  tongueLikeness,
  type HomeWorld,
} from "../../gen/index.ts";
import {
  EFFECTS,
  LESSON_CAUSE,
  METAL_ROOTS,
  OCC,
  PRINCIPLES,
  PRINCIPLE_INDEX,
  SMELTING,
  affordsPrinciple,
  causesAnswered,
  pushOf,
  liftingEngine,
  matterShuts,
  needsMet,
  reachIn,
  turnsAside,
  type Effect,
  type Principle,
} from "../../rules/index.ts";

/** Each effect's place in a land's totals. */
const EFFECT_INDEX: ReadonlyMap<string, number> = new Map(EFFECTS.map((e, i) => [e, i]));
import type { PopulationContext } from "../population/systems.ts";
import { marketGoodRef, type MarketStore } from "../economy/market.ts";
import { oreKnown } from "../economy/heat.ts";
import { cultureOf } from "../culture/culture.ts";
import { politiesOf } from "../polity/polity.ts";
import { lessonsOf, pressIn } from "./lessons-store.ts";
import { laneLawOf } from "../space/lanes.ts";

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
/**
 * Across the sea, from those a land's ships trade with: what is carried is shown as well as told, so tongues matter
 * less (at least this alike: traders always find words), and the more it lacks the more lies in front of it to copy:
 * so much more readily for each principle it is behind. (Est: at most a principle a year, as any land, so sixty
 * behind is a century or so: as fast as a people have ever caught up.)
 */
export const CARRIED_LIKE = 0.5,
  CARRIED_BEHIND = 0.25;
/**
 * Many hands: a land of ninety thousand at a craft finds it twice as readily as one of
 * fifty, one of near a million three times — each tenfold more adds only as much again.
 * Small early lands are barely touched; the great lands of the age of iron and steam no
 * longer wait on the luck of a few.
 */
export const MANY_HANDS = 10_000;
const LEARN = defineStream("lore.learn");

export type Known = { readonly year: number; readonly event: Ref };

export class LoreStore implements StateStore {
  readonly name = "lore.known";
  /** Saved packed by column (kernel/pack.ts). */
  readonly packed = true;
  private readonly known = new Map<number, Map<string, Known>>();
  /** Each land's effects, summed from what it knows (derived; rebuilt as lore grows). */
  private readonly totals = new Map<number, Float64Array>();
  /**
   * Every learning folded in as it happens (lore only grows), so a checkpoint hashes one
   * digest, not every land's whole knowledge every year.
   */
  private digest = "";
  private count = 0;

  get(cell: number, id: string): Known | undefined {
    return this.known.get(cell)?.get(id);
  }

  /** What a land knows, in the order it came to know it (roots excluded). */
  of(cell: number): [string, Known][] {
    return [...(this.known.get(cell)?.entries() ?? [])].sort(
      (a, b) => a[1].year - b[1].year || (a[0] < b[0] ? -1 : 1),
    );
  }

  /** What a land knows, in no order: for a reading that only asks what and when (signals: host/known.ts). */
  entries(cell: number): Iterable<[string, Known]> {
    return this.known.get(cell)?.entries() ?? [];
  }

  /** The lands that know anything. */
  cells(): IterableIterator<number> {
    return this.known.keys();
  }

  learn(cell: number, id: string, k: Known, p: Principle): void {
    let m = this.known.get(cell);
    if (!m) this.known.set(cell, (m = new Map()));
    m.set(id, k);
    this.digest = new Hasher().string(this.digest).int(cell).string(id).value(k).hex();
    this.count++;
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
    h.string(this.digest).int(this.count);
  }

  save(): unknown {
    return {
      known: [...this.known.keys()].sort((a, b) => a - b).map((c) => [c, this.of(c)]),
      digest: this.digest,
      count: this.count,
    };
  }

  load(state: unknown): void {
    this.known.clear();
    this.totals.clear();
    const byId = new Map(PRINCIPLES.map((p) => [p.id, p]));
    const s = state as { known: [number, [string, Known][]][]; digest?: string; count?: number };
    for (const [cell, list] of s.known)
      for (const [id, k] of list) this.learn(cell, id, k, byId.get(id)!);
    // The fold goes on from where it stood (the order it was learned in, not the save's).
    if (s.digest !== undefined) {
      this.digest = s.digest;
      this.count = s.count ?? this.count;
    }
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

/**
 * Whether a land has an ore within reach to find a craft by, and what to cite (Phase 52 M216): a
 * metal's ore by the one rule its smelters go by — its own land's (1), else a neighbour's (0.5) —
 * else the metal itself held in its market, brought down a road or kept (0.5); salt, coal, oil and
 * the vents within two steps, as before. (Phase 54: only ore the furnace the finding would bring can
 * work — a bloomery's heat for iron.)
 */
export function oreDriver(
  ctx: PopulationContext,
  cell: number,
  kind: string,
  bringing?: string,
): { value: number; ref: Ref } | null {
  const smelt = SMELTING.find((s) => s.ore === kind);
  if (!smelt) {
    const c = oreNear(ctx, cell, kind);
    if (c === null) return null;
    // Coal and oil cite what laid them down: the field, or the age that buried it.
    const seam =
      kind === "coal" || kind === "oil" ? (seamRef(ctx.generated, c, kind) as Ref | null) : null;
    return { value: c === cell ? 1 : 0.5, ref: seam ?? cellRef(0, c) };
  }
  // (A people may come to know by what was there, though the lode be gone: the ages do not wait on a mine. E1.)
  const ore = oreKnown(ctx, cell, kind, bringing);
  if (ore) return { value: ore.cell === cell ? 1 : 0.5, ref: ore.ref };
  const markets = ctx.world.store<MarketStore>("economy.markets"),
    m = markets.get(cell);
  if (!m || (m.stock[smelt.good]! <= 0 && m.book("in", smelt.good) <= 0)) return null;
  const road = markets.flows.find((f) => f.to === cell && f.good === smelt.good);
  return {
    value: 0.5,
    ref: (road && markets.route(road.from, cell)) || marketGoodRef(cell, smelt.good),
  };
}

/**
 * Whether a world's matter allows a principle (Phase 66): what it asks of that matter is met, or it is
 * never found there, however much its people know. (Asked last, of those with all else in place.)
 */
export function matterAllows(g: HomeWorld, p: Principle): boolean {
  return !p.asks || !matterShuts(p, functionsOf(g));
}

/** Whether the laws of this universe allow a principle (Phase 68): shut, it comes to no one by any road. */
export function lawAllows(world: World, p: Principle): boolean {
  return p.law !== "lanes" || laneLawOf(world).open;
}

/** Each principle's causes it answers (rules/lessons.ts causesAnswered), by its effects. */
const ANSWERS: ReadonlyMap<string, readonly string[]> = new Map(
  PRINCIPLES.map((p) => [p.id, causesAnswered(p)]),
);

/**
 * What presses a land's finding (rules/lessons.ts pushOf), by cause: its own losses, and its realm's hosts'. Null where neither has
 * lost anything, so a world that has learned nothing finds as it did.
 */
function pressesOn(
  world: World,
  cell: number,
  realm: Ref | null,
  year: number,
): ((cause: string) => number) | null {
  const lessons = lessonsOf(world);
  if (!lessons || !lessons.holders.size) return null;
  const own = lessons.get(cellRef(0, cell)),
    hosts = realm ? lessons.get(realm) : undefined;
  if (!own?.causes.size && !hosts?.causes.size) return null;
  return (cause) => Math.max(pressIn(own, cause, year), pressIn(hosts, cause, year));
}

/**
 * What a land may find next: what it knows meets the principle's needs, and only what its people's body allows (no kilns without
 * fire, no wheels in the water), and what their world's heat, matter and laws allow (Phase 56, F2, Phase 66, 68). `here`: whether it
 * knows a principle.
 */
function openOf(
  ctx: PopulationContext,
  here: (id: string) => boolean,
  means = meansOfWorld(ctx.generated),
  lifts = liftingEngine(meansNumbers(ctx.generated)),
): Principle[] {
  const reach = reachIn(means, here);
  return PRINCIPLES.filter(
    (p) =>
      p.rate > 0 &&
      affordsPrinciple(p, ctx.medium, reach, means.wants) &&
      !here(p.id) &&
      needsMet(p, here) &&
      (!p.body?.lifts || (lifts !== null && here(lifts.id))) &&
      matterAllows(ctx.generated, p) &&
      lawAllows(ctx.world, p),
  );
}

/** What a land may find next (`openOf`), as its lore stands: for its page. Only reads. */
export function findableAt(ctx: PopulationContext, cell: number): Principle[] {
  return openOf(ctx, (id) => knows(ctx, cell, id));
}

/** The lore's year: each land may find one principle and learn one from a neighbour. */
export function loreYear(ctx: PopulationContext, t: SimTime): void {
  const { world, generated: g } = ctx,
    store = loreOf(world),
    culture = cultureOf(world),
    markets = world.store<MarketStore>("economy.markets"),
    realms = politiesOf(world),
    year = yearOfMoment(t),
    means = meansOfWorld(g),
    // (The least engine that lifts a machine here: W2's, what a row that flies asks of a land.)
    lifts = liftingEngine(meansNumbers(g));
  type Plan = { cell: number; p: Principle; found: boolean; factors: Factor[]; causes: CauseRef[] };
  const plans: Plan[] = [];
  for (const prov of ctx.provinces.all()) {
    if (!prov.total()) continue;
    const cell = prov.cell,
      // (What it knows, as `knows` reads it, with the stores in hand: asked many times a land.)
      here = (n: string) =>
        n === "cultivation"
          ? !!prov.knowsCultivation
          : n === "metalworking"
            ? !!markets.get(cell)?.metalworking
            : !!store.get(cell, n),
      open = openOf(ctx, here, means, lifts);
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
    // (What has cost it presses it toward what would answer that: exactly 1 where nothing has.)
    const pressed = pressesOn(world, cell, realms.of(cell)?.ref ?? null, year);
    for (const p of open) {
      const d = p.drivers;
      if (d.river && !g.water.river[cell]) continue;
      if (d.coast && !coast) continue;
      if (d.hills && g.tectonics.elevation[cell]! < 600) continue;
      // (A stand-in for metal or coal, only by a land that wants it: F4.)
      if (!turnsAside(d, means, (kind) => oreDriver(ctx, cell, kind) !== null)) continue;
      const ore = d.ore ? oreDriver(ctx, cell, d.ore, p.id) : null;
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
        hands =
          (d.crafters ?? 0) * prov.occupation(OCC.crafter) +
          (d.farmers ?? 0) * prov.occupation(OCC.farmer) +
          (d.herders ?? 0) * prov.occupation(OCC.herder) +
          (d.traders ?? 0) * prov.occupation(OCC.trader) +
          (d.leaders ?? 0) * prov.occupation(OCC.leader),
        many = 1 + dmath.log10(1 + hands / MANY_HANDS),
        answers = pressed ? ANSWERS.get(p.id)! : null,
        push = answers?.length ? pushOf(answers, pressed!) : 1,
        chance = p.rate * (0.2 + drive) * LORE_PACE * many * push;
      if (!(world.rng.real(FIND, cell, t, PRINCIPLE_INDEX.get(p.id)!) < chance)) continue;
      const factors: Factor[] = terms
        .filter(([, w, v]) => w * v > 0)
        .map(([name, w, v, source]) => ({ name, value: v, contribution: w * v, source }));
      if (many >= 1.1)
        factors.push({
          name: "many hands",
          value: Math.round(hands),
          contribution: many - 1,
          source: null,
        });
      if (ore !== null)
        factors.push({
          name: `${d.ore} within reach`,
          value: ore.value,
          contribution: 0.5,
          source: { ref: ore.ref, role: "enabler", weight: 1 },
        });
      // (The losses that pressed it toward this, first: the most of them.)
      if (push > 1.01) {
        const worst = answers!.reduce((a, b) => (pressed!(b) > pressed!(a) ? b : a));
        factors.unshift({
          name: `pressed by its losses to ${LESSON_CAUSE.get(worst)!.words}`,
          value: Math.round(pressed!(worst) * 100) / 100,
          contribution: push - 1,
          source: null,
        });
      }
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
    // (By land, and across the sea from those its ships trade with: what is carried is told too.)
    const borders = g.grid.offsets[cell + 1]! - g.grid.offsets[cell]!,
      sea = markets.seaPartners(cell),
      // How many principles another knows that this land does not.
      lacks = (n: number) =>
        PRINCIPLES.reduce((c, p) => (store.get(n, p.id) && !store.get(cell, p.id) ? c + 1 : c), 0);
    for (let k = 0; k < borders + sea.length; k++) {
      const n = k < borders ? g.grid.neighbours[g.grid.offsets[cell]! + k]! : sea[k - borders]!;
      if (!ctx.provinces.get(n)?.total()) continue;
      // Only a neighbour who knows something this land does not can teach it.
      if (!open.some((p) => store.get(n, p.id))) continue;
      const theirs = culture.get(n),
        carried = k >= borders,
        spoken = mine && theirs ? tongueLikeness(mine.tongue, theirs.tongue) : 0.5,
        like = carried ? Math.max(CARRIED_LIKE, spoken) : spoken,
        road = markets.route(cell, n) ? 2 : 1,
        kin = realms.of(cell) && realms.of(cell) === realms.of(n) ? 1.5 : 1,
        written = 1 + Math.max(store.effect(cell, "learning"), store.effect(n, "learning")),
        behind = carried ? 1 + CARRIED_BEHIND * lacks(n) : 1;
      for (const p of open) {
        if (!store.get(n, p.id)) continue;
        const chance = LEARNING * like * like * road * kin * written * behind;
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
    // Metal from the vents is a people of the water's metalworking; a kind's own metal root is
    // its land's (copper hammered cold, copper of blue vitriol: Phase 56).
    if (METAL_ROOTS.includes(plan.p.id)) markets.of(plan.cell).metalworking ??= event;
  }
}

/** Teach a peopled world its lore. */
export function installLore(world: World, ctx: () => PopulationContext): LoreStore {
  const store = world.register(new LoreStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "157.lore.year", every: YEAR, run: (t) => loreYear(ctx(), t) });
  return store;
}
