import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref } from "../../src/kernel/index.ts";
import { EFFECTS, PRINCIPLES, PRINCIPLE_INDEX, principle } from "../../src/rules/index.ts";
import {
  LORE_EVENTS,
  knows,
  loreOf,
  makePopulationWorld,
  marketsOf,
  politiesOf,
  populationContext,
} from "../../src/sim/index.ts";
import { why } from "../../src/causal/index.ts";

test("the tree of principles is whole: every need exists, and nothing needs itself", () => {
  const visiting = new Set<string>(),
    done = new Set<string>();
  const visit = (id: string) => {
    assert.ok(PRINCIPLE_INDEX.has(id), `${id} exists`);
    assert.ok(!visiting.has(id), `${id} does not need itself`);
    if (done.has(id)) return;
    visiting.add(id);
    for (const n of principle(id).needs) visit(n);
    visiting.delete(id);
    done.add(id);
  };
  for (const p of PRINCIPLES) visit(p.id);
  assert.ok(PRINCIPLES.length >= 50);
});

const world = makePopulationWorld(seedFromText("first light"), { start: "spread" });
world.runTo(300 * YEAR);
const ctx = populationContext(world),
  lore = loreOf(world);

test("a land comes to know a principle only after what it needs", () => {
  let checked = 0;
  for (const p of ctx.provinces.all()) {
    const when = new Map(lore.of(p.cell).map(([id, k]) => [id, k.year]));
    for (const [id, year] of when)
      for (const need of principle(id).needs) {
        if (need === "cultivation" || need === "metalworking") {
          assert.ok(knows(ctx, p.cell, need), `${id} in ${p.cell} needs ${need}`);
          continue;
        }
        assert.ok((when.get(need) ?? Infinity) <= year, `${id} in ${p.cell} came before ${need}`);
        checked++;
      }
  }
  assert.ok(checked > 50, `${checked} needs checked`);
});

test("finding cites who found it and what the land held; learning cites the neighbour and the road", () => {
  const found = world.events.all().filter((e) => e.type === LORE_EVENTS.found.type);
  assert.ok(found.length >= 10, `${found.length} findings`);
  for (const e of found.slice(0, 15)) {
    const d = world.decisions.get(e.causes[0]!.ref as Ref)!;
    assert.equal(d.rule, "lore.find");
    const id = (e.data as { principle: string }).principle,
      ore = principle(id).drivers.ore;
    if (ore)
      assert.ok(
        d.factors.some((f) => f.name === `${ore} within reach` && f.source),
        `${id} cites its ${ore}`,
      );
  }
  const markets = marketsOf(world),
    learned = world.events.all().filter((e) => e.type === LORE_EVENTS.learned.type);
  assert.ok(learned.length >= 20);
  for (const e of learned.slice(0, 30)) {
    const from = world.events.get(e.causes[0]!.ref as Ref);
    assert.ok(
      from && (from.type === LORE_EVENTS.found.type || from.type === LORE_EVENTS.learned.type),
    );
    if (e.causes[1]) assert.ok(markets.allRoutes().some(([, r]) => r === e.causes[1]!.ref));
  }
  assert.match(why(world, found[0]!.id).claim, /^In the .* people came upon .*, year \d+$/);
});

test("what a land knows sums into what it can do", () => {
  for (const p of ctx.provinces.all().slice(0, 20)) {
    const known = lore.of(p.cell).map(([id]) => principle(id));
    for (const e of EFFECTS) {
      const sum = known.reduce((s, k) => s + (k.effects[e] ?? 0), 0);
      assert.ok(Math.abs(lore.effect(p.cell, e) - sum) < 1e-9, `${e} in ${p.cell}`);
    }
  }
});

test("no realm rules by decree without writing at its seat", () => {
  for (const p of politiesOf(world).living())
    if (p.law === 1)
      assert.ok(lore.effect(p.seat, "writing") > 0, `${p.town} decrees without writing`);
});
