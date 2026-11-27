// What lies below a town and the water it draws (town mode, O8): its land's soil and rocks as its land's page tells
// them, each lode dug on its land with its depth and whether it gave out, its water at hand by the same reading as its
// Build sheet asks a well by, its wells standing, the rain on its land; reached from its square's page; the place read only.
import assert from "node:assert/strict";
import { test } from "node:test";
import { HOUR } from "../../src/kernel/index.ts";
import { homePlanet, lodesOf, populationContext, watersOf } from "../../src/sim/index.ts";
import { advancePlace, enterPlace, placeDigest } from "../../src/host/place.ts";
import { placeInspect } from "../../src/host/placeinspect.ts";
import { groundLayers } from "../../src/host/inspect/ground.ts";
import { placeBelowRef, type PlaceInspectBelow } from "../../src/bridge/index.ts";
import { placeWorld, townWhere } from "./worlds.ts";

test("below a town: its ground, its lodes, its water and wells, read of its world; the place only read", () => {
  const w = placeWorld(150),
    ctx = populationContext(w),
    g = homePlanet(w).generated;
  let read = 0,
    rained = 0;
  for (const s of ctx.settlements
    .all()
    .filter((x) => ctx.settlements.held(x.ref) && x.population > 60)
    .slice(0, 8)) {
    const place = enterPlace(w, s.ref);
    if (!place) continue;
    const x = placeInspect(w, s.ref, placeBelowRef(s.ref)) as PlaceInspectBelow;
    assert.equal(x?.kind, "below", s.ref);
    assert.ok(!/undefined|NaN/.test(JSON.stringify(x)), JSON.stringify(x));
    const layers = groundLayers(w, place.cell);
    if (!x.undersea) {
      assert.deepEqual(x.rocks, layers?.rocks ?? [], "its rocks as its land's ground has them");
      assert.equal(
        x.water !== null,
        watersOf(g, place.cell),
        "water at hand as its Build sheet reads it",
      );
    }
    const lodes = (lodesOf(w)?.all() ?? []).filter(
      (l) => l.cell === place.cell && (l.dug > 0 || l.out !== null),
    );
    assert.equal(x.lodes.length, lodes.length, "each lode dug on its land");
    for (const l of x.lodes) assert.ok(l.tier >= 0 && l.tier <= 3 && l.words.length > 0);
    assert.ok(x.rain >= 0 && /mm of rain/.test(x.words));
    read++;
    if (x.rain > 0) rained++;
  }
  assert.ok(read >= 5, `${read} towns read`);
  // (Its rain as its land's page reads it, at its land's middle: none of a world's peopled lands is wholly dry.)
  assert.equal(rained, read, "rain on each land");
  // (One town's place only read: as before, an hour on.)
  const s = townWhere(w, () => true, { near: 400, least: 100 })!,
    place = enterPlace(w, s.ref)!;
  w.runTo(w.now + HOUR);
  advancePlace(w, place);
  const before = placeDigest(place);
  placeInspect(w, s.ref, placeBelowRef(s.ref));
  assert.equal(placeDigest(place), before, "the place only read");
});
