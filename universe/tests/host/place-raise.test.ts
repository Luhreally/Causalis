// A building raised where you choose (town mode, P1): a lot's page offers what its town could be asked to raise on the
// lots it is of, each in step with its size, with the homes it would clear; asked so (town.ask `at`), the town's own plan
// takes it on those very lots, as the god game raises what it is asked; lots out of step, of two blocks, past the town as
// laid or under another building are refused. Unasked, a town sites its own as before.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  HOUR,
  loadWorld,
  saveWorld,
  yearOfMoment,
  type Ref,
  type World,
} from "../../src/kernel/index.ts";
import { CIVIC_LOTS, sitedProblem, townsOf } from "../../src/sim/index.ts";
import { advancePlace, enterPlace } from "../../src/host/place.ts";
import { placeInspect } from "../../src/host/placeinspect.ts";
import { placeLotRef, type PlaceInspectLot } from "../../src/bridge/index.ts";
import { PLACE_UNIVERSE, noTown, placeWorld, townWhere } from "./worlds.ts";

const copy = (w: World): World =>
  loadWorld(
    JSON.parse(JSON.stringify(saveWorld(w, "r", { universe: PLACE_UNIVERSE.name }))),
    (s) => PLACE_UNIVERSE.build(s),
    "r",
  ).world;

test("a building raised on the lots a lot's page offers: taken there by the town's plan; bad lots refused", (t) => {
  const w0 = placeWorld(150);
  let found: { lot: number; offer: PlaceInspectLot["raiseHere"][number] } | null = null;
  const s =
    townWhere(
      w0,
      (place, w) => {
        for (let k = 0; k < Math.min(place.houses.n, 60) && !found; k += 3) {
          const lot = place.houses.home[k]!;
          if (lot < 0) continue;
          const x = placeInspect(w, place.town, placeLotRef(place.town, lot)) as PlaceInspectLot;
          const offer = x?.raiseHere?.[0];
          if (offer) found = { lot, offer };
        }
        return !!found;
      },
      { near: 600, least: 100 },
    ) ?? noTown(t, "with something it could raise among its homes");
  if (!s || !found) return;
  const { lot, offer } = found as { lot: number; offer: PlaceInspectLot["raiseHere"][number] },
    town: string = s.ref,
    w = copy(w0),
    place = enterPlace(w, town)!,
    f = () => townsOf(w).get(town as Ref)!,
    year = () => yearOfMoment(w.now),
    lots = (CIVIC_LOTS as Readonly<Record<string, number>>)[offer.what]!;
  assert.equal(offer.lots, lots);
  assert.ok(offer.at <= lot && lot < offer.at + lots, "on the lots this one is of");
  assert.equal(sitedProblem(f(), offer.what, offer.at, year()), null);
  // Refused: out of step with its size, past the town as laid, not a lot at all.
  if (lots > 1)
    assert.throws(() =>
      w.submit("town.ask", { village: town, kind: "raise", what: offer.what, at: offer.at + 1 }),
    );
  assert.throws(() =>
    w.submit("town.ask", {
      village: town,
      kind: "raise",
      what: offer.what,
      at: f().next + lots * 8,
    }),
  );
  assert.throws(() =>
    w.submit("town.ask", { village: town, kind: "raise", what: offer.what, at: -1 }),
  );
  // Asked there: its plan takes it on those very lots.
  const was = f().civics.filter(() => true).length,
    c = w.submit("town.ask", { village: town, kind: "raise", what: offer.what, at: offer.at });
  w.runTo(c.t);
  const now = f().civics.filter(() => true);
  assert.equal(now.length, was + 1, "one building more");
  assert.ok(
    now.some((x) => x.kind === offer.what && x.at === offer.at && x.lots === lots),
    `${offer.what} rising on lots ${offer.at}…${offer.at + lots - 1}`,
  );
  // (And those lots are taken: a second there is refused, and the lot's page offers nothing on them now.)
  assert.equal(sitedProblem(f(), offer.what, offer.at, year()), "another building stands there");
  assert.throws(() =>
    w.submit("town.ask", { village: town, kind: "raise", what: offer.what, at: offer.at }),
  );
  w.runTo(w.now + HOUR);
  advancePlace(w, place);
  const after = placeInspect(w, town, placeLotRef(town, lot)) as PlaceInspectLot;
  assert.ok(
    after.raiseHere.every((r) => r.at !== offer.at),
    "nothing more offered on lots taken",
  );
});
