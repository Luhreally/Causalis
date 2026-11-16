// Money and the state (Round B): what a good is worth, what serves as money and what it buys, what a realm takes and spends, what
// it lays on what crosses its borders, what slips past them, and what is pooled against loss. A rule says what a thing does; the
// world's own numbers say how much.
//   A good's worth (naturalPrices): what it costs a land to make, by the going wage of the hands that make it and the worth of what
//     it is made from; where a land makes none, what it is worth to those who use it (a tool by the work it saves, an input by what
//     it makes); a price floats on scarcity about that worth, never about a number written down for it.
//   Money (moneyForm, priceLevel): nothing, then the metal the realm's markets hold most worth for its weight, then a written claim on
//     its treasury, then the houses of lending's own; under metal the price level is the coin's metal's worth, under paper and credit
//     the money stock turned over by its velocity against what is made (Fisher's MV = PY).
//   Taxes (taxBases): land, trade, heads, income, each as large as the realm's lands make it, as far as the realm can measure it, and
//     chosen as far as those who would bear it have too little sway to refuse it.
//   Tariffs and sanctions (tariffWanted, sanctionWanted): the crafters who lose to goods from abroad against the traders and the many
//     who gain by them, and the treasury's need; a fear against what the trade it shuts would cost.
//   Black markets (smuggled): a wedge between the two sides of a border against what being caught costs.
//   Pooled risk (shipLoss, harvestPool): a loss priced where records are kept and the trade or harvest is worth insuring.
// Pure tables and functions.
import { dmath } from "../kernel/index.ts";
import { G, GOODS, RECIPES, TOOL_GAIN, MACHINE_GAIN, WANTS, FOODS } from "./goods.ts";

// —— 1. Goods by what they are and what they do ————————————————————————————————————————————————————————

/** What a good does for whoever holds it (a fact of the good, not of any world). */
export const GOOD_USES = [
  "feeds",
  "fibre",
  "hide",
  "metal",
  "tools",
  "clothes",
  "holds",
  "burns",
  "drives",
] as const;
export type GoodUse = (typeof GOOD_USES)[number];
export const GOOD_USE: Readonly<Record<string, GoodUse>> = {
  grain: "feeds",
  meat: "feeds",
  wild: "feeds",
  wool: "fibre",
  hides: "hide",
  copper: "metal",
  tools: "tools",
  clothing: "clothes",
  pottery: "holds",
  coal: "burns",
  oil: "burns",
  machines: "drives",
  tin: "metal",
  iron: "metal",
};
/** What each use is, in a line a page shows. */
export const USE_WORDS: Readonly<Record<GoodUse, string>> = {
  feeds: "feeds one of its people for a month",
  fibre: "is spun and woven",
  hide: "is tanned and sewn",
  metal: "is worked into tools and machines",
  tools: "makes the work of whoever holds it go further",
  clothes: "keeps its wearer warm and dry",
  holds: "keeps what is stored from spoiling",
  burns: "gives heat to hearths, smelters and engines",
  drives: "does the work of many hands",
};
/**
 * How far those who want a good go without it as its price rises (the price elasticity of demand), by what it does: what keeps a
 * body alive is bought at nearly any price; an input as far as what it makes is worth it; a machine as far as it pays (est: Earth's
 * food 0.3-0.5, manufactures near 1, capital goods 1.2-1.5).
 */
export const ELASTICITY: Readonly<Record<GoodUse, number>> = {
  feeds: 0.4,
  fibre: 1,
  hide: 1,
  metal: 1.1,
  tools: 0.9,
  clothes: 0.6,
  holds: 0.8,
  burns: 0.5,
  drives: 1.4,
};

/** On what a good's worth in a market rests. */
export const PRICE_BASES = ["staple", "labour", "made", "used", "inputs", "free"] as const;
export type PriceBasis = (typeof PRICE_BASES)[number];
export const BASIS_WORDS: Readonly<Record<PriceBasis, string>> = {
  staple: "what the rest is reckoned in",
  labour: "the work a unit takes, against its staple",
  made: "what its makers' work and stuff cost",
  used: "what it does for whoever uses it",
  inputs: "what is made of it",
  free: "what it last fetched, moved by want",
};

/** What a market's goods are worth read from (all in grain's worth). */
export type PriceRead = {
  /** Its prices now. */
  readonly price: readonly number[];
  /** The recipes (by place in RECIPES) its crafters can work. */
  readonly recipes: readonly number[];
  /** What a year of a crafter's work would fetch elsewhere: the best of the land's other work, at least a living. */
  readonly outside: number;
  /** The going wage of a worker a year. */
  readonly wage: number;
  /**
   * The work a unit of each food takes (worker-years a unit, by good: NaN where none is made): its worth is that work against the
   * work a unit of its staple takes.
   */
  readonly work: readonly number[];
};

/** A unit's worth to its user, where what it does can be counted (grain's worth; NaN: it cannot). */
export function useWorth(g: number, wage: number): number {
  switch (GOOD_USE[GOODS[g]!.id]) {
    // (A tool raises its holder's work by TOOL_GAIN at full supply, and wears out at toolsPerWorker a year.)
    case "tools":
      return (TOOL_GAIN * wage) / WANTS.toolsPerWorker;
    case "drives":
      return (MACHINE_GAIN * wage) / WANTS.machinesPerWorker;
    case "feeds":
      // (A month's food is worth at most a month of a worker's year: beyond it, they gather it themselves.)
      return Math.max(1, wage / 12);
    default:
      return NaN;
  }
}

/** The most a unit of anything fetches where it is not made and its use cannot be counted: a worker's year. */
export const DEAREST_YEARS = 1;
/** And the least: a ten-thousandth of it. */
export const CHEAPEST_YEARS = 1e-4;

/**
 * Each good's worth in a market, and on what it rests: grain (or, where no grain is grown, wild food) is the staple, worth 1; a
 * food by the work a unit takes against its staple's; a good its crafters can make, by the cheapest recipe's cost (the crafter's
 * outside wage and its inputs at their prices, over what a year makes); a good it cannot make, by what it does for whoever uses it,
 * else by what the best recipe made of it would leave after its maker's wage; else what it last fetched.
 */
export function naturalPrices(r: PriceRead): { worth: number[]; basis: PriceBasis[] } {
  const n = GOODS.length,
    worth = new Array<number>(n).fill(NaN),
    basis = new Array<PriceBasis>(n).fill("free"),
    wage = Math.max(1e-6, r.wage),
    staple = Number.isFinite(r.work[G.grain]!) && r.work[G.grain]! > 0 ? G.grain : G.wild,
    stapleWork = r.work[staple]!;
  // Foods.
  for (const g of FOODS) {
    if (g === staple) {
      worth[g] = 1;
      basis[g] = "staple";
    } else if (Number.isFinite(r.work[g]!) && r.work[g]! > 0 && stapleWork > 0) {
      worth[g] = dmath.clamp(r.work[g]! / stapleWork, 0.25, 4);
      basis[g] = "labour";
    }
  }
  // What its crafters make, from the cheapest recipe (twice over, so an input's cost is its own made cost).
  for (let pass = 0; pass < 2; pass++)
    for (const i of r.recipes) {
      const rec = RECIPES[i]!,
        [out, per] = rec.output;
      if (basis[out] === "staple" || basis[out] === "labour") continue;
      let cost = Math.max(r.outside, 1e-6);
      for (const [g, k] of rec.inputs)
        cost += k * (Number.isFinite(worth[g]!) ? worth[g]! : r.price[g]!);
      const each = cost / per;
      if (!Number.isFinite(worth[out]!) || basis[out] !== "made" || each < worth[out]!) {
        worth[out] = each;
        basis[out] = "made";
      }
    }
  // What it cannot make: by its use; or as an input, by what is made of it.
  for (let g = 0; g < n; g++) {
    if (Number.isFinite(worth[g]!)) continue;
    const use = useWorth(g, wage);
    if (Number.isFinite(use)) {
      worth[g] = Math.min(use, Math.max(r.price[g]!, use / 4));
      basis[g] = "used";
      continue;
    }
    let best = NaN;
    for (const i of r.recipes) {
      const rec = RECIPES[i]!,
        k = rec.inputs.find(([x]) => x === g)?.[1];
      if (!k) continue;
      const [out, per] = rec.output;
      let left = per * (Number.isFinite(worth[out]!) ? worth[out]! : r.price[out]!) - r.outside;
      for (const [x, kx] of rec.inputs) if (x !== g) left -= kx * r.price[x]!;
      const each = left / k;
      if (each > 0 && !(each <= best)) best = each;
    }
    if (best > 0) {
      worth[g] = best;
      basis[g] = "inputs";
    } else {
      worth[g] = r.price[g]!;
      basis[g] = "free";
    }
  }
  // (What rests on nothing counted is held between a ten-thousandth of a worker's year and a whole one; the rest only kept above nothing.)
  for (let g = 0; g < n; g++) {
    const w = Number.isFinite(worth[g]!) ? worth[g]! : 1;
    worth[g] =
      basis[g] === "free" || basis[g] === "inputs"
        ? dmath.clamp(w, CHEAPEST_YEARS * wage, Math.max(DEAREST_YEARS * wage, 1))
        : Math.max(w, CHEAPEST_YEARS * wage);
  }
  return { worth, basis };
}

/** How far a year's shortage or glut moves a price from its worth (the market's own: sim/economy reprice). */
export const SCARCITY_MOST = 4;
export const SCARCITY_BENDS = 0.8;

/**
 * What a price moves toward in a year: its worth, bent by how short the good runs against what is wanted (scarcity: wanted over
 * had, 1 where they meet), and lifted by what its makers' hold on the market lets them ask (markup: the Lerner share, 0 … 1).
 */
export function priceTarget(worth: number, scarcity: number, markup: number): number {
  return (
    (worth * dmath.pow(dmath.clamp(scarcity, 1 / SCARCITY_MOST, SCARCITY_MOST), SCARCITY_BENDS)) /
    (1 - dmath.clamp(markup, 0, 0.6))
  );
}

// —— 2. Money ————————————————————————————————————————————————————————————————————————————————————————

/** What serves a realm as money: nothing (goods for goods), its markets' metal struck as coin, a written claim, the lenders' own. */
export const MONEY_FORMS = ["barter", "metal", "paper", "credit"] as const;
export type MoneyForm = (typeof MONEY_FORMS)[number];
export const MONEY_WORDS: Readonly<Record<MoneyForm, string>> = {
  barter: "goods for goods, reckoned in grain",
  metal: "coin struck of a metal",
  paper: "notes, a written claim on its treasury",
  credit: "what its houses of lending owe, passed hand to hand",
};

/** What a realm can make money of, as its seat knows it. */
export type MoneyCan = {
  readonly currency: boolean;
  readonly writing: boolean;
  readonly banking: boolean;
  /** Its seat's clerks keep accounts: bureaucracy. */
  readonly clerks: boolean;
  /** Houses of lending standing in its lands. */
  readonly houses: number;
  /** A metal its markets hold (its money good: GOODS place), or -1. */
  readonly metal: number;
};

/**
 * What serves as money: coin once a people knows currency and holds a metal; notes once its clerks can keep the accounts a claim
 * on the treasury needs and lending is known; the lenders' own claims once a house of lending stands in its lands to honour them.
 */
export function moneyForm(c: MoneyCan): MoneyForm {
  if (!c.currency) return "barter";
  if (c.banking && c.writing && c.clerks) return c.houses > 0 ? "credit" : "paper";
  return c.metal >= 0 ? "metal" : "barter";
}

/**
 * The money good: of the goods that do not spoil and are not eaten, the one worth most for its weight, among those its markets hold
 * (price over bulk); -1 where none is held.
 */
export function moneyGood(price: readonly number[], held: readonly number[]): number {
  let best = -1,
    most = 0;
  for (let g = 0; g < GOODS.length; g++) {
    const good = GOODS[g]!;
    if (good.food || good.spoil > 0 || GOOD_USE[good.id] !== "metal" || !(held[g]! > 0)) continue;
    const dense = price[g]! / good.bulk;
    if (dense > most) {
      most = dense;
      best = g;
    }
  }
  return best;
}

export const MONEY = {
  /** How often money changes hands in a year where few trade and none signal (est: 2, pre-modern Europe's 2-4). */
  velocity: 2,
  /** How much more it turns over for each trader among a hundred workers, and at a signal's full reach. */
  traders: 0.3,
  signal: 1.5,
  /** The share of its money metal's worth a realm keeps struck as coin. */
  coined: 0.25,
  /** A strained treasury debases its coin by at most this much a year; prints at most this share of its money stock. */
  debase: 0.08,
  print: 0.25,
  /** How fast the price level moves to what money and goods make it, a year. */
  pace: 0.5,
  /** How much a house of lending lends of each grain it holds (the money it makes: 1 / its reserve). */
  multiplier: 4,
  /** Prices rising this fast a year are told. */
  told: 0.1,
} as const;

/**
 * How often a realm's money changes hands in a year: the more of its people live by trade and the farther word carries (signals),
 * the more it turns over.
 */
export function velocityOf(traderShare: number, signal: number): number {
  return (
    MONEY.velocity *
    (1 + MONEY.traders * 100 * traderShare) *
    (1 + MONEY.signal * dmath.clamp(signal, 0, 1))
  );
}

/**
 * The price level money makes (money's units a grain's worth). Under metal, what a coin's metal is worth: a coin holds `fine` of a
 * unit of its metal, worth `metalWorth` grain, so a grain's worth costs 1 / (fine × metalWorth) coin; debasing it, or its metal
 * cheapening (a great lode found), lifts every price. Under paper and credit, Fisher's: money × velocity over what is made.
 */
export function priceLevel(
  form: MoneyForm,
  q: { fine: number; metalWorth: number; stock: number; velocity: number; made: number },
): number {
  if (form === "barter") return 1;
  if (form === "metal") return 1 / Math.max(1e-6, q.fine * q.metalWorth);
  return (q.stock * q.velocity) / Math.max(1, q.made);
}

// —— 3. Public finance ——————————————————————————————————————————————————————————————————————————————————

/** What a realm can tax. */
export const TAX_BASES = ["land", "trade", "heads", "income"] as const;
export type TaxBase = (typeof TAX_BASES)[number];
export const TAX_WORDS: Readonly<Record<TaxBase, string>> = {
  land: "its fields' harvest",
  trade: "what is bought and sold",
  heads: "each of its people",
  income: "what its people earn",
};
/** The most of each base a realm can take a year, as far as it can measure it (est: tithes a tenth to a quarter; a poll tax a tenth of a year's food). */
export const TAX_MOST: Readonly<Record<TaxBase, number>> = {
  land: 0.25,
  trade: 0.3,
  heads: 0.1,
  income: 0.4,
};

/** What a realm's seat knows that lets it measure what it taxes. */
export type Measures = {
  readonly writing: boolean;
  readonly reckoning: boolean;
  readonly clerks: boolean;
  readonly currency: boolean;
  readonly banking: boolean;
  /** Its reach over its lands (sim/order capacityOf: 0 … 1). */
  readonly capacity: number;
};

/**
 * How far a realm can measure each base (0 … 1). A harvest is seen at the threshing floor, and surveyed once fields are written
 * down; what is bought and sold is seen at its markets, the more where it passes as coin; heads are counted as far as the seat
 * reaches, and written into a roll; what each earns only where clerks keep accounts and money passes through lenders' books.
 */
export function measurable(m: Measures): Record<TaxBase, number> {
  const cap = dmath.clamp(m.capacity, 0, 1);
  return {
    land: dmath.clamp(0.35 + (m.writing ? 0.3 : 0) + (m.reckoning ? 0.15 : 0) + 0.2 * cap, 0, 1),
    trade: dmath.clamp(0.25 + (m.currency ? 0.35 : 0) + 0.2 * cap + (m.writing ? 0.1 : 0), 0, 1),
    heads: dmath.clamp(cap * (m.writing ? 0.9 : 0.4), 0, 1),
    income: m.clerks && m.banking && m.writing ? dmath.clamp(0.3 + 0.6 * cap, 0, 1) : 0,
  };
}

/**
 * Who would bear each base, and how far they can refuse it (0 … 1: their sway). A harvest's tax falls on whoever holds the land: the
 * few where wealth lies with few (spread low), the farmers where with many; a trade's on the traders; a head's on the many; an
 * income's on those who earn most (the top fifth's share of what is earned, against its fifth).
 */
export function taxResisted(
  sway: {
    readonly farmers: number;
    readonly traders: number;
    readonly few: number;
    readonly many: number;
  },
  spread: number,
  topShare: number,
): Record<TaxBase, number> {
  const s = dmath.clamp(spread, 0, 1),
    rich = dmath.clamp((topShare - 0.2) / 0.6, 0, 1);
  return {
    land: dmath.clamp((1 - s) * sway.few + s * sway.farmers, 0, 1),
    trade: dmath.clamp(sway.traders, 0, 1),
    heads: dmath.clamp(sway.many, 0, 1),
    income: dmath.clamp(sway.few * (0.4 + 0.6 * rich), 0, 1),
  };
}

/**
 * What a realm lays on each base, given what it needs beyond the harvest's tithe (grain's worth a year), each base's size, how far
 * it is measured and how far it is refused: each base is leaned on by how well it is measured and how little refused, up to its
 * most; what none will bear is left a deficit.
 */
export function taxRates(
  need: number,
  base: Readonly<Record<TaxBase, number>>,
  measured: Readonly<Record<TaxBase, number>>,
  resisted: Readonly<Record<TaxBase, number>>,
  skimmed: number,
): { rate: Record<TaxBase, number>; take: Record<TaxBase, number>; short: number } {
  const rate = { land: 0, trade: 0, heads: 0, income: 0 } as Record<TaxBase, number>,
    take = { land: 0, trade: 0, heads: 0, income: 0 } as Record<TaxBase, number>,
    kept = 1 - dmath.clamp(skimmed, 0, 0.9);
  // (The land's own tithe is set by the realm's interests: sim/polity. These are the others.)
  const open = (["trade", "heads", "income"] as const).filter(
    (b) => base[b] > 0 && measured[b] > 0,
  );
  let left = Math.max(0, need);
  const ease = (b: TaxBase) => measured[b] * (1 - resisted[b]);
  for (let pass = 0; pass < 3 && left > 1e-6; pass++) {
    const weights = open.map((b) => (rate[b] < TAX_MOST[b] ? ease(b) : 0)),
      sum = weights.reduce((a, b) => a + b, 0);
    if (sum <= 0) break;
    let gained = 0;
    open.forEach((b, i) => {
      const yieldOf = base[b] * measured[b] * kept,
        want = (left * weights[i]!) / sum,
        r = Math.min(
          TAX_MOST[b] * ease(b) * 2,
          TAX_MOST[b],
          rate[b] + want / Math.max(1e-9, yieldOf),
        );
      const more = (r - rate[b]) * yieldOf;
      if (more > 0) {
        rate[b] = r;
        gained += more;
      }
    });
    if (gained <= 1e-9) break;
    left -= gained;
  }
  for (const b of TAX_BASES) take[b] = rate[b] * base[b] * measured[b] * kept;
  return { rate, take, short: Math.max(0, left) };
}

export const TREASURY = {
  /** A man under arms costs his year's food, and as much again in his arms and keep. */
  armed: 2,
  /** Each of the seat's leaders is paid this many workers' years. */
  clerks: 1.5,
  /** Relief: months of food for each of a famished land's people. */
  relief: 2,
  /** What the treasury keeps of a surplus, faded by this share a year (spent on works, or lost to waste). */
  keeps: 0.85,
  /** A deficit of this share of what the realm takes in, kept up, it borrows (sim/finance), or else debases. */
  strained: 0.05,
} as const;

// —— 4. Tariffs and sanctions ——————————————————————————————————————————————————————————————————————————

/** Those who gain and lose by goods from abroad, as shares of a realm's sway (0 … 1). */
export type TradeSides = {
  /** The crafters' sway, and the share of their goods' sale goods from abroad took last year. */
  readonly crafters: number;
  readonly undersold: number;
  /** The traders' sway, and the share of the land's dealings that cross the realm's borders. */
  readonly traders: number;
  readonly crossing: number;
  /** The many who buy: their sway. */
  readonly buyers: number;
  /** What the treasury goes without, as a share of what it takes in. */
  readonly short: number;
  /** How much of the world's trade passes through its markets (a great buyer passes its tariff on to who sells to it). */
  readonly weight: number;
};

/** The most a realm lays on what comes in: half its worth. */
export const TARIFF_MOST = 0.5;

/**
 * What a realm lays on goods from abroad (a share of their worth): the crafters who are undersold press for it, the traders whose
 * living crosses the border and the many who buy press against it, a treasury going short asks for what a border is easiest to tax
 * by, and a realm whose buying is a great part of the world's sees its sellers bear part of it (the optimal tariff, 1 / the elasticity
 * of what it is sold, so the more its share).
 */
export function tariffWanted(s: TradeSides): { rate: number; parts: [string, number][] } {
  const parts: [string, number][] = [
    [
      "crafters undersold by goods from abroad",
      0.6 * s.crafters * dmath.clamp(s.undersold * 2, 0, 1),
    ],
    [
      "traders whose living crosses its borders",
      -0.5 * s.traders * dmath.clamp(s.crossing * 2, 0, 1),
    ],
    ["the many who buy", -0.15 * s.buyers * dmath.clamp(s.crossing * 2, 0, 1)],
    ["a treasury going short", 0.4 * dmath.clamp(s.short, 0, 1)],
    ["sellers who bear part of it", 0.2 * dmath.clamp(s.weight, 0, 1)],
  ];
  const sum = parts.reduce((a, [, v]) => a + v, 0);
  return { rate: dmath.clamp(sum, 0, TARIFF_MOST), parts };
}

/**
 * How much of its trade with another realm a realm shuts by its own word (0 … 1): its fear of that realm's way, against what the
 * trade between them is worth to its traders and what its people hold there.
 */
export function sanctionWanted(
  fear: number,
  tradeShare: number,
  tradersSway: number,
  stakes: number,
): number {
  const cost = dmath.clamp(tradeShare * (0.5 + tradersSway) + stakes, 0, 1);
  return dmath.clamp((fear - 0.35) * 2 - cost, 0, 1);
}

// —— 6. Black markets ——————————————————————————————————————————————————————————————————————————————————

/**
 * The share of what is barred or taxed at a border that crosses it anyway: the wedge (a tariff, or 1 for a good barred) against what
 * smuggling costs, the odds of being caught (how hard the realm holds, how far it reaches, how little is skimmed) times what is
 * lost then, and how long and open the border is.
 */
export function smuggled(
  wedge: number,
  hold: { force: number; capacity: number; corruption: number },
  border: number,
): number {
  if (wedge <= 0) return 0;
  const caught =
      dmath.clamp(0.2 + 0.6 * hold.force, 0, 1) *
      dmath.clamp(hold.capacity, 0.05, 1) *
      (1 - dmath.clamp(hold.corruption, 0, 0.9)),
    cost = caught * (1 + 0.5 * hold.force) * (1 / (1 + dmath.clamp(border, 0, 4)));
  return dmath.clamp(wedge / (wedge + cost + 0.05) - 0.05, 0, 0.8);
}

// —— 7. Insurance and pooled risk ——————————————————————————————————————————————————————————————————————

/**
 * The share of a cargo lost at sea on a voyage: storms by the world's wind, against how well its people build (est: 5% for open
 * boats and coasters in Earth's middle ages, under 1% with iron hulls and steam).
 */
export function shipLoss(windMs: number, ships: number): number {
  return dmath.clamp(
    (0.05 * dmath.clamp(windMs / 7, 0.3, 3)) / (1 + 2 * dmath.clamp(ships, 0, 4)),
    0.001,
    0.3,
  );
}

export const COVER = {
  /** What an underwriter asks above the loss it expects: its keep and its own risk. */
  load: 0.3,
  /** How much a trader who bears his own loss shies from it: what he gives up of each unit of risk. */
  averse: 4,
  /** A harvest pool pays a land whose harvest falls below its usual by more than this share, what it lost below that. */
  deductible: 0.15,
  /** How fast insurance takes to a realm's trade and fields, a year. */
  pace: 0.1,
  /** A pool keeps at most this many years of what it expects to pay. */
  reserve: 5,
} as const;

/** How much more of a cargo traders send by sea where it is insured, per unit insured: the risk they no longer shy from, less its price. */
export function insuredGain(loss: number): number {
  return Math.max(0, (COVER.averse - 1 - COVER.load) * loss);
}

/**
 * How far underwriting can stand in a realm (0 … 1): it needs written records of cargoes and claims, reckoning to price them,
 * money to pay in, and enough sea trade to pool.
 */
export function canUnderwrite(
  writing: boolean,
  reckoning: boolean,
  currency: boolean,
  seaTrade: number,
): number {
  if (!writing || !reckoning || !currency) return 0;
  return dmath.clamp(seaTrade / (seaTrade + 2000), 0, 1);
}

/**
 * How far a realm pools its harvests (0 … 1): it needs granaries to hold the pool and writing to keep who paid in, and it is worth as
 * much as its harvests swing (their spread from year to year, as a share) and its lands lie apart (so a bad year in one is a good one
 * in another).
 */
export function canPool(
  granaries: boolean,
  writing: boolean,
  swing: number,
  lands: number,
): number {
  if (!granaries || !writing || lands < 2) return 0;
  return dmath.clamp(swing * 3, 0, 1) * dmath.clamp((lands - 1) / 6, 0, 1);
}

export const MONEY_RULES = { MONEY, TREASURY, COVER } as const;
