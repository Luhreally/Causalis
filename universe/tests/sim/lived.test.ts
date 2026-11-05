import { test } from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import {
  MONTH,
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  verifyByReplay,
  type World,
} from "../../src/kernel/index.ts";
import {
  agentById,
  handOf,
  makePopulationWorld,
  marketsOf,
  populationContext,
  type Agent,
} from "../../src/sim/index.ts";
import { G, OCC, WED_AT, loveOf, type Life } from "../../src/rules/index.ts";
import { cradleCell } from "../cradle.ts";

// Lives L3: a life on the hand, as history keeps it. One world per test where it moves.
const seed = seedFromText("first light"),
  HOME = cradleCell("first light"),
  build = () => makePopulationWorld(seed),
  domain = (w: World, name: string) => w.domainHashes().find(([d]) => d === name)?.[1];

function laid(year = 245): { world: World; year: number } {
  const world = build();
  world.runTo(year * YEAR);
  const v = populationContext(world).settlements.inProvince(HOME)[0]!;
  world.runTo(world.submit("hand.lay", { village: v.ref }).t);
  return { world, year };
}
const hand = (w: World) => handOf(w).resting!;
const life = (w: World): Life => hand(w).life!;
const grownBy = (year: number, a: Agent) => year - a.birthYear >= 20 && year - a.birthYear < 45;
const go = (w: World, type: string, args: unknown) => w.runTo(w.submit(type, args).t);

test("a life begun and ended with no time between leaves the town's counts as they were", () => {
  const { world, year } = laid();
  const before = domain(world, "population.provinces");
  const a = hand(world).agents.find((x) => grownBy(year, x))!;
  go(world, "life.begin", { agent: a.id, home: 0 });
  assert.ok(hand(world).life);
  go(world, "life.end", {});
  assert.equal(hand(world).life, undefined);
  assert.equal(a.free, undefined);
  assert.equal(domain(world, "population.provinces"), before);
});

test("the hand does not pair the one lived, and is not lifted from under them", () => {
  const { world, year } = laid();
  const w = hand(world),
    me = w.agents.find((x) => grownBy(year, x))!;
  if (me.partner !== undefined) {
    const p = agentById(w, me.partner);
    if (p) delete p.partner;
    delete me.partner;
  }
  go(world, "life.begin", { agent: me.id, home: 0 });
  world.runTo(world.now + 2 * MONTH);
  assert.equal(me.partner, undefined);
  assert.throws(() => world.submit("hand.lift", {}));
});

test("a working household earns at the market's prices; a block is reckoned as far as it ran", () => {
  const { world, year } = laid();
  const me =
    hand(world).agents.find((a) => grownBy(year, a) && a.occupation === OCC.crafter) ??
    hand(world).agents.find((a) => grownBy(year, a))!;
  go(world, "life.begin", { agent: me.id, home: 3 });
  const l = life(world),
    was = l.purse,
    skill = l.skill;
  world.runTo(world.now + 3 * MONTH);
  assert.ok(l.skill > skill, "their work counts");
  assert.ok(l.purse !== was, "the purse moved");
  go(world, "life.do", { what: "eat" });
  assert.equal(life(world).doing?.what, "eat");
  assert.equal(life(world).doing!.to - life(world).doing!.from, 3600);
});

test("work past the day's hours is the town's: a crafter's extra hours come to tools in the market", () => {
  const { world, year } = laid();
  const me = hand(world).agents.find((a) => grownBy(year, a) && a.occupation === OCC.crafter);
  if (!me) return;
  go(world, "life.begin", { agent: me.id, home: 3 });
  const m = marketsOf(world).get(hand(world).cell)!,
    tools = m.stock[G.tools]!,
    midnight = (Math.floor(world.now / 86400) + 1) * 86400;
  // Evening after evening at the forge.
  for (let d = 0; d < 6; d++) {
    world.runTo(midnight + d * 86400 + 18 * 3600);
    go(world, "life.do", { what: "work" });
  }
  world.runTo(midnight + 7 * 86400);
  assert.ok(
    life(world).extra > 0 || m.stock[G.tools]! > tools,
    "what was made past the day counts",
  );
});

test("courted long enough they say yes: married, by the god's hand", () => {
  const { world, year } = laid();
  const w = hand(world),
    adult = populationContext(world).life.adulthood,
    // (One whose partner has gone: those free about their age, if any, can be courted.)
    me = w.agents.find((a) => grownBy(year, a) && a.sex === 0)!;
  const was = me.partner === undefined ? undefined : agentById(w, me.partner);
  if (was) delete was.partner;
  delete me.partner;
  go(world, "life.begin", { agent: me.id, home: 1 });
  const who = life(world).suitors.find((id) => year - agentById(w, id)!.birthYear >= adult);
  assert.notEqual(who, undefined, "a free man near her age");
  for (let k = 0; k < 8 && me.partner === undefined; k++) {
    go(world, "life.do", { what: "court", target: who });
    world.runTo(world.now + 3 * 3600);
  }

  assert.equal(me.partner, who);
  assert.equal(agentById(w, who!)!.partner, me.id);
  assert.ok(life(world).kin.includes(who!));
});

test("their death ends the life at the month's close, and it goes on in their child with their purse", () => {
  const { world, year } = laid();
  const w = hand(world),
    parent = w.agents.find(
      (a) => grownBy(year, a) && w.agents.some((c) => c.mother === a.id || c.father === a.id),
    )!;
  go(world, "life.begin", { agent: parent.id, home: 2 });
  w.agents = w.agents.filter((a) => a !== parent);
  world.runTo(world.now + MONTH + 1);
  assert.equal(life(world).ended, "died");
  assert.equal(life(world).waiting[0]!.kind, "died");
  const purse = life(world).purse,
    child = life(world)
      .kin.map((id) => agentById(w, id))
      .find((a) => a && (a.mother === parent.id || a.father === parent.id))!;
  go(world, "life.heir", { agent: child.id });
  assert.equal(life(world).agent, child.id);
  assert.equal(life(world).generation, 2);
  assert.equal(life(world).purse, purse);
});

test("a life lived replays, and its save, mid-life, continues bit for bit", () => {
  const { world, year } = laid();
  const a = hand(world).agents.find((x) => grownBy(year, x))!;
  go(world, "life.begin", { agent: a.id, home: 0 });
  world.runTo(world.now + 2 * 86400);
  go(world, "life.do", { what: "square" });
  world.runTo(world.now + 3 * MONTH);
  go(world, "life.habit", { habit: 1 });
  const ruleset = rulesetId(world, "t"),
    doc = saveWorld(world, ruleset, {}),
    again = loadWorld(doc, build, ruleset).world;
  world.runTo(world.now + 14 * MONTH);
  again.runTo(again.now + 14 * MONTH);
  assert.deepEqual(again.domainHashes(), world.domainHashes());
  verifyByReplay(saveWorld(world, ruleset, {}), build);
});

test("a long life keeps its record small", () => {
  const { world, year } = laid();
  const a = hand(world).agents.find((x) => grownBy(year, x))!,
    ruleset = rulesetId(world, "t"),
    bytes = () => JSON.stringify(saveWorld(world, ruleset, {})).length,
    before = bytes();
  go(world, "life.begin", { agent: a.id, home: 0 });
  const whats = ["square", "family", "market", "rest", "eat", "sleep", "work"];
  for (let k = 0; k < 400 && hand(world).life && !life(world).ended; k++) {
    go(world, "life.do", { what: whats[k % whats.length] });
    world.runTo(world.now + 20 * 86400);
  }
  const after = bytes(),
    record = JSON.stringify(hand(world).life ?? {}).length;
  console.log(
    `# save ${before} -> ${after} bytes; life record ${record}; gz ${gzipSync(JSON.stringify(saveWorld(world, ruleset, {}))).length}; ended ${life(world).ended}; purse ${Math.round(life(world).purse)}`,
  );
  assert.ok(record < 12_000, `the record is ${record} bytes`);
  assert.ok(after - before < 400_000, `the save grew ${after - before} bytes`);
});
