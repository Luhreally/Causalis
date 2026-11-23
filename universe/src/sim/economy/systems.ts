// The economy's systems (docs/architecture §20). Once a year, after the year's
// food has been grown and eaten: flocks give wool and hides; crafters make what is
// worth most from what there is to work; people wear out tools, clothing and pots;
// goods go from where they are cheap to where they are dear, as far as carriers
// can take them; prices follow what ran short and what piled up; and what a year
// of each kind of work was worth is set down, for people to follow. The first time
// goods go down a road, and when trade answers a famine, history records why.
// Metalworking is found where crafters work a copper seam, and spreads along roads.
// Ore is reckoned by one rule (./ore.ts): a land's own, else a neighbour's; tin and
// iron are smelted where their crafts are known, and tools are headed with the metal
// a land's market holds (Phase 52 M216).
import { kinAcross } from "../culture/abroad-kept.ts";
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
import {
  WORKS_WATTS,
  cellRef,
  landCarries,
  seamRef,
  surfaceOre,
  worldChemistry,
} from "../../gen/index.ts";
import { loreOf } from "../lore/lore.ts";
import { fearShuts, financeOf } from "../finance/finance.ts";
import { blockadeOn } from "../war/navy.ts";
import { ORG_ROW, orgLandsStore } from "../order/groups-kept.ts";
import {
  FINANCE,
  ENGINE_GAIN,
  FOODS,
  FORAGER_HIDES,
  FUELS,
  G,
  GOODS,
  HERD_GOODS,
  HOME_MADE,
  GLUT_YEARS,
  MACHINE_GAIN,
  OCC,
  POWER,
  PORTERAGE_PER_PERSON,
  PRODUCTIVITY,
  RECIPES,
  TOOL_GAIN,
  TOOL_RECIPE_METAL,
  TOOL_USERS,
  TRADER_CAPACITY,
  WANTS,
  ELASTICITY,
  GOOD_USE,
  PRICE_BASES,
  SHOP,
  INST,
  roofGain,
  lerner,
  naturalPrices,
  kindsIn,
  priceTarget,
  WORKED,
  SIGNAL,
  connectivityOf,
  infoShare,
  principleNameOn,
  roleWord,
  dealsMoved,
  wayById,
  type LifeHistory,
  type Recipe,
  type ToolMetal,
} from "../../rules/index.ts";
import type { Province } from "../population/model.ts";
import {
  marketsOf,
  mouths,
  populationContext,
  provinceCapacity,
  roundKeyed,
  type PopulationContext,
} from "../population/systems.ts";
import { GOOD_COUNT, type Market, type MarketStore, type TradeFlow } from "./market.ts";
import { metalRank, metalSource, sourceRef } from "./metals.ts";
import { heatShortfall, oreWorkable } from "./heat.ts";
import { lodesOf } from "./lodes.ts";
import { oreLaid } from "./ore.ts";
import { digOre } from "./worked.ts";
import { energyYear, machinesWanted } from "./energy.ts";
import { kmBetween, seaRange, seaReach } from "./sea.ts";
import { compassReach, materialsOf } from "../lore/materials.ts";
import { politiesOf } from "../polity/polity.ts";
import { cartelsNow, craftsKept, machinesAtWork } from "../trade/kept.ts";
import { fieldedOf, warsOf, type War } from "../war/war.ts";
import { rearmYear } from "../war/arms.ts";
import {
  GOODS_STORE,
  dutyOf,
  exchangeCostOf,
  guildOf,
  insuredGainOf,
  intoxLost,
  moneyStore,
  refNumber,
  sanctionBetween,
  unionOf,
} from "../money/kept.ts";
import { boughtOf, foodWanted } from "../trade/demand.ts";
import { craftHeldIn, strikeIn, wageWonIn, worksIn } from "../order/institutions-kept.ts";
import { dealsOf, dressWantedOf } from "../society/kept.ts";
import { daysWorkedOf } from "../society/kept.ts";

const SPREADING = purpose("spread");
const HERDS = defineStream("econ.herds");
const CRAFT = defineStream("econ.craft");
const WEAR = defineStream("econ.wear");
const METAL = defineStream("econ.metal");

export const ECONOMY_EVENTS = {
  route: defineEventType("trade.route-opened", 3),
  seaRoute: defineEventType("trade.sea-route", 4),
  mine: defineEventType("industry.mine", 4),
  well: defineEventType("industry.well", 4),
  works: defineEventType("industry.works", 5),
  relief: defineEventType("trade.relief", 4),
  embargo: defineEventType("trade.embargo", 4),
  metalworking: defineEventType("knowledge.metalworking", 6),
  metalworkingSpread: defineEventType("knowledge.metalworking-spread", 3),
  /** A land's crafters first head most of its tools with a better metal than ever before. */
  tools: defineEventType("industry.tools", 3),
};

/** What carrying a unit of grain a hundred kilometres over flat ground costs, in grain. */
export const HAUL_PER_100KM = 0.08;
/** By ship: a quarter of that a hundred kilometres, and loading and landing as sixty over land. */
const SAIL_PER_100KM = 0.02,
  LANDING = 0.05;
/** The coasts across the sea each land's ships trade with at most, nearest first. */
const SEA_PARTNERS = 4;
/** A province keeps this many months of its people's food before it sells any. */
const FOOD_RESERVE_MONTHS = 3;
/** How many kinds of each class a mask of ways of making holds (rules/variety.ts). */
function kindsOfEach(mask: number): number[] {
  const out = new Array<number>(GOOD_COUNT);
  for (let g = 0; g < GOOD_COUNT; g++) out[g] = Math.max(1, kindsIn(mask, g));
  return out;
}

/** How far toward where supply and demand would put it a price moves in a year. */
const PRICE_STEP = 0.35;

// ── What a province can make ────────────────────────────────────────────────────

function canMake(ctx: PopulationContext, p: Province, m: Market, r: Recipe): boolean {
  return whyNot(ctx, p.cell, m, r) === null;
}

/**
 * Why a land cannot work a recipe (null: it can) — the same test its crafters' choice is made
 * by, in words, for the pages (Phase 15 M122): not known, no ore within reach, no seam, no clay.
 */
export function whyNot(ctx: PopulationContext, cell: number, m: Market, r: Recipe): string | null {
  const know = r.needs?.knowledge;
  if (know === "metalworking" && !m.metalworking) return "they do not know how to smelt copper";
  if (r.needs?.fuelless && ctx.affords.fire) return "its works burn fuel";
  // (A recipe of a made stuff asks the land to make it: sim/lore/materials.ts.)
  if (r.needs?.way && !materialsOf(ctx.world)?.made(cell, r.needs.way))
    return `they do not make ${wayById(r.needs.way)?.name ?? r.needs.way}`;
  if (
    r.needs?.carried &&
    landCarries(ctx.generated, cell, !!loreOf(ctx.world).get(cell, "electronics")) <
      WORKS_WATTS * Math.max(1, ctx.provinces.get(cell)?.total() ?? 0)
  )
    return "no river's fall, wind or hot ground under it carries the current its works would ask";
  if (know && know !== "metalworking" && !loreOf(ctx.world).get(cell, know))
    return `they do not know ${principleNameOn(worldChemistry(ctx.generated), know)}`;
  if (r.needs?.ore && !oreWorkable(ctx, cell, r.needs.ore)) {
    // A furnace too cool for the ore within reach says so, in its own words (Phase 54 M222).
    const short = heatShortfall(ctx, cell, r.needs.ore);
    if (short)
      return `their ${short.furnace.name.replace(/^an? /, "")} reaches ${short.reached} °C, short of the ${short.wanted} °C ${short.ore.name} wants${
        // (Thin air's want, which a blast driven by a mill's wheel makes up.)
        short.reached < short.furnace.heat && short.wanted <= short.furnace.heat
          ? ": a blast driven by a mill's wheel would reach it"
          : ""
      }`;
    // (All it could reach is dug: E1.)
    if (lodesOf(ctx.world)?.movedKind(r.needs.ore) && oreLaid(ctx, cell, r.needs.ore))
      return `the ${roleWord(worldChemistry(ctx.generated), r.needs.ore)} within reach is worked out`;
    return `no ${roleWord(worldChemistry(ctx.generated), r.needs.ore)} within a few days' walk`;
  }
  if (r.needs?.seam && !surfaceOre(ctx.generated, cell, r.needs.seam))
    return `no ${r.needs.seam} under its own ground`;
  if (r.needs?.seam && lodesOf(ctx.world)?.isOut(cell, r.needs.seam))
    return `its ${r.needs.seam} is worked out`;
  if (r.clay && !ctx.generated.water.river[cell] && !ctx.generated.water.lake[cell])
    return "no clay: no river or lake to dig it from";
  return null;
}

export type { ToolMetal } from "../../rules/index.ts";

/**
 * What a land's tools were headed with (now, or in a past year): the metal most of its crafted
 * tools were made of that year, as its market set it down — stone where its crafters never made
 * tools of a metal. (The host's pages, the town's smithy and the chain read it: the sim's own.)
 */
export function toolMetal(ctx: PopulationContext, cell: number, year?: number): ToolMetal {
  return ctx.world.store<MarketStore>("economy.markets").get(cell)?.toolMetalIn(year) ?? "stone";
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
  const lore = loreOf(world),
    // Works with engines: how much of the crafts they do, and the machines their workers use.
    industry = Math.min(1.5, lore.effect(p.cell, "industry")),
    // Machines are wanted as far as engines drove its works last year (its energy account), or minds of crystal work.
    machines = lore.get(p.cell, "machine-minds") ? 1 : machinesWanted(world, p.cell, users);
  const wants: [number, number, "toolCover" | "clothingCover" | "potteryCover" | "machineCover"][] =
    [
      [
        G.tools,
        roundKeyed(users * WANTS.toolsPerWorker, world.rng.real(WEAR, key, t, G.tools)),
        "toolCover",
      ],
      [
        G.clothing,
        // (As much as its cold asks of its people's coat, and its show: the society sweep, society/everyday.ts. Exactly as before
        // where none is kept.)
        roundKeyed(
          pop * WANTS.clothingPerPerson * dressWantedOf(world, p.cell),
          world.rng.real(WEAR, key, t, G.clothing),
        ),
        "clothingCover",
      ],
      [
        G.pottery,
        roundKeyed(pop * WANTS.potteryPerPerson, world.rng.real(WEAR, key, t, G.pottery)),
        "potteryCover",
      ],
      [
        G.machines,
        machines > 0
          ? roundKeyed(
              users * WANTS.machinesPerWorker * machines,
              world.rng.real(WEAR, key, t, G.machines),
            )
          : 0,
        "machineCover",
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

  // What the land knows makes its crafters more skilled at what they make; engines fed
  // with fuel and machines to work with make them more so.
  // (While its works stand idle from a rocket's fall, W3, nothing they drive helps, and no machine is made.)
  const idle = m.idleUntil > yearOfMoment(t),
    // (Less the work those who need what they take lose, or more where what wakes keeps them at it: Round B, sim/money/intox.ts.)
    // (And less what stands idle for want of buyers, what a plan errs and loses, what cutting smoke costs; more where machines do
    // its crafts' tasks: sim/trade, p87.)
    powered =
      (1 - intoxLost(world, p.cell)) *
      craftsKept(world, p.cell) *
      // (As many days as its crafters work against the reference year: the society sweep, rules/leisure.ts. 1 where none is kept.)
      daysWorkedOf(world, p.cell) *
      // (And what the part of its crafters under a works' roof gains by it: sim/order/institutions.ts. 1 where none is kept.)
      roofGain(worksIn(world, p.cell).share, !!lore.get(p.cell, "factories")) *
      (idle
        ? 1
        : (1 + (ENGINE_GAIN * industry * m.powerCover) / 1000) *
          (1 + (MACHINE_GAIN * m.machineCover) / 1000) *
          machinesAtWork(world, p.cell)),
    skill = (g: number) =>
      powered *
      (1 +
        (g === G.tools
          ? lore.effect(p.cell, "tools")
          : g === G.clothing
            ? lore.effect(p.cell, "clothing")
            : g === G.pottery
              ? lore.effect(p.cell, "pottery")
              : 0));

  // Crafters go where their work is worth most; what lacks inputs sends them to what needs none.
  // Nothing is made but while there is use for it: up to GLUT_YEARS of what the land burned, wore out, worked, passed on within the
  // year and sent away of its own making (Market.goes; or of what its people need of it in the year, where that is more), less
  // what it holds. (Fuel and machines by last year's; the
  // rest by the most of the last GLUT_YEARS: tin and iron are worked only the year after they are smelted, Phase 52 M216, and
  // a year that smelted them and a year that worked them would take turns. It was fuel, machines, tin and iron alone: every
  // crafter with nothing else to work made what needs no inputs, wanted or not, and by first light's year 600 the world held
  // 590 years' use of tools, 48 of pots and 54 of copper, made fourteen tools for each one used, and sent thirty-one over a
  // border for each one used, to wherever a price stood a little higher: scratchpad/release/tg.mts.)
  const gone = (g: number) => (FUELS.includes(g) || g === G.machines ? m.went(g) : m.goes(g)),
    room = (g: number) =>
      idle && g === G.machines
        ? 0
        : GLUT_YEARS * (Math.max(gone(g), g === G.machines ? 0 : needOf(g)) + 1) - m.stock[g]!;
  // (Less those out on strike this year, where its workers' body struck: sim/order/institutions.ts. None where none is kept.)
  const hands = p.occupation(OCC.crafter),
    struck = strikeIn(world, p.cell, yearOfMoment(t)),
    crafters = struck > 0 ? Math.round(hands * (1 - struck)) : hands,
    open = RECIPES.map((r, i) => ({ r, i })).filter(
      ({ r }) => canMake(ctx, p, m, r) && room(r.output[0]) > 0,
    ),
    // The tools its crafters made this year, by the metal they were headed with.
    made = new Map<ToolMetal, number>();
  // (The ways of making its crafters worked this year: the kinds of each class it made, rules/variety.ts.)
  let worked = 0;
  if (crafters > 0 && open.length) {
    const weights = open.map(({ r }) => {
      const w = Math.max(0, worth(m, r));
      return w * w;
    });
    const any = weights.some((w) => w > 0),
      // (Where nothing is worth working, to what needs no inputs; where no such thing has room for more, no one makes anything.)
      free = open.some(({ r }) => !r.inputs.length);
    const alloc =
      any || free
        ? apportion(crafters, any ? weights : open.map(({ r }) => (r.inputs.length ? 0 : 1)), (k) =>
            world.rng.u32(CRAFT, key, t, 0, open[k]!.i),
          )
        : open.map(() => 0);
    // (A good several crafts are worked from — copper, iron, tools — is shared among them by what
    // each was set to use of it: what one takes, another cannot. Phase 52 M217.)
    const asked = new Map<number, number>(),
      users = new Map<number, number>();
    open.forEach(({ r }, k) => {
      for (const [g, per] of r.inputs) {
        asked.set(g, (asked.get(g) ?? 0) + alloc[k]! * per);
        users.set(g, (users.get(g) ?? 0) + (alloc[k]! > 0 ? 1 : 0));
      }
    });
    const shared = (r: Recipe, n: number) => {
      let most = Infinity;
      for (const [g, per] of r.inputs) {
        const stock = m.stock[g]!,
          mine =
            (users.get(g) ?? 0) > 1
              ? Math.floor((stock * n * per) / Math.max(1e-9, asked.get(g)!))
              : stock;
        most = Math.min(most, Math.floor(Math.min(stock, mine) / per));
      }
      return most;
    };
    let spare = 0;
    // (What there is still room to make of each good, as its crafts take it up: several crafts make tools.)
    const left: number[] = [],
      leftOf = (g: number) => (left[g] ??= Math.max(0, room(g))),
      eachOf = (r: Recipe) =>
        r.output[1] *
        (r.needs?.ore ? oreWorkable(ctx, p.cell, r.needs.ore)!.grade : 1) *
        skill(r.output[0]);
    open.forEach(({ r }, k) => {
      const each = eachOf(r),
        out = r.output[0],
        // (As many as there is use for the work of: what is wanted of a craft's inputs is what those would take. Wanted for
        // every hand set to the craft, a land whose tools had no room for more went on asking for copper and tin for all its
        // bronze-smiths, traders brought it, and what was sold on to such lands was made for: by first light's year 1,000 the
        // world made sixty of tin for each one used and held seven hundred years' use of it, seventy of copper:
        // scratchpad/release/st2.mts.)
        useFor = Math.ceil(leftOf(out) / Math.max(1e-9, each)),
        limit = Math.min(shared(r, alloc[k]!), useFor);
      for (const [g, per] of r.inputs) want[g] = want[g]! + Math.min(alloc[k]!, useFor) * per;
      if (alloc[k]! > limit) {
        spare += alloc[k]! - limit;
        alloc[k] = limit;
      }
      left[out] = Math.max(0, leftOf(out) - alloc[k]! * each);
    });
    if (spare) {
      // To what needs no inputs, and has room for more: as many as that room takes. The rest make nothing this year.
      const takers = open.map(({ r }, k) =>
        r.inputs.length || !(leftOf(r.output[0]) > 0) ? 0 : Math.max(0, weights[k]!) + 1e-9,
      );
      if (takers.some((w) => w > 0))
        apportion(spare, takers, (k) => world.rng.u32(CRAFT, key, t, 1, open[k]!.i)).forEach(
          (n, k) => {
            if (!n) return;
            const r = open[k]!.r,
              each = eachOf(r),
              more = Math.min(n, Math.ceil(leftOf(r.output[0]) / Math.max(1e-9, each)));
            alloc[k] = alloc[k]! + more;
            left[r.output[0]] = Math.max(0, leftOf(r.output[0]) - more * each);
          },
        );
    }
    open.forEach(({ r, i }, k) => {
      const n = alloc[k]!;
      if (!n) return;
      for (const [g, per] of r.inputs) m.take("used", g, Math.round(n * per));
      // Lean ore, or ore hauled from a neighbour's land, yields less (Phase 52 M216).
      const grade = r.needs?.ore ? oreWorkable(ctx, p.cell, r.needs.ore)!.grade : 1,
        out = m.move(
          "made",
          r.output[0],
          roundKeyed(
            n * r.output[1] * grade * skill(r.output[0]),
            world.rng.real(CRAFT, key, t, 2, i),
          ),
        ),
        metal = TOOL_RECIPE_METAL[r.id];
      if (out > 0) worked |= 1 << i;
      if (metal && out > 0) made.set(metal, (made.get(metal) ?? 0) + out);
      // (What it took of the lode it came from: E1.)
      if (r.needs?.ore) digOre(ctx, p.cell, r.needs.ore, out, n);
      else if (r.needs?.seam) digOre(ctx, p.cell, r.needs.seam, out, n, true);
    });
    // (The share of its crafters' year there was use for the work of: what they earned follows it, wages.)
    m.craftsWorked =
      hands > 0
        ? Math.round(
            (1000 *
              Math.min(
                crafters,
                alloc.reduce((a, n) => a + n, 0),
              )) /
              hands,
          )
        : 1000;
  } else m.craftsWorked = hands > 0 ? 0 : 1000;
  m.kinds = worked;
  toolsOfYear(ctx, p, m, made, t);

  // What its households buy of what they need, by what they earn and what it costs, within their means (sim/trade/demand.ts, p87):
  // what they have of it is reckoned against what they need, never against what they could buy.
  const bought = boughtOf(
    ctx,
    p,
    m,
    wants.map(([g, need]) => [g, need] as const),
  );
  for (const [g, need, cover] of wants) {
    const asked = g === G.machines ? need : Math.round(need * bought.factor[g]!),
      had = m.take("used", g, asked);
    want[g] = want[g]! + asked;
    m[cover] =
      need > 0 ? Math.min(1000, Math.round((1000 * had) / need)) : g === G.machines ? 0 : 1000;
  }
  // Its year of energy (economy/energy.ts): hearths, smelters, works, carriers and homes, each fed from what its land
  // holds, the nearest first; what it burned taken from its market and its woods.
  energyYear(
    ctx,
    p,
    m,
    t,
    want,
    m.line("made", G.copper) + m.line("made", G.tin) + m.line("made", G.iron),
  );
  firsts(ctx, p, m);
  // Food wanted over the year: a month's for everyone, twelve times; a little more as the land earns more, never less (p87).
  const fed = foodWanted(ctx, p);
  for (const g of FOODS) want[g] = want[g]! + fed;
}

/** A metal heads a land's tools in a year where it heads at least this share of those its crafters made, */
export const TOOL_SHARE = 0.25;
/** and goes on heading them while it heads at least this share. */
export const TOOL_KEEP = 0.1;

/**
 * What a land's smiths forged in a year (now, if none is given; Phase 52 M217): the best metal its
 * crafters headed any tools with — stone where they headed none. (Older saves: its tools' metal.)
 */
export function forgedMetal(ctx: PopulationContext, cell: number, year?: number): ToolMetal {
  const m = ctx.world.store<MarketStore>("economy.markets").get(cell);
  return m?.forgedIn(year) ?? m?.toolMetalIn(year) ?? "stone";
}

/**
 * What a land's tools were headed with this year (Phase 52 M216): the best metal that headed a
 * fair share (TOOL_SHARE) of the tools its crafters made — what its smiths work — set down when it
 * changes; the first time it is better than ever before, told: the craft that let them, and where
 * the metal came from.
 */
function toolsOfYear(
  ctx: PopulationContext,
  p: Province,
  m: Market,
  made: ReadonlyMap<ToolMetal, number>,
  t: SimTime,
): void {
  let total = 0,
    forged: ToolMetal = "stone";
  for (const [x, n] of made) {
    total += n;
    if (n > 0 && metalRank(x) > metalRank(forged)) forged = x;
  }
  m.setForged(yearOfMoment(t), forged);
  if (!total) return;
  let metal: ToolMetal = "stone",
    most = 0;
  for (const [x, n] of made)
    if (n >= TOOL_SHARE * total && metalRank(x) >= metalRank(metal)) {
      metal = x;
      most = n;
    }
  // (A metal that heads its tools goes on heading them while it heads a tenth of them: a lean
  // year does not put them back to stone.)
  const was = m.toolMetalIn();
  if (was && metalRank(was) > metalRank(metal) && (made.get(was) ?? 0) >= TOOL_KEEP * total) {
    metal = was;
    most = made.get(was)!;
  }
  if (was === metal) return;
  const best = m.toolMetals.reduce((r, x) => Math.max(r, metalRank(x.metal)), 0);
  let event: Ref | null = null;
  if (metal !== "stone" && metalRank(metal) > best) {
    const { world } = ctx,
      worked = WORKED[metal],
      known =
        worked.knowledge === "metalworking"
          ? m.metalworking
          : (loreOf(world).get(p.cell, worked.knowledge)?.event ?? null),
      causes: CauseRef[] = [];
    if (known) causes.push({ ref: known, role: "trigger", weight: 0.6 });
    for (const good of worked.from) {
      const source = metalSource(ctx, p.cell, good);
      if (source)
        causes.push({
          ref: sourceRef(p.cell, good, source),
          role: "enabler",
          weight: 0.4 / worked.from.length,
        });
    }
    event = world.events.emit({
      type: ECONOMY_EVENTS.tools.type,
      place: p.ref,
      causes,
      data: { metal, tools: most },
    });
  }
  m.setToolMetal(yearOfMoment(t), metal, event);
}

/**
 * A land's first coal dug, first oil drawn and first machines made, told once each: the
 * knowledge that let them, and what the deep past laid down there (or the road the coal
 * came down).
 */
function firsts(ctx: PopulationContext, p: Province, m: Market): void {
  const { world, generated: g } = ctx,
    lore = loreOf(world);
  const tell = (
    type: string,
    knowledge: string,
    enabler: Ref | null,
    data: Record<string, unknown>,
  ): Ref => {
    const causes: CauseRef[] = [];
    const k = lore.get(p.cell, knowledge);
    if (k) causes.push({ ref: k.event, role: "trigger", weight: 0.6 });
    if (enabler) causes.push({ ref: enabler, role: "enabler", weight: 0.4 });
    return world.events.emit({ type, place: p.ref, causes, data });
  };
  if (!m.mine && m.line("made", G.coal) > 0)
    m.mine = tell(ECONOMY_EVENTS.mine.type, "coal-mining", seamRef(g, p.cell, "coal") as Ref, {
      coal: m.line("made", G.coal),
    });
  if (!m.well && m.line("made", G.oil) > 0)
    m.well = tell(ECONOMY_EVENTS.well.type, "oil-drilling", seamRef(g, p.cell, "oil") as Ref, {
      oil: m.line("made", G.oil),
    });
  if (!m.works && m.line("made", G.machines) > 0) {
    // The coal its works burned: its own mine's, or what a road brought in.
    const markets = marketsOf(world),
      road = markets.flows.find((f) => f.to === p.cell && f.good === G.coal);
    m.works = tell(
      ECONOMY_EVENTS.works.type,
      lore.get(p.cell, "factories") ? "factories" : "sea-works",
      m.mine ?? (road ? (markets.route(road.from, road.to) ?? null) : null),
      { machines: m.line("made", G.machines) },
    );
  }
}

/** A land's power, in kilowatts a person: its people's own strength, its beasts' and mills', and what its engines burned last year. */
export function powerOf(ctx: PopulationContext, cell: number): number {
  const lore = loreOf(ctx.world),
    m = marketsOf(ctx.world).get(cell),
    people = Math.max(1, ctx.provinces.get(cell)?.total() ?? 0);
  // (A held flame burns no fuel, and a people it keeps grows no poorer: Phase 66.)
  const held = lore.get(cell, "fusion-power")
    ? (ctx.provinces.get(cell)?.occupation(OCC.crafter) ?? 0) *
      Math.min(1.5, lore.effect(cell, "industry")) *
      WANTS.fuelPerCrafter
    : 0;
  return (
    POWER.muscle +
    (lore.get(cell, "draught") ? POWER.beasts : 0) +
    (lore.get(cell, "mills") ? POWER.mills : 0) +
    (Math.max(m?.burned ?? 0, held) * POWER.perFuel) / people
  );
}

type Edge = { a: number; b: number; cost: number; sea: boolean };
/** More than any land's number: two coasts as one number. */
const COAST_SPAN = 2 ** 24;

/** The roads between peopled neighbours (and coasts that ships reach), in canonical order, with what a unit of grain costs to carry. */
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
      out.push({
        a,
        b,
        cost: HAUL_PER_100KM * (km / 100) * (1 + climb / 800) * river * eased,
        sea: false,
      });
    }
  }
  // Across the sea, where either land's ships reach: the nearest few coasts of each.
  // (Each pair of coasts once, the lesser land first, as one number: in the order they are first reached.)
  const across = new Set<number>();
  for (const p of ctx.provinces.all()) {
    if (!p.total() || !lore.effect(p.cell, "ships")) continue;
    // Each land's own ships: the pair is joined if either's reach the other.
    const a = p.cell,
      // (Half again where a lodestone's needle finds north out of sight of land: sim/lore/materials.ts.)
      range = seaRange(lore, a) * compassReach(ctx.world, a);
    let taken = 0;
    for (const [b, steps] of seaReach(g, a)) {
      if (taken >= SEA_PARTNERS || steps > range) break;
      if (!ctx.provinces.get(b)?.total()) continue;
      taken++;
      across.add(a < b ? a * COAST_SPAN + b : b * COAST_SPAN + a);
    }
  }
  for (const key of across) {
    const a = Math.floor(key / COAST_SPAN),
      b = key % COAST_SPAN,
      km = kmBetween(g, a, b);
    out.push({ a, b, cost: SAIL_PER_100KM * (km / 100) + LANDING, sea: true });
  }
  return out.sort((x, y) => x.a - y.a || x.b - y.b);
}

type Plan = {
  from: number;
  to: number;
  good: number;
  count: number;
  margin: number;
  sea: boolean;
  /** What the seller's realm's cartel asks above, a unit (grain's worth; sim/trade, p87): its carriers keep it. */
  asked?: number;
};

/** Trade: planned from the year's opening prices and what is left over, then made. */
function trade(
  ctx: PopulationContext,
  markets: MarketStore,
  t: SimTime,
  wanted: Map<number, number[]>,
): TradeFlow[] {
  const plans: Plan[] = [];
  // Lands of realms at war with each other trade no more: the war lays an embargo.
  const realms = politiesOf(ctx.world),
    open = warsOf(ctx.world)
      .hot()
      .filter((w) => w.ended === null),
    between = (a: number, b: number) => {
      const ra = realms.of(a)?.ref,
        rb = realms.of(b)?.ref;
      if (!ra || !rb || ra === rb) return null;
      return (
        open.find(
          (w) =>
            (w.attacker === ra && w.defender === rb) || (w.attacker === rb && w.defender === ra),
        ) ?? null
      );
    },
    cut = new Map<War, number>();
  const lore = loreOf(ctx.world),
    money = financeOf(ctx.world),
    navied = ctx.world.hasStore("war.navy"),
    // (Goods some realms hold most of the world's making of, sold abroad dearer by their cartel: sim/trade, p87.)
    cartels = cartelsNow(ctx.world),
    // (What brigands and pirates take of the trade that passes a land, by road or by sea: sim/order/groups.ts.)
    preyRows = orgLandsStore(ctx.world),
    preyedAt = (c: number, sea: boolean) =>
      preyRows ? preyRows.at(c, sea ? ORG_ROW.seaPrey : ORG_ROW.prey) / 1000 : 0;
  for (const e of edges(ctx)) {
    const war = open.length ? between(e.a, e.b) : null;
    if (war) {
      cut.set(war, (cut.get(war) ?? 0) + 1);
      continue;
    }
    // (Where one realm fears how the other is held, the less passes between their lands, by the fear: sim/finance. Exactly as it
    // was where neither fears the other.)
    const ra = money ? realms.of(e.a)?.ref : undefined,
      rb = money ? realms.of(e.b)?.ref : undefined,
      shut = ra && rb && ra !== rb ? fearShuts(money!, ra, rb) : 0,
      // (Round B: what either realm shuts by its own word, less what slips past; what the seller's underwriters let its traders
      // risk at sea; and what the buyer lays on goods from abroad. Each nothing where neither realm keeps any.)
      ta = realms.of(e.a)?.ref,
      tb = realms.of(e.b)?.ref,
      apart = !!ta && !!tb && ta !== tb,
      barred = apart ? sanctionBetween(ctx.world, ta!, tb!) : 0,
      // (What changing one realm's money for the other's costs a trader over the journey, as the two moved against each other
      // last year: rules/thrift.ts. Nothing where either reckons in goods.)
      changed = apart ? exchangeCostOf(ctx.world, ta!, tb!) : 0;
    const ma = markets.of(e.a),
      mb = markets.of(e.b),
      // (What both ends' signals put on the line: traders see the far price as it moves, so move more and on a narrower
      // margin. Exactly 1 before either end has the telegraph: rules/signals.ts.)
      linked = connectivityOf(Math.min(lore.effect(e.a, "signal"), lore.effect(e.b, "signal"))),
      // (A blockade cuts what goes by sea from a realm whose foe holds the sea: sim/war/navy.ts. Nothing where none is laid.)
      blockaded =
        e.sea && navied ? Math.max(blockadeOn(ctx.world, ta), blockadeOn(ctx.world, tb)) : 0,
      // (And as far as the deals of both ends can be held to: the society sweep, society/holding.ts. Exactly 1 where neither keeps any.)
      da = dealsOf(ctx.world, e.a),
      db = dealsOf(ctx.world, e.b),
      kept = da === null && db === null ? 1 : dealsMoved(da ?? db ?? 1, db ?? da ?? 1),
      // (Exactly nothing where neither end is preyed on.)
      preyed = Math.max(preyedAt(e.a, e.sea), preyedAt(e.b, e.sea)),
      moved =
        0.25 *
        (1 + SIGNAL.tradeShare * linked) *
        (1 - FINANCE.shuts * shut) *
        (1 - barred) *
        (1 - blockaded) *
        kept *
        (1 - preyed) *
        // (Kin on both ends of a road carry more down it: sim/culture/abroad.ts. Exactly 1 where neither end keeps any.)
        kinAcross(ctx.world, e.a, e.b),
      keen = 2 * (1 + SIGNAL.tradeMargin * linked),
      // (And what a journey cost in waiting on word and finding a buyer: the haul itself is what it was.)
      dealt = 1 - SIGNAL.tradeCost * linked;
    for (let g = 0; g < GOOD_COUNT; g++) {
      const [s, d] = ma.price[g]! <= mb.price[g]! ? [ma, mb] : [mb, ma],
        buyer = s === ma ? tb : ta,
        seller = s === ma ? ta : tb,
        duty = apart && buyer ? dutyOf(ctx.world, buyer) : 0,
        cartel = apart && seller ? cartels.get(g) : undefined,
        asked = cartel && cartel.members.has(refNumber(seller!)) ? cartel.markup * s.price[g]! : 0,
        margin =
          d.price[g]! * (1 - duty - changed) -
          s.price[g]! -
          asked -
          e.cost * dealt * GOODS[g]!.bulk,
        insured = e.sea && seller ? insuredGainOf(ctx.world, seller) : 0;
      if (margin <= 0) continue;
      const people = ctx.provinces.get(s.cell)!.total(),
        keep = GOODS[g]!.food
          ? mouths(ctx.provinces.get(s.cell)!, ctx.life) * FOOD_RESERVE_MONTHS
          : (wanted.get(s.cell)?.[g] ?? 0),
        spare = s.stock[g]! - keep;
      if (spare <= 0) continue;
      const count = Math.floor(
        spare * moved * (1 + insured) * Math.min(1, (keen * margin) / d.price[g]!),
      );
      if (count > 0)
        plans.push({
          from: s.cell,
          to: d.cell,
          good: g,
          count,
          margin,
          sea: e.sea,
          ...(asked > 0 ? { asked } : {}),
        });
    }
  }
  // Each province's carriers can move only so much.
  const load = new Map<number, number>();
  for (const pl of plans)
    load.set(pl.from, (load.get(pl.from) ?? 0) + pl.count * GOODS[pl.good]!.bulk);
  for (const pl of plans) {
    const p = ctx.provinces.get(pl.from)!,
      // (Information work multiplies what its carriers move: exactly 1 before the telegraph.)
      info = infoShare(connectivityOf(loreOf(ctx.world).effect(pl.from, "signal"))),
      capacity =
        (TRADER_CAPACITY * p.occupation(OCC.trader) + PORTERAGE_PER_PERSON * p.total()) *
        (1 + loreOf(ctx.world).effect(pl.from, "carrying")) *
        (1 + SIGNAL.carriers * info),
      carried = load.get(pl.from)!;
    if (carried > capacity) pl.count = Math.floor((pl.count * capacity) / carried);
  }
  // A market takes of a good no more than it has use for: what brings its stock to GLUT_YEARS of what goes there (what is
  // wanted of it there this year, or what went of it there in the most of its last years: Market.goes), from all who would send it, each
  // by what it would send. (Traders took a quarter of whatever a land had to spare of a good, each year, to any neighbour where
  // its price stood higher by more than the haul, whether anyone there had use for it: and a price falls no lower than a third
  // of a good's worth however much of it lies unsold, so where two lands' worths differed the goods went on going.)
  const sent = new Map<number, number>(),
    key = (pl: Plan) => pl.to * GOOD_COUNT + pl.good;
  for (const pl of plans) if (pl.count) sent.set(key(pl), (sent.get(key(pl)) ?? 0) + pl.count);
  for (const pl of plans) {
    if (!pl.count) continue;
    const to = markets.of(pl.to),
      room =
        GLUT_YEARS * (Math.max(wanted.get(pl.to)?.[pl.good] ?? 0, to.goes(pl.good)) + 1) -
        to.stock[pl.good]!,
      all = sent.get(key(pl))!;
    if (all > room) pl.count = room > 0 ? Math.floor((pl.count * room) / all) : 0;
  }
  const flows: TradeFlow[] = [];
  for (const pl of plans) {
    if (!pl.count) continue;
    const from = markets.of(pl.from),
      n = from.take("out", pl.good, pl.count);
    if (!n) continue;
    markets.of(pl.to).move("in", pl.good, n);
    from.tradeMargin += n * (pl.margin + (pl.asked ?? 0));
    flows.push({ from: pl.from, to: pl.to, good: pl.good, count: n });
    if (!markets.route(pl.from, pl.to)) openRoute(ctx, markets, pl, n, t);
  }
  // Each war that cut trade, told once: the lands it shut.
  for (const [war, lands] of cut) {
    if (war.embargo) continue;
    war.embargo = ctx.world.events.emit({
      type: ECONOMY_EVENTS.embargo.type,
      subjects: [war.attacker, war.defender],
      place: null,
      causes: [{ ref: war.event, role: "trigger", weight: 1 }],
      data: { ties: lands },
    });
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
  // Across the sea, the ship-craft that carried them there.
  const ships = pl.sea ? shipCraft(ctx, pl.from, pl.to) : null;
  if (ships)
    factors.push({
      name: "ships to carry them",
      value: 1,
      contribution: 0.5,
      source: { ref: ships, role: "enabler", weight: 1 },
    });
  const decision = world.decisions.record({
    rule: "trade.open",
    subject: from.ref,
    outcome: { to: to.ref, good: GOODS[pl.good]!.id },
    score: pl.margin,
    threshold: 0,
    factors,
  });
  const event = world.events.emit({
    type: pl.sea ? ECONOMY_EVENTS.seaRoute.type : ECONOMY_EVENTS.route.type,
    subjects: [from.ref, to.ref],
    place: from.ref,
    causes: [{ ref: decision, role: "trigger", weight: 1 }],
    data: { good: GOODS[pl.good]!.id, count: n },
  });
  markets.openRoute(pl.from, pl.to, event, pl.sea);
}

/** The finest ship-craft either of two lands knows: the event it was learned in. */
function shipCraft(ctx: PopulationContext, a: number, b: number): Ref | null {
  const lore = loreOf(ctx.world);
  for (const id of ["astronomy", "shipbuilding", "sailing"])
    for (const c of [a, b]) {
      const k = lore.get(c, id);
      if (k) return k.event;
    }
  return null;
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

/** Workers in a land (all but those who depend on them), at least one. */
function workersOf(p: Province): number {
  return Math.max(1, p.total() - p.occupation(OCC.dependent));
}

/**
 * Prices move toward what this year's shortage or glut would make them, about each good's worth in this land (Round B: rules/money.ts
 * naturalPrices): grain its staple; a food by the work a unit takes against grain's; what its crafters make by what it costs them;
 * what it cannot make by what it does for whoever uses it, or what is made of it; else what it last fetched. Its makers ask above
 * their cost as far as they are few, buyers cannot go without, its crafters' guild acts as one and goods from abroad allow
 * (rules/labour.ts lerner). Returns the recipes the land can work (their places in RECIPES), for its wages reckoned next.
 */
function reprice(
  ctx: PopulationContext,
  p: Province,
  m: Market,
  want: readonly number[],
): readonly number[] {
  const life = ctx.life,
    pop = mouths(p, life),
    workers = workersOf(p);
  // Foods stand in for one another: one scarcity for all three.
  let eaten = 0,
    kept = 0;
  for (const g of FOODS) {
    eaten += m.line("used", g);
    kept += m.stock[g]!;
  }
  const foodScarcity = (pop * 12 * 1.5) / (eaten + kept + 1),
    w = m.wage,
    living = (12 * pop) / workers,
    outside = Math.max(living, w[OCC.farmer]!, w[OCC.forager]!, w[OCC.herder]!),
    recipes: number[] = [];
  RECIPES.forEach((r, i) => {
    if (canMake(ctx, p, m, r)) recipes.push(i);
  });
  // (The work a unit of each food took this year: those who won it over what they won.)
  const work = new Array<number>(GOOD_COUNT).fill(NaN),
    per = (occ: number, g: number) => {
      const made = m.line("made", g),
        n = p.occupation(occ);
      return made > 0 && n > 0 ? n / made : NaN;
    };
  work[G.grain] = per(OCC.farmer, G.grain);
  work[G.meat] = per(OCC.herder, G.meat);
  work[G.wild] = per(OCC.forager, G.wild);
  const { worth, basis } = naturalPrices({
    price: m.price,
    recipes,
    outside,
    wage: outside,
    living,
    // (As its people's deaths unclothed read the cold: sim/population.)
    cold: dmath.clamp((10 - ctx.generated.climate.temperature[p.cell]!) / 10, 0, 1),
    work,
    // (The kinds of each class it has to hand: rules/variety.ts.)
    kinds: kindsOfEach(marketsOf(ctx.world).kindsHad(m)),
  });
  // Who could make each crafted good: every shop of the land's crafters, of a master's few or a works' floor.
  const lore = loreOf(ctx.world),
    perShop = lore.get(p.cell, "factories") ? SHOP.works : SHOP.hands,
    crafters = p.occupation(OCC.crafter),
    // (A trade governed by a body of its own asks as one the more; works gather its shops under fewer roofs, each works one
    // seller: sim/order/institutions.ts. Exactly as before where none is kept.)
    works = worksIn(ctx.world, p.cell),
    shops = (crafters * (1 - works.share)) / perShop + works.firms,
    guild = Math.min(1, guildOf(ctx.world, p.cell) + INST.governs * craftHeldIn(ctx.world, p.cell));
  let craftedWorth = 0;
  for (let g = 0; g < GOOD_COUNT; g++)
    if (basis[g] === "made") craftedWorth += m.line("made", g) * m.price[g]!;
  for (let g = 0; g < GOOD_COUNT; g++) {
    const good = GOODS[g]!,
      scarcity = good.food
        ? foodScarcity
        : (want[g]! * 1.5) / (m.line("used", g) + m.stock[g]! + 1),
      made = m.line("made", g),
      bought = m.line("in", g),
      markup =
        basis[g] === "made" && made > 0 && craftedWorth > 0
          ? lerner(shops, ELASTICITY[GOOD_USE[good.id]!]!, guild, bought / (bought + made))
          : 0,
      // (A good worth here only what is made of it stands, at that worth, at the most its users will give for it: what its
      // product fetches less the rest of the making. A shortage cannot lift it past that, for above it no one asks for any; a
      // glut still lowers it. Lifted as other goods are, copper in a land that knew copper tools and had no copper went up
      // threefold in each year its crafters asked for it and fell in each they did not, between two and four times its usual
      // worth for centuries, with none ever there.)
      target = priceTarget(
        worth[g]!,
        basis[g] === "inputs" ? Math.min(scarcity, 1) : scarcity,
        markup,
      );
    if (Number.isFinite(target) && target > 0)
      m.price[g] = m.price[g]! + PRICE_STEP * (target - m.price[g]!);
  }
  // (What each good is worth here and on what it rests, kept for the pages: seven bases to a number.)
  const goods = moneyStore(ctx.world, GOODS_STORE);
  if (goods) {
    const code = (from: number) => {
      let n = 0;
      for (let g = Math.min(GOOD_COUNT, from + 7) - 1; g >= from; g--)
        n = n * 6 + PRICE_BASES.indexOf(basis[g]!);
      return n;
    };
    goods.set(p.cell, [...worth.map((x) => x * 1000), code(0), code(7)]);
  }
  return recipes;
}

/**
 * What a year of each kind of work was worth at the margin, in grain. `can`: the recipes the land can work, as its prices'
 * reckoning just found them (nothing a recipe's test reads is moved by setting prices: asked of every recipe again here it
 * was a third of all such asking, 0.4% of a year at 1,500).
 */
function wages(ctx: PopulationContext, p: Province, m: Market, can: readonly number[]): void {
  const c = provinceCapacity(ctx, p.cell),
    rain = p.rain / 1000,
    tools = (1 + (TOOL_GAIN * m.toolCover) / 1000) * (1 + (MACHINE_GAIN * m.machineCover) / 1000),
    // (A year at the margin is as many days as its people work: the society sweep, rules/leisure.ts. 1 where none is kept.)
    gathers = ctx.life.appetite * daysWorkedOf(ctx.world, p.cell),
    margin = (capacity: number, workers: number, productivity: number) =>
      capacity > 0 ? 12 * productivity * dmath.exp((-workers * productivity) / capacity) : 0;
  const w = m.wage;
  w[OCC.forager] =
    margin(c.forage, p.occupation(OCC.forager), PRODUCTIVITY[OCC.forager]! * gathers) *
      rain *
      m.price[G.wild]! +
    FORAGER_HIDES * m.price[G.hides]!;
  w[OCC.farmer] = p.knowsCultivation
    ? margin(c.farm, p.occupation(OCC.farmer), PRODUCTIVITY[OCC.farmer]! * tools * gathers) *
      rain *
      m.price[G.grain]!
    : 0;
  w[OCC.herder] =
    margin(c.pasture, p.occupation(OCC.herder), PRODUCTIVITY[OCC.herder]! * tools * gathers) *
    (0.5 + 0.5 * rain) *
    (m.price[G.meat]! +
      HERD_GOODS.woolPerMeat * m.price[G.wool]! +
      HERD_GOODS.hidesPerMeat * m.price[G.hides]!);
  let best = 0;
  for (const i of can) {
    const r = RECIPES[i]!;
    if (r.inputs.length === 0 || inputLimit(m, r) > 0) best = Math.max(best, worth(m, r));
  }
  // (Where its workers have bound themselves in a union, they win a share of their trade's rent: Round B, rules/labour.ts.)
  const union = unionOf(ctx.world, p.cell);
  // (What a crafter earned in the year: what a year of the best of its crafts is worth, for as much of the year as there was
  // use for the work (Market.craftsWorked). It was the worth of a full year whether or not anyone had use for what it would
  // make: while every idle hand made tools no one wanted that was what the books showed a crafter making, 57 grain's worth a
  // year on first light at 600; with nothing made past its use a crafter made 8.8 and at the median land 2 to 3 by 1,000 to
  // 1,500, against a wage that still said 8 to 9, and the towns drew hands, the interests weighed crafters and the old were
  // kept as if it were earned: scratchpad/release/wg.mts.)
  // (And what a strike won them, while it lasts: sim/order/institutions.ts. Nothing where none is kept.)
  w[OCC.crafter] = (best * (1 + union.wage + wageWonIn(ctx.world, p.cell)) * m.craftsWorked) / 1000;
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
  // The hosts re-armed from what the crafts made, before what is left is traded (Phase 52 M217).
  rearmYear(ctx, politiesOf(ctx.world).living(), wanted, (p) => fieldedOf(ctx, p));
  const flows = trade(ctx, markets, t, wanted);
  markets.flows = flows;
  // The year is reckoned: what reads the books within this moment reads this year's.
  for (const m of markets.all()) m.reckoned = true;
  relief(ctx, markets, flows, t);
  for (const p of provinces) {
    const m = markets.of(p.cell);
    wages(ctx, p, m, reprice(ctx, p, m, wanted.get(p.cell)!));
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
    // Smelting wants fire: a people without it comes to metal another way (the vents' lore).
    const ore = ctx.affords.fire ? oreWorkable(ctx, p.cell, "copper", "metalworking") : null;
    if (ore && crafters >= 5) {
      const chance = 0.015 * Math.min(1, crafters / 25) * ore.reach;
      if (world.rng.chance(chance, METAL, key, t, 0)) {
        learned.push({ p, from: null, chance });
        continue;
      }
    }
    // From a neighbour who knows it, along a road that carries goods: over land, or across the sea
    // from those its ships trade with (War past the line, W2).
    const g = ctx.generated,
      borders = g.grid.offsets[p.cell + 1]! - g.grid.offsets[p.cell]!,
      sea = markets.seaPartners(p.cell);
    for (let k = 0; k < borders + sea.length; k++) {
      const n = k < borders ? g.grid.neighbours[g.grid.offsets[p.cell]! + k]! : sea[k - borders]!,
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
    const ore = oreWorkable(ctx, p.cell, "copper", "metalworking")!;
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
  const markets = marketsOf(ctx.world);
  for (const m of markets.all()) m.closeYear(year);
  markets.closeApart(year);
}

/** Register the economy's systems on a world with people. */
export function installEconomy(world: World): void {
  const ctx = () => populationContext(world);
  world.system({ key: "125.economy.year", every: YEAR, run: (t) => economyYear(ctx(), t) });
  world.system({ key: "155.knowledge.metal", every: YEAR, run: (t) => metalYear(ctx(), t) });
  world.system({ key: "890.economy.ledger", every: YEAR, run: (t) => closeYear(ctx(), t) });
}
