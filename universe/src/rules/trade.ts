// Trade's last sweep (p87): what Round B's money and labour left thin. A rule says what a thing does; the world's own numbers say how
// much. Every feedback here is bounded in what is made and eaten (food's units, a share of a craft's work), never in a price that
// a wage is paid in, so that no price lifts a wage that lifts the price (Round B's runaway).
//   Years of plenty and want (slackWanted, multiplier): where money can be held idle, a fall in what the many earn (what they buy by
//     their real income short of its usual, as after a poor harvest; debts called in when a house of lending fails; a fall of its
//     works' shares) is a fall in what they spend on others'
//     work, passed on through every hand it would have reached (Keynes's multiplier), and the deeper for what is owed against what
//     is made (Fisher's debt deflation); the crafts it no longer buys stand idle. Under barter goods are bought with goods: a bad
//     harvest is hunger, never idle hands.
//   An exchange (shareWorth): a realm's listed works are worth what they will earn, by what its lenders ask and how fast its holders
//     expect them to grow; expectations follow the last years (adaptive), so a run of good years is bid past what the long run
//     bears, and a falling year among high hopes is a crash.
//   Machines that do the work (automatable, machineCost, adoptWanted): a task is done by a machine where the land's machines are
//     fine enough to do its motions and reckon fast enough to judge it, its works have the power to drive them, and a machine's
//     year costs less than the hand it stands in for (the task model); its holders take what it saves.
//   A plan (planKnows, planCost, sharedOut): what the realm holds in common is shared by its plan, by need, not by price; a plan
//     errs as far as its clerks and its reckoning cannot know what so many lands want of so many goods (the knowledge problem), and
//     effort is lost where a worker's share no longer follows his work, as far as its people are selves and not one body.
//   Smoke priced (smokePrice, abatedFor, abateCost): smoke is no one's cost unless the realm makes it one: it does as far as those
//     who breathe it have a say and the realm can measure it and knows that it sickens, against those who hold the works; its works
//     cut their smoke as far as that price pays for the cutting (Pigou).
//   The heart's rent (heartRent, heartLevel): a household at a town's heart saves the walk its edge would cost it (Alonso); a heart is
//     built as tall as its people know how to build where that saving pays for building so (bid rent), not at a count of people.
// Pure tables and functions.
import { dmath } from "../kernel/index.ts";
import type { GoodUse, MoneyForm } from "./money.ts";
import type { Earners } from "./labour.ts";

// —— 1. Years of plenty and want ——————————————————————————————————————————————————————————————————————————

export const CYCLE = {
  /** How fast a realm's usual harvest and buying follow its years, a year (a faded mean: some seven years). */
  usual: 0.15,
  /** What a household keeps ahead (a share of a year's buying, est): buying short by less is met from what is kept. */
  kept: 0.1,
  /** The most a multiplier carries a fall (est: Earth's measured spending multipliers 0.5-2.5, the most where all is spent). */
  kMost: 4,
  /** The most of a realm's crafts that stand idle in a year. */
  most: 0.3,
  /** How fast idle hands find work again as prices and wages settle, a year; and how much faster where the treasury spends. */
  fade: 0.35,
  spent: 0.25,
  /** The share of the year's food owed that is called in when a house of lending fails. */
  crunch: 0.5,
  /** What is owed against the year's food, past which no more deepens a fall. */
  leverMost: 1,
  /** Of a fall in its works' shares (against what the realm makes), the share its holders spend the less (est: the wealth effect, 3-5 cents a unit). */
  wealth: 0.04,
  /** Idle hands this many are told. */
  told: 0.08,
} as const;

/** How far each money can be held idle rather than spent (what a fall in demand needs): goods spoil or are bartered; coin keeps. */
export const HOARD: Readonly<Record<MoneyForm, number>> = {
  barter: 0,
  metal: 0.6,
  paper: 1,
  credit: 1,
};

/**
 * The share of what is earned that is spent again on others' work within the year rather than kept or eaten, read off how a land's
 * income is shared (its poorest three fifths' share): those near their living spend all they earn, those far above it keep more
 * (est: so that the multiplier stands at 1.5-3, Earth's measured).
 */
export function spendShare(poorShare: number): number {
  return dmath.clamp(0.35 + 0.6 * dmath.clamp(poorShare, 0, 1), 0.35, 0.75);
}

/** How far a fall in spending is passed on through the hands it would have reached: 1 / (1 - spent at home). */
export function multiplier(spend: number, imported: number): number {
  const home = dmath.clamp(spend, 0, 0.95) * (1 - dmath.clamp(imported, 0, 1));
  return Math.min(CYCLE.kMost, 1 / (1 - home));
}

/** What a realm's year of plenty and want is read from. */
export type CycleRead = {
  /**
   * What its households buy of others' work this year by what they earn, against its usual (sim/trade/demand.ts: wares at their worth,
   * by real income alone, so that a ware's scarcity is never read as its buyers' want). A harvest short of its usual is a fall in it.
   */
  readonly spent: number;
  readonly usual: number;
  /** What its lands owe the houses of lending against a year's food (both food's units). */
  readonly leverage: number;
  /** A house of lending failed this year or last. */
  readonly failed: boolean;
  /** Its works' shares fell this year, against what the realm makes (both grain's worth; 0 where they did not fall). */
  readonly crashed: number;
  readonly form: MoneyForm;
  readonly spend: number;
  readonly imported: number;
};

/** The share of a realm's crafts its fall in spending leaves idle this year (0 … CYCLE.most), and its parts. */
export function slackWanted(r: CycleRead): { slack: number; parts: [string, number][] } {
  const short = r.usual > 0 ? dmath.clamp(1 - r.spent / r.usual, 0, 1) : 0,
    lever = dmath.clamp(r.leverage, 0, CYCLE.leverMost),
    harvest = Math.max(0, short - CYCLE.kept),
    called = r.failed ? Math.min(CYCLE.crunch, lever) : 0,
    wealth = CYCLE.wealth * dmath.clamp(r.crashed, 0, 4),
    k = multiplier(r.spend, r.imported),
    hoard = HOARD[r.form],
    fall = harvest + called + wealth,
    slack = dmath.clamp(hoard * k * fall * (1 + lever), 0, CYCLE.most);
  return {
    slack,
    parts: [
      ["what its people buy of others' work short of its usual", harvest],
      ["debts called in as a house of lending failed", called],
      ["its works' shares fallen", wealth],
      ["passed on through every hand (the multiplier)", k],
      ["what is owed against what is made", lever],
      ["how far its money can be held idle", hoard],
    ],
  };
}

/** Idle hands this year: what this year's fall leaves idle, or last year's, fading as prices and wages settle. */
export function slackNext(was: number, wanted: number, spends: boolean): number {
  const fade = CYCLE.fade + (spends ? CYCLE.spent : 0);
  return dmath.clamp(Math.max(wanted, was * (1 - fade)), 0, CYCLE.most);
}

// —— 2. An exchange ——————————————————————————————————————————————————————————————————————————————————————

export const EXCHANGE = {
  /** What a share's holder asks above what a realm's debt pays: his risk (est: Earth's equity premium, 3-6%). */
  premium: 0.04,
  /** How fast holders' hopes follow the last years' growth, a year (adaptive); and what the long run is read from. */
  hopes: 0.35,
  long: 0.04,
  /** Growth no holder counts on beyond: so far short of what he asks. */
  gap: 0.015,
  /** What its works' makers keep of what they sell, before their hold on the market and their machines (est: a tenth). */
  margin: 0.1,
  /** Worth bid this far past what the long run bears, and a year whose earnings fall, is a crash. */
  bubble: 1.3,
  /** A share's worth is held between this many and this many years of what it earns. */
  least: 3,
  most: 40,
} as const;

/**
 * What a realm's listed works are worth, in years of what they earn: next year's earnings by what holders expect, over what they
 * ask less the growth they expect (Gordon's), held between EXCHANGE.least and EXCHANGE.most.
 */
export function shareWorth(asked: number, growth: number): number {
  const g = Math.min(growth, asked - EXCHANGE.gap);
  return dmath.clamp((1 + g) / Math.max(EXCHANGE.gap, asked - g), EXCHANGE.least, EXCHANGE.most);
}

/** Holders' hopes after a year of growth `g`: following it, unless a fall among hopes far past the long run breaks them. */
export function hopesNext(
  hopes: number,
  long: number,
  g: number,
  bubble: number,
): { hopes: number; crash: boolean } {
  if (g < 0 && bubble >= EXCHANGE.bubble) return { hopes: Math.min(long, g), crash: true };
  return { hopes: hopes + EXCHANGE.hopes * (g - hopes), crash: false };
}

// —— 3. Machines that do the work —————————————————————————————————————————————————————————————————————————

export const AUTOMATE = {
  /** Of a craft's tasks, the share that are motions repeated (the rest need judgement: est, half). */
  routine: 0.5,
  /** The most of a craft's tasks machines do. */
  most: 0.9,
  /** A task a machine does is done so many times as fast as by a hand (est). */
  gain: 3,
  /** A hand's work done by machines wears out this many machines a year, and draws this much power (kW: ten times a body's). */
  machines: 0.5,
  kw: 1,
  /** The finest fit (mm) at which no motion can be done by a machine, and the tenfolds finer to do them all. */
  fitFloor: 0.5,
  fitSpan: 4.5,
  /** The sums a head (a second) below which no machine judges, and the tenfolds more to judge all a craft asks. */
  sumsFloor: 1000,
  sumsSpan: 7,
  /** How fast a land takes machines to the tasks they pay at, a year. */
  pace: 0.1,
  /** Machines doing this share of a land's crafts are told. */
  told: 0.25,
} as const;

/**
 * The share of a land's craft tasks machines can do (0 … AUTOMATE.most): the motions as far as its finest fit lets a machine repeat
 * them, the judgement as far as its sums a head let a machine reckon it, as far as its works have the power to drive them.
 */
export function automatable(fitMm: number, sums: number, powered: number): number {
  const hand = dmath.clamp(
      dmath.log10(AUTOMATE.fitFloor / Math.max(1e-9, fitMm)) / AUTOMATE.fitSpan,
      0,
      1,
    ),
    mind = dmath.clamp(
      dmath.log10(Math.max(1e-9, sums) / AUTOMATE.sumsFloor) / AUTOMATE.sumsSpan,
      0,
      1,
    );
  return (
    AUTOMATE.most *
    hand *
    (AUTOMATE.routine + (1 - AUTOMATE.routine) * mind) *
    dmath.clamp(powered, 0, 1)
  );
}

/** What a hand's year of work done by machines costs (grain's worth): the machines it wears out and the power it draws. */
export function machineCost(machinePrice: number, kwYear: number): number {
  return AUTOMATE.machines * Math.max(0, machinePrice) + AUTOMATE.kw * Math.max(0, kwYear);
}

/** The share of its craft tasks a land would have machines do: what they can, as far as a machine's year costs less than a hand's. */
export function adoptWanted(can: number, wage: number, cost: number): number {
  if (!(wage > 0)) return 0;
  return dmath.clamp(can, 0, AUTOMATE.most) * dmath.clamp((2 * (wage - cost)) / wage, 0, 1);
}

/** How much more its crafters make with machines at `share` of their tasks. */
export function automationGain(share: number): number {
  return 1 + dmath.clamp(share, 0, AUTOMATE.most) * (AUTOMATE.gain - 1);
}

// —— 4. A plan ————————————————————————————————————————————————————————————————————————————————————————————

export const PLAN = {
  /** What a plan loses at the most of what it shares out, where it can know nothing of what is wanted (est). */
  errs: 0.15,
  /** And of the effort of those whose share no longer follows their work, among selves (est). */
  shirk: 0.2,
  /** The most a plan's errors and lost effort take of a land's crafts. */
  most: 0.35,
} as const;

/**
 * How well a realm's plan can know what its lands want (0 … 1): as far as its seat reaches them, keeps accounts, reckons fast and
 * hears quickly; a mind of crystal reckons it all.
 */
export function planKnows(capacity: number, clerks: boolean, sums: number, signal: number): number {
  const reckons = dmath.clamp(dmath.log10(Math.max(1e-3, sums) * 10) / 11, 0, 1);
  return dmath.clamp(
    dmath.clamp(capacity, 0, 1) *
      (clerks ? 1 : 0.4) *
      (0.25 + 0.5 * reckons + 0.25 * dmath.clamp(signal, 0, 1)),
    0,
    1,
  );
}

/**
 * What a plan costs a realm's crafts (0 … PLAN.most): its errors, the more lands and goods it must know of and the less it can; the
 * effort lost where shares no longer follow work, as far as its people are selves (a body that lives as one loses little).
 */
export function planCost(
  planned: number,
  lands: number,
  goods: number,
  knows: number,
  social: number,
): { errs: number; shirk: number; loss: number } {
  const p = dmath.clamp(planned, 0, 1),
    many = dmath.clamp(
      (dmath.log2(1 + Math.max(0, lands)) * dmath.log2(1 + Math.max(0, goods))) / 16,
      0,
      1.5,
    ),
    errs = p * PLAN.errs * many * (1 - dmath.clamp(knows, 0, 1)),
    selves = dmath.clamp((1 - dmath.clamp(social, 0, 1)) / 0.2, 0, 1),
    shirk = p * PLAN.shirk * selves;
  return { errs, shirk, loss: dmath.clamp(errs + shirk, 0, PLAN.most) };
}

/** A land's households after a plan shares `planned` of what each earns by need: that share of each pooled and given out alike. */
export function sharedOut(groups: readonly Earners[], planned: number): Earners[] {
  const p = dmath.clamp(planned, 0, 1),
    people = groups.reduce((s, g) => s + Math.max(0, g.people), 0),
    all = groups.reduce((s, g) => s + Math.max(0, g.people) * g.each, 0),
    mean = people > 0 ? all / people : 0;
  return groups.map((g) => ({ people: g.people, each: (1 - p) * g.each + p * mean }));
}

// —— 5. Smoke priced ——————————————————————————————————————————————————————————————————————————————————————

export const SMOKE_PRICE = {
  /** The most of their smoke works cut. */
  most: 0.9,
  /** What cutting all of it would cost its works, as a share of their output (the cost rises as the square of what is cut). */
  cost: 0.08,
  /** The share of their smoke works cut for each share of its harm the price asks (est: cutting is cheap at first, dear at the last). */
  bites: 1.25,
  /** A realm whose works cut this share of their smoke is told. */
  told: 0.2,
} as const;

/** What a realm's price on smoke is read from (each 0 … 1). */
export type SmokeSides = {
  /** How foul its people's air is, people weighed. */
  readonly harm: number;
  /** The say of those who breathe it: the many, as far as the realm hears them. */
  readonly breathers: number;
  /** The say of those who hold the works and would pay: the few and the crafters, less what the realm holds itself. */
  readonly holders: number;
  /** How far it can measure smoke (writing and reckoning, its reach), and whether it knows that smoke sickens. */
  readonly measured: number;
  readonly knows: boolean;
};

/** The price a realm lays on its works' smoke (0 … 1 of the harm it does) and its parts. */
export function smokePrice(s: SmokeSides): { price: number; parts: [string, number][] } {
  const harm = dmath.clamp(s.harm, 0, 1),
    seen = dmath.clamp(s.measured, 0, 1) * (s.knows ? 1 : 0.25),
    asked = dmath.clamp(s.breathers, 0, 1) * seen,
    refused = dmath.clamp(s.holders, 0, 1) * 0.6;
  return {
    price: dmath.clamp(harm * (asked - refused) * 3, 0, 1),
    parts: [
      ["how foul its air is", harm],
      ["the say of those who breathe it", s.breathers],
      ["how far it can measure it and knows it sickens", seen],
      ["the say of those who hold the works", s.holders],
    ],
  };
}

/** The share of their smoke works cut at a price. */
export function abatedFor(price: number): number {
  return dmath.clamp(SMOKE_PRICE.bites * dmath.clamp(price, 0, 1), 0, SMOKE_PRICE.most);
}

/** What cutting that share of their smoke costs a land's works, a share of what they make. */
export function abateCost(abated: number): number {
  const a = dmath.clamp(abated, 0, SMOKE_PRICE.most);
  return SMOKE_PRICE.cost * a * a;
}

// —— 6. The heart's rent —————————————————————————————————————————————————————————————————————————————————

export const HEART = {
  /** A household's walks to the heart and back, a day, at the walking pace (km an hour), out of a day's work (hours: est). */
  walks: 2,
  kmh: 5,
  hours: 10,
  /** A lot's ground (m², rules/reach.ts LOT_M2) and its share of the town's ground, the rest streets and yards. */
  lotM2: 126,
  built: 0.5,
  /**
   * What a household's home in a taller kind costs more a year than a low one's, once its people know how to raise it (worker-years: a
   * stair or a lift and a deeper footing carried at a lender's rate; est).
   */
  taller: 0.006,
  /** What a lender asks a year of what ground is worth: ground is worth its rent over this (est: Earth's long rates, 4-8%). */
  carry: 0.07,
} as const;

/**
 * What a household at a town's heart saves a year against one at its edge (worker-years of its work): the walk to the heart and back,
 * by how far the edge lies, the town's people housed `holds` to a lot.
 */
export function heartRent(people: number, holds: number): number {
  const lotsKm2 = (1e6 * HEART.built) / HEART.lotM2,
    km = Math.sqrt(Math.max(0, people) / (Math.PI * lotsKm2 * Math.max(1, holds))),
    perKm = (2 * HEART.walks) / (HEART.kmh * HEART.hours);
  return perKm * km;
}

/**
 * The tallest kind of home a heart is built to: of the kinds its people know how to raise (`can`, lowest first: a hut always, a house
 * once they farm, both low), the tallest whose walk saved at the heart, housed as it houses, pays what building so costs more.
 */
export function heartLevel(
  people: number,
  holds: readonly number[],
  can: readonly boolean[],
): number {
  let top = can[1] ? 1 : 0;
  for (let l = 2; l < holds.length; l++)
    if (can[l] && heartRent(people, holds[l]!) >= HEART.taller) top = l;
  return top;
}

/** What a town's ground earns its holders a year (worker-years): each household's saving at its distance, summed (a third of the heart's). */
export function townRent(people: number, holds: number, familySize: number): number {
  return ((Math.max(0, people) / Math.max(1, familySize)) * heartRent(people, holds)) / 3;
}

/**
 * Which kinds of home (rules/buildings.ts LEVEL order) a land's people know how to raise: a hut always; a house once they farm; a
 * townhouse in stone; a tenement on engines' iron; a block of steel with the wire's power to lift; a high-rise once valves steer its
 * lifts and services; a spire hung from woven carbon. `k` answers a knowledge id, or ids joined by "|".
 */
export function heartCan(k: (id: string) => boolean): boolean[] {
  return [
    true,
    k("cultivation"),
    k("masonry"),
    k("steam-engine"),
    k("electricity|sea-electricity") && k("steel"),
    k("electronics"),
    k("world-city"),
  ];
}

// —— 7. Cartels among realms ——————————————————————————————————————————————————————————————————————————————

export const CARTEL = {
  /** A cartel holds at least this share of a world's making of a good, among at most this many realms, each at least this share. */
  share: 0.5,
  members: 5,
  least: 0.05,
  /** The most a cartel asks above what its sellers would, a share of the price. */
  most: 0.5,
  /** How readily outside makers come in for each unit of the price raised, where nothing bars them (est: their supply's elasticity). */
  fringe: 2,
  /** A cartel asking this much is told. */
  told: 0.1,
} as const;

/** The sellers of a good who would act as one: the greatest makers, few, holding most of a world's making. */
export function cartelMembers(shares: readonly number[]): { members: number[]; share: number } {
  const order = shares
    .map((s, i) => [s, i] as const)
    .filter(([s]) => s >= CARTEL.least)
    .sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  const members: number[] = [];
  let share = 0;
  for (const [s, i] of order) {
    if (share >= CARTEL.share || members.length >= CARTEL.members) break;
    members.push(i);
    share += s;
  }
  return share >= CARTEL.share ? { members, share } : { members: [], share: 0 };
}

/** The Herfindahl index of shares (each 0 … 1): one seller 1, n alike 1 / n. */
export function hhi(shares: readonly number[]): number {
  const all = shares.reduce((a, b) => a + Math.max(0, b), 0);
  if (all <= 0) return 0;
  let h = 0;
  for (const s of shares) h += (Math.max(0, s) / all) * (Math.max(0, s) / all);
  return h;
}

/** What a cartel among realms is read from. */
export type CartelRead = {
  /** Its members' share of the world's making of the good, and the Herfindahl index among them alone. */
  readonly share: number;
  readonly within: number;
  /** How cheaply members see each other ship more than agreed: the reach of their signals and how freely word moves (each 0 … 1, their mean). */
  readonly signal: number;
  readonly word: number;
  /** What bars outside makers from coming in (0 … 1): the share of the world's peopled lands that make none of it. */
  readonly barred: number;
  /** How far buyers go without it as its price rises: its substitutes (rules/money.ts ELASTICITY). */
  readonly elasticity: number;
};

/**
 * What a cartel asks above what its members would each ask alone (a share of its export price, 0 … CARTEL.most), and its parts. A
 * dominant group's Lerner index is one over the elasticity of what is left it to sell: buyers' going without, and outside makers
 * coming in for their share, over its own share. It holds that as far as its members can watch one another (Stigler: cheating seen is
 * cheating punished), the fewer and less alike in size the better (one great member holds the rest to it).
 */
export function cartelMarkup(c: CartelRead): {
  markup: number;
  cohesion: number;
  parts: [string, number][];
} {
  const s = dmath.clamp(c.share, 0, 1);
  if (s < CARTEL.share) return { markup: 0, cohesion: 0, parts: [] };
  const fringe = CARTEL.fringe * (1 - dmath.clamp(c.barred, 0, 1)),
    left = (Math.max(0.2, c.elasticity) + fringe * (1 - s)) / s,
    watch = (0.3 + 0.7 * dmath.clamp(c.signal, 0, 1)) * (0.5 + 0.5 * dmath.clamp(c.word, 0, 1)),
    cohesion = dmath.clamp(watch * dmath.sqrt(dmath.clamp(c.within, 0, 1)), 0, 1),
    markup = dmath.clamp(cohesion / left, 0, CARTEL.most);
  return {
    markup,
    cohesion,
    parts: [
      ["its members' share of the world's making", s],
      ["how cheaply they watch one another", watch],
      ["how few and unlike they are", c.within],
      ["what bars outside makers", c.barred],
      ["how far buyers go without it", c.elasticity],
    ],
  };
}

// —— 8. Demand by income and price ————————————————————————————————————————————————————————————————————————

/**
 * How much more of a good a household wants for each share more it earns (income elasticity), by what the good does: what feeds a
 * body is wanted little more once it is fed; wares and what is kept, the more as there is more to spend (est: Engel's law; Earth's
 * food 0.1-0.3, clothing near 1, durables and fine wares above 1).
 */
export const INCOME_ELASTICITY: Readonly<Record<GoodUse, number>> = {
  feeds: 0.15,
  fibre: 0.8,
  hide: 0.8,
  metal: 1,
  tools: 0.6,
  clothes: 1,
  holds: 0.9,
  burns: 0.5,
  drives: 1.2,
};

export const DEMAND = {
  /**
   * What a land makes, in years of its people's food, where its households want what rules/goods.ts WANTS sets (est: a modest one; a
   * young world's middle land makes some 1.8).
   */
  ref: 1.8,
  /**
   * A household buys at least this and at most this of what WANTS sets of a ware, whatever it earns and the price (what it lacks past
   * that it mends and makes do with: est). Held high, so that a poor land's fewer tools never pull it down year on year.
   */
  least: 0.6,
  most: 1.5,
  /** And of food at least its bodies' need, at most this much more. */
  foodMost: 1.2,
  /** Of a year's earnings, what a household can spend beyond them on credit where lending is known (est: a quarter). */
  credit: 0.25,
} as const;

/**
 * How much of what WANTS sets of a good a household wants (a factor): by its earnings against a modest household's (income
 * elasticity), and its price against its worth (price elasticity: how far buyers go without), held between DEMAND.least and
 * DEMAND.most (a tool never past what the work wears out); food never below its bodies' need.
 */
export function demandFactor(
  use: GoodUse,
  income: number,
  priceRatio: number,
  priceElasticity: number,
): number {
  const rich = dmath.clamp(income / DEMAND.ref, 0.05, 20),
    dear = dmath.clamp(priceRatio, 0.25, 4),
    f = dmath.pow(rich, INCOME_ELASTICITY[use]) * dmath.pow(dear, -Math.max(0, priceElasticity));
  // (A tool is bought for the work it does: never more than the work wears out, however cheap.)
  return use === "feeds"
    ? dmath.clamp(f, 1, DEMAND.foodMost)
    : dmath.clamp(f, DEMAND.least, use === "tools" ? 1 : DEMAND.most);
}

/**
 * The share of what a household would buy of its wares it can pay for: all, where what it would spend on them is within what it
 * earns past its food and what it can borrow; else what that allows, never below DEMAND.least of what it would.
 */
export function withinMeans(spend: number, earned: number, food: number, credit: number): number {
  const means = Math.max(0, earned - food) + Math.max(0, credit);
  if (spend <= means || spend <= 0) return 1;
  return dmath.clamp(means / spend, DEMAND.least, 1);
}
