import { test } from "node:test";
import assert from "node:assert/strict";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  type Ref,
  type World,
} from "../../src/kernel/index.ts";
import { G } from "../../src/rules/index.ts";
import {
  HEAR_LY,
  MOST_HOLDS,
  PEOPLES_EVENTS,
  REACH_LY,
  REACTIONS,
  civilizationsNear,
  cultureOf,
  leaning,
  loreOf,
  makePopulationWorld,
  marketsOf,
  peopleNature,
  peopleWords,
  peoplesOf,
  politiesOf,
  populationContext,
  settleableBy,
  starPoint,
  type Polity,
} from "../../src/sim/index.ts";
import { spine, why } from "../../src/causal/index.ts";

// Juniper's realms, sixty years on; among its stars one people has been at the stars a thousand
// years (the shelled shore-walkers, 35 light-years out), the rest have yet to come to them.
const seed = seedFromText("juniper"),
  build = (s = seed) => makePopulationWorld(s, { start: "spread" }),
  world = build();
world.runTo(60 * YEAR);
const RULESET = rulesetId(world, "test"),
  AS_IT_WAS = saveWorld(world, RULESET),
  fresh = () => loadWorld(AS_IT_WAS, build, RULESET).world;

const apart = (w: World, a: Ref, b: Ref) => {
  const p = starPoint(w, a),
    q = starPoint(w, b);
  return Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2 + (p.z - q.z) ** 2);
};
const home = (w: World) => populationContext(w).generated.star.ref as Ref;
const greatest = (w: World): Polity => {
  const ctx = populationContext(w),
    people = (p: Polity) => p.members.reduce((n, c) => n + (ctx.provinces.get(c)?.total() ?? 0), 0);
  return [...politiesOf(w).living()].sort(
    (a, b) => people(b) - people(a) || (a.ref < b.ref ? -1 : 1),
  )[0]!;
};
const oldest = (w: World) =>
  [...civilizationsNear(w)].sort((a, b) => a.stars - b.stars || (a.ref < b.ref ? -1 : 1))[0]!;

test("a people's nature and name are its own, drawn from it alone", () => {
  const civs = civilizationsNear(world),
    names = new Set<string>();
  assert.ok(civs.length >= 2);
  for (const c of civs) {
    const n = peopleNature(world, c);
    for (const v of Object.values(n)) assert.ok(v >= 0 && v <= 1, `${c.ref} ${JSON.stringify(n)}`);
    assert.deepEqual(peopleNature(fresh(), c), n, "the same each time");
    const w = peopleWords(world, c);
    assert.match(w.name, /^[A-Z][a-z]+$/);
    assert.ok(w.kind.length > 3);
    names.add(w.name);
    for (const d of civs) {
      const l = leaning(world, c, d === c ? null : d, greatest(world).seat);
      assert.ok(l >= -0.9 && l <= 0.9);
    }
  }
  assert.ok(names.size >= civs.length - 1, "their names mostly differ");
});

test("a people long at the stars holds stars already, each one its bodies could live about, within reach of another", () => {
  const store = peoplesOf(world)!,
    civs = civilizationsNear(world),
    held = new Map<string, string>();
  for (const c of civs) {
    const holds = store.holdsOf(c.ref);
    if (c.stars > 60) {
      assert.equal(holds.length, 0, "none before it reaches the stars");
      continue;
    }
    assert.ok(holds.length >= 2 && holds.length <= MOST_HOLDS, `${holds.length}`);
    assert.equal(holds[0]!.star, c.star, "its own star first");
    const settleable = new Set(settleableBy(world, c).map((s) => s.ref as string));
    holds.slice(1).forEach((h, i) => {
      assert.ok(settleable.has(h.star), "about a world its bodies could live on");
      assert.ok(
        holds.slice(0, i + 1).some((g) => apart(world, g.star, h.star) <= REACH_LY),
        "within reach of a star it held before",
      );
      assert.ok(h.star !== home(world) && !civs.some((x) => x.star === h.star));
    });
    for (const h of holds) {
      assert.ok(!held.has(h.star), "no star held twice");
      held.set(h.star, c.ref);
    }
  }
  assert.ok(held.size > 1);
});

test("envoys come down on the home world and the two meet, each as it is; the why reaches both choices", () => {
  const w = fresh(),
    store = peoplesOf(w)!,
    civ = oldest(w),
    realm = greatest(w);
  store.ships.push({
    id: store.count++,
    civ: civ.ref,
    kind: "envoys",
    from: civ.star,
    to: home(w),
    sailed: 0,
    arrives: 61,
    event: realm.event,
    toward: null,
    heard: false,
    arrived: null,
  });
  w.runTo(62 * YEAR);
  assert.equal(store.landings.length, 1);
  const landing = store.landings[0]!;
  assert.equal(landing.omen, true, "before the home world has signals, an omen");
  assert.equal(w.events.get(landing.event)!.type, PEOPLES_EVENTS.landed.type);
  assert.match(why(w, landing.event).claim, /came down .*they looked, and were seen, and went/);
  const m = store.meetings.find((x) => x.civ === civ.ref)!;
  assert.ok(m, "they met");
  assert.equal(m.talking, false, "not yet able to speak");
  assert.ok(REACTIONS.includes(m.theirs) && REACTIONS.includes(m.ours));
  const e = w.events.get(m.event)!;
  assert.equal(e.type, PEOPLES_EVENTS.met.type);
  assert.match(why(w, m.event).claim, /met (the|a land)/);
  const choices = e.causes.filter((c) => w.decisions.get(c.ref)?.rule === "contact.react");
  assert.equal(choices.length, 2, "each side's reaction a decision with its reasons");
  for (const c of choices) assert.ok(w.decisions.get(c.ref)!.factors.length >= 4);
  assert.ok(
    spine(w, m.event, 4).some((x) => x.ref === landing.event),
    "back to the landing",
  );
  // How the land met them stays in its ways.
  const ways = cultureOf(w).get(m.cell);
  if (ways) assert.ok(ways.nudges.some((n) => n.event === m.event));
});

test("once both can speak, what passes between them is lived: knowledge learned, goods in store, or ways opened", () => {
  const w = fresh(),
    store = peoplesOf(w)!,
    civ = oldest(w),
    realm = greatest(w),
    seat = realm.seat,
    before = marketsOf(w).get(seat)!.line("in", G.machines);
  for (const [arrives, heard] of [
    [61, false],
    [63, true],
  ] as const)
    store.ships.push({
      id: store.count++,
      civ: civ.ref,
      kind: "envoys",
      from: civ.star,
      to: home(w),
      sailed: 0,
      arrives,
      event: realm.event,
      toward: null,
      heard,
      arrived: null,
    });
  w.runTo(62 * YEAR);
  // (Its signals out: the realm comes to speak across the dark.)
  store.homeSignals = 62;
  w.runTo(64 * YEAR);
  const m = store.meetings.find((x) => x.civ === civ.ref)!;
  assert.equal(m.talking, true, "they came again, and now can speak");
  m.regard = 0.8;
  m.last = 0;
  w.runTo(65 * YEAR);
  assert.ok(m.exchanges >= 1, "an exchange came of standing well");
  const x = store.exchanges.at(-1)!,
    event = w.events.get(x.event)!;
  assert.equal(event.type, PEOPLES_EVENTS.exchange.type);
  assert.match(why(w, x.event).claim, /taught|traded|opened the ways/);
  if (x.what === "knowledge") assert.ok(loreOf(w).get(seat, x.detail), "the lesson is known");
  else if (x.what === "goods")
    assert.ok(marketsOf(w).get(seat)!.line("in", G.machines) - before >= Number(x.detail));
  else
    assert.ok(
      cultureOf(w)
        .get(m.cell)!
        .nudges.some((n) => n.event === x.event),
    );
});

test("a fleet against a realm burns its seat or is beaten off, by the strength of each", () => {
  const w = fresh(),
    store = peoplesOf(w)!,
    civ = oldest(w),
    realm = greatest(w),
    grief = politiesOf(w).discontent(realm.seat).level;
  store.ships.push({
    id: store.count++,
    civ: civ.ref,
    kind: "fleet",
    from: civ.star,
    to: home(w),
    sailed: 0,
    arrives: 61,
    event: realm.event,
    toward: realm.ref,
    heard: false,
    arrived: null,
  });
  w.runTo(62 * YEAR);
  assert.equal(store.raids.length, 1);
  const r = store.raids[0]!;
  assert.equal(r.other, realm.ref);
  assert.equal(r.cell, realm.seat, "at home: its seat");
  assert.equal(w.events.get(r.event)!.type, PEOPLES_EVENTS.raid.type);
  assert.match(why(w, r.event).claim, /fleet of the/);
  if (r.won) {
    assert.ok(r.dead > 0, "the dead");
    assert.ok(politiesOf(w).discontent(realm.seat).level > grief, "and the grief");
  } else assert.equal(r.dead, 0);
});

test("two peoples near enough to hear each other meet among the stars", () => {
  const w = fresh(),
    store = peoplesOf(w)!,
    civs = civilizationsNear(w),
    a = oldest(w),
    b = civs.find((c) => c !== a)!;
  // The other at the stars too, about a star near one the first holds.
  const near = settleableBy(w, b).find(
    (s) =>
      !store.holder(s.ref) && store.holdsOf(a.ref).some((h) => apart(w, h.star, s.ref) <= HEAR_LY),
  );
  // (Or, failing one, at a star the first holds: they could not but meet.)
  const hold = near?.ref ?? store.holdsOf(a.ref)[1]!.star;
  store.holds.set(b.ref, [
    { star: b.star, year: 0, event: null, from: null },
    { star: hold, year: 61, event: null, from: null },
  ]);
  w.runTo(62 * YEAR);
  const m = store.meetingOf(a.ref, b.ref)!;
  assert.ok(m, "they met");
  assert.equal(m.with, "people");
  assert.equal(w.events.get(m.event)!.type, PEOPLES_EVENTS.among.type);
  assert.match(why(w, m.event).claim, /among the stars/);
  assert.ok(m.regard >= -1 && m.regard <= 1);
});

test("the peoples among the stars are kept whole by a save, and go on alike after it", () => {
  const w = fresh(),
    store = peoplesOf(w)!,
    civ = oldest(w);
  store.ships.push({
    id: store.count++,
    civ: civ.ref,
    kind: "envoys",
    from: civ.star,
    to: home(w),
    sailed: 0,
    arrives: 61,
    event: greatest(w).event,
    toward: null,
    heard: false,
    arrived: null,
  });
  w.runTo(62 * YEAR);
  const doc = saveWorld(w, RULESET),
    again = loadWorld(doc, build, RULESET).world;
  assert.deepEqual(peoplesOf(again)!.save(), store.save());
  w.runTo(64 * YEAR);
  again.runTo(64 * YEAR);
  assert.deepEqual(peoplesOf(again)!.save(), peoplesOf(w)!.save());
});
