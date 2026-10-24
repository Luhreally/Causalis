// A world's beginning for the genesis (Phase 9 M89; played, Phase 24): its deep ages, every
// lineage with the age it arose and died in and its body, the people that rose to thought; how
// old it is, the steps of life's dawn, a drop of its first seas; and, asked of a seed's text
// with acts laid on its dawn, the world remade from them — generated afresh, the world being
// watched untouched (it is begun from that text when the viewer begins there).
import { seedFromText, seedName, type World } from "../kernel/index.ts";
import {
  BIOME_NAMES,
  AGES,
  generateHomeWorld,
  isProvinceWorld,
  treeOfLife,
  type HomeWorld,
} from "../gen/index.ts";
import { agesMade, bodyWords, creatureWords, dawnMade } from "../rules/index.ts";
import { homePlanet } from "../sim/index.ts";
import type { GenesisPlan } from "../bridge/index.ts";
import { dawnSeaOf, dropOfWorld } from "./inspect/small.ts";

/** The world as generated (on its fine grid). */
function fineOf(world: World): HomeWorld {
  const g = homePlanet(world).generated;
  return isProvinceWorld(g) ? g.fine : g;
}

/** The last world remade from acts laid on its dawn (a viewer asks again and again of one). */
let remade: { readonly key: string; readonly g: HomeWorld } | null = null;

/**
 * The beginning of the world watched, or — where `seed` is another text of its name (acts laid
 * on its dawn) — of that world remade.
 */
export function genesisOf(world: World, seed?: string): GenesisPlan {
  const text = seed ?? world.seed.text;
  if (text === world.seed.text || seedName(text) !== seedName(world.seed.text))
    return genesisPlan(fineOf(world), world.seed.text);
  const fine = fineOf(world),
    hp = homePlanet(world),
    key = `${hp.prior.name} ${fine.grid.frequency} ${text}`;
  if (remade?.key !== key)
    remade = { key, g: generateHomeWorld(seedFromText(text), hp.prior, fine.grid.frequency) };
  return genesisPlan(remade.g, text);
}

/** A generated world's beginning, as the genesis shows it. */
export function genesisPlan(g: HomeWorld, seed: string): GenesisPlan {
  const life = g.life,
    people = life.people,
    tree = treeOfLife(g),
    deg = (r: number, pos: string, neg: string) =>
      `${Math.abs((r * 180) / Math.PI).toFixed(0)}°${r >= 0 ? pos : neg}`;
  return {
    seed,
    name: seedName(seed),
    worldAge: tree.worldAge,
    rungs: tree.rungs.map((r) => ({ id: r.id, name: r.name, at: r.at, words: r.words })),
    drop: dropOfWorld(g, dawnSeaOf(g), {
      title: "A drop of the first seas",
      habitat: "sea",
    }),
    acts: {
      ages: [...agesMade(seed, AGES)].map(([age, kind]) => ({ age, kind })),
      dawn: dawnMade(seed),
    },
    ages: g.deep.ages.map((a) => ({
      index: a.index,
      from: a.from,
      to: a.to,
      kind: a.kind,
      seaLevel: a.seaLevel,
      warmth: a.warmth,
      forests: a.forests,
    })),
    lineages: life.species
      .filter((s) => s.index !== people?.species && (s.body || s.niche === "seed grass"))
      .map((s) => ({
        ref: s.ref,
        name: s.name,
        niche: s.niche,
        arose: s.arose,
        died: s.died,
        size: s.size,
        level: s.level,
        body: s.body,
        words: s.body ? creatureWords(s.body, s.niche) : null,
      })),
    people: people
      ? {
          name: life.species[people.species]!.name,
          words: bodyWords(people.body),
          because: people.because,
          cradle: `the ${BIOME_NAMES[g.climate.biome[people.cell]!] ?? "land"} at ${deg(g.grid.lat[people.cell]!, "N", "S")}, ${deg(g.grid.lon[people.cell]!, "E", "W")}`,
          arose: life.species[people.species]!.arose,
          figure: {
            clade: people.body.clade,
            medium: people.body.medium,
            symmetry: people.body.symmetry,
            manipulators: people.body.manipulators,
            limbs: people.body.limbs,
            skin: people.body.skin,
            size: people.body.size,
            span: people.body.span,
          },
        }
      : null,
  };
}
