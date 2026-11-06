import { test } from "node:test";
import assert from "node:assert/strict";
import { OCC } from "../../src/rules/index.ts";
import type { Memorial, VillagePlan, Wonder } from "../../src/bridge/index.ts";
import { memorialsPlaced, villageSolids, wonderSpot } from "../../src/view/index.ts";

// T1: a town's stones and the god's wonders each ask where the other stands. A stone keeps clear of where a wonder was
// set; a wonder stands clear of whatever stands by then. Neither may wait on the other: a town with both once never drew.

/** A village of sixteen homes, a stone and two wonders asked for. */
const town = (wonders: readonly Wonder[], memorials: readonly Memorial[]): VillagePlan => ({
  ref: "vill:0:93",
  name: "Stonehamlet",
  population: 300,
  market: false,
  hand: false,
  districts: null,
  biome: 9,
  seed: 7,
  homes: Array.from({ length: 16 }, (_, k) => {
    const a = k * 2.399963,
      r = 26 + 8.5 * Math.sqrt(k);
    return { x: r * Math.cos(a), z: r * Math.sin(a), yaw: a, household: `hhold:0:${k}` };
  }),
  fields: [],
  pasture: { x: -150, z: 0, r: 60 },
  wild: 400,
  water: null,
  house: { walls: "timber", roof: "thatch", form: "square", pitch: 40, design: null },
  body: null,
  road: { x: 0, z: -500 },
  era: "farm",
  people: Array.from({ length: 8 }, (_, i) => ({
    ref: `prsn:0:${i}`,
    name: `P${i} Stone`,
    home: i % 16,
    age: 20 + ((i * 7) % 30),
    occupation: OCC.farmer,
    child: false,
  })),
  wonders,
  memorials,
});

const stone: Memorial = {
  ref: "stone:vill:0:93:1",
  form: "stone",
  title: "A stone to the fallen",
  year: 30,
  age: 10,
  size: 2,
  colour: [0.6, 0.58, 0.55],
  dark: [0.3, 0.29, 0.27],
};

const spring: Wonder = { kind: "spring", at: 100, x: -16, z: 12, event: "ev:0:1" },
  shrine: Wonder = { kind: "shrine", at: 100, x: null, z: null, event: "ev:0:2" };

test("a town with stones and the god's wonders: each has its place, and the stone keeps clear", () => {
  const plan = town([spring, shrine], [stone]),
    placed = memorialsPlaced(plan);
  assert.equal(placed.length, 1, "the stone stands");
  for (const w of plan.wonders!) {
    const at = wonderSpot(plan, w);
    assert.ok(Number.isFinite(at.x) && Number.isFinite(at.z), `${w.kind} at ${at.x}, ${at.z}`);
    assert.ok(
      Math.hypot(at.x - placed[0]!.x, at.z - placed[0]!.z) > 4,
      `${w.kind} at ${at.x}, ${at.z}; the stone at ${placed[0]!.x}, ${placed[0]!.z}`,
    );
  }
  assert.ok(villageSolids(plan).homes.length > plan.homes.length, "the stone stands in the way");
});

test("a spring set where a stone would have stood sends the stone along the rim", () => {
  const alone = memorialsPlaced(town([], [stone]))[0]!,
    plan = town([{ ...spring, x: alone.x, z: alone.z }], [stone]),
    moved = memorialsPlaced(plan)[0]!;
  assert.ok(Math.hypot(moved.x - alone.x, moved.z - alone.z) > 4, "it moved");
});
