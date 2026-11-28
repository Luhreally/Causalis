// The bound of a town (town mode, P6): those of it held in bondage are its land's share in each kind (sim/order), by a keyed
// draw on their numbers; each weighs on their mood by its kind and is told on their page, with your word to free them; freed
// (place.free), they are no longer bound and their mood is lighter; its bound page counts them by kind, names them, and
// counts those freed and those its justice holds. Only town mode: the world's own count of its bound is as it was.
import assert from "node:assert/strict";
import { test } from "node:test";
import { HOUR, loadWorld, saveWorld, type World } from "../../src/kernel/index.ts";
import { BONDS, orderOf } from "../../src/sim/index.ts";
import { advancePlace, enterPlace, placeBondOf, placeBonds } from "../../src/host/place.ts";
import { placeInspect } from "../../src/host/placeinspect.ts";
import {
  placeBoundRef,
  placePersonRef,
  type PlaceInspectBound,
  type PlaceInspectPerson,
} from "../../src/bridge/index.ts";
import { PLACE_UNIVERSE, noTown, placeWorld, townWhere } from "./worlds.ts";

const copy = (w: World): World =>
  loadWorld(
    JSON.parse(JSON.stringify(saveWorld(w, "r", { universe: PLACE_UNIVERSE.name }))),
    (s) => PLACE_UNIVERSE.build(s),
    "r",
  ).world;
const order = (w: World, type: string, args: unknown): void => {
  const c = w.submit(type, args);
  w.runTo(c.t);
};

test("the bound of a town by its land's bondage; each told and weighed on; freed by your word", (t) => {
  const w0 = placeWorld(150),
    s =
      townWhere(
        w0,
        (place, w) => {
          const b = placeBonds(w, place);
          for (let i = 0; i < place.people.n; i++)
            if (placeBondOf(place, place.people.id[i]!, b) >= 0) return true;
          return false;
        },
        { near: 600, least: 60 },
      ) ?? noTown(t, "with any of its people held in bondage");
  if (!s) return;
  const town: string = s.ref,
    w = copy(w0),
    place = enterPlace(w, town)!,
    p = place.people;
  for (let h = 0; h < 24; h++) {
    w.runTo(w.now + HOUR);
    advancePlace(w, place);
  }
  const shares = orderOf(w)!.lands.get(place.cell)!.shares,
    b = placeBonds(w, place);
  assert.deepEqual([...b.shares], [...shares]);
  const bound: number[] = [];
  for (let i = 0; i < p.n; i++) if (placeBondOf(place, p.id[i]!, b) >= 0) bound.push(p.id[i]!);
  const total = shares.reduce((a, x) => a + x, 0);
  assert.ok(
    bound.length > 0 && bound.length < 3 * total * p.n + 4,
    `${bound.length} of ${p.n} at ${total}`,
  );
  // Each told on their page, their mood the worse for it, your word to free them.
  const id = bound[0]!,
    page = () => placeInspect(w, town, placePersonRef(town, id)) as PlaceInspectPerson,
    was = page(),
    weight = (x: PlaceInspectPerson) => x.thoughts.find((q) => q.words === "Held in bondage");
  assert.match(was.bond ?? "", new RegExp(`as [0-9.]+% of their land's people are`));
  assert.ok(was.freeable);
  assert.ok((weight(was)?.size ?? 0) < 0, "their mood the worse for it");
  // Its bound page: by kind, each named a key.
  const bp = placeInspect(w, town, placeBoundRef(town)) as PlaceInspectBound;
  assert.equal(bp.kind, "bound");
  assert.equal(
    bp.kinds.reduce((a, k) => a + k.here, 0),
    bound.length,
  );
  assert.ok(bp.people.some((r) => r.ref === placePersonRef(town, id)));
  for (const k of bp.kinds) assert.ok(BONDS.some((n) => n.toLowerCase() === k.name.toLowerCase()));
  // Freed by your word: bound no more, their mood lighter, told so; the world's count of its land's bound as it was.
  assert.throws(() => w.submit("place.free", { town, person: 0 }));
  order(w, "place.free", { town, person: id });
  for (let h = 0; h < 2; h++) {
    w.runTo(w.now + HOUR);
    advancePlace(w, place);
  }
  const now = page();
  assert.equal(placeBondOf(place, id, placeBonds(w, place)), -1);
  assert.match(now.bond ?? "", /^Freed by your word/);
  assert.equal(now.freeable, false);
  assert.equal(weight(now), undefined, "no longer weighed on by it");
  assert.equal((placeInspect(w, town, placeBoundRef(town)) as PlaceInspectBound).freed, 1);
  assert.deepEqual([...orderOf(w)!.lands.get(place.cell)!.shares], [...shares]);
});
