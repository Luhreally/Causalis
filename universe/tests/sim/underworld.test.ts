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
  assert.ok(v.groups.length <= UNDER.most && v.feds.length <= UNDER.feds);
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
      v.feds.length > 0 && v.feds.length <= UNDER.feds,
      `${all} gangs, ${v.feds.length} federations`,
    );
    const f = v.feds[0]!,
      page = pageOf(world, fedRef(realm, f.event));
    assert.equal(page.kind, "family");
    assert.ok(page.followable && page.pin?.ref === fedRef(realm, f.event), page.title);
  }
  const town = ctx.settlements.inProvince(towns[0]!).find((s) => s.market)!,
    blocks = townUnderworldBlocks(world, town);
  assert.ok(blocks.length === 1 && "title" in blocks[0]! && blocks[0].title === "Its underworld");
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
});
