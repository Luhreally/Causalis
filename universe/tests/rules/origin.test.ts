import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText } from "../../src/kernel/index.ts";
import {
  elsewhereOrigin,
  generateHomeWorld,
  originGround,
  tidesOf,
  treeOfLife,
  worldLife,
} from "../../src/gen/index.ts";
import {
  OPEN,
  PRIORS,
  POWER_OXYGEN,
  TRADES,
  airChange,
  readOrigin,
  tradesOf,
  warmthPace,
  type OriginGround,
} from "../../src/rules/index.ts";
import { originOfHome } from "../../src/host/origin.ts";

// B2: how life began on a world, read from its numbers, agreeing with what it already is.

const earth = generateHomeWorld(seedFromText("first light"), PRIORS.earthlike!),
  sulfur = generateHomeWorld(seedFromText("alien 84"), OPEN),
  methane = generateHomeWorld(seedFromText("alien 1429"), OPEN);

test("Earth's comes out as Earth's own: at seafloor vents, on hydrogen with carbon dioxide; oxygen from light splitting water, about 2.4 billion years ago", () => {
  const o = originOfHome(earth);
  assert.equal(o.cradle?.id, "vents");
  assert.equal(
    o.first?.id,
    "h2-co2",
    "the first life ran on hydrogen and carbon dioxide (as LUCA)",
  );
  assert.equal(o.light?.id, "split-water");
  assert.equal(o.eaters?.id, "breathe-o2");
  assert.ok(o.air.oxygen && o.air.at !== null);
  assert.ok(
    o.air.at! >= 2300 && o.air.at! <= 2500,
    `its air changed ${o.air.at} million years ago`,
  );
  assert.equal(o.air.held, false, "the reckoning alone dates it");
  assert.match(airLine(o.air.words), /iron/);
  // (The tree of life's step is dated by the same reading, told in order.)
  const rungs = treeOfLife(earth).rungs;
  assert.equal(rungs.find((r) => r.id === "air")!.at, o.air.at);
  for (let i = 1; i < rungs.length; i++) assert.ok(rungs[i]!.at < rungs[i - 1]!.at);
  // (Its tides, its Moon's and the Sun's, about Earth's own.)
  assert.ok(o.ground.tides > 0.8 && o.ground.tides < 1.2, `tides ${o.ground.tides}`);
  assert.ok(o.ground.heat > 0.8 && o.ground.heat < 1.3, `heat ${o.ground.heat}`);
});
const airLine = (s: string) => s;

test("breathing oxygen gives about fifteen times what fermenting does; rock chemistry a fraction of either", () => {
  const ratio = TRADES["breathe-o2"].power / TRADES.ferment.power;
  assert.ok(ratio > 13 && ratio < 16, `${ratio}`);
  assert.equal(TRADES["breathe-o2"].power, POWER_OXYGEN);
  assert.ok(TRADES["h2-co2"].power < TRADES.ferment.power);
  // (At −180 °C life's chemistry runs about a million times slower: an estimate.)
  assert.ok(warmthPace(-180) / warmthPace(15) < 1e-5);
});

test("a methane world has no free oxygen and no light-eaters: its life eats acetylene and hydrogen, slowly, and says so as an estimate", () => {
  const o = originOfHome(methane);
  assert.equal(worldLife(methane).family, "methane");
  assert.equal(o.air.oxygen, false);
  assert.equal(o.air.at, null);
  assert.equal(o.light, null);
  assert.equal(o.eaters?.id, "acetylene");
  assert.ok(o.eaters!.estimate);
  assert.ok(o.eaters!.power < 1e-4, `${o.eaters!.power} W a kilogram at −180 °C`);
  assert.ok(o.small.every((s) => s.trade !== "breathe-o2" && s.way !== "light"));
  assert.ok(!o.trades.find((t) => t.id === "breathe-o2")!.open);
  assert.match(o.trades.find((t) => t.id === "split-water")!.missing ?? "", /no water|light/);
});

test("a sulfur-volcano world breathes oxygen, as its air holds it, and its light-eaters split its acid water", () => {
  const o = originOfHome(sulfur);
  assert.ok(o.air.oxygen && o.air.at !== null);
  assert.equal(o.light?.id, "split-water");
  assert.equal(originGround(sulfur).sulfur, 3);
  assert.ok(o.trades.find((t) => t.id === "h2-sulfur")!.open);
});

test("a trade is open only where the world holds both its halves", () => {
  const base = originGround(earth),
    dark: OriginGround = {
      ...base,
      ground: 0,
      light: 0,
      underIce: true,
      sea: 0,
      ice: 0.9,
      eatsLight: false,
      oxygen: false,
      o2: 0,
    },
    noCo2: OriginGround = { ...base, co2: false },
    t = tradesOf(dark);
  for (const id of [
    "split-water",
    "light-sulfur",
    "light-iron",
    "light-hydrogen",
    "dim-red",
    "strip",
  ] as const)
    assert.equal(t.find((x) => x.id === id)!.open, false, `${id} in the dark`);
  assert.equal(tradesOf(noCo2).find((x) => x.id === "h2-co2")!.open, false);
  assert.equal(t.find((x) => x.id === "breathe-o2")!.open, false);
  assert.equal(t.find((x) => x.id === "ferment")!.open, true);
  // (Under ice, with no light, its life began at vents or in brine, and its air never changed.)
  const r = readOrigin({ ...dark, level: "cells" });
  assert.ok(r.cradle && ["vents", "brine"].includes(r.cradle.id), r.cradle?.id);
  assert.equal(r.light, null);
  assert.equal(airChange({ ...dark, level: "cells" }, null, 0).oxygen, false);
  // (A red star's light needs more catches for each fixing: its light-eaters slower.)
  const red = tradesOf({ ...base, starK: 3000 }).find((x) => x.id === "split-water")!;
  assert.ok(red.power15 < tradesOf(base).find((x) => x.id === "split-water")!.power15);
});

test("the reading is pure: the same each time, and reading it moves nothing of the world", () => {
  const g = generateHomeWorld(seedFromText("alien 7"), OPEN),
    digest = g.digest,
    a = JSON.stringify(originOfHome(g));
  assert.equal(JSON.stringify(originOfHome(generateHomeWorld(seedFromText("alien 7"), OPEN))), a);
  assert.equal(g.digest, digest);
});

test("a world elsewhere under ice: rock-eaters on a grain, no light-eaters, no oxygen; a lit sea's: oxygen, as its people's pages say", () => {
  const star = {
      sector: 1,
      k: 2,
      ageGyr: 4,
      remnant: false,
      spectral: "G2V",
      luminosity: 1,
      temperature: 5800,
      mass: 1,
    },
    ground = {
      kind: "rocky",
      temperature: -40,
      pressure: 0.5,
      water: "ice",
      radiation: 1,
      gravity: 0.8,
      index: 1,
      a: 2,
    },
    ice = elsewhereOrigin("test ice", star, ground, {
      level: "cells",
      because: "",
      where: "water under its ice",
      cellsAgo: 2,
      bodiesAgo: null,
      small: ["eater"],
      bodies: [],
    });
  assert.equal(ice.air.oxygen, false);
  assert.equal(ice.light, null);
  assert.ok(ice.cradle && ["vents", "brine"].includes(ice.cradle.id));
  assert.ok(
    ice.small.some((s) => s.way === "rock"),
    "rock-eaters",
  );
  const sea = elsewhereOrigin(
    "test sea",
    star,
    { ...ground, temperature: 15, water: "seas", a: 1 },
    {
      level: "cells",
      because: "",
      where: "seas",
      cellsAgo: 3,
      bodiesAgo: null,
      small: ["eater", "light"],
      bodies: [],
    },
  );
  assert.equal(sea.air.oxygen, true);
  assert.equal(sea.light?.id, "split-water");
  assert.ok(!sea.small.some((s) => s.way === "hunter"), "no hunters where its drop has none");
});

test("tides: a moon's and its star's; a face locked to a near small star feels none of the star's", () => {
  assert.ok(Math.abs(tidesOf([{ mass: 0.0123, a: 384.4 }], 1, 1) - 1) < 1e-9);
  assert.ok(tidesOf([], 1, 1) < 0.4);
  assert.equal(tidesOf([], 0.3, 0.05), 0);
});
