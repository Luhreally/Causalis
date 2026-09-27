import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import {
  BELIEF_EVENTS,
  WAY,
  beliefOf,
  cultureOf,
  makePopulationWorld,
  marketsOf,
} from "../../src/sim/index.ts";
import { spine, why } from "../../src/causal/index.ts";
import { cradleCell } from "../cradle.ts";

/** Where the first people of "first light" began. */
const CRADLE = cradleCell("first light");

const OMENS = new Set([
  "act.rain",
  "act.harvest",
  "act.plague",
  "act.inspire",
  "hand.laid",
  "people.famine",
  "weather.drought",
  "knowledge.cultivation",
  "knowledge.metalworking",
]);

const world = makePopulationWorld(seedFromText("first light"), { start: "spread" });
world.runTo(300 * YEAR);
const faiths = beliefOf(world);

test("faiths are founded by omens, and say which", () => {
  const founded = world.events.all().filter((e) => e.type === BELIEF_EVENTS.founded.type);
  assert.ok(founded.length >= 1, `${founded.length} faiths founded`);
  for (const e of founded) {
    const omen = world.events.get(e.causes[0]!.ref);
    assert.ok(omen && OMENS.has(omen.type), `founded by ${omen?.type}`);
  }
  const f = faiths.all()[0]!,
    node = why(world, f.ref);
  assert.match(node.claim, /: they worship the .*; the faith began in the .* in year \d+/);
  const path = spine(world, f.ref).map((n) => n.ref.split(":")[0]);
  assert.ok(["star", "cmd"].includes(path.at(-1)!), path.join(" ← "));
});

test("faiths spread to neighbours down their roads, and the largest holds many lands", () => {
  const largest = Math.max(...faiths.all().map((f) => faiths.lands(f.ref).length));
  assert.ok(largest >= 5, `the largest faith holds ${largest} lands`);
  const markets = marketsOf(world);
  const conversions = world.events.all().filter((e) => e.type === BELIEF_EVENTS.converted.type);
  assert.ok(conversions.length >= 5);
  for (const e of conversions.slice(0, 20)) {
    const from = world.events.get(e.causes[0]!.ref);
    assert.ok(
      from &&
        (from.type === BELIEF_EVENTS.founded.type ||
          from.type === BELIEF_EVENTS.converted.type ||
          from.type === BELIEF_EVENTS.schism.type),
      "cites how the faith came to the neighbour",
    );
    const road = e.causes[1];
    if (road)
      assert.ok(
        markets.allRoutes().some(([, r]) => r === road.ref),
        "and the road it came down",
      );
  }
});

test("the god's act is an omen: a devout people struck by it may found a faith in its power", () => {
  const cradle = makePopulationWorld(seedFromText("first light"));
  cradle.runTo(60 * YEAR);
  cultureOf(cradle).get(CRADLE)!.traits[WAY.piety] = 0.95;
  for (let y = 60; y < 66; y++) {
    cradle.submit("act.harvest", { cell: CRADLE, sign: 1, years: 1 });
    cradle.runTo((y + 1) * YEAR);
  }
  const f = beliefOf(cradle)
    .all()
    .find((x) => x.tenet === "plenty");
  assert.ok(f, "a faith in the giver of plenty");
  const path = spine(cradle, f.ref);
  assert.equal(path.at(-1)!.basis, "command", "its why ends at your act");
});

// Last in the file: it runs the shared world on.
test("held for generations, a faith deepens a people's devotion", () => {
  const culture = cultureOf(world),
    before = new Map(
      culture
        .all()
        .filter((w) => faiths.of(w.cell).faith && w.base[WAY.piety]! < 0.8)
        .map((w) => [w.cell, { faith: faiths.of(w.cell).faith, piety: w.base[WAY.piety]! }]),
    );
  assert.ok(before.size > 0, "lands holding a faith, short of the deepest devotion");
  world.runTo(world.now + 20 * YEAR);
  // Those that kept the same faith the twenty years are the more devout for it.
  const kept = [...before].filter(([cell, b]) => faiths.of(cell).faith === b.faith);
  assert.ok(kept.length > 0);
  for (const [cell, b] of kept)
    assert.ok(
      cultureOf(world).get(cell)!.base[WAY.piety]! > b.piety,
      `land ${cell}: ${b.piety.toFixed(3)} → ${cultureOf(world).get(cell)!.base[WAY.piety]!.toFixed(3)}`,
    );
});
