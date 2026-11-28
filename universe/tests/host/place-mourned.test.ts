// Kin as links and a page for the dead (town mode, R1): one who dies of a town keeps a page that outlives them, read
// off how they stood at their death: what took them, as its log told it; their life in short; their kin and those they
// knew, each a tap away; what they carried in mind. Their kin's family pages lead to it, and a person's Life tab has
// their nearest kin a tap away. Kept through a save.
import assert from "node:assert/strict";
import { test } from "node:test";
import { HOUR, loadWorld, saveWorld, type World } from "../../src/kernel/index.ts";
import {
  MOURN_KEPT,
  MOURN_STRIDE,
  advancePlace,
  enterPlace,
  hapIsDeath,
  hapTold,
  placeIndexOf,
  placeMourned,
  placeMournedIds,
  placesOf,
} from "../../src/host/place.ts";
import { placeInspect } from "../../src/host/placeinspect.ts";
import { placeNamed } from "../../src/host/placeplan.ts";
import {
  placeFamilyRef,
  placePersonRef,
  type PlaceInspectDead,
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

test("one who dies of a town keeps a page: what took them, their life, their kin and those they knew, their last memories", (t) => {
  const w0 = placeWorld(150),
    s = townWhere(w0, () => true, { near: 3000, least: 800 }) ?? noTown(t, "of eight hundred");
  if (!s) return;
  const town: string = s.ref,
    w = copy(w0),
    place = enterPlace(w, town)!;
  // (Up to two years, till a dozen have died and one of them left kin among the living: a town this size buries some
  // every month, a child of it now and then.)
  const kinLeft = () =>
    placeMournedIds(place).some((id) => {
      const m = placeMourned(place, id)!;
      return [m.mother, m.father].some((n) => n && placeIndexOf(place, n) >= 0);
    });
  for (let h = 0; h < 730 * 24 && (placeMournedIds(place).length < 12 || !kinLeft()); h++) {
    w.runTo(w.now + HOUR);
    advancePlace(w, place);
  }
  const ids = placeMournedIds(place);
  if (!ids.length) return void noTown(t, "where anyone died in a year");
  assert.ok((place.mourned ?? []).length <= MOURN_KEPT * MOURN_STRIDE);
  assert.equal((place.mourned ?? []).length % MOURN_STRIDE, 0);
  const named = placeNamed(w, place);
  for (const id of ids) {
    const m = placeMourned(place, id)!;
    assert.equal(placeIndexOf(place, id), -1, "gone from its people");
    assert.ok(hapIsDeath(m.what), "kept at their death");
    // (Told as its log told it: the same line, by what took them.)
    const line = place.log.find((x) => x.id === id && hapIsDeath(x.what));
    if (line) assert.equal(line.what, m.what);
    const page = placeInspect(w, town, placePersonRef(town, id)) as PlaceInspectDead;
    assert.equal(page.kind, "dead");
    assert.ok(
      page.death.includes(hapTold(place, { t: m.t, what: m.what, id, a: m.a, b: 0 }, named)),
    );
    assert.match(page.sub, /^Died day \d+ of year \d+, aged \d+$/);
    assert.ok(page.life.length >= 2);
    assert.ok(page.memories.length <= 6);
    // (Each of their kin and those they knew a tap away where any page is theirs: the living's or one of the dead's.)
    for (const k of [...page.kin, ...page.knew]) {
      assert.ok(k.ref, `${k.name}: a tap away`);
      assert.ok(placeInspect(w, town, k.ref!), `${k.name}'s page reads`);
    }
  }
  // Kin both ways: a dead child's living parent is on their page, and the parent's family page and Life tab lead to them;
  // a dead parent is on their living children's.
  let led = 0;
  for (const id of ids) {
    const m = placeMourned(place, id)!,
      page = placeInspect(w, town, placePersonRef(town, id)) as PlaceInspectDead;
    for (const n of [m.mother, m.father]) {
      if (!n || placeIndexOf(place, n) < 0) continue;
      assert.ok(
        page.kin.some((k) => k.ref === placePersonRef(town, n)),
        "their living parent on their page",
      );
      const family = placeInspect(w, town, placeFamilyRef(town, n)) as PlaceInspectFamily,
        child = family.children.find((c) => c.ref === placePersonRef(town, id));
      assert.ok(child, "the parent's family page leads to the child dead");
      assert.match(child!.words, /died day/);
      const parent = placeInspect(w, town, placePersonRef(town, n)) as PlaceInspectPerson;
      assert.ok(
        parent.kin.some((k) => k.ref === placePersonRef(town, id)),
        "and the parent's Life tab",
      );
      led++;
    }
  }
  for (let j = 0; j < place.people.n; j++) {
    const dead = [place.people.mother[j]!, place.people.father[j]!].find(
      (n) => n && placeMourned(place, n),
    );
    if (!dead) continue;
    const id = place.people.id[j]!,
      family = placeInspect(w, town, placeFamilyRef(town, id)) as PlaceInspectFamily,
      parent = family.parents.find((p) => p.ref === placePersonRef(town, dead));
    assert.ok(parent, "their family's page leads to the parent dead");
    assert.match(parent!.words, /died day/);
    const person = placeInspect(w, town, placePersonRef(town, id)) as PlaceInspectPerson;
    assert.ok(
      person.kin.some((k) => k.ref === placePersonRef(town, dead)),
      "their Life tab too",
    );
    led++;
  }
  t.diagnostic(`${ids.length} dead kept; ${led} led between the dead and their living kin`);
  // Kept through a save: the same pages.
  const back = copy(w),
    kept = placesOf(back)!.get(town)!;
  assert.deepEqual(kept.mourned, place.mourned);
  assert.deepEqual(
    placeInspect(back, town, placePersonRef(town, ids[0]!)),
    placeInspect(w, town, placePersonRef(town, ids[0]!)),
  );
});

test("a person's nearest kin are a tap away from their page", (t) => {
  const w0 = placeWorld(150),
    s = townWhere(w0, () => true, { near: 3000, least: 800 }) ?? noTown(t, "of eight hundred");
  if (!s) return;
  const town: string = s.ref,
    w = copy(w0),
    place = enterPlace(w, town)!,
    p = place.people;
  let told = 0;
  for (let i = 0; i < p.n && told < 20; i++) {
    if (!p.mother[i] && !p.mate[i]) continue;
    const page = placeInspect(w, town, placePersonRef(town, p.id[i]!)) as PlaceInspectPerson;
    for (const k of page.kin) {
      assert.match(k.words, /^(mother|father|paired|daughter|son)\b/);
      if (k.ref) assert.ok(placeInspect(w, town, k.ref), `${k.name}'s page reads`);
    }
    const mi = placeIndexOf(place, p.mother[i]!);
    if (mi >= 0)
      assert.ok(
        page.kin.some((k) => /^mother/.test(k.words)),
        "their mother among them",
      );
    told++;
  }
  if (!told) return void noTown(t, "whose people have kin in it");
});
