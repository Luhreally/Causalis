// What trade's last sweep keeps (p87; the rules are rules/trade.ts, the systems ./trade.ts), and what the older systems read of it.
// Each system keeps one store of fixed rows of whole numbers (Round B's RowStore: a running digest, dormant while it holds nothing),
// a land's keyed by its cell or a realm's by its ref, last reckoned only, a faded number where it needs the past.
import type { World } from "../../kernel/index.ts";
import { automationGain, abateCost } from "../../rules/index.ts";
import { RowStore, refNumber } from "../money/kept.ts";
import { politiesOf } from "../polity/polity.ts";

/** 1. A realm's years of plenty and want: its idle crafts (thousandths), its usual harvest and this year's (food's units), what its
 * lands owe against a year's food (thousandths), the fall's parts (thousandths; the multiplier in hundredths), the year last told;
 * what its households bought by their earnings and its usual (sim/trade/demand.ts). */
export const CYCLE_STORE = "trade.cycle";
export const CY = {
  slack: 0,
  usual: 1,
  food: 2,
  leverage: 3,
  harvest: 4,
  called: 5,
  wealth: 6,
  k: 7,
  hoard: 8,
  spend: 9,
  told: 10,
  /** What its households bought of others' work by what they earned, and its usual (grain's worth at the wares' worth). */
  spent: 11,
  usualSpent: 12,
  /** Its usual idle hands (thousandths, a faded mean as `usual`): what its people have grown used to. */
  usualSlack: 13,
} as const;
/** 2. A realm's exchange: its listed works' worth in years of earnings (hundredths), their earnings (grain's worth a year), holders'
 * hopes of growth and the long run's (ten-thousandths a year, signed), what holders ask (ten-thousandths), how far worth is bid past
 * the long run's (hundredths), its worth (grain's worth), its last crash's year and what it took, last year's earnings. */
export const EXCHANGE_STORE = "trade.exchange";
export const EX = {
  years: 0,
  earnings: 1,
  hopes: 2,
  long: 3,
  asked: 4,
  bubble: 5,
  worth: 6,
  crash: 7,
  fell: 8,
  was: 9,
} as const;
/** 3. A land's machines at the work: the share of its craft tasks they can do and do (thousandths), what a hand's year by machines
 * costs and what a crafter earns (thousandths of grain's worth), what the machines' holders take (grain's worth a year), the hands
 * they stand in for, whether told. */
export const CAPITAL_STORE = "trade.capital";
export const CAP = { can: 0, share: 1, cost: 2, wage: 3, income: 4, hands: 5, told: 6 } as const;
/** 4. A realm's plan: the share it shares out by need, how well it knows what is wanted, its errors, lost effort and their whole
 * (thousandths), the lands and goods it must know of, its people's living as one (thousandths). */
export const PLAN_STORE = "trade.plan";
export const PL = {
  planned: 0,
  knows: 1,
  errs: 2,
  shirk: 3,
  loss: 4,
  lands: 5,
  goods: 6,
  social: 7,
} as const;
/** 5. A realm's price on smoke and its parts (thousandths), the share its works cut, what that costs them, whether told. */
export const SMOKE_STORE = "trade.smoke";
export const SM = {
  price: 0,
  abated: 1,
  cost: 2,
  harm: 3,
  breathers: 4,
  holders: 5,
  measured: 6,
  knows: 7,
  told: 8,
} as const;
/** 6. A land's heart: the walk a household saves there (ten-thousandths of a worker-year), the kind of home it is built to, its
 * greatest town's people, its town's ground rent (grain's worth a year) and that ground's worth (grain's worth). */
export const RENT_STORE = "trade.rent";
export const RT = { heart: 0, level: 1, people: 2, rent: 3, worth: 4 } as const;

/** 7. A good's cartel among realms, keyed "g" and the good's place in GOODS: its members' share of the world's making, the Herfindahl
 * index among them, how well they hold together, what bars outside makers, what they ask above (thousandths); its members (each a
 * realm's serial, one more); the year it first asked, whether told. */
export const CARTEL_STORE = "trade.cartel";
export const CT = {
  share: 0,
  within: 1,
  cohesion: 2,
  barred: 3,
  markup: 4,
  members: 5,
  since: 10,
  told: 11,
} as const;
/** The cartel row's key for a good. */
export const cartelKey = (good: number) => `g${good}`;
/** 8. A land's buying: what its households earn in years of their food (thousandths), what they buy of tools, clothing and pots
 * against their need, the share their means allow (thousandths); what they buy by their earnings at the wares' worth, and what their
 * need is worth (grain's worth). */
export const DEMAND_STORE = "trade.demand";
export const DM = {
  income: 0,
  tools: 1,
  clothing: 2,
  pottery: 3,
  scale: 4,
  real: 5,
  base: 6,
} as const;

export const TRADE_STORES: readonly (readonly [string, number])[] = [
  [CYCLE_STORE, 14],
  [EXCHANGE_STORE, 10],
  [CAPITAL_STORE, 7],
  [PLAN_STORE, 8],
  [SMOKE_STORE, 9],
  [RENT_STORE, 5],
  [CARTEL_STORE, 12],
  [DEMAND_STORE, 7],
];

/** One of trade's stores on a world (null where it keeps none). */
export function tradeStore(world: World, name: string): RowStore | null {
  return world.peek<RowStore>(name) ?? null;
}

// —— What the older systems read ——————————————————————————————————————————————————————————————————————————

/** A realm's idle crafts this year (0 … rules CYCLE.most). */
export function idleOf(world: World, realm: string | null | undefined): number {
  return realm ? (tradeStore(world, CYCLE_STORE)?.at(realm, CY.slack) ?? 0) / 1000 : 0;
}

/** Of what idle hands breed of grievance (a share idle), what chafes: idleness past what its people are used to, and a part of the rest. */
export const IDLE_CUSTOM = 0.3;
export function idleChafesOf(world: World, realm: string | null | undefined): number {
  const row = realm ? tradeStore(world, CYCLE_STORE)?.get(realm) : undefined;
  if (!row) return 0;
  const slack = row[CY.slack]! / 1000,
    usual = (row[CY.usualSlack] ?? row[CY.slack]!) / 1000;
  return IDLE_CUSTOM * slack + (1 - IDLE_CUSTOM) * Math.max(0, slack - usual);
}

/** The share of what a land's crafts would make that they make, for idle hands, a plan's errors and lost effort, and smoke cut. */
export function craftsKept(world: World, cell: number): number {
  const realm = politiesOf(world).of(cell)?.ref;
  if (!realm) return 1;
  const idle = idleOf(world, realm),
    plan = (tradeStore(world, PLAN_STORE)?.at(realm, PL.loss) ?? 0) / 1000,
    smoke = abateCost((tradeStore(world, SMOKE_STORE)?.at(realm, SM.abated) ?? 0) / 1000);
  return (1 - idle) * (1 - plan) * (1 - smoke);
}

/** How much more a land's crafters make with machines at their tasks (1: none). */
export function machinesAtWork(world: World, cell: number): number {
  return automationGain((tradeStore(world, CAPITAL_STORE)?.at(cell, CAP.share) ?? 0) / 1000);
}

/** What a land's machines' holders take a year (grain's worth). */
export function machineIncome(world: World, cell: number): number {
  return tradeStore(world, CAPITAL_STORE)?.at(cell, CAP.income) ?? 0;
}

/** The share of what a realm makes that its plan shares out by need (0 … 1). */
export function plannedOf(world: World, realm: string | null | undefined): number {
  return realm ? (tradeStore(world, PLAN_STORE)?.at(realm, PL.planned) ?? 0) / 1000 : 0;
}

/** The share of their smoke a land's works cut, by its realm's price on it (0 … 1). */
export function smokeCut(world: World, cell: number): number {
  const realm = politiesOf(world).of(cell)?.ref;
  return realm ? (tradeStore(world, SMOKE_STORE)?.at(realm, SM.abated) ?? 0) / 1000 : 0;
}

/** What a land's town's ground earns its holders a year (grain's worth). */
export function townRentOf(world: World, cell: number): number {
  return tradeStore(world, RENT_STORE)?.at(cell, RT.rent) ?? 0;
}

/** Each good's cartel this year: the serials of its members' realms and what they ask above on what they sell abroad. */
export function cartelsNow(world: World): Map<number, { members: Set<number>; markup: number }> {
  const out = new Map<number, { members: Set<number>; markup: number }>(),
    store = tradeStore(world, CARTEL_STORE);
  if (!store) return out;
  for (const k of store.keys()) {
    const row = store.get(k)!,
      markup = row[CT.markup]! / 1000;
    if (markup <= 0) continue;
    const members = new Set<number>();
    for (let i = 0; i < 5; i++) if (row[CT.members + i]! > 0) members.add(row[CT.members + i]! - 1);
    out.set(Number(k.slice(1)), { members, markup });
  }
  return out;
}

/** What a realm's cartel asks above on a good it sells abroad (0: it is in none). */
export function cartelAsk(world: World, realm: string | null | undefined, good: number): number {
  if (!realm) return 0;
  const row = tradeStore(world, CARTEL_STORE)?.get(cartelKey(good));
  if (!row) return 0;
  const n = refNumber(realm) + 1;
  for (let i = 0; i < 5; i++) if (row[CT.members + i] === n) return row[CT.markup]! / 1000;
  return 0;
}
