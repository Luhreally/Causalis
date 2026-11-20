// Institutions (rules/institutions.ts; sim/order/institutions.ts): the basis as pure rules (who pays decides whom a body answers
// to; what a land must have for a thing done to stand at its age; a title read off the basis; the older groups and the
// underworld's kinds in the same basis; honesty from pay and oversight; a strike only where a wage lags and its people are many);
// and on a real world's first centuries, bodies founded from what is paid for, each told by its basis, their lands' rows within
// their bounds, what the older systems read of them, the pages with their follow and pin, the god's hand, and the store's round
// trip.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ANSWERS,
  DOES,
  DOES_ROWS,
  FUND,
  INST,
  INST_ANSWERS,
  INST_DOES,
  INST_FORMED,
  INST_FUNDS,
  OCC,
  ORG_AIMS,
  answersTo,
  basisOfAim,
  basisOfCrime,
  basisWords,
  canStand,
  funderOf,
  honestyOf,
  instTitle,
  roofGain,
  staffKept,
  walkoutOf,
  walkoutWon,
  type TitleFacts,
} from "../../src/rules/index.ts";
import { Hasher, YEAR, simTime, yearOfMoment, type Ref } from "../../src/kernel/index.ts";
import {
  BODY_ROW,
  BodiesStore,
  actOnBody,
  bodiesOf,
  bodiesYear,
  bodyLandsStore,
  bodyTitle,
  marketsOf,
  politiesOf,
  courtIn,
  populationContext,
  strikeIn,
  watchIn,
  worksIn,
  worksProfitOf,
  type Body,
  type RealmBodies,
} from "../../src/sim/index.ts";
import { almsSparedIn, lawHeldIn } from "../../src/sim/order/institutions-kept.ts";
import { EARTH } from "../../src/host/index.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { claimOf } from "../../src/host/inspect/words.ts";
import { bodyOf, bodyRef } from "../../src/host/bodies.ts";
import { notablesIn } from "../../src/host/inspect/notables.ts";
import { townLifeOf } from "../../src/host/inspect/townlife.ts";
import { universeWorld } from "../host/worlds.ts";

// —— The rules ——————————————————————————————————————————————————————————————

test("who pays decides whom a body answers to, and the payer who can pay most keeps it", () => {
  assert.equal(answersTo("dues"), "members");
  assert.equal(answersTo("customers"), "owners");
  assert.equal(answersTo("treasury"), "seat");
  assert.equal(answersTo("patron"), "house");
  assert.equal(answersTo("tithes"), "faith");
  assert.equal(answersTo("plunder"), "no one");
  const pay = new Array<number>(INST_FUNDS.length).fill(0);
  assert.equal(funderOf("teach", pay), null, "no one pays, no one keeps it");
  pay[FUND.tithes] = 100;
  assert.equal(funderOf("teach", pay)?.fund, "tithes");
  pay[FUND.customers] = 200;
  assert.equal(funderOf("teach", pay)?.fund, "customers");
  // (Order is kept for the treasury or not at all here: those who keep their own are the groups' militia.)
  const dues = new Array<number>(INST_FUNDS.length).fill(0);
  dues[FUND.dues] = 1e6;
  assert.equal(funderOf("order", dues), null);
});

test("a thing done stands only where its land has what the work needs at its age", () => {
  const camp = { writing: false, coin: false, deals: 0.2, readers: 0, town: 300 },
    town = { writing: true, coin: false, deals: 0.3, readers: 0.05, town: 6000 },
    city = { writing: true, coin: true, deals: 0.6, readers: 0.3, town: 60_000 };
  // (A chiefdom's camp: its clergy at most.)
  assert.ok(canStand("worship", camp));
  for (const d of ["make", "word", "insure", "judge", "teach", "order"] as const)
    assert.ok(!canStand(d, camp), d);
  // (A writing town without coin: a watch, a court, a school, a guild; no works, no paper, no underwriters.)
  for (const d of ["order", "judge", "teach", "craft"] as const) assert.ok(canStand(d, town), d);
  for (const d of ["make", "word", "insure"] as const) assert.ok(!canStand(d, town), d);
  for (const d of INST_DOES.slice(0, INST_FORMED)) assert.ok(canStand(d, city), d);
  // (Pay keeps hands at the work's keep; a works gains by its size, a priest does not.)
  assert.equal(staffKept("order", 0, 10), 0);
  assert.ok(staffKept("order", 1200, 10) >= 99);
  assert.ok(staffKept("make", 1e6, 10) > 1e6 / (10 * DOES_ROWS.make.keep));
  assert.equal(staffKept("worship", 1e6, 10), 1e6 / (10 * DOES_ROWS.worship.keep));
});

test("a body's title is read off its basis: the same work is another word by who pays, how large and at what age", () => {
  const f: TitleFacts = {
      staff: 20,
      writing: false,
      engines: false,
      signal: false,
      readers: 0.1,
      of: "",
      higher: false,
    },
    order = { does: "order", fund: "treasury", answers: "seat", standing: 2 } as const,
    make = { does: "make", fund: "customers", answers: "owners", standing: 1 } as const,
    teach = { does: "teach", fund: "tithes", answers: "faith", standing: 1 } as const,
    word = { does: "word", fund: "customers", answers: "owners", standing: 1 } as const;
  assert.equal(instTitle(order, f), "watch");
  assert.equal(instTitle(order, { ...f, writing: true, staff: 5000 }), "constabulary");
  assert.equal(instTitle(order, { ...f, writing: true, engines: true, staff: 5000 }), "police");
  assert.equal(instTitle(make, { ...f, of: "iron", staff: 40 }), "iron workshop");
  assert.equal(instTitle(make, { ...f, of: "iron", staff: 4000 }), "iron manufactory");
  assert.equal(instTitle(make, { ...f, of: "iron", staff: 4000, engines: true }), "iron company");
  assert.equal(instTitle({ ...make, answers: "seat" }, { ...f, of: "iron" }), "state iron works");
  assert.equal(instTitle(teach, f), "temple school");
  assert.equal(instTitle({ ...teach, fund: "customers", answers: "owners" }, f), "school");
  assert.equal(instTitle({ ...teach, answers: "house" }, { ...f, higher: true }), "college");
  assert.equal(instTitle(teach, { ...f, higher: true, staff: 500 }), "university");
  assert.equal(instTitle(word, f), "newsletter");
  assert.equal(instTitle(word, { ...f, engines: true }), "newspaper");
  assert.equal(instTitle({ ...word, standing: 0 }, f), "underground press");
  assert.equal(
    instTitle({ ...word, answers: "house" }, { ...f, signal: true }),
    "house broadcaster",
  );
  assert.match(
    basisWords(make, "iron"),
    /^It makes and sells iron, is kept by those who buy of it and answers to its owners\.$/,
  );
});

test("the older groups' aims and the underworld's kinds are said in the same basis", () => {
  const f = { standing: 1, patron: false, basis: "poor" } as const;
  for (const aim of ORG_AIMS) {
    const b = basisOfAim(aim, f);
    assert.ok((INST_DOES as readonly string[]).includes(b.does), aim);
    assert.ok((INST_ANSWERS as readonly string[]).includes(b.answers), aim);
  }
  assert.deepEqual(basisOfAim("prey", f), {
    does: "take",
    fund: "plunder",
    answers: "no one",
    standing: 1,
  });
  // (Licensed against a foe's ships, the same crew fights for a treasury's pay.)
  assert.equal(basisOfAim("prey", { ...f, patron: true }).fund, "treasury");
  assert.equal(basisOfAim("hire", { ...f, patron: true }).does, "fight");
  assert.equal(basisOfAim("hire", { ...f, patron: true }).answers, "no one");
  assert.equal(basisOfAim("guard", f).does, "order");
  assert.equal(basisOfAim("guard", f).answers, "members");
  assert.equal(basisOfAim("aid", f).fund, "dues");
  assert.equal(basisOfAim("inquire", f).does, "teach");
  assert.equal(basisOfCrime("cartel").does, "deal");
  assert.equal(basisOfCrime("protection").fund, "plunder");
  assert.equal(basisOfCrime("badge").does, "order");
  assert.equal(basisOfCrime("badge").answers, "no one");
});

test("a watch is as honest as it is paid and watched; a strike needs a wage behind and many organised", () => {
  const paid = honestyOf({ paid: 1.2, corruption: 0.1, oversight: 0.8, bought: 0 }),
    unpaid = honestyOf({ paid: 0.3, corruption: 0.1, oversight: 0.8, bought: 0 }),
    bought = honestyOf({ paid: 1.2, corruption: 0.1, oversight: 0.8, bought: 0.8 });
  assert.ok(paid > 0.7 && unpaid < paid && bought < paid, `${paid} ${unpaid} ${bought}`);
  assert.equal(walkoutOf({ lag: 0.05, organised: 0.5, fund: 1 }), 0);
  assert.equal(walkoutOf({ lag: 0.4, organised: 0.05, fund: 1 }), 0);
  const lost = walkoutOf({ lag: 0.4, organised: 0.5, fund: 1 });
  assert.ok(lost > 0 && lost <= INST.strikeCosts, `${lost}`);
  assert.ok(walkoutWon(0.9, 0.1, 0) < walkoutWon(0.1, 0.9, 1));
  assert.equal(roofGain(0, true), 1);
  assert.ok(roofGain(1, true) > roofGain(1, false) && roofGain(1, true) <= 1 + INST.roofEngines);
});

// —— On a real world ——————————————————————————————————————————————————————————

const world = universeWorld(EARTH, "first light", 240);

test("on a world's first centuries bodies are founded from what is paid for: clergy, a watch where a treasury pays, guilds; no works or papers yet", () => {
  const store = bodiesOf(world);
  assert.ok(store, "the store is registered");
  const ctx = populationContext(world),
    year = yearOfMoment(world.now);
  let all = 0;
  const titles = new Map<string, number>();
  for (const realm of store.realmsKept()) {
    const v: Readonly<RealmBodies> = store.of(realm)!;
    assert.ok(v.bodies.length <= INST.most + 2, `${realm} ${v.bodies.length}`);
    for (const g of v.bodies) {
      all++;
      const title = bodyTitle(ctx, g as Body);
      titles.set(title, (titles.get(title) ?? 0) + 1);
      assert.ok(title.length > 0 && g.name.length > 0);
      assert.ok(g.does >= 0 && g.does < INST_FORMED, `${title} does ${g.does}`);
      assert.ok(g.leader.name.length > 0 && g.leader.born < year, g.leader.name);
      assert.ok(g.staff >= 0 && g.lands.length >= 1 && g.lands.length <= INST.lands);
      assert.ok(g.lands[0] === g.home, "its home is the first of its lands");
      assert.ok(g.quality >= 0 && g.quality <= 1000 && g.share >= 0 && g.share <= 1000);
      // (Founded, or parted from another at its head's passing: either is the event its page is made of.)
      assert.match(world.events.get(g.event)?.type ?? "", /^bodies\.(founded|parted)$/);
      // (Whom it answers to follows from who pays, but where the seat holds its temple or has taken a works.)
      if (g.answers !== ANSWERS.seat)
        assert.equal(INST_ANSWERS[g.answers], answersTo(INST_FUNDS[g.fund]!), title);
    }
  }
  assert.ok(all > 50, `${all} bodies`);
  const has = (re: RegExp) => [...titles.keys()].some((t) => re.test(t));
  assert.ok(has(/clergy|priesthood/), [...titles.keys()].join(", "));
  assert.ok(has(/watch|constabulary/), [...titles.keys()].join(", "));
  // (No engines and little coin at year 240: no company, no newspaper, no police.)
  assert.ok(
    !has(/company|newspaper|police|news service|broadcaster/),
    [...titles.keys()].join(", "),
  );
});

test("each land's row is within its bounds, and the older systems read nothing where none is kept", () => {
  const rows = bodyLandsStore(world)!;
  assert.ok(rows.size > 0);
  for (const k of rows.keys()) {
    const cell = Number(k),
      row = rows.get(cell)!;
    for (const i of [
      BODY_ROW.works,
      BODY_ROW.craft,
      BODY_ROW.union,
      BODY_ROW.watch,
      BODY_ROW.honest,
      BODY_ROW.court,
      BODY_ROW.clergy,
      BODY_ROW.heal,
      BODY_ROW.word,
    ])
      assert.ok(row[i]! >= 0 && row[i]! <= 1000, `${k} ${i} ${row[i]}`);
    assert.ok(row[BODY_ROW.bought]! <= row[BODY_ROW.court]!);
    assert.ok(row[BODY_ROW.bodies]! >= 1);
    assert.ok(worksIn(world, cell).share <= INST.worksEngines);
    assert.ok(almsSparedIn(world, cell) <= INST.spares + 1e-9);
    assert.ok(lawHeldIn(world, cell) <= INST.fills + 1e-9);
    assert.ok(watchIn(world, cell).watch <= 1 && courtIn(world, cell).court <= 1);
  }
  // (A land no body holds: every reader gives what the world did before.)
  const empty = 999_999;
  assert.deepEqual(worksIn(world, empty), { share: 0, firms: 0 });
  assert.equal(strikeIn(world, empty, 1), 0);
  assert.equal(almsSparedIn(world, empty), 0);
  assert.equal(lawHeldIn(world, empty), 0);
  assert.equal(worksProfitOf(world, "pol:0:999999" as Ref, "none"), 0);
});

test("a realm's and a land's Institutions tabs, each body's page with its follow and pin, its head a key figure of its town, and words that never say undefined", () => {
  const store = bodiesOf(world)!,
    realm = store
      .realmsKept()
      .sort(
        (a, b) => store.of(b)!.bodies.length - store.of(a)!.bodies.length || (a < b ? -1 : 1),
      )[0]!,
    v: Readonly<RealmBodies> = store.of(realm)!,
    page = pageOf(world, realm),
    tab = page.tabs.find((t) => t.id === "institutions");
  assert.ok(tab, page.tabs.map((t) => t.id).join(","));
  assert.ok(tab.blocks.some((b) => b.type === "facts" && b.title === "Who does what"));
  const ctx = populationContext(world);
  for (const g of v.bodies) {
    const ref = bodyRef(g.event),
      p = pageOf(world, ref);
    assert.equal(p.kind, "family", `${ref} ${p.title}`);
    assert.ok(p.followable, `${ref} can be followed`);
    assert.equal(p.pin?.ref, ref);
    assert.ok(!/undefined|NaN/.test(JSON.stringify(p)), p.title);
    assert.equal(bodyOf(world, ref)?.record?.id, g.id);
    const land = pageOf(world, ctx.provinces.get(g.home)!.ref);
    assert.ok(
      land.tabs.some((t) => t.id === "institutions"),
      `${p.title}: its home's page lists it`,
    );
    // (Its head lives at its home land's first town: a key figure there, with a page of their own.)
    const town = ctx.settlements
      .inProvince(g.home)
      .filter((s) => s.population > 0)
      .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))[0];
    if (!town) continue;
    const head = notablesIn(world, town.ref).find((n) => n.of.ref === ref);
    if (head) {
      assert.equal(head.name, g.leader.name);
      assert.equal(pageOf(world, head.ref).kind, "person");
    }
    for (const going of townLifeOf(world, town.ref).goings)
      assert.ok(!/undefined|NaN/.test(JSON.stringify(going)), going.words);
  }
  const said = world.events
    .all()
    .filter((e) => e.type.startsWith("bodies."))
    .map((e) => claimOf(world, e.id));
  assert.ok(said.length > 0);
  for (const s of said) assert.ok(!/undefined|NaN|\bnameless\b/.test(s), s);
  const ledger = pageOf(world, "world:ledger#institutions").tabs.find(
    (t) => t.id === "institutions",
  );
  assert.ok(ledger && ledger.blocks.some((b) => b.type === "table"), "the ledger's tab");
});

test("the god's hand on a body is kept on it and told; a realm stepped again keeps its bounds; the store saves and loads whole", () => {
  const store = bodiesOf(world)!,
    ctx = populationContext(world),
    // (A living realm's: one ended keeps its record only until its bodies are sent after their lands.)
    realm = store
      .realmsKept()
      .find((r) => store.of(r)!.bodies.length > 0 && politiesOf(world).get(r)?.ended === null)!,
    g = store.of(realm)!.bodies[0]!,
    year = yearOfMoment(world.now),
    told = actOnBody(ctx, g.event, "bless");
  assert.ok(told, "the act is told");
  assert.equal(world.events.get(told!)?.type, "act.body");
  const now = store.of(realm)!.bodies.find((x) => x.event === g.event)!;
  assert.equal(now.hand, 1);
  assert.ok((now.handUntil ?? 0) > year);
  assert.equal(actOnBody(ctx, "ev:0:999999999" as Ref, "curse"), null);
  // (Ten years on, every realm in its turn once: nothing out of bounds.)
  for (let y = year + 1; y <= year + INST.every; y++) bodiesYear(ctx, simTime(y * YEAR));
  for (const r of store.realmsKept()) assert.ok(store.of(r)!.bodies.length <= INST.most + 2);
  const s = new BodiesStore();
  assert.ok(s.dormant());
  s.put(realm, structuredClone(store.of(realm)) as RealmBodies);
  assert.ok(!s.dormant());
  const t = new BodiesStore();
  t.load(JSON.parse(JSON.stringify(s.save())));
  const a = new Hasher(),
    b = new Hasher();
  s.hashInto(a);
  t.hashInto(b);
  assert.equal(a.hex(), b.hex());
  assert.deepEqual(t.of(realm), s.of(realm));
  assert.equal(DOES.make, 0);
});

test("where a workers' body's wage has fallen behind what it was and it is many of its land's crafters, some strike: a year's craft lost in the year after, told won or broken", () => {
  const store = bodiesOf(world)!,
    ctx = populationContext(world),
    year = yearOfMoment(world.now) + INST.every,
    put: { realm: Ref; cell: number; event: Ref }[] = [];
  for (const p of politiesOf(world).living()) {
    const prov = ctx.provinces.get(p.seat),
      m = marketsOf(world).get(p.seat),
      crafters = prov?.occupation(OCC.crafter) ?? 0;
    if (!prov || !m || crafters < 50 || !(m.wage[OCC.crafter]! > 0)) continue;
    const was = store.of(p.ref),
      v: RealmBodies = was
        ? (structuredClone(was) as RealmBodies)
        : {
            last: year - INST.every,
            next: 1,
            need: [],
            paid: [],
            profit: [],
            reach: 0,
            told: 0,
            bodies: [],
            gone: [],
          },
      event = world.events.all().find((e) => e.type === "bodies.founded")!.id;
    v.bodies = v.bodies.filter((g) => g.does !== DOES.bargain);
    v.bodies.push({
      id: v.next++,
      name: "Test",
      does: DOES.bargain,
      fund: FUND.dues,
      answers: ANSWERS.members,
      standing: 1,
      of: 6,
      since: year - 30,
      event,
      home: p.seat,
      lands: [p.seat],
      keeper: "",
      leader: { name: "One", born: year - 40, since: year - 30 },
      leaders: 1,
      staff: Math.round(crafters * 0.6),
      wealth: 1e9,
      income: 1,
      quality: 800,
      share: 1000,
      // (Their craft's year was worth three times what it is now.)
      mark: Math.round(300 * m.wage[OCC.crafter]!),
    });
    store.put(p.ref, v);
    put.push({ realm: p.ref, cell: p.seat, event });
  }
  assert.ok(put.length >= 10, `${put.length} realms with crafters at their seat`);
  const before = world.events.all().length;
  for (let y = year - INST.every + 1; y <= year; y++) bodiesYear(ctx, simTime(y * YEAR));
  const strikes = world.events
    .all()
    .slice(before)
    .filter((e) => e.type === "bodies.strike");
  assert.ok(strikes.length >= 1, `${strikes.length} strikes of ${put.length} bodies`);
  let lost = 0;
  for (const e of strikes) {
    const d = e.data as { outcome: string; lost: number };
    assert.ok(d.outcome === "won" || d.outcome === "settled" || d.outcome === "broken");
    assert.ok(d.lost > 0 && d.lost <= INST.strikeCosts * 100);
    assert.match(claimOf(world, e.id), /struck|stopped/);
    // (Lost in the year after the reckoning that told it, and in no other.)
    const cell = put.find((x) => x.realm === e.subjects[0])!.cell,
      at = bodyLandsStore(world)!.get(cell)![BODY_ROW.strikeYear]!;
    assert.ok(at > year - INST.every && at <= year + 1, `${at}`);
    assert.ok(strikeIn(world, cell, at) > 0, "the year after");
    assert.equal(strikeIn(world, cell, at + 1), 0);
    assert.equal(strikeIn(world, cell, at - 1), 0);
    lost += strikeIn(world, cell, at);
  }
  assert.ok(lost > 0 && lost <= strikes.length * INST.strikeCosts);
});
