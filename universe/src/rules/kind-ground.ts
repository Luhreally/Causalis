// The ground of each kind of world (Phase 56): what each of Earth's eight rocks is on it — the same
// places in its crust (a hotspot's lava, an old craton, the beds of old seas), each its kind's own
// rock — and its soil, the colour its people grind, the stone they knap, the ores they dig and the
// metals they work, and how. A carbon world's crust is carbide and graphite; a sulfur world's is
// Earth's rock crusted with sulfur, with gypsum where acid seas dried; an ice world's bedrock is
// water ice, its lava ammonia water frozen, its sand (on a methane world) the haze's tholin. Read by
// the crust's tables (chem-ground, chem-stones, chem-ores), which keep Earth's and Phase 54's as
// they were.
import type { Rock } from "./matter.ts";
import type { NovelKind } from "./kinds.ts";
import type { Edge, Ore, Rgb, Stone } from "./stuffs.ts";

/** A rock's form on a kind of world: what it is called, its parts, its words and its colour. */
export type KindForm = Pick<Rock, "name" | "parts" | "words" | "colour">;

const form = (
  name: string,
  parts: readonly (readonly [string, number])[],
  words: string,
  colour: Rgb,
): KindForm => ({ name, parts, words, colour });

// (The ice worlds' bedrock, lava and beds: its lava's flows, and the cones its cryovolcanoes raise
// where its plates meet.)
const CRYOLAVA = (tholin: number, cone = false): KindForm =>
  form(
    cone ? "cryovolcano ice" : "cryolava",
    tholin > 0
      ? [
          ["water-ice", 0.65],
          ["ammonia-hydrate", 0.3],
          ["tholin", tholin],
        ]
      : [
          ["water-ice", 0.62],
          ["ammonia-hydrate", 0.35],
          ["quartz", 0.03],
        ],
    cone
      ? "The cones of its cryovolcanoes, where ammonia water bursts out and freezes as it falls."
      : "Ammonia water that welled up from below and froze where it spread: an ice world's lava.",
    tholin > 0 ? [0.6, 0.62, 0.64] : [0.7, 0.76, 0.8],
  );

/** Each kind's form of each of Earth's rocks (a rock left out is Phase 54's, as its chemistry has it). */
export const KIND_ROCKS: Readonly<Record<NovelKind, Readonly<Record<string, KindForm>>>> = {
  carbon: {
    granite: form(
      "moissanite rock",
      [
        ["moissanite", 0.62],
        ["graphite", 0.2],
        ["quartz", 0.1],
        ["cohenite", 0.06],
        ["diamond", 0.02],
      ],
      "The roots of a carbon world's mountains: grey-green silicon carbide shot with graphite, where diamonds grow.",
      [0.34, 0.4, 0.38],
    ),
    basalt: form(
      "carbide lava",
      [
        ["moissanite", 0.45],
        ["graphite", 0.25],
        ["pyroxene", 0.2],
        ["cohenite", 0.1],
      ],
      "Black lava of carbide and graphite cooled fast: the floor of a carbon world's oil seas.",
      [0.12, 0.13, 0.13],
    ),
    andesite: form(
      "diamond lava",
      [
        ["moissanite", 0.4],
        ["graphite", 0.3],
        ["olivine", 0.25],
        ["diamond", 0.05],
      ],
      "The lava of its volcanoes where one plate goes down under another, bringing diamonds up from below.",
      [0.22, 0.24, 0.26],
    ),
    gneiss: form(
      "graphite gneiss",
      [
        ["graphite", 0.4],
        ["moissanite", 0.4],
        ["quartz", 0.2],
      ],
      "The oldest rock of a carbon world, banded silver with graphite by heat and weight.",
      [0.3, 0.3, 0.32],
    ),
    limestone: form(
      "pitch beds",
      [
        ["bitumen", 0.35],
        ["moissanite", 0.45],
        ["graphite", 0.2],
      ],
      "Black beds of pitch and grit where its oil seas dried, in place of Earth's limestone.",
      [0.1, 0.09, 0.08],
    ),
    sandstone: form(
      "carborundum sandstone",
      [
        ["moissanite", 0.85],
        ["graphite", 0.1],
        ["bitumen", 0.05],
      ],
      "Green-black sand of silicon carbide bound into stone.",
      [0.26, 0.32, 0.3],
    ),
    shale: form(
      "kerogen shale",
      [
        ["graphite", 0.4],
        ["bitumen", 0.3],
        ["moissanite", 0.3],
      ],
      "Old tar mud pressed to black layers, oily to the touch.",
      [0.14, 0.13, 0.13],
    ),
    "coal-measures": form(
      "graphite schist",
      [
        ["graphite", 0.7],
        ["moissanite", 0.3],
      ],
      "Buried oil and tar cooked into silvery graphite.",
      [0.2, 0.2, 0.22],
    ),
  },
  sulfur: {
    basalt: form(
      "sulfur lava",
      [
        ["plagioclase", 0.45],
        ["pyroxene", 0.33],
        ["sulphur", 0.12],
        ["pyrite", 0.06],
        ["olivine", 0.04],
      ],
      "Dark lava crusted yellow and red with the sulfur its vents pour out.",
      [0.36, 0.3, 0.14],
    ),
    andesite: form(
      "sulfur andesite",
      [
        ["plagioclase", 0.55],
        ["pyroxene", 0.25],
        ["sulphur", 0.1],
        ["pyrite", 0.05],
        ["quartz", 0.05],
      ],
      "The grey lava of its volcanoes, yellow with sulfur at every vent.",
      [0.62, 0.56, 0.36],
    ),
    limestone: form(
      "gypsum",
      [
        ["gypsum", 0.9],
        ["quartz", 0.05],
        ["kaolinite", 0.05],
      ],
      "White beds where acid seas dried: no limestone lasts in them, and no flint grows.",
      [0.92, 0.9, 0.84],
    ),
    shale: form(
      "pyrite shale",
      [
        ["kaolinite", 0.5],
        ["quartz", 0.25],
        ["pyrite", 0.15],
        ["feldspar", 0.1],
      ],
      "Old mud of acid seas pressed to dark layers glinting with pyrite.",
      [0.3, 0.29, 0.24],
    ),
  },
  ammonia: {
    granite: form(
      "water ice",
      [
        ["water-ice", 0.92],
        ["ammonia-hydrate", 0.05],
        ["quartz", 0.03],
      ],
      "The bedrock of an ice world: water ice as hard as rock in its cold, gritty with the rock far below.",
      [0.82, 0.88, 0.94],
    ),
    gneiss: form(
      "old ice",
      [
        ["water-ice", 0.95],
        ["quartz", 0.05],
      ],
      "Blue ice of the world's oldest ground, banded by weight over the ages.",
      [0.7, 0.8, 0.9],
    ),
    basalt: CRYOLAVA(0),
    andesite: CRYOLAVA(0, true),
    limestone: form(
      "ammonia ice beds",
      [
        ["ammonia-hydrate", 0.7],
        ["water-ice", 0.25],
        ["halite", 0.05],
      ],
      "Pale beds of ammonia ice where its seas froze and dried.",
      [0.88, 0.9, 0.9],
    ),
    sandstone: form(
      "ice grit",
      [
        ["water-ice", 0.7],
        ["quartz", 0.2],
        ["feldspar", 0.1],
      ],
      "Grit of rock and ice blown together and frozen hard.",
      [0.68, 0.7, 0.72],
    ),
    shale: form(
      "dirty ice",
      [
        ["water-ice", 0.6],
        ["kaolinite", 0.25],
        ["ammonia-hydrate", 0.15],
      ],
      "Ice with the mud of old seas frozen into it in grey bands.",
      [0.5, 0.54, 0.58],
    ),
    "coal-measures": form(
      "black ice",
      [
        ["water-ice", 0.6],
        ["humus", 0.25],
        ["ammonia-hydrate", 0.15],
      ],
      "Ice with the dead of old ages frozen into it, black with them.",
      [0.2, 0.22, 0.26],
    ),
  },
  methane: {
    granite: form(
      "water ice",
      [
        ["water-ice", 0.97],
        ["tholin", 0.03],
      ],
      "The bedrock of a methane world: water ice as hard as granite at −180 °C, stained with the haze's tar.",
      [0.74, 0.74, 0.72],
    ),
    gneiss: form(
      "old ice",
      [
        ["water-ice", 0.95],
        ["tholin", 0.05],
      ],
      "The oldest ice of its ground, banded by weight over the ages.",
      [0.66, 0.68, 0.7],
    ),
    basalt: CRYOLAVA(0.05),
    andesite: CRYOLAVA(0.05, true),
    limestone: form(
      "tholin beds",
      [
        ["tholin", 0.75],
        ["water-ice", 0.25],
      ],
      "Orange-brown beds of the haze's tar laid down in old seas.",
      [0.56, 0.36, 0.18],
    ),
    sandstone: form(
      "tholin sand",
      [
        ["tholin", 0.8],
        ["water-ice", 0.2],
      ],
      "Dunes of tholin grains blown into long ridges: a methane world's sand.",
      [0.62, 0.42, 0.2],
    ),
    shale: form(
      "tholin mud",
      [
        ["tholin", 0.6],
        ["water-ice", 0.4],
      ],
      "The haze's tar settled in old seas and pressed to dark layers.",
      [0.42, 0.3, 0.18],
    ),
    "coal-measures": form(
      "tholin tar",
      [
        ["tholin", 0.9],
        ["water-ice", 0.1],
      ],
      "The tar of old ages' haze buried deep and thick.",
      [0.28, 0.18, 0.1],
    ),
  },
};

/** A soil: what it is called, and what it is made of. */
type KindSoil = { readonly name: string; readonly parts: readonly (readonly [string, number])[] };

/**
 * Each kind's soils: one over every land; its frozen sea's, where its liquid freezes over the rock
 * (a sulfur world's is Earth's ice, its acid freezing out as water); and its sea floor's.
 */
export const KIND_SOILS: Readonly<
  Record<
    NovelKind,
    { readonly land: KindSoil; readonly ice: KindSoil | null; readonly sea: KindSoil }
  >
> = {
  carbon: {
    land: {
      name: "a black, tarry earth",
      parts: [
        ["moissanite", 0.35],
        ["graphite", 0.25],
        ["bitumen", 0.2],
        ["humus", 0.12],
        ["crude", 0.08],
      ],
    },
    // (A crude's waxes set where it freezes.)
    ice: {
      name: "wax over the rock",
      parts: [
        ["crude", 0.8],
        ["bitumen", 0.2],
      ],
    },
    sea: {
      name: "sea-floor tar",
      parts: [
        ["bitumen", 0.45],
        ["moissanite", 0.3],
        ["graphite", 0.15],
        ["crude", 0.1],
      ],
    },
  },
  sulfur: {
    land: {
      name: "a sour yellow earth",
      parts: [
        ["quartz", 0.38],
        ["kaolinite", 0.2],
        ["gypsum", 0.15],
        ["sulphur", 0.1],
        ["humus", 0.12],
        ["acid-water", 0.05],
      ],
    },
    ice: null,
    // (No lime settles in an acid sea: its calcium lies as gypsum.)
    sea: {
      name: "sour sea-floor mud",
      parts: [
        ["kaolinite", 0.45],
        ["gypsum", 0.2],
        ["acid-water", 0.2],
        ["quartz", 0.1],
        ["sulphur", 0.05],
      ],
    },
  },
  ammonia: {
    land: {
      name: "a frozen grit",
      parts: [
        ["water-ice", 0.5],
        ["quartz", 0.2],
        ["ammonia-hydrate", 0.15],
        ["humus", 0.1],
        ["kaolinite", 0.05],
      ],
    },
    ice: {
      name: "ice over the rock",
      parts: [
        ["water-ice", 0.7],
        ["ammonia-hydrate", 0.3],
      ],
    },
    // (Water ice sinks in ammonia water, lighter than water: its sea floor is ice and grit.)
    sea: {
      name: "sea-floor slush",
      parts: [
        ["water-ice", 0.45],
        ["ammonia-water", 0.25],
        ["ammonia-hydrate", 0.2],
        ["quartz", 0.1],
      ],
    },
  },
  methane: {
    land: {
      name: "tholin sand",
      parts: [
        ["tholin", 0.7],
        ["water-ice", 0.2],
        ["humus", 0.1],
      ],
    },
    ice: {
      name: "frozen methane over the ice",
      parts: [
        ["methane", 0.7],
        ["water-ice", 0.3],
      ],
    },
    sea: {
      name: "tholin ooze",
      parts: [
        ["tholin", 0.6],
        ["water-ice", 0.3],
        ["methane", 0.1],
      ],
    },
  },
};

/** A pigment: its name and its colour. */
type Pigment = { readonly name: string; readonly colour: Rgb };

/** The colour a kind's people grind, by rock (a rock left out: Earth's own, or Phase 54's). */
export const KIND_PIGMENTS: Readonly<Record<NovelKind, Readonly<Record<string, Pigment>>>> =
  (() => {
    const all = (p: Pigment): Readonly<Record<string, Pigment>> =>
      Object.fromEntries(
        [
          "granite",
          "basalt",
          "andesite",
          "gneiss",
          "limestone",
          "sandstone",
          "shale",
          "coal-measures",
        ].map((r) => [r, p]),
      );
    return {
      carbon: all({ name: "graphite", colour: [0.18, 0.18, 0.2] }),
      sulfur: {
        basalt: { name: "sulfur yellow", colour: [0.92, 0.82, 0.2] },
        andesite: { name: "sulfur yellow", colour: [0.92, 0.82, 0.2] },
        limestone: { name: "gypsum white", colour: [0.94, 0.92, 0.88] },
      },
      ammonia: all({ name: "grey rock flour", colour: [0.55, 0.55, 0.57] }),
      methane: all({ name: "tholin orange", colour: [0.72, 0.42, 0.16] }),
    };
  })();

/**
 * How a stone is worked, where it is not knapped as flint is: moissanite's edge ground with diamond;
 * ice edged with the ammonia water that melts it, as salt does; ice at −180 °C, brittle as glass.
 */
const GROUND = "Knapped like flint, its edge ground keen with diamond grit, and hafted",
  ICE_EDGED =
    "Split from the ice and edged by wetting it with ammonia water, which melts ice as salt does, letting it freeze sharp, and hafted",
  ICE_KNAPPED =
    "Knapped as flint is (at −180 °C ice breaks with a shell-like edge, as glass does), and hafted";

const stone = (
  name: string,
  from: string,
  edge: Edge,
  colour: Rgb,
  subst: string,
  worked: string,
): Stone => ({ name, from, ...edge, colour, subst, worked });

const MOISSANITE = (from: string, keen: number): Stone =>
    stone("moissanite", from, { keen, tough: 0.4 }, [0.18, 0.3, 0.26], "moissanite", GROUND),
  ICE = (from: string, keen: number, tough: number, worked: string): Stone =>
    stone("ice", from, { keen, tough }, [0.82, 0.9, 0.98], "water-ice", worked),
  LAVA_ICE = (keen: number, worked: string): Stone =>
    stone(
      "lava ice",
      "the glassy cryolava of its springs",
      { keen, tough: 0.25 },
      [0.7, 0.78, 0.84],
      "ammonia-hydrate",
      worked,
    );

/**
 * The stone a kind's people knap (or cut) where its land's rock is each rock. A carbon world's
 * moissanite (silicon carbide, Mohs 9.25: it breaks with a shell-like fracture, as flint does) and its
 * diamonds; an ice world's ice, about Mohs 6 at −78 °C and as hard as granite at −180 °C. A sulfur
 * world's is Phase 54's, but for its gypsum, which gives no flint.
 */
export const KIND_STONES: Readonly<Record<NovelKind, Readonly<Record<string, Stone>>>> = {
  carbon: {
    granite: MOISSANITE("green-black crystals of the carbide rock", 0.94),
    basalt: MOISSANITE("carbide grains of the black lava", 0.9),
    andesite: stone(
      "diamond",
      "diamonds of its volcanoes' pipes",
      { keen: 1, tough: 0.45 },
      [0.88, 0.9, 0.94],
      "diamond",
      "Set as a row of diamond points in pitch along a haft",
    ),
    gneiss: MOISSANITE("carbide bands of the old graphite gneiss", 0.9),
    limestone: MOISSANITE("carborundum pebbles out of the pitch beds", 0.86),
    sandstone: MOISSANITE("carborundum cobbles of the sandstone", 0.88),
    shale: MOISSANITE("carborundum nodules of the black shale", 0.86),
    "coal-measures": MOISSANITE("carbide bands in the graphite", 0.86),
  },
  sulfur: {
    limestone: {
      name: "fieldstone",
      from: "whatever hard cobble the fields turn up, since the gypsum beds give no flint",
      keen: 0.35,
      tough: 0.8,
      colour: [0.55, 0.53, 0.5],
      subst: null,
    },
  },
  ammonia: {
    granite: ICE("the clear ice of the bedrock", 0.55, 0.35, ICE_EDGED),
    gneiss: ICE("the blue ice of the old ground", 0.58, 0.35, ICE_EDGED),
    basalt: LAVA_ICE(0.6, ICE_EDGED),
    andesite: LAVA_ICE(0.6, ICE_EDGED),
    limestone: ICE("the ice under the ammonia beds", 0.5, 0.3, ICE_EDGED),
    sandstone: ICE("clear ice below the grit", 0.52, 0.35, ICE_EDGED),
    shale: ICE("the clearer bands of the dirty ice", 0.5, 0.32, ICE_EDGED),
    "coal-measures": ICE("the clearer bands of the black ice", 0.5, 0.32, ICE_EDGED),
  },
  methane: {
    granite: ICE("the bedrock ice, as hard as granite in the cold", 0.7, 0.4, ICE_KNAPPED),
    gneiss: ICE("the old ice of its hills", 0.72, 0.4, ICE_KNAPPED),
    basalt: LAVA_ICE(0.66, ICE_KNAPPED),
    andesite: LAVA_ICE(0.66, ICE_KNAPPED),
    limestone: ICE("ice dug from under the tholin beds", 0.66, 0.38, ICE_KNAPPED),
    sandstone: ICE("ice dug from under the dunes", 0.66, 0.38, ICE_KNAPPED),
    shale: ICE("ice dug from under the tholin mud", 0.64, 0.38, ICE_KNAPPED),
    "coal-measures": ICE("ice dug from under the tar", 0.64, 0.38, ICE_KNAPPED),
  },
};

/** How an ore is worked where it is not smelted: what is done, and where, and why. */
const COLD = {
  how: "hammered cold",
  at: "on an anvil stone, never heated: nothing burns in its air",
} as const;

/**
 * A carbon world's ores (none smelted: nothing burns). Its copper lies native, unrusted, in its old
 * lavas' veins (as at Keweenaw) and where old mountains are worn open, beaten into shape cold; its
 * iron lies as carbide, whose carbon only made oxygen can burn out. A sulfur world's copper shows
 * as blue vitriol where acid springs ran over its ore, and an open fire reduces it. An ice world's
 * ores lie under its ice, out of reach (its one metal falls from its sky: KIND_METALS' star iron).
 */
export const KIND_ORES: Readonly<
  Record<"carbon" | "sulfur", Readonly<Record<string, Partial<Record<string, Ore>>>>>
> = {
  carbon: {
    copper: {
      deposit: {
        mineral: "native-copper",
        name: "native copper",
        words: "native copper in the veins of the old lavas, never rusted",
        smelt: "cold-hammer-copper",
        grade: 1,
        worked: COLD,
      },
      surface: {
        mineral: "native-copper",
        name: "native copper",
        words: "native copper lying free where old mountains are worn open",
        smelt: "cold-hammer-copper",
        grade: 1,
        worked: COLD,
      },
    },
    iron: {
      deposit: {
        mineral: "cohenite",
        name: "carbide iron",
        words: "lumps of iron carbide in the carbide lava, never rusted",
        smelt: "oxygen-steel",
        grade: 1,
        worked: {
          how: "ground keen with diamond grit",
          at: "never forged: only oxygen made by current can burn its carbon out",
          by: "carbide-blades",
        },
      },
    },
  },
  sulfur: {
    copper: {
      surface: {
        mineral: "blue-vitriol",
        name: "blue vitriol",
        words: "blue crusts of vitriol where acid springs ran over copper ore",
        smelt: "reduce-vitriol",
        grade: 1,
      },
    },
  },
};

/**
 * The metals the kinds work, with exactly METALS' fields: a carbon world's copper and carbide iron,
 * and an ice world's iron fallen from the sky (hammered on an ammonia world; in a methane world's
 * cold too brittle to be anything but broken).
 */
export const KIND_METALS: Readonly<
  Record<
    "cold copper" | "carbide iron" | "star iron" | "brittle star iron",
    Edge & { readonly hand: string; readonly works: string; readonly colour: Rgb }
  >
> = {
  // (Native copper work-hardens as it is beaten, a little keener than cast copper.)
  "cold copper": {
    keen: 0.54,
    tough: 0.6,
    hand: "beaten cold from native copper and never heated",
    works: "pressed cold at the works",
    colour: [0.8, 0.5, 0.28],
  },
  // (Iron carbide, Fe₃C, is hard and brittle: white iron's.)
  "carbide iron": {
    keen: 0.86,
    tough: 0.35,
    hand: "ground keen from a lump of carbide iron with diamond grit, never forged",
    works: "ground at the works",
    colour: [0.4, 0.4, 0.43],
  },
  // (Meteoric iron, iron with a little nickel, hammered cold as the Cape York iron was; its nickel
  // keeps it tough in an ammonia world's cold. Too little of it for a people's blades: set in engines
  // and drawn to wire.)
  "star iron": {
    keen: 0.62,
    tough: 0.6,
    hand: "hammered cold from iron fallen from the sky, never heated",
    works: "drawn into wire at the works",
    colour: [0.58, 0.58, 0.62],
  },
  // (The same iron at −180 °C, below where iron turns brittle: it breaks as glass does and is never
  // hammered. Ground to grit, its nickel is the catalyst acetylene and hydrogen join on (Sabatier's);
  // whole, it is a magnet, as tetrataenite, the meteorites' iron and nickel, is.)
  "brittle star iron": {
    keen: 0.6,
    tough: 0.1,
    hand: "broken from iron fallen from the sky, never hammered: in its cold it breaks as glass does",
    works: "ground to grit for the engines' catalyst, and set whole as the dynamos' magnets",
    colour: [0.58, 0.58, 0.62],
  },
};

/** The kinds' own reactions each kind's world knows (beside Earth's and its chemistry's). */
export const KIND_REACTION_IDS: Readonly<Record<NovelKind, readonly string[]>> = {
  carbon: ["cold-hammer-copper", "pitch-grit", "made-oxygen", "oxygen-steel"],
  sulfur: ["reduce-vitriol", "sulfur-concrete"],
  ammonia: ["freeze-ice"],
  methane: [
    "freeze-ice",
    "haze-tholin",
    "haze-acetylene",
    "acetylene-hydrogen",
    "polymerise-acetylene",
  ],
};

/**
 * A kind's own gases in its air, by volume, beside Earth's nitrogen, argon and carbon dioxide (its
 * nitrogen makes up the rest): a carbon world's carbon monoxide; a sulfur world's volcanoes' sulfur
 * dioxide; an ammonia world's ammonia; a methane world's methane, some 5% as at Titan's ground, and
 * the hydrogen its haze leaves.
 */
export const KIND_GASES: Readonly<Record<NovelKind, readonly (readonly [string, number])[]>> = {
  carbon: [
    ["carbon-monoxide", 0.1],
    ["methane", 0.02],
  ],
  sulfur: [["so2", 0.0005]],
  ammonia: [["ammonia", 0.02]],
  methane: [
    ["methane", 0.05],
    ["hydrogen", 0.001],
  ],
};

/** The substances a kind's air and liquid are made of (its pages list them among its own). */
export const KIND_AIR: Readonly<Record<NovelKind, readonly string[]>> = {
  carbon: ["carbon-monoxide", "methane", "crude", "bitumen", "diamond"],
  sulfur: ["so2", "acid-water", "sulphur", "gypsum"],
  ammonia: ["ammonia", "ammonia-water", "water-ice"],
  methane: ["methane", "ethane", "acetylene", "hydrogen", "tholin", "water-ice"],
};
