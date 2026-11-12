import { test } from "node:test";
import assert from "node:assert/strict";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  type World,
} from "../../src/kernel/index.ts";
import { makePopulationWorld, switchedOff, type SwitchStore } from "../../src/sim/index.ts";

// The world's own hand, switched (asked for 2026-11-11): its disasters and its plagues turned off
// by a command, kept in a save, back on by another; a world never switched hashed as before.
const seed = seedFromText("juniper"),
  build = (s = seed) => makePopulationWorld(s, { start: "spread" }),
  world = build();
world.runTo(60 * YEAR);
const RULESET = rulesetId(world, "test"),
  AS_IT_WAS = saveWorld(world, RULESET),
  fresh = () => loadWorld(AS_IT_WAS, build, RULESET).world;

/** What the world did by itself from `t`: its natural quakes, fires and stones, and its sicknesses. */
const since = (w: World, t: number) => {
  let disasters = 0,
    plagues = 0;
  for (const e of w.events.all()) {
    if (e.t <= t) continue;
    // (A new mountain is the world's own too, but it harms no one: it rises where no town stands.)
    if (e.type === "wild.rise") continue;
    if (
      e.type === "wild.fire" ||
      e.type === "wild.star" ||
      (e.data as { natural?: boolean } | null)?.natural === true
    )
      disasters++;
    if (e.type === "health.rose" || e.type === "health.outbreak") plagues++;
  }
  return { disasters, plagues };
};

test("a world never switched keeps nothing of the switches, and asks are checked", () => {
  const w = fresh();
  assert.equal(switchedOff(w, "disasters"), false);
  assert.throws(() => w.submit("world.switch", { what: "dragons", on: false }), /no such switch/);
  assert.throws(() => w.submit("world.switch", { what: "plagues" }), /on or off/);
  assert.equal(w.store<SwitchStore>("acts.switches").dormant(), true);
});

test("disasters and plagues turned off stop, are kept in a save, and come back when turned on", () => {
  const on = fresh(),
    off = fresh(),
    from = off.now;
  off.runTo(off.submit("world.switch", { what: "disasters", on: false }).t);
  off.runTo(off.submit("world.switch", { what: "plagues", on: false }).t);
  assert.ok(switchedOff(off, "disasters") && switchedOff(off, "plagues"));
  on.runTo(from + 80 * YEAR);
  off.runTo(from + 80 * YEAR);
  const was = since(on, from),
    now = since(off, from);
  // (The world left alone has some of each in eighty years, or this proves nothing.)
  assert.ok(was.disasters > 0 && was.plagues > 0, JSON.stringify(was));
  assert.deepEqual(now, { disasters: 0, plagues: 0 });
  // Kept in a save.
  const back = loadWorld(saveWorld(off, RULESET), build, RULESET).world;
  assert.ok(switchedOff(back, "disasters") && switchedOff(back, "plagues"));
  // On again: the world acts by itself again.
  const t = back.now;
  back.runTo(back.submit("world.switch", { what: "disasters", on: true }).t);
  back.runTo(back.submit("world.switch", { what: "plagues", on: true }).t);
  assert.equal(switchedOff(back, "disasters"), false);
  back.runTo(t + 120 * YEAR);
  const again = since(back, t);
  assert.ok(again.disasters > 0, JSON.stringify(again));
});
