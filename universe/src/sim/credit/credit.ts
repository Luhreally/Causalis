// Credit (Phase 21 M143, asked for 2026-10-23: "debt, credit, banking" in the first-principles
// document, "debt bondage" in the politics one). Credit is a promise to pay later, made good by
// writing and reckoning, and by trust. Where a market town knows lending and has traders enough,
// a house of lending rises — named for the family that keeps it — and what it may lend is what
// it holds, a few times over, so long as its own land keeps half a year's food. In a hungry year
// a land of its realm borrows grain to eat (or of a realm that knows its own and is not at war
// with it, dearer), carried from the house's town, and pays it back from
// its later harvests with interest: fewer die of the famine, but a land that cannot pay sinks
// into debt, and its poor into bondage. A debt no land will ever pay is written off at last; a
// house that loses more than it holds fails — its town's savers with it — and every house lends
// dearer for a while. Every house, loan, loss and failure is a decision or an event whose causes
// say why.
import {
  YEAR,
  defineEventType,
  defineKind,
  defineStream,
  yearOfMoment,
  type Factor,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { cellRef, tonguePersonName } from "../../gen/index.ts";
import { FOODS, G, OCC } from "../../rules/index.ts";
import { marketsOf, mouths, type PopulationContext } from "../population/systems.ts";
import type { Market } from "../economy/market.ts";
import { loreOf } from "../lore/lore.ts";
import { WAY, cultureOf, pushWays } from "../culture/culture.ts";
import { politiesOf, realmName } from "../polity/polity.ts";
import { diplomacyOf } from "../diplomacy/diplomacy.ts";
import { warsOf } from "../war/war.ts";

export const HOUSE = defineKind("house", "a house of lending", "minted");

export const CREDIT_EVENTS = {
  founded: defineEventType("credit.founded", 5),
  lent: defineEventType("credit.lent", 3),
  lost: defineEventType("credit.lost", 3),
  failed: defineEventType("credit.failed", 6),
};

/** How credit is given, paid and lost (people, shares, years, months). */
export const CREDIT = {
  /** A house rises in a market town that knows lending, so peopled, with so many traders in its
   * land — at this chance a year, at most so many standing in the world. */
  town: 4000,
  traders: 100,
  rise: 0.03,
  most: 24,
  /** What a house starts with: this share of the grain its land holds above a year's food. */
  stake: 0.3,
  /** It lends up to so many times what it holds, keeping its own land so many months of food. */
  leverage: 3,
  reserve: 6,
  /** A year's interest, before a borrower's past losses and a crisis's dearness. */
  rate: 0.08,
  /** A land that cost its lenders before is lent dearer, by this, for each loss. */
  risk: 0.04,
  /** A land of another realm is lent dearer by this: a stranger's risk; a land of no realm on
   * a lending realm's border, by this: no realm to answer for it. */
  abroad: 0.04,
  unruled: 0.08,
  /** And its realm remembers the grain lent in its famine, kindly, by this. */
  kindness: 0.1,
  /** For so many years after a house fails, every house lends dearer by this. */
  crisis: 10,
  dearer: 0.06,
  /** A hungry land borrows to bring its food in store to so many months. */
  months: 3,
  /** Of a land's food made in a year, at most this share goes to its lenders; never what
   * would leave it under so many months of food. */
  repay: 0.12,
  keep: 3,
  /** A debt above this share of a year's food made is crushing: no house lends more. */
  crushing: 0.5,
  /** A debt unpaid so many years is written off. */
  forgotten: 30,
  /** Loans ended are kept for so many years for the pages. */
  kept: 60,
} as const;

/** Grain lent to a land: by whom, when and why, at what interest, and what it owes now. */
export type Loan = {
  readonly id: number;
  readonly house: Ref;
  readonly cell: number;
  readonly year: number;
  readonly event: Ref;
  readonly lent: number;
  readonly rate: number;
  owed: number;
  paid: number;
  /** The year it was paid off, written off, or forgiven (its house failed), and how. */
  ended: number | null;
  end: "paid" | "lost" | "forgiven" | null;
  endEvent: Ref | null;
};

/** A house of lending: its family's name, its town, what it holds, what it earned and lost. */
export type House = {
  readonly ref: Ref;
  readonly name: string;
  readonly town: Ref;
  readonly cell: number;
  readonly year: number;
  readonly event: Ref;
  /** What it holds of its own (grain's worth): its stake, and what it earned, less what it lost. */
  capital: number;
  readonly stake: number;
  earned: number;
  lost: number;
  /** Grain lent, ever. */
  lentEver: number;
  failed: number | null;
  failedEvent: Ref | null;
};

export class CreditStore implements StateStore {
  readonly name = "credit.houses";
  houses: House[] = [];
  loans: Loan[] = [];
  count = 0;
  /** The last failure of a house, which made all lend dearer for a while. */
  crisis: { year: number; event: Ref } | null = null;
  failures = 0;
  /** Each year's grain owed to the houses, and lent that year (the ledger's chart). */
  years: { year: number; owed: number; lent: number }[] = [];

  house(ref: Ref | string): House | undefined {
    return this.houses.find((h) => h.ref === ref);
  }
  houseIn(town: Ref | string): House | undefined {
    return this.houses.find((h) => h.town === town && h.failed === null);
  }
  standing(): House[] {
    return this.houses.filter((h) => h.failed === null);
  }
  open(): Loan[] {
    return this.loans.filter((l) => l.ended === null);
  }
  /** What a land owes its lenders now, and its greatest open loan. */
  owedBy(cell: number): { owed: number; loan: Loan | null } {
    let owed = 0,
      loan: Loan | null = null;
    for (const l of this.loans)
      if (l.ended === null && l.cell === cell) {
        owed += l.owed;
        if (!loan || l.owed > loan.owed) loan = l;
      }
    return { owed, loan };
  }
  /** What is owed to a house now. */
  outstanding(house: Ref): number {
    let n = 0;
    for (const l of this.loans) if (l.ended === null && l.house === house) n += l.owed;
    return n;
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const h of this.houses) {
      out.push(h.event);
      if (h.failedEvent) out.push(h.failedEvent);
    }
    for (const l of this.loans) {
      out.push(l.event);
      if (l.endEvent) out.push(l.endEvent);
    }
    if (this.crisis) out.push(this.crisis.event);
    return out;
  }
  save(): unknown {
    return {
      houses: this.houses,
      loans: this.loans,
      count: this.count,
      crisis: this.crisis,
      failures: this.failures,
      years: this.years,
    };
  }
  hashInto(h: Hasher): void {
    h.value(this.save());
  }
  load(state: unknown): void {
    const s = state as {
      houses: House[];
      loans: Loan[];
      count: number;
      crisis: { year: number; event: Ref } | null;
      failures: number;
      years: { year: number; owed: number; lent: number }[];
    };
    this.houses = s.houses.map((h) => ({ ...h }));
    this.loans = s.loans.map((l) => ({ ...l }));
    this.count = s.count;
    this.crisis = s.crisis ? { ...s.crisis } : null;
    this.failures = s.failures;
    this.years = s.years.map((y) => ({ ...y }));
  }
}

export function creditOf(world: World): CreditStore | null {
  return world.hasStore("credit.houses") ? world.store<CreditStore>("credit.houses") : null;
}

/** The food a land made in its last year closed: its grain, its game and its gathering. */
function foodMade(m: Market | undefined): number {
  const made = m?.years.at(-1)?.ledger[0];
  let n = 0;
  if (made) for (const g of FOODS) n += made[g] ?? 0;
  return n;
}

/** What a land owes, against a year's food it makes (0: none; 1: a year's food). */
export function debtBurden(ctx: PopulationContext, cell: number): number {
  const owed = creditOf(ctx.world)?.owedBy(cell).owed ?? 0;
  if (owed <= 0) return 0;
  return owed / Math.max(1, foodMade(marketsOf(ctx.world).get(cell)));
}

const RISE = defineStream("credit.rise");
/** The foods a debt is paid in, the first first. */
const PAID_IN = [G.grain, G.wild, G.meat] as const;

/** What a house may lend now: what it holds a few times over, less what is out, and never its land's last half-year of food. */
export function lendable(ctx: PopulationContext, store: CreditStore, h: House): number {
  if (h.failed !== null || h.capital <= 0) return 0;
  const m = marketsOf(ctx.world).get(h.cell),
    prov = ctx.provinces.get(h.cell);
  if (!m || !prov) return 0;
  const room = CREDIT.leverage * h.capital - store.outstanding(h.ref),
    spare = m.stock[G.grain]! - Math.ceil(CREDIT.reserve * mouths(prov, ctx.life));
  return Math.max(0, Math.floor(Math.min(room, spare)));
}

/** How dear a house lends to a land: the rate, its past losses there, a crisis on. */
export function rateFor(store: CreditStore, cell: number, year: number): number {
  const lost = store.loans.filter((l) => l.cell === cell && l.end === "lost").length,
    crisis = store.crisis && year - store.crisis.year < CREDIT.crisis;
  return CREDIT.rate + CREDIT.risk * Math.min(3, lost) + (crisis ? CREDIT.dearer : 0);
}

/** A loan ends: paid, written off (its house loses what was owed), or forgiven. */
function endLoan(store: CreditStore, l: Loan, year: number, end: Loan["end"], event: Ref | null) {
  if (end === "lost") {
    const h = store.house(l.house)!;
    h.capital -= l.owed;
    h.lost += l.owed;
  }
  l.ended = year;
  l.end = end;
  l.endEvent = event;
}

/** A house fails: what was owed it forgiven, its town's savers ruined, every house dearer for a while. */
function fail(ctx: PopulationContext, store: CreditStore, h: House, cause: Ref, year: number) {
  const { world } = ctx,
    event = world.events.emit({
      type: CREDIT_EVENTS.failed.type,
      subjects: [h.ref],
      place: ctx.provinces.get(h.cell)?.ref ?? cellRef(0, h.cell),
      causes: [{ ref: cause, role: "trigger", weight: 1 }],
      data: { name: h.name, lost: Math.round(h.lost), owed: Math.round(store.outstanding(h.ref)) },
    });
  h.failed = year;
  h.failedEvent = event;
  for (const l of store.loans)
    if (l.ended === null && l.house === h.ref) endLoan(store, l, year, "forgiven", event);
  store.failures++;
  store.crisis = { year, event };
  // Its town's savers ruined: their grievance against their realm, and their thrift ever after.
  const realms = politiesOf(world),
    before = realms.discontent(h.cell);
  realms.setDiscontent(h.cell, { level: Math.max(before.level, 0.5), cause: event });
  const ways = cultureOf(world).get(h.cell);
  if (ways) pushWays(ways, { event, year, trait: WAY.thrift, amount: 0.05 });
}

/** The yearly work of credit: interest and payment, losses and failures, new houses, new loans. */
export function creditYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = creditOf(world)!,
    year = yearOfMoment(t),
    markets = marketsOf(world),
    lore = loreOf(world),
    realms = politiesOf(world);
  // 1. Interest, and payment from the harvest: a land pays what it can, in food of any kind — at
  // most a share of its food made, never what would leave it hungry. A debt unpaid a generation
  // is written off.
  for (const l of store.loans) {
    if (l.ended !== null) continue;
    const h = store.house(l.house)!,
      m = markets.get(l.cell),
      hm = markets.get(h.cell),
      prov = ctx.provinces.get(l.cell);
    const interest = l.owed * l.rate;
    l.owed += interest;
    h.capital += interest;
    h.earned += interest;
    if (m && hm && prov && prov.total() > 0) {
      const spare = m.food(FOODS) - Math.ceil(CREDIT.keep * mouths(prov, ctx.life)),
        pay = Math.floor(Math.max(0, Math.min(l.owed, CREDIT.repay * foodMade(m), spare)));
      // (Grain first, then what was gathered, then game.)
      let left = pay;
      for (const g of PAID_IN) {
        const n = Math.min(left, m.stock[g]!);
        if (n > 0) hm.move("in", g, m.move("out", g, n));
        left -= n;
      }
      l.owed -= pay;
      l.paid += pay;
    }
    if (l.owed < 1) endLoan(store, l, year, "paid", null);
    else if (year - l.year >= CREDIT.forgotten || !prov || prov.total() <= 0) {
      const lost = world.events.emit({
        type: CREDIT_EVENTS.lost.type,
        subjects: [h.ref],
        place: prov?.ref ?? cellRef(0, l.cell),
        causes: [{ ref: l.event, role: "trigger", weight: 1 }],
        data: { name: h.name, owed: Math.round(l.owed), years: year - l.year },
      });
      endLoan(store, l, year, "lost", lost);
    }
  }
  // 2. A house that lost more than it holds fails.
  for (const h of store.standing())
    if (h.capital < 0) {
      const last = store.loans
        .filter((l) => l.house === h.ref && l.end === "lost" && l.endEvent)
        .sort((a, b) => b.ended! - a.ended! || b.id - a.id)[0];
      fail(ctx, store, h, last?.endEvent ?? h.event, year);
    }
  // 3. Houses rise in market towns that know lending, with traders enough and grain to spare.
  if (store.standing().length < CREDIT.most) {
    const towns = ctx.settlements
      .all()
      .filter((s) => s.market !== null && s.population >= CREDIT.town && !store.houseIn(s.ref))
      .sort((a, b) => (a.ref < b.ref ? -1 : 1));
    for (const s of towns) {
      if (store.standing().length >= CREDIT.most) break;
      const banking = lore.get(s.cell, "banking"),
        prov = ctx.provinces.get(s.cell),
        m = markets.get(s.cell),
        ways = cultureOf(world).get(s.cell);
      if (!banking || !prov || !m || !ways) continue;
      const traders = prov.occupation(OCC.trader);
      if (traders < CREDIT.traders) continue;
      const stake = Math.floor(
        CREDIT.stake * (m.stock[G.grain]! - Math.ceil(12 * mouths(prov, ctx.life))),
      );
      if (stake <= 0) continue;
      const key = Number(s.ref.split(":")[2]);
      if (world.rng.real(RISE, key, t, 0) >= CREDIT.rise) continue;
      const coin = lore.get(s.cell, "currency"),
        factors: Factor[] = [
          {
            name: "they know lending",
            value: 1,
            contribution: CREDIT.rise,
            source: { ref: banking.event, role: "enabler", weight: 1 },
          },
          {
            name: "a market town",
            value: s.population,
            contribution: 0,
            source: { ref: s.market!, role: "enabler", weight: 1 },
          },
          { name: "its traders", value: traders, contribution: 0, source: null },
          { name: "grain to spare", value: stake, contribution: 0, source: null },
          ...(coin
            ? [
                {
                  name: "coin",
                  value: 1,
                  contribution: 0,
                  source: { ref: coin.event, role: "enabler" as const, weight: 1 },
                },
              ]
            : []),
        ],
        decision = world.decisions.record({
          rule: "credit.found",
          subject: s.ref,
          outcome: { town: s.name },
          score: CREDIT.rise,
          threshold: 0,
          factors,
        }),
        ref = world.minter.mint(HOUSE),
        name = `the house of ${tonguePersonName(ways.tongue, key, 1)}`,
        event = world.events.emit({
          type: CREDIT_EVENTS.founded.type,
          subjects: [ref, s.ref],
          place: prov.ref,
          causes: [{ ref: decision, role: "trigger", weight: 1 }],
          data: { name, town: s.name, stake },
        });
      store.houses.push({
        ref,
        name,
        town: s.ref,
        cell: s.cell,
        year,
        event,
        capital: stake,
        stake,
        earned: 0,
        lost: 0,
        lentEver: 0,
        failed: null,
        failedEvent: null,
      });
    }
  }
  // 4. The hungry borrow: a land in a famine borrows grain to bring its food to three months — a
  // land of a realm from a house of its realm, else from one of a realm that knows its own and is
  // at peace with it; a land of no realm from one of a realm on its border — unless it already
  // owes more than it can pay.
  let lentNow = 0;
  const standing = store.standing(),
    wars = warsOf(world),
    diplomacy = diplomacyOf(world);
  if (standing.length)
    for (const prov of [...ctx.provinces.all()].sort((a, b) => a.cell - b.cell)) {
      const famine = prov.lastFamine ? world.events.get(prov.lastFamine) : undefined;
      if (!famine || yearOfMoment(famine.t) < year - 1 || prov.total() <= 0) continue;
      const m = markets.get(prov.cell),
        ruler = realms.of(prov.cell),
        realm = ruler && ruler.ended === null ? ruler : null;
      if (!m) continue;
      const need = Math.ceil(CREDIT.months * mouths(prov, ctx.life) - m.food(FOODS));
      if (need <= 0) continue;
      const burden = debtBurden(ctx, prov.cell);
      if (burden >= CREDIT.crushing) continue;
      // The house with the most to lend (not its own land's: its grain is here already), of its
      // realm first; else of a realm that knows its own, not at war with it, at a stranger's risk;
      // for a land of no realm, of a realm on its border, dearer still.
      const border = realm ? null : bordering(ctx, prov.cell);
      if (border && !border.size) continue;
      let best: House | null = null,
        most = 0,
        abroad = false;
      for (const far of [false, true]) {
        for (const h of standing) {
          const theirs = realms.of(h.cell);
          if (h.cell === prov.cell || !theirs || theirs.ended !== null) continue;
          if (!realm) {
            if (!far || !border!.has(theirs.ref)) continue;
          } else if ((theirs.ref !== realm.ref) !== far) continue;
          else if (far) {
            const known = diplomacy.get(theirs.ref, realm.ref);
            if (!known || known.opinion < 0 || wars.between(theirs.ref, realm.ref)) continue;
          }
          const can = lendable(ctx, store, h);
          if (can > most || (can === most && best && h.ref < best.ref)) [best, most] = [h, can];
        }
        if (best) {
          abroad = far;
          break;
        }
      }
      if (!best || most <= 0) continue;
      const amount = Math.min(need, most);
      if (amount < 20) continue;
      const lender = realms.of(best.cell)!,
        hm = markets.get(best.cell)!,
        risk = !abroad ? 0 : realm ? CREDIT.abroad : CREDIT.unruled,
        rate = rateFor(store, prov.cell, year) + risk,
        owing = store.owedBy(prov.cell),
        crisis = store.crisis && year - store.crisis.year < CREDIT.crisis ? store.crisis : null,
        hunger = Math.min(1, need / Math.max(1, CREDIT.months * mouths(prov, ctx.life))),
        decision = world.decisions.record({
          rule: "credit.lend",
          subject: prov.ref,
          outcome: { house: best.ref, grain: amount, rate: Math.round(rate * 1000) / 1000 },
          score: hunger,
          threshold: 0,
          factors: [
            {
              name: "hunger",
              value: hunger,
              contribution: hunger,
              source: { ref: famine.id, role: "trigger", weight: 1 },
            },
            {
              name: !abroad
                ? "a house of lending in its realm"
                : realm
                  ? "a house of lending abroad"
                  : "a house of lending over its border",
              value: most,
              contribution: 0,
              source: { ref: best.event, role: "enabler", weight: 1 },
            },
            ...(abroad
              ? [
                  {
                    name: realm ? "a stranger's risk" : "no realm to answer for it",
                    value: risk,
                    contribution: -risk,
                    source: null,
                  },
                ]
              : []),
            {
              name: "what they owe already",
              value: Math.round(owing.owed),
              contribution: -burden,
              source: owing.loan ? { ref: owing.loan.event, role: "constraint", weight: 1 } : null,
            },
            { name: "the interest asked", value: rate, contribution: -rate, source: null },
            ...(crisis
              ? [
                  {
                    name: "credit dear since a house failed",
                    value: CREDIT.dearer,
                    contribution: -CREDIT.dearer,
                    source: { ref: crisis.event, role: "constraint" as const, weight: 1 },
                  },
                ]
              : []),
          ],
        });
      m.move("in", G.grain, hm.move("out", G.grain, amount));
      const event = world.events.emit({
        type: CREDIT_EVENTS.lent.type,
        subjects: [best.ref, prov.ref],
        place: prov.ref,
        causes: [{ ref: decision, role: "trigger", weight: 1 }],
        data: {
          name: best.name,
          grain: amount,
          rate: Math.round(rate * 100),
          ...(abroad ? { abroad: realmName(lender) } : {}),
        },
      });
      // Lent from abroad, its realm remembers it kindly.
      if (abroad && realm)
        diplomacy.remember(realm.ref, lender.ref, {
          name: "grain lent in a famine",
          value: CREDIT.kindness,
          year,
          source: event,
        });
      store.loans.push({
        id: store.count++,
        house: best.ref,
        cell: prov.cell,
        year,
        event,
        lent: amount,
        rate,
        owed: amount,
        paid: 0,
        ended: null,
        end: null,
        endEvent: null,
      });
      best.lentEver += amount;
      lentNow += amount;
    }
  // 5. The year's owing and lending kept; loans long ended let go.
  store.years.push({
    year,
    owed: Math.round(store.open().reduce((a, l) => a + l.owed, 0)),
    lent: lentNow,
  });
  if (store.years.length > 400) store.years.shift();
  store.loans = store.loans.filter((l) => l.ended === null || year - l.ended < CREDIT.kept);
}

/** The realms of the lands about a land. */
function bordering(ctx: PopulationContext, cell: number): Set<Ref> {
  const g = ctx.generated,
    realms = politiesOf(ctx.world),
    out = new Set<Ref>();
  for (let k = g.grid.offsets[cell]!; k < g.grid.offsets[cell + 1]!; k++) {
    const p = realms.of(g.grid.neighbours[k]!);
    if (p && p.ended === null) out.add(p.ref);
  }
  return out;
}

/** Teach a peopled world credit. */
export function installCredit(world: World, ctx: () => PopulationContext): CreditStore {
  const store = world.register(new CreditStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "189.credit.year", every: YEAR, run: (t) => creditYear(ctx(), t) });
  return store;
}
