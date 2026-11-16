// Round D: the planet in motion on a small world, briefly. Its ground keeps its sheets as made until something moves
// it; warmed hard by the god, its ground turns, its reading moves every land's yield, and it saves and loads the same.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, loadWorld, saveWorld, seedFromText } from "../../src/kernel/index.ts";
import {
  homePlanet,
  makePopulationWorld,
  motionOf,
  provinceCapacity,
  populationContext,
  shiftNow,
  strainsOf,
} from "../../src/sim/index.ts";

test("a world's ground moves under the god's warming, and its motion saves and loads the same", () => {
  const w = makePopulationWorld(seedFromText("round d motion"), { frequency: 16 });
  w.runTo(5 * YEAR);
  const store = motionOf(w)!;
  assert.ok(store.begun);
  assert.equal(shiftNow(w).key, "", "nothing has moved in five quiet years");
  assert.ok(strainsOf(w));
  w.submit("act.warm", { sign: 1, years: 1000, strength: 3 });
  w.runTo(40 * YEAR);
  const shift = shiftNow(w);
  assert.ok(shift.key && shift.warm > 5, `${shift.key}`);
  const ctx = populationContext(w),
    g = homePlanet(w).generated;
  let now = 0,
    made = 0;
  for (let c = 0; c < g.offworld.base; c++) {
    now += provinceCapacity(ctx, c).forage;
    made += provinceCapacity(ctx, c, 0).forage;
  }
  assert.ok(now !== made, "the land's yield moved with its ground");
  const again = loadWorld(
    JSON.parse(JSON.stringify(saveWorld(w, "r"))) as ReturnType<typeof saveWorld>,
    (s) => makePopulationWorld(s, { frequency: 16 }),
    "r",
  ).world;
  assert.deepEqual(again.domainHashes(), w.domainHashes());
  again.runTo(48 * YEAR);
  w.runTo(48 * YEAR);
  assert.deepEqual(again.domainHashes(), w.domainHashes());
});
