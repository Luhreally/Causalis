// What a town mode lays over its lots (N5): each reading's values within its ends, said in words, and only read: asking
// them moves neither the place nor its world.
import assert from "node:assert/strict";
import { test } from "node:test";
import { HOUR, loadWorld, saveWorld, type World } from "../../src/kernel/index.ts";
import { populationContext } from "../../src/sim/index.ts";
import { EARTH } from "../../src/host/index.ts";
import { enterPlace, placeDigest, placesOf } from "../../src/host/place.ts";
import { placeFrame } from "../../src/host/placeplan.ts";
import { placeOverlay } from "../../src/host/placeoverlay.ts";
import type { PlaceOverlayKind } from "../../src/bridge/index.ts";
import { universeWorld } from "./worlds.ts";

const copy = (w: World): World =>
  loadWorld(
    JSON.parse(JSON.stringify(saveWorld(w, "r", { universe: "earth" }))),
    (s) => EARTH.build(s),
    "r",
  ).world;

test("each overlay reads every lot it can within its ends, in words, and moves nothing", () => {
  const w = copy(universeWorld(EARTH, "first light", 150)),
    ctx = populationContext(w),
    town = ctx.settlements
      .all()
      .filter((s) => ctx.settlements.held(s.ref) && s.population > 0)
      .sort((a, b) => Math.abs(a.population - 400) - Math.abs(b.population - 400))[0]!.ref;
  enterPlace(w, town);
  for (let h = 0; h < 30; h++) {
    w.runTo(w.now + HOUR);
    placeFrame(w, town, []);
  }
  const place = placesOf(w)!.get(town)!,
    was = placeDigest(place),
    hashes = JSON.stringify(w.domainHashes());
  for (const of of ["needs", "mood", "room", "work", "age", "danger"] as PlaceOverlayKind[]) {
    const o = placeOverlay(w, place, of);
    assert.equal(o.of, of);
    if (of !== "danger") assert.ok(o.lots.length > 0, `${of}: some lots read`);
    const seen = new Set<number>();
    for (const x of o.lots) {
      assert.ok(x.v >= 0 && x.v <= 1, `${of}: ${x.v} within its ends`);
      assert.ok(x.words.length > 4 && !/undefined|NaN/.test(x.words), x.words);
      assert.ok(!seen.has(x.lot), `${of}: lot ${x.lot} read once`);
      seen.add(x.lot);
    }
    assert.ok(o.low && o.high);
  }
  assert.equal(placeDigest(place), was, "the place as it was");
  assert.equal(JSON.stringify(w.domainHashes()), hashes, "its world as it was");
});
