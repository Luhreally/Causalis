// Town mode, the people bar's pins kept by the town (asked 2026-11-26: "people i have pinned from that town should be in
// the people tab of the rimworld mode"): those of a town's people pinned on the god game's people bar (by their page) are
// pinned in its People sheet too, first in All and alone under its Pinned chip, with those followed by your word in the
// town; the pins kept by the town follow them in full, and one taken off the bar is let go of. The pins are the place's,
// in no world's hash.
import assert from "node:assert/strict";
import { test } from "node:test";
import { HOUR, loadWorld, saveWorld, type World } from "../../src/kernel/index.ts";
import { populationContext, townsOf, type Settlement } from "../../src/sim/index.ts";
import { TIER, enterPlace, placePin, placeTier } from "../../src/host/place.ts";
import {
  PEOPLE_PINNED,
  peopleSheet,
  placeFrame,
  placeQueries,
  placeWho,
} from "../../src/host/placeplan.ts";
import { PLACE_UNIVERSE, placeWorld } from "./worlds.ts";

const base = (): World => placeWorld(150);
const copy = (w: World): World => {
  const doc = JSON.parse(JSON.stringify(saveWorld(w, "r", { universe: PLACE_UNIVERSE.name })));
  return loadWorld(doc, (s) => PLACE_UNIVERSE.build(s), "r").world;
};
const near = (w: World, people: number): Settlement => {
  const ctx = populationContext(w);
  return ctx.settlements
    .all()
    .filter((s) => ctx.settlements.held(s.ref) && townsOf(w).get(s.ref) && s.population > 0)
    .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))
    .reduce((a, b) => (Math.abs(b.population - people) < Math.abs(a.population - people) ? b : a));
};

test("the people bar's pins in the town's People sheet: first, alone under their chip, followed in full, let go of", () => {
  const w = copy(base()),
    s = near(w, 900),
    place = enterPlace(w, s.ref)!,
    queries = placeQueries(() => null),
    pins = queries["place.pins"]!;
  w.runTo(w.now + HOUR);
  placeFrame(w, s.ref, []);
  const p = place.people,
    who = placeWho(w, place),
    // (Two of its people, by their pages, and one who is no one of it.)
    a = Math.floor(p.n / 3),
    b = Math.floor((2 * p.n) / 3),
    refs = [who(a).ref, who(b).ref, "person:nowhere"];
  const all = peopleSheet(w, place, null, 60, refs);
  assert.equal(all.pinned, 2);
  assert.deepEqual([...all.pinsHere].sort(), [who(a).ref, who(b).ref].sort());
  assert.ok(all.rows[0]!.pinned && all.rows[1]!.pinned, "first in All");
  assert.ok(all.rows.slice(2).every((r) => !r.pinned));
  const only = peopleSheet(w, place, PEOPLE_PINNED, 60, refs);
  assert.equal(only.all, 2);
  assert.deepEqual(only.rows.map((r) => r.id).sort(), [p.id[a]!, p.id[b]!].sort());
  // Kept by the town: followed in full by word, for good.
  assert.equal(pins(w, { ref: s.ref, pins: refs, was: [] }), 2);
  assert.equal(placeTier(place, a).pinned, -1);
  assert.equal(placeTier(place, b).tier, TIER.full);
  // One followed by word in the town is pinned in its sheet too, without the bar.
  const c = Math.floor(p.n / 2);
  placePin(place, p.id[c]!, -1);
  assert.equal(peopleSheet(w, place, PEOPLE_PINNED, 60, refs).all, 3);
  // One taken off the bar: let go of; the other kept.
  pins(w, { ref: s.ref, pins: [who(b).ref], was: refs });
  assert.equal(placeTier(place, a).pinned, null);
  assert.equal(placeTier(place, b).pinned, -1);
  assert.equal(
    placeTier(place, c).pinned,
    -1,
    "a word given in the town is not the bar's to take back",
  );
  // The same however often it is asked, and nothing of the world's moved: its hash is not the place's.
  assert.deepEqual(peopleSheet(w, place, null, 60, refs), peopleSheet(w, place, null, 60, refs));
});
