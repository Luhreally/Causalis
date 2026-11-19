// Groups (rules/groups.ts; sim/order/groups.ts): collective action as pure rules (what organising costs, what a member feels of a
// common gain, a group's kind read off what it does and turning as its stakes move); and on a real world's first years, with its
// law, its trade and its towns written to force the conditions, groups forming from the stakes, their lands' rows and the lens's
// reading, the hired adding to their payer's strength, the pages with their follow and pin, and the store's round trip.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AIM,
  ORG,
  ORG_AIMS,
  ORG_KINDS,
  aimsToward,
  cohesionOf,
  crewOf,
  feltGain,
  firstAim,
  joinedOf,
  meansBit,
  orgKind,
  organisingCost,
  preyTake,
  roadGuarded,
  seaGuarded,
  PRINCIPLES,
  cloisterWorth,
  hardToReach,
  inquireWorth,
  officeWorth,
  refugeWorth,
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
  CYCLE_STORE,
  CY,
  FISC,
  OrgsStore,
  TREASURY_STORE,
  groupsYear,
  hiredBy,
  kindName,
  moneyStore,
  organisedIn,
  orgsOf,
  politiesOf,
  populationContext,
  strengthOf,
  tradeStore,
  TEMPLE_STORE,
  beliefOf,
  cultureRows,
  electionsOf,
  electionsYear,
  landOf,
  loreOf,
  orderOf,
  orgInquiryOf,
  orgPartyOf,
  orgRefugeOf,
  type RealmOrgs,
} from "../../src/sim/index.ts";
import { ACADEMY_STORE } from "../../src/sim/culture/rows.ts";
import { reliefOf } from "../../src/sim/war/occupation.ts";
import { housesOf } from "../../src/sim/order/houses.ts";
import { reckonReach } from "../../src/sim/order/order.ts";
import { LAW_ROW, LAW_STORE, societyStore } from "../../src/sim/society/kept.ts";
import { refNumber } from "../../src/sim/money/kept.ts";
import { EARTH } from "../../src/host/index.ts";
import { lettersOf } from "../../src/sim/lore/letters.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { claimOf } from "../../src/host/inspect/words.ts";
import { orgRef } from "../../src/host/groups.ts";
import { universeWorld } from "../host/worlds.ts";

// —— The rules ——————————————————————————————————————————————————————————————————————————————————————————

test("organising costs more as a group grows and less as more binds it; a common gain is felt less in a large group", () => {
  const loose = cohesionOf({ kin: 0, folk: 0, faith: 0, writing: 0, trust: 0, leader: 0 }),
    bound = cohesionOf({ kin: 1, folk: 1, faith: 1, writing: 1, trust: 1, leader: 1 });
  assert.equal(loose, 1);
  assert.ok(bound > 3);
  assert.ok(organisingCost(4000, loose) > organisingCost(40, loose));
  assert.ok(organisingCost(400, bound) < organisingCost(400, loose));
  // (Olson: a public good is felt by each as his share; a private one whole.)
  assert.ok(feltGain(0.1, 4000) < 0.15 && feltGain(0.1, 20) === 1);
  assert.equal(feltGain(1, 4000), 1);
});

test("a public good gathers a small circle, a gain only members get a great society, and nothing below a crew's worth", () => {
  const coh = 2,
    aid = joinedOf("aid", 0.2, 20_000, coh),
    rebel = joinedOf("rebel", 0.2, (20_000 / 0.04) * 0.3, coh);
  assert.ok(aid >= ORG.crew, `${aid}`);
  // (The same felt gain a household, a rising's public and an aid fund's private: the private gathers more.)
  assert.ok(aid > rebel, `aid ${aid} rebel ${rebel}`);
  assert.equal(joinedOf("aid", 0.0001, 20_000, coh), 0);
  assert.equal(joinedOf("aid", 0.2, 10, coh), 0);
  // (Bound tighter, more hold together.)
  assert.ok(joinedOf("guard", 0.1, 50_000, 4) >= joinedOf("guard", 0.1, 50_000, 1));
  // (A rent keeps as many full-timers as it pays, at most the pool.)
  assert.ok(crewOf(30_000, 10, 2, 1e6) > crewOf(3_000, 10, 2, 1e6));
  assert.ok(crewOf(30_000, 10, 2, 50) <= 50);
});

test("preying takes what is unguarded: roads the seat reaches little, seas its navy cannot cover", () => {
  assert.ok(preyTake(1e5, roadGuarded(0.1, 0)) > preyTake(1e5, roadGuarded(0.9, 0)));
  assert.ok(preyTake(1e5, roadGuarded(0.2, 0.8)) < preyTake(1e5, roadGuarded(0.2, 0)));
  assert.ok(seaGuarded(0, 100, 0.2) < seaGuarded(200, 100, 0.2));
  assert.ok(preyTake(1e5, 1) === 0);
  // (Roads a strong seat watches leave next to nothing: a hundredth of what open roads give, not a twentieth.)
  assert.ok(preyTake(1e5, roadGuarded(0.95, 0)) < 0.01 * preyTake(1e5, roadGuarded(0, 0)));
});

test("a group's kind is read off what it does; it turns as its stakes move: an unpaid company becomes brigands", () => {
  const base = {
    second: null,
    armed: true,
    standing: 0,
    basis: "poor",
    patron: false,
    occupied: false,
  } as const;
  assert.equal(orgKind({ ...base, aim: "prey", sea: true }), "pirates");
  assert.equal(orgKind({ ...base, aim: "prey", sea: true, patron: true }), "privateers");
  assert.equal(orgKind({ ...base, aim: "prey", sea: false }), "brigands");
  assert.equal(orgKind({ ...base, aim: "hire", sea: false }), "free company");
  assert.equal(orgKind({ ...base, aim: "worship", sea: false, standing: 1 }), "sect");
  assert.equal(orgKind({ ...base, aim: "worship", sea: false }), "hidden sect");
  assert.equal(orgKind({ ...base, aim: "rebel", sea: false, occupied: true }), "resistance");
  assert.equal(orgKind({ ...base, aim: "aid", sea: false, basis: "faith" }), "confraternity");
  // (A company whose war has ended: its pay gone, the roads unguarded. A few reckonings on, it preys.)
  let aims: number[] = ORG_AIMS.map((a) => (a === "hire" ? 1000 : 0));
  const worth = ORG_AIMS.map((a) => (a === "prey" ? 5000 : a === "guard" ? 200 : 0));
  for (let k = 0; k < 4; k++) aims = aimsToward(aims, worth, meansBit("arms"), 0.67);
  assert.equal(firstAim(aims), "prey");
  assert.ok(Math.abs(aims.reduce((s, x) => s + x, 0) - 1000) <= ORG_AIMS.length);
  // (Smuggling is the underworld's first aim, never this layer's while another is held.)
  const smug = ORG_AIMS.map((a) => (a === "smuggle" ? 600 : a === "prey" ? 400 : 0));
  assert.equal(firstAim(smug), "prey");
  assert.ok(ORG_KINDS.length >= 20 && AIM.prey === 0);
});

test("parties, refuges, orders and learned societies: what each is worth, and the kinds they are read as", () => {
  assert.equal(officeWorth(0.9, 0.5, true), 0);
  assert.ok(officeWorth(0.9, 0.5, false) > officeWorth(0.3, 0.5, false));
  assert.ok(hardToReach(1200, 6, 0.1) > hardToReach(20, 1, 0.8));
  assert.ok(refugeWorth(0.3, 0, 0.8, false) > refugeWorth(0.3, 0, 0.2, false));
  assert.ok(refugeWorth(0.3, 0, 0.8, true) < refugeWorth(0.3, 0, 0.8, false));
  assert.equal(refugeWorth(0, 0, 1, false), 0);
  assert.ok(cloisterWorth(0.9, 0.5, 0.8) > cloisterWorth(0.3, 0.5, 0.8));
  assert.equal(inquireWorth(0.9, 0, 1), 0);
  assert.ok(inquireWorth(0.9, 1, 1) > inquireWorth(0.1, 1, 1));
  const base = {
    second: null,
    sea: false,
    armed: false,
    standing: 1,
    basis: "faith",
    patron: false,
    occupied: false,
  } as const;
  assert.equal(orgKind({ ...base, aim: "worship", cloister: true }), "monastic order");
  assert.equal(orgKind({ ...base, aim: "office" }), "party");
  assert.equal(orgKind({ ...base, aim: "refuge", standing: 0 }), "maroon community");
  assert.equal(orgKind({ ...base, aim: "inquire" }), "learned society");
  // (Where the free word is shut, the learned keep their counsel in secret.)
  assert.equal(orgKind({ ...base, aim: "inquire", standing: 0 }), "lodge");
});

// —— On a real world ————————————————————————————————————————————————————————————————————————————————————

/** A world's greatest realm, its law weak, its trade rich, its crafts idle, its towns grown great: the year of its turn. */
function forced(world: World): { realm: Ref; year: number } {
  const p = [...politiesOf(world).living()].sort((a, b) => b.members.length - a.members.length)[0];
  assert.ok(p, "a living realm");
  const law = societyStore(world, LAW_STORE)!,
    lawRow = [...(law.get(p.ref) ?? new Array<number>(13).fill(0))];
  lawRow[LAW_ROW.secure] = 150;
  lawRow[LAW_ROW.deals] = 150;
  lawRow[LAW_ROW.byCourts] = 50;
  law.set(p.ref, lawRow);
  const fisc = moneyStore(world, TREASURY_STORE)!,
    f = [...(fisc.get(p.ref) ?? new Array<number>(33).fill(0))];
  f[FISC.base + 1] = 800_000;
  f[FISC.base + 3] = 300_000;
  f[FISC.reserve] = 1_000_000;
  fisc.set(p.ref, f);
  const cycle = tradeStore(world, CYCLE_STORE);
  if (cycle) {
    const c = [...(cycle.get(p.ref) ?? new Array<number>(13).fill(0))];
    c[CY.slack] = 400;
    cycle.set(p.ref, c);
  }
  const ctx = populationContext(world);
  for (const c of p.members)
    for (const s of ctx.settlements.inProvince(c)) if (s.market) s.population = 40_000;
  let year = yearOfMoment(world.now) + 1;
  while ((refNumber(p.ref) + year + 2) % ORG.every !== 0) year++;
  return { realm: p.ref, year };
}

const world = universeWorld(EARTH, "first light", 30);

test("where trade is rich and unguarded, towns great and deals weak, groups form from the stakes, each a kind read off what it does", () => {
  const { realm, year } = forced(world),
    store = orgsOf(world);
  assert.ok(store, "the store is registered");
  groupsYear(populationContext(world), simTime((year + 1) * YEAR));
  const v = store.of(realm);
  assert.ok(v, "the realm keeps a record");
  assert.ok(
    v.stakes.some((x) => x > 0),
    `stakes ${v.stakes.join(",")}`,
  );
  assert.ok(v.orgs.length > 0, `gather ${v.gather.join(",")}`);
  assert.ok(v.orgs.length <= ORG.most && v.feds.length <= ORG.feds);
  for (const g of v.orgs) {
    assert.ok(g.leader.name.length > 0 && g.leader.born < year, g.leader.name);
    assert.ok((ORG_KINDS as readonly string[]).includes(kindName(g)), kindName(g));
    assert.notEqual(ORG_AIMS[g.aim], "smuggle");
    assert.ok(Math.abs(g.aims.reduce((s, x) => s + x, 0) - 1000) <= ORG_AIMS.length);
    assert.ok(g.members >= 0 && g.lands.length >= 1 && g.lands.length <= ORG.lands);
    assert.ok(world.events.get(g.event)?.type === "groups.rose");
  }
  // (The lens's reading of a held land.)
  const read = organisedIn(world, v.orgs[0]!.home);
  assert.ok(read && read.group !== null && read.hold >= 0 && read.hold <= 1, JSON.stringify(read));
  assert.ok(read.prey <= ORG.takeMost && read.spared <= ORG.spares && read.fills <= ORG.fills);
  // (Five years on, stepped again: kinds read again, nothing out of bounds.)
  groupsYear(populationContext(world), simTime((year + ORG.every + 1) * YEAR));
  const after = store.of(realm)!;
  assert.ok(after.orgs.length <= ORG.most);
});

test("a company or licensed ship adds to its payer's strength, at most a quarter again; none where none is paid", () => {
  const p = [...politiesOf(world).living()].sort((a, b) => b.members.length - a.members.length)[0]!,
    q = [...politiesOf(world).living()].find((x) => x.ref !== p.ref),
    ctx = populationContext(world),
    store = orgsOf(world)!;
  assert.ok(q, "a second realm");
  const before = strengthOf(ctx, p),
    was = store.of(q.ref),
    v: RealmOrgs = was
      ? (structuredClone(was) as RealmOrgs)
      : {
          last: 0,
          next: 1,
          stakes: [],
          gather: [],
          suppression: 0,
          killings: 0,
          taken: 0,
          pays: 0,
          rising: 0,
          plot: 0,
          orgs: [],
          feds: [],
          gone: [],
        };
  const hired0 = hiredBy(world, p.ref);
  v.orgs.push({
    id: 999,
    name: "Test",
    kind: ORG_KINDS.indexOf("free company"),
    aim: AIM.hire,
    aims: ORG_AIMS.map((a) => (a === "hire" ? 1000 : 0)),
    since: 1,
    event: "ev:0:1" as Ref,
    home: q.seat,
    lands: [q.seat],
    basis: 4,
    identity: "",
    means: meansBit("arms"),
    standing: 2,
    leader: { name: "One", born: 0, since: 1 },
    leaders: 1,
    members: 1_000_000,
    wealth: 0,
    income: 0,
    takes: 0,
    gives: 0,
    violence: 0,
    power: 1000,
    patron: p.ref,
  });
  store.put(q.ref, v);
  assert.ok(hiredBy(world, p.ref) > hired0);
  const after = strengthOf(ctx, p);
  assert.ok(after > before && after <= before * (1 + ORG.hiredMost) + 1e-6, `${before} ${after}`);
  if (was) store.put(q.ref, structuredClone(was) as RealmOrgs);
  else store.forget(q.ref);
});

test("the store hashes what it keeps, saves and loads whole, and is dormant until a realm's record is put", () => {
  const s = new OrgsStore();
  assert.ok(s.dormant());
  const r = orgsOf(world)!.realmsKept()[0]!,
    rec = orgsOf(world)!.of(r) as RealmOrgs;
  s.put(r, structuredClone(rec));
  assert.ok(!s.dormant());
  const t = new OrgsStore();
  t.load(JSON.parse(JSON.stringify(s.save())));
  const a = new Hasher(),
    b = new Hasher();
  s.hashInto(a);
  t.hashInto(b);
  assert.equal(a.hex(), b.hex());
  assert.deepEqual(t.of(r), s.of(r));
});

test("a realm's Groups tab, each group's page with its follow and pin, and the words of its events never say how", () => {
  const store = orgsOf(world)!,
    realm = store.realmsKept().find((r) => (store.of(r)?.orgs.length ?? 0) > 0);
  assert.ok(realm, "a realm with groups");
  const page = pageOf(world, realm!),
    tab = page.tabs.find((t) => t.id === "groups");
  assert.ok(tab, page.tabs.map((t) => t.id).join(","));
  const v = store.of(realm!)!;
  for (const g of v.orgs) {
    const ref = orgRef(realm!, g.event),
      p = pageOf(world, ref);
    assert.equal(p.kind, "family", `${ref} ${p.title}`);
    assert.ok(p.followable, `${ref} can be followed`);
    assert.equal(p.pin?.ref, ref);
  }
  const said = world.events
    .all()
    .filter((e) => e.type.startsWith("groups."))
    .map((e) => claimOf(world, e.id));
  assert.ok(said.length > 0);
  for (const s of said) {
    assert.ok(!/\bhow to\b|recipe|assemble|load the|aim the/i.test(s), s);
    assert.ok(!s.includes("groups."), s);
  }
});

test("where its people choose, an interest no house speaks for carries a party into its elections; the fled hold one hard land; the learned band", () => {
  const p = [...politiesOf(world).living()].sort((a, b) => b.members.length - a.members.length)[0]!,
    ctx = populationContext(world),
    store = orgsOf(world)!;
  // (Rule by choice and voice wide; its farmers' great house gone; its bound many; writing and the learned in every land; a hard land.)
  (p as { succession: number }).succession = 1;
  const o = orderOf(world)!.of(p.ref)!;
  o.held = [40, 85, 80, 60];
  o.legitimacy = 0.6;
  // (And a seat that reaches its lands, as one that votes and writes does: an old seat with clerks and readers, nothing skimmed,
  // a treasury that takes a fifth of what its people earn, lands that bear it no grudge. Under a seat thirty years old that
  // reaches four parts in ten, its towns' own rule (a commune) is worth more than the learned's band, and the eight groups a
  // realm keeps are full before the learned society rises: the rule's answer to a thin reach, and not this test's matter.)
  o.corruption = 0;
  o.crisis = null;
  (p as { founded: number }).founded = yearOfMoment(world.now) - 100;
  for (const c of p.members) lettersOf(world)?.set(c, 0.8);
  const clerks = PRINCIPLES.find((x) => x.id === "bureaucracy")!;
  loreOf(world).learn(p.seat, "bureaucracy", { year: 1, event: p.event }, clerks);
  const treasury = moneyStore(world, TREASURY_STORE)!,
    takes = [...(treasury.get(p.ref) ?? new Array<number>(33).fill(0))];
  takes[FISC.base + 3] = Math.max(1, takes[FISC.base + 3]!);
  takes[FISC.take + 3] = 0.2 * takes[FISC.base + 3]!;
  takes[FISC.deficit] = 0;
  treasury.set(p.ref, takes);
  for (const c of p.members) politiesOf(world).setDiscontent(c, { level: 0, cause: null });
  const hv = housesOf(world)?.of(p.ref) as { houses: { origin: number }[] } | undefined;
  if (hv) hv.houses = hv.houses.filter((h) => h.origin !== 6);
  for (const c of p.members) landOf(orderOf(world)!, c).shares[0] = 0.3;
  const writing = PRINCIPLES.find((x) => x.id === "writing")!;
  for (const c of p.members)
    loreOf(world).learn(c, "writing", { year: 1, event: p.event }, writing);
  for (const c of p.members) cultureRows(world, ACADEMY_STORE)!.set(c, [3000, 3000, 0, 0, 0, 1]);
  const hard = p.members.find((c) => c !== p.seat) ?? p.seat,
    relief = reliefOf(ctx.generated),
    was = relief[hard]!;
  relief[hard] = 2500;
  let year = yearOfMoment(world.now) + 11;
  while ((refNumber(p.ref) + year + 2) % ORG.every !== 0) year++;
  // (Reckoned until the slower stakes have had their turn: a land raises at most two groups a reckoning.)
  // (And once more after all three are there: a group risen in a reckoning is weighed, its hold on its votes, at its next.)
  for (let k = 0, last = 8; k < last; k++) {
    // (Its reach is the year's, kept: reckoned as order.year does before the groups' turn, of the realm as made above.)
    reckonReach(ctx, p);
    groupsYear(ctx, simTime((year + ORG.every * k + 1) * YEAR));
    const now: string[] = store.of(p.ref)?.orgs.map((g) => kindName(g)) ?? [];
    if (
      last === 8 &&
      ["party", "maroon community", "learned society"].every((x) => now.includes(x))
    )
      last = k + 2;
  }
  relief[hard] = was;
  const v = store.of(p.ref)!,
    kinds = v.orgs.map((g) => kindName(g));
  assert.ok(kinds.includes("party"), kinds.join(","));
  assert.ok(orgPartyOf(world, p.ref, "farmers") > 0);
  const maroons = v.orgs.find((g) => kindName(g) === "maroon community");
  assert.ok(maroons, kinds.join(","));
  assert.equal(maroons.lands.length, 1);
  assert.ok(orgRefugeOf(world, maroons.home) >= 0.3, `${orgRefugeOf(world, maroons.home)}`);
  const society = v.orgs.find((g) => kindName(g) === "learned society");
  assert.ok(
    society,
    `${kinds.join(",")} gather ${v.gather.join(",")} gone ${v.gone.map((g) => g.name + ":" + g.how).join(",")}`,
  );
  assert.ok(orgInquiryOf(world, society.home) > 0);
  // (Its next election: the farmers' party puts one of its own forward and holds their votes.)
  const votes = electionsOf(world)!;
  votes.forget(p.ref);
  electionsYear(ctx, simTime((year + 60) * YEAR));
  const next = votes.of(p.ref)!.next;
  electionsYear(ctx, simTime((next + 1) * YEAR));
  const last = votes.of(p.ref)?.past.at(-1);
  assert.ok(last && last.votes.some(([g]) => g === "farmers"), JSON.stringify(last?.votes));
});

test("a faith's devout whose seat holds it withdraw into monastic orders, each on one land, tied to its temple", () => {
  const store = orgsOf(world)!,
    orders = store
      .realmsKept()
      .flatMap((r) => store.of(r)!.orgs.filter((g) => kindName(g) === "monastic order"));
  if (!orders.length) {
    // (None in this world's own history yet: the seat's faith given a teaching temple, its lands its own.)
    const p = [...politiesOf(world).living()]
        .sort((a, b) => a.members.length - b.members.length)
        .at(-1)!,
      faith = beliefOf(world).of(p.seat).faith;
    assert.ok(faith, "a faith at the seat");
    cultureRows(world, TEMPLE_STORE)!.set(
      refNumber(faith),
      [400, 10000, 2000, 0, 600, 20000, 2, 1],
    );
    let year = yearOfMoment(world.now) + 40;
    while ((refNumber(p.ref) + year + 2) % ORG.every !== 0) year++;
    groupsYear(populationContext(world), simTime((year + 1) * YEAR));
  }
  const all = store
    .realmsKept()
    .flatMap((r) => store.of(r)!.orgs.filter((g) => kindName(g) === "monastic order"));
  assert.ok(all.length > 0);
  for (const g of all) {
    assert.equal(g.lands.length, 1);
    assert.ok(g.identity.startsWith("faith:"), g.identity);
  }
});
