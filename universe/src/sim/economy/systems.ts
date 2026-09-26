// The economy's systems (docs/architecture §20). Once a year, after the year's
// food has been grown and eaten: flocks give wool and hides; crafters make what is
// worth most from what there is to work; people wear out tools, clothing and pots;
// goods go from where they are cheap to where they are dear, as far as carriers
// can take them; prices follow what ran short and what piled up; and what a year
// of each kind of work was worth is set down, for people to follow. The first time
// goods go down a road, and when trade answers a famine, history records why.
// Metalworking is found where crafters work a copper seam, and spreads along roads.
import {
  YEAR,
  apportion,
  defineEventType,
  defineStream,
  dmath,
  purpose,
  refHash,
  yearOfMoment,
  type CauseRef,
  type Factor,
  type Ref,
  type SimTime,
  type World,
} from "../../kernel/index.ts";
import { cellRef, surfaceCopper } from "../../gen/index.ts";
import { loreOf } from "../lore/lore.ts";
import {
  FOODS,
  FORAGER_HIDES,
  G,
  GOODS,
  HERD_GOODS,
  HOME_MADE,
  OCC,
  PORTERAGE_PER_PERSON,
  PRODUCTIVITY,
  RECIPES,
  TOOL_GAIN,
  TOOL_USERS,
  TRADER_CAPACITY,
  WANTS,
  type Recipe,
} from "../../rules/index.ts";
import type { Province } from "../population/model.ts";
import {
  marketsOf,
  populationContext,
  provinceCapacity,
  roundKeyed,
  type PopulationContext,
} from "../population/systems.ts";
import { GOOD_COUNT, type Market, type MarketStore, type TradeFlow } from "./market.ts";

const SPREADING = purpose("spread");
const HERDS = defineStream("econ.herds");
const CRAFT = defineStream("econ.craft");
const WEAR = defineStream("econ.wear");
const METAL = defineStream("econ.metal");

export const ECONOMY_EVENTS = {
  route: defineEventType("trade.route-opened", 3),
  relief: defineEventType("trade.relief", 4),
  metalworking: defineEventType("knowledge.metalworking", 6),
  metalworkingSpread: defineEventType("knowledge.metalworking-spread", 3),
};

/** What carrying a unit of grain a hundred kilometres over flat ground costs, in grain. */
export const HAUL_PER_100KM = 0.08;
/** A province keeps this many months of its people's food before it sells any. */
const FOOD_RESERVE_MONTHS = 3;
/** How far toward where supply and demand would put it a price moves in a year. */
const PRICE_STEP = 0.35;

// ── What a province can make ────────────────────────────────────────────────────

type Ore = {
  /** What the explainer cites: the deposit, or the land whose surface holds the ore. */
  readonly ref: Ref;
  readonly cell: number;
  readonly richness: number;
  /** Ore hauled in from a neighbouring land yields less than ore at home. */
  readonly reach: number;
};

/** The ore of a kind a province can work: its own first, then a neighbour's within a few days' walk. */
function oreFor(ctx: PopulationContext, cell: number, kind: string): Ore | null {
  const g = ctx.generated,
    at = (c: number, reach: number): Ore | null => {
      const d = g.deposits.find((x) => x.cell === c && x.kind === kind);
      if (d) return { ref: d.ref as Ref, cell: c, richness: d.richness, reach };
      if (kind === "copper" && surfaceCopper(g, c))
        return { ref: cellRef(0, c), cell: c, richness: 0, reach };
      return null;
    };
  const own = at(cell, 1);
  if (own) return own;
  const around = [
    ...g.grid.neighbours.subarray(g.grid.offsets[cell]!, g.grid.offsets[cell + 1]!),
  ].sort((a, b) => a - b);
  for (const c of around) {
    const o = at(c, 0.6);
    if (o) return o;
  }
  return null;
}

function canMake(ctx: PopulationContext, p: Province, m: Market, r: Recipe): boolean {
  if (r.needs?.knowledge === "metalworking" && !m.metalworking) return false;
  if (r.needs?.deposit && !oreFor(ctx, p.cell, r.needs.deposit)) return false;
  if (r.clay && !ctx.generated.water.river[p.cell] && !ctx.generated.water.lake[p.cell])
    return false;
  return true;
}

/** What a crafter's year at a recipe is worth, at the market's prices. */
function worth(m: Market, r: Recipe): number {
  let v = m.price[r.output[0]]! * r.output[1];
  for (const [g, n] of r.inputs) v -= m.price[g]! * n;
  return v;
}

/** How many crafters a recipe's inputs can keep at work. */
function inputLimit(m: Market, r: Recipe): number {
  let n = Infinity;
  for (const [g, per] of r.inputs) n = Math.min(n, Math.floor(m.stock[g]! / per));
  return n;
}

// ── The year ─────────────────────────────────────────────────────────────────────

/** Herds, crafts and wear: what each province makes and uses up in the year. */
function makeAndUse(
  ctx: PopulationContext,
  p: Province,
  m: Market,
  t: SimTime,
  want: number[],
): void {
  const { world } = ctx,
    key = refHash(p.ref),
    pop = p.total();
  // Flocks give wool and hides with their meat; foragers bring hides.
  const meat = m.line("made", G.meat);
  m.move(
    "made",
    G.wool,
    roundKeyed(meat * HERD_GOODS.woolPerMeat, world.rng.real(HERDS, key, t, 0)),
  );
  m.move(
    "made",
    G.hides,
    roundKeyed(
      meat * HERD_GOODS.hidesPerMeat + p.occupation(OCC.forager) * FORAGER_HIDES,
      world.rng.real(HERDS, key, t, 1),
    ),
  );

  // What is kept of goods that are not food spoils a little over the year (food spoils monthly).
  for (let g = 0; g < GOOD_COUNT; g++)
    if (!GOODS[g]!.food && GOODS[g]!.spoil > 0)
      m.move(
        "spoiled",
        g,
        Math.min(
          m.stock[g]!,
          roundKeyed(m.stock[g]! * GOODS[g]!.spoil * 12, world.rng.real(HERDS, key, t, 2, g)),
        ),
      );

  // What wears out in a year: tools by those who work with them, clothing and pots by everyone.
  const users = TOOL_USERS.reduce((s, o) => s + p.occupation(o), 0);
  const wants: [number, number, "toolCover" | "clothingCover" | "potteryCover"][] = [
    [
      G.tools,
      roundKeyed(users * WANTS.toolsPerWorker, world.rng.real(WEAR, key, t, G.tools)),
      "toolCover",
    ],
    [
      G.clothing,
      roundKeyed(pop * WANTS.clothingPerPerson, world.rng.real(WEAR, key, t, G.clothing)),
      "clothingCover",
    ],
    [
      G.pottery,
      roundKeyed(pop * WANTS.potteryPerPerson, world.rng.real(WEAR, key, t, G.pottery)),
      "potteryCover",
    ],
  ];
  const needOf = (g: number) => wants.find((w) => w[0] === g)?.[1] ?? 0;

  // Households make part of what they need themselves, if they have what it takes.
  for (const hm of HOME_MADE) {
    const r = RECIPES.find((x) => x.id === hm.recipe)!;
    if (!canMake(ctx, p, m, r)) continue;
    const [out, per] = r.output,
      short = needOf(out) * hm.share - m.stock[out]!;
    if (short <= 0) continue;
    let years = short / per;
    for (const [g, n] of r.inputs) years = Math.min(years, m.stock[g]! / n);
    for (const [g, n] of r.inputs) m.take("used", g, Math.floor(years * n));
    m.move("made", out, Math.floor(years * per));
  }

  // What the land knows makes its crafters more skilled at what they make.
  const lore = loreOf(world),
    skill = (g: number) =>
      1 +
      (g === G.tools
        ? lore.effect(p.cell, "tools")
        : g === G.clothing
          ? lore.effect(p.cell, "clothing")
          : g === G.pottery
            ? lore.effect(p.cell, "pottery")
            : 0);

  // Crafters go where their work is worth most; what lacks inputs sends them to what needs none.
  const crafters = p.occupation(OCC.crafter),
    open = RECIPES.map((r, i) => ({ r, i })).filter(({ r }) => canMake(ctx, p, m, r));
  if (crafters > 0 && open.length) {
    const weights = open.map(({ r }) => {
      const w = Math.max(0, worth(m, r));
      return w * w;
    });
    const any = weights.some((w) => w > 0);
    const alloc = apportion(
      crafters,
      any ? weights : open.map(({ r }) => (r.inputs.length ? 0 : 1)),
      open.map(({ i }) => world.rng.u32(CRAFT, key, t, 0, i)),
    );
    let spare = 0;
    open.forEach(({ r }, k) => {
      for (const [g, per] of r.inputs) want[g] = want[g]! + alloc[k]! * per;
      const limit = inputLimit(m, r);
      if (alloc[k]! > limit) {
        spare += alloc[k]! - limit;
        alloc[k] = limit;
      }
    });
    if (spare) {
      const free = open.map(({ r }, k) => (r.inputs.length ? 0 : Math.max(0, weights[k]!) + 1e-9));
      if (free.some((w) => w > 0))
        apportion(
          spare,
          free,
          open.map(({ i }) => world.rng.u32(CRAFT, key, t, 1, i)),
        ).forEach((n, k) => (alloc[k] = alloc[k]! + n));
    }
    open.forEach(({ r, i }, k) => {
      const n = alloc[k]!;
      if (!n) return;
      for (const [g, per] of r.inputs) m.take("used", g, Math.round(n * per));
      const reach = r.needs?.deposit ? oreFor(ctx, p.cell, r.needs.deposit)!.reach : 1;
      m.move(
        "made",
        r.output[0],
        roundKeyed(
          n * r.output[1] * reach * skill(r.output[0]),
          world.rng.real(CRAFT, key, t, 2, i),
        ),
      );
    });
  }

  for (const [g, need, cover] of wants) {
    const had = m.take("used", g, need);
    want[g] = want[g]! + need;
    m[cover] = need > 0 ? Math.round((1000 * had) / need) : 1000;
  }
  // Food wanted over the year: a month's for everyone, twelve times.
  for (const g of FOODS) want[g] = want[g]! + (pop * 12) / FOODS.length;
}

type Edge = { a: number; b: number; cost: number };

/** The roads between peopled neighbours, in canonical order, with what a unit of grain costs to carry. */
function edges(ctx: PopulationContext): Edge[] {
  const lore = loreOf(ctx.world),
    g = ctx.generated,
    radiusKm = 6371 * g.planet.radius,
    out: Edge[] = [];
  for (const p of ctx.provinces.all()) {
    if (!p.total()) continue;
    const a = p.cell;
    for (let k = g.grid.offsets[a]!; k < g.grid.offsets[a + 1]!; k++) {
      const b = g.grid.neighbours[k]!;
      if (b <= a || !ctx.provinces.get(b)?.total()) continue;
      const pa = g.grid.positions,
        dx = pa[3 * a]! - pa[3 * b]!,
        dy = pa[3 * a + 1]! - pa[3 * b + 1]!,
        dz = pa[3 * a + 2]! - pa[3 * b + 2]!,
        km = dmath.sqrt(dx * dx + dy * dy + dz * dz) * radiusKm,
        climb = Math.abs(g.tectonics.elevation[a]! - g.tectonics.elevation[b]!),
        river = g.water.river[a] && g.water.river[b] ? 0.6 : 1;
      // Beasts, wheels, carts, roads and bridges make carrying cheaper (the better-equipped end sets it).
      const eased = 1 - Math.min(0.7, Math.max(lore.effect(a, "haul"), lore.effect(b, "haul")));
      out.push({ a, b, cost: HAUL_PER_100KM * (km / 100) * (1 + climb / 800) * river * eased });
    }
  }
  return out.sort((x, y) => x.a - y.a || x.b - y.b);
}

type Plan = { from: number; to: number; good: number; count: number; margin: number };

/** Trade: planned from the year's opening prices and what is left over, then made. */
function trade(
  ctx: PopulationContext,
  markets: MarketStore,
  t: SimTime,
  wanted: Map<number, number[]>,
): TradeFlow[] {
  const plans: Plan[] = [];
  for (const e of edges(ctx)) {
    const ma = markets.of(e.a),
      mb = markets.of(e.b);
    for (let g = 0; g < GOOD_COUNT; g++) {
      const [s, d] = ma.price[g]! <= mb.price[g]! ? [ma, mb] : [mb, ma],
        margin = d.price[g]! - s.price[g]! - e.cost * GOODS[g]!.bulk;
      if (margin <= 0) continue;
      const people = ctx.provinces.get(s.cell)!.total(),
        keep = GOODS[g]!.food ? people * FOOD_RESERVE_MONTHS : (wanted.get(s.cell)?.[g] ?? 0),
        spare = s.stock[g]! - keep;
      if (spare <= 0) continue;
      const count = Math.floor(spare * 0.25 * Math.min(1, (2 * margin) / d.price[g]!));
      if (count > 0) plans.push({ from: s.cell, to: d.cell, good: g, count, margin });
    }
  }
  // Each province's carriers can move only so much.
  const load = new Map<number, number>();
  for (const pl of plans)
    load.set(pl.from, (load.get(pl.from) ?? 0) + pl.count * GOODS[pl.good]!.bulk);
  for (const pl of plans) {
    const p = ctx.provinces.get(pl.from)!,
      capacity =
        (TRADER_CAPACITY * p.occupation(OCC.trader) + PORTERAGE_PER_PERSON * p.total()) *
        (1 + loreOf(ctx.world).effect(pl.from, "carrying")),
      carried = load.get(pl.from)!;
    if (carried > capacity) pl.count = Math.floor((pl.count * capacity) / carried);
  }
  const flows: TradeFlow[] = [];
  for (const pl of plans) {
    if (!pl.count) continue;
    const from = markets.of(pl.from),
      n = from.take("out", pl.good, pl.count);
    if (!n) continue;
    markets.of(pl.to).move("in", pl.good, n);
    from.tradeMargin += n * pl.margin;
    flows.push({ from: pl.from, to: pl.to, good: pl.good, count: n });
    if (!markets.route(pl.from, pl.to)) openRoute(ctx, markets, pl, n, t);
  }
  return flows;
}

/** The first goods down a road: a decision, with the gap that drew them, and its event. */
function openRoute(
  ctx: PopulationContext,
  markets: MarketStore,
  pl: Plan,
  n: number,
  t: SimTime,
): void {
  const { world } = ctx,
    from = markets.of(pl.from),
    to = markets.of(pl.to),
    dest = ctx.provinces.get(pl.to)!,
    recent = (ref: Ref | null) => {
      const e = ref ? world.events.get(ref) : undefined;
      return e && t - e.t <= YEAR ? e.id : null;
    },
    want = recent(dest.lastFamine) ?? recent(dest.lastDrought);
  const factors: Factor[] = [
    {
      name: `${GOODS[pl.good]!.name} dearer there`,
      value: to.price[pl.good]! - from.price[pl.good]!,
      contribution: pl.margin,
      // A famine or dry year there, or else the land that could not give it.
      source: want
        ? { ref: want, role: "pressure", weight: 1 }
        : { ref: to.ref, role: "constraint", weight: 1 },
    },
    {
      name: "carriers",
      value: ctx.provinces.get(pl.from)!.occupation(OCC.trader),
      contribution: 0.1,
      source: null,
    },
  ];
  const decision = world.decisions.record({
    rule: "trade.open",
    subject: from.ref,
    outcome: { to: to.ref, good: GOODS[pl.good]!.id },
    score: pl.margin,
    threshold: 0,
    factors,
  });
  const event = world.events.emit({
    type: ECONOMY_EVENTS.route.type,
    subjects: [from.ref, to.ref],
    place: from.ref,
    causes: [{ ref: decision, role: "trigger", weight: 1 }],
    data: { good: GOODS[pl.good]!.id, count: n },
  });
  markets.openRoute(pl.from, pl.to, event);
}

/** Where food came in while a famine was on, trade answered it: once per famine. */
function relief(
  ctx: PopulationContext,
  markets: MarketStore,
  flows: TradeFlow[],
  t: SimTime,
): void {
  const { world } = ctx;
  for (const p of ctx.provinces.all()) {
    const m = markets.get(p.cell);
    const famine = p.lastFamine ? world.events.get(p.lastFamine) : undefined;
    if (!m || !famine || t - famine.t > YEAR || m.reliefFor === famine.id) continue;
    const incoming = flows.filter((f) => f.to === p.cell && GOODS[f.good]!.food),
      food = incoming.reduce((s, f) => s + f.count, 0);
    if (food < Math.max(20, p.total())) continue;
    // The neighbours who sent the most (three at most name the event).
    const sent = new Map<number, number>();
    for (const f of incoming) sent.set(f.from, (sent.get(f.from) ?? 0) + f.count);
    const sources = [...sent.entries()]
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .slice(0, 3)
      .map(([cell]) => cell);
    const causes: CauseRef[] = [{ ref: famine.id, role: "pressure", weight: 0.6 }];
    for (const s of sources) {
      const road = markets.route(s, p.cell);
      if (road) causes.push({ ref: road, role: "enabler", weight: 0.4 / sources.length });
    }
    world.events.emit({
      type: ECONOMY_EVENTS.relief.type,
      subjects: [p.ref, ...sources.map((s) => cellRef(0, s))],
      place: p.ref,
      causes,
      data: { food, from: sent.size },
    });
    m.reliefFor = famine.id;
  }
}

/** Prices move toward what this year's shortage or glut would make them. */
function reprice(p: Province, m: Market, want: readonly number[]): void {
  const pop = p.total();
  // Foods stand in for one another: one scarcity for all three.
  let eaten = 0,
    kept = 0;
  for (const g of FOODS) {
    eaten += m.line("used", g);
    kept += m.stock[g]!;
  }
  const foodScarcity = (pop * 12 * 1.5) / (eaten + kept + 1);
  for (let g = 0; g < GOOD_COUNT; g++) {
    const good = GOODS[g]!,
      scarcity = good.food
        ? foodScarcity
        : (want[g]! * 1.5) / (m.line("used", g) + m.stock[g]! + 1),
      target = good.value * dmath.pow(dmath.clamp(scarcity, 0.25, 4), 0.8);
    m.price[g] = m.price[g]! + PRICE_STEP * (target - m.price[g]!);
  }
}

/** What a year of each kind of work was worth at the margin, in grain. */
function wages(ctx: PopulationContext, p: Province, m: Market): void {
  const c = provinceCapacity(ctx, p.cell),
    rain = p.rain / 1000,
    tools = 1 + (TOOL_GAIN * m.toolCover) / 1000,
    margin = (capacity: number, workers: number, productivity: number) =>
      capacity > 0 ? 12 * productivity * dmath.exp((-workers * productivity) / capacity) : 0;
  const w = m.wage;
  w[OCC.forager] =
    margin(c.forage, p.occupation(OCC.forager), PRODUCTIVITY[OCC.forager]!) *
      rain *
      m.price[G.wild]! +
    FORAGER_HIDES * m.price[G.hides]!;
  w[OCC.farmer] = p.knowsCultivation
    ? margin(c.farm, p.occupation(OCC.farmer), PRODUCTIVITY[OCC.farmer]! * tools) *
      rain *
      m.price[G.grain]!
    : 0;
  w[OCC.herder] =
    margin(c.pasture, p.occupation(OCC.herder), PRODUCTIVITY[OCC.herder]! * tools) *
    (0.5 + 0.5 * rain) *
    (m.price[G.meat]! +
      HERD_GOODS.woolPerMeat * m.price[G.wool]! +
      HERD_GOODS.hidesPerMeat * m.price[G.hides]!);
  let best = 0;
  for (const r of RECIPES)
    if (canMake(ctx, p, m, r) && (r.inputs.length === 0 || inputLimit(m, r) > 0))
      best = Math.max(best, worth(m, r));
  w[OCC.crafter] = best;
  w[OCC.trader] =
    0.6 * Math.max(w[OCC.farmer]!, w[OCC.forager]!) +
    m.tradeMargin / Math.max(1, p.occupation(OCC.trader));
}

/** The economy's year. */
export function economyYear(ctx: PopulationContext, t: SimTime): void {
  const markets = marketsOf(ctx.world),
    wanted = new Map<number, number[]>(),
    provinces = ctx.provinces.all();
  for (const p of provinces) {
    const m = markets.of(p.cell),
      want = new Array<number>(GOOD_COUNT).fill(0);
    m.tradeMargin = 0;
    makeAndUse(ctx, p, m, t, want);
    wanted.set(p.cell, want);
  }
  const flows = trade(ctx, markets, t, wanted);
  markets.flows = flows;
  relief(ctx, markets, flows, t);
  for (const p of provinces) {
    const m = markets.of(p.cell);
    reprice(p, m, wanted.get(p.cell)!);
    wages(ctx, p, m);
  }
}

/** Metalworking, yearly: found by crafters who work a copper seam; learned along roads. */
export function metalYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    markets = marketsOf(world),
    learned: { p: Province; from: Market | null; chance: number }[] = [];
  for (const p of ctx.provinces.all()) {
    const m = markets.get(p.cell);
    if (!m || m.metalworking) continue;
    const key = refHash(p.ref),
      crafters = p.occupation(OCC.crafter);
    const ore = oreFor(ctx, p.cell, "copper");
    if (ore && crafters >= 5) {
      const chance = 0.015 * Math.min(1, crafters / 25) * ore.reach;
      if (world.rng.chance(chance, METAL, key, t, 0)) {
        learned.push({ p, from: null, chance });
        continue;
      }
    }
    // From a neighbour who knows it, along a road that carries goods.
    const g = ctx.generated;
    for (let k = g.grid.offsets[p.cell]!; k < g.grid.offsets[p.cell + 1]!; k++) {
      const n = g.grid.neighbours[k]!,
        other = markets.get(n);
      if (!other?.metalworking || !markets.route(p.cell, n)) continue;
      if (world.rng.chance(0.08, METAL, key, t, SPREADING, n)) {
        learned.push({ p, from: other, chance: 0.08 });
        break;
      }
    }
  }
  for (const { p, from, chance } of learned) {
    const m = markets.of(p.cell);
    if (from) {
      m.metalworking = world.events.emit({
        type: ECONOMY_EVENTS.metalworkingSpread.type,
        subjects: [p.ref, from.ref],
        place: p.ref,
        causes: [
          { ref: from.metalworking!, role: "enabler", weight: 0.6 },
          { ref: markets.route(p.cell, from.cell)!, role: "enabler", weight: 0.4 },
        ],
      });
      continue;
    }
    const ore = oreFor(ctx, p.cell, "copper")!;
    const decision = world.decisions.record({
      rule: "knowledge.metalworking",
      subject: p.ref,
      outcome: true,
      score: chance,
      threshold: 0,
      factors: [
        {
          name: ore.richness ? "a copper seam" : "copper ores at the surface",
          value: ore.reach,
          contribution: ore.reach,
          source: { ref: ore.ref, role: "enabler", weight: 1 },
        },
        { name: "crafters", value: p.occupation(OCC.crafter), contribution: chance, source: null },
      ],
    });
    m.metalworking = world.events.emit({
      type: ECONOMY_EVENTS.metalworking.type,
      place: p.ref,
      causes: [{ ref: decision, role: "trigger", weight: 1 }],
    });
  }
}

/** The markets' books close with the year. */
export function closeYear(ctx: PopulationContext, t: SimTime): void {
  const year = yearOfMoment(t);
  for (const m of marketsOf(ctx.world).all()) m.closeYear(year);
}

/** Register the economy's systems on a world with people. */
export function installEconomy(world: World): void {
  const ctx = () => populationContext(world);
  world.system({ key: "125.economy.year", every: YEAR, run: (t) => economyYear(ctx(), t) });
  world.system({ key: "155.knowledge.metal", every: YEAR, run: (t) => metalYear(ctx(), t) });
  world.system({ key: "890.economy.ledger", every: YEAR, run: (t) => closeYear(ctx(), t) });
}
