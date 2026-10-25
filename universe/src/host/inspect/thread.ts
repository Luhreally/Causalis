// The thread back to the beginning (Phase 36 M182; THE OBSERVATORY's causal continuity, traced
// back across the scales): from a life, a town or a land, step by step — who they were born to
// and where; the town and when it was founded; the land and when their people's bands first came
// to it; the people and where they rose to thought; their line back through each of its
// forebears to the first bodies, the first cells and the first replicators; the world as it
// formed about its star (as the hand made it, if it did); and its galaxy turning. Each step opens
// its own page.
import { treeOfLife } from "../../gen/index.ts";
import { homePlanet } from "../../sim/index.ts";
import { observer, type Person } from "../../causal/index.ts";
import { makingWords, makingsOf } from "../../rules/index.ts";
import type { Block, GenesisPlan, Line } from "../../bridge/index.ts";
import type { World } from "../../kernel/index.ts";
import { genesisOf } from "../genesis.ts";
import { settlementFacts } from "../planet.ts";
import { landLink, townLink } from "./names.ts";
import { count, link } from "./words.ts";

type Step = Extract<Block, { type: "thread" }>["steps"][number];

/** When the bands went out over the land, millions of years before the chronicle (as the genesis tells it). */
const PEOPLING_MY = 0.1;
/** How long ago the galaxy began to turn, millions of years (as the genesis tells it). */
const GALAXY_MY = 13_600;

/** Millions of years ago, in words. */
export function agoWords(my: number): string {
  if (my >= 1000) return `${(my / 1000).toFixed(1)} billion years ago`;
  if (my >= 1) return `${count(my)} million years ago`;
  return `${count(Math.max(1, my * 1000))} thousand years ago`;
}

// (The genesis of the last worlds asked of: a page opened again need not make it again.)
const PLANS = new Map<string, GenesisPlan>();
function planOf(world: World): GenesisPlan {
  const key = `${world.seed.text} ${homePlanet(world).generated.digest}`;
  let plan = PLANS.get(key);
  if (!plan) {
    plan = genesisOf(world);
    if (PLANS.size >= 2) PLANS.delete(PLANS.keys().next().value!);
    PLANS.set(key, plan);
  }
  return plan;
}

/** A life as its thread begins: who, born when and where, to whom; and the town they live in. */
export type Life = {
  readonly ref: string;
  readonly name: string;
  readonly alive: boolean;
  readonly born: number;
  readonly beforeChronicle: boolean;
  /** The land they were born in. */
  readonly cell: number;
  /** The land they live in, and their town if they live in one. */
  readonly home: number;
  readonly town: string | null;
  readonly parents: readonly Line[];
};

/** Who a met person was born to, as their household's roles tell it (none known: none). */
function parentsOf(world: World, p: Person): Person[] {
  const ledger = observer(world),
    hh = ledger.household(p.household);
  if (!hh) return [];
  const members = hh.members.map((r) => ledger.person(r)).filter((m): m is Person => !!m);
  // (The household's head and spouse are its children's parents; its elder is the head's.)
  if (p.role === "child") return members.filter((m) => m.role === "head" || m.role === "spouse");
  if (p.role === "head") return members.filter((m) => m.role === "elder");
  return [];
}

/** A people's own: "the upright apes' bands", "the Ana's bands". */
function theirs(name: string): string {
  return `${name}${name.endsWith("s") ? "'" : "'s"}`;
}

/** Names run together: "A", "A and B", "A, B and C". */
function together(spans: readonly Line[]): Line {
  return spans.flatMap((s, i) => [
    ...(i === 0 ? [] : i === spans.length - 1 ? [" and "] : [", "]),
    ...s,
  ]);
}

/** A met person's life, as their thread begins. */
function personLife(world: World, p: Person): Life {
  return {
    ref: p.ref,
    name: `${p.name} ${p.surname}`,
    alive: p.alive,
    born: p.birthYear,
    beforeChronicle: p.bornBeforeChronicle,
    cell: p.birthCell,
    home: p.village ? settlementFacts(world, p.village).cell : p.cell,
    town: p.village,
    parents: parentsOf(world, p).map((m) => [link(`${m.name} ${m.surname}`, m.ref)]),
  };
}

/**
 * The thread back from a life (a met person, or one under the hand), a town or a land: each step
 * a scale further back, to the galaxy turning.
 */
export function threadBlock(
  world: World,
  from:
    | { readonly person: Person }
    | { readonly life: Life }
    | { readonly town: string }
    | { readonly cell: number },
): Block {
  const steps: Step[] = [],
    g = homePlanet(world).generated.fine,
    plan = planOf(world),
    life = "person" in from ? personLife(world, from.person) : "life" in from ? from.life : null;
  let town = "town" in from ? from.town : null,
    cell = "cell" in from ? from.cell : -1;
  // A life: when and where they were born, and to whom.
  if (life) {
    town = life.town;
    cell = life.home;
    steps.push({
      icon: life.alive ? "🧑" : "🪦",
      scale: "A life",
      when: `year ${life.born}`,
      line: [
        link(life.name, life.ref),
        ` was born${life.beforeChronicle ? ", before the chronicle," : ""} in `,
        landLink(world, life.cell, true),
        ...(life.parents.length ? [", to ", ...together(life.parents)] : []),
        ".",
      ],
      ref: life.ref,
    });
  }
  // The town: when it was founded (and became a city).
  if (town) {
    const s = settlementFacts(world, town);
    cell = s.cell;
    steps.push({
      icon: s.city ? "🏙️" : "🏘️",
      scale: "A town",
      when: `year ${s.founded}`,
      line: [
        townLink(world, s.ref),
        " was ",
        link(`founded in year ${s.founded}`, s.event),
        ...(s.city ? [", ", link(`a city since year ${s.city.founded}`, s.city.event)] : []),
        ".",
      ],
      ref: s.ref,
    });
  }
  const people = plan.people,
    peopling = plan.peopling;
  // The land: when their people's bands first came to it, and from where.
  if (cell >= 0) {
    const reached = peopling?.lands.find(([c]) => c === cell),
      far = peopling ? Math.max(1, ...peopling.lands.map(([, step]) => step)) : 1;
    steps.push({
      icon: "🗺️",
      scale: "A land",
      when: reached ? agoWords(PEOPLING_MY * (1 - reached[1] / (far + 1))) : "before the chronicle",
      line: reached
        ? reached[1] === 0
          ? [landLink(world, cell), ` is the cradle: the ${people?.name ?? "people"} rose here.`]
          : [
              landLink(world, cell),
              `: the ${theirs(people?.name ?? "people")} bands came to it in the peopling, ${count(reached[1])} land${reached[1] === 1 ? "" : "s"} out from their cradle, from `,
              landLink(world, reached[2], true),
              ".",
            ]
        : [landLink(world, cell), " was peopled before the chronicle."],
      ref: `cell:0:${cell}`,
    });
  }
  // The people: where they rose to thought.
  if (people && peopling)
    steps.push({
      icon: "🧠",
      scale: "A people",
      when: agoWords(PEOPLING_MY),
      line: [
        `The ${people.name} rose to thought in `,
        landLink(world, peopling.cradle, true),
        ` — ${people.because}.`,
      ],
      ref: `cell:0:${peopling.cradle}`,
    });
  // Their line, back through each of its forebears to the first replicators.
  const tree = treeOfLife(g);
  for (
    let n = tree.nodes.find((x) => x.kind === "people");
    n;
    n = n.parent >= 0 ? tree.nodes[n.parent] : undefined
  ) {
    const dawn = n.kind === "dawn",
      name = n.name[0]!.toUpperCase() + n.name.slice(1);
    steps.push({
      icon: n.kind === "people" ? "🧬" : dawn ? (n.parent < 0 ? "✨" : "🦠") : "🌿",
      scale: dawn ? "Life's dawn" : n.kind === "people" ? "Their kind" : "Their line",
      when: agoWords(n.from),
      // (Their own kind arising, the lineage that would rise to thought; each before it, as it was.)
      line:
        n.kind === "people"
          ? [link(name, n.ref), " arose: the lineage that would rise to thought."]
          : [link(name, n.ref), `: ${n.what}.`],
      ref: n.ref,
    });
  }
  // The world as it formed about its star (as the hand made it, if it did); its galaxy turning.
  const made = makingWords(makingsOf(world.seed.text));
  steps.push({
    icon: "🌍",
    scale: "The world",
    when: agoWords(tree.worldAge),
    line: [
      link("The world", g.planet.ref),
      " formed about ",
      link(
        `${/^[AEFHILMNORSX]/.test(g.star.spectral) ? "an" : "a"} ${g.star.spectral} star`,
        g.star.ref,
      ),
      made ? `, made so by your hand: ${made}.` : ".",
    ],
    ref: g.planet.ref,
  });
  steps.push({
    icon: "🌌",
    scale: "The galaxy",
    when: agoWords(GALAXY_MY),
    line: ["Its galaxy began to turn, and in time, out on an arm, its star lit."],
  });
  return { type: "thread", title: "Back to the beginning", steps };
}
