// Phase 66: the ages past ours as they are seen. What is drawn is a pure reading: towers, craft in the
// sky, a land built over, beams with no smoke, burns with no blood. None of it is history.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TownParts,
  armLook,
  armorColor,
  armorPanels,
  builtOverCells,
  builtOverParts,
  builtOverTiles,
  flierAt,
  mirrorBand,
  mirrorStrength,
  MOST_GLINTS,
  remadeLook,
  type Flier,
} from "../../src/view/index.ts";
import type { ColonyLook } from "../../src/bridge/index.ts";
import { BLOW_OF, HOME_STOREYS } from "../../src/rules/index.ts";

test("beams leave no smoke, no ladders, and burn", () => {
  for (const arm of ["beam-rifle", "beam-lance"]) {
    const look = armLook(arm);
    assert.ok(look.beam, `${arm} has a beam's colour`);
    assert.equal(look.smoke, 0);
    assert.equal(look.ladders, false);
    assert.equal(look.looses, "shot");
    assert.equal(BLOW_OF[arm], "fire");
  }
  assert.equal(armLook("rifle").beam, undefined);
});

test("driven plate is worn as plate is, in its own colour", () => {
  assert.equal(armorPanels("driven-plate").length, armorPanels("plate").length);
  assert.notDeepEqual(armorColor("driven-plate", ""), armorColor("plate", ""));
});

test("a spire stands far above the highest block", () => {
  const n = HOME_STOREYS.length;
  assert.equal(n, 7);
  assert.ok(HOME_STOREYS[n - 1]! > HOME_STOREYS[n - 2]! * 3);
});

test("a land built over: roofs and towers, the same each time it is seen, within its land", () => {
  const a = new TownParts(),
    b = new TownParts();
  builtOverParts(1234, 150_000, a);
  builtOverParts(1234, 150_000, b);
  const data = (p: TownParts) => [...p.groups.values()].flatMap((g) => [...g.data]);
  assert.deepEqual(data(a), data(b));
  const all = data(a);
  assert.ok(all.length / 7 > 5000, `${all.length / 7} parts`);
  for (let o = 0; o < all.length; o += 7) {
    assert.ok(Math.abs(all[o]!) <= 150_000 && Math.abs(all[o + 2]!) <= 150_000);
    assert.ok(all[o + 4]! > 0);
  }
  // (Few colours: a batch a colour on the land.)
  assert.ok(a.groups.size <= 8, `${a.groups.size} colours`);
});

test("a flier keeps to its lane by the clock alone, the same at the same moment", () => {
  const ring: Flier = { way: null, r: 200, to: 200, high: 80, pace: 50, from: 0.25 },
    avenue: Flier = { way: 1, r: 30, to: 600, high: 120, pace: 40, from: 0.5 };
  for (const clock of [0, 3.5, 100, 12345.6]) {
    const p = flierAt(ring, clock);
    assert.ok(Math.abs(Math.hypot(p.x, p.z) - 200) < 1e-6);
    assert.equal(p.y, 80);
    assert.deepEqual(flierAt(ring, clock), p);
    const q = flierAt(avenue, clock),
      d = Math.hypot(q.x, q.z);
    assert.ok(d >= 30 - 1e-6 && d <= 600 + 1e-6, `${d} along its avenue`);
    // (Along its avenue, either way.)
    assert.ok(Math.abs(Math.atan2(q.z, q.x) - 1) < 1e-6);
  }
});

test("a star's mirrors are a thread when few and a band past counting when broad, the same each time", () => {
  assert.equal(mirrorBand(0).length, 0);
  assert.equal(mirrorStrength(50), 0);
  assert.equal(mirrorStrength(1e12), 1);
  const few = mirrorBand(1000),
    many = mirrorBand(5e8);
  assert.deepEqual([...mirrorBand(5e8)], [...many]);
  assert.ok(few.length / 4 < 60, `${few.length / 4} glints of a few`);
  assert.ok(
    many.length / 4 > 800 && many.length / 4 <= 24 + MOST_GLINTS,
    `${many.length / 4} of many`,
  );
  // (At its world's distance: and broader as they grow.)
  const spread = (b: Float32Array) => {
    let lo = Infinity,
      hi = 0;
    for (let i = 0; i < b.length; i += 4) {
      const r = Math.hypot(b[i]!, b[i + 2]!);
      lo = Math.min(lo, r);
      hi = Math.max(hi, r);
    }
    return hi - lo;
  };
  assert.ok(spread(many) > spread(few) * 2);
  for (let i = 0; i < many.length; i += 4) {
    const r = Math.hypot(many[i]!, many[i + 2]!);
    assert.ok(r > 3 && r < 9, `${r} from its star`);
  }
});

test("lands built over are painted on the world's face and leave the sea be", () => {
  const n = 500,
    elevation = new Float32Array(n).map((_, c) => (c % 2 ? 100 : -100)),
    province = new Int32Array(n).map((_, c) => (c < 250 ? 7 : 8)),
    frame = { arrays: { elevation, province } } as never,
    colors = new Uint8Array(n * 4).fill(10);
  builtOverCells(colors, frame, new Set([7]));
  let lit = 0;
  for (let c = 0; c < n; c++) {
    const painted = colors[c * 4] !== 10;
    assert.equal(painted, c < 250 && c % 2 === 1, `cell ${c}`);
    if (painted && colors[c * 4]! > 200) lit++;
  }
  assert.ok(lit > 5 && lit < 60, `${lit} lit of 125`);
});

test("a land's map built over keeps its water, and paints a copy", () => {
  const n = 64,
    elevation = new Float32Array(n).fill(10),
    water = new Uint8Array(n).map((_, t) => (t < 8 ? 1 : 0)),
    frame = { arrays: { elevation, water } } as never,
    colors = new Uint8Array(n * 4).fill(200),
    out = builtOverTiles(colors, frame);
  assert.equal(out[0], 200, "the sea stays");
  assert.notEqual(out[8 * 4], 200, "the land is street and roof");
  assert.equal(colors[8 * 4], 200, "what it was given is left");
});

test("a landing's film plays its world's remaking from the world it began as", () => {
  const found = {
    air: "none",
    water: "ice",
    pressure: 0,
    temperature: -120,
    icy: true,
    remaking: {
      from: 1500,
      to: 1900,
      share: 1,
      base: { air: "none", water: "ice", pressure: 0, temperature: -120, icy: true },
    },
  } as unknown as ColonyLook;
  assert.equal(remadeLook(found, 0).air, "none");
  assert.equal(remadeLook(found, 0.5).air, "thin");
  assert.equal(remadeLook(found, 1).air, "breathable");
  assert.equal(remadeLook(found, 1).temperature, 15);
  assert.equal(remadeLook(found, 1).remade, 1);
  // (A world never remade is told of as it is.)
  const bare = { air: "thin" } as unknown as ColonyLook;
  assert.equal(remadeLook(bare, 1), bare);
});
