// Inside a building (town mode, O3): every lot laid on a grid of tiles a metre square, what is inside set on them from
// what the place holds; nothing over another thing, nothing past its room or its grid, none two on one tile; a bed for
// each its home's room gives, the sleepers in theirs; a bench for each who works there, as the floor takes; the place
// only read; and its ref opened as a lot's is.
import assert from "node:assert/strict";
import { test } from "node:test";
import { HOUR, loadWorld, saveWorld, type World } from "../../src/kernel/index.ts";
import {
  ACT,
  advancePlace,
  enterPlace,
  placeDigest,
  placeLot,
  type Place,
} from "../../src/host/place.ts";
import { lotGrid, placeInside } from "../../src/host/placeinside.ts";
import { placeInspect } from "../../src/host/placeinspect.ts";
import { workSheet } from "../../src/host/placeplan.ts";
import { placeInsideRef, placeLotRef, type PlaceInspectInside } from "../../src/bridge/index.ts";
import { PLACE_UNIVERSE, noTown, placeWorld, townWhere } from "./worlds.ts";

const base = (): World => placeWorld(150);
const copy = (w: World): World => {
  const doc = JSON.parse(JSON.stringify(saveWorld(w, "r", { universe: PLACE_UNIVERSE.name })));
  return loadWorld(doc, (s) => PLACE_UNIVERSE.build(s), "r").world;
};
const homeLot = (place: Place): number => {
  for (let k = 0; k < place.houses.home.length; k++)
    if (place.houses.home[k]! >= 0 && place.houses.members[k]! >= 2) return place.houses.home[k]!;
  return -1;
};

/** Every rule of a plan: in its grid, in a room, over nothing else, none two on a tile. */
function sound(x: PlaceInspectInside): void {
  const taken = new Uint8Array(x.w * x.d);
  for (const r of x.rooms) {
    assert.ok(
      r.x >= 0 && r.y >= 0 && r.x + r.w <= x.w && r.y + r.d <= x.d,
      `room ${r.name} in its grid`,
    );
  }
  for (const t of x.things) {
    assert.ok(
      x.rooms.some(
        (r) => t.x >= r.x && t.y >= r.y && t.x + t.w <= r.x + r.w && t.y + t.d <= r.y + r.d,
      ),
      `${t.name} within a room's walls`,
    );
    for (let j = t.y; j < t.y + t.d; j++)
      for (let i = t.x; i < t.x + t.w; i++) {
        assert.equal(taken[j * x.w + i], 0, `${t.name} over nothing else`);
        taken[j * x.w + i] = 1;
      }
  }
  const stood = new Set<number>();
  for (const q of x.people) {
    assert.ok(q.x >= 0 && q.y >= 0 && q.x < x.w && q.y < x.d, `${q.name} in its grid`);
    assert.ok(!stood.has(q.y * x.w + q.x), `${q.name} alone on their tile`);
    stood.add(q.y * x.w + q.x);
    const on = x.things.find((t) => q.x >= t.x && q.x < t.x + t.w && q.y >= t.y && q.y < t.y + t.d);
    assert.ok(
      !on || on.kind === "bed" || on.kind === "bench",
      `${q.name} stands on no ${on?.kind}`,
    );
  }
}

test("inside a home and a building: laid on their tiles, nothing over another, the place only read", (t) => {
  const w0 = base(),
    s =
      townWhere(
        w0,
        (place, w) =>
          homeLot(place) >= 0 && workSheet(w, place).buildings.some((b) => b.working > 0),
        { near: 600, least: 100 },
      ) ?? noTown(t, "with a household home and a building worked in");
  if (!s) return;
  const w = copy(w0),
    place = enterPlace(w, s.ref)!,
    p = place.people;
  // (Into the night, that some are abed at home.)
  for (let h = 0; h < 30; h++) {
    w.runTo(w.now + HOUR);
    advancePlace(w, place);
  }
  const home = homeLot(place),
    b = [...workSheet(w, place).buildings].sort((x, y) => y.working - x.working)[0]!;
  for (let hours = 0; hours < 24; hours++) {
    const x = placeInside(w, place, home)!;
    assert.equal(x.kind, "inside");
    assert.deepEqual([x.w, x.d], [lotGrid().w, lotGrid().d], "a home's floor is its lot's grid");
    sound(x);
    const beds = x.things.filter((q) => q.kind === "bed").length,
      living = placeLot(place, home).living.length;
    assert.ok(beds > 0 && beds <= living, `a bed each at most (${beds} for ${living})`);
    assert.ok(
      x.things.some((q) => q.kind === "hearth") && x.things.some((q) => q.kind === "pantry"),
    );
    // (Those asleep here whose bed is drawn lie in it.)
    for (const q of x.people) {
      const i = p.id.indexOf(q.id);
      const bed = x.things.find((t) => t.kind === "bed" && t.name === `${q.name}'s bed`);
      if (i >= 0 && p.act[i] === ACT.sleep && bed)
        assert.ok(q.x === bed.x && q.y === bed.y, `${q.name} asleep in their bed`);
    }
    const y = placeInside(w, place, b.lot)!;
    sound(y);
    const benches = y.things.filter((q) => q.kind === "bench").length;
    assert.ok(
      benches > 0 && benches <= b.working,
      `a bench each who works there, at most (${benches} of ${b.working})`,
    );
    w.runTo(w.now + HOUR);
    advancePlace(w, place);
  }
  // Read and read again, the place is as it was: nothing of it is kept.
  const w2 = copy(w0),
    p2 = enterPlace(w2, s.ref)!;
  for (let h = 0; h < 30 + 24; h++) {
    w2.runTo(w2.now + HOUR);
    advancePlace(w2, p2);
  }
  assert.equal(placeDigest(p2), placeDigest(place), "a twin never looked inside is the same");
  // Its ref opens as a lot's does.
  const opened = placeInspect(w, s.ref, placeInsideRef(s.ref, home));
  assert.equal(opened?.kind, "inside");
  assert.equal((opened as PlaceInspectInside).lotRef, placeLotRef(s.ref, home));
  assert.equal(placeInside(w, place, -1), null, "the square has no inside");
});
