// The underworld (rules/underworld.ts; sim/order/underworld.ts): violence from structure, the state's answer, the street and the
// badge as pure rules; and on a real world's first years, with its law and its trade's rows written to force the conditions, a
// protection family and a cartel rising, their lands' rows, a ban ended turning a cartel, and the store's round trip.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HUMANLIKE,
  UNDER,
  badgePull,
  banRent,
  bossTaken,
  collusionOf,
  crackdownOf,
  deathSquad,
  exposedWithin,
  killingsOf,
  protectionWanted,
  protectionWantedIn,
  rentCaptured,
  streetFight,
  streetPull,
  successorsOf,
  turfWar,
  balanceMoved,
  peaceWorn,
  takeoverMen,
  violentIdle,
  youngBand,
  GEAR,
  GEAR_PARTS,
  POTENCY,
  bulkSlip,
  dosePrice,
  madeTarget,
  meansBought,
  potencyAfter,
  potencyCap,
  potencyHarm,
  potencyTarget,
  riskPremium,
  ESCALATE,
  escalation,
  fightOdds,
} from "../../src/rules/index.ts";
import {
  Hasher,
  YEAR,
  simTime,
  yearOfMoment,
  type Ref,
  type World,
} from "../../src/kernel/index.ts";
import {
  BAR,
  BAR_STORE,
  CYCLE_STORE,
  CY,
  FISC,
  TREASURY_STORE,
  UnderworldStore,
  groupsIn,
  kindOfGroup,
  moneyStore,
  organisedOf,
  politiesOf,
  populationContext,
  tradeStore,
  underworldOf,
  underworldYear,
  bestMeans,
  potencyOf,
  potencyStore,
  potencyYear,
  type RealmUnderworld,
} from "../../src/sim/index.ts";
import { LEDGER, type MarketStore } from "../../src/sim/economy/market.ts";
import { G } from "../../src/rules/goods.ts";
import { OCC } from "../../src/rules/species.ts";
import { LAW_ROW, LAW_STORE, societyStore } from "../../src/sim/society/kept.ts";
import { refNumber } from "../../src/sim/money/kept.ts";
import { EARTH } from "../../src/host/index.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { claimOf } from "../../src/host/inspect/words.ts";
import { fedRef, groupRef, opRef } from "../../src/host/underworld.ts";
import { townUnderworldBlocks } from "../../src/host/inspect/mobs.ts";
import { universeWorld } from "../host/worlds.ts";

// —— The rules ——————————————————————————————————————————————————————————————————————————————————————————

test("two close in strength over one rent fight; one dominant, or a pact with the state, keeps the peace", () => {
  const duopoly = turfWar([500, 450], 0),
    dominant = turfWar([900, 60, 40], 0),
    pact = turfWar([500, 450], 0.8),
    alone = turfWar([1000], 0);
  assert.ok(duopoly.war >= UNDER.warAt, `${duopoly.war}`);
  assert.ok(dominant.war < UNDER.warEnds, `${dominant.war}`);
  assert.ok(pact.war < duopoly.war * 0.6, `${pact.war}`);
  assert.equal(alone.war, 0);
  assert.ok(dominant.herfindahl > duopoly.herfindahl);
  // (A fragmented market of several close fights too.)
  assert.ok(turfWar([300, 280, 250, 170], 0).war >= UNDER.warAt);
  assert.ok(killingsOf(1000, duopoly.war) > 5 * killingsOf(1000, dominant.war));
});

test("a peace made on one balance of strength holds while it stands, and wears with the years as far as strength has changed hands", () => {
  const five: [number, number][] = [
    [1, 297],
    [2, 245],
    [3, 236],
    [4, 145],
    [5, 77],
  ];
  // (The same groups at the same strength: nothing moved, whatever the years. Shares a hundredth off: a twentieth of the way.)
  assert.equal(balanceMoved(five, five), 0);
  assert.equal(peaceWorn(100, balanceMoved(five, five)), 0);
  const drifted = five.map(([id, s], i) => [id, s + (i % 2 ? -6 : 6)] as [number, number]);
  assert.ok(balanceMoved(five, drifted) < 0.02, `${balanceMoved(five, drifted)}`);
  // (A newcomer with a fifth of the road's strength, taken from the rest: a fifth has changed hands; a group gone, its whole part.)
  const entered: [number, number][] = [
    ...five.map(([id, s]) => [id, s * 0.8] as [number, number]),
    [6, 200],
  ];
  assert.ok(Math.abs(balanceMoved(five, entered) - 0.2) < 1e-9);
  assert.ok(Math.abs(balanceMoved(five, five.slice(0, 4)) - 0.0385) < 1e-9);
  // (Worn by half in UNDER.paxHalf years once UNDER.shifted of the strength has moved; not at all on the day it is made.)
  assert.equal(peaceWorn(0, 1), 0);
  assert.ok(Math.abs(peaceWorn(UNDER.paxHalf, UNDER.shifted) - 0.5) < 1e-9);
  assert.ok(Math.abs(peaceWorn(UNDER.paxHalf, 1) - 0.5) < 1e-9);
  assert.ok(peaceWorn(2 * UNDER.paxHalf, 0.1) > peaceWorn(UNDER.paxHalf, 0.1));
  assert.ok(peaceWorn(UNDER.paxHalf, 0.1) > peaceWorn(UNDER.paxHalf, 0.05));
  // (Five groups that stand as they stood thirty years after their peace are far from a war; with a fifth changed hands, at one.)
  const strain = turfWar(
    five.map(([, s]) => s),
    0,
  ).war;
  assert.ok(strain * peaceWorn(30, balanceMoved(five, drifted)) < UNDER.warEnds);
  assert.ok(strain * peaceWorn(30, balanceMoved(five, entered)) >= UNDER.warAt);
});

test("protection is wanted where holdings are unsafe and deals not held, among those with a trade; sold by the idle skilled in violence", () => {
  const unsafe = protectionWanted({
      secure: 0.1,
      deals: 0.1,
      trade: 1000,
      earned: 2000,
      capacity: 0.2,
    }),
    safe = protectionWanted({ secure: 0.9, deals: 0.9, trade: 1000, earned: 2000, capacity: 0.2 }),
    reached = protectionWanted({
      secure: 0.1,
      deals: 0.1,
      trade: 1000,
      earned: 2000,
      capacity: 0.9,
    }),
    poor = protectionWanted({ secure: 0.1, deals: 0.1, trade: 0, earned: 2000, capacity: 0.2 }),
    // (Where holdings are safe and deals held, what unsafety would take is less than any protector's cut: none is bought.)
    lawful = protectionWanted({
      secure: 0.85,
      deals: 0.8,
      trade: 1000,
      earned: 2000,
      capacity: 0.6,
    });
  assert.equal(lawful, 0);
  assert.ok(
    unsafe > safe * 3 && unsafe > reached && unsafe > poor,
    `${unsafe} ${safe} ${reached} ${poor}`,
  );
  const home = violentIdle({ veterans: 0.02, young: 0.1, idle: 0.3, poor: 0.5, street: 0 }),
    calm = violentIdle({ veterans: 0, young: 0.1, idle: 0, poor: 0, street: 0 });
  assert.ok(home.supply > calm.supply && home.pool > calm.pool);
});

test("a ban makes a rent of the price wedge; outside hands take it where reach is weak and officers bought", () => {
  assert.equal(banRent(1000, 0, 4), 0);
  assert.ok(banRent(1000, 1, 4) > banRent(1000, 0.5, 4));
  assert.ok(banRent(1000, 1, 4) < 1000);
  assert.ok(rentCaptured(0.2, 0.5) > rentCaptured(0.8, 0.5));
  assert.ok(rentCaptured(0.3, 0.6) > rentCaptured(0.3, 0));
});

test("the state cracks down by its reach, standing and the voice of the harmed; bought officers blunt it and shelter bosses", () => {
  const base = {
    capacity: 0.6,
    legitimacy: 0.6,
    voice: 0.5,
    word: 0.5,
    killings: 0.3,
    extortion: 0.05,
    collusion: 0,
  };
  assert.ok(crackdownOf(base) > crackdownOf({ ...base, collusion: 0.8 }));
  assert.ok(crackdownOf(base) > crackdownOf({ ...base, killings: 0, extortion: 0 }));
  assert.ok(crackdownOf(base) > crackdownOf({ ...base, voice: 0, word: 0 }));
  assert.ok(collusionOf(0.5, 0.2, 0.2, false) > collusionOf(0.05, 0.2, 0.2, false));
  assert.ok(collusionOf(0.4, 0.2, 0.2, true) > collusionOf(0.4, 0.2, 0.2, false));
  assert.ok(bossTaken(0.8, 0, 5) > bossTaken(0.8, 0.9, 5));
  assert.ok(bossTaken(0.8, 0, 5) > bossTaken(0.8, 0, 1));
  assert.equal(successorsOf(50, 0.99), 1);
  assert.ok(successorsOf(1000, 0.99) >= 3);
});

test("the street pulls young men without openings beyond the hold of kin and police; rival federations fight hardest", () => {
  const f = {
    young: 0.1,
    idle: 0.4,
    poor: 0.6,
    street: 0.05,
    newcomers: 0.5,
    apart: 0.4,
    reach: 0.2,
    informal: 0.2,
    dependent: 0.05,
  };
  assert.ok(streetPull(f) > streetPull({ ...f, reach: 0.9 }));
  assert.ok(streetPull(f) > streetPull({ ...f, informal: 0.9 }));
  assert.ok(streetPull(f) > streetPull({ ...f, idle: 0, poor: 0 }));
  assert.ok(streetFight(12, true, 0.8, 0.2, 0.4) > streetFight(12, false, 0.8, 0.2, 0.4));
  assert.ok(streetFight(12, false, 0.8, 0.2, 0.4) > streetFight(2, false, 0.8, 0.2, 0.4));
  assert.ok(streetFight(12, false, 0.8, 0.9, 0.4) < streetFight(12, false, 0.8, 0.1, 0.4));
  assert.ok(youngBand(HUMANLIKE, 3) && youngBand(HUMANLIKE, 4) && !youngBand(HUMANLIKE, 2));
});

test("a crackdown's enforcers turn under weak oversight with a rent in reach; free word and courts expose them", () => {
  const f = { crackdown: 0.6, voice: 0.1, word: 0.1, courts: 0.1, force: 0.8, within: 0.02 };
  assert.ok(badgePull(f) > badgePull({ ...f, voice: 0.9, word: 0.9, courts: 0.9 }));
  assert.ok(badgePull(f) > badgePull({ ...f, crackdown: 0.05 }));
  assert.ok(deathSquad(0.8, 0.1, 0.5) && !deathSquad(0.8, 0.6, 0.5));
  assert.ok(
    exposedWithin({ word: 0.9, courts: 0.9, rival: 0.5, killings: 0 }, 5) >
      exposedWithin({ word: 0.05, courts: 0.05, rival: 0, killings: 0 }, 5),
  );
});

// —— On a real world ————————————————————————————————————————————————————————————————————————————————————

/** A world's first realm, with its law, its trade and its idle crafts written to force the conditions. */
function forced(world: World): { realm: Ref; year: number } {
  const p = [...politiesOf(world).living()].sort((a, b) => b.members.length - a.members.length)[0];
  assert.ok(p, "a living realm");
  const law = societyStore(world, LAW_STORE)!,
    lawRow = [...(law.get(p.ref) ?? new Array<number>(13).fill(0))];
  lawRow[LAW_ROW.secure] = 100;
  lawRow[LAW_ROW.deals] = 100;
  lawRow[LAW_ROW.byCourts] = 50;
  law.set(p.ref, lawRow);
  const fisc = moneyStore(world, TREASURY_STORE)!,
    f = [...(fisc.get(p.ref) ?? new Array<number>(33).fill(0))];
  f[FISC.base + 1] = 400_000;
  f[FISC.base + 3] = 200_000;
  // (Trade rich: what passes its lands' stalls is what the underworld reads now (rules takings), not the treasury's count of
  // what crossed its borders: written into its seat's last books as tools sold on, as much as its people earn. And a working
  // man's year is what its people earn a worker (it was the seat's best wage): 200,000 among year 30's few thousand workers
  // made a man's keep so dear that no rent kept a crew; they earn eight a worker here, as the seat's crafts paid.)
  const ctx0 = populationContext(world),
    workers = p.members.reduce((n, c) => {
      const prov = ctx0.provinces.get(c);
      return n + (prov ? Math.max(0, prov.total() - prov.occupation(OCC.dependent)) : 0);
    }, 0),
    seatMarket = world.store<MarketStore>("economy.markets").get(p.seat),
    seatBooks = seatMarket?.years.at(-1)?.ledger as number[][] | undefined;
  f[FISC.base + 3] = 8 * workers;
  fisc.set(p.ref, f);
  if (seatBooks && seatMarket)
    seatBooks[LEDGER.indexOf("out")]![G.tools] = Math.ceil(
      (8 * workers) / Math.max(0.1, seatMarket.price[G.tools]!),
    );
  f[FISC.reserve] = 1_000_000;
  fisc.set(p.ref, f);
  const cycle = tradeStore(world, CYCLE_STORE);
  if (cycle) {
    const c = [...(cycle.get(p.ref) ?? new Array<number>(13).fill(0))];
    c[CY.slack] = 400;
    cycle.set(p.ref, c);
  }
  // (Its turn: the next year its ref's number and the year come to a multiple of UNDER.every.)
  let year = yearOfMoment(world.now) + 1;
  while ((refNumber(p.ref) + year) % UNDER.every !== 0) year++;
  return { realm: p.ref, year };
}

/** Write a realm's ban: forbidden, and what its users spend. */
function ban(world: World, realm: Ref, barred: number): void {
  const bars = moneyStore(world, BAR_STORE)!,
    b = [...(bars.get(realm) ?? new Array<number>(18).fill(0))];
  b[BAR.barred] = barred * 1000;
  b[BAR.demand] = 20_000;
  b[BAR.price] = 30_000;
  bars.set(realm, b);
}

const world = universeWorld(EARTH, "first light", 30);

test("where holdings are unsafe, trade rich and men idle, a protection family rises with a boss; where a ban's rent is taken, a cartel", () => {
  const { realm, year } = forced(world);
  ban(world, realm, 1);
  const store = underworldOf(world)!;
  assert.ok(store, "the store is registered");
  underworldYear(populationContext(world), simTime((year + 1) * YEAR));
  const v = store.of(realm);
  assert.ok(v, "the realm keeps a record");
  const kinds = v.groups.map((g) => kindOfGroup(g));
  assert.ok(kinds.includes("protection"), `kinds ${kinds.join(",")}`);
  assert.ok(kinds.includes("cartel"), `kinds ${kinds.join(",")} rent ${v.smuggleRent}`);
  for (const g of v.groups) {
    assert.ok(g.boss.name.length > 0 && g.boss.born < year, g.boss.name);
    assert.ok(g.members >= 0 && g.share >= 0 && g.share <= 1000);
    assert.ok(world.events.get(g.event)?.type.startsWith("underworld."));
  }
  assert.ok(v.groups.length <= UNDER.most && v.feds.length <= UNDER.feds + UNDER.kinFeds);
  // (The lens's reading of its lands, and the ban's organisation fed by its groups.)
  const held = v.groups.flatMap((g) => g.lands);
  assert.ok(held.length > 0);
  const read = groupsIn(world, held[0]!);
  assert.ok(
    read && read.control >= 0 && read.control <= 1 && read.group !== null,
    JSON.stringify(read),
  );
  const organised = organisedOf(world, realm);
  assert.ok(organised !== null && organised > 0, `${organised}`);
  // (A ban ended collapses the rent: five years on, its cartels have turned to other rackets or are gone.)
  ban(world, realm, 0);
  underworldYear(populationContext(world), simTime((year + UNDER.every + 1) * YEAR));
  const after = store.of(realm)!;
  assert.ok(
    !after.groups.some((g) => kindOfGroup(g) === "cartel"),
    after.groups.map((g) => `${g.name}:${kindOfGroup(g)}`).join(" "),
  );
  assert.ok(after.banRent === 0);
});

test("the store hashes what it keeps, saves and loads whole, and is dormant until a realm's record is put", () => {
  const s = new UnderworldStore();
  assert.ok(s.dormant());
  const v = underworldOf(world)!.realmsKept()[0];
  const rec = underworldOf(world)!.of(v!) as RealmUnderworld;
  s.put(v!, structuredClone(rec));
  assert.ok(!s.dormant());
  const t = new UnderworldStore();
  t.load(JSON.parse(JSON.stringify(s.save())));
  const a = new Hasher(),
    b = new Hasher();
  s.hashInto(a);
  t.hashInto(b);
  assert.equal(a.hex(), b.hex());
  assert.deepEqual(t.of(v!), s.of(v!));
});

test("a realm's Underworld tab, each group's page with its follow and pin, and the words of its events never say how", () => {
  const store = underworldOf(world)!,
    realm = store
      .realmsKept()
      .find((r) => (store.of(r)?.groups.length ?? 0) + (store.of(r)?.gone.length ?? 0) > 0);
  assert.ok(realm, "a realm with groups");
  const page = pageOf(world, realm!),
    tab = page.tabs.find((t) => t.id === "underworld");
  assert.ok(tab, page.tabs.map((t) => t.id).join(","));
  const v = store.of(realm!)!,
    refs = [
      ...v.groups.map((g) => groupRef(realm!, g.event)),
      ...v.gone.map((g) => groupRef(realm!, g.rose)),
    ];
  assert.ok(refs.length > 0);
  for (const ref of refs) {
    const p = pageOf(world, ref);
    assert.equal(p.kind, "family", `${ref} ${p.title}`);
    assert.ok(p.followable, `${ref} can be followed`);
    assert.equal(p.pin?.ref, ref);
    assert.ok(/family|cartel|squad/.test(p.title), p.title);
  }
  // (Its events have words, and none of them says how anything is done.)
  const said = world.events
    .all()
    .filter((e) => e.type.startsWith("underworld."))
    .map((e) => claimOf(world, e.id));
  assert.ok(said.length > 0);
  for (const s of said) {
    assert.ok(!/\bhow to\b|recipe|cook|synthes|assemble/i.test(s), s);
    assert.ok(!s.includes("underworld."), s);
  }
});

test("towns with poor quarters grow small gangs; many of one people ally into a federation, with its page, and a town's justice page says them", () => {
  const { realm, year } = forced(world),
    ctx = populationContext(world),
    p = politiesOf(world).get(realm)!;
  // (Its towns grown great, its young men without openings: the street's conditions written in.)
  for (const c of p.members)
    for (const s of ctx.settlements.inProvince(c)) if (s.market) s.population = 60_000;
  underworldYear(ctx, simTime((year + 1) * YEAR));
  const v = underworldOf(world)!.of(realm)!,
    towns = p.members.filter((c) => (groupsIn(world, c)?.gangs ?? 0) > 0);
  assert.ok(towns.length > 0, `street ${v.street}`);
  for (const c of towns) {
    const read = groupsIn(world, c)!;
    assert.ok(read.street > 0 && read.street <= 1 && read.violence >= 0);
  }
  const all = towns.reduce((s, c) => s + (groupsIn(world, c)?.gangs ?? 0), 0);
  // (Many gangs of several towns, where cells or a cartel bind them: one town's gangs alone are no federation.)
  const several = towns.filter((c) => (groupsIn(world, c)?.gangs ?? 0) >= UNDER.fedTown).length;
  if (several < UNDER.fedTowns) assert.equal(v.feds.length, 0, "one town's gangs do not federate");
  else if (all >= UNDER.fedForm && v.feds.length) {
    assert.ok(
      v.feds.length > 0 && v.feds.length <= UNDER.feds + UNDER.kinFeds,
      `${all} gangs, ${v.feds.length} federations`,
    );
    const f = v.feds[0]!,
      page = pageOf(world, fedRef(realm, f.event));
    assert.equal(page.kind, "family");
    assert.ok(page.followable && page.pin?.ref === fedRef(realm, f.event), page.title);
  }
  const town = ctx.settlements.inProvince(towns[0]!).find((s) => s.market)!,
    blocks = townUnderworldBlocks(world, town);
  // (And, where soldiers stand in it, their operations after: the forced realm's cartels, which rise at the honest line of a
  // smuggler's rent, draw them here.)
  assert.ok(blocks.length >= 1 && "title" in blocks[0]! && blocks[0].title === "Its underworld");
  for (const b of blocks.slice(1)) assert.ok("title" in b && b.title === "Operations");
});

// —— Means, and the iron law of prohibition ————————————————————————————————————————————————————————————

test("a group buys its means toward its realm's best as its wealth holds; only outbidding the state buys better from abroad", () => {
  const best = { arms: 0.5, armour: 0.3, hidden: 0.2, word: 0.4 };
  const none = meansBought(best, 0, 1000, 1e6),
    rich = meansBought(best, 1e5, 1000, 1e6),
    richer = meansBought(best, 4e6, 1000, 1e6);
  for (const k of GEAR_PARTS) {
    assert.equal(none[k], 0);
    assert.ok(Math.abs(rich[k] - best[k]) < 1e-9, `${k} ${rich[k]}`);
    assert.ok(
      richer[k] > best[k] && richer[k] <= best[k] + GEAR.abroad + 1e-9,
      `${k} ${richer[k]}`,
    );
  }
});

test("under a ban that is hunted the trade grows stronger, made forms where chemistry allows; allowed again, it weakens over a generation", () => {
  assert.equal(riskPremium(0, 1), 0);
  assert.ok(riskPremium(1, 1) > riskPremium(1, 0.2));
  const cap = potencyCap({ herbs: true, medicine: true, chemistry: true, canMake: false }),
    made = potencyCap({ herbs: true, medicine: true, chemistry: true, canMake: true });
  assert.ok(cap.grown > 1 && made.made > cap.grown);
  assert.ok(potencyTarget(0.9, cap.grown) > potencyTarget(0.2, cap.grown));
  assert.ok(potencyTarget(0.9, cap.grown) <= cap.grown);
  const up = potencyAfter(1, potencyTarget(0.9, cap.grown), 20, false),
    down = potencyAfter(up, 1, 30, true);
  assert.ok(up > 1.5 && down < up && down > 1, `${up} ${down}`);
  assert.equal(madeTarget(0.9, false), 0);
  assert.ok(madeTarget(0.9, true) > 0.5);
  // (Deaths step up sharply with made forms; a dose costs less, a load is worth more, more slips past.)
  const grown = potencyHarm(4, 0),
    lab = potencyHarm(4, 1);
  assert.ok(lab.deaths - grown.deaths >= POTENCY.madeDeaths - 1e-9 && grown.binds > 1);
  assert.ok(dosePrice(8) < dosePrice(2) && 8 * dosePrice(8) > 2 * dosePrice(2));
  assert.ok(bulkSlip(1) === 0 && bulkSlip(20) <= POTENCY.slips && bulkSlip(20) > bulkSlip(2));
});

test("a strong trade shows on the realm's page and its cartel's, more of its takers die, and where the ban ends it weakens", () => {
  const store = underworldOf(world)!,
    realm =
      store
        .realmsKept()
        .find((r) => store.of(r)!.groups.some((g) => kindOfGroup(g) === "cartel")) ??
      store.realmsKept()[0]!,
    rows = potencyStore(world)!;
  ban(world, realm, 1);
  let year = yearOfMoment(world.now) + 1;
  while ((refNumber(realm) + year) % UNDER.every !== 0) year++;
  rows.set(realm, [800, 600, 300, 2000, 900, year - UNDER.every, 0]);
  assert.equal(potencyOf(world, realm).potency, 8);
  const page = pageOf(world, realm),
    said = JSON.stringify(page.tabs);
  assert.ok(said.includes("How strong"), "the How strong line");
  const cartel = store.of(realm)!.groups.find((g) => kindOfGroup(g) === "cartel");
  if (cartel) {
    const g = JSON.stringify(pageOf(world, groupRef(realm, cartel.event)).tabs);
    assert.ok(g.includes("What it carries"));
  }
  // (Allowed again: five years on it is weaker, never below the grown form.)
  ban(world, realm, 0);
  potencyYear(populationContext(world), simTime((year + 1) * YEAR));
  const after = potencyOf(world, realm);
  assert.ok(after.potency < 8 && after.potency >= 1, `${after.potency}`);
  assert.ok(after.made < 0.6);
});

test("each group's means lie within what its realm can make, or a little past where it outbids the state, and its page says them", () => {
  const store = underworldOf(world)!,
    ctx = populationContext(world);
  let seen = 0;
  for (const r of store.realmsKept()) {
    const p = politiesOf(world).get(r)!;
    for (const g of store.of(r)!.groups) {
      if (!g.means) continue;
      seen++;
      const best = bestMeans(ctx, p, g.home);
      for (const k of GEAR_PARTS)
        assert.ok(
          g.means[k] / 1000 <= best[k] + GEAR.abroad + 1e-3,
          `${k} ${g.means[k]} ${best[k]}`,
        );
      assert.ok(g.means.cost >= 0);
      if (g.means.arms + g.means.armour + g.means.hidden + g.means.word > 0) {
        const tabs = JSON.stringify(pageOf(world, groupRef(r, g.event)).tabs);
        assert.ok(tabs.includes("Its means"), g.name);
        assert.ok(
          !/how to|build|assembl|recipe/i.test(tabs.slice(tabs.indexOf("Its means"))),
          g.name,
        );
      }
    }
  }
  assert.ok(seen > 0, "groups reckoned with their means");
});

// —— Escalation: soldiers sent against a group ——————————————————————————————————————————————————————————————

test("a seat sends soldiers where a group outmatches its police and kills openly, with a purse and no war abroad; a bought seat makes a pact", () => {
  const base = {
    outmatch: 3,
    match: 2,
    killings: 0.5,
    defies: true,
    afford: 1,
    atWar: false,
    legitimacy: 0.5,
    force: 0.6,
    corruption: 0.1,
    paying: 0.1,
  };
  const go = escalation(base);
  assert.ok(go.army > go.leave && go.army > go.pact, JSON.stringify(go));
  const abroad = escalation({ ...base, atWar: true });
  assert.ok(abroad.army < abroad.leave, "not with its host at war abroad");
  const quiet = escalation({ ...base, outmatch: 0.3, killings: 0, defies: false });
  assert.ok(quiet.army < quiet.leave, "a small quiet group is left be");
  // (What a seat has to send only ever holds it back: a group its police can meet is not fought for being small and
  // easily met, though it holds the seat's own land, the ruler favours force and the rule wants to be seen to act.)
  const small = escalation({
    ...base,
    outmatch: 0.3,
    match: 9,
    killings: 0.02,
    paying: 0.01,
    legitimacy: 0.2,
    force: 1,
  });
  assert.ok(small.army < small.leave, JSON.stringify(small));
  for (const m of [0.5, 1, 3, 9])
    assert.ok(
      escalation({ ...base, match: m }).army <= escalation({ ...base, match: 9 }).army &&
        escalation({ ...base, match: m }).parts.find(([n]) => n.startsWith("soldiers"))![1] <= 0,
      "soldiers enough never weigh for sending them",
    );
  // (A group taking a great part of what the seat raises threatens it, its police a match for its men or not.)
  const rent = escalation({
    ...base,
    outmatch: 0.8,
    match: 3,
    killings: 0.05,
    defies: false,
    paying: 0.3,
  });
  assert.ok(rent.army > rent.leave && rent.army > rent.pact, JSON.stringify(rent));
  const bought = escalation({ ...base, corruption: 0.9, paying: 0.8 });
  assert.ok(bought.pact > bought.army, JSON.stringify(bought));
  // (More soldiers and better arms take more of its men and lose fewer of their own.)
  const few = fightOdds(10, 0.3, 100, 0.3),
    many = fightOdds(300, 0.6, 100, 0.3);
  assert.ok(many.taken > few.taken && many.lost < few.lost);
  assert.ok(many.taken <= ESCALATE.takes && few.lost <= ESCALATE.loses);
});

test("on a forced world soldiers go against groups: each operation with its page, follow and pin, its block, words that never say how, and few events a year", () => {
  const realms = [...politiesOf(world).living()];
  for (const p of realms) {
    const law = societyStore(world, LAW_STORE)!,
      lr = [...(law.get(p.ref) ?? new Array<number>(13).fill(0))];
    lr[LAW_ROW.secure] = 100;
    lr[LAW_ROW.deals] = 100;
    lr[LAW_ROW.byCourts] = 50;
    law.set(p.ref, lr);
    const fisc = moneyStore(world, TREASURY_STORE)!,
      f = [...(fisc.get(p.ref) ?? new Array<number>(33).fill(0))];
    f[FISC.base + 1] = 400_000;
    f[FISC.base + 3] = 200_000;
    f[FISC.reserve] = 1_000_000;
    fisc.set(p.ref, f);
    ban(world, p.ref, 1);
  }
  const ctx = populationContext(world),
    y0 = yearOfMoment(world.now) + 1,
    years = 20,
    e0 = world.events.count;
  for (let y = y0; y < y0 + years; y++) underworldYear(ctx, simTime((y + 1) * YEAR));
  // (Only news is told: well under one event a realm a year.)
  let told = 0;
  for (let i = e0; i < world.events.count; i++)
    if (world.events.at(i).type.startsWith("underworld.")) told++;
  assert.ok(told / years / realms.length < 1, `${told} in ${years} years, ${realms.length} realms`);
  const store = underworldOf(world)!,
    withOps = store.realmsKept().filter((r) => (store.of(r)?.ops?.length ?? 0) > 0);
  assert.ok(withOps.length > 0, "some seat sent soldiers");
  for (const r of withOps.slice(0, 4)) {
    const v = store.of(r)!;
    for (const o of v.ops!) {
      const sent = world.events.get(o.event)!;
      assert.equal(sent.type, "underworld.operation");
      assert.ok(o.soldiers >= UNDER.crew && o.fallen >= 0 && o.spent >= 0);
      const ref = opRef(r, o.event),
        page = pageOf(world, ref);
      assert.equal(page.kind, "family");
      assert.ok(page.followable && page.pin?.ref === ref, page.title);
      const words = [sent, ...(o.endEvent ? [world.events.get(o.endEvent)!] : [])].map((e) =>
        claimOf(world, e.id),
      );
      for (const w of words) assert.ok(!/how to|recipe|assembl|build a/i.test(w), w);
      if (o.ended !== null)
        assert.ok(["truce", "terms", "withdrew", "bought", "crushed"].includes(o.how!), `${o.how}`);
    }
    const tab = JSON.stringify(pageOf(world, r).tabs.find((t) => t.id === "underworld"));
    assert.ok(tab.includes("Operations"), "the realm's Underworld tab has its operations");
    // (And a town where soldiers were sent says them on its justice page.)
    const land = v.ops![0]!.lands[0]!,
      town = ctx.settlements.inProvince(land).find((x) => x.market);
    if (town && groupsIn(world, land))
      assert.ok(
        townUnderworldBlocks(world, town).some(
          (b) => b.type === "facts" && b.title === "Operations",
        ),
        "the town's Operations",
      );
  }
  assert.ok(
    withOps.flatMap((r) => store.of(r)!.ops!).length <=
      withOps.length * (ESCALATE.most + ESCALATE.gone),
  );
});

test("protection is wanted land by land: where the seat's courts reach and are trusted, little; where they are bought, the land held down or its people strangers, more; and for all that is traded against the law", () => {
  const held = {
    secure: 0.63,
    deals: 0.48,
    trade: 300,
    earned: 100,
    capacity: 0.95,
    reach: 0.95,
    corruption: 0,
    legitimacy: 0.9,
    kin: 1,
    occupied: 0,
    illegal: 0,
  };
  const well = protectionWantedIn(held);
  assert.ok(well < 0.05, `${well}`);
  for (const worse of [
    { corruption: 0.4 },
    { legitimacy: 0.2 },
    { kin: 0.1 },
    { occupied: 0.6 },
    { reach: 0.4 },
    { illegal: 0.1 },
  ])
    assert.ok(protectionWantedIn({ ...held, ...worse }) > well * 1.5, JSON.stringify(worse));
  assert.equal(protectionWantedIn({ ...held, secure: 1, deals: 1, illegal: 0.2 }), 0.2);
  // (A deal is left to a protector where the seat reaches neither of its two: the want goes as the uncovered share squared.
  // Covered four parts in five, a twenty-fifth of what a land with no seat at all would want; covered a third, nearly half.)
  const bare = protectionWantedIn({ ...held, reach: 0, legitimacy: 1 }),
    at = (reach: number) => protectionWantedIn({ ...held, reach, legitimacy: 1 }) / bare;
  assert.ok(bare > 0.1, `${bare}`);
  assert.ok(Math.abs(at(0.8) - 0.04) < 1e-9, `${at(0.8)}`);
  assert.ok(Math.abs(at(0.5) - 0.25) < 1e-9, `${at(0.5)}`);
  assert.ok(at(1 / 3) > 0.44 && at(1 / 3) < 0.45);
});

// —— How a road's war ends, and a group put down ————————————————————————————————————————————————————————

/**
 * A realm forced as `forced` forces one, with two protection families written into its record: the first with `men[0]` men and
 * `weight[0]` of their road's weight, the second likewise, both on the first's lands, at war since `since` years before the
 * realm's next turn (null: the first alone, and no war). Returns the realm, its turn's year, the two, their war's event and the event the second rose by.
 */
function atWar(
  world: World,
  men: readonly [number, number],
  weight: readonly [number, number],
  since: number | null,
): {
  realm: Ref;
  year: number;
  a: number;
  b: number;
  names: [string, string];
  war: Ref;
  rose: Ref;
} {
  const { realm } = forced(world),
    store = underworldOf(world)!,
    p = politiesOf(world).get(realm)!,
    turn = (from: number) => {
      let y = from;
      while ((refNumber(p.ref) + y) % UNDER.every !== 0) y++;
      return y;
    };
  let year = turn(Math.max(yearOfMoment(world.now), store.of(realm)?.last ?? 0) + 1);
  if (!store.of(realm)?.groups.some((g) => kindOfGroup(g) === "protection")) {
    underworldYear(populationContext(world), simTime((year + 1) * YEAR));
    year = turn(year + 1);
  }
  const v = structuredClone(store.of(realm)!) as RealmUnderworld,
    first = v.groups.find((g) => kindOfGroup(g) === "protection");
  assert.ok(first, "the forced realm has a protection family");
  const rose = world.events.emit({
      type: "underworld.rose",
      subjects: [realm],
      place: null,
      causes: [],
      data: { realm: "a realm", group: "Vesh", kind: "protection", gids: [v.next] },
    }),
    war = world.events.emit({
      type: "underworld.war",
      subjects: [realm],
      place: null,
      causes: [],
      data: {
        realm: "a realm",
        group: first.name,
        against: "Vesh",
        kind: "protection",
        gids: [first.id, v.next],
      },
    }),
    alone = since === null,
    born = year - (since ?? 0) - 5,
    a = { ...first, members: men[0], share: weight[0], since: born, wealth: 1000 },
    b = {
      ...structuredClone(first),
      id: v.next,
      name: "Vesh",
      event: rose,
      members: men[1],
      share: weight[1],
      since: born,
      wealth: 1000,
    };
  v.groups = [a, ...(alone ? [] : [b]), ...v.groups.filter((g) => kindOfGroup(g) !== "protection")];
  v.next++;
  v.ops = [];
  delete v.truce;
  v.wars = alone
    ? []
    : [
        {
          a: a.id,
          b: b.id,
          names: [a.name, b.name],
          kind: a.kind,
          since: year - since,
          event: war,
          ended: null,
          fallen: 0,
        },
      ];
  v.last = year - UNDER.every;
  store.put(realm, v);
  return { realm, year, a: a.id, b: b.id, names: [a.name, b.name], war, rose };
}

test("a road's war is lost by the side fallen under half the other's weight: taken over, told by the chronicle with the war as its cause, and its page still says who took it and the war it fought", () => {
  const { realm, year, a, b, names, war, rose } = atWar(world, [6000, 300], [900, 100], 5),
    store = underworldOf(world)!;
  underworldYear(populationContext(world), simTime((year + 1) * YEAR));
  const v = store.of(realm)!,
    won = v.groups.find((g) => g.id === a),
    gone = v.gone.find((g) => g.name === names[1] && g.rose === rose),
    w = v.wars.find((x) => x.event === war)!;
  assert.ok(won && !v.groups.some((g) => g.id === b), "the lesser is gone, the greater stands");
  assert.ok(gone, "kept among those whose hold ended");
  assert.equal(gone.how, "taken over");
  assert.equal(gone.into, names[0]);
  assert.deepEqual([w.ended, w.how, w.lost], [year, "taken over", 1]);
  assert.ok(
    w.at?.some(([id]) => id === a) && !w.at.some(([id]) => id === b),
    "its peace rests on those left",
  );
  // (The chronicle carries it: of importance 4, its war among its causes, both named, never how.)
  const e = world.events.get(gone.event)!,
    said = claimOf(world, gone.event);
  assert.equal(e.type, "underworld.ended");
  assert.ok(e.importance >= 4, `importance ${e.importance}`);
  assert.ok(
    e.causes.some((c) => c.ref === war),
    "its war is a cause",
  );
  assert.ok(
    said.toLowerCase().includes(`the ${names[1]} family`.toLowerCase()) &&
      said.toLowerCase().includes(`the ${names[0]} family`.toLowerCase()),
    said,
  );
  assert.ok(/lost its war with .* and was taken over by it/.test(said), said);
  assert.ok(!/how to|recipe|assembl|build a/i.test(said), said);
  // (The realm's tab says who took whom; the gone family's page says who took it and still tells its war.)
  const tab = JSON.stringify(pageOf(world, realm).tabs.find((t) => t.id === "underworld"));
  assert.ok(
    tab.includes(`the ${names[1]} family taken over by the ${names[0]} family`),
    "the tab's wars",
  );
  assert.ok(tab.includes("its war lost, taken over by"), "the tab's ends");
  const page = JSON.stringify(pageOf(world, groupRef(realm, rose)));
  assert.ok(page.includes("its war lost, taken over by") && page.includes(names[0]), "who took it");
  assert.ok(page.includes("The wars it fought") && page.includes("Was at war with"), "its wars");
  // (Of its men the victor took those its lands could keep, and the event says the rest: a splinter of a crew and more, named
  // and standing, of the beaten; fewer scattered.)
  const d = e.data as { men: number; rest?: number; splinter?: string },
    splinter = d.splinter ? v.groups.find((g) => g.name === d.splinter && g.since === year) : null;
  assert.ok(d.men >= 0 && d.men + (d.rest ?? 0) <= 300, JSON.stringify(d));
  if (d.splinter) {
    assert.ok(splinter, "the splinter stands");
    assert.ok((d.rest ?? 0) >= UNDER.crew);
    assert.equal(splinter.of, b);
    assert.ok(/held out as the .* family/.test(said), said);
    assert.ok(
      w.at!.some(([id]) => id === splinter.id),
      "the peace rests on it too",
    );
  } else if (d.rest) assert.ok(/scattered/.test(said) && d.rest < UNDER.crew, said);
  else assert.ok(/the men it had left the victor's/.test(said), said);
});

test("a victor takes of the beaten's men what its lands can keep; the rest are not its own", () => {
  // (Room for all: all taken.)
  assert.deepEqual(takeoverMen(100, 40, 500), { taken: 40, rest: 0 });
  // (Room for some: those, and the rest left.)
  assert.deepEqual(takeoverMen(480, 40, 500), { taken: 20, rest: 20 });
  // (A victor already as thick on its lands as a group comes to be takes none.)
  assert.deepEqual(takeoverMen(600, 40, 500), { taken: 0, rest: 40 });
  assert.deepEqual(takeoverMen(100, 0, 500), { taken: 0, rest: 0 });
});

test("a war tired out with neither beaten ends in a peace made on the strength each has left, told by the chronicle with both named", () => {
  const { realm, year, a, b, names, war } = atWar(world, [3000, 2900], [505, 495], 20),
    store = underworldOf(world)!;
  underworldYear(populationContext(world), simTime((year + 1) * YEAR));
  const v = store.of(realm)!,
    w = v.wars.find((x) => x.event === war)!,
    ga = v.groups.find((g) => g.id === a),
    gb = v.groups.find((g) => g.id === b);
  assert.ok(ga && gb, "both stand");
  assert.deepEqual([w.ended, w.how], [year, "peace"]);
  assert.ok(w.lost === undefined);
  // (What the peace rests on: every group of the road, their parts of its strength making the whole.)
  const parts = w.at!;
  assert.ok(parts.some(([id]) => id === a) && parts.some(([id]) => id === b));
  const sum = parts.reduce((s, [, x]) => s + x, 0);
  assert.ok(Math.abs(sum - 1000) <= parts.length, `${sum}`);
  // (And it holds while that strength stands: with nothing changed hands since, the years do not wear it.)
  assert.equal(peaceWorn(10, balanceMoved(parts, parts)), 0);
  const pax = world.events
    .all()
    .filter((e) => e.type === "underworld.pax" && e.causes.some((c) => c.ref === war))
    .at(-1);
  assert.ok(pax, "the peace is told");
  assert.ok(pax.importance >= 4, `importance ${pax.importance}`);
  const data = pax.data as { holds: number; against: string; group: string },
    said = claimOf(world, pax.id);
  assert.ok(data.holds >= 50 && data.holds <= 100, `${data.holds}`);
  assert.ok(
    names.includes(data.group) && names.includes(data.against) && data.group !== data.against,
  );
  assert.ok(/made peace in .* neither beaten/.test(said), said);
  assert.ok(
    said.toLowerCase().includes(`the ${names[0]} family`.toLowerCase()) &&
      said.toLowerCase().includes(`the ${names[1]} family`.toLowerCase()),
    said,
  );
  const tab = JSON.stringify(pageOf(world, realm).tabs.find((t) => t.id === "underworld"));
  assert.ok(tab.includes("ended in a peace, neither beaten"), "the tab's wars");
});

test("soldiers that break a group to what its police can meet put it down where they have taken its boss, and go home where he is at large", () => {
  for (const bosses of [1, 0]) {
    const { realm, year, a, names } = atWar(world, [60, 0], [1000, 0], null),
      store = underworldOf(world)!,
      v = structuredClone(store.of(realm)!) as RealmUnderworld,
      g = v.groups.find((x) => x.id === a)!,
      sent = world.events.emit({
        type: "underworld.operation",
        subjects: [realm],
        place: null,
        causes: [],
        data: { realm: "a realm", group: g.name, kind: "protection", gids: [a], soldiers: 100 },
      });
    // (Soldiers many times its men, and a reckoning that stands for a generation of raids: all but a few of its men taken.)
    v.ops = [
      {
        id: 1,
        target: a,
        name: g.name,
        kind: g.kind,
        lands: [...g.lands],
        since: year - 1,
        event: sent,
        soldiers: 100,
        fallen: 0,
        taken: 0,
        bystanders: 0,
        displaced: 0,
        spent: 0,
        bosses,
        clashes: 0,
        ended: null,
      },
    ];
    v.last = year - 25;
    store.put(realm, v);
    underworldYear(populationContext(world), simTime((year + 1) * YEAR));
    const after = store.of(realm)!,
      o = after.ops!.find((x) => x.event === sent)!,
      gone = after.gone
        .filter((x) => x.name === names[0] && x.kind === 0 && x.year === year)
        .at(-1);
    assert.equal(o.ended, year, "the operation is over");
    assert.ok(o.taken > 0, "its men were taken");
    if (bosses) {
      assert.ok(gone && !after.groups.some((x) => x.id === a), "the group is gone");
      assert.equal(gone.how, "put down");
      const e = world.events.get(gone.event)!,
        said = claimOf(world, gone.event);
      assert.equal(e.type, "underworld.ended");
      // (It ruled its road alone: the chronicle carries it, the soldiers sent among its causes.)
      assert.ok(e.importance >= 4, `importance ${e.importance}`);
      assert.ok(
        e.causes.some((c) => c.ref === sent),
        "the soldiers sent are a cause",
      );
      assert.ok(/was put down by the realm's soldiers: its boss taken/.test(said), said);
      assert.ok(!/how to|recipe|assembl|build a/i.test(said), said);
      const tab = JSON.stringify(pageOf(world, realm).tabs.find((t) => t.id === "underworld"));
      assert.ok(tab.includes("put down by its realm's soldiers, its boss taken"), "the tab's ends");
      const page = JSON.stringify(pageOf(world, groupRef(realm, g.event)));
      assert.ok(page.includes("put down by its realm's soldiers, its boss taken"), "its page");
    } else {
      // (Its boss at large: broken, it is not put down; the soldiers go home.)
      assert.equal(o.how, "withdrew");
      assert.ok(gone?.how !== "put down", `${gone?.how}`);
    }
  }
});

test("a war opened in the reckoning soldiers put one of its two down is told once, by that end, never as a war opened", (t) => {
  // (Two families alike on one road, no war yet; soldiers many times the second's men, its boss already theirs.)
  const { realm, year, a, b, names, rose } = atWar(world, [400, 380], [505, 495], 5),
    store = underworldOf(world)!,
    v = structuredClone(store.of(realm)!) as RealmUnderworld,
    g = v.groups.find((x) => x.id === b)!,
    sent = world.events.emit({
      type: "underworld.operation",
      subjects: [realm],
      place: null,
      causes: [],
      data: { realm: "a realm", group: g.name, kind: "protection", gids: [b], soldiers: 4000 },
    });
  v.wars = [];
  v.ops = [
    {
      id: 1,
      target: b,
      name: g.name,
      kind: g.kind,
      lands: [...g.lands],
      since: year - 1,
      event: sent,
      soldiers: 4000,
      fallen: 0,
      taken: 0,
      bystanders: 0,
      displaced: 0,
      spent: 0,
      bosses: 1,
      clashes: 0,
      ended: null,
    },
  ];
  v.last = year - 25;
  store.put(realm, v);
  const before = world.events.count;
  underworldYear(populationContext(world), simTime((year + 1) * YEAR));
  const after = store.of(realm)!,
    w = after.wars.find((x) => x.since === year && (x.a === b || x.b === b)),
    told = [];
  for (let i = before; i < world.events.count; i++) told.push(world.events.at(i));
  const opened = told.filter(
    (e) => e.type === "underworld.war" && (e.data as { gids: number[] }).gids.includes(b),
  );
  if (!w) {
    // (No war came of it on this world: then none was told, and nothing here is asked.)
    assert.equal(opened.length, 0);
    return;
  }
  // (Whichever of the two ended, by the soldiers or by the reckoning's other hands.)
  const gone = after.gone.find((x) => x.year === year && x.event === w.event);
  if (w.ended === null) {
    // (Both stand at the reckoning's end: their war is told as opened, once, and is what its record opens.)
    assert.equal(opened.length, 1);
    assert.equal(w.event, opened[0]!.id);
    return;
  }
  // (One was ended in the reckoning their war opened: no war is told; the end tells it, and the war's record opens that.)
  t.diagnostic(`a war opened and ended in ${year}: ${gone?.name} ${gone?.how}`);
  assert.equal(opened.length, 0, "no war told as opened");
  assert.equal(w.ended, year);
  assert.ok(gone && names.includes(gone.name), "its record opens the end of the one that ended");
  const e = world.events.get(gone.event)!,
    said = claimOf(world, gone.event);
  assert.equal((e.data as { opened?: number }).opened, 1);
  assert.ok(e.importance >= 4, `importance ${e.importance}`);
  assert.ok(
    /it had gone to war with .* over their road that year, a war over as it began/.test(said),
    said,
  );
  for (const n of names)
    assert.ok(said.toLowerCase().includes(`the ${n} family`.toLowerCase()), said);
  assert.ok(a !== b && rose);
});
