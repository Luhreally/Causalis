import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR } from "../../src/kernel/index.ts";
import {
  BELIEF_EVENTS,
  WAY,
  beliefOf,
  cultureOf,
  heldCreed,
  marketsOf,
} from "../../src/sim/index.ts";
import { spine, why } from "../../src/causal/index.ts";
import { cradleCell } from "../cradle.ts";
import { peopledWorld } from "../worlds.ts";

/** Where the first people of "first light" began. */
const CRADLE = cradleCell("first light");

const OMENS = new Set([
  "act.rain",
  "act.harvest",
  "act.plague",
  "act.fire",
  "act.inspire",
  "hand.laid",
  "people.famine",
  "weather.drought",
  "knowledge.cultivation",
  "knowledge.metalworking",
  // (What the world does of itself, round "peoples": a sickness that took many, a quake, a fire or a stone from the sky that came
  // of itself, a mountain rising, a star seen to fall.)
  "health.outbreak",
  "act.quake",
  "act.meteor",
  "wild.fire",
  "wild.rise",
  "wild.star",
]);

const world = peopledWorld("first light", 300, { start: "spread" });
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
  const cradle = peopledWorld("first light", 60);
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
test("held for generations, a faith draws a people's ways the more toward what it holds", () => {
  const year = () => Math.floor(world.now / YEAR),
    pull = (cell: number) =>
      (heldCreed(world, cell, year()) ?? []).reduce((s, v) => s + Math.abs(v), 0),
    before = new Map(
      cultureOf(world)
        .all()
        .filter((w) => faiths.of(w.cell).faith)
        .map((w) => [
          w.cell,
          { faith: faiths.of(w.cell).faith, since: faiths.of(w.cell).since, pull: pull(w.cell) },
        ]),
    );
  assert.ok(before.size > 0, "lands holding a faith");
  world.runTo(world.now + 20 * YEAR);
  // Those that kept the same faith the twenty years (not left it and come back) are drawn the harder by it (rules/faith.ts creedHeld).
  const kept = [...before].filter(
    ([cell, b]) => faiths.of(cell).faith === b.faith && faiths.of(cell).since === b.since,
  );
  assert.ok(kept.length > 0);
  for (const [cell, b] of kept)
    assert.ok(pull(cell) > b.pull, `land ${cell}: ${b.pull.toFixed(3)} → ${pull(cell).toFixed(3)}`);
  // And where it asks devotion, their devotion stands above what their body, land and lessons alone would make it.
  const asked = kept.filter(([cell]) => (heldCreed(world, cell, year())?.[WAY.piety] ?? 0) > 0.02),
    above = asked.filter(([cell]) => {
      const w = cultureOf(world).get(cell)!;
      return w.traits[WAY.piety]! > w.base[WAY.piety]!;
    });
  assert.ok(
    asked.length > 0 && above.length > asked.length / 2,
    `${above.length} of ${asked.length}`,
  );
});
