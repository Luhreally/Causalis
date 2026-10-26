// The ground of a world whose crust is not Earth's (Phase 54 M221): Earth's crust returns Earth's
// own tables, the same objects. Another crust changes a rock, soil or pigment only where its
// silica, redox or carbon says so; every substance named resolves; parts sum to one.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLAYS_REDUCED,
  clayOverride,
  pigmentOverride,
  worldRock,
  worldRocks,
  worldSoil,
} from "../../src/rules/chem-ground.ts";
import {
  ROCKS,
  SOILS,
  SOLAR,
  findSubstance,
  type CarbonClass,
  type Chemistry,
  type Redox,
  type Rock,
  type SilicaClass,
} from "../../src/rules/index.ts";

/** A chemistry in one crust: the Sun's own, spread out, its silica, redox and carbon as named. */
function crust(silica: SilicaClass, redox: Redox, carbon: CarbonClass = "oxide"): Chemistry {
  return { ...SOLAR, solar: false, silica, redox, carbon };
}

/** Every crust a world can have: silica three ways; carbon-rich crusts are reduced too. */
const CRUSTS: readonly Chemistry[] = (["high", "solar", "low"] as const).flatMap((silica) => [
  crust(silica, "oxidised"),
  crust(silica, "reduced"),
  crust(silica, "reduced", "carbon-rich"),
]);

/** Earth's own rock, by its id. */
function earth(id: string): Rock {
  const rock = ROCKS.find((r) => r.id === id);
  assert.ok(rock, id);
  return rock;
}

/** The sum of a part list's shares. */
function sum(parts: readonly (readonly [string, number])[]): number {
  return parts.reduce((total, [, share]) => total + share, 0);
}

test("Earth's crust gives Earth's own rocks, soils and pigments: the same objects", () => {
  for (const rock of ROCKS) {
    assert.equal(worldRock(SOLAR, rock.id), rock);
    assert.equal(pigmentOverride(SOLAR, rock.id), null);
  }
  assert.equal(worldRocks(SOLAR), ROCKS);
  for (const key of Object.keys(SOILS)) assert.equal(worldSoil(SOLAR, key), SOILS[key]);
  assert.equal(clayOverride(SOLAR, 0.1, 0), null);
  assert.equal(clayOverride(SOLAR, 0, 0), null);
});

test("an oxidised crust with Earth's silica and oxide carbon changes nothing", () => {
  const chem: Chemistry = { ...crust("solar", "oxidised"), metals: "rich", air: "rich" };
  assert.equal(worldRocks(chem), ROCKS);
  for (const rock of ROCKS) assert.equal(worldRock(chem, rock.id), rock);
  for (const key of Object.keys(SOILS)) assert.equal(worldSoil(chem, key), SOILS[key]);
  for (const rock of ROCKS) assert.equal(pigmentOverride(chem, rock.id), null);
  assert.equal(clayOverride(chem, 0.1, 0), null);
});

test("under a reduced crust no rock or soil part is hematite", () => {
  for (const chem of CRUSTS.filter((c) => c.redox === "reduced")) {
    for (const rock of worldRocks(chem))
      assert.ok(
        rock.parts.every(([id]) => id !== "hematite"),
        `${rock.name} is hematite-free`,
      );
    for (const key of Object.keys(SOILS))
      assert.ok(
        worldSoil(chem, key).parts.every(([id]) => id !== "hematite"),
        `${key} is hematite-free`,
      );
  }
});

test("every part id resolves through findSubstance", () => {
  for (const chem of [SOLAR, ...CRUSTS]) {
    for (const rock of worldRocks(chem))
      for (const [id] of rock.parts) assert.ok(findSubstance(id), `${rock.name}: ${id}`);
    for (const key of Object.keys(SOILS))
      for (const [id] of worldSoil(chem, key).parts) assert.ok(findSubstance(id), `${key}: ${id}`);
  }
});

test("every rock's and soil's parts sum to one, and each substance is listed once", () => {
  const once = (parts: readonly (readonly [string, number])[]) =>
    new Set(parts.map(([id]) => id)).size === parts.length;
  for (const chem of [SOLAR, ...CRUSTS]) {
    for (const rock of worldRocks(chem)) {
      assert.ok(Math.abs(sum(rock.parts) - 1) < 1e-9, rock.name);
      assert.ok(once(rock.parts), rock.name);
    }
    for (const key of Object.keys(SOILS)) {
      const parts = worldSoil(chem, key).parts;
      assert.ok(Math.abs(sum(parts) - 1) < 1e-9, key);
      assert.ok(once(parts), key);
    }
  }
});

test("precedence: carbon-rich with low silica, the basalt is picrite with a moissanite part", () => {
  const rock = worldRock(crust("low", "reduced", "carbon-rich"), "basalt");
  assert.equal(rock.name, "picrite");
  assert.deepEqual(rock.parts, [
    ["olivine", 0.35],
    ["pyroxene", 0.35],
    ["plagioclase", 0.26],
    ["moissanite", 0.04],
  ]);
  assert.equal(
    rock.words,
    "Green-black lava crowded with olivine: the floor of its oceans, and of the lands a hotspot flooded. Grains of carbide glint in it.",
  );
});

test("precedence: low silica, limestone is dolostone", () => {
  assert.equal(worldRock(crust("low", "oxidised"), "limestone").name, "dolostone");
  assert.equal(worldRock(crust("low", "reduced", "carbon-rich"), "limestone").name, "dolostone");
});

test("a carbon-rich crust is reduced even when it is written oxidised", () => {
  assert.equal(worldRock(crust("solar", "oxidised", "carbon-rich"), "shale").name, "black shale");
});

test("silica: low makes greywacke, high makes quartz arenite, and reduction then sets its hematite", () => {
  assert.equal(worldRock(crust("low", "oxidised"), "sandstone").name, "greywacke");
  const arenite = worldRock(crust("high", "reduced"), "sandstone");
  assert.equal(arenite.name, "quartz arenite");
  assert.deepEqual(arenite.parts, [
    ["quartz", 0.95],
    ["kaolinite", 0.03],
    ["magnetite", 0.02],
  ]);
});

test("reduced: shale is black shale, sandstone still so named is grey, and the rest are Earth's", () => {
  const chem = crust("solar", "reduced");
  const shale = worldRock(chem, "shale");
  assert.equal(shale.name, "black shale");
  assert.deepEqual(shale.parts, [
    ["kaolinite", 0.52],
    ["quartz", 0.28],
    ["feldspar", 0.1],
    ["carbon", 0.06],
    ["pyrite", 0.04],
  ]);
  const sandstone = worldRock(chem, "sandstone");
  assert.equal(sandstone.name, "grey sandstone");
  assert.equal(sandstone.words, "Old sand bound into stone, grey: nothing in it has rusted red.");
  assert.deepEqual(sandstone.colour, [0.6, 0.6, 0.58]);
  assert.deepEqual(sandstone.parts, [
    ["quartz", 0.85],
    ["feldspar", 0.1],
    ["kaolinite", 0.03],
    ["magnetite", 0.02],
  ]);
  assert.equal(worldRock(chem, "granite"), earth("granite"));
  assert.equal(worldRock(chem, "coal-measures"), earth("coal-measures"));
});

test("carbon-rich: coal measures cook to graphite schist, and the basalt's magnetite is moissanite", () => {
  const chem = crust("solar", "reduced", "carbon-rich");
  const coal = worldRock(chem, "coal-measures");
  assert.equal(coal.name, "graphite schist");
  assert.deepEqual(coal.parts, [
    ["quartz", 0.4],
    ["kaolinite", 0.25],
    ["graphite", 0.25],
    ["pyrite", 0.05],
    ["feldspar", 0.05],
  ]);
  const basalt = worldRock(chem, "basalt");
  assert.equal(basalt.name, "basalt");
  assert.deepEqual(basalt.parts, [
    ["plagioclase", 0.5],
    ["pyroxene", 0.38],
    ["olivine", 0.08],
    ["moissanite", 0.04],
  ]);
  assert.equal(basalt.words, `${earth("basalt").words} Grains of carbide glint in it.`);
});

test("carbon-rich: every silica's basalt has magnetite .04, which becomes moissanite", () => {
  for (const silica of ["high", "solar", "low"] as const) {
    const basalt = worldRock(crust(silica, "reduced", "carbon-rich"), "basalt");
    assert.equal(basalt.parts.find(([id]) => id === "moissanite")?.[1], 0.04, basalt.name);
    assert.ok(
      basalt.parts.every(([id]) => id !== "magnetite"),
      basalt.name,
    );
  }
});

test("pigments: a reduced crust grinds its own earths, a carbon-rich one graphite", () => {
  const reduced = crust("solar", "reduced");
  const green = { name: "green earth", colour: [0.42, 0.5, 0.36] };
  assert.deepEqual(pigmentOverride(reduced, "sandstone"), green);
  assert.deepEqual(pigmentOverride(reduced, "a rock not listed"), green);
  assert.deepEqual(pigmentOverride(reduced, "granite"), {
    name: "green earth",
    colour: [0.45, 0.52, 0.4],
  });
  assert.deepEqual(pigmentOverride(reduced, "shale"), {
    name: "black earth",
    colour: [0.12, 0.12, 0.13],
  });
  assert.deepEqual(pigmentOverride(reduced, "limestone"), {
    name: "white earth",
    colour: [0.9, 0.89, 0.84],
  });
  assert.equal(pigmentOverride(reduced, "coal-measures"), null);
  const carbon = crust("solar", "reduced", "carbon-rich");
  const graphite = { name: "graphite", colour: [0.18, 0.18, 0.2] };
  assert.deepEqual(pigmentOverride(carbon, "shale"), graphite);
  assert.deepEqual(pigmentOverride(carbon, "coal-measures"), graphite);
  assert.deepEqual(pigmentOverride(carbon, "granite"), {
    name: "green earth",
    colour: [0.45, 0.52, 0.4],
  });
});

test("clays: black from iron .06 (before lime), buff with lime, grey from iron .02, else pale", () => {
  const reduced = crust("solar", "reduced");
  assert.equal(clayOverride(reduced, 0.06, 0), "black");
  assert.equal(clayOverride(reduced, 0.06, 0.5), "black");
  assert.equal(clayOverride(reduced, 0.059, 0.05), null);
  assert.equal(clayOverride(reduced, 0.03, 0.04), "grey");
  assert.equal(clayOverride(reduced, 0.02, 0), "grey");
  assert.equal(clayOverride(reduced, 0.019, 0), null);
  assert.equal(clayOverride(crust("solar", "oxidised"), 0.1, 0), null);
});

test("the reduced clays: their names, wares and colours", () => {
  assert.deepEqual(CLAYS_REDUCED.grey, {
    name: "grey clay",
    ware: "grey ware",
    raw: [0.45, 0.45, 0.43],
    fired: [0.42, 0.42, 0.43],
  });
  assert.deepEqual(CLAYS_REDUCED.black, {
    name: "dark clay",
    ware: "black burnished ware",
    raw: [0.3, 0.3, 0.29],
    fired: [0.16, 0.16, 0.17],
  });
});

test("reduced soils: named where the table names them, hematite as magnetite at its share", () => {
  const reduced = crust("solar", "reduced");
  assert.deepEqual(worldSoil(reduced, "temperateForest"), {
    name: "a grey forest earth",
    parts: [
      ["quartz", 0.4],
      ["kaolinite", 0.2],
      ["feldspar", 0.12],
      ["humus", 0.08],
      ["magnetite", 0.02],
      ["water", 0.18],
    ],
  });
  assert.equal(worldSoil(reduced, "tropicalRainforest").name, "a leached grey clay (gley)");
  assert.equal(worldSoil(reduced, "steppe"), SOILS.steppe);
  assert.equal(worldSoil(crust("solar", "oxidised"), "temperateForest"), SOILS.temperateForest);
});

test("the same crust gives the same objects; redox keeps two crusts apart", () => {
  const a = crust("low", "reduced", "carbon-rich"),
    b = { ...a };
  assert.equal(worldRock(a, "basalt"), worldRock(b, "basalt"));
  assert.equal(worldRocks(a), worldRocks(b));
  assert.equal(worldSoil(a, "savanna"), worldSoil(b, "savanna"));
  assert.deepEqual(
    worldRocks(a).map((rock) => rock.id),
    ROCKS.map((rock) => rock.id),
  );
  assert.equal(worldRocks(a)[1], worldRock(a, "basalt"));
  assert.equal(worldRock(crust("low", "reduced"), "shale").name, "black shale");
  assert.equal(worldRock(crust("low", "oxidised"), "shale"), earth("shale"));
});

test("an unknown rock or soil is an error", () => {
  assert.throws(() => worldRock(SOLAR, "unobtainium"));
  assert.throws(() => worldSoil(SOLAR, "nowhere"));
});
