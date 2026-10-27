// What things are made of, as a people names and works it (Phase 50 M212, asked for 2026-10-25:
// "mean crafting as the backbone of the whole game, not a tribal feature ... every made thing, at
// every age, is made by someone from what's actually around them, so the land decides what a
// people can make. Over the eras only the method changes, from knapping to the forge, the foundry
// and the factory. The chain from ground to object stays the same, you can see it, and you can tap
// through it"): the stones that take an edge, by the rock they come out of; the ores, by how they
// lie in the ground; how keen and how tough each metal is; how each is worked by hand and at the
// works; and a thing's quality from its stuff and its making — Classic's tool, whose quality came
// from its head's hardness and brittleness and its maker's skill. Pure data and arithmetic, read by
// the host's chain (host/chain.ts), never by the simulation.
import { dmath } from "../kernel/index.ts";

export type Rgb = readonly [number, number, number];

/** How keen an edge a stuff takes, and how well it bears a blow (0 … 1 each). */
export type Edge = { readonly keen: number; readonly tough: number };

/** A stone knapped to an edge: where it is found, its edge, its colour, the substance it is. */
export type Stone = Edge & {
  readonly name: string;
  readonly from: string;
  readonly colour: Rgb;
  /** Its substance's id (null: a rock, not one substance). */
  readonly subst: string | null;
  /** How it is worked, where it is not knapped and hafted as flint is (Phase 56: ice edged by melting). */
  readonly worked?: string;
};

/**
 * The stone knapped where a land's bedrock is a rock: flint from the chalk, chert from the shale,
 * the glass of old lava, quartzite from the sandstone's cobbles — by the rock's id.
 */
export const STONES: Readonly<Record<string, Stone>> = {
  limestone: {
    name: "flint",
    from: "nodules weathered out of the chalk",
    keen: 0.88,
    tough: 0.55,
    colour: [0.36, 0.33, 0.3],
    subst: "flint",
  },
  shale: {
    name: "chert",
    from: "black beds among the shale",
    keen: 0.8,
    tough: 0.6,
    colour: [0.2, 0.2, 0.23],
    subst: "chert",
  },
  "coal-measures": {
    name: "chert",
    from: "bands in the coal country's shale",
    keen: 0.8,
    tough: 0.6,
    colour: [0.22, 0.21, 0.22],
    subst: "chert",
  },
  andesite: {
    name: "obsidian",
    from: "the black glass of old lava flows",
    keen: 1,
    tough: 0.2,
    colour: [0.06, 0.06, 0.09],
    subst: "obsidian",
  },
  basalt: {
    name: "basalt",
    from: "the fine dark lava, flaked coarse and ground to an edge",
    keen: 0.45,
    tough: 0.9,
    colour: [0.2, 0.2, 0.22],
    subst: null,
  },
  sandstone: {
    name: "quartzite",
    from: "cobbles washed out of the hard sandstone",
    keen: 0.55,
    tough: 0.85,
    colour: [0.82, 0.78, 0.7],
    subst: "quartz",
  },
  granite: {
    name: "quartz",
    from: "the white veins of the granite",
    keen: 0.5,
    tough: 0.4,
    colour: [0.9, 0.9, 0.88],
    subst: "quartz",
  },
  gneiss: {
    name: "quartzite",
    from: "hard beds in the old worn hills",
    keen: 0.55,
    tough: 0.85,
    colour: [0.78, 0.76, 0.72],
    subst: "quartz",
  },
};

/** Of a land's rocks, the one whose stone takes the keenest edge (the first of them, if none does). */
export function keenestRock(rocks: readonly string[]): string {
  return rocks.reduce((best, rock) =>
    (STONES[rock]?.keen ?? 0) > (STONES[best]?.keen ?? 0) ? rock : best,
  );
}

/**
 * How an ore lies: in one of the world's deposits; showing at the surface (copper where old
 * mountains are worn open, tin out of worn granite); bog ore in wet lowlands, ironstone in hills;
 * crusted on the sea floor's hot springs; native iron in basalt that flowed through buried coal, on a
 * world where nothing rusts (Phase 54).
 */
export type OreLie = "deposit" | "surface" | "bog" | "hill" | "vent" | "telluric";

/**
 * An ore as it lies: its mineral (a substance), its name, its words, the reaction it is smelted by,
 * and what a smelter's year yields from it against the best (Phase 52 M216: bog ore is lean and
 * full of water, the hills' ironstone a little leaner than an ancient craton's banded ore).
 */
export type Ore = {
  readonly mineral: string;
  readonly name: string;
  readonly words: string;
  readonly smelt: string;
  readonly grade: number;
  /**
   * How it is worked where it is not smelted (Phase 56: a carbon world's native copper, hammered
   * cold): what is done to it, and where and why; the principle that teaches it, where no reaction
   * tells it (grinding is no reaction).
   */
  readonly worked?: { readonly how: string; readonly at: string; readonly by?: string };
};

export const ORES: Readonly<Record<string, Partial<Record<OreLie, Ore>>>> = {
  copper: {
    deposit: {
      mineral: "chalcopyrite",
      name: "copper ore",
      words: "brassy copper ore of the deep veins",
      smelt: "roast-chalcopyrite",
      grade: 1,
    },
    surface: {
      mineral: "malachite",
      name: "malachite",
      words: "green malachite and native copper where old mountains are worn open",
      smelt: "smelt-malachite",
      grade: 1,
    },
    vent: {
      mineral: "chalcopyrite",
      name: "vent copper",
      words: "copper ore crusted on the chimneys of the sea floor's hot springs",
      smelt: "roast-chalcopyrite",
      grade: 1,
    },
  },
  tin: {
    deposit: {
      mineral: "cassiterite",
      name: "tin stone",
      words: "black tin stone in the veins of old granites",
      smelt: "smelt-cassiterite",
      grade: 1,
    },
    surface: {
      mineral: "cassiterite",
      name: "stream tin",
      words: "black stream tin washed out of worn granite",
      smelt: "smelt-cassiterite",
      grade: 1,
    },
  },
  iron: {
    deposit: {
      mineral: "hematite",
      name: "iron ore",
      words: "the banded red ore of an ancient craton",
      smelt: "bloomery",
      grade: 1,
    },
    bog: {
      mineral: "limonite",
      name: "bog ore",
      words: "bog ore, rusted out of the ground water in marsh and lake bed",
      smelt: "bog-bloomery",
      grade: 0.7,
    },
    hill: {
      mineral: "hematite",
      name: "ironstone",
      words: "red ironstone of the hills",
      smelt: "bloomery",
      grade: 0.9,
    },
  },
};

/** The metals things are made of, as the designs name them. */
export type Metal = "copper" | "bronze" | "iron" | "steel";

/**
 * Each metal's edge (bog iron's beside iron's: softer, uneven); how it is worked by hand and at
 * the works; its colour. Only the method changes over the ages: the copper-smith's hearth, the
 * bronze-caster's mould, the smith's forge; the foundry and the works.
 */
export const METALS: Readonly<
  Record<
    Metal | "bog iron",
    Edge & { readonly hand: string; readonly works: string; readonly colour: Rgb }
  >
> = {
  copper: {
    keen: 0.5,
    tough: 0.6,
    hand: "cast and hammered hard",
    works: "cast at the works",
    colour: [0.78, 0.45, 0.22],
  },
  bronze: {
    keen: 0.7,
    tough: 0.7,
    hand: "cast in a mould, its edge hammered keen",
    works: "cast at the foundry",
    colour: [0.8, 0.56, 0.26],
  },
  "bog iron": {
    keen: 0.68,
    tough: 0.55,
    hand: "forged from the bloom, folded to drive its slag out",
    works: "rolled at the works",
    colour: [0.5, 0.48, 0.47],
  },
  iron: {
    keen: 0.8,
    tough: 0.65,
    hand: "forged from the bloom",
    works: "rolled at the works",
    colour: [0.55, 0.55, 0.58],
  },
  steel: {
    keen: 1,
    tough: 0.85,
    hand: "forged, quenched and tempered",
    works: "rolled and machined at the works",
    colour: [0.64, 0.66, 0.7],
  },
};

/**
 * A thing's quality (0 … 100), as Classic reckoned a tool's: most of it from its stuff — how keen
 * an edge it takes, how well it bears a blow — then its land's craft at the work (what it knows,
 * 0 … 1) and its maker's years at it (the first dozen telling most).
 */
export function qualityOf(stuff: Edge, craft: number, years: number): number {
  const q =
    22 +
    36 * stuff.keen +
    18 * stuff.tough +
    10 * Math.max(0, Math.min(1, craft)) +
    14 * (1 - dmath.exp(-Math.max(0, years) / 8));
  return Math.max(5, Math.min(99, Math.round(q)));
}

/** A quality said: rough, plain, good, fine, masterly. */
export function gradeOf(quality: number): string {
  return quality >= 82
    ? "masterly"
    : quality >= 70
      ? "fine"
      : quality >= 58
        ? "good"
        : quality >= 45
          ? "plain"
          : "rough";
}

/** "a" or "an" before a word. */
export function article(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}
