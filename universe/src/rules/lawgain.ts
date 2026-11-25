// What each of a realm's groups gains or loses by each position of each of its four laws (the breadth round, 2026-11-23: law
// from forces). Before it, 84 numbers said what farmers, traders, the court and the rest wanted of each position, the same in
// every realm of every world. Now a law's positions are what they do to who gets what, and a group wants a position as far as
// it leaves it better off, reckoned from its realm's own numbers: how many of each live by what, what a year of their work is
// worth, what is left over a tiller's keep, how much of its trade crosses its borders, how many of its people are of another
// tongue or faith, how its courts reach. A group whose realm has no strangers cares nothing for the strangers' law.
//   The land (the lord's, leased, the tiller's own): of what a tiller makes above his keep, his holder takes all, half, none
//     (LAND_TAKES, the share the binding rule reads, rules/labour.ts bindPull); all of it only of those its arms can hold to
//     the land against the open land they could flee to (bindPull's `hold`); a lease's half only as far as its deals are held to
//     (contractsKept, by the realm's courts as they stand), and of those tenants who would not sooner till open land of their
//     own (1 / (1 + open)): a bond is kept by force, a lease by its terms and the want of anywhere better. What is taken goes to those who hold the land by
//     the sword, the word and the crown (the court, the army and the temple, by their sway); leased, a share of the leases is
//     bought by those with coin (crafters and traders, by what their work is worth). A tiller puts into his land as far as he
//     keeps what it yields (rules/holding.ts TENURE, improveTarget): his own, the most.
//   Strangers (subjects, the faithful, citizens): subjects of another tongue or faith pay dues (STRANGER.dues), the faithful's
//     unbelievers alone; citizens none. The dues go to the seat's holders; what is paid is paid by the commons as far as they are
//     strangers. A stranger who is no citizen cannot hold a deal, and trade with him falls by rules/holding.ts DEALS: its traders
//     lose as far as their trade crosses the realm's borders (and its crafters, half).
//   Faith (one faith, others tolerated, free conscience): the temple's tithe is paid by all where one faith is allowed, by its
//     believers where others are tolerated, and by the devout alone where conscience is free. Under a sacred law the court rules
//     by the temple's word and shares its gain. A trader may not deal with an unbeliever where one faith is allowed: he loses his
//     trade with realms of other faiths.
//   Justice (custom and vengeance, the ruler's courts, one law for all): its courts reach (rules/holding.ts COURTS) and so how far a
//     deal is held to (contractsKept) and what is held is safe (holdingSecure). Traders live by deals kept, crafters as far as they
//     sell, tillers by their land's improvements; the court takes fees where it judges and skims as far as its officers can be
//     bought, which a law for all wears down (sim/order/order.ts: 0.004 of corruption a year a step, against a twentieth a year
//     that fades of itself).
// What a group gains is what it would have, all its heads together, against the mean of the three positions, as a share of what
// its work brings it in a year (x), wanted as LAW_GAIN.scale x / (1 + |LAW_GAIN.scale x|), -1 … 1: a few who would have twice
// their keep want it hard, and twenty times their keep hardly harder. Pure functions.
import { dmath } from "../kernel/index.ts";
import {
  COURTS,
  DEALS,
  TENURE,
  contractsKept,
  holdingSecure,
  improveTarget,
  seizureRisk,
} from "./holding.ts";

export const LAW_GROUPS = [
  "farmers",
  "herders",
  "crafters",
  "traders",
  "the court",
  "the temple",
  "the army",
] as const;
export type LawGroup = (typeof LAW_GROUPS)[number];
const COMMONS = ["farmers", "herders", "crafters", "traders"] as const;
const LORDS = ["the court", "the temple", "the army"] as const;
type Common = (typeof COMMONS)[number];

/** Of what a tiller makes above his keep, the share his holder takes, by the land law (the binding rule's, rules/labour.ts). */
export const LAND_TAKES: readonly [number, number, number] = [1, 0.5, 0];

export const LAW_GAIN = {
  /** A group's gain as a share of what its work brings it a year, times this, is how hard it wants a position (saturating). */
  scale: 6,
} as const;
export const STRANGER = {
  /** What a stranger who is no citizen pays the seat, of what his work brings (est: the kharaj and jizya, a tenth to a fifth). */
  dues: 0.1,
} as const;
export const FAITH_DUES = {
  /** The tithe, of what a payer's work brings (est: a tenth, the old tithe). */
  tithe: 0.1,
  /** Under a sacred law, the share of the temple's gain that is the court's. */
  sacred: 0.5,
} as const;
export const JUSTICE_DUES = {
  /** What judging takes in fees, of what its people's work brings, where courts reach wholly (est: a hundredth). */
  fees: 0.01,
  /** Of those fees, the share the court keeps where one law binds it, and the ruler's courts are no longer its own. */
  bound: 0.5,
  /** How far each step toward one law for all lowers what is skimmed where it settles: 0.004 a year against 0.05 that fades. */
  skimFall: 0.08,
  /** The share of the seat's take (its tribute) its officers' skimming comes to, at a whole corruption. */
  skim: 0.5,
} as const;

/** All a realm's laws are weighed from. */
export type LawFacts = {
  /** Its people by what they live by (the temple: its clergy). */
  readonly heads: Readonly<Record<LawGroup, number>>;
  /** What a year of each common group's work brings a head (grain's worth). */
  readonly pay: Readonly<Record<Common, number>>;
  /** What keeps a worker and his own a year (grain's worth). */
  readonly living: number;
  /** How far its arms hold a bound tiller to his land against the open land he could flee to (rules/labour.ts bindPull, 0 … 1). */
  readonly hold: number;
  /** Open land within a bound tiller's reach against its people (rules/labour.ts bindPull `open`, 0 … 2): a tenant leaves for it too. */
  readonly open: number;
  /** Each group's sway (shares): who of those who hold the land takes what. */
  readonly sway: Readonly<Record<LawGroup, number>>;
  /** Its people in lands of another tongue than its seat's, and of another faith (shares, 0 … 1). */
  readonly foreign: number;
  readonly unbelief: number;
  /** What crosses its borders in trade, against what its lands use (0 … 1); of that, the share with realms of another faith. */
  readonly trade: number;
  readonly otherFaiths: number;
  /** Its seat's faith: whether it keeps one, how devout its people are, whether its law is sacred. */
  readonly faith: boolean;
  readonly piety: number;
  readonly sacred: boolean;
  /** How it is held (0 … 1), what its officers skim, how far its law is written and its seat reaches, its treasury short. */
  readonly force: number;
  readonly voice: number;
  readonly trust: number;
  readonly kinship: number;
  readonly corruption: number;
  readonly written: number;
  readonly capacity: number;
  readonly short: number;
  /** What its seat takes of what its people's work brings (its tribute, 0 … 1). */
  readonly tribute: number;
  /** Its land and justice laws now (0 … 2): what a tiller keeps of what he puts in, and how far its courts reach, each for the other. */
  readonly land: number;
  readonly justice: number;
};

type Incomes = Record<LawGroup, number>;
const position = (x: number): number => dmath.clamp(Math.round(x), 0, 2);
const zero = (): Incomes => ({
  farmers: 0,
  herders: 0,
  crafters: 0,
  traders: 0,
  "the court": 0,
  "the temple": 0,
  "the army": 0,
});

/** What a group's work brings it a year, all its heads (the few who lead, pray and fight: as a common head's, at the least). */
function baseOf(f: LawFacts): Incomes {
  const b = zero();
  let made = 0,
    heads = 0;
  for (const g of COMMONS) {
    b[g] = f.heads[g] * f.pay[g];
    made += b[g];
    heads += f.heads[g];
  }
  const mean = heads > 0 ? made / heads : 0;
  for (const g of LORDS) b[g] = f.heads[g] * mean;
  return b;
}

/** Share `amount` among the seat's holders (court, temple, army) by their sway; nothing to one with no heads. */
function toLords(out: Incomes, f: LawFacts, amount: number, faith = true): void {
  let all = 0;
  for (const g of LORDS) if (f.heads[g] > 0 && (faith || g !== "the temple")) all += f.sway[g];
  if (!(all > 0)) return;
  for (const g of LORDS)
    if (f.heads[g] > 0 && (faith || g !== "the temple")) out[g] += (amount * f.sway[g]) / all;
}

/** What is taken of its tillers a year under each position of the land law: of what they make above their keep, as far as they are held to it. */
function landRent(f: LawFacts, base: Incomes, x: number): number {
  const tilled = base.farmers + base.herders,
    keep = Math.max(1e-9, f.living),
    spare = f.pay.farmers > 0 ? dmath.clamp((f.pay.farmers - keep) / f.pay.farmers, 0, 1) : 0,
    // (What holds the tiller to it: the arms for a bond, the courts for a lease.)
    kept =
      x === 0
        ? dmath.clamp(f.hold, 0, 1)
        : contractsKept(
            COURTS[position(f.justice)]!,
            f.written,
            f.corruption,
            f.capacity,
            f.trust,
            f.kinship,
          ).kept /
          (1 + dmath.clamp(f.open, 0, 2));
  return LAND_TAKES[x]! * spare * tilled * kept;
}

/** What each group has a year under each position of the land law (over its base). */
function landIncomes(f: LawFacts, base: Incomes, x: number): Incomes {
  const out = zero(),
    tilled = base.farmers + base.herders,
    rent = landRent(f, base, x),
    makers = base.crafters + base.traders,
    coin = makers / Math.max(1e-9, makers + tilled),
    secure = holdingSecure(seizureRisk(f).risk, COURTS[position(f.justice)]!, f.capacity),
    improved = improveTarget(secure, TENURE[x]!);
  for (const g of ["farmers", "herders"] as const)
    out[g] = base[g] * (1 + improved) - (tilled > 0 ? (rent * base[g]) / tilled : 0);
  // (Leased, those with coin hold a share of the leases.)
  const leased = x === 1 ? rent * coin : 0;
  if (makers > 0)
    for (const g of ["crafters", "traders"] as const) out[g] = (leased * base[g]) / makers;
  toLords(out, f, rent - leased);
  return out;
}

/** Under each position of the strangers' law. */
function strangerIncomes(f: LawFacts, base: Incomes, x: number): Incomes {
  const out = zero(),
    payers = [f.foreign + f.unbelief - f.foreign * f.unbelief, f.unbelief, 0][x]!,
    // (A stranger who is no citizen cannot hold a deal: subjects none, the faithful those of its faith.)
    dealt = [0, 1 - f.otherFaiths, 1][x]!,
    lost = DEALS * (1 - dealt) * f.trade;
  let dues = 0;
  for (const g of COMMONS) {
    const paid = STRANGER.dues * payers * base[g];
    out[g] = -paid - lost * base[g] * (g === "traders" ? 1 : g === "crafters" ? 0.5 : 0);
    dues += paid;
  }
  toLords(out, f, dues);
  return out;
}

/** Under each position of the faith law (nothing where its seat keeps no faith). */
function faithIncomes(f: LawFacts, base: Incomes, x: number): Incomes {
  const out = zero();
  if (!f.faith) return out;
  const payers = [1, 1 - f.unbelief, (1 - f.unbelief) * dmath.clamp(f.piety, 0, 1)][x]!;
  let tithe = 0;
  for (const g of COMMONS) {
    const paid = FAITH_DUES.tithe * payers * base[g];
    out[g] = -paid;
    tithe += paid;
  }
  if (x === 0) out.traders -= DEALS * f.trade * f.otherFaiths * base.traders;
  const court = f.sacred && f.heads["the court"] > 0 ? FAITH_DUES.sacred : 0;
  if (f.heads["the temple"] > 0) out["the temple"] += tithe * (1 - court);
  out["the court"] += tithe * court;
  return out;
}

/** Under each position of the justice law. */
function justiceIncomes(f: LawFacts, base: Incomes, x: number): Incomes {
  const out = zero(),
    courts = COURTS[x]!,
    // (What its officers skim where it settles: one law for all wears it down a step at a time.)
    corruption = dmath.clamp(f.corruption - JUSTICE_DUES.skimFall * (x - 1), 0, 1),
    deals = contractsKept(courts, f.written, corruption, f.capacity, f.trust, f.kinship).kept,
    secure = holdingSecure(seizureRisk({ ...f, corruption }).risk, courts, f.capacity),
    improved = improveTarget(secure, TENURE[position(f.land)]!),
    lostDeals = DEALS * (1 - deals);
  let all = 0;
  for (const g of COMMONS) all += base[g];
  const fees = JUSTICE_DUES.fees * courts * all * (x === 0 ? 0 : 1);
  for (const g of COMMONS) {
    const paidFees = all > 0 ? (fees * base[g]) / all : 0;
    out[g] =
      -paidFees +
      (g === "traders"
        ? -lostDeals * base[g]
        : g === "crafters"
          ? -0.5 * lostDeals * base[g]
          : improved * base[g]);
  }
  // (The fees: the ruler's courts are the court's and those who enforce them; under one law it keeps the less of them. Under
  // custom, the temple judges where its law is sacred.)
  toLords(out, f, fees * (x === 2 ? JUSTICE_DUES.bound : 1), false);
  if (x === 0 && f.sacred && f.heads["the temple"] > 0)
    out["the temple"] += JUSTICE_DUES.fees * COURTS[0]! * all;
  // (And what its officers skim of what the seat takes from its people.)
  if (f.heads["the court"] > 0)
    out["the court"] += JUSTICE_DUES.skim * corruption * dmath.clamp(f.tribute, 0, 1) * all;
  return out;
}

const INCOMES = [landIncomes, strangerIncomes, faithIncomes, justiceIncomes] as const;

/**
 * What each group gains of each position of each law (by law: land, strangers, faith, justice; then group; then position),
 * -1 … 1: what it would have under it against the mean of the three, as a share of what its work brings it, saturating (see
 * the head). A group with no heads in the realm gains nothing either way.
 */
export function lawGains(f: LawFacts): Record<LawGroup, [number, number, number]>[] {
  const base = baseOf(f);
  return INCOMES.map((of) => {
    const by = [of(f, base, 0), of(f, base, 1), of(f, base, 2)],
      out = {} as Record<LawGroup, [number, number, number]>;
    for (const g of LAW_GROUPS) {
      const b = base[g],
        mean = (by[0]![g] + by[1]![g] + by[2]![g]) / 3;
      out[g] =
        b > 0 && f.heads[g] > 0
          ? ([0, 1, 2].map((x) => {
              const v = (LAW_GAIN.scale * (by[x]![g] - mean)) / b;
              return v / (1 + Math.abs(v));
            }) as [number, number, number])
          : [0, 0, 0];
    }
    return out;
  });
}

// The clerks (the last breadth gaps, 2026-11-24: bureaucratic factions). Where a seat's officers keep accounts (its people know
// bureaucracy) and its treasury pays them, they are a group of their own with their own gains: not the land's rent or the tithe,
// but offices, which there are as many of as there is to assess, write down and judge. Under each position of each law, what
// passes through their hands:
//   the land: a lease is a written deal the courts hold to (its rents); the lord's land is held by his arms and the tiller's
//     own owes no one, so neither keeps an office;
//   strangers: the dues of those who are no citizens are assessed head by head (who is a stranger is on a roll);
//   faith: the tithe is the temple's to gather, and the seat's officers' only where its law is sacred (the court's share of it);
//   justice: the fees of its courts, as far as they reach (theirs whole: a court's fees are its officers' living); and of what is skimmed between the lands and the seat where each
//     position settles, the part that sticks to those who hold the pens (one law for all binds them too).
// Of rents, dues and tithes, keeping the offices takes OFFICE.keeps; the clerks want a position as far as what it would keep them, against
// the mean of the three, is of what the treasury pays them now, saturating as every group's gain does. So they are for
// written courts and rolls of strangers and against the reforms that close their offices; and where their skim is more than
// their fees they stand against the one law that would end it.
export const OFFICE = {
  /** Of what its officers assess, write and judge, what keeping the offices that do it takes (est: a tenth, what gathering a due cost the old states). */
  keeps: 0.1,
  /** Of what is skimmed between the lands and the seat, the share that sticks to those who keep the accounts (the rest: the court's). */
  skim: 0.5,
} as const;

/**
 * What the clerks of a realm gain of each position of each law (by law, then position; -1 … 1), `paid` being what its treasury
 * pays them a year (grain's worth, as `f.pay`). Nothing where it pays none.
 */
export function clerkGains(f: LawFacts, paid: number): [number, number, number][] {
  if (!(paid > 0)) return INCOMES.map(() => [0, 0, 0]);
  const base = baseOf(f);
  let all = 0;
  for (const g of COMMONS) all += base[g];
  const tribute = dmath.clamp(f.tribute, 0, 1),
    handled: [number, number, number][] = [
      [0, landRent(f, base, 1), 0],
      [f.foreign + f.unbelief - f.foreign * f.unbelief, f.unbelief, 0].map(
        (payers) => STRANGER.dues * payers * all,
      ) as [number, number, number],
      (f.faith && f.sacred
        ? [1, 1 - f.unbelief, (1 - f.unbelief) * dmath.clamp(f.piety, 0, 1)].map(
            (payers) => FAITH_DUES.tithe * payers * all * FAITH_DUES.sacred,
          )
        : [0, 0, 0]) as [number, number, number],
      [0, 1, 2].map((x) => JUSTICE_DUES.fees * COURTS[x]! * all * (x === 0 ? 0 : 1)) as [
        number,
        number,
        number,
      ],
    ],
    skim = [0, 1, 2].map(
      (x) =>
        OFFICE.skim *
        JUSTICE_DUES.skim *
        dmath.clamp(f.corruption - JUSTICE_DUES.skimFall * (x - 1), 0, 1) *
        tribute *
        all,
    );
  return handled.map((h, law) => {
    const has = h.map((v, x) => (law === 3 ? v + skim[x]! : OFFICE.keeps * v)),
      mean = (has[0]! + has[1]! + has[2]!) / 3;
    return has.map((v) => {
      const g = (LAW_GAIN.scale * (v - mean)) / paid;
      return g / (1 + Math.abs(g));
    }) as [number, number, number];
  });
}
