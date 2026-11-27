// A thing one holds on its own page (town mode, O5: "an artifact page: creator, owner, material, what it was made for";
// town items had none): read off what they hold (placeGear) against what the town's middling hands make; each reached from
// its holder's Gear tab, from the room it is kept in and the bench it lies on; its holder and its maker a tap away; and the
// place only read.
import assert from "node:assert/strict";
import { test } from "node:test";
import { HOUR, loadWorld, saveWorld, type World } from "../../src/kernel/index.ts";
import {
  GEAR,
  advancePlace,
  enterPlace,
  placeDigest,
  placeGear,
  placeIndexOf,
  placeLot,
  type Place,
} from "../../src/host/place.ts";
import { placeInside } from "../../src/host/placeinside.ts";
import { inspectPerson, placeInspect } from "../../src/host/placeinspect.ts";
import { workSheet } from "../../src/host/placeplan.ts";
import { placeItemRef, type PlaceInspectItem } from "../../src/bridge/index.ts";
import { PLACE_UNIVERSE, noTown, placeWorld, townWhere } from "./worlds.ts";

const base = (): World => placeWorld(150);
const copy = (w: World): World =>
  loadWorld(
    JSON.parse(JSON.stringify(saveWorld(w, "r", { universe: PLACE_UNIVERSE.name }))),
    (s) => PLACE_UNIVERSE.build(s),
    "r",
  ).world;
/** A home with a cook and one at home with tools of their trade, now (-1: none). */
const homeWithThings = (w: World, place: Place): number => {
  const p = place.people;
  for (let k = 0; k < place.houses.home.length; k++) {
    const lot = place.houses.home[k]!;
    if (lot < 0) continue;
    let tool = false;
    for (let i = 0; i < p.n && !tool; i++)
      tool =
        place.houses.home[p.house[i]!] === lot &&
        p.at[i] === lot &&
        placeGear(w, place, i).some((x) => x.k === GEAR.tool);
    if (tool) return lot;
  }
  return -1;
};
const sound = (x: PlaceInspectItem): void => {
  assert.ok(x.q >= 5 && x.q <= 99 && x.mid >= 5 && x.mid <= 99, `${x.q} against ${x.mid}`);
  assert.ok(
    x.wear >= 0 && x.wear <= 1000 && x.daysLeft >= 0,
    `${x.wear} worn, ${x.daysLeft} days left`,
  );
  assert.ok(x.name && x.stuff && x.grade && x.use && x.where && x.made, JSON.stringify(x));
  assert.ok(!/undefined|NaN/.test(JSON.stringify(x)), JSON.stringify(x));
};

test("each thing on its own page, from its holder's Gear tab, its room and its bench; holder and maker a tap away; the place only read", (t) => {
  const w0 = base(),
    s =
      townWhere(
        w0,
        (place, w) =>
          homeWithThings(w, place) >= 0 && workSheet(w, place).buildings.some((b) => b.working > 0),
        { near: 600, least: 100 },
      ) ?? noTown(t, "with tools kept at home and a building worked in");
  if (!s) return;
  const town: string = s.ref;
  const w = copy(w0),
    twin = copy(w0),
    place = enterPlace(w, s.ref)!,
    other = enterPlace(twin, s.ref)!,
    p = place.people;
  for (let h = 0; h < 10; h++) {
    w.runTo(w.now + HOUR);
    advancePlace(w, place);
    twin.runTo(twin.now + HOUR);
    advancePlace(twin, other);
  }
  // From the Gear tab: every thing a row with its page; every page sound, its holder them.
  let pages = 0,
    made = 0;
  for (let i = 0; i < p.n && pages < 60; i += 7) {
    const id = p.id[i]!,
      seen = inspectPerson(w, place, id)!;
    for (const [, , ref] of seen.gear) {
      if (!ref) continue;
      const x = placeInspect(w, town, ref) as PlaceInspectItem;
      assert.equal(x?.kind, "item", ref);
      sound(x);
      assert.equal(x.ref, ref);
      const holder = placeInspect(w, town, x.holder.ref)!;
      assert.equal(holder.kind === "person" && holder.id, id, "its holder a tap away");
      if (x.maker?.ref) {
        const m = placeInspect(w, town, x.maker.ref)!;
        assert.equal(m.kind, "person", "its maker a tap away");
        made++;
      }
      pages++;
    }
    assert.equal(
      seen.gear.filter(([, , r]) => r).length,
      placeGear(w, place, i).length,
      "a row with its page for each thing they hold",
    );
  }
  assert.ok(pages > 10, `${pages} pages`);
  // From the room it is kept in: the cook's pot by the hearth, the tools of those at home in the chest.
  const home = homeWithThings(w, place),
    inside = placeInside(w, place, home)!;
  assert.ok(inside.items.length > 0, "their things kept here");
  assert.ok(
    inside.things.some((q) => q.kind === "chest"),
    "a chest for the tools of those at home",
  );
  for (const q of inside.items) sound(placeInspect(w, town, q.ref) as PlaceInspectItem);
  for (const q of inside.things.filter((q) => q.ref))
    assert.equal(placeInspect(w, town, q.ref!)?.kind, "item", q.name);
  // From the bench it lies on: a maker's, a farmer's, a herder's tools there.
  const b = [...workSheet(w, place).buildings].sort((x, y) => y.working - x.working)[0]!,
    benches = placeInside(w, place, b.lot)!.things.filter((q) => q.kind === "bench");
  for (const q of benches.filter((q) => q.ref)) {
    const x = placeInspect(w, town, q.ref!) as PlaceInspectItem;
    assert.equal(x?.kind, "item", q.ref!);
    assert.match(x.name, /tools|hoe|crook/);
  }
  // (A thing none holds: no page.)
  assert.equal(placeInspect(w, town, placeItemRef(place.town, p.id[0]!, 9)), null);
  assert.equal(placeLot(place, home).households.length > 0, true);
  assert.equal(placeIndexOf(place, p.id[0]!), 0);
  // (Only read: as its twin, which no one looked at.)
  assert.equal(placeDigest(place), placeDigest(other), "the place only read");
});
