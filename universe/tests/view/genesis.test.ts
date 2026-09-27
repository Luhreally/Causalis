import { test } from "node:test";
import assert from "node:assert/strict";
import type { GenesisPlan } from "../../src/bridge/index.ts";
import { sphereGrid } from "../../src/kernel/index.ts";
import {
  DAWN,
  ageColors,
  ageWords,
  dropOf,
  formingColors,
  paradeOf,
} from "../../src/view/index.ts";

const grid = sphereGrid(8),
  n = grid.count,
  // Half the world sea, half land; its land's own colour a green.
  elevation = Float32Array.from({ length: n }, (_, c) =>
    grid.positions[c * 3]! > 0 ? 500 : -3000,
  ),
  land = Uint8Array.from({ length: n * 4 }, (_, i) => [60, 160, 70, 255][i % 4]!);
const rgb = (a: Uint8Array, c: number) => [a[c * 4]!, a[c * 4 + 1]!, a[c * 4 + 2]!] as const;

test("the world forms: molten, then dark crust, then its seas rise over the low ground, then its land greens", () => {
  const sea = [...Array(n).keys()].find((c) => elevation[c]! < 0)!,
    hill = [...Array(n).keys()].find((c) => elevation[c]! > 0)!;
  const molten = formingColors(elevation, land, 0, 1);
  // Glowing: red well over blue.
  assert.ok(rgb(molten, hill)[0] > rgb(molten, hill)[2] + 60);
  const seas = formingColors(elevation, land, 0.72, 1);
  assert.ok(rgb(seas, sea)[2] > rgb(seas, sea)[0] + 40, "the low ground under the sea");
  const done = formingColors(elevation, land, 1, 1);
  assert.deepEqual(rgb(done, hill), [60, 160, 70], "its land as it is");
  assert.deepEqual(rgb(done, sea), [60, 160, 70]);
});

test("each deep age marks the world: an icehouse's ice down from the poles, an impact's flash", () => {
  const polar = [...Array(n).keys()].find((c) => Math.abs(grid.lat[c]!) > 1.3)!,
    equator = [...Array(n).keys()].find((c) => Math.abs(grid.lat[c]!) < 0.1)!,
    ice = ageColors(land, grid.lat, elevation, "icehouse", 0.5, 1);
  assert.ok(rgb(ice, polar)[2] > 200 && rgb(ice, polar)[0] > 200, "ice at the pole");
  assert.deepEqual(rgb(ice, equator), rgb(land, equator), "none at the equator");
  const flash = ageColors(land, grid.lat, elevation, "impact", 0.05, 3);
  assert.ok(rgb(flash, equator)[0] > rgb(land, equator)[0]);
  assert.equal(
    ageWords({
      index: 0,
      from: 520,
      to: 480,
      kind: "icehouse",
      seaLevel: 0,
      warmth: 0,
      forests: false,
    }).startsWith("520 million years ago"),
    true,
  );
});

test("under the microscope: cells dividing, cells with a nucleus, colonies, and the first bodies", () => {
  assert.deepEqual([...DAWN], ["first cells", "nucleus", "colonies", "bodies"]);
  const early = dropOf("first cells", 0.5).skins.length,
    later = dropOf("first cells", 12).skins.length;
  assert.ok(later > early * 4 && later <= 64, `${early} cells, then ${later}`);
  const big = dropOf("nucleus", 3);
  assert.ok(big.nuclei.length >= 10 && big.skins.every((c) => c.sx > 0));
  const balls = dropOf("colonies", 3);
  assert.ok(balls.skins.length >= 5 * 20, "balls of cells");
  const bodies = dropOf("bodies", 3);
  assert.ok(bodies.skins.length > 60 && bodies.bits.length > 10);
});

const lineage = (name: string, arose: number, died: number | null) => ({
  ref: `spec:0:${name.length}`,
  name,
  niche: "grazer",
  arose,
  died,
  size: 100,
  level: 2,
  body: {
    symmetry: "bilateral",
    segments: 1,
    legs: 4,
    fins: 0,
    wings: 0,
    covering: "fur",
    size: 100,
    moves: "walk",
    eats: "grass",
    level: 2,
    neck: 0.4,
    tail: 0.3,
    features: [],
    warm: true,
  },
  words: "a four-legged furred grazer of 100 kg that walks",
});

test("the living world arises age by age: each lineage on the stage from its age, gone after the age it died in", () => {
  const plan: GenesisPlan = {
    ages: Array.from({ length: 10 }, (_, i) => ({
      index: i,
      from: 500 - i * 50,
      to: 450 - i * 50,
      kind: "quiet",
      seaLevel: 0,
      warmth: 0,
      forests: i > 0,
    })),
    lineages: [
      lineage("old one", 1, 4),
      lineage("young one", 6, null),
      lineage("mid one", 3, null),
    ],
    people: null,
  };
  const at = (age: number) => paradeOf(plan, (age + 0.5) / 10);
  assert.deepEqual(at(0).on, []);
  assert.deepEqual(
    at(2).on.map((o) => plan.lineages[o.lineage]!.name),
    ["old one"],
  );
  assert.deepEqual(
    at(3)
      .on.map((o) => plan.lineages[o.lineage]!.name)
      .sort(),
    ["mid one", "old one"],
  );
  // Gone after the age it died in; the newest nearest.
  const late = at(7).on.map((o) => plan.lineages[o.lineage]!.name);
  assert.deepEqual(late, ["young one", "mid one"]);
  // Coming in as it arises, fading as it dies.
  const arising = paradeOf(plan, 6.05 / 10).on.find(
    (o) => plan.lineages[o.lineage]!.name === "young one",
  )!;
  assert.ok(arising.there < 0.5);
  const dying = paradeOf(plan, 4.9 / 10).on.find(
    (o) => plan.lineages[o.lineage]!.name === "old one",
  )!;
  assert.ok(dying.there < 0.5);
});
