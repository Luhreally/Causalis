// Drafting by name (town mode, R9), as RimWorld's draft has it: one of the town put under arms by your word, whatever
// the muster, stands where they were told (their home, here) in the hours their work would have had, their page saying
// so; stood down, they go back to their work. And its beasts and power
// page: its keepers each a herder of it, by their hours; the rungs of what drives its works, hands always. Read only.
import assert from "node:assert/strict";
import { test } from "node:test";
import { HOUR, type World } from "../../src/kernel/index.ts";
import { OCC } from "../../src/rules/index.ts";
import {
  ACT,
  BOUND_ARMS,
  WHY,
  advancePlace,
  enterPlace,
  placeDigest,
  placeIndexOf,
  type Place,
} from "../../src/host/place.ts";
import { placeInspect } from "../../src/host/placeinspect.ts";
import {
  placeBeastsRef,
  placePersonRef,
  type PlaceInspectBeasts,
  type PlaceInspectPerson,
} from "../../src/bridge/index.ts";
import { noTown, placeWorld, townWhere } from "./worlds.ts";

const order = (w: World, type: string, args: unknown): void => {
  const c = w.submit(type, args);
  w.runTo(c.t);
};
const hours = (w: World, place: Place, n: number): void => {
  for (let h = 0; h < n; h++) {
    w.runTo(w.now + HOUR);
    advancePlace(w, place);
  }
};
const hour = (place: Place) => (((place.t % 86_400) + 86_400) % 86_400) / 3600;

test("one drafted by name stands where told in their working hours, and goes back to work stood down", (t) => {
  const w0 = placeWorld(150),
    s = townWhere(w0, () => true, { near: 600, least: 100 }) ?? noTown(t, "of a hundred");
  if (!s) return;
  const town: string = s.ref,
    w = w0,
    place = enterPlace(w, town)!;
  // (A grown farmer of it, well and held by no order; not its healer, who keeps to their calling.)
  const p = place.people;
  let i = -1;
  for (let k = 0; k < p.n && i < 0; k++)
    if ((p.sexOcc[k]! & 15) === OCC.farmer && !p.bound[k] && !p.ill[k] && p.id[k] !== place.healer)
      i = k;
  if (i < 0) return void t.skip("no grown farmer free of orders");
  const id = p.id[i]!,
    home = place.houses.home[p.house[i]!]!;
  order(w, "place.draft", { town, person: id, at: home });
  // (On to a working hour of the next day: they stand at their home under arms.)
  hours(w, place, 24);
  while (hour(place) < 9 || hour(place) > 15) hours(w, place, 1);
  assert.equal(p.bound[placeIndexOf(place, id)], BOUND_ARMS, "under arms by the draft");
  // (In the working hours, unless a need presses past what their post is worth: at, or on the way to, their home.)
  let stood = 0,
    x = placeInspect(w, town, placePersonRef(town, id)) as PlaceInspectPerson;
  assert.equal(x.drafted, home);
  for (let h = 0; h < 6; h++) {
    const j = placeIndexOf(place, id);
    if (p.why[j] === WHY.arms) {
      assert.equal(p.act[j], ACT.guard);
      assert.equal(p.eta[j] ? p.to[j] : p.at[j], home, "at, or on the way to, their home");
      x = placeInspect(w, town, placePersonRef(town, id)) as PlaceInspectPerson;
      assert.match(x.why, /^Drafted by your word: standing at /);
      stood++;
    }
    hours(w, place, 1);
  }
  t.diagnostic(`${x.name}: ${x.now}; ${x.why}; ${stood} of 6 working hours at their post`);
  assert.ok(stood >= 3, "standing where told most of their working hours");
  // (Stood down: back to their work.)
  order(w, "place.draft", { town, person: id, at: null });
  hours(w, place, 2);
  assert.notEqual(p.bound[placeIndexOf(place, id)], BOUND_ARMS, "stood down");
});

test("its beasts and power: its keepers each a herder of it, by their hours; hands always drive its works", (t) => {
  const w = placeWorld(150),
    s = townWhere(w, () => true, { near: 3000, least: 200 }) ?? noTown(t, "of two hundred");
  if (!s) return;
  const town: string = s.ref,
    place = enterPlace(w, town)!,
    before = placeDigest(place),
    x = placeInspect(w, town, placeBeastsRef(town)) as PlaceInspectBeasts;
  assert.equal(x.kind, "beasts");
  const herders = Array.from({ length: place.people.n }, (_, k) => k).filter(
    (k) => (place.people.sexOcc[k]! & 15) === OCC.herder,
  ).length;
  assert.equal(x.keepers.length + x.more, herders);
  for (let k = 1; k < x.keepers.length; k++)
    assert.ok(x.keepers[k - 1]!.hours >= x.keepers[k]!.hours);
  assert.equal(x.power.length, 4);
  assert.ok(x.power[0]!.on, "hands always");
  // (A rung is lit only above one lit: what drives it climbs.)
  t.diagnostic(
    `${x.sub}; ${x.power.map((r) => `${r.rung} ${r.on ? "on" : "off"}`).join(", ")}; ${x.carry.join("; ")}`,
  );
  assert.equal(placeDigest(place), before, "read only");
});
