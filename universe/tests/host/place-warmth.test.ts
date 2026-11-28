// Clothes and rooms against the cold (town mode, P5): the town's clothes keep off a share of the cold out of doors, by its
// land's cloth (wool, a beast's hair or down, else a plant's weave) and how fine its middling hands make a garment; indoors,
// a home or a building with a fire kept for its work keeps out all of it, and other walls let in three tenths of it. In a
// cold land's winter those in fireless buildings are colder than those at home and warmer than those out of doors; each
// told on its page.
import assert from "node:assert/strict";
import { test } from "node:test";
import { HOUR, loadWorld, saveWorld, type World } from "../../src/kernel/index.ts";
import {
  advancePlace,
  dressWarmth,
  enterPlace,
  placeCold,
  placeRoomLets,
  type Place,
} from "../../src/host/place.ts";
import { placeInspect } from "../../src/host/placeinspect.ts";
import { placeItemRef, placeLotRef, type PlaceInspectLot } from "../../src/bridge/index.ts";
import { PLACE_UNIVERSE, noTown, placeWorld, townWhere } from "./worlds.ts";

const copy = (w: World): World =>
  loadWorld(
    JSON.parse(JSON.stringify(saveWorld(w, "r", { universe: PLACE_UNIVERSE.name }))),
    (s) => PLACE_UNIVERSE.build(s),
    "r",
  ).world;
const COLD = 2;

test("the town's clothes keep off the cold out of doors; walls without a fire let some in, a home none", (t) => {
  const w0 = placeWorld(150),
    s =
      townWhere(w0, (place, w) => placeCold(w, place) > 0.3, { near: 600, least: 300 }) ??
      noTown(t, "in a cold land's winter");
  if (!s) return;
  const town: string = s.ref,
    w = copy(w0),
    place = enterPlace(w, town)!,
    dw = dressWarmth(w, place);
  assert.ok(dw > 0 && dw <= 0.6, `its clothes keep off ${dw}`);
  const width = place.people.needs.length / place.people.id.length,
    at = (pl: Place) => {
      const p = pl.people,
        home: number[] = [],
        walls: number[] = [];
      for (let i = 0; i < p.n; i++) {
        if (p.eta[i]! > 0) continue;
        const lot = p.at[i]!,
          c = p.needs[i * width + COLD]!;
        if (lot === pl.houses.home[p.house[i]!]) home.push(c);
        else if (lot >= 0 && placeRoomLets(pl, lot) > 0) walls.push(c);
      }
      const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
      return { home: mean(home), walls: mean(walls), n: walls.length };
    };
  // (Through a working day of its winter: those at work in fireless buildings, those at home.)
  let seen = { home: 0, walls: 0, n: 0 };
  for (let h = 0; h < 36; h++) {
    w.runTo(w.now + HOUR);
    advancePlace(w, place);
    const x = at(place);
    if (x.n > seen.n && placeCold(w, place) > 0.2) seen = x;
  }
  assert.ok(seen.n > 0, "some at work in fireless buildings in the cold");
  assert.ok(
    seen.walls > seen.home,
    `colder in fireless walls than at home (${seen.walls} / ${seen.home})`,
  );
  // Each told: a building's warmth on its page, a garment's on its own.
  const b = place.bldgs;
  let fireless = 0;
  for (let k = 0; k < b.lot.length; k++) {
    const lot = b.lot[k]!;
    if (lot < 0) continue;
    const page = placeInspect(w, town, placeLotRef(town, lot)) as PlaceInspectLot;
    if (placeRoomLets(place, lot) > 0) {
      assert.match(page.warmth ?? "", /let in 30% of the cold/);
      fireless++;
    } else assert.match(page.warmth ?? "", /^Warm in any cold/);
  }
  assert.ok(fireless > 0);
  const home = placeInspect(w, town, placeLotRef(town, place.houses.home[0]!)) as PlaceInspectLot;
  assert.match(home.warmth ?? "", /^Warm in any cold/);
  const coat = placeInspect(w, town, placeItemRef(town, place.people.id[0]!, 2)) as {
    use?: string;
  } | null;
  assert.match(coat?.use ?? "", new RegExp(`keeps off ${Math.round(dw * 100)}% of the cold`));
});
