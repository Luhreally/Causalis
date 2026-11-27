// Zones (town mode, O2): a lot of a town entered zoned by order as a meeting place, where those of the homes nearer it
// than the square go for company and their games; or kept clear, gone to by no one but to a fire, its work waiting and
// its household sheltering at the nearest meeting place, else the square. A store is never kept clear. A zone is an
// order like any: checked, kept in its town's orders, saved and read back; a town zoned nowhere keeps no zones.
import assert from "node:assert/strict";
import { test } from "node:test";
import { HOUR, loadWorld, saveWorld, type World } from "../../src/kernel/index.ts";
import { managedOf, type Settlement } from "../../src/sim/index.ts";
import {
  ACT,
  AT,
  WHY,
  advancePlace,
  enterPlace,
  placeMeetFor,
  placeStores,
  placeZone,
  streetLength,
  type Place,
} from "../../src/host/place.ts";
import { whyWords, workSheet } from "../../src/host/placeplan.ts";
import { inspectLot } from "../../src/host/placeinspect.ts";
import { placeOverlay } from "../../src/host/placeoverlay.ts";
import { PLACE_UNIVERSE, noTown, placeWorld, townWhere } from "./worlds.ts";

const base = (): World => placeWorld(150);
const copy = (w: World): World => {
  const doc = JSON.parse(JSON.stringify(saveWorld(w, "r", { universe: PLACE_UNIVERSE.name })));
  return loadWorld(doc, (s) => PLACE_UNIVERSE.build(s), "r").world;
};
const order = (w: World, type: string, args: unknown): void => {
  const c = w.submit(type, args);
  w.runTo(c.t);
};
const hours = (w: World, place: Place, n: number, each?: () => void): void => {
  for (let h = 0; h < n; h++) {
    w.runTo(w.now + HOUR);
    advancePlace(w, place);
    each?.();
  }
};
/** The lots of a place's homes that a household lives in. */
const homesOf = (place: Place): number[] => {
  const out = new Set<number>();
  for (let k = 0; k < place.houses.home.length; k++)
    if (place.houses.home[k]! >= 0 && place.houses.members[k]) out.add(place.houses.home[k]!);
  return [...out];
};
/**
 * A home well out from its square, and another home by it: nearer it by the streets than half the way to the square
 * (null: none such among its first homes).
 */
function farPair(place: Place): { home: number; by: number } | null {
  const homes = homesOf(place).slice(0, 400);
  for (const home of homes) {
    const out = streetLength(place, home, AT.square);
    if (out < 120) continue;
    for (const by of homes)
      if (by !== home && streetLength(place, home, by) < out / 3) return { home, by };
  }
  return null;
}

test("a zone is an order: checked, kept in its town's orders, saved and read back", (t) => {
  const w = copy(base()),
    s: Settlement | null =
      townWhere(w, (place) => homesOf(place).length > 2) ?? noTown(t, "with homes");
  if (!s) return;
  const town = s.ref,
    place = enterPlace(w, town)!,
    [a, b] = homesOf(place) as [number, number];
  assert.throws(() => w.submit("place.zone", { town, lot: -1, zone: "meet" }));
  assert.throws(() => w.submit("place.zone", { town, lot: a, zone: "park" }));
  assert.throws(() => w.submit("place.zone", { lot: a, zone: "meet" }));
  order(w, "place.zone", { town, lot: a, zone: "meet" });
  order(w, "place.zone", { town, lot: b, zone: "clear" });
  order(w, "place.zone", { town, lot: a, zone: "clear" });
  assert.deepEqual(managedOf(w)!.get(town)!.zones, [b, 1, a, 1], "one zone a lot, the last given");
  const back = copy(w);
  assert.deepEqual(managedOf(back)!.get(town)!.zones, [b, 1, a, 1], "saved and read back");
  assert.equal(JSON.stringify(back.domainHashes()), JSON.stringify(w.domainHashes()));
  order(w, "place.zone", { town, lot: a, zone: null });
  order(w, "place.zone", { town, lot: b, zone: null });
  assert.equal(managedOf(w)!.get(town)!.zones, undefined, "zoned nowhere, it keeps no zones");
  assert.equal(placeZone(w, place, a).zone, -1);
});

test("a meeting place gathers those of the homes nearer it than the square for company and games", (t) => {
  const w0 = base(),
    s =
      townWhere(w0, (place) => farPair(place) !== null, { near: 1500, least: 300 }) ??
      noTown(t, "with homes far from its square");
  if (!s) return;
  const w = copy(w0),
    place = enterPlace(w, s.ref)!,
    p = place.people,
    { home, by } = farPair(place)!;
  hours(w, place, 1);
  order(w, "place.zone", { town: s.ref, lot: by, zone: "meet" });
  assert.equal(
    placeMeetFor(w, place, home),
    by,
    "the far home's company is had at the meeting place by it",
  );
  const gathered = new Set(homesOf(place).filter((h) => placeMeetFor(w, place, h) === by));
  let there = 0,
    square = 0;
  hours(w, place, 72, () => {
    for (let i = 0; i < p.n; i++) {
      if (p.act[i] !== ACT.visit || p.eta[i] || !gathered.has(place.houses.home[p.house[i]!]!))
        continue;
      if (p.at[i] === by) there++;
      else if (p.at[i] === AT.square) square++;
    }
  });
  assert.ok(there > 0, "those near it meet there");
  assert.equal(square, 0, "and none of them goes on to the square for it");
  const lot = inspectLot(w, place, by);
  assert.equal(lot.zone, "meet");
  assert.match(lot.zoneWords, new RegExp(`those of ${gathered.size} home`));
  assert.ok(lot.ground.length > 0, "its page says what its ground is");
  assert.ok(placeOverlay(w, place, "zones").lots.some((x) => x.lot === by && x.v === 0));
  order(w, "place.zone", { town: s.ref, lot: by, zone: null });
  assert.equal(placeMeetFor(w, place, home), AT.square, "unzoned, the square again");
});

test("a lot kept clear is gone to by no one: its work waits, its household shelters; a store is never kept clear", (t) => {
  const w0 = base(),
    s =
      townWhere(
        w0,
        (place, w) =>
          homesOf(place).length > 2 &&
          placeStores(place).market >= 0 &&
          workSheet(w, place).buildings.some(
            (b) => b.working > 0 && b.lot !== placeStores(place).market,
          ),
        { near: 1500, least: 300 },
      ) ?? noTown(t, "with a market and a building worked in");
  if (!s) return;
  const w = copy(w0),
    place = enterPlace(w, s.ref)!,
    p = place.people,
    st = placeStores(place),
    b = workSheet(w, place)
      .buildings.filter((x) => x.lot !== st.market && x.lot !== st.granary)
      .sort((x, y) => y.working - x.working)[0]!,
    home = homesOf(place).find((h) => h !== b.lot)!;
  order(w, "place.zone", { town: s.ref, lot: b.lot, zone: "clear" });
  order(w, "place.zone", { town: s.ref, lot: home, zone: "clear" });
  order(w, "place.zone", { town: s.ref, lot: st.market, zone: "clear" });
  assert.equal(placeZone(w, place, st.market).holds, false, "a store is never kept clear");
  assert.equal(inspectLot(w, place, st.market).clearable, false);
  let said = "";
  hours(w, place, 30, () => {
    for (let i = 0; i < p.n; i++) {
      if (p.work[i] === b.lot) assert.notEqual(p.act[i], ACT.work, "no one works there");
      if (p.why[i] === WHY.clear && !said) said = whyWords(w, place, i);
    }
  });
  assert.match(said, /kept clear by your order/, "its hands wait, by the order");
  const athome = [];
  for (let i = 0; i < p.n; i++)
    if (p.at[i] === home && !p.eta[i] && p.act[i] !== ACT.brigade) athome.push(i);
  assert.deepEqual(athome, [], "none stays on the lot kept clear");
  assert.match(inspectLot(w, place, home).zoneWords, /^Kept clear/);
});
