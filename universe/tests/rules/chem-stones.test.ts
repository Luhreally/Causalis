// The edge stones of a world's crust (Phase 54 M221): Earth's own crust is STONES exactly; a crust
// poor or rich in silica, reduced, or carbon-rich takes its own edges, laid over STONES in order
// (silica, then reduced, then carbon-rich); and a land's keenest rock is the same over any table as
// over STONES.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CARBON_STONES,
  FIELDSTONE,
  REDUCED_STONES,
  SILICA_HIGH_STONES,
  SILICA_LOW_STONES,
  keenestIn,
  stonesFor,
  stonesKey,
  usualStone,
} from "../../src/rules/chem-stones.ts";
import {
  ROCKS,
  SOLAR,
  STONES,
  keenestRock,
  type CarbonClass,
  type Chemistry,
  type Redox,
  type SilicaClass,
  type Stone,
} from "../../src/rules/index.ts";

type Second = "oxidised" | "reduced" | "carbon";

/**
 * A chemistry in one crust: the Sun's own spread out (solar false), its silica and its redox or
 * carbon as named.
 */
function crust(silica: SilicaClass, second: Second): Chemistry {
  const carbon: CarbonClass = second === "carbon" ? "carbon-rich" : "oxide",
    redox: Redox = second === "oxidised" ? "oxidised" : "reduced";
  return { ...SOLAR, solar: false, silica, carbon, redox };
}

/** A stone, written as the spec's table gives it: name, from, keen, tough, colour, subst. */
function st(
  name: string,
  from: string,
  keen: number,
  tough: number,
  colour: [number, number, number],
  subst: string | null,
): Stone {
  return { name, from, keen, tough, colour, subst };
}

const IDS = ROCKS.map((r) => r.id);

/** Each rock's edge by name, with no overlay: STONES' own. */
const PLAIN: Record<string, string> = {
  limestone: "flint",
  shale: "chert",
  "coal-measures": "chert",
  andesite: "obsidian",
  basalt: "basalt",
  sandstone: "quartzite",
  granite: "quartz",
  gneiss: "quartzite",
};
/** A silica-rich crust: its shale is novaculite and its basalt tholeiite. */
const HIGH: Record<string, string> = { ...PLAIN, shale: "novaculite", basalt: "tholeiite" };
/** A silica-poor crust. */
const LOW: Record<string, string> = {
  ...PLAIN,
  andesite: "tachylite",
  gneiss: "nephrite",
  granite: "corundum",
  sandstone: "greywacke",
  limestone: "fieldstone",
  basalt: "picrite",
};

/** The nine crusts' edges by name, keyed by stonesKey. */
const NAMES: Record<string, Record<string, string>> = {
  "solar/oxidised": PLAIN,
  "solar/reduced": { ...PLAIN, shale: "lydite", "coal-measures": "lydite" },
  "solar/carbon": { ...PLAIN, shale: "lydite", basalt: "moissanite", "coal-measures": "lydite" },
  "high/oxidised": HIGH,
  "high/reduced": { ...HIGH, shale: "lydite", "coal-measures": "lydite" },
  "high/carbon": { ...HIGH, shale: "lydite", basalt: "moissanite", "coal-measures": "lydite" },
  "low/oxidised": LOW,
  "low/reduced": { ...LOW, shale: "lydite", "coal-measures": "lydite" },
  "low/carbon": { ...LOW, shale: "lydite", basalt: "moissanite", "coal-measures": "lydite" },
};

test("Earth's crust gives STONES itself", () => {
  assert.equal(stonesKey(SOLAR), "solar/oxidised");
  assert.equal(stonesFor(SOLAR), STONES);
});

test("a chemistry in Earth's classes, though not the Sun's own, also gives STONES", () => {
  assert.equal(stonesFor({ ...SOLAR, solar: false }), STONES);
  assert.equal(stonesFor(crust("solar", "oxidised")), STONES);
});

test("the override stones are the spec's, value for value", () => {
  assert.deepEqual(
    FIELDSTONE,
    st(
      "fieldstone",
      "whatever hard cobble the fields turn up, ground to an edge",
      0.35,
      0.8,
      [0.55, 0.53, 0.5],
      null,
    ),
  );
  assert.deepEqual(SILICA_HIGH_STONES, {
    shale: st(
      "novaculite",
      "white beds of the silica-rich shale",
      0.9,
      0.5,
      [0.86, 0.85, 0.8],
      "chert",
    ),
    basalt: st(
      "tholeiite",
      "the dark olivine-free lava, flaked coarse and ground to an edge",
      0.45,
      0.9,
      [0.24, 0.24, 0.26],
      null,
    ),
    andesite: st(
      "obsidian",
      "the black glass of dacite flows",
      1,
      0.2,
      [0.06, 0.06, 0.09],
      "obsidian",
    ),
    granite: st(
      "quartz",
      "the white veins of the leucogranite",
      0.5,
      0.4,
      [0.9, 0.9, 0.88],
      "quartz",
    ),
    sandstone: st(
      "quartzite",
      "cobbles of the clean quartz sandstone",
      0.55,
      0.85,
      [0.86, 0.83, 0.76],
      "quartz",
    ),
  });
  assert.deepEqual(SILICA_LOW_STONES, {
    andesite: st(
      "tachylite",
      "the black glass of its low-silica lavas",
      0.9,
      0.25,
      [0.08, 0.07, 0.07],
      "tachylite",
    ),
    gneiss: st(
      "nephrite",
      "green jade where the old hills' serpentine was altered",
      0.5,
      1,
      [0.36, 0.52, 0.38],
      "nephrite",
    ),
    granite: st(
      "corundum",
      "grey corundum of the quartz-poor tonalite, ground to an edge",
      0.7,
      0.6,
      [0.48, 0.47, 0.5],
      "corundum",
    ),
    sandstone: st(
      "greywacke",
      "hard grey cobbles of the gritty sandstone",
      0.5,
      0.8,
      [0.42, 0.43, 0.42],
      null,
    ),
    limestone: st(
      "fieldstone",
      "whatever hard cobble the fields turn up, ground to an edge",
      0.35,
      0.8,
      [0.55, 0.53, 0.5],
      null,
    ),
    basalt: st(
      "picrite",
      "the green-black olivine lava, flaked coarse and ground to an edge",
      0.45,
      0.9,
      [0.2, 0.24, 0.2],
      "olivine",
    ),
  });
  assert.deepEqual(REDUCED_STONES, {
    shale: st(
      "lydite",
      "black chert beds of the unrusted shale",
      0.8,
      0.6,
      [0.1, 0.1, 0.11],
      "chert",
    ),
    "coal-measures": st(
      "lydite",
      "black chert bands in the coal country's shale",
      0.8,
      0.6,
      [0.1, 0.1, 0.11],
      "chert",
    ),
  });
  assert.deepEqual(CARBON_STONES, {
    basalt: st(
      "moissanite",
      "green-black carbide grains of the lava, ground to an edge",
      0.92,
      0.35,
      [0.18, 0.3, 0.26],
      "moissanite",
    ),
    "coal-measures": st(
      "lydite",
      "black chert bands of the graphite schist",
      0.8,
      0.6,
      [0.1, 0.1, 0.11],
      "chert",
    ),
  });
});

test("each of the nine crusts gives its composed table, rock by rock", () => {
  for (const [key, names] of Object.entries(NAMES)) {
    const [silica, second] = key.split("/") as [SilicaClass, Second];
    const c = crust(silica, second);
    assert.equal(stonesKey(c), key);
    const table = stonesFor(c);
    assert.equal(Object.keys(table).length, IDS.length, key);
    for (const id of IDS) assert.equal(table[id]?.name, names[id], `${key}: ${id}`);
  }
});

test("the overrides apply in order: silica, then reduced, then carbon-rich", () => {
  // Reduced beats silica: where nothing rusts, high-silica shale is lydite, not novaculite.
  assert.equal(stonesFor(crust("high", "reduced")).shale?.name, "lydite");
  // Carbon-rich beats silica: basalt is moissanite whether its silica is high or low.
  assert.equal(stonesFor(crust("high", "carbon")).basalt?.name, "moissanite");
  assert.equal(stonesFor(crust("low", "carbon")).basalt?.name, "moissanite");
  // A carbon-rich crust is reduced too: its shale's chert is black, whatever its silica.
  assert.equal(stonesFor(crust("high", "carbon")).shale?.name, "lydite");
  assert.equal(stonesFor(crust("solar", "carbon")).shale?.name, "lydite");
});

test("a crust's table is made once and kept by its key", () => {
  const low = crust("low", "reduced");
  assert.equal(stonesFor({ ...low, feH: 0.3 }), stonesFor(low));
  assert.notEqual(stonesFor(crust("low", "oxidised")), stonesFor(low));
});

test("there are nine crusts: nine keys and nine tables", () => {
  const crusts = (["high", "solar", "low"] as const).flatMap((silica) =>
    (["oxidised", "reduced", "carbon"] as const).map((second) => crust(silica, second)),
  );
  assert.equal(new Set(crusts.map(stonesKey)).size, 9);
  assert.equal(new Set(crusts.map(stonesFor)).size, 9);
});

test("keenestIn reads the table it is given", () => {
  // Over STONES, flint takes the keener edge; over a silica-poor crust, fieldstone does not.
  assert.equal(keenestIn(STONES, ["limestone", "gneiss"]), "limestone");
  assert.equal(keenestIn(stonesFor(crust("low", "oxidised")), ["limestone", "gneiss"]), "gneiss");
});

test("keenestIn matches keenestRock over STONES for all 255 lands, in order and reversed", () => {
  assert.equal(IDS.length, 8);
  assert.equal(keenestRock(IDS), "andesite");
  assert.equal(keenestIn(STONES, IDS), "andesite");
  for (let mask = 1; mask < 256; mask++) {
    const rocks = IDS.filter((_, i) => ((mask >> i) & 1) === 1);
    assert.equal(keenestIn(STONES, rocks), keenestRock(rocks), `land ${mask}`);
    const reversed = rocks.slice().reverse();
    assert.equal(keenestIn(STONES, reversed), keenestRock(reversed), `land ${mask}, reversed`);
  }
});

test("the usual stone is the limestone's, in its crust", () => {
  assert.equal(usualStone(SOLAR), STONES.limestone);
  assert.equal(usualStone(crust("high", "reduced")).name, "flint");
  assert.equal(usualStone(crust("low", "oxidised")), FIELDSTONE);
  assert.equal(usualStone(crust("low", "carbon")), FIELDSTONE);
});
