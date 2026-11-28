// A strange mood (town mode, P8): now and again a maker long at their craft, by their wonder, makes a masterwork past their
// own skill; it is kept as the town's works are (masterful), named in its people's tongue with its maker's name, first in
// the town's legends, on its own page made in a strange mood; and told in its log. Kept through a save.
import assert from "node:assert/strict";
import { test } from "node:test";
import { HOUR, loadWorld, saveWorld, type World } from "../../src/kernel/index.ts";
import {
  HAP,
  advancePlace,
  enterPlace,
  placeArt,
  placeFacets,
  placeIndexOf,
  placesOf,
} from "../../src/host/place.ts";
import { placeInspect } from "../../src/host/placeinspect.ts";
import {
  placeLegendsRef,
  placeWorkRef,
  type PlaceInspectLegends,
  type PlaceInspectWork,
} from "../../src/bridge/index.ts";
import { PLACE_UNIVERSE, noTown, placeWorld, townWhere } from "./worlds.ts";

const copy = (w: World): World =>
  loadWorld(
    JSON.parse(JSON.stringify(saveWorld(w, "r", { universe: PLACE_UNIVERSE.name }))),
    (s) => PLACE_UNIVERSE.build(s),
    "r",
  ).world;

test("a strange mood: a masterwork past its maker's skill, named, first in the legends, told, kept", (t) => {
  const w0 = placeWorld(150),
    s = townWhere(w0, () => true, { near: 3000, least: 1500 }) ?? noTown(t, "of fifteen hundred");
  if (!s) return;
  const town: string = s.ref,
    w = copy(w0),
    place = enterPlace(w, town)!;
  // (Up to two years, till one is made: a town this size makes a score of works a year.)
  for (let d = 0; d < 730 && !(place.arts ?? []).length; d++)
    for (let h = 0; h < 24; h++) {
      w.runTo(w.now + HOUR);
      advancePlace(w, place);
    }
  if (!(place.arts ?? []).length)
    return void noTown(t, "whose makers were seized by a strange mood in two years");
  const [made, maker] = place.arts as [number, number];
  assert.ok(placeArt(place, made, maker));
  // (Kept as the town's works are: masterful, where it was made.)
  const w7 = place.works ?? [];
  let lot = -99,
    quality = -1;
  for (let k = 0; k + 6 < w7.length; k += 7)
    if (w7[k + 1] === made && w7[k + 2] === maker) [lot, quality] = [w7[k]!, w7[k + 6]!];
  assert.ok(lot !== -99, "kept among its works");
  assert.equal(quality, 4, "masterful");
  // (Its maker wondering: a strange mood comes by their wonder.)
  const m = placeIndexOf(place, maker);
  if (m >= 0) assert.ok(placeFacets(place, m)[5]! > 0);
  // (Told as it was made, at the hour of the tick it was made in: the log's line, by its maker.)
  assert.ok(
    place.log.some((x) => x.what === HAP.inspired && x.id === maker),
    "told in its log as it was made",
  );
  // Its page and the legends: named in its people's tongue, with its maker's name; first.
  const page = placeInspect(w, town, placeWorkRef(town, lot, made, maker)) as PlaceInspectWork;
  assert.equal(page.kind, "work");
  assert.match(page.name, /^“[^”]+”, \S+'s /);
  assert.match(page.quality, /strange mood/);
  assert.match(page.words, /^Made in a strange mood/);
  const legends = placeInspect(w, town, placeLegendsRef(town)) as PlaceInspectLegends;
  assert.equal(legends.works[0]!.name, page.name, "first in its legends");
  // Kept through a save: the same works of a strange mood, the same name.
  const back = copy(w),
    kept = placesOf(back)!.get(town)!;
  assert.deepEqual(kept.arts, place.arts);
  assert.equal(
    (placeInspect(back, town, placeWorkRef(town, lot, made, maker)) as PlaceInspectWork).name,
    page.name,
  );
});
