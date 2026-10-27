// A camp of a land's bands seen near (Phase 29 M160, asked for 2026-10-24: "i should be able to
// be in my game and see the cell stage and every stage like spore i would just watch it emerge"):
// what one of its bands lives its day among — the land's own beasts and grasses now, those its
// people have not hunted out of it (a herding band's flocks among them, tame); the people's
// figure; a band of the camp's; the hour of the world's day. Looked at, never lived.
import { DAY, mix, type World } from "../kernel/index.ts";
import {
  BIOME,
  livingIn,
  personName,
  tonguePersonName,
  worldChemistry,
  worldKindOf,
  type Species,
} from "../gen/index.ts";
import { kindBurns, pigmentOverride } from "../rules/index.ts";
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
import { spotRock } from "./inspect/ground.ts";
import { substRef } from "./inspect/matter.ts";
import { WOODS, landStone } from "./chain.ts";
import { peopleFigure } from "./folk.ts";
import { worldLook } from "./biochem.ts";

// —— What a band makes its things of (Phase 49 M211) ——————————————————————————————————

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
    // (The stone its land knaps, the land's towns as much as its bands: Phase 50 M212.)
    { rock: from, stone } = landStone(world, cell, rock),
    [wood, fibre, binding] = WOODS[biome] ?? ["ash", "bark", "sinew"],
    frozen = biome === BIOME.ice || biome === BIOME.tundra,
    // (Where nothing rusts there are no ochres: green earths and black — Phase 54.)
    own = pigmentOverride(worldChemistry(homePlanet(world).generated), rock);
  return {
    stone: {
      name: stone.name,
      from: stone.from,
      keen: stone.keen,
      tough: stone.tough,
      colour: stone.colour,
      ...(stone.subst ? { ref: substRef(stone.subst) } : {}),
    },
    wood,
    fibre,
    binding,
    // (On frozen ground there is no earth to dig for colour: soot and fat.)
    pigment: frozen
      ? { name: "soot black", colour: [0.08, 0.08, 0.08] }
      : (own ?? PIGMENTS[rock] ?? { name: "red ochre", colour: [0.62, 0.2, 0.12] }),
    // (Any chert struck on the pyrite of its shale: black lydite where nothing rusts, white
    // novaculite of a silica-rich shale, as Earth's grey — Phase 54.)
    // (None where nothing burns: Phase 56.)
    fire: !kindBurns(worldKindOf(homePlanet(world).generated))
      ? "none"
      : (from === "shale" || from === "coal-measures") && stone.subst === "chert"
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
      // (Its life's colours: Phase 57.)
      ...worldLook(world),
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
