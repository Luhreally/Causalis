// A camp of a land's bands seen near (Phase 29 M160, asked for 2026-10-24: "i should be able to
// be in my game and see the cell stage and every stage like spore i would just watch it emerge"):
// what one of its bands lives its day among — the land's own beasts and grasses now, those its
// people have not hunted out of it (a herding band's flocks among them, tame); the people's
// figure; a band of the camp's; the hour of the world's day. Looked at, never lived.
import { DAY, type World } from "../kernel/index.ts";
import { BIOME, livingIn, type Species } from "../gen/index.ts";
import { homePlanet, populationContext, regionOf, tameNow, wildsOf } from "../sim/index.ts";
import type { CampNear } from "../bridge/index.ts";
import { landCamps } from "./land.ts";
import { landTitle } from "./inspect/names.ts";

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
    people = g.life.people,
    wilds = wildsOf(populationContext(world), cell),
    lost = new Set(wilds.lost),
    flock = (s: Species) => camp.herds && s.niche === "grazer" && tameNow(world, s),
    // (A herding band's flock first: of the land's grazers, theirs is among those seen.)
    living = livingIn(g.life, cell)
      .filter((s) => s.index !== people?.species && !lost.has(s.index) && s.body)
      .sort((a, b) => Number(flock(b)) - Number(flock(a))),
    now = g.deep.ages[g.deep.ages.length - 1];
  return {
    cell,
    camp,
    land: landTitle(world, cell),
    people: people ? g.life.species[people.species]!.name : "people",
    figure: people
      ? {
          clade: people.body.clade,
          medium: people.body.medium,
          symmetry: people.body.symmetry,
          manipulators: people.body.manipulators,
          limbs: people.body.limbs,
          skin: people.body.skin,
          size: people.body.size,
          span: people.body.span,
        }
      : null,
    plan: {
      seed: `${world.seed.text} camp ${cell}:${id}`,
      ages: [
        {
          index: 0,
          from: 0,
          to: 0,
          kind: lookOf(regionOf(populationContext(world), cell).biome[camp.tile] ?? -1),
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
    size: Math.max(LEAST_BAND, Math.min(MOST_BAND, Math.round(camp.people / camp.bands))),
    hour: ((world.now % DAY) / DAY) * 24,
  };
}
