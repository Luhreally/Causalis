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
// dearer for a while. (M144) A realm at war borrows to pay its host — a war chest, and its host
// fights the harder for it — and a realm fallen, or beaten and crushed by what it owes for the
// war, repudiates the debt: its lender bears it, and the realm is held faithless. A realm whose
// people are crushed by debt may proclaim a jubilee, releasing every debt its lands owe; the god
// may forgive a land its debts, or break a house. Every house, loan, loss and failure is a
// decision or an event whose causes say why.
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
import { LAW, POLITY_EVENTS, politiesOf, realmName } from "../polity/polity.ts";
import { diplomacyOf } from "../diplomacy/diplomacy.ts";
import { fieldedOf, warsOf, type War } from "../war/war.ts";
import { BOND, orderOf } from "../order/order.ts";

export const HOUSE = defineKind("house", "a house of lending", "minted");

export const CREDIT_EVENTS = {
  founded: defineEventType("credit.founded", 5),
  lent: defineEventType("credit.lent", 3),
  lost: defineEventType("credit.lost", 3),
  failed: defineEventType("credit.failed", 6),
  /** A realm's war chest: grain lent it to pay its host (M144). */
  chest: defineEventType("credit.chest", 4),
  /** A realm repudiates what it owes for a war. */
  defaulted: defineEventType("credit.defaulted", 6),
  /** A realm releases every debt its lands owe. */
  jubilee: defineEventType("credit.jubilee", 6),
};

/** The god's hand on credit (M144): a land's debts forgiven; a house of lending broken. */
export const CREDIT_ACTS = {
  forgive: defineEventType("act.forgive", 5),
  break: defineEventType("act.break", 5),
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
  /** A realm at war borrows for its host (M144): so many months of food for the men it fields,
   * dearer by this for war's risk; a host paid from a war chest fights the harder by this, and
   * is not slowed by its lands' hunger. */
  season: 3,
  war: 0.04,
  chest: 1.15,
  /** A realm that repudiated a debt is held faithless so many years: none lends it for a war,
   * and its lands are lent dearer. */
  faithless: 20,
  /** At a new ruler's coming, a realm whose lands owe the houses, or whose people are bound for
   * debt, may proclaim a jubilee, at this chance (more under a sacred law, the more its people are
   * bound or aggrieved; less where houses of lending stand in its lands); its lands' debt-bound go
   * free, so many of them. */
  release: 0.08,
  freed: 0.5,
  /** A house's family draws each year this share of what it holds above so many times its stake:
   * a house grows, but not without end — and a great loss can break it. */
  drawn: 0.2,
  cushion: 2,
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
  /** The year it ended, and how: paid off, written off, forgiven (its house failed),
   * repudiated (its realm refused it, M144), or released (a jubilee, or the god). */
  ended: number | null;
  end: "paid" | "lost" | "forgiven" | "repudiated" | "released" | null;
  endEvent: Ref | null;
  /** A war loan's war, and the realm that borrowed (M144); a famine loan has neither. */
  readonly war?: Ref;
  readonly realm?: Ref;
};

/** A loan whose end its house bore: written off, repudiated, or released. */
const BORNE: ReadonlySet<Loan["end"]> = new Set(["lost", "repudiated", "released"]);

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
  /** What its family drew from it, ever (M144). */
  drawn: number;
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
  /** Each realm's repudiations, and each jubilee proclaimed (M144). */
  defaults: { realm: Ref; year: number; event: Ref }[] = [];
  jubilees: { realm: Ref; year: number; event: Ref }[] = [];

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
  /** The loan a realm took to pay its host in a war (its war chest), if it took one. */
  chest(realm: Ref, war: Ref): Loan | undefined {
    return this.loans.find((l) => l.war === war && l.realm === realm);
  }
  /** A realm's last repudiation, if it is held faithless for it still. */
  faithless(realm: Ref, year: number): { year: number; event: Ref } | null {
    return (
      this.defaults.findLast((d) => d.realm === realm && year - d.year < CREDIT.faithless) ?? null
    );
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
    for (const d of this.defaults) out.push(d.event);
    for (const j of this.jubilees) out.push(j.event);
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
      defaults: this.defaults,
      jubilees: this.jubilees,
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
      defaults?: { realm: Ref; year: number; event: Ref }[];
      jubilees?: { realm: Ref; year: number; event: Ref }[];
    };
    this.houses = s.houses.map((h) => ({ ...h }));
    this.loans = s.loans.map((l) => ({ ...l }));
    this.count = s.count;
    this.crisis = s.crisis ? { ...s.crisis } : null;
    this.failures = s.failures;
    this.years = s.years.map((y) => ({ ...y }));
    this.defaults = (s.defaults ?? []).map((d) => ({ ...d }));
    this.jubilees = (s.jubilees ?? []).map((j) => ({ ...j }));
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
const JUBILEE = defineStream("credit.jubilee");
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

/**
 * How dear a house lends to a land: the rate, its past losses there (and its realm's faith broken
 * lately, as two), a crisis on.
 */
export function rateFor(
  store: CreditStore,
  cell: number,
  year: number,
  realm: Ref | null = null,
): number {
  const lost = store.loans.filter((l) => l.cell === cell && BORNE.has(l.end)).length,
    faithless = realm && store.faithless(realm, year) ? 2 : 0,
    crisis = store.crisis && year - store.crisis.year < CREDIT.crisis;
  return CREDIT.rate + CREDIT.risk * Math.min(3, lost + faithless) + (crisis ? CREDIT.dearer : 0);
}

/** A realm's war chest for a war (M144): the event of the loan it took to pay its host, if any. */
export function warChest(world: World, realm: Ref, war: Ref): Ref | null {
  return creditOf(world)?.chest(realm, war)?.event ?? null;
}

/** A loan ends: paid; written off, repudiated or released (its house loses what was owed); or forgiven. */
function endLoan(store: CreditStore, l: Loan, year: number, end: Loan["end"], event: Ref | null) {
  if (BORNE.has(end)) {
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

/**
 * The yearly work of credit: interest and payment, losses, repudiations, jubilees and failures,
 * new houses, new loans against famine and for war.
 */
export function creditYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = creditOf(world)!,
    year = yearOfMoment(t),
    markets = marketsOf(world),
    lore = loreOf(world),
    realms = politiesOf(world),
    wars = warsOf(world),
    diplomacy = diplomacyOf(world);
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
  // 2. A realm fallen, or beaten in the war it borrowed for and crushed by what it owes for it,
  // repudiates the debt (M144): its lender bears it, and the realm is held faithless.
  for (const l of store.loans) {
    if (l.ended !== null || !l.realm) continue;
    const p = realms.get(l.realm),
      w = l.war ? wars.get(l.war) : undefined,
      fallen = !p || p.ended !== null,
      beaten = !!w && w.ended !== null && lostWar(world, w, l.realm);
    if (!fallen && !(beaten && debtBurden(ctx, l.cell) >= CREDIT.crushing)) continue;
    const h = store.house(l.house)!,
      why = (fallen ? fallOf(world, l.realm) : null) ?? w?.peace ?? l.event,
      event = world.events.emit({
        type: CREDIT_EVENTS.defaulted.type,
        subjects: [l.realm, h.ref],
        place: ctx.provinces.get(l.cell)?.ref ?? cellRef(0, l.cell),
        causes: [
          { ref: why, role: "trigger", weight: 1 },
          { ref: l.event, role: "enabler", weight: 1 },
        ],
        data: {
          name: h.name,
          realm: p ? realmName(p) : "a fallen realm",
          owed: Math.round(l.owed),
          fallen,
        },
      });
    endLoan(store, l, year, "repudiated", event);
    store.defaults.push({ realm: l.realm, year, event });
    // (The lender's realm remembers it.)
    const theirs = realms.of(h.cell);
    if (p && theirs && theirs.ref !== p.ref)
      diplomacy.remember(p.ref, theirs.ref, {
        name: "debts repudiated",
        value: -0.3,
        year,
        source: event,
      });
  }
  // 3. A jubilee (M144): at a new ruler's coming, a realm whose lands owe the houses or whose
  // people are bound for debt may release every debt its lands owe — likelier under a sacred law,
  // the more its people are bound, crushed or aggrieved, the less where houses of lending stand in
  // its lands. Its houses bear it, and many of its debt-bound go free.
  const order = orderOf(world);
  for (const p of [...realms.living()].sort((a, b) => (a.ref < b.ref ? -1 : 1))) {
    if (year - p.ruler.since > 1) continue;
    let people = 0,
      crushed = 0,
      bound = 0,
      grievance = 0,
      loan: Loan | null = null;
    for (const c of p.members) {
      const n = ctx.provinces.get(c)?.total() ?? 0;
      people += n;
      grievance += n * Math.min(1, realms.discontent(c).level);
      bound += n * (order?.lands.get(c)?.shares[BOND.debt] ?? 0);
      const owing = store.owedBy(c).loan;
      if (owing && (!loan || owing.owed > loan.owed)) loan = owing;
      if (n > 0 && owing && debtBurden(ctx, c) >= CREDIT.crushing) crushed += n;
    }
    if (!loan && bound < 1) continue;
    const all = Math.max(1, people),
      sacred = p.law === LAW.indexOf("the sacred") ? 1 : 0,
      aggrieved = grievance / all,
      held = Math.min(1, 20 * (bound / all) + crushed / all),
      sway = store.standing().some((h) => p.members.includes(h.cell)) ? 1 : 0,
      chance = CREDIT.release * Math.max(0, 0.5 + sacred + aggrieved + held - 0.5 * sway);
    if (world.rng.real(JUBILEE, Number(p.ref.split(":")[2]), t, 0) >= chance) continue;
    const members = new Set(p.members),
      owed = store.loans.reduce(
        (a, l) => a + (l.ended === null && members.has(l.cell) ? l.owed : 0),
        0,
      ),
      decision = world.decisions.record({
        rule: "credit.jubilee",
        subject: p.ref,
        outcome: { owed: Math.round(owed), bound: Math.round(bound) },
        score: chance,
        threshold: 0,
        factors: [
          {
            name: "a new ruler",
            value: year - p.ruler.since,
            contribution: CREDIT.release * 0.5,
            source: { ref: p.ruler.event, role: "trigger", weight: 1 },
          },
          {
            name: "its people bound or crushed by debt",
            value: held,
            contribution: CREDIT.release * held,
            source: loan ? { ref: loan.event, role: "pressure", weight: 1 } : null,
          },
          {
            name: "a sacred law",
            value: sacred,
            contribution: CREDIT.release * sacred,
            source: null,
          },
          {
            name: "its people's grievance",
            value: aggrieved,
            contribution: CREDIT.release * aggrieved,
            source: null,
          },
          {
            name: "houses of lending in its lands",
            value: sway,
            contribution: -CREDIT.release * 0.5 * sway,
            source: null,
          },
        ],
      }),
      event = world.events.emit({
        type: CREDIT_EVENTS.jubilee.type,
        subjects: [p.ref],
        place: ctx.provinces.get(p.seat)?.ref ?? cellRef(0, p.seat),
        causes: [{ ref: decision, role: "trigger", weight: 1 }],
        data: {
          realm: realmName(p),
          owed: Math.round(owed),
          freed: Math.round(bound * CREDIT.freed),
        },
      });
    for (const l of store.loans)
      if (l.ended === null && members.has(l.cell)) endLoan(store, l, year, "released", event);
    store.jubilees.push({ realm: p.ref, year, event });
    freeTheBound(world, p.members, event);
  }
  // 4. A house that lost more than it holds fails.
  for (const h of store.standing())
    if (h.capital < 0) {
      const last = store.loans
        .filter((l) => l.house === h.ref && BORNE.has(l.end) && l.endEvent)
        .sort((a, b) => b.ended! - a.ended! || b.id - a.id)[0];
      fail(ctx, store, h, last?.endEvent ?? h.event, year);
    }
  // 5. Houses rise in market towns that know lending, with traders enough and grain to spare.
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
        drawn: 0,
        lentEver: 0,
        failed: null,
        failedEvent: null,
      });
    }
  }
  // 6. The hungry borrow: a land in a famine borrows grain to bring its food to three months — a
  // land of a realm from a house of its realm, else from one of a realm that knows its own and is
  // at peace with it; a land of no realm from one of a realm on its border — unless it already
  // owes more than it can pay.
  let lentNow = 0;
  const standing = store.standing();
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
        rate = rateFor(store, prov.cell, year, realm?.ref ?? null) + risk,
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
  // 7. A realm at war borrows to pay its host (M144): a season's food for the men it fields, from a
  // house of its realm, else of a realm that knows it and is not at war with it (never its
  // enemy's) — unless it broke faith with its lenders lately, or owes more than it can pay.
  if (standing.length)
    for (const p of [...realms.living()].sort((a, b) => (a.ref < b.ref ? -1 : 1))) {
      const fighting = wars.fighting(p.ref),
        sm = markets.get(p.seat),
        seat = ctx.provinces.get(p.seat);
      if (!fighting.length || !sm || !seat || store.faithless(p.ref, year)) continue;
      for (const w of fighting) {
        if (store.chest(p.ref, w.ref)) continue;
        const burden = debtBurden(ctx, p.seat);
        if (burden >= CREDIT.crushing) continue;
        const men = fieldedOf(ctx, p),
          want = Math.ceil(CREDIT.season * men * ctx.life.appetite),
          enemy = w.attacker === p.ref ? w.defender : w.attacker;
        if (want < 50) continue;
        let best: House | null = null,
          most = 0,
          abroad = false;
        for (const far of [false, true]) {
          for (const h of standing) {
            const theirs = realms.of(h.cell);
            if (!theirs || theirs.ended !== null || theirs.ref === enemy) continue;
            if ((theirs.ref !== p.ref) !== far) continue;
            if (far) {
              const known = diplomacy.get(theirs.ref, p.ref);
              if (!known || known.opinion < 0 || wars.between(theirs.ref, p.ref)) continue;
            }
            const can = lendable(ctx, store, h);
            if (can > most || (can === most && best && h.ref < best.ref)) [best, most] = [h, can];
          }
          if (best) {
            abroad = far;
            break;
          }
        }
        if (!best || most < 50) continue;
        const amount = Math.min(want, most),
          lender = realms.of(best.cell)!,
          hm = markets.get(best.cell)!,
          risk = CREDIT.war + (abroad ? CREDIT.abroad : 0),
          rate = rateFor(store, p.seat, year, p.ref) + risk,
          owing = store.owedBy(p.seat),
          decision = world.decisions.record({
            rule: "credit.war",
            subject: p.ref,
            outcome: { house: best.ref, grain: amount, rate: Math.round(rate * 1000) / 1000 },
            score: 1,
            threshold: 0,
            factors: [
              {
                name: "a war to fight",
                value: 1,
                contribution: 1,
                source: { ref: w.event, role: "trigger", weight: 1 },
              },
              { name: "the men it fields", value: Math.round(men), contribution: 0, source: null },
              {
                name: abroad ? "a house of lending abroad" : "a house of lending in its realm",
                value: most,
                contribution: 0,
                source: { ref: best.event, role: "enabler", weight: 1 },
              },
              {
                name: "what it owes already",
                value: Math.round(owing.owed),
                contribution: -burden,
                source: owing.loan
                  ? { ref: owing.loan.event, role: "constraint", weight: 1 }
                  : null,
              },
              { name: "war's risk", value: risk, contribution: -risk, source: null },
            ],
          });
        sm.move("in", G.grain, hm.move("out", G.grain, amount));
        const event = world.events.emit({
          type: CREDIT_EVENTS.chest.type,
          subjects: [best.ref, p.ref, w.ref],
          place: seat.ref,
          causes: [{ ref: decision, role: "trigger", weight: 1 }],
          data: {
            name: best.name,
            realm: realmName(p),
            enemy: realmName(realms.get(enemy) ?? p),
            grain: amount,
            rate: Math.round(rate * 100),
            ...(abroad ? { abroad: realmName(lender) } : {}),
          },
        });
        store.loans.push({
          id: store.count++,
          house: best.ref,
          cell: p.seat,
          year,
          event,
          lent: amount,
          rate,
          owed: amount,
          paid: 0,
          ended: null,
          end: null,
          endEvent: null,
          war: w.ref,
          realm: p.ref,
        });
        best.lentEver += amount;
        lentNow += amount;
      }
    }
  // 8. The houses' families draw on what each holds above a cushion of its stake.
  for (const h of store.standing()) {
    const over = Math.floor(CREDIT.drawn * (h.capital - CREDIT.cushion * h.stake));
    if (over <= 0) continue;
    h.capital -= over;
    h.drawn += over;
  }
  // 9. The year's owing and lending kept; loans long ended let go.
  store.years.push({
    year,
    owed: Math.round(store.open().reduce((a, l) => a + l.owed, 0)),
    lent: lentNow,
  });
  if (store.years.length > 400) store.years.shift();
  store.loans = store.loans.filter((l) => l.ended === null || year - l.ended < CREDIT.kept);
}

/** Whether a realm lost a war now ended: the attacker that did not win its prize, the defender that lost it. */
function lostWar(world: World, w: War, realm: Ref): boolean {
  const won = w.peace ? (world.events.get(w.peace)?.data as { won?: boolean } | null)?.won : false;
  return w.attacker === realm ? !won : w.defender === realm ? !!won : false;
}

/** The event of a realm's end, if the record still holds it. */
function fallOf(world: World, realm: Ref): Ref | null {
  return (
    world.events
      .all()
      .findLast((e) => e.type === POLITY_EVENTS.ended.type && e.subjects.includes(realm))?.id ??
    null
  );
}

/** The debt-bound of lands set free, so many of them, by a release of their debts. */
function freeTheBound(world: World, cells: readonly number[], event: Ref): void {
  const order = orderOf(world);
  if (!order) return;
  for (const c of cells) {
    const l = order.lands.get(c);
    if (!l || l.shares[BOND.debt]! <= 0) continue;
    l.shares[BOND.debt] = l.shares[BOND.debt]! * (1 - CREDIT.freed);
    l.cause = event;
  }
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

/** The god's hand on credit (M144): a land's debts forgiven, a house of lending broken. */
export function installCreditActs(world: World, ctx: () => PopulationContext): void {
  const land = (args: unknown): string | null => {
    const cell = (args as { cell?: unknown } | null)?.cell;
    if (!Number.isInteger(cell)) return "a land is wanted";
    return ctx().provinces.get(cell as number) ? null : "no one lives there";
  };
  // A land's debts forgiven: every loan it owes released, its houses bearing it; its debt-bound freed.
  world.defineCommand({
    type: "act.forgive",
    validate: (args) => {
      const store = creditOf(world);
      if (!store) return "this world knows no lending";
      const no = land(args);
      if (no) return no;
      return store.owedBy((args as { cell: number }).cell).loan
        ? null
        : "it owes no house anything";
    },
    apply: (command, t) => {
      const c = ctx(),
        store = creditOf(world)!,
        cell = (command.args as { cell: number }).cell,
        event = world.events.emit({
          type: CREDIT_ACTS.forgive.type,
          place: c.provinces.get(cell)?.ref ?? cellRef(0, cell),
          causes: [{ ref: command.id, role: "agent", weight: 1 }],
          data: { owed: Math.round(store.owedBy(cell).owed) },
        });
      for (const l of store.loans)
        if (l.ended === null && l.cell === cell)
          endLoan(store, l, yearOfMoment(t), "released", event);
      freeTheBound(world, [cell], event);
    },
  });
  // A house of lending broken: it fails at once, what it is owed forgiven, its town's savers ruined.
  world.defineCommand({
    type: "act.break",
    validate: (args) => {
      const store = creditOf(world);
      if (!store) return "this world knows no lending";
      const no = land(args);
      if (no) return no;
      const cell = (args as { cell: number }).cell;
      return store.standing().some((h) => h.cell === cell)
        ? null
        : "no house of lending stands there";
    },
    apply: (command, t) => {
      const c = ctx(),
        store = creditOf(world)!,
        cell = (command.args as { cell: number }).cell,
        house = store
          .standing()
          .filter((h) => h.cell === cell)
          .sort((a, b) => b.capital - a.capital || (a.ref < b.ref ? -1 : 1))[0]!,
        event = world.events.emit({
          type: CREDIT_ACTS.break.type,
          subjects: [house.ref],
          place: c.provinces.get(cell)?.ref ?? cellRef(0, cell),
          causes: [{ ref: command.id, role: "agent", weight: 1 }],
          data: { name: house.name },
        });
      fail(c, store, house, event, yearOfMoment(t));
    },
  });
}
