// Deeds (rules/deeds.ts; sim/order/deeds.ts): a group or a body acting on someone the world keeps by name. The rules as pure
// functions (whom an aim is against, whether a group strikes, how a blow goes against a guard, what it costs, a court's
// sentence, those it holds); and on a real world, a blow at a ruler told in words with the succession standing on it, and a
// court's sentence kept by name.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AIM,
  DEED,
  DOES,
  ORG_AIMS,
  againstOf,
  blowChance,
  guardOf,
  harshOf,
  heldBy,
  policedReach,
  sentenceOf,
  strikeCost,
  strikeOutcome,
  strikeReach,
  walkoutOf,
} from "../../src/rules/index.ts";
import { YEAR, yearOfMoment, type Ref } from "../../src/kernel/index.ts";
import {
  DEED_EVENTS,
  GROUP_ACT_YEARS,
  GROUP_HAND_EVENTS,
  bodiesOf,
  charterProblem,
  charterTarget,
  orgsOf,
  politiesOf,
  populationContext,
  sentence,
  strikes,
  type Striker,
} from "../../src/sim/index.ts";
import { EARTH } from "../../src/host/index.ts";
import { why } from "../../src/causal/index.ts";
import { universeWorld } from "../host/worlds.ts";

const aims = (o: Partial<Record<(typeof ORG_AIMS)[number], number>>) =>
  ORG_AIMS.map((a) => o[a] ?? 0);

test("whom a group is against is read off what it does; a faith's only where it is pressed", () => {
  const rebels = againstOf(aims({ rebel: 800, aid: 200 }), AIM, false);
  assert.equal(rebels[0]!.at.who, "ruler");
  assert.ok(Math.abs(rebels.reduce((s, x) => s + x.weight, 0) - 0.8) < 1e-9);
  assert.equal(againstOf(aims({ aid: 600, lend: 400 }), AIM, false).length, 0);
  assert.equal(againstOf(aims({ worship: 1000 }), AIM, false).length, 0);
  const sect = againstOf(aims({ worship: 1000 }), AIM, true);
  assert.deepEqual(sect[0]!.at, { who: "head", does: "worship" });
});

test("a group strikes the likelier the more it is against someone, the harder pressed and the longer; never below its least will", () => {
  assert.equal(blowChance(DEED.willLeast - 0.01, 1, 400, 12, 50), 0);
  const calm = blowChance(0.8, 0, 400, 12, 5),
    pressed = blowChance(0.8, 1, 400, 12, 5);
  assert.ok(pressed > calm && calm > 0);
  assert.ok(blowChance(0.8, 1, 400, 12, 20) > pressed);
  assert.ok(blowChance(0.8, 1, 12, 12, 5) < pressed);
  assert.ok(pressed < 0.15, `a full crew pressed hard strikes in ${pressed} of five-year spans`);
});

test("an honest, manned watch guards; a bought one does not; a boss is guarded by his own", () => {
  const none = guardOf("ruler", null, 0),
    hand = guardOf("ruler", null, 1),
    honest = guardOf("ruler", { watch: 1, honest: 1 }, 0),
    bought = guardOf("ruler", { watch: 1, honest: 0 }, 1);
  assert.ok(honest > hand && hand > none);
  assert.equal(bought, none);
  assert.equal(guardOf("boss", { watch: 1, honest: 1 }, 1), guardOf("boss", null, 0));
  assert.ok(guardOf("boss", null, 0, 0.3) > guardOf("boss", null, 0));
  // (Hidden and armed, near: the surest blow; and it kills only past the guard.)
  assert.ok(strikeReach(true, true, true) > strikeReach(false, true, true));
  assert.ok(strikeReach(true, true, true) > strikeReach(true, true, false));
  assert.equal(strikeOutcome(0.6, 0.5, 0.29), "killed");
  assert.notEqual(strikeOutcome(0.6, 0.5, 0.31), "killed");
  assert.equal(strikeOutcome(0.6, 0.95, 0.99), "survived");
  assert.ok(strikeCost("foiled", 1) > strikeCost("killed", 1));
  assert.ok(strikeCost("killed", 1) > strikeCost("killed", 0));
});

test("a court's sentence goes by the charge, its realm's justice and whether its judges are bought", () => {
  const f = { grave: 0.8, harsh: 0.9, bought: 0, purse: true, decree: false };
  // (Bought judges fine one with a purse; honest ones do not.)
  assert.equal(sentenceOf(0.3, { ...f, bought: 0.9 }), "fined");
  assert.notEqual(sentenceOf(0.3, f), "fined");
  // (A grave charge under a harsh seat: death for the most part; a light one under a mild seat never.)
  let deaths = 0,
    mild = 0,
    labour = 0;
  for (let i = 0; i < 100; i++) {
    const u = (i + 0.5) / 100;
    if (sentenceOf(u, f) === "death") deaths++;
    if (sentenceOf(u, { ...f, grave: 0, harsh: 0 }) === "death") mild++;
    if (sentenceOf(u, { ...f, grave: 0.2, decree: true }) === "labour") labour++;
  }
  assert.ok(deaths >= 40 && deaths <= 60, `${deaths} of 100 put to death`);
  assert.equal(mild, 0);
  assert.ok(labour >= 30, `${labour} of 100 put to labour under a seat that rules by decree`);
  assert.ok(harshOf(1, 0) > harshOf(0.2, 0.8));
  assert.ok(heldBy(1e6, 150, 1, 1, 0) > heldBy(1e6, 150, 1, 0, 0));
  assert.ok(heldBy(1e6, 150, 1, 0, 0.001) > heldBy(1e6, 150, 1, 0, 0));
  assert.equal(heldBy(1e6, 150, 0, 1, 0), 0);
});

test("workers aggrieved feel what they are behind the more; a watch makes a seat's reach against the outlawed", () => {
  const f = { lag: 0.08, organised: 0.4, fund: 1 };
  assert.equal(walkoutOf(f), 0);
  assert.ok(walkoutOf({ ...f, grievance: 0.8 }) > 0);
  assert.equal(walkoutOf({ lag: 0, organised: 0.4, fund: 1, grievance: 1 }), 0);
  assert.ok(policedReach(0.6, 1, 1) > 0.6);
  assert.ok(policedReach(0.6, 1, 0) < 0.6);
  assert.ok(policedReach(0.6, 0, 1) < 0.6);
});

test("on a real world: a blow at a ruler is told in words, costs the group men, and the succession stands on it", () => {
  const world = universeWorld(EARTH, "first light", 240),
    ctx = populationContext(world),
    t = world.now;
  let killed = 0,
    told = 0;
  for (const p of politiesOf(world).living()) {
    const was = p.ruler.name,
      g: Striker = {
        crime: false,
        id: 7,
        name: "Test",
        kind: "insurgents",
        event: p.event,
        lands: [p.seat],
        members: 400,
        armed: true,
        hidden: true,
        identity: "",
        against: [{ at: { who: "ruler" }, weight: 1 }],
      },
      hit = strikes(
        ctx,
        p,
        { crime: false, id: g.id, will: 1, members: g.members, striker: () => g },
        { pressed: 1, capacity: 0.2, crew: 12, span: 50 },
        t,
      );
    if (!hit) continue;
    told++;
    const e = world.events.get(hit.event)!,
      words = why(world, hit.event).claim;
    assert.equal(e.type, DEED_EVENTS.struck.type);
    assert.ok(words.includes(was), words);
    assert.ok(!/\(t=\d+\)/.test(words), words);
    assert.ok(hit.lost >= 0 && hit.lost <= 400);
    if (hit.outcome !== "killed") {
      assert.equal(p.ruler.name, was);
      continue;
    }
    killed++;
    assert.equal(e.importance, 5);
    // (The seat passed, and its passing names the blow among its causes.)
    const after = world.events
      .all()
      .filter((x) => x.type === "polity.succession" && x.subjects[0] === p.ref)
      .at(-1)!;
    assert.ok(after.causes.some((c) => c.ref === hit.event));
    assert.equal((after.data as { old: string }).old, was);
    if (killed >= 3) break;
  }
  assert.ok(told >= 5, `${told} blows told`);
  assert.ok(killed >= 1, `${killed} rulers killed`);
});

test("on a real world: one taken comes before the court of their land, where it keeps one, and is kept by name if held", () => {
  const world = universeWorld(EARTH, "first light", 240),
    ctx = populationContext(world),
    store = bodiesOf(world)!;
  world.runTo(world.now + 20 * YEAR);
  let tried = 0,
    held = 0,
    none = 0;
  for (const p of politiesOf(world).living()) {
    const out = sentence(
      ctx,
      p,
      p.seat,
      {
        name: "Aro Test",
        what: "head of the Test insurgents",
        ref: `boss:${p.ref}:${p.event}`,
        charge: "rising against the seat",
        grave: 0.8,
        purse: false,
      },
      null,
      world.now,
      3,
    );
    if (!out) {
      none++;
      assert.ok(
        !store
          .of(p.ref)
          ?.bodies.some((b) => b.does === DOES.judge && b.since < yearOfMoment(world.now)),
      );
      continue;
    }
    tried++;
    const words = why(world, out.event as Ref).claim;
    assert.ok(words.includes("Aro Test") && words.includes("rising against the seat"), words);
    if (out.sentence === "held" || out.sentence === "labour") {
      held++;
      assert.ok(store.of(p.ref)!.bodies.some((b) => b.inmates?.some((x) => x.n === "Aro Test")));
    }
  }
  assert.ok(tried >= 5, `${tried} tried (${none} realms keep no court)`);
  assert.ok(held >= 1, `${held} held by name`);
});

test("the hand on a group: the god outlaws it and it is held so until the years run out; a ruler charters one of their own realm's", () => {
  const world = universeWorld(EARTH, "first light", 240),
    store = orgsOf(world)!;
  let done = 0;
  for (const p of politiesOf(world).living()) {
    const g = store.of(p.ref)?.orgs.find((x) => x.standing === 1);
    if (!g) continue;
    const before = world.domainHashes().find(([d]) => d === "order")?.[1];
    world.submit("act.group", { group: g.event, act: "outlaw" });
    world.runTo(world.now + 1);
    const now = store.of(p.ref)!.orgs.find((x) => x.event === g.event)!;
    assert.equal(now.standing, 0);
    assert.equal(now.decree, 0);
    assert.equal(now.decreeUntil, yearOfMoment(world.now) + GROUP_ACT_YEARS);
    assert.notEqual(world.domainHashes().find(([d]) => d === "order")?.[1], before);
    const told = world.events
      .all()
      .filter((e) => e.type === GROUP_HAND_EVENTS.act.type)
      .at(-1)!;
    assert.match(why(world, told.id).claim, /The god outlawed the /);
    // (Its ruler lets it be again; another realm's ruler cannot.)
    assert.throws(() =>
      world.submit("reign.charter", {
        realm: p.ref,
        ruler: "No One",
        target: g.event,
        to: "let be",
      }),
    );
    world.submit("reign.charter", {
      realm: p.ref,
      ruler: p.ruler.name,
      target: g.event,
      to: "charter",
    });
    world.runTo(world.now + 1);
    assert.equal(store.of(p.ref)!.orgs.find((x) => x.event === g.event)!.standing, 2);
    const word = world.events
      .all()
      .filter((e) => e.type === GROUP_HAND_EVENTS.charter.type)
      .at(-1)!;
    assert.match(why(world, word.id).claim, /granted the .* its charter/);
    if (++done >= 2) break;
  }
  assert.ok(done >= 1, `${done} groups acted on`);
});

test("on a real world: a blow at one who heads a body falls, some of the time, on its house: told, its hands scattered", () => {
  const world = universeWorld(EARTH, "first light", 240),
    ctx = populationContext(world),
    store = bodiesOf(world)!;
  world.runTo(world.now + 20 * YEAR);
  let razed = 0,
    tried = 0;
  for (const p of politiesOf(world).living()) {
    const watch = store.of(p.ref)?.bodies.find((b) => b.does === DOES.order && b.since < 255);
    if (!watch) continue;
    for (let id = 1; id <= 12 && razed < 3; id++) {
      const before = store.of(p.ref)!.bodies.find((b) => b.event === watch.event)!.staff,
        g: Striker = {
          crime: false,
          id,
          name: "Test",
          kind: "insurgents",
          event: p.event,
          lands: [watch.home],
          members: 400,
          armed: true,
          hidden: true,
          identity: "",
          against: [{ at: { who: "head", does: "order" }, weight: 1 }],
        },
        hit = strikes(
          ctx,
          p,
          { crime: false, id, will: 1, members: 400, striker: () => g },
          { pressed: 1, capacity: 0.2, crew: 12, span: 50 },
          world.now,
        );
      if (!hit) continue;
      tried++;
      const e = world.events.get(hit.event)!;
      if (e.type !== DEED_EVENTS.razed.type) continue;
      razed++;
      const words = why(world, hit.event).claim;
      assert.match(words, /struck at the house of the .* in /);
      assert.ok(!/\(t=\d+\)/.test(words), words);
      assert.ok(store.of(p.ref)!.bodies.find((b) => b.event === watch.event)!.staff <= before);
    }
    if (razed >= 3) break;
  }
  assert.ok(tried >= 10, `${tried} blows`);
  assert.ok(razed >= 1, `${razed} houses struck of ${tried} blows`);
});

test("a ruler's word falls on a faith's seat in their realm by the faith's name, and not on another realm's", () => {
  const world = universeWorld(EARTH, "first light", 240),
    store = bodiesOf(world)!;
  world.runTo(world.now + 20 * YEAR);
  let done = 0;
  for (const p of politiesOf(world).living()) {
    const clergy = store.of(p.ref)?.bodies.find((b) => b.does === DOES.worship && b.keeper);
    if (!clergy) continue;
    const at = charterTarget(world, p.ref, clergy.keeper);
    assert.ok(at && at.kind === "body" && at.g.keeper === clergy.keeper);
    assert.equal(
      charterProblem(world, { realm: p.ref, ruler: "No One", target: clergy.keeper, to: "outlaw" }),
      "No One no longer rules there",
    );
    world.submit("reign.charter", {
      realm: p.ref,
      ruler: p.ruler.name,
      target: clergy.keeper,
      to: "outlaw",
    });
    world.runTo(world.now + 1);
    const now = store.of(p.ref)!.bodies.find((b) => b.event === at!.g.event)!;
    assert.equal(now.standing, 0);
    assert.equal(now.decree, 0);
    if (++done >= 2) break;
  }
  assert.ok(done >= 1, `${done} seats outlawed`);
});
