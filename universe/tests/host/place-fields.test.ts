// A town's fields and its flock on their own page (town mode, O6): who is out in them now and on which field, counted by
// the same field each walks out to (placeFieldOf over the fields its plan lays), herders with the flock; how many work
// them; each field's crop told as it stands through the year, as its plan's view draws it; and the place only read.
import assert from "node:assert/strict";
import { test } from "node:test";
import { DAY, HOUR, YEAR, loadWorld, saveWorld, type World } from "../../src/kernel/index.ts";
import { OCC } from "../../src/rules/index.ts";
import { advancePlace, enterPlace, placeDigest, placeFieldCount } from "../../src/host/place.ts";
import { placeInspect } from "../../src/host/placeinspect.ts";
import { villagePlan } from "../../src/host/village.ts";
import { fieldStands } from "../../src/ui/place-fields.ts";
import {
  PLACE_AT,
  placeFieldOf,
  placeInsideRef,
  type PlaceInspectFields,
} from "../../src/bridge/index.ts";
import type { Ref } from "../../src/kernel/index.ts";
import { PLACE_UNIVERSE, noTown, placeWorld, townWhere } from "./worlds.ts";

const base = (): World => placeWorld(150);
const copy = (w: World): World =>
  loadWorld(
    JSON.parse(JSON.stringify(saveWorld(w, "r", { universe: PLACE_UNIVERSE.name }))),
    (s) => PLACE_UNIVERSE.build(s),
    "r",
  ).world;

test("the fields' page: who is out in them on which field, as its plan lays them; each field's crop through its year; the place only read", (t) => {
  const w0 = base(),
    s =
      townWhere(
        w0,
        (place, w) => {
          let farm = 0;
          for (let i = 0; i < place.people.n; i++)
            if (place.people.work[i] === PLACE_AT.fields) farm++;
          return farm >= 10 && placeFieldCount(w, place) > 0;
        },
        { near: 600, least: 100 },
      ) ?? noTown(t, "with its fields laid and ten who work them");
  if (!s) return;
  const town: string = s.ref;
  const w = copy(w0),
    twin = copy(w0),
    place = enterPlace(w, town)!,
    other = enterPlace(twin, town)!,
    p = place.people,
    ref = placeInsideRef(town, PLACE_AT.fields);
  let seenOut = 0;
  // Through a day and a half: at its working hours, some are out in them.
  for (let h = 0; h < 36; h++) {
    w.runTo(w.now + HOUR);
    advancePlace(w, place);
    twin.runTo(twin.now + HOUR);
    advancePlace(twin, other);
    const x = placeInspect(w, town, ref) as PlaceInspectFields;
    assert.equal(x?.kind, "fields");
    assert.ok(!/undefined|NaN/.test(JSON.stringify(x)), JSON.stringify(x).slice(0, 300));
    const n = placeFieldCount(w, place);
    assert.equal(x.fields, n);
    assert.equal(x.onField.length, n, "a count for each field");
    let out = 0,
      farmers = 0,
      herders = 0,
      others = 0;
    for (let i = 0; i < p.n; i++) {
      if (p.at[i] === PLACE_AT.fields) out++;
      if (p.work[i] !== PLACE_AT.fields) continue;
      const occ = p.sexOcc[i]! & 15;
      if (occ === OCC.farmer) farmers++;
      else if (occ === OCC.herder) herders++;
      else others++;
    }
    assert.equal(
      x.onField.reduce((a, b) => a + b, 0) + x.atPasture,
      out,
      "each out there counted once",
    );
    assert.equal(x.people.length + x.more, out);
    assert.ok(x.people.length <= 40);
    assert.deepEqual(x.working, { farmers, herders, foragers: others });
    // (Each listed on the field they walk out to, a herder with the flock.)
    for (const q of x.people) {
      const i = p.id.indexOf(q.id);
      assert.equal(p.at[i], PLACE_AT.fields, `${q.name} is out there`);
      assert.equal(
        q.field,
        (p.sexOcc[i]! & 15) === OCC.herder ? -1 : placeFieldOf(q.id, n),
        `${q.name} on their own field`,
      );
    }
    seenOut = Math.max(seenOut, out);
  }
  assert.ok(seenOut > 0, "some are out in them at their working hours");
  // (Only read: as its twin, which no one looked at.)
  assert.equal(placeDigest(place), placeDigest(other), "the place only read");
  // The fields its plan draws are the ones counted by.
  const plan = villagePlan(w, town as Ref);
  assert.equal(plan.fields.length, placeFieldCount(w, place), "the plan's fields are the place's");
  // Each field's crop told, and through a year it goes through its stages.
  const year0 = Math.floor(w.now / YEAR) * YEAR,
    told = new Set<string>();
  for (let d = 0; d < 365; d += 5)
    for (let k = 0; k < plan.fields.length; k++) {
      const words = fieldStands(plan, k, year0 + d * DAY + 12 * HOUR);
      assert.ok(words && !/undefined|NaN/.test(words), words);
      told.add(words.replace(/ \(\d+%\)$/, ""));
    }
  assert.ok(told.size >= 4, `the year's stages told: ${[...told].join("; ")}`);
});
