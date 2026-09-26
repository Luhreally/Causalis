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

test("held for generations, a faith deepens a people's devotion", () => {
  const culture = cultureOf(world);
  const held = culture.all().filter((w) => faiths.of(w.cell).faith),
    old = culture.all().filter((w) => !faiths.of(w.cell).faith);
  const mean = (xs: typeof held) =>
    xs.reduce((s, w) => s + w.base[WAY.piety]!, 0) / Math.max(1, xs.length);
  assert.ok(held.length > 0);
  if (old.length)
    assert.ok(
      mean(held) > mean(old),
      `faithful ${mean(held).toFixed(2)}, old beliefs ${mean(old).toFixed(2)}`,
    );
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
