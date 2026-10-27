// The ground of a world whose crust is not Earth's (Phase 54 M221): its rocks, soils, pigments and
// clays. Earth's crust gets Earth's own tables, the same objects. Any other crust lays its changes
// over Earth's rock in order: silica, then reduced, then carbon-rich.
import type { Chemistry, SilicaClass } from "./chemistry.ts";
import { KIND_PIGMENTS, KIND_ROCKS, KIND_SOILS } from "./kind-ground.ts";
import { ROCKS, SOILS, type Rock } from "./matter.ts";
import type { Rgb } from "./stuffs.ts";

type Parts = Rock["parts"];
/** A soil: its name and its parts, by weight. */
type Soil = { readonly name: string; readonly parts: Parts };
/** A pigment: its name and its colour. */
type Pigment = { readonly name: string; readonly colour: Rgb };
/** A rock's form in a crust: what it is called, its parts, its words and its colour. */
type Form = Pick<Rock, "name" | "parts" | "words" | "colour">;

/** Where the crust is poor in silica: each Earth rock's dark, magnesium-rich form. */
const SILICA_LOW: Readonly<Record<string, Form>> = {
  granite: {
    name: "tonalite",
    parts: [
      ["plagioclase", 0.6],
      ["quartz", 0.15],
      ["pyroxene", 0.15],
      ["mica", 0.1],
    ],
    words:
      "The roots of old mountains on a magnesium-rich world: grey, poor in quartz, with no pink feldspar.",
    colour: [0.62, 0.62, 0.6],
  },
  basalt: {
    name: "picrite",
    parts: [
      ["olivine", 0.35],
      ["pyroxene", 0.35],
      ["plagioclase", 0.26],
      ["magnetite", 0.04],
    ],
    words:
      "Green-black lava crowded with olivine: the floor of its oceans, and of the lands a hotspot flooded.",
    colour: [0.2, 0.24, 0.2],
  },
  andesite: {
    name: "basaltic andesite",
    parts: [
      ["plagioclase", 0.5],
      ["pyroxene", 0.35],
      ["olivine", 0.08],
      ["magnetite", 0.05],
      ["quartz", 0.02],
    ],
    words:
      "The dark lava of its volcanoes where one plate goes down under another, too poor in silica to be grey.",
    colour: [0.3, 0.3, 0.32],
  },
  gneiss: {
    name: "amphibolite",
    parts: [
      ["pyroxene", 0.5],
      ["plagioclase", 0.4],
      ["magnetite", 0.05],
      ["quartz", 0.05],
    ],
    words: "Old dark lava banded by heat and weight: the oldest rock of its continents' hearts.",
    colour: [0.25, 0.27, 0.25],
  },
  limestone: {
    name: "dolostone",
    parts: [
      ["dolomite", 0.9],
      ["quartz", 0.05],
      ["kaolinite", 0.05],
    ],
    words:
      "The shells of warm shallow seas turned to stone, rich in magnesium: no flint grows in it.",
    colour: [0.86, 0.84, 0.78],
  },
  sandstone: {
    name: "greywacke",
    parts: [
      ["quartz", 0.45],
      ["plagioclase", 0.25],
      ["kaolinite", 0.15],
      ["pyroxene", 0.1],
      ["magnetite", 0.05],
    ],
    words: "Gritty grey sand of worn lavas bound hard: the sandstone of a world short of quartz.",
    colour: [0.42, 0.43, 0.42],
  },
};

/** Where the crust is rich in silica: each Earth rock's pale, quartz-rich form. */
const SILICA_HIGH: Readonly<Record<string, Form>> = {
  andesite: {
    name: "dacite",
    parts: [
      ["plagioclase", 0.45],
      ["quartz", 0.25],
      ["feldspar", 0.15],
      ["mica", 0.1],
      ["magnetite", 0.05],
    ],
    words:
      "The pale lava of its volcanoes where one plate goes down under another, rich in silica.",
    colour: [0.66, 0.63, 0.62],
  },
  basalt: {
    name: "tholeiite",
    parts: [
      ["plagioclase", 0.52],
      ["pyroxene", 0.4],
      ["quartz", 0.04],
      ["magnetite", 0.04],
    ],
    words: "Dark lava with no olivine in it: the floor of the oceans of a world rich in silica.",
    colour: [0.24, 0.24, 0.26],
  },
  granite: {
    name: "leucogranite",
    parts: [
      ["feldspar", 0.6],
      ["quartz", 0.36],
      ["mica", 0.04],
    ],
    words: "Pale granite nearly all quartz and feldspar, where old mountains' roots melted again.",
    colour: [0.92, 0.86, 0.84],
  },
  sandstone: {
    name: "quartz arenite",
    parts: [
      ["quartz", 0.95],
      ["kaolinite", 0.03],
      ["hematite", 0.02],
    ],
    words: "Clean sand of quartz alone, bound into stone.",
    colour: [0.9, 0.86, 0.78],
  },
};

/** Where nothing rusts, shale is black shale. */
const BLACK_SHALE: Form = {
  name: "black shale",
  parts: [
    ["kaolinite", 0.52],
    ["quartz", 0.28],
    ["feldspar", 0.1],
    ["carbon", 0.06],
    ["pyrite", 0.04],
  ],
  words: "Old mud of seas where nothing rusts, pressed to black layers rich in carbon and pyrite.",
  colour: [0.12, 0.12, 0.14],
};

/** Sandstone still so named (its crust solar in silica) is grey where nothing rusts. */
const GREY_SANDSTONE: Pick<Form, "name" | "words" | "colour"> = {
  name: "grey sandstone",
  words: "Old sand bound into stone, grey: nothing in it has rusted red.",
  colour: [0.6, 0.6, 0.58],
};

/** Coal measures cooked where carbon is rich. */
const GRAPHITE_SCHIST: Form = {
  name: "graphite schist",
  parts: [
    ["quartz", 0.4],
    ["kaolinite", 0.25],
    ["graphite", 0.25],
    ["pyrite", 0.05],
    ["feldspar", 0.05],
  ],
  words: "Coal measures cooked into silvery graphite schist on a world rich in carbon.",
  colour: [0.2, 0.2, 0.22],
};

/** The words a basalt gains where its magnetite is carbide. */
const CARBIDE_WORDS = " Grains of carbide glint in it.";

/**
 * A reduced soil's new name, by its key; the others keep theirs. (Ferrous iron gives the gley
 * colours.)
 */
const REDUCED_SOIL_NAMES: Readonly<Record<string, string>> = {
  temperateForest: "a grey forest earth",
  hotDesert: "grey desert sand",
  savanna: "a grey savanna soil",
  tropicalDryForest: "a grey-green earth",
  tropicalRainforest: "a leached grey clay (gley)",
};

const GREEN_EARTH: Pigment = { name: "green earth", colour: [0.42, 0.5, 0.36] };
const GRAPHITE: Pigment = { name: "graphite", colour: [0.18, 0.18, 0.2] };

/**
 * Where nothing rusts, the ferrous clays (celadonite, glauconite) are the green earths: without
 * free oxygen there are no ochres. A rock not listed grinds green earth.
 */
const REDUCED_PIGMENTS = new Map<string, Pigment | null>([
  ["sandstone", GREEN_EARTH],
  ["granite", { name: "green earth", colour: [0.45, 0.52, 0.4] }],
  ["gneiss", { name: "green earth", colour: [0.44, 0.5, 0.4] }],
  ["basalt", { name: "green earth", colour: [0.36, 0.44, 0.32] }],
  ["andesite", { name: "green earth", colour: [0.4, 0.48, 0.38] }],
  ["shale", { name: "black earth", colour: [0.12, 0.12, 0.13] }],
  ["limestone", { name: "white earth", colour: [0.9, 0.89, 0.84] }],
  // (Coal measures keep Earth's own black earth.)
  ["coal-measures", null],
]);

/**
 * A crust is reduced where nothing rusts: its air thin, or its carbon rich. A carbon-rich crust is
 * reduced too.
 */
function isReduced(chem: Chemistry): boolean {
  return chem.redox === "reduced" || chem.carbon === "carbon-rich";
}

/**
 * A part swapped for another at the same share. Where the other is already a part, the two shares
 * add into one part, in the first one's place. A list without the part comes back as it was.
 */
function swapPart(parts: Parts, from: string, to: string): Parts {
  if (!parts.some(([id]) => id === from)) return parts;
  const out: [string, number][] = [];
  for (const [id, share] of parts) {
    const name = id === from ? to : id,
      at = out.findIndex(([x]) => x === name),
      held = out[at];
    if (held === undefined) out.push([name, share]);
    else out[at] = [name, held[1] + share];
  }
  return out;
}

/** The silica pass: a rock's low or high form, if its crust is poor or rich in silica. */
function silicaPass(rock: Rock, silica: SilicaClass): Rock {
  const table = silica === "low" ? SILICA_LOW : silica === "high" ? SILICA_HIGH : null,
    form = table?.[rock.id];
  return form === undefined ? rock : { ...rock, ...form };
}

/** The reduced pass: hematite becomes magnetite, shale black shale, and sandstone grey. */
function reducedPass(rock: Rock): Rock {
  if (rock.id === "shale") return { ...rock, ...BLACK_SHALE };
  const parts = swapPart(rock.parts, "hematite", "magnetite");
  if (rock.name !== "sandstone") return parts === rock.parts ? rock : { ...rock, parts };
  return { ...rock, ...GREY_SANDSTONE, parts };
}

/** Carbon-rich: coal measures become graphite schist; a basalt's magnetite becomes moissanite. */
function carbonPass(rock: Rock): Rock {
  if (rock.id === "coal-measures") return { ...rock, ...GRAPHITE_SCHIST };
  if (rock.id !== "basalt") return rock;
  const parts = swapPart(rock.parts, "magnetite", "moissanite");
  return parts === rock.parts ? rock : { ...rock, parts, words: rock.words + CARBIDE_WORDS };
}

/**
 * Earth's rock in one crust: the silica pass, then the reduced, then the carbon-rich; then a kind's
 * own form of it, where its kind has one (Phase 56).
 */
function crustRock(chem: Chemistry, earth: Rock): Rock {
  const silica = silicaPass(earth, chem.silica),
    reduced = isReduced(chem) ? reducedPass(silica) : silica,
    rock = chem.carbon === "carbon-rich" ? carbonPass(reduced) : reduced,
    form = chem.kind ? KIND_ROCKS[chem.kind][earth.id] : undefined;
  return form ? { ...rock, ...form } : rock;
}

/** A soil in a reduced crust: hematite as magnetite, and its new name where the table gives one. */
function reducedSoil(key: string, earth: Soil): Soil {
  const name = REDUCED_SOIL_NAMES[key],
    parts = swapPart(earth.parts, "hematite", "magnetite");
  return name === undefined && parts === earth.parts ? earth : { name: name ?? earth.name, parts };
}

/**
 * A crust as the three things its rock reads: its silica, whether it is reduced, and its carbon.
 * chemistryKey leaves out redox, so two chemistries that differ only in it would share a rock.
 */
function crustKey(chem: Chemistry): string {
  const crust = `${chem.silica}/${isReduced(chem) ? "reduced" : "oxidised"}/${chem.carbon}`;
  return chem.kind ? `${chem.kind}:${crust}` : crust;
}

/** Each crust's rock, made once and kept by its key and its id. */
const rockMemo = new Map<string, Rock>();
/** Each crust's rocks, in ROCKS order, made once. */
const rocksMemo = new Map<string, readonly Rock[]>();
/** Each reduced soil, made once by its key. */
const soilMemo = new Map<string, Soil>();

/** Earth's rock `id` in a crust: the ROCKS entry itself where no change applies. */
export function worldRock(chem: Chemistry, id: string): Rock {
  const key = `${crustKey(chem)}/${id}`;
  let rock = rockMemo.get(key);
  if (rock === undefined) {
    const earth = ROCKS.find((r) => r.id === id);
    if (earth === undefined) throw new Error(`no rock ${id}`);
    rock = crustRock(chem, earth);
    rockMemo.set(key, rock);
  }
  return rock;
}

/** A crust's rocks in ROCKS order: ROCKS itself where no rock changes. */
export function worldRocks(chem: Chemistry): readonly Rock[] {
  const key = crustKey(chem);
  let rocks = rocksMemo.get(key);
  if (rocks === undefined) {
    const made = ROCKS.map((r) => worldRock(chem, r.id));
    rocks = made.every((rock, i) => rock === ROCKS[i]) ? ROCKS : made;
    rocksMemo.set(key, rocks);
  }
  return rocks;
}

/** A soil in a crust: SOILS' own entry, unless the crust is reduced; a kind's own (Phase 56). */
export function worldSoil(chem: Chemistry, key: string): Soil {
  const earth = SOILS[key];
  if (earth === undefined) throw new Error(`no soil ${key}`);
  if (chem.kind) {
    const own = KIND_SOILS[chem.kind];
    return key === "sea" ? own.sea : key === "ice" ? (own.ice ?? earth) : own.land;
  }
  if (!isReduced(chem)) return earth;
  let soil = soilMemo.get(key);
  if (soil === undefined) {
    soil = reducedSoil(key, earth);
    soilMemo.set(key, soil);
  }
  return soil;
}

/**
 * A rock's pigment in a crust: null where Earth's own applies (an oxidised world, and Earth's coal
 * measures). A carbon-rich crust's shale and coal measures grind graphite.
 */
export function pigmentOverride(chem: Chemistry, rock: string): Pigment | null {
  // (A kind's own, where it grinds one of the rock: Phase 56.)
  const own = chem.kind ? KIND_PIGMENTS[chem.kind][rock] : undefined;
  if (own) return own;
  if (chem.carbon === "carbon-rich" && (rock === "shale" || rock === "coal-measures"))
    return GRAPHITE;
  if (!isReduced(chem)) return null;
  return REDUCED_PIGMENTS.has(rock) ? (REDUCED_PIGMENTS.get(rock) ?? null) : GREEN_EARTH;
}

/**
 * The clay of a reduced crust: iron fired in an oxygen-poor kiln stays FeO or Fe3O4, so it fires
 * black or grey. Lime fires buff, as Earth's does. Null is Earth's own clay.
 */
export function clayOverride(chem: Chemistry, iron: number, lime: number): "grey" | "black" | null {
  if (!isReduced(chem)) return null;
  if (iron >= 0.06) return "black";
  if (lime >= 0.05) return null;
  return iron >= 0.02 ? "grey" : null;
}

/** The two clays a reduced crust fires: each one's name, ware, and colours raw and fired. */
export const CLAYS_REDUCED: Readonly<
  Record<"grey" | "black", { name: string; ware: string; raw: Rgb; fired: Rgb }>
> = {
  grey: {
    name: "grey clay",
    ware: "grey ware",
    raw: [0.45, 0.45, 0.43],
    fired: [0.42, 0.42, 0.43],
  },
  black: {
    name: "dark clay",
    ware: "black burnished ware",
    raw: [0.3, 0.3, 0.29],
    fired: [0.16, 0.16, 0.17],
  },
};
