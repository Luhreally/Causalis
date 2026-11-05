// Lives L4: a ruler's commands. Each is refused in words without the standing, goes through the world's own door, and is told
// with whose word it was; a world where none is given keeps every hash, and a marriage of state comes through a save.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  YEAR,
  loadWorld,
  saveWorld,
  seedFromText,
  type Ref,
  type SaveDocument,
  type World,
} from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { reignNow } from "../../src/host/reign.ts";
import {
  REIGN,
  carried,
  decreeCost,
  mustCarry,
  peaceRefused,
  tieOf,
  warCost,
} from "../../src/rules/index.ts";
import {
  LAW_EVENTS,
  REIGN_EVENTS,
  WAR_EVENTS,
  diplomacyOf,
  frontier,
  orderOf,
  politiesOf,
  populationContext,
  stationOf,
  tieBetween,
  warsOf,
  type Polity,
} from "../../src/sim/index.ts";

test("what a ruler must carry comes from whose leave they hold it by and whether rule is shared", () => {
  assert.equal(mustCarry(0, 0), 0);
  assert.equal(mustCarry(3, 0), 0);
  assert.equal(mustCarry(0, 1), REIGN.carryByLeave);
  assert.equal(mustCarry(1, 0), REIGN.carryShared);
  assert.equal(mustCarry(2, 2), REIGN.carryByLeave + REIGN.carryShared);
  assert.equal(carried(0, 0), 1);
  assert.equal(carried(1, 3), 0.25);
});

test("costs and ties read as stated", () => {
  assert.ok(decreeCost(0.5) > decreeCost(0));
  assert.ok(warCost(true, true) > warCost(false, true));
  assert.ok(warCost(false, false) > warCost(false, true));
  assert.equal(tieOf(0.1, 0.9, true, true), 0);
  assert.ok(tieOf(0.5, 0.5, true, true) > tieOf(0.5, 0.5, true, false));
  assert.equal(peaceRefused(true, 2, 1, 0, false), "winning");
  assert.equal(peaceRefused(false, 9, 1, 0, false), null);
  assert.equal(peaceRefused(true, 2, 6, 0, false), null);
  assert.equal(peaceRefused(true, 2, 1, 0.5, false), null);
  assert.equal(peaceRefused(true, 2, 1, 0, true), null);
});

/** A small world with two realms that meet, and their ruler made to rule alone. */
const made = (() => {
  let cached: { world: World; a: Polity; b: Polity } | null = null;
  return () => {
    if (cached) return cached;
    const world = EARTH.build(seedFromText("first light"));
    world.runTo(220 * YEAR);
    const ctx = populationContext(world),
      realms = politiesOf(world).living();
    for (const a of realms)
      for (const b of realms)
        if (
          a !== b &&
          diplomacyOf(world).get(a.ref, b.ref) &&
          frontier(ctx, a, b).length &&
          tieBetween(world, a, b) > 0 &&
          !warsOf(world).between(a.ref, b.ref)
        ) {
          cached = { world, a, b };
          return cached;
        }
    throw new Error("no two realms meet");
  };
})();
const words = (fn: () => unknown): string => {
  try {
    fn();
    return "";
  } catch (e) {
    return (e as Error).message;
  }
};

test("a ruler's commands: refused in words, then through the world's own door, told with whose word", () => {
  const { world, a, b } = made(),
    ctx = populationContext(world),
    ruler = a.ruler.name,
    o = orderOf(world)!.of(a.ref)!;
  a.leadership = 0;
  a.succession = 0;
  a.law = 1;
  // Another's name: no longer theirs.
  assert.match(
    words(() =>
      world.submit("reign.decree", { realm: a.ref, ruler: "no one", law: "tithe", to: 8 }),
    ),
    /no longer rules/,
  );
  // Their standing gone.
  o.legitimacy = 0.2;
  assert.match(
    words(() => world.submit("reign.decree", { realm: a.ref, ruler, law: "tithe", to: 8 })),
    /seat's door/,
  );
  assert.match(
    words(() => world.submit("reign.decree", { realm: a.ref, ruler, law: "land", to: o.laws[0]! })),
    /door/,
  );
  o.legitimacy = 0.9;
  // Two steps at once.
  o.laws[0] = 0;
  assert.match(
    words(() => world.submit("reign.decree", { realm: a.ref, ruler, law: "land", to: 2 })),
    /a step at a time/,
  );
  // The tithe.
  const tithe = Math.round(a.tribute * 100) === 8 ? 10 : 8;
  world.submit("reign.decree", { realm: a.ref, ruler, law: "tithe", to: tithe });
  world.runTo(world.now + 1);
  assert.equal(Math.round(a.tribute * 100), tithe);
  assert.ok(o.legitimacy < 0.9);
  assert.equal((world.events.get(a.tithed!)!.data as { by: string }).by, ruler);
  // A law, where anything is written; else refused in words.
  const can = stationOf(ctx, a).writes;
  o.legitimacy = 0.9;
  const law = () => world.submit("reign.decree", { realm: a.ref, ruler, law: "land", to: 1 });
  if (can) {
    law();
    world.runTo(world.now + 1);
    assert.equal(o.laws[0], 1);
    const e = world.events.get(o.lawEvents[0]!)!;
    assert.equal(e.type, LAW_EVENTS.changed.type);
    assert.equal((e.data as { by: string }).by, ruler);
    assert.ok(e.causes.some((c) => c.role === "agent"));
  } else assert.match(words(law), /custom is the law/);
  // A marriage: what the two realms think of each other moves, and a second is refused.
  diplomacyOf(world).get(a.ref, b.ref)!.opinion = 0;
  const before = diplomacyOf(world).get(a.ref, b.ref)!.opinion,
    grown = world.now / YEAR - 30,
    wed = {
      realm: a.ref,
      ruler,
      to: b.ref,
      who: { name: "Ana Heir", sex: 0, born: Math.floor(grown), tie: "daughter" },
      partner: { name: "Bo Heir", sex: 1, born: Math.floor(grown), tie: "son" },
    };
  assert.match(
    words(() => world.submit("reign.wed", { ...wed, partner: { ...wed.partner, sex: 0 } })),
    /of one sex/,
  );
  world.submit("reign.wed", wed);
  world.runTo(world.now + 1);
  const relation = diplomacyOf(world).get(a.ref, b.ref)!;
  assert.ok(relation.opinion > before);
  assert.ok(relation.terms.some((t) => t.name === "a marriage between their houses"));
  assert.equal(orderOf(world)!.of(a.ref)!.matches!.length, 1);
  assert.equal(orderOf(world)!.of(b.ref)!.matches!.length, 1);
  assert.equal(
    world.events.get(orderOf(world)!.of(b.ref)!.matches![0]!.event)!.type,
    REIGN_EVENTS.wed.type,
  );
  assert.match(
    words(() => world.submit("reign.wed", wed)),
    /ties your house|wed already/,
  );
  // War, for a land named; then peace.
  o.legitimacy = 0.9;
  const aim = frontier(ctx, a, b).at(-1)!;
  world.submit("reign.war", { realm: a.ref, ruler, against: b.ref, prize: aim });
  world.runTo(world.now + 1);
  const w = warsOf(world).between(a.ref, b.ref)!;
  assert.equal(w.prize, aim);
  assert.equal(world.events.get(w.event)!.type, WAR_EVENTS.declared.type);
  assert.equal((world.events.get(w.event)!.data as { by: string }).by, ruler);
  assert.match(
    words(() => world.submit("reign.war", { realm: a.ref, ruler, against: b.ref })),
    /at war with them/,
  );
  world.submit("reign.peace", { realm: a.ref, ruler, with: b.ref });
  world.runTo(world.now + 1);
  assert.equal(warsOf(world).between(a.ref, b.ref), undefined);
  assert.equal((world.events.get(w.peace!)!.data as { by: string }).by, ruler);
});

test("a marriage of state comes through a save, and the same word on the same world gives the same world", () => {
  const { world, a, b } = made(),
    doc = () => JSON.parse(JSON.stringify(saveWorld(world, "gate", {}))) as SaveDocument,
    copy = () => loadWorld(doc(), (s) => EARTH.build(s), "gate").world,
    one = copy(),
    two = copy();
  assert.deepEqual(one.domainHashes(), world.domainHashes());
  assert.deepEqual(orderOf(one)!.of(a.ref)!.matches, orderOf(world)!.of(a.ref)!.matches);
  for (const w of [one, two]) {
    const r = politiesOf(w).get(a.ref)!,
      o = orderOf(w)!.of(a.ref)!;
    o.legitimacy = 0.9;
    w.submit("reign.war", { realm: a.ref, ruler: r.ruler.name, against: b.ref });
    w.runTo(w.now + YEAR);
  }
  assert.deepEqual(one.domainHashes(), two.domainHashes());
  assert.notDeepEqual(one.domainHashes(), world.domainHashes());
});

test("how a ruler stands, and how their rule ended", () => {
  const { world, a } = made(),
    now = reignNow(world, a.ref, a.ruler.name)!;
  assert.equal(now.fell, null);
  assert.equal(now.ruler, a.ruler.name);
  assert.ok(now.people > 0);
  assert.ok(now.station.length > 0);
  const gone = reignNow(world, a.ref, "One Before")!;
  assert.ok(gone.fell);
  assert.equal(gone.fell.heir?.name, a.ruler.name);
  const r = a.ref as Ref;
  assert.equal(reignNow(world, `${r}x`, a.ruler.name), null);
});
