// One's family in the town (town mode, P3): each born in it is born to their mother and the one she is paired with, kept by
// number with the place (and through a save); a family's page tells parents, grandparents, the one paired with or promised
// to, brothers and sisters, children and grandchildren, each a key while of the town; a mother's page has her child among
// her children, and the child's has her as its mother. Only read: the place as its twin.
import assert from "node:assert/strict";
import { test } from "node:test";
import { HOUR, loadWorld, saveWorld, type World } from "../../src/kernel/index.ts";
import {
  advancePlace,
  enterPlace,
  placeDigest,
  placeIndexOf,
  placesOf,
} from "../../src/host/place.ts";
import { placeInspect } from "../../src/host/placeinspect.ts";
import {
  placeFamilyRef,
  placePersonRef,
  type PlaceInspectFamily,
  type PlaceInspectPerson,
} from "../../src/bridge/index.ts";
import { PLACE_UNIVERSE, noTown, placeWorld, townWhere } from "./worlds.ts";

const copy = (w: World): World =>
  loadWorld(
    JSON.parse(JSON.stringify(saveWorld(w, "r", { universe: PLACE_UNIVERSE.name }))),
    (s) => PLACE_UNIVERSE.build(s),
    "r",
  ).world;

test("those born in the town kept with their mother and father; a family's page each of its kin, both ways; kept through a save", (t) => {
  const w0 = placeWorld(150),
    s = townWhere(w0, () => true, { near: 2000, least: 800 }) ?? noTown(t, "of eight hundred");
  if (!s) return;
  const town: string = s.ref,
    w = copy(w0),
    twin = copy(w0),
    place = enterPlace(w, town)!,
    other = enterPlace(twin, town)!,
    p = place.people;
  // (Kept before any is born: none has parents, and its digest is as it was before parents were kept.)
  assert.ok(!p.mother.subarray(0, p.n).some((x) => x) && !p.father.subarray(0, p.n).some((x) => x));
  let born: number[] = [];
  for (let d = 0; d < 120 && born.length < 2; d++) {
    for (let h = 0; h < 24; h++) {
      w.runTo(w.now + HOUR);
      advancePlace(w, place);
      twin.runTo(twin.now + HOUR);
      advancePlace(twin, other);
    }
    born = [];
    for (let i = 0; i < p.n; i++) if (p.mother[i]) born.push(i);
  }
  assert.ok(born.length > 0, "one born in the town in four months");
  for (const i of born) {
    const id = p.id[i]!,
      mother = p.mother[i]!,
      m = placeIndexOf(place, mother),
      fam = placeInspect(w, town, placeFamilyRef(town, id)) as PlaceInspectFamily;
    assert.equal(fam.kind, "family");
    assert.ok(!/undefined|NaN/.test(JSON.stringify(fam)), JSON.stringify(fam).slice(0, 300));
    assert.ok(m >= 0, "their mother of the town");
    // (Born to one who bears; their father the one she is paired with, where she is.)
    assert.equal(p.sexOcc[m]! >> 4, 0, "their mother bears");
    assert.equal(fam.parents[0]!.ref, placePersonRef(town, mother));
    assert.equal(placeInspect(w, town, fam.parents[0]!.ref!)?.kind, "person");
    const mf = placeInspect(w, town, placeFamilyRef(town, mother)) as PlaceInspectFamily;
    assert.ok(
      mf.children.some((c) => c.ref === placePersonRef(town, id)),
      "among their mother's children",
    );
    if (p.father[i]) {
      const f = placeIndexOf(place, p.father[i]!);
      if (f >= 0) {
        const ff = placeInspect(w, town, placeFamilyRef(town, p.father[i]!)) as PlaceInspectFamily;
        assert.ok(
          ff.children.some((c) => c.ref === placePersonRef(town, id)),
          "among their father's children",
        );
        assert.equal(fam.parents[1]!.ref, placePersonRef(town, p.father[i]!));
      }
    }
    // (Their brothers and sisters are their mother's other children.)
    for (const sib of fam.siblings)
      assert.ok(mf.children.some((c) => c.ref === sib.ref) || !!p.father[i], sib.name);
    // (Their page leads to it.)
    const page = placeInspect(w, town, placePersonRef(town, id)) as PlaceInspectPerson;
    assert.equal(page.familyRef, placeFamilyRef(town, id));
  }
  // (One not of the town: no page.)
  assert.equal(placeInspect(w, town, placeFamilyRef(town, 0)), null);
  // Kept through a save: read back, the same mothers and fathers.
  const back = copy(w),
    kept = placesOf(back)!.get(town)!;
  for (const i of born) {
    const j = placeIndexOf(kept, p.id[i]!);
    assert.ok(j >= 0);
    assert.equal(kept.people.mother[j], p.mother[i]);
    assert.equal(kept.people.father[j], p.father[i]);
  }
  // (Only read: as its twin, which no one looked at.)
  assert.equal(placeDigest(place), placeDigest(other), "the place only read");
});
