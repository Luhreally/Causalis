// A town's worn ground and a road's laying (R1): read off who walks, not all alike; a road laid section by section; an old road with no stages as ever.
import { test } from "node:test";
import assert from "node:assert/strict";
import { campTracks, cutLine, roadNow, worksShare } from "../../src/view/land.ts";
import type { LandRoad, RoadWorks } from "../../src/bridge/index.ts";

const bare: LandRoad = {
  from: 1,
  to: 2,
  a: "town:0:1",
  b: "town:0:2",
  toward: null,
  since: 100,
  paved: 300,
  rails: null,
  traffic: 2,
};

test("a road from an old plan, with no stages, stands all at once at its years", () => {
  assert.equal(roadNow(bare, 50).behind, "none");
  assert.equal(roadNow(bare, 150).behind, "track");
  assert.equal(roadNow(bare, 350).behind, "paved");
  assert.equal(roadNow(bare, 350).works, null);
});

test("a road is laid behind its gang, what it was ahead of it", () => {
  const works: RoadWorks = {
    what: "paved",
    from: 300,
    until: 310,
    again: false,
    stops: [],
    hands: 12,
    machines: false,
    colour: [0.5, 0.5, 0.5],
  };
  const road: LandRoad = {
    ...bare,
    stages: [
      { what: "track", from: 100, until: 105 },
      { what: "paved", from: 300, until: 310 },
    ],
    works,
  };
  const now = roadNow(road, 305);
  assert.equal(now.behind, "paved");
  assert.equal(now.ahead, "track");
  assert.equal(now.share, 0.5);
  assert.equal(roadNow(road, 104).behind, "none");
  assert.equal(roadNow(road, 120).behind, "track");
  assert.equal(roadNow(road, 320).behind, "paved");
});

test("a gang stopped gets no farther while it stands", () => {
  const w: RoadWorks = {
    what: "paved",
    from: 300,
    until: 312,
    again: false,
    stops: [{ from: 304, to: 306, why: "war", ref: null }],
    hands: 12,
    machines: false,
    colour: [0.5, 0.5, 0.5],
  };
  assert.equal(worksShare(w, 304), worksShare(w, 306));
  assert.equal(worksShare(w, 312), 1);
  assert.ok(worksShare(w, 303) < worksShare(w, 307));
});

test("a line is cut at a share of its length, the point between in both parts", () => {
  const [a, b] = cutLine(
    [
      { x: 0, z: 0 },
      { x: 10, z: 0 },
    ],
    0.3,
  );
  assert.deepEqual(a.at(-1), { x: 3, z: 0 });
  assert.deepEqual(b[0], { x: 3, z: 0 });
});

test("tracks join camps and hamlets once each, none past a day's walk, none along a road", () => {
  const size = 128,
    tile = (i: number, j: number) => j * size + i;
  const list = campTracks(
    [{ home: tile(10, 10) }, { home: tile(14, 10) }, { home: tile(100, 100) }],
    [{ tile: tile(12, 14) }],
    [],
    size,
  );
  assert.ok(list.length >= 2);
  assert.ok(list.every(([a, b]) => a !== tile(100, 100) && b !== tile(100, 100)));
  const keys = new Set(list.map(([a, b]) => (a < b ? `${a}-${b}` : `${b}-${a}`)));
  assert.equal(keys.size, list.length);
});
