import { test } from "node:test";
import assert from "node:assert/strict";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  type Ref,
  type SimTime,
  type World,
} from "../../src/kernel/index.ts";
import {
  BOND,
  GENERAL,
  LAW_OF,
  POLITY_EVENTS,
  STRIFE,
  STRIFE_ACTS,
  STRIFE_EVENTS,
  breakAway,
  civilWar,
  endRealm,
  farLands,
  foil,
  landOf,
  makePopulationWorld,
  orderOf,
  politiesOf,
  populationContext,
  raiseRealm,
  realmName,
  repress,
  revolt,
  revolutionDanger,
  revolutionHolds,
  settleCivil,
  strifeOf,
  strifeYear,
  warsOf,
  type Polity,
} from "../../src/sim/index.ts";
import { why } from "../../src/causal/index.ts";

// Phase 22 M146: civil wars and revolutions. Juniper's realms sixty years on, as in the coups'
// tests: the greatest of them broken by hand or by the year of strife alone (the rest of the world
// held still), each year's draw at its own moment of year sixty.
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
/** A realm's far lands raised as a realm of their own under `cause`, as a split or a rising would. */
function raisedFrom(w: World, p: Polity, cause: Ref, t: SimTime): Polity {
  const ctx = populationContext(w),
    far = farLands(ctx, p),
    town = far.flatMap((c) => ctx.settlements.inProvince(c))[0]!;
  for (const c of far) politiesOf(w).leave(p, c);
  return raiseRealm(ctx, town, far, cause, t, p.ref)!;
}

test("a foiled general flees to the far lands, raises them under his army's rule, and marches on the seat", () => {
  const w = fresh(),
    p = greatest(w),
    ctx = populationContext(w),
    store = strifeOf(w)!,
    n = store.civil.length,
    far = farLands(ctx, p);
  assert.ok(far.length > 0 && !far.includes(p.seat), "a realm with far lands");
  for (let k = 1; k < 40 && store.civil.length === n; k++) foil(ctx, p, [], at(k * YEAR), 1);
  const c = store.civil[n]!,
    rebel = politiesOf(w).get(c.rebel)!,
    war = warsOf(w).get(c.war)!;
  assert.equal(c.kind, "general");
  assert.equal(c.loyal, p.ref);
  assert.equal(rebel.from, p.ref, "it broke from its realm");
  assert.equal(rebel.leadership, GENERAL, "its army rules it");
  assert.ok(realmName(rebel).startsWith("the protectorate of"));
  assert.ok(
    rebel.members.every((cell) => far.includes(cell)),
    "of the far lands",
  );
  assert.ok(!p.members.some((cell) => rebel.members.includes(cell)), "lost to the realm");
  assert.equal(war.attacker, rebel.ref);
  assert.equal(war.defender, p.ref);
  assert.equal(war.prize, p.seat, "it marches on the seat");
  assert.equal(war.civil, "general");
  const declared = w.events.get(war.event)!;
  assert.equal(
    w.events.get(declared.causes[0]!.ref)!.type,
    STRIFE_EVENTS.foiled.type,
    "its why: the coup foiled",
  );
  assert.match(why(w, war.event)!.claim, /rose against .* in a general's revolt/);
});

test("a rising beaten back is put down and its lands returned, or the realm is parted; one that takes the seat takes the throne", () => {
  const w = fresh(),
    p = greatest(w),
    ctx = populationContext(w),
    store = strifeOf(w)!,
    raised = w.events.emit({
      type: STRIFE_ACTS.pretender.type,
      subjects: [p.ref],
      place: null,
      data: { realm: realmName(p) },
    }),
    seen = new Set<string>();
  // Risings raised in its far lands again and again, each beaten back: put down, or parted.
  for (let k = 1; k < 30 && seen.size < 2 && farLands(ctx, p).length; k++) {
    const n = store.civil.length,
      rebel = breakAway(ctx, p, farLands(ctx, p), raised, "pretender", at(k * YEAR));
    if (!rebel) break;
    const lands = [...rebel.members],
      c = store.civil[n]!;
    assert.equal(c.kind, "pretender");
    settleCivil(ctx, warsOf(w).get(c.war)!, false, true, at(k * YEAR + 1));
    const d = w.decisions.get(
      w.events.get(c.settled!)!.causes.find((x) => w.decisions.get(x.ref))!.ref,
    )!;
    assert.equal(d.rule, "strife.subdue");
    assert.ok(
      d.factors.some((f) => f.name === "a rising beaten back" && f.contribution > 0),
      "beaten back, weighed",
    );
    seen.add(c.outcome!);
    if (c.outcome === "subdued") {
      assert.notEqual(rebel.ended, null, "its realm ended");
      assert.ok(
        lands.every((cell) => p.members.includes(cell)),
        "its lands returned",
      );
      assert.equal(w.events.get(c.settled!)!.type, STRIFE_EVENTS.subdued.type);
      assert.match(why(w, c.settled!)!.claim, /was put down: its lands returned to/);
    } else {
      assert.equal(c.outcome, "parted");
      assert.equal(rebel.ended, null, "it stands");
      assert.equal(w.events.get(c.settled!)!.type, STRIFE_EVENTS.parted.type);
      assert.match(why(w, c.settled!)!.claim, /parted from .* for good/);
    }
  }
  assert.deepEqual([...seen].sort(), ["parted", "subdued"], "each, in its turn");

  // Again, and this time its host takes the seat: the realm falls to it, and the throne is its.
  const n = store.civil.length,
    again = breakAway(
      ctx,
      p,
      farLands(ctx, p).length ? farLands(ctx, p) : p.members.filter((c) => c !== p.seat),
      raised,
      "pretender",
      at(40 * YEAR),
    )!,
    second = store.civil[n]!,
    realms = politiesOf(w);
  for (const cell of [...p.members]) {
    realms.leave(p, cell);
    realms.join(again, cell);
  }
  endRealm(ctx, p, at(41 * YEAR), { ref: raised, role: "trigger", weight: 1 });
  settleCivil(ctx, warsOf(w).get(second.war)!, true, false, at(41 * YEAR));
  assert.equal(second.outcome, "throne");
  assert.equal(w.events.get(second.settled!)!.type, STRIFE_EVENTS.throne.type);
  assert.match(why(w, second.settled!)!.claim, /took the seat of .* and its throne/);
});

test("a split at a ruler's death is fought for — the most often where rule passes by birth", () => {
  assert.ok(
    STRIFE.contested[0] > STRIFE.contested[1] && STRIFE.contested[1] > STRIFE.contested[2],
    "by birth, then by choice, then by acclaim",
  );
  let fought = false;
  for (let k = 1; k < 12 && !fought; k++) {
    const w = fresh(),
      p = greatest(w),
      t = at(k * YEAR),
      split = w.events.emit({
        type: POLITY_EVENTS.split.type,
        subjects: [p.ref],
        place: null,
        data: { name: realmName(p) },
      }),
      q = raisedFrom(w, p, split, t);
    strifeYear(populationContext(w), t);
    const c = strifeOf(w)!.civil.find((x) => x.rebel === q.ref);
    if (!c) continue;
    fought = true;
    assert.equal(c.kind, "succession");
    assert.equal(c.loyal, p.ref);
    const war = warsOf(w).get(c.war)!,
      d = w.decisions.get(w.events.get(war.event)!.causes[0]!.ref)!;
    assert.equal(d.rule, "strife.civil");
    assert.ok(
      d.factors.some((f) => f.name === "a throne contested" && f.source?.ref === split),
      "the split it fights over",
    );
    assert.match(why(w, war.event)!.claim, /for the throne, in a war of succession/);
  }
  assert.ok(fought, "fought for, within a few splits");
});

test("the freed, marched on by their old masters and beaten, are bound again", () => {
  const w = fresh(),
    p = greatest(w),
    ctx = populationContext(w),
    t = at(1),
    freed = w.events.emit({
      type: "order.freed",
      subjects: [p.ref],
      place: null,
      data: { name: realmName(p) },
    }),
    q = raisedFrom(w, p, freed, t),
    lands = [...q.members];
  civilWar(ctx, q, p, "freed", [], t);
  const c = strifeOf(w)!.civil.at(-1)!,
    war = warsOf(w).get(c.war)!;
  assert.equal(war.attacker, p.ref, "their old masters march");
  assert.equal(war.defender, q.ref);
  assert.equal(war.prize, q.seat);
  // Their seat taken: all their lands pass to their old masters.
  const realms = politiesOf(w);
  for (const cell of [...q.members]) {
    realms.leave(q, cell);
    realms.join(p, cell);
  }
  endRealm(ctx, q, at(2 * YEAR), { ref: freed, role: "trigger", weight: 1 });
  orderOf(w)!.of(p.ref)!.abolished = null;
  settleCivil(ctx, war, true, false, at(2 * YEAR));
  assert.equal(c.outcome, "throne");
  for (const cell of lands)
    assert.ok(landOf(orderOf(w)!, cell).shares[BOND.chattel]! >= 0.15, "bound again");
  assert.match(why(w, c.settled!)!.claim, /took back the freed of .* and bound them again/);
});

test("a revolution: a rule in crisis and a people pressing for a voice rise at its seat", () => {
  const w = fresh(),
    p = greatest(w),
    ctx = populationContext(w),
    store = strifeOf(w)!,
    o = orderOf(w)!.of(p.ref)!,
    voice = { cause: "voice" as const, strength: 0.9, since: 60, event: p.event };
  o.movements.push(voice);
  o.crisis = p.event;
  o.legitimacy = 0.05;
  const danger = revolutionDanger(ctx, p, o);
  assert.ok(danger.score > STRIFE.rising, `a people pressing hard: ${danger.score}`);
  assert.ok(
    danger.factors.some((f) => f.name === "a people who want a voice" && f.source?.ref === p.event),
    "their movement drives it",
  );
  // (Its army cowed, so that no coup is weighed first.)
  store.ensure(p.ref).purged = 10_000;
  for (let k = 1; k < 400 && !store.revolutions.length; k++) {
    o.crisis = p.event;
    o.legitimacy = 0.05;
    voice.strength = 0.9;
    strifeYear(ctx, at(k * YEAR));
  }
  const r = store.revolutions[0]!;
  assert.ok(r, "its people rose");
  assert.equal(r.cause, "voice");
  const d = w.decisions.get(w.events.get(r.event)!.causes[0]!.ref)!;
  assert.equal(d.rule, "strife.revolution");
  assert.equal(
    w.events.get(r.event)!.type,
    r.won ? STRIFE_EVENTS.revolution.type : STRIFE_EVENTS.repressed.type,
  );
});

test("a revolution won: a commonwealth, one law for all, the land to its tillers, its rule held a generation", () => {
  const w = fresh(),
    p = greatest(w),
    ctx = populationContext(w),
    o = orderOf(w)!.of(p.ref)!;
  o.crisis = p.event;
  o.caste = 0.6;
  const event = revolt(ctx, p, "land", [], at(1));
  assert.equal(p.leadership, 2, "its rulers acclaimed");
  assert.ok(realmName(p).startsWith("the commonwealth of"), realmName(p));
  assert.equal(o.laws[LAW_OF.justice], 2, "one law for all");
  assert.equal(o.laws[LAW_OF.land], 2, "the land to those who till it");
  assert.equal(o.crisis, null);
  assert.ok(o.caste < 0.6, "its rank broken");
  assert.ok(revolutionHolds(w, p.ref, 61), "its rule holds");
  assert.ok(!revolutionHolds(w, p.ref, 60 + STRIFE.holds + 1), "for a generation");
  assert.equal(p.ruler.event, event);
  assert.match(why(w, event)!.claim, /rose at its seat for the land and overthrew its court/);
});

test("a revolution drowned in blood: its people struck down, a massacre remembered, its rank the harder", () => {
  const w = fresh(),
    p = greatest(w),
    ctx = populationContext(w),
    o = orderOf(w)!.of(p.ref)!,
    voice = { cause: "voice" as const, strength: 0.8, since: 60, event: p.event };
  o.movements.push(voice);
  const caste = o.caste,
    was = p.leadership,
    event = repress(ctx, p, "voice", [], at(1));
  assert.equal(p.leadership, was, "the court holds");
  assert.ok(
    o.memory.some((m) => m.what === "massacre" && m.event === event),
    "remembered",
  );
  assert.ok(o.caste > caste || o.caste === 1, "its rank the harder");
  assert.ok(voice.strength < 0.8, "its movement broken");
  assert.match(why(w, event)!.claim, /and were drowned in blood/);
});

test("the god raises a pretender: a claimant with the lands about it marches on the seat; never at the seat itself", () => {
  const w = fresh(),
    p = greatest(w),
    ctx = populationContext(w);
  assert.throws(() => w.submit("act.pretender", { cell: p.seat }), /cannot rise against itself/);
  const cell = p.members.find((c) => c !== p.seat && ctx.settlements.inProvince(c).length)!;
  w.submit("act.pretender", { cell });
  w.runTo(w.now + 3);
  const c = strifeOf(w)!.civil.find((x) => x.kind === "pretender" && x.loyal === p.ref)!,
    rebel = politiesOf(w).get(c.rebel)!,
    war = warsOf(w).get(c.war)!;
  assert.ok(rebel.members.includes(cell), "raised where the god chose");
  assert.equal(war.prize, p.seat);
  const raised = w.events.get(w.events.get(war.event)!.causes[0]!.ref)!;
  assert.equal(raised.type, STRIFE_ACTS.pretender.type, "by the god's hand");
});

test("civil wars and revolutions are kept whole by a save", () => {
  const w = fresh(),
    p = greatest(w),
    ctx = populationContext(w),
    cause = w.events.emit({ type: STRIFE_ACTS.pretender.type, subjects: [p.ref], place: null }),
    rebel = breakAway(ctx, p, farLands(ctx, p), cause, "pretender", at(1))!,
    war = strifeOf(w)!.civil.at(-1)!.war;
  revolt(ctx, rebel, "voice", [], at(2));
  const again = loadWorld(saveWorld(w, RULESET), build, RULESET).world;
  assert.deepEqual(strifeOf(again)!.save(), strifeOf(w)!.save());
  assert.equal(politiesOf(again).get(rebel.ref)!.from, p.ref, "what it broke from, kept");
  assert.equal(warsOf(again).get(war)!.civil, "pretender");
});
