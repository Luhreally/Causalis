// A household's table and what its people take (town mode, P4): what its land's people take and how many need it
// (sim/money intox) read once a year a place; those of the town who need it the share its keyed draw takes by number, the
// same through a save; each of them the less at their making by their land's work lost to it, shared among those who need
// it, and the worse in mood for needing it; and a household's table, the foods its pantry holds: a second food a varied
// table, one alone a meagre one only where others of the town eat of more. Each told on their page.
import assert from "node:assert/strict";
import { test } from "node:test";
import { HOUR, loadWorld, saveWorld, type World } from "../../src/kernel/index.ts";
import { intoxDependent, intoxLost } from "../../src/sim/index.ts";
import { FOODS } from "../../src/rules/index.ts";
import {
  advancePlace,
  enterPlace,
  fareMost,
  placeDrink,
  placeTakes,
  placesOf,
  type Place,
} from "../../src/host/place.ts";
import { placeInspect } from "../../src/host/placeinspect.ts";
import { placePersonRef, type PlaceInspectPerson } from "../../src/bridge/index.ts";
import { PLACE_UNIVERSE, noTown, placeWorld, townWhere } from "./worlds.ts";

const copy = (w: World): World =>
  loadWorld(
    JSON.parse(JSON.stringify(saveWorld(w, "r", { universe: PLACE_UNIVERSE.name }))),
    (s) => PLACE_UNIVERSE.build(s),
    "r",
  ).world;
const foodsOf = (place: Place, h: number) => {
  let n = 0;
  for (let k = 0; k < FOODS.length; k++) if (place.houses.pantry[h * FOODS.length + k]! > 0) n++;
  return n;
};

test("those who need what their land takes, by number, worse at their making and in mood; a household's table by its foods", (t) => {
  const w0 = placeWorld(150),
    s =
      townWhere(w0, (place, w) => intoxDependent(w, place.cell) > 0.01, {
        near: 1500,
        least: 300,
      }) ?? noTown(t, "whose land needs what it takes");
  if (!s) return;
  const town: string = s.ref,
    w = copy(w0),
    place = enterPlace(w, town)!;
  for (let h = 0; h < 2 * 24; h++) {
    w.runTo(w.now + HOUR);
    advancePlace(w, place);
  }
  const d = placeDrink(w, place),
    share = intoxDependent(w, place.cell),
    p = place.people;
  assert.equal(d.share, share);
  assert.equal(d.worth, Math.max(0.4, Math.min(1.2, 1 - intoxLost(w, place.cell) / share)));
  // (The share of them its draw takes, about as many as their land's.)
  let takers = 0;
  for (let i = 0; i < p.n; i++) if (placeTakes(place, p.id[i]!, share)) takers++;
  assert.ok(
    takers > 0.4 * share * p.n && takers < 2 * share * p.n + 4,
    `${takers} of ${p.n} at ${share}`,
  );
  // (The same by number through a save.)
  const kept = placesOf(copy(w))!.get(town)!;
  for (let i = 0; i < Math.min(p.n, 200); i++)
    assert.equal(placeTakes(kept, p.id[i]!, share), placeTakes(place, p.id[i]!, share));
  // Each on their page: those grown who need it told so, their mood the worse for it; a household's table by its foods.
  const most = fareMost(place, Math.floor(place.t / 86_400));
  let told = 0,
    varied = 0,
    meagre = 0;
  // (The first three hundred of them, and every one who needs it.)
  const read: number[] = [];
  for (let i = 0; i < p.n; i++) if (i < 300 || placeTakes(place, p.id[i]!, share)) read.push(i);
  for (const i of read) {
    const x = placeInspect(w, town, placePersonRef(town, p.id[i]!)) as PlaceInspectPerson,
      needs = placeTakes(place, p.id[i]!, share) && x.trade !== "child",
      craving = x.thoughts.find((q) => q.words === "Needs what they take"),
      fare = x.thoughts.find((q) => q.words.startsWith("Their household's table")),
      foods = foodsOf(place, p.house[i]!);
    assert.equal(!!x.takes, needs, x.name);
    assert.equal(!!craving, needs, `${x.name}: their mood the worse for needing it`);
    if (craving) assert.ok(craving.size < 0);
    if (needs) told++;
    if (foods >= 2) {
      assert.ok(fare && fare.size > 0, `${x.name}: a varied table`);
      assert.match(x.table, /a varied table/);
      varied++;
    } else if (foods === 1 && most >= 2) {
      assert.ok(fare && fare.size < 0, `${x.name}: a meagre table where others eat of more`);
      meagre++;
    } else assert.equal(fare, undefined, `${x.name}: as the whole town eats`);
  }
  assert.ok(told > 0, "one who needs it told");
  t.diagnostic(
    `${town}: ${takers} of ${p.n} need it (${share}), worth ${d.worth}; ${varied} varied, ${meagre} meagre`,
  );
});
