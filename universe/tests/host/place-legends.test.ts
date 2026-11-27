// A town's works on their own pages and its legends (town mode, O9): each work kept (placeWorks) opens from its lot's
// page to its own, its maker and whom it shows a tap away while they are of the town, the homes it is the finest in sight
// of counted off their day's needs; its legends tell the seldomest of what its log keeps, the oldest first, its works the
// finest first, the battles its men were in; and the place only read.
import assert from "node:assert/strict";
import { test } from "node:test";
import { HOUR, loadWorld, saveWorld, type World } from "../../src/kernel/index.ts";
import {
  advancePlace,
  enterPlace,
  placeDigest,
  placeNeedsDay,
  placeWorks,
} from "../../src/host/place.ts";
import { placeInspect } from "../../src/host/placeinspect.ts";
import {
  placeLegendsRef,
  placeLotRef,
  type PlaceInspectLegends,
  type PlaceInspectLot,
  type PlaceInspectWork,
} from "../../src/bridge/index.ts";
import { PLACE_UNIVERSE, placeWorld, townWhere } from "./worlds.ts";

const copy = (w: World): World =>
  loadWorld(
    JSON.parse(JSON.stringify(saveWorld(w, "r", { universe: PLACE_UNIVERSE.name }))),
    (s) => PLACE_UNIVERSE.build(s),
    "r",
  ).world;

test("a town's works each on its page, from its lot's; its legends the seldomest of its log, its works and its battles; only read", () => {
  const w0 = placeWorld(150),
    s = townWhere(w0, () => true, { near: 600, least: 300 })!,
    town: string = s.ref,
    w = copy(w0),
    twin = copy(w0),
    place = enterPlace(w, town)!,
    other = enterPlace(twin, town)!;
  // (Two months, that works are made and the log fills.)
  for (let h = 0; h < 60 * 24; h++) {
    w.runTo(w.now + HOUR);
    advancePlace(w, place);
    twin.runTo(twin.now + HOUR);
    advancePlace(twin, other);
  }
  // (Where none was made in the two months, one kept as a maker's making leaves it, at its first building, of the last
  // happening its log tells; and in its twin alike, that the two stay one.)
  for (const p of [place, other])
    if (!(p.works ?? []).length) {
      const x = p.log.at(-1)!,
        lot = p.bldgs.lot[1] ?? p.houses.home[0]!,
        day = Math.floor(p.t / 86_400);
      p.works = [lot, day, p.people.id[0]!, x.what, x.id, Math.floor(x.t / 86_400), 3];
    }
  const legends = placeInspect(w, town, placeLegendsRef(town)) as PlaceInspectLegends;
  assert.equal(legends?.kind, "legends");
  assert.ok(!/undefined|NaN/.test(JSON.stringify(legends)), JSON.stringify(legends).slice(0, 400));
  assert.ok(
    legends.lines.length > 0 && legends.lines.length <= 10,
    "the seldomest of its log told",
  );
  // (Each told line's one a tap away while of the town: their page opens.)
  for (const l of legends.lines.filter((q) => q.ref))
    assert.equal(placeInspect(w, town, l.ref!)?.kind, "person", l.words);
  // Its works: each from its lot's page to its own, and the legends' the same pages.
  const lots = new Set<number>(),
    kept = place.works ?? [];
  for (let k = 0; k + 6 < kept.length; k += 7) lots.add(kept[k]!);
  let pages = 0;
  const nd = placeNeedsDay(w, place);
  for (const lot of lots) {
    const page = placeInspect(w, town, placeLotRef(town, lot)) as PlaceInspectLot;
    assert.equal(page.works.length, Math.min(12, placeWorks(w, place, lot).length));
    for (const row of page.works) {
      const x = placeInspect(w, town, row.ref) as PlaceInspectWork;
      assert.equal(x?.kind, "work", row.ref);
      assert.equal(x.name, row.name);
      assert.ok(x.shows && x.made && x.kept && x.maker.name, JSON.stringify(x));
      // (Made on a day of the town's own years: a work's making is kept in seconds.)
      assert.match(x.made, /of year \d{1,4}$/, x.made);
      assert.equal(x.lotRef, placeLotRef(town, lot));
      if (x.maker.ref) assert.equal(placeInspect(w, town, x.maker.ref)?.kind, "person");
      if (x.whom) assert.equal(placeInspect(w, town, x.whom.ref)?.kind, "person");
      let seen = 0;
      for (let h = 0; h < nd.seen.length; h++)
        if (nd.seen[h] === lot && place.houses.home[h]! >= 0) seen++;
      assert.equal(x.seenBy, seen, "the households whose finest it is");
      pages++;
    }
  }
  for (const r of legends.works) assert.equal(placeInspect(w, town, r.ref)?.kind, "work", r.ref);
  assert.equal(legends.works.length, Math.min(8, kept.length / 7));
  // (A work not kept: no page.)
  assert.equal(placeInspect(w, town, `plcw:${town}:3:1:1`), null);
  assert.ok(pages > 0, "a work's page read");
  // (Only read: as its twin, which no one looked at.)
  assert.equal(placeDigest(place), placeDigest(other), "the place only read");
});
