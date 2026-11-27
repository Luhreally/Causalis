// Needs met by the day (town mode, asked 2026-11-26: "more needs where the world has the means, such as warmth, comfort,
// beauty and company, each with a cause in the place"): comfort, their home's beds for all who sleep under it; beauty, a
// fine work of the town's in sight of its door, where the town has any. Each weighs on the mood with its cause (the home,
// the work's lot), the same for every tier, and is told on their page.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  HOUR,
  loadWorld,
  saveWorld,
  type World,
} from "../../src/kernel/index.ts";
import { populationContext, type Settlement } from "../../src/sim/index.ts";
import {
  COND,
  enterPlace,
  lotOfSrc,
  placeDigest,
  placeMoodTerms,
  placeNeedsMore,
  placesOf,
} from "../../src/host/place.ts";
import { placeFrame } from "../../src/host/placeplan.ts";
import { inspectPerson } from "../../src/host/placeinspect.ts";
import { PLACE_UNIVERSE, placeWorld } from "./worlds.ts";

const base = (): World => placeWorld(150);
const copy = (w: World): World => {
  const doc = JSON.parse(
    JSON.stringify(saveWorld(w, "r", { universe: PLACE_UNIVERSE.name })),
  );
  return loadWorld(doc, (s) => PLACE_UNIVERSE.build(s), "r").world;
};
const near = (w: World, people: number): Settlement => {
  const ctx = populationContext(w);
  return ctx.settlements
    .all()
    .filter((s) => ctx.settlements.held(s.ref) && s.population > 0)
    .sort(
      (a, b) =>
        Math.abs(a.population - people) - Math.abs(b.population - people) ||
        (a.ref < b.ref ? -1 : 1),
    )[0]!;
};
const go = (w: World, ref: string, hours: number) => {
  for (let h = 0; h < hours; h++) {
    w.runTo(w.now + HOUR);
    placeFrame(w, ref, []);
  }
};

test("comfort by their home's beds for all under it; beauty by a fine work in sight of its door; each with its cause", () => {
  const w = copy(base()),
    ref = near(w, 600).ref;
  enterPlace(w, ref);
  go(w, ref, 2);
  const place = placesOf(w)!.get(ref)!,
    houses = place.houses;
  // As made, a home's beds hold those under it.
  let roomy = 0,
    all = 0;
  for (let i = 0; i < place.people.n; i++) {
    const x = placeNeedsMore(w, place, i);
    all++;
    if (x.room >= 1) roomy++;
    assert.ok(x.beds >= 0 && x.under >= 1);
  }
  assert.ok(roomy / all > 0.5, `${roomy} of ${all} with a bed each`);
  // Three households crowded under one roof: less comfort, of that home; told on their page.
  const a = 0,
    home = houses.home[a]!;
  for (const h of [1, 2, 3]) houses.home[h] = home;
  go(w, ref, 24);
  const i = place.people.house.indexOf(a),
    x = placeNeedsMore(w, place, i);
  assert.ok(x.room < 1, `${x.under} under ${x.beds} beds`);
  const room = placeMoodTerms(w, place, i).find((t) => t.cond === COND.room)!;
  assert.ok(
    room && room.size < 0 && lotOfSrc(room.src!) === home,
    JSON.stringify(room),
  );
  const seen = inspectPerson(w, place, place.people.id[i]!)!;
  assert.ok(
    seen.needs.some(
      (n) => n.name === "Comfort" && /under their roof/.test(n.words ?? ""),
    ),
  );
  assert.ok(
    seen.thoughts.some((t) => /home's room/.test(t.words) && t.size < 0),
  );
  // A masterful work set at their very door: beauty, of that lot.
  place.works = [home, place.t, 0, 0, 0, 0, 4];
  go(w, ref, 24);
  const b = placeMoodTerms(w, place, i).find((t) => t.cond === COND.beauty)!;
  assert.ok(b && b.size > 0 && lotOfSrc(b.src!) === home, JSON.stringify(b));
  assert.ok(
    inspectPerson(w, place, place.people.id[i]!)!.needs.some(
      (n) => n.name === "Beauty" && /masterful work/.test(n.words ?? ""),
    ),
  );
  // Nothing of it kept: a copy goes on the same.
  const again = copy(w);
  go(w, ref, 30);
  go(again, ref, 30);
  assert.equal(placeDigest(placesOf(again)!.get(ref)!), placeDigest(place));
});
