import { test } from "node:test";
import assert from "node:assert/strict";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  verifyByReplay,
  type Ref,
  type SimTime,
  type World,
} from "../../src/kernel/index.ts";
import { FOODS, G, MALE, OCC, PRINCIPLES } from "../../src/rules/index.ts";
import {
  BOND,
  CREDIT,
  CREDIT_ACTS,
  CREDIT_EVENTS,
  LAW,
  POPULATION_EVENTS,
  WAR_EVENTS,
  WAY,
  creditOf,
  creditYear,
  cultureOf,
  debtBurden,
  legitimacyFactors,
  loreOf,
  makePopulationWorld,
  marketsOf,
  mouths,
  orderOf,
  orderYear,
  politiesOf,
  populationContext,
  rateFor,
  row,
  warChest,
  warYear,
  warsOf,
  type House,
  type Loan,
  type Polity,
} from "../../src/sim/index.ts";
import { why } from "../../src/causal/index.ts";

// Phase 21 M143: credit. Juniper's realms sixty years on; the greatest realm's most peopled land
// made by hand a market town that knows coin and lending, with traders and grain to spare; its
// next land hungry. Worked on by the year of credit alone (the rest of the world held still),
// each year's draw at its own moment of year sixty. (M144: its wars, borrowed for; a debt
// repudiated; a jubilee; the god's hand.)
const seed = seedFromText("juniper"),
  build = (s = seed) => makePopulationWorld(s, { start: "spread" }),
  world = build();
world.runTo(60 * YEAR);
const RULESET = rulesetId(world, "test"),
  AS_IT_WAS = saveWorld(world, RULESET),
  fresh = () => loadWorld(AS_IT_WAS, build, RULESET).world;

const at = (k: number) => (60 * YEAR + k) as SimTime;
const greatest = (w: World): Polity => {
  const ctx = populationContext(w),
    people = (p: Polity) => p.members.reduce((n, c) => n + (ctx.provinces.get(c)?.total() ?? 0), 0);
  return [...politiesOf(w).living()]
    .filter((p) => p.members.length >= 3)
    .sort((a, b) => people(b) - people(a) || (a.ref < b.ref ? -1 : 1))[0]!;
};
/** A realm's lands with a town, the most peopled first. */
const towned = (w: World, p: Polity) => {
  const ctx = populationContext(w);
  return [...p.members]
    .filter((c) => ctx.settlements.inProvince(c).length > 0)
    .sort(
      (a, b) =>
        (ctx.provinces.get(b)?.total() ?? 0) - (ctx.provinces.get(a)?.total() ?? 0) || a - b,
    );
};
const principle = (id: string) => PRINCIPLES.find((x) => x.id === id)!;

/**
 * A land's town made a market town of five thousand with two hundred traders, its granary a
 * year's food and a hundred thousand over; knowing coin, and lending unless `lending` is false.
 */
function marketTown(w: World, cell: number, lending = true) {
  const ctx = populationContext(w),
    s = ctx.settlements.inProvince(cell)[0]!,
    prov = ctx.provinces.get(cell)!,
    m = marketsOf(w).of(cell),
    lore = loreOf(w);
  s.population = 5000;
  s.market ??= s.event;
  for (const id of lending ? ["currency", "banking"] : ["currency"])
    if (!lore.get(cell, id)) lore.learn(cell, id, { year: 60, event: s.event }, principle(id));
  prov.counts.add(row(MALE, 5), OCC.trader, 2 * CREDIT.traders);
  const want = Math.ceil(12 * mouths(prov, ctx.life)) + 100000 - m.stock[G.grain]!;
  if (want > 0) m.move("made", G.grain, want);
  return s;
}
/** The year of credit, drawn again and again, until a house rises (or k runs out). */
function untilAHouse(w: World, from = 1): { house: House | null; k: number } {
  const ctx = populationContext(w),
    store = creditOf(w)!;
  for (let k = from; k < from + 400; k++) {
    creditYear(ctx, at(k));
    if (store.houses.length) return { house: store.houses[0]!, k };
  }
  return { house: null, k: from + 400 };
}
/** A land's stores emptied of food, and a famine told there now. */
function famished(w: World, cell: number): Ref {
  const prov = populationContext(w).provinces.get(cell)!,
    m = marketsOf(w).of(cell);
  for (const g of FOODS) m.take("used", g, m.stock[g]!);
  prov.lastFamine = w.events.emit({
    type: POPULATION_EVENTS.famine.type,
    subjects: [prov.ref],
    place: prov.ref,
    data: { fed: 400, people: prov.total() },
  });
  return prov.lastFamine;
}
/** A house risen in the realm's first land, and its second land lent grain against its famine. */
function lent(w: World): {
  house: House;
  loan: Loan;
  lender: number;
  borrower: number;
  famine: Ref;
  k: number;
} {
  const [lender, borrower] = towned(w, greatest(w));
  marketTown(w, lender!);
  const { house, k } = untilAHouse(w);
  assert.ok(house, "a house rose");
  const famine = famished(w, borrower!);
  creditYear(populationContext(w), at(k + 1));
  const loan = creditOf(w)!.loans.find((l) => l.cell === borrower)!;
  assert.ok(loan, "the hungry land borrowed");
  return { house: house!, loan, lender: lender!, borrower: borrower!, famine, k: k + 1 };
}

test("a house of lending rises in a market town that knows lending, with traders and grain to spare; not where lending is unknown", () => {
  const w = fresh(),
    [first, second] = towned(w, greatest(w)),
    s = marketTown(w, first!);
  marketTown(w, second!, false);
  const { house } = untilAHouse(w),
    store = creditOf(w)!;
  assert.ok(house, "a house rose");
  assert.equal(house!.town, s.ref);
  assert.equal(house!.cell, first);
  assert.match(house!.name, /^the house of /);
  assert.ok(house!.capital > 0 && house!.capital === house!.stake);
  // (A stake of its land's grain above a year's food.)
  const ctx = populationContext(w);
  assert.ok(house!.stake <= CREDIT.stake * marketsOf(w).of(first!).stock[G.grain]!);
  // Drawn on longer: none where lending is unknown.
  for (let k = 500; k < 700; k++) creditYear(ctx, at(k));
  assert.ok(!store.houses.some((h) => h.cell === second), "no house where lending is unknown");
  // Its why: the decision, lending known and the market town.
  const founded = w.events.get(house!.event)!;
  assert.equal(founded.type, CREDIT_EVENTS.founded.type);
  const decision = w.decisions.get(founded.causes[0]!.ref)!;
  assert.equal(decision.rule, "credit.found");
  const lending = decision.factors.find((f) => f.name === "they know lending")!;
  assert.equal(lending.source?.ref, loreOf(w).get(first!, "banking")!.event);
  assert.ok(decision.factors.some((f) => f.name === "a market town"));
  assert.ok(decision.factors.some((f) => f.name === "coin"));
  assert.match(why(w, house!.ref).claim, /a house of lending in .+ since year/);
  assert.match(why(w, house!.event).claim, /began lending in/);
});

test("a hungry land of its realm borrows grain, carried from the house's town, at interest; the why goes back to the famine", () => {
  const w = fresh(),
    [lender, borrower] = towned(w, greatest(w));
  marketTown(w, lender!);
  const { house, k } = untilAHouse(w),
    ctx = populationContext(w),
    from = marketsOf(w).of(lender!),
    to = marketsOf(w).of(borrower!),
    had = from.stock[G.grain]!,
    famine = famished(w, borrower!),
    need = Math.ceil(CREDIT.months * mouths(ctx.provinces.get(borrower!)!, ctx.life));
  creditYear(ctx, at(k! + 1));
  const store = creditOf(w)!,
    loan = store.loans.find((l) => l.cell === borrower)!;
  assert.ok(loan, "the hungry land borrowed");
  assert.equal(loan.house, house!.ref);
  assert.equal(loan.lent, need, "enough to bring its food to three months");
  assert.equal(to.stock[G.grain], need, "the grain came to its stores");
  assert.equal(from.stock[G.grain], had - need, "from the house's town");
  assert.equal(loan.rate, CREDIT.rate);
  assert.equal(house!.lentEver, need);
  const event = w.events.get(loan.event)!,
    decision = w.decisions.get(event.causes[0]!.ref)!;
  assert.equal(event.type, CREDIT_EVENTS.lent.type);
  assert.equal(decision.rule, "credit.lend");
  assert.equal(decision.factors.find((f) => f.name === "hunger")!.source?.ref, famine);
  assert.equal(
    decision.factors.find((f) => f.name === "a house of lending in its realm")!.source?.ref,
    house!.event,
  );
  assert.match(
    why(w, loan.event).claim,
    /lent .+ grain against its famine, at 8 in a hundred a year/,
  );
  // A land already fed is not lent to: its famine answered, no second loan.
  creditYear(ctx, at(k! + 2));
  assert.equal(store.loans.filter((l) => l.cell === borrower).length, 1);
});

test("a debt is paid from the harvests: interest on what is owed, at most a share of the food made, never below three months' food", () => {
  const w = fresh(),
    { house, loan, lender, borrower, k } = lent(w),
    ctx = populationContext(w),
    m = marketsOf(w).of(borrower),
    hm = marketsOf(w).of(lender);
  // A harvest of ten thousand, the year closed on it.
  m.move("made", G.grain, 10000);
  m.closeYear(60);
  const owed = loan.owed,
    had = hm.stock[G.grain]!,
    capital = house.capital;
  creditYear(ctx, at(k + 1));
  const pay = Math.floor(CREDIT.repay * 10000);
  assert.equal(loan.paid, pay, "a share of the food made");
  assert.ok(
    Math.abs(loan.owed - (owed * (1 + loan.rate) - pay)) < 1e-6,
    "interest on what was owed",
  );
  assert.equal(hm.stock[G.grain], had + pay, "carried back to the house's town");
  assert.ok(Math.abs(house.capital - (capital + owed * loan.rate)) < 1e-6, "the house earned it");
  // Its stores at three months and a little: it pays only the little.
  const keep = Math.ceil(CREDIT.keep * mouths(ctx.provinces.get(borrower)!, ctx.life));
  for (const g of FOODS) m.take("used", g, m.stock[g]!);
  m.move("in", G.grain, keep + 50);
  const paid = loan.paid;
  creditYear(ctx, at(k + 2));
  assert.equal(loan.paid - paid, 50, "never below three months' food");
  // Paid off at last.
  m.move("made", G.grain, 1_000_000);
  m.closeYear(61);
  for (let j = 3; j < 80 && loan.ended === null; j++) creditYear(ctx, at(k + j));
  assert.equal(loan.end, "paid");
  assert.ok(loan.owed < 1);
});

test("a debt unpaid thirty years is written off; a house that loses more than it holds fails, its debts forgiven, its land aggrieved, credit dear", () => {
  const w = fresh(),
    { house, loan, lender, borrower, k } = lent(w),
    ctx = populationContext(w),
    store = creditOf(w)!;
  // A second land in its debt, to be forgiven when it fails.
  const third = towned(w, greatest(w))[2]!;
  famished(w, third);
  creditYear(ctx, at(k + 1));
  const other = store.loans.find((l) => l.cell === third && l.ended === null)!;
  assert.ok(other, "a second land in its debt");
  // The borrower cannot pay; the loan thirty years old; the house holding little.
  for (const g of FOODS)
    marketsOf(w).of(borrower).take("used", g, marketsOf(w).of(borrower).stock[g]!);
  (loan as { year: number }).year = 60 - CREDIT.forgotten;
  house.capital = 10;
  creditYear(ctx, at(k + 2));
  assert.equal(loan.end, "lost");
  const lost = w.events.get(loan.endEvent!)!;
  assert.equal(lost.type, CREDIT_EVENTS.lost.type);
  assert.equal(lost.causes[0]!.ref, loan.event);
  assert.ok(house.lost > 0);
  assert.notEqual(house.failed, null, "the house failed");
  const failed = w.events.get(house.failedEvent!)!;
  assert.equal(failed.type, CREDIT_EVENTS.failed.type);
  assert.equal(failed.causes[0]!.ref, loan.endEvent);
  assert.equal(other.end, "forgiven");
  assert.equal(other.endEvent, house.failedEvent);
  const grievance = politiesOf(w).discontent(lender);
  assert.ok(grievance.level >= 0.5);
  assert.equal(grievance.cause, house.failedEvent);
  assert.equal(store.failures, 1);
  assert.ok(
    Math.abs(rateFor(store, borrower, 61) - (CREDIT.rate + CREDIT.risk + CREDIT.dearer)) < 1e-9,
  );
  assert.ok(
    Math.abs(rateFor(store, borrower, 60 + CREDIT.crisis + 1) - (CREDIT.rate + CREDIT.risk)) < 1e-9,
  );
  assert.match(why(w, house.failedEvent!).claim, /failed, its losses/);
  // No standing house: no more lending.
  famished(w, borrower);
  const before = store.loans.length;
  creditYear(ctx, at(k + 3));
  assert.equal(store.loans.length, before);
});

test("a crushing debt binds the poor, famine or none; the bondage's why goes back to the loan", () => {
  const w = fresh(),
    { loan, borrower, k } = lent(w),
    ctx = populationContext(w),
    prov = ctx.provinces.get(borrower)!,
    m = marketsOf(w).of(borrower),
    ways = cultureOf(w).get(borrower)!;
  // A poor year's harvest, the debt a year's grain and more; no famine now; a people who keep to rank.
  m.move("made", G.grain, Math.max(1, Math.floor(loan.owed / 2)));
  m.closeYear(60);
  prov.lastFamine = null;
  ways.traits[WAY.hierarchy] = 0.9;
  ways.traits[WAY.kinship] = 0.1;
  assert.ok(debtBurden(ctx, borrower) >= 1);
  const order = orderOf(w)!,
    before = order.lands.get(borrower)?.shares[BOND.debt] ?? 0;
  orderYear(ctx, at(k + 1));
  assert.ok(
    order.lands.get(borrower)!.shares[BOND.debt]! > before,
    "the poor bound for their debts",
  );
  const decision = w.decisions
    .all()
    .findLast((d) => d.rule === "order.bondage" && d.subject === prov.ref)!;
  assert.ok(decision, "the binding decided");
  const debt = decision.factors.find((f) => f.name === "debts they cannot pay")!;
  assert.equal(debt.source?.ref, loan.event);
  assert.equal(debt.source?.role, "trigger");
  assert.ok(!decision.factors.some((f) => f.name === "hunger"), "no famine in it");
  // Under the line, none: a light debt binds no one without a famine.
  const w2 = fresh(),
    l2 = lent(w2),
    ctx2 = populationContext(w2);
  marketsOf(w2)
    .of(l2.borrower)
    .move("made", G.grain, Math.ceil(l2.loan.owed * 10));
  marketsOf(w2).of(l2.borrower).closeYear(60);
  ctx2.provinces.get(l2.borrower)!.lastFamine = null;
  assert.ok(debtBurden(ctx2, l2.borrower) < CREDIT.crushing);
  const o2 = orderOf(w2)!,
    b2 = o2.lands.get(l2.borrower)?.shares[BOND.debt] ?? 0;
  orderYear(ctx2, at(l2.k + 1));
  assert.equal(o2.lands.get(l2.borrower)?.shares[BOND.debt] ?? 0, b2);
});

test("credit is kept whole by a save, goes on alike after it, and the world replays", () => {
  const w = fresh(),
    { k } = lent(w),
    doc = saveWorld(w, RULESET),
    again = loadWorld(doc, build, RULESET).world;
  assert.deepEqual(creditOf(again)!.save(), creditOf(w)!.save());
  for (let j = 1; j <= 5; j++) {
    creditYear(populationContext(w), at(k + j));
    creditYear(populationContext(again), at(k + j));
  }
  assert.deepEqual(creditOf(again)!.save(), creditOf(w)!.save());
  const r = fresh();
  r.runTo(62 * YEAR);
  assert.deepEqual(verifyByReplay(saveWorld(r, RULESET), build), { ok: true, problem: null });
});

type War = ReturnType<ReturnType<typeof warsOf>["all"]>[number];
/** The greatest realm set upon a realm it borders, by the god's hand: the war, once declared. */
function atWar(w: World): { p: Polity; war: War } {
  const p = greatest(w);
  for (const q of [...politiesOf(w).living()].sort((a, b) => (a.ref < b.ref ? -1 : 1))) {
    if (q.ref === p.ref) continue;
    try {
      w.submit("act.war", { a: p.ref, b: q.ref });
    } catch {
      continue;
    }
    w.runTo(w.now + 3);
    return { p, war: warsOf(w).between(p.ref, q.ref)! };
  }
  throw new Error("no realm borders the greatest");
}

test("a realm at war borrows to pay its host — a war chest, never from its enemy; its battles cite it", () => {
  const w = fresh(),
    [lender] = towned(w, greatest(w));
  marketTown(w, lender!);
  const { house, k } = untilAHouse(w),
    { p, war } = atWar(w),
    store = creditOf(w)!,
    seat = marketsOf(w).of(p.seat),
    had = seat.stock[G.grain]!;
  creditYear(populationContext(w), at(k + 1));
  const chest = store.chest(p.ref, war.ref)!;
  assert.ok(chest, "the realm borrowed for its war");
  assert.equal(chest.house, house!.ref);
  assert.equal(chest.cell, p.seat);
  assert.equal(chest.realm, p.ref);
  assert.ok(Math.abs(chest.rate - (CREDIT.rate + CREDIT.war)) < 1e-9, "dearer for war's risk");
  assert.equal(
    seat.stock[G.grain],
    had + (house!.cell === p.seat ? 0 : chest.lent),
    "the grain came to its seat",
  );
  assert.equal(warChest(w, p.ref, war.ref), chest.event);
  // Its enemy has none: the only house is its enemy's.
  const enemy = war.attacker === p.ref ? war.defender : war.attacker;
  assert.equal(warChest(w, enemy, war.ref), null);
  const event = w.events.get(chest.event)!,
    decision = w.decisions.get(event.causes[0]!.ref)!;
  assert.equal(event.type, CREDIT_EVENTS.chest.type);
  assert.equal(decision.rule, "credit.war");
  assert.equal(decision.factors.find((f) => f.name === "a war to fight")!.source?.ref, war.event);
  assert.match(why(w, chest.event).claim, /to pay its host in its war with .+: a war chest/);
  // Once borrowed, not again for the same war.
  creditYear(populationContext(w), at(k + 2));
  assert.equal(store.loans.filter((l) => l.war === war.ref).length, 1);
  // Its battles cite it.
  warYear(populationContext(w), (61 * YEAR + 1) as SimTime);
  const battle = w.events
    .all()
    .findLast((e) => e.type === WAR_EVENTS.battle.type && e.subjects[0] === war.ref);
  assert.ok(battle, "a battle fought");
  assert.ok(
    battle.causes.some((c) => c.ref === chest.event && c.role === "enabler"),
    "the war chest behind it",
  );
});

test("a realm beaten and crushed by its war debt repudiates it: its lender bears it, the realm held faithless", () => {
  const w = fresh(),
    [lender] = towned(w, greatest(w));
  marketTown(w, lender!);
  const { house, k } = untilAHouse(w),
    { p, war } = atWar(w),
    ctx = populationContext(w),
    store = creditOf(w)!;
  creditYear(ctx, at(k + 1));
  const chest = store.chest(p.ref, war.ref)!;
  assert.ok(chest, "the realm borrowed for its war");
  // The war lost (the realm the attacker, its prize not won), its seat's harvest nothing.
  war.ended = 60;
  war.peace = w.events.emit({
    type: WAR_EVENTS.peace.type,
    subjects: [war.ref, war.attacker, war.defender],
    data: { won: war.attacker !== p.ref },
  });
  marketsOf(w).of(p.seat).closeYear(60);
  assert.ok(debtBurden(ctx, p.seat) >= CREDIT.crushing);
  const lost = house!.lost;
  creditYear(ctx, at(k + 2));
  assert.equal(chest.end, "repudiated");
  const defaulted = w.events.get(chest.endEvent!)!;
  assert.equal(defaulted.type, CREDIT_EVENTS.defaulted.type);
  assert.equal(defaulted.causes[0]!.ref, war.peace);
  assert.equal(defaulted.causes[1]!.ref, chest.event);
  assert.ok(house!.lost > lost, "its lender bears it");
  assert.equal(store.faithless(p.ref, 60)?.event, defaulted.id);
  assert.equal(store.faithless(p.ref, 60 + CREDIT.faithless), null, "faithless twenty years");
  // Its lands lent dearer; its standing the less; none lends it for a war.
  const other = p.members.find((c) => c !== p.seat);
  if (other !== undefined)
    assert.ok(
      Math.abs(rateFor(store, other, 60, p.ref) - (CREDIT.rate + 2 * CREDIT.risk)) < 1e-9,
      "its lands lent dearer",
    );
  const faith = legitimacyFactors(ctx, p).find((f) => f.name === "debts repudiated")!;
  assert.ok(faith && faith.contribution < 0);
  assert.equal(faith.source?.ref, defaulted.id);
  war.ended = null;
  war.peace = null;
  const before = store.loans.length;
  creditYear(ctx, at(k + 3));
  assert.equal(store.loans.length, before, "none lends a faithless realm for a war");
  assert.match(why(w, defaulted.id).claim, /repudiated the .+ grain it owed/);
});

test("a jubilee at a new ruler's coming: every debt its lands owe released; its houses bear it; its debt-bound go free; none under an old ruler", () => {
  const w = fresh(),
    p = greatest(w),
    [lender] = towned(w, p);
  marketTown(w, lender!);
  const { k } = untilAHouse(w),
    ctx = populationContext(w),
    store = creditOf(w)!,
    realms = politiesOf(w),
    order = orderOf(w)!;
  // Its other lands hungry, lent to, and then crushed: nothing made.
  for (const c of p.members) if (c !== lender) famished(w, c);
  creditYear(ctx, at(k + 1));
  const owing = p.members.filter((c) => store.owedBy(c).loan);
  assert.ok(owing.length >= 1, "its lands borrowed");
  for (const c of owing) marketsOf(w).of(c).closeYear(60);
  // A sacred law; its people aggrieved; some of them bound for debt. An old ruler: no jubilee.
  p.law = LAW.indexOf("the sacred");
  (p.ruler as { since: number }).since = 40;
  for (const c of p.members) realms.setDiscontent(c, { level: 1, cause: null });
  const shares = [0, 0, 0, 0, 0];
  shares[BOND.debt] = 0.2;
  order.lands.set(owing[0]!, { cell: owing[0]!, shares, cause: null });
  for (let j = k + 2; j < k + 100; j++) creditYear(ctx, at(j));
  assert.equal(store.jubilees.length, 0, "none under an old ruler");
  // A new ruler.
  (p.ruler as { since: number }).since = 60;
  let j = k + 100;
  while (!store.jubilees.length && j < k + 300) creditYear(ctx, at(j++));
  const jubilee = store.jubilees[0]!;
  assert.ok(jubilee, "a jubilee proclaimed");
  assert.equal(jubilee.realm, p.ref);
  for (const c of owing)
    assert.ok(
      store.loans
        .filter((l) => l.cell === c)
        .every((l) => l.end === "released" && l.endEvent === jubilee.event),
      "every debt released",
    );
  assert.ok(
    Math.abs(order.lands.get(owing[0]!)!.shares[BOND.debt]! - 0.2 * (1 - CREDIT.freed)) < 1e-9,
    "its debt-bound freed",
  );
  const event = w.events.get(jubilee.event)!,
    decision = w.decisions.get(event.causes[0]!.ref)!;
  assert.equal(decision.rule, "credit.jubilee");
  assert.equal(decision.factors.find((f) => f.name === "a sacred law")!.value, 1);
  assert.equal(decision.factors.find((f) => f.name === "a new ruler")!.source?.ref, p.ruler.event);
  assert.ok(decision.factors.find((f) => f.name === "its people bound or crushed by debt")!.source);
  assert.match(why(w, jubilee.event).claim, /proclaimed a jubilee/);
});

test("the god forgives a land its debts and breaks a house of lending; asked where there is none, refuses", () => {
  const w = fresh(),
    { house, loan, lender, borrower } = lent(w),
    store = creditOf(w)!;
  assert.throws(
    () => w.submit("act.break", { cell: borrower }),
    /no house of lending stands there/,
  );
  w.submit("act.forgive", { cell: borrower });
  w.runTo(w.now + 3);
  assert.equal(loan.end, "released");
  const forgiven = w.events.get(loan.endEvent!)!;
  assert.equal(forgiven.type, CREDIT_ACTS.forgive.type);
  assert.equal(forgiven.causes[0]!.role, "agent");
  assert.throws(() => w.submit("act.forgive", { cell: borrower }), /owes no house anything/);
  w.submit("act.break", { cell: lender });
  w.runTo(w.now + 3);
  assert.notEqual(house.failed, null);
  const broken = w.events.get(house.failedEvent!)!;
  assert.equal(w.events.get(broken.causes[0]!.ref)!.type, CREDIT_ACTS.break.type);
  assert.equal(store.standing().length, 0);
  assert.match(why(w, forgiven.id).claim, /forgiven every debt it owed/);
});
