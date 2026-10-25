// A world's beginning for the genesis (Phase 9 M89; played, Phase 24): its deep ages, every
// lineage with the age it arose and died in and its body, the people that rose to thought; how
// old it is, the steps of life's dawn, a drop of its first seas; and, asked of a seed's text
// with acts laid on its dawn, the world remade from them — generated afresh, the world being
// watched untouched (it is begun from that text when the viewer begins there).
import { Rng, seedFromText, seedName, type World } from "../kernel/index.ts";
import { BIOME_NAMES, AGES, treeOfLife, type ProvinceWorld } from "../gen/index.ts";
import {
  agesMade,
  bodyWords,
  creatureWords,
  dawnMade,
  livesMade,
  peoplingMade,
} from "../rules/index.ts";
import {
  HomePlanet,
  firstWays,
  homePlanet,
  livable,
  openingWays,
  planLanguages,
  spreadOf,
} from "../sim/index.ts";
import type { GenesisPlan } from "../bridge/index.ts";
import { dawnSeaOf, dropOfWorld } from "./inspect/small.ts";
import { figureBody, folkFacts } from "./folk.ts";

/** The last world remade from acts laid on its dawn (a viewer asks again and again of one). */
let remade: { readonly key: string; readonly g: ProvinceWorld } | null = null;

/**
 * The beginning of the world watched, or — where `seed` is another text of its name (acts laid
 * on its dawn) — of that world remade.
 */
export function genesisOf(world: World, seed?: string): GenesisPlan {
  const text = seed ?? world.seed.text,
    hp = homePlanet(world);
  if (text === world.seed.text || seedName(text) !== seedName(world.seed.text))
    return genesisPlan(hp.generated, world.seed.text);
  const frequency = hp.generated.fine.grid.frequency,
    key = `${hp.prior.name} ${frequency} ${text}`;
  if (remade?.key !== key)
    remade = { key, g: new HomePlanet(seedFromText(text), hp.prior, frequency).generated };
  return genesisPlan(remade.g, text);
}

/**
 * How the first people spread before the chronicle (Phase 28), as the world is begun from: the
 * lands their bands reached, and the tongues of the opening by family, the first reached first.
 */
function peoplingOf(pw: ProvinceWorld, text: string): GenesisPlan["peopling"] {
  if (!pw.life.people) return null;
  const spread = spreadOf(pw, text),
    ways = openingWays(
      { rng: new Rng(seedFromText(text)) },
      spread.lands,
      firstWays(spread.home, text, null),
      null,
    ),
    { languages, speaks } = planLanguages(
      pw,
      spread.lands.map(([cell, , from]) => [cell, from] as const),
      (cell) => ways.get(cell)!.tongue,
    ),
    stepOf = new Map(spread.lands.map(([cell, step]) => [cell, step]));
  const order = new Map<number, number>(),
    family: number[] = [],
    families: {
      name: string;
      root: number;
      middle: number;
      lands: number;
      tongues: number;
      people: number;
    }[] = [];
  spread.lands.forEach(([cell], i) => {
    const root = languages[speaks.get(cell)!]!.family;
    let f = order.get(root);
    if (f === undefined) {
      const home = languages[root]!.home;
      f = families.length;
      order.set(root, f);
      families.push({
        name: languages[root]!.name,
        root: home,
        middle: pw.centre[home]!,
        lands: 0,
        tongues: 0,
        people: 0,
      });
    }
    family.push(f);
    families[f]!.lands++;
    families[f]!.people += spread.sizes[i]!;
  });
  for (const l of languages) families[order.get(l.family)!]!.tongues++;
  let fit = 0;
  for (let c = 0; c < pw.offworld.base; c++) if (livable(pw, c, spread.medium)) fit++;
  return {
    cradle: spread.home,
    middle: pw.centre[spread.home]!,
    lands: spread.lands.map(([cell, step, from]) => [cell, step, from] as const),
    sizes: [...spread.sizes],
    family,
    families,
    tongues: languages.map((l) => stepOf.get(l.home)!).sort((a, b) => a - b),
    livable: fit,
  };
}

/** A generated world's beginning, as the genesis shows it. */
export function genesisPlan(pw: ProvinceWorld, seed: string): GenesisPlan {
  const g = pw.fine,
    life = g.life,
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
      lives: [...livesMade(seed, AGES)].map(([age, way]) => ({ age, way })),
      peopling: peoplingMade(seed),
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
          figure: figureBody(people.body, folkFacts(g)),
        }
      : null,
    peopling: peoplingOf(pw, seed),
  };
}
