// Gaps round (2026-11-24): what a principle is found from. How readily a land finds what it could is by what it has to find
// it with: its ore's nearness, its fuel's heat a kilogram, the hands its food leaves free, and the sickness it has met and read.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PRINCIPLES,
  SUBSTRATE,
  SUBSTRATE_ASKS,
  substrateOf,
  type SubstrateFacts,
} from "../../src/rules/index.ts";

const P = (id: string) => PRINCIPLES.find((p) => p.id === id)!,
  LAND: SubstrateFacts = { reach: true, fuelMj: 12.4, spare: 0.2, sickDead: 0, readers: 0.4 };

test("which forces a principle answers to is read from the principle, never listed", () => {
  const met = PRINCIPLES.filter((p) => SUBSTRATE_ASKS.get(p.id)!.met).map((p) => p.id);
  // What of healing is found through a lens, and what grows straight from it; herb-lore and medicine are not.
  assert.deepEqual(met.sort(), ["germs", "quarantine", "vaccines"]);
  assert.ok(SUBSTRATE_ASKS.get("steam-engine")!.energy && SUBSTRATE_ASKS.get("factories")!.energy);
  assert.ok(!SUBSTRATE_ASKS.get("plough")!.energy && !SUBSTRATE_ASKS.get("plough")!.surplus);
  assert.equal(SUBSTRATE_ASKS.get("tanning")!.specialists, 0);
  assert.equal(SUBSTRATE_ASKS.get("steam-engine")!.specialists, 1);
});

test("the seeds of sickness are found by the sickness met and read: a hundredfold between none and thousands", () => {
  const none = substrateOf(P("germs"), LAND, null).k,
    some = substrateOf(P("germs"), { ...LAND, sickDead: 250 }, null).k,
    many = substrateOf(P("germs"), { ...LAND, sickDead: 50_000 }, null).k,
    unread = substrateOf(P("germs"), { ...LAND, sickDead: 50_000, readers: 0 }, null).k;
  assert.ok(Math.abs(none - SUBSTRATE.seenLeast) < 1e-9);
  assert.ok(
    Math.abs(some - 1) < 1e-9,
    "a hundred deaths set down by those who read: the reference",
  );
  assert.ok(Math.abs(many - SUBSTRATE.seenMost) < 1e-9);
  assert.equal(unread, none, "what no one can read is not set down");
  // Medicine is not found by looking through a lens: it does not answer to it.
  assert.equal(
    substrateOf(P("medicine"), LAND, null).k,
    substrateOf(P("medicine"), { ...LAND, sickDead: 50_000 }, null).k,
  );
});

test("an engine is found the more readily with coal at hand than with wood, the least with nothing to burn", () => {
  const steam = P("steam-engine"),
    wood = substrateOf(steam, LAND, null).k,
    coal = substrateOf(steam, { ...LAND, fuelMj: 26.3 }, null).k,
    bare = substrateOf(steam, { ...LAND, fuelMj: 0 }, null).k,
    unburning = substrateOf(steam, { ...LAND, fuelMj: -1 }, null).k;
  assert.ok(coal > wood && wood >= bare, `${coal} ${wood} ${bare}`);
  assert.ok(coal / wood > 1.9, "coal's heat a kilogram is twice wood's");
  assert.equal(
    unburning,
    1,
    "where nothing burns its fuel bends nothing: its engines are of another heat",
  );
  // The plough is no engine: fuel bends nothing of it.
  assert.equal(
    substrateOf(P("plough"), LAND, null).k,
    substrateOf(P("plough"), { ...LAND, fuelMj: 26.3 }, null).k,
  );
});

test("ore in a land's own ground, a heat well past what is asked, and hands spared from the fields", () => {
  const iron = P("iron");
  assert.ok(substrateOf(iron, LAND, 1).k > substrateOf(iron, LAND, 0.5).k);
  // Where nothing burns, a heat twice what iron asks against one that barely reaches it.
  const barely = substrateOf(iron, { ...LAND, reach: 1200 }, 1, 1200).k,
    past = substrateOf(iron, { ...LAND, reach: 2400 }, 1, 1200).k;
  assert.ok(Math.abs(past / barely - SUBSTRATE.heatMost) < 1e-9);
  assert.equal(
    substrateOf(iron, LAND, 1, 1200).k,
    barely,
    "a world that burns has any heat with the craft",
  );
  // What lies deep is specialists' work: by the hands its food leaves free. What rests on nothing is its makers' own.
  const few = substrateOf(P("mills"), { ...LAND, spare: 0.05 }, null),
    many = substrateOf(P("mills"), { ...LAND, spare: 0.5 }, null);
  assert.ok(Math.abs(few.k - SUBSTRATE.spareLeast) < 1e-9);
  assert.ok(Math.abs(many.k - SUBSTRATE.spareMost) < 1e-9);
  assert.ok(many.parts.some((p) => p.name === "hands its food leaves free"));
  for (const id of ["tanning", "loom", "pottery-wheel", "sailing"])
    assert.equal(
      substrateOf(P(id), { ...LAND, spare: 0.02 }, null).k,
      1,
      `${id}: a forager's own craft`,
    );
  const wood = substrateOf(P("carpentry"), { ...LAND, spare: 0.05 }, null).k;
  assert.ok(wood > 0.9 && wood < 1, `carpentry, one step down: ${wood}`);
});
