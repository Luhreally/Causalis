// A camp of a land's bands seen near (Phase 29 M160, asked for 2026-10-24: "i should be able to
// be in my game and see the cell stage and every stage like spore i would just watch it emerge"):
// what one of its bands lives its day among — the land's own beasts and grasses now, those its
// people have not hunted out of it (a herding band's flocks among them, tame); the people's
// figure; a band of the camp's; the hour of the world's day. Looked at, never lived.
import { DAY, mix, type World } from "../kernel/index.ts";
import { BIOME, livingIn, personName, tonguePersonName, type Species } from "../gen/index.ts";
import {
  cultureOf,
  homePlanet,
  populationContext,
  regionOf,
  tameNow,
  wildsOf,
} from "../sim/index.ts";
import type { CampCraft, CampNear } from "../bridge/index.ts";
import { landCamps } from "./land.ts";
import { landTitle } from "./inspect/names.ts";
import { bedrockOf, spotRock } from "./inspect/ground.ts";
import { substRef } from "./inspect/matter.ts";
import { peopleFigure } from "./folk.ts";

// —— What a band makes its things of (Phase 49 M211) ——————————————————————————————————

/**
 * The stone a band knaps where its camp's bedrock is a rock: flint from the chalk, chert from the
 * shale, the glass of old lava, quartzite from the sandstone's cobbles; how keen an edge each takes
 * and how well it bears a blow; its colour; the substance it is.
 */
const KNAPPED: Readonly<Record<string, CampCraft["stone"]>> = {
  limestone: {
    name: "flint",
    from: "nodules weathered out of the chalk",
    keen: 0.88,
    tough: 0.55,
    colour: [0.36, 0.33, 0.3],
    ref: substRef("flint"),
  },
  shale: {
    name: "chert",
    from: "black beds among the shale",
    keen: 0.8,
    tough: 0.6,
    colour: [0.2, 0.2, 0.23],
    ref: substRef("flint"),
  },
  "coal-measures": {
    name: "chert",
    from: "bands in the coal country's shale",
    keen: 0.8,
    tough: 0.6,
    colour: [0.22, 0.21, 0.22],
    ref: substRef("flint"),
  },
  andesite: {
    name: "obsidian",
    from: "the black glass of old lava flows",
    keen: 1,
    tough: 0.2,
    colour: [0.06, 0.06, 0.09],
    ref: substRef("glass"),
  },
  basalt: {
    name: "basalt",
    from: "the fine dark lava, flaked coarse and ground to an edge",
    keen: 0.45,
    tough: 0.9,
    colour: [0.2, 0.2, 0.22],
  },
  sandstone: {
    name: "quartzite",
    from: "cobbles washed out of the hard sandstone",
    keen: 0.55,
    tough: 0.85,
    colour: [0.82, 0.78, 0.7],
    ref: substRef("quartz"),
  },
  granite: {
    name: "quartz",
    from: "the white veins of the granite",
    keen: 0.5,
    tough: 0.4,
    colour: [0.9, 0.9, 0.88],
    ref: substRef("quartz"),
  },
  gneiss: {
    name: "quartzite",
    from: "hard beds in the old worn hills",
    keen: 0.55,
    tough: 0.85,
    colour: [0.78, 0.76, 0.72],
    ref: substRef("quartz"),
  },
};

/** The wood of a band's shafts, the fibre of its cord, what binds a point on: by the land's biome. */
const WOODS: Readonly<Record<number, readonly [wood: string, fibre: string, binding: string]>> = {
  [BIOME.ice]: ["driftwood", "sinew", "sinew"],
  [BIOME.tundra]: ["dwarf willow", "sinew", "sinew and seal fat"],
  [BIOME.borealForest]: ["spruce", "spruce root", "sinew and birch pitch"],
  [BIOME.coldDesert]: ["tamarisk", "sagebrush bark", "sinew and pine gum"],
  [BIOME.steppe]: ["willow", "grass", "sinew and birch pitch"],
  [BIOME.temperateForest]: ["ash", "nettle", "sinew and birch pitch"],
  [BIOME.temperateRainforest]: ["yew", "cedar bark", "sinew and spruce gum"],
  [BIOME.hotDesert]: ["acacia", "palm fibre", "sinew and acacia gum"],
  [BIOME.savanna]: ["acacia", "bowstring hemp", "sinew and acacia gum"],
  [BIOME.tropicalDryForest]: ["ironwood", "bark", "sinew and resin"],
  [BIOME.tropicalRainforest]: ["bamboo", "palm fibre", "rattan and resin"],
  [BIOME.alpine]: ["juniper", "grass", "sinew and pine gum"],
};

/** The colour a band grinds where its bedrock is a rock: red ochre of the iron in it, yellow, or black. */
const PIGMENTS: Readonly<Record<string, NonNullable<CampCraft["pigment"]>>> = {
  sandstone: { name: "red ochre", colour: [0.66, 0.2, 0.12] },
  granite: { name: "red ochre", colour: [0.62, 0.22, 0.14] },
  gneiss: { name: "red ochre", colour: [0.6, 0.24, 0.16] },
  basalt: { name: "red ochre", colour: [0.56, 0.18, 0.12] },
  shale: { name: "yellow ochre", colour: [0.8, 0.6, 0.2] },
  limestone: { name: "yellow ochre", colour: [0.84, 0.66, 0.26] },
  andesite: { name: "yellow ochre", colour: [0.76, 0.58, 0.22] },
  "coal-measures": { name: "black earth", colour: [0.1, 0.09, 0.09] },
};

/** Where fire is made by spinning a stick in the hands: dry lands, whose wood takes a spark. */
const HAND_DRILL = new Set<number>([
  BIOME.coldDesert,
  BIOME.hotDesert,
  BIOME.savanna,
  BIOME.steppe,
  BIOME.tropicalDryForest,
]);

/** The least share of a land a rock must have for its bands to go out to it for their stone. */
const SOUGHT = 0.04;

/**
 * The rock a band takes its stone from: of its land's rocks (any that is a twenty-fifth of it or
 * more, and the ground under the camp), the one whose stone takes the keenest edge — bands went far
 * for good stone.
 */
export function stoneRock(world: World, cell: number, tile: number): string {
  const r = regionOf(populationContext(world), cell),
    under = spotRock(world, r.parent[tile] ?? 0),
    rocks = [under, ...bedrockOf(world, cell).flatMap(([rock, k]) => (k >= SOUGHT ? [rock] : []))];
  return rocks.reduce((best, rock) =>
    (KNAPPED[rock]?.keen ?? 0) > (KNAPPED[best]?.keen ?? 0) ? rock : best,
  );
}

/**
 * What a band makes its things of, from its land's rocks (the stone it knaps), the ground of its
 * camp's tile (the colour it grinds) and the land about it (its biome): its wood, fibre and
 * binding, how it makes fire — with chert out of the shale and the pyrite in it, by striking the
 * one on the other.
 */
export function campCraft(world: World, cell: number, tile: number): CampCraft {
  const r = regionOf(populationContext(world), cell),
    biome = r.biome[tile] ?? -1,
    rock = spotRock(world, r.parent[tile] ?? 0),
    from = stoneRock(world, cell, tile),
    stone = KNAPPED[from] ?? KNAPPED.limestone!,
    [wood, fibre, binding] = WOODS[biome] ?? ["ash", "bark", "sinew"],
    frozen = biome === BIOME.ice || biome === BIOME.tundra;
  return {
    stone,
    wood,
    fibre,
    binding,
    // (On frozen ground there is no earth to dig for colour: soot and fat.)
    pigment: frozen
      ? { name: "soot black", colour: [0.08, 0.08, 0.08] }
      : (PIGMENTS[rock] ?? { name: "red ochre", colour: [0.62, 0.2, 0.12] }),
    fire:
      (from === "shale" || from === "coal-measures") && stone.name === "chert"
        ? "strike-a-light"
        : HAND_DRILL.has(biome)
          ? "hand drill"
          : "bow drill",
  };
}

/** The fewest and the most of a band seen near. */
const LEAST_BAND = 6;
const MOST_BAND = 24;

/**
 * How a land of now is drawn near, by the ground the camp stands on: frosted where it is cold,
 * lush where it is wet and hot, sand where it is dry; else as a quiet age's.
 */
function lookOf(biome: number): string {
  switch (biome) {
    case BIOME.ice:
    case BIOME.tundra:
    case BIOME.alpine:
    case BIOME.borealForest:
      return "icehouse";
    case BIOME.tropicalRainforest:
    case BIOME.temperateRainforest:
      return "hothouse";
    case BIOME.hotDesert:
    case BIOME.coldDesert:
      return "dry";
    default:
      return "quiet";
  }
}

export function campNear(world: World, cell: number, id: number): CampNear | null {
  const camp = landCamps(world, cell).find((c) => c.id === id);
  if (!camp) return null;
  const g = homePlanet(world).generated,
    ctx = populationContext(world),
    people = g.life.people,
    wilds = wildsOf(ctx, cell),
    lost = new Set(wilds.lost),
    flock = (s: Species) => camp.herds && s.niche === "grazer" && tameNow(world, s),
    // (A herding band's flock first: of the land's grazers, theirs is among those seen.)
    living = livingIn(g.life, cell)
      .filter((s) => s.index !== people?.species && !lost.has(s.index) && s.body)
      .sort((a, b) => Number(flock(b)) - Number(flock(a))),
    now = g.deep.ages[g.deep.ages.length - 1],
    tongue = cultureOf(world).get(cell)?.tongue,
    size = Math.max(LEAST_BAND, Math.min(MOST_BAND, Math.round(camp.people / camp.bands)));
  return {
    cell,
    camp,
    land: landTitle(world, cell),
    people: people ? g.life.species[people.species]!.name : "people",
    figure: peopleFigure(g),
    plan: {
      seed: `${world.seed.text} camp ${cell}:${id}`,
      ages: [
        {
          index: 0,
          from: 0,
          to: 0,
          kind: lookOf(regionOf(ctx, cell).biome[camp.tile] ?? -1),
          seaLevel: now?.seaLevel ?? 0,
          warmth: now?.warmth ?? 0,
          // (Wooded as the land is now: its forest against what it first had.)
          forests: wilds.firstForest * wilds.forest >= 0.25,
        },
      ],
      lineages: living.map((s) => ({
        ref: s.ref,
        name: s.name,
        niche: s.niche,
        arose: 0,
        died: null,
        size: s.size,
        level: s.level,
        body: s.body,
        words: null,
      })),
    },
    flocks: living.flatMap((s, i) => (flock(s) ? [i] : [])),
    size,
    // Each of the band named in the land's tongue (else its first people's sounds).
    names: Array.from({ length: size }, (_, i) => {
      const key = mix(mix(mix(0x2f6b3d1, cell), id), i) >>> 0,
        sex = (key >>> 7) & 1;
      return tongue ? tonguePersonName(tongue, key, sex) : personName(ctx.culture, key, sex);
    }),
    hour: ((world.now % DAY) / DAY) * 24,
    craft: campCraft(world, cell, camp.tile),
  };
}
