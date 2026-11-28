// A town's works and orders (town mode, R6): what is going up and how far each has got, as its sites read; what its land
// may find next (its lore's own reading) and what it came to know last; and its standing orders, each said. Read only.
import assert from "node:assert/strict";
import { test } from "node:test";
import { findableAt, loreOf, populationContext } from "../../src/sim/index.ts";
import { HOUR } from "../../src/kernel/index.ts";
import { advancePlace, enterPlace, placeDigest, placeSites } from "../../src/host/place.ts";
import { placeInspect } from "../../src/host/placeinspect.ts";
import {
  placeCivicRef,
  placeLotRef,
  type PlaceInspectCivic,
  type PlaceInspectLot,
} from "../../src/bridge/index.ts";
import { noTown, placeWorld, townWhere } from "./worlds.ts";

test("a town's works and orders: its sites, what its land may find next, what it knows, its standing orders", (t) => {
  const w = placeWorld(150),
    s = townWhere(w, () => true, { near: 3000, least: 500 }) ?? noTown(t, "of five hundred");
  if (!s) return;
  const town: string = s.ref,
    place = enterPlace(w, town)!,
    before = placeDigest(place),
    c = placeInspect(w, town, placeCivicRef(town)) as PlaceInspectCivic;
  assert.equal(c.kind, "civic");
  // (Its sites as the place reads them, each how far it has got.)
  const sites = placeSites(w, place);
  assert.equal(c.sites.length, sites.length);
  c.sites.forEach((x, k) => assert.equal(x.share, Math.round(sites[k]!.share * 100)));
  // (What its land may find next and what it knows, as its lore has them.)
  const findable = findableAt(populationContext(w), place.cell);
  assert.equal(c.findable.length, Math.min(8, findable.length));
  c.findable.forEach((f, k) => assert.equal(f.name.toLowerCase(), findable[k]!.name.toLowerCase()));
  assert.equal(c.known.length, Math.min(6, loreOf(w).of(place.cell).length));
  assert.ok(c.learned.length > 10);
  t.diagnostic(
    `${c.sites.length} going up; may find ${c.findable.map((f) => f.name).join(", ") || "nothing"}; ${c.orders.length} orders`,
  );
  assert.equal(placeDigest(place), before, "read only");
  if (c.managed) return;
  // (An order given, and it is said: its gate shut.)
  w.runTo(w.submit("place.gate", { town, shut: true }).t);
  const after = placeInspect(w, town, placeCivicRef(town)) as PlaceInspectCivic;
  assert.ok(after.managed);
  assert.deepEqual(
    after.orders.find(([k]) => k === "Gate"),
    ["Gate", "Shut to newcomers"],
  );
});

test("a building asked for is told as going up, with how far it has got and its crew", (t) => {
  const w = placeWorld(150);
  let offer: PlaceInspectLot["raiseHere"][number] | null = null;
  const s =
    townWhere(
      w,
      (place, w1) => {
        for (let k = 0; k < Math.min(place.houses.n, 60) && !offer; k += 3) {
          const lot = place.houses.home[k]!;
          if (lot < 0) continue;
          offer =
            (placeInspect(w1, place.town, placeLotRef(place.town, lot)) as PlaceInspectLot)
              ?.raiseHere?.[0] ?? null;
        }
        return !!offer;
      },
      { near: 600, least: 100 },
    ) ?? noTown(t, "with something it could raise among its homes");
  if (!s || !offer) return;
  const town: string = s.ref,
    place = enterPlace(w, town)!,
    asked = offer as PlaceInspectLot["raiseHere"][number];
  w.runTo(w.submit("town.ask", { village: town, kind: "raise", what: asked.what, at: asked.at }).t);
  for (let h = 0; h < 48; h++) {
    w.runTo(w.now + HOUR);
    advancePlace(w, place);
  }
  const c = placeInspect(w, town, placeCivicRef(town)) as PlaceInspectCivic,
    sites = placeSites(w, place);
  assert.ok(sites.length >= 1, "the building asked for is a site");
  assert.equal(c.sites.length, sites.length);
  for (const x of c.sites) {
    assert.ok(x.share >= 0 && x.share <= 100);
    assert.match(x.ref, /^plcl:/);
  }
  t.diagnostic(c.sites.map((x) => `${x.name} ${x.share}%: ${x.words}`).join("; "));
});
