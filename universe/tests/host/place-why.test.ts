// Why one of a town's people does what they do (town mode, R7): a "Why?" beside each figure. What they do and the reason
// the place gave it are their page's own; what lies behind that reason is read off the town (a hungry one's pantry and
// its stores, one at work's workplace); each step's page is one the inspector opens, each Go to a person of the town or a
// lot. The log's rows go to whom they were of and where they happened. Read only.
import assert from "node:assert/strict";
import { test } from "node:test";
import { HOUR } from "../../src/kernel/index.ts";
import { WHY, advancePlace, enterPlace, placeDigest, placeIndexOf } from "../../src/host/place.ts";
import { placeInspect } from "../../src/host/placeinspect.ts";
import { logSheet } from "../../src/host/placeplan.ts";
import {
  placePersonRef,
  placeWhyRef,
  type PlaceInspectPerson,
  type PlaceInspectWhy,
} from "../../src/bridge/index.ts";
import { noTown, placeWorld, townWhere } from "./worlds.ts";

test("why one does what they do: their doing and its reason, what lies behind it, each step a page or a place", (t) => {
  const w = placeWorld(150),
    s = townWhere(w, () => true, { near: 600, least: 100 }) ?? noTown(t, "of a hundred");
  if (!s) return;
  const town: string = s.ref,
    place = enterPlace(w, town)!;
  // (A day on, to the middle of a working morning: at night all are abed or idle in the dark.)
  const hour = () => (((place.t % 86_400) + 86_400) % 86_400) / 3600;
  for (let h = 0; h < 72 || hour() < 10 || hour() > 13; h++) {
    w.runTo(w.now + HOUR);
    advancePlace(w, place);
  }
  const before = placeDigest(place),
    seen = new Map<number, number>();
  let read = 0,
    fed = 0,
    worked = 0;
  for (let i = 0; i < place.people.n && read < 60; i += 3, read++) {
    const id = place.people.id[i]!,
      x = placeInspect(w, town, placePersonRef(town, id)) as PlaceInspectPerson;
    assert.equal(x.whyRef, placeWhyRef(town, id));
    const y = placeInspect(w, town, x.whyRef) as PlaceInspectWhy;
    assert.equal(y.kind, "why");
    assert.equal(y.personRef, x.ref);
    // (Their doing and its reason, as their page has them; the Go to of their doing is to them.)
    assert.equal(y.steps[0]!.words, x.now);
    assert.deepEqual(y.steps[0]!.go, { id, lot: null });
    assert.equal(y.steps[1]!.words, x.why);
    assert.ok(y.steps.some((z) => z.label === "Their mood"));
    const why = place.people.why[i]!;
    seen.set(why, (seen.get(why) ?? 0) + 1);
    if (why === WHY.hunger || why === WHY.pantry || why === WHY.noFood) {
      assert.ok(y.steps.some((z) => z.label === "Their pantry" && z.go?.lot === x.home.lot));
      assert.ok(y.steps.some((z) => z.label === "The town's stores" && z.ref?.startsWith("plcs:")));
      fed++;
    }
    if (why === WHY.work && x.work) {
      assert.ok(y.steps.some((z) => z.label === "Their work" && z.go?.lot === x.work!.lot));
      worked++;
    }
    for (const z of y.steps) {
      // (A page of the town's opens in its inspector; another (a war, a sickness) is the god game's.)
      if (z.ref?.startsWith("plc"))
        assert.ok(placeInspect(w, town, z.ref), `${z.label}: ${z.ref} opens`);
      if (z.go?.id != null) assert.ok(placeIndexOf(place, z.go.id) >= 0, "goes to one of the town");
      if (z.go) assert.ok(z.go.id !== null || z.go.lot !== null);
    }
  }
  t.diagnostic(
    `${read} read; whys ${[...seen].map(([k, n]) => `${k}:${n}`).join(" ")}; ${fed} hungry, ${worked} at work`,
  );
  assert.ok(worked > 0, "some at work, their workplace behind it");
  assert.equal(placeDigest(place), before, "read only");
  // (The log's rows: to whom they were of, living in the town, and where.)
  const log = logSheet(w, place);
  let gone = 0;
  for (const r of log.rows)
    for (const g of r.go) {
      assert.ok((g.id === null) !== (g.lot === null), "a person or a lot");
      if (g.id !== null) assert.ok(placeIndexOf(place, g.id) >= 0);
      assert.match(g.words, /^Go to /);
      gone++;
    }
  t.diagnostic(`${log.rows.length} log rows, ${gone} Go to`);
  // (A row of one living in the town goes to them.)
  for (const r of log.rows) {
    const id = r.ref?.startsWith(`plc:${town}:`)
      ? Number(r.ref.slice(r.ref.lastIndexOf(":") + 1))
      : -1;
    if (id > 0 && placeIndexOf(place, id) >= 0)
      assert.ok(
        r.go.some((g) => g.id === id),
        r.words,
      );
  }
  assert.equal(placeDigest(place), before, "read only");
});
