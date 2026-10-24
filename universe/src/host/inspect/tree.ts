// The tree of life's pages (Phase 17 M129, the Observatory): the world's whole tree — its
// dawn, its kinds of body, its innovations and its great dyings — a page for every line of
// it no living lineage is (the first cells, the first walkers, a forebear that died out),
// and each lineage's ancestry: the bodies it came of, one after another, and what changed
// at each step and why. Pure reads of the generated world: nothing here is history.
import {
  AGES,
  ageRef,
  ageSpan,
  descendantsOf,
  endOf,
  isProvinceWorld,
  lineOf,
  livesOn,
  massWords,
  treeOfLife,
  wayWord,
  type HomeWorld,
  type LifeNode,
  type TreeOfLife,
} from "../../gen/index.ts";
import { homePlanet } from "../../sim/index.ts";
import type { World } from "../../kernel/index.ts";
import type { Block, Item, PageModel, PhyloLine, Place, Stat, Tab } from "../../bridge/index.ts";
import { count, item, link, stat, yearNow } from "./words.ts";
import { landLink, landOfSpot, landsOf, lineageIcon } from "./names.ts";

type Rgb = readonly [number, number, number];

/** The world as it was generated (on its fine grid), whose tree it is. */
function fineOf(world: World): HomeWorld {
  const g = homePlanet(world).generated;
  return isProvinceWorld(g) ? g.fine : g;
}

/** The world's tree of life. */
export function treeOf(world: World): TreeOfLife {
  return treeOfLife(fineOf(world));
}

/** The colours of the tree's families: each kind of body its own, the dawn grey, plants green. */
const FAMILY: readonly Rgb[] = [
  [0.36, 0.82, 1],
  [1, 0.56, 0.26],
  [0.62, 0.92, 0.3],
  [0.98, 0.42, 0.62],
  [0.76, 0.56, 1],
  [1, 0.86, 0.32],
  [0.4, 0.96, 0.76],
  [0.98, 0.32, 0.32],
  [0.56, 0.7, 0.98],
  [0.88, 0.76, 0.56],
];
const DAWN: Rgb = [0.62, 0.66, 0.78];
const GREEN: Rgb = [0.36, 0.82, 0.38];
const GOLD: Rgb = [1, 0.84, 0.2];

/** Each line's colour: its family's (the nearest founder or stem it came of). */
function colours(tree: TreeOfLife): Rgb[] {
  const out: Rgb[] = [],
    family = new Map<number, Rgb>();
  let next = 0;
  for (const n of tree.nodes) {
    if (n.kind === "plant" || (n.kind === "crown" && !n.genome)) {
      out.push(GREEN);
      continue;
    }
    if (n.kind === "people") {
      out.push(GOLD);
      continue;
    }
    if (n.kind === "dawn") {
      out.push(DAWN);
      continue;
    }
    if (n.kind === "stem") {
      const c = FAMILY[next++ % FAMILY.length]!;
      family.set(n.id, c);
      out.push(c);
      continue;
    }
    let c: Rgb = DAWN;
    for (let p = n.parent; p >= 0; p = tree.nodes[p]!.parent) {
      const f = family.get(p);
      if (f) {
        c = f;
        break;
      }
    }
    out.push(c);
  }
  return out;
}

/** A line as the chart draws it. */
function phyloLine(tree: TreeOfLife, n: LifeNode, color: Rgb, parent = n.parent): PhyloLine {
  // (A line that died only in its daughters, long after they branched off, is no cross at its
  // last branching: its bar ends there and goes on in theirs.)
  const lives = (n.kind === "crown" || n.kind === "people") && n.to === null && n.died === null,
    on = !lives && n.to === null && (livesOn(tree, n.id) || (tree.children[n.id]?.length ?? 0) > 0);
  return {
    id: n.id,
    parent,
    ref: n.ref,
    name: n.name,
    from: n.from,
    end: endOf(tree, n.id),
    fate: lives ? "lives" : on ? "line" : "died",
    color,
    words: n.what,
  };
}

/** Where the chart folds: the dawn's long ages to its left, the ages since the bodies to its right. */
function foldOf(tree: TreeOfLife): number {
  const bodies = tree.rungs.find((r) => r.id === "bodies");
  return Math.round((bodies?.at ?? 600) + 40);
}

/** A chart of some of the tree's lines (each shown with its mother where she is shown too). */
export function phyloBlock(
  tree: TreeOfLife,
  ids: readonly number[],
  title?: string,
  focus?: number,
): Block {
  const shown = new Set(ids),
    colour = colours(tree),
    lines = [...shown]
      .sort((a, b) => a - b)
      .map((id) => {
        const n = tree.nodes[id]!;
        let p = n.parent;
        while (p >= 0 && !shown.has(p)) p = tree.nodes[p]!.parent;
        return phyloLine(tree, n, colour[id]!, p);
      }),
    oldest = Math.max(...lines.map((l) => l.from));
  return {
    type: "phylo",
    ...(title ? { title } : {}),
    from: Math.ceil(oldest / 10) * 10,
    to: 0,
    ...(oldest > foldOf(tree) + 100 ? { fold: foldOf(tree) } : {}),
    lines,
    ...(focus !== undefined ? { focus } : {}),
  };
}

/** A line's icon. */
function iconOf(n: LifeNode): string {
  if (n.kind === "people") return "🧑";
  if (n.kind === "plant" || (n.kind === "crown" && !n.genome))
    return n.name.includes("grass") ? "🌾" : n.name.includes("forest") ? "🌳" : "🌿";
  if (n.kind === "dawn")
    return n.name.includes("worm")
      ? "🪱"
      : n.name.includes("jell")
        ? "🪼"
        : n.name.includes("sponge")
          ? "🧽"
          : n.name.includes("replicator")
            ? "🧬"
            : "🦠";
  if (n.kind === "crown") return lineageIcon(n.way, n.body?.moves === "fly");
  return n.kind === "stem" ? "🧬" : "🦴";
}

/** When, in words: "380 million years ago". */
function ago(my: number): string {
  return my >= 1000
    ? `${(my / 1000).toFixed(my >= 10000 ? 0 : 1)} billion years ago`
    : my <= 0
      ? "now"
      : `${count(my)} million years ago`;
}

/** A line's span in words: "380–120 million years ago", "since 12 million years ago". */
function spanWords(tree: TreeOfLife, n: LifeNode): string {
  const end = endOf(tree, n.id);
  if ((n.kind === "crown" || n.kind === "people") && n.to === null) return `since ${ago(n.from)}`;
  if (n.to === null && livesOn(tree, n.id)) return `from ${ago(n.from)}, living on in its heirs`;
  return `${count(n.from)}–${count(end)} million years ago`;
}

/** What changed at a line's beginning, in a line of words. */
function changeWords(n: LifeNode): string {
  return n.innovations.length
    ? n.innovations.map((i) => `${i.what} (${i.why})`).join("; ")
    : "no change worth telling: a line apart from its mother's";
}

/** A line's ancestry as bodies in a row: the dawn's first steps, then its bodied forebears, then it. */
function lineupBlock(tree: TreeOfLife, id: number, title = "The bodies it came of"): Block {
  const line = lineOf(tree, id),
    bodied = line.filter((n) => n.body),
    shown = [...line.filter((n) => !n.body && n.kind === "dawn").slice(-2), ...bodied.slice(-7)];
  if (!shown.includes(line[line.length - 1]!)) shown.push(line[line.length - 1]!);
  return {
    type: "lineup",
    title,
    items: shown.map((n) => ({
      ref: n.ref,
      name: n.name,
      body: n.body,
      ...(n.body ? {} : { icon: iconOf(n) }),
      words: `${ago(n.from)}${n.innovations[0] ? ` · ${n.innovations[0].what}` : ""}`,
      ...(n.id === id ? { self: true } : {}),
    })),
  };
}

/** A line's ancestry as a list: each forebear, what changed and why. */
function lineItems(tree: TreeOfLife, id: number): Item[] {
  return lineOf(tree, id).map((n) =>
    item(
      [
        `${ago(n.from)} — `,
        link(n.name, n.ref),
        n.innovations.length ? `: ${n.innovations.map((i) => i.what).join(", ")}` : "",
      ],
      n.ref,
    ),
  );
}

/** What changed at a line's beginning, each with why. */
function innovationItems(n: LifeNode): Item[] {
  return n.innovations.map((i) =>
    item([`${i.what[0]!.toUpperCase()}${i.what.slice(1)} — ${i.why}`]),
  );
}

/** The tab a lineage's page gains: where it came from, body by body (Phase 17 M129). */
export function ancestryTab(world: World, species: number): Tab | null {
  const tree = treeOf(world),
    id = tree.ofSpecies[species] ?? -1;
  if (id < 0) return null;
  const n = tree.nodes[id]!,
    line = lineOf(tree, id),
    mother = line[line.length - 2],
    sisters = mother ? (tree.children[mother.id] ?? []).filter((c) => c !== id) : [],
    heirs = descendantsOf(tree, id);
  return {
    id: "ancestry",
    name: "Ancestry",
    blocks: [
      lineupBlock(tree, id),
      {
        type: "facts",
        rows: [
          ...(mother ? [stat("Came of", [link(mother.name, mother.ref)])] : []),
          stat("Arose", ago(n.from)),
          stat("Forebears", count(line.length - 1)),
          ...(sisters.length ? [stat("Sister lines", count(sisters.length))] : []),
          ...(heirs.length ? [stat("Daughter lines", count(heirs.length))] : []),
        ],
      },
      { type: "list", title: "What changed as it arose", items: innovationItems(n) },
      phyloBlock(
        tree,
        [...line.map((x) => x.id), ...sisters, ...heirs],
        "Its line in the tree of life",
        id,
      ),
      { type: "list", title: "Its line, from the first", items: lineItems(tree, id) },
    ],
  };
}

/** A line of the tree no living lineage is: its page. */
export function cladePage(world: World, ref: string): PageModel {
  const tree = treeOf(world),
    id = Number(ref.split(":")[2]),
    n = tree.nodes[id];
  if (!n || n.ref !== ref) throw new Error(`no line ${ref}`);
  const line = lineOf(tree, id),
    mother = line[line.length - 2],
    daughters = tree.children[id] ?? [],
    heirs = descendantsOf(tree, id),
    living = heirs.filter((h) => {
      const x = tree.nodes[h]!;
      return (x.kind === "crown" || x.kind === "people") && x.to === null && x.died === null;
    }),
    land = n.origin >= 0 ? landOfSpot(world, n.origin) : -1,
    stats: Stat[] = [
      stat("Arose", ago(n.from)),
      stat(
        n.to !== null ? "Died out" : "Lives on",
        n.to !== null ? ago(n.to) : `in ${count(living.length)} living lineages`,
      ),
      stat("Daughter lines", count(daughters.length)),
      ...(n.body ? [stat("Weight", massWords(n.body.size))] : []),
    ];
  const place: Place | null =
    land >= 0 && land < landsOf(world) ? { scale: "region", cell: land } : null;
  return {
    ref,
    kind: "clade",
    icon: iconOf(n),
    title: n.name[0]!.toUpperCase() + n.name.slice(1),
    subtitle: [n.what],
    crumbs: [link("The tree of life", "world:tree")],
    color: null,
    ...(n.body
      ? {
          portrait: {
            kind: "creature" as const,
            body: n.body,
            name: n.name,
            wool: n.body.covering === "wool",
          },
        }
      : {}),
    place,
    stats,
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          ...(n.body ? [{ type: "anatomy" as const, title: "Its body" }] : []),
          {
            type: "facts",
            rows: [
              stat("What it was", n.what),
              stat("Its way of life", wayWord(n.way)),
              stat("When", spanWords(tree, n)),
              ...(mother ? [stat("Came of", [link(mother.name, mother.ref)])] : []),
              ...(land >= 0 && land < landsOf(world)
                ? [stat("Where", [landLink(world, land)])]
                : []),
              ...(n.arose >= 0
                ? [
                    stat("Arose in", [
                      link(
                        `an age ${ageSpan(n.arose)[0]}–${ageSpan(n.arose)[1]} million years ago`,
                        ageRef(0, n.arose),
                      ),
                    ]),
                  ]
                : []),
              ...(n.fate ? [stat("Its end", n.fate)] : []),
            ],
          },
          { type: "list", title: "What changed as it arose", items: innovationItems(n) },
          { type: "why", ref },
        ],
      },
      {
        id: "ancestry",
        name: "Ancestry",
        blocks: [
          lineupBlock(tree, id),
          { type: "list", title: "Its line, from the first", items: lineItems(tree, id) },
        ],
      },
      {
        id: "heirs",
        name: "Heirs",
        blocks: [
          ...(heirs.length
            ? [phyloBlock(tree, [id, ...heirs], "What came of it", id)]
            : [{ type: "text" as const, lines: [["It left no daughter line."]] }]),
          {
            type: "list",
            title: "Its daughters",
            items: daughters.map((d) => {
              const x = tree.nodes[d]!;
              return item([link(x.name, x.ref), ` — ${spanWords(tree, x)}`], x.ref);
            }),
          },
        ],
      },
    ],
    followable: false,
    year: yearNow(world),
  };
}

/** The world's tree of life: the page (`world:tree`). */
export function treePage(world: World, tab?: string): PageModel {
  const tree = treeOf(world),
    g = fineOf(world),
    nodes = tree.nodes,
    living = nodes.filter(
      (n) => (n.kind === "crown" || n.kind === "people") && n.to === null && n.died === null,
    ),
    died = nodes.filter((n) => n.to !== null),
    kinds = nodes.filter((n) => n.kind === "stem"),
    innovations = nodes.reduce((a, n) => a + n.innovations.length, 0),
    first = tree.rungs[0]!;
  // The great dyings: the lines each age ended.
  const dyings = Array.from({ length: AGES }, (_, k) => ({
    k,
    n: died.filter((n) => n.to! <= ageSpan(k)[0] && n.to! > ageSpan(k)[1]).length,
  })).filter((d) => d.n > 0);
  const kindRows = kinds.map((n) => {
    const heirs = descendantsOf(tree, n.id).filter((h) => {
      const x = nodes[h]!;
      return (x.kind === "crown" || x.kind === "people") && x.to === null && x.died === null;
    });
    return {
      ref: n.ref,
      cells: [[link(n.name, n.ref)], [ago(n.from)], [count(heirs.length)]],
      keys: [n.name, n.from, heirs.length],
    };
  });
  const notable = nodes
    .flatMap((n) =>
      n.innovations
        .filter(
          (i) =>
            i.pressure !== null && !/grew to|shrank to|a little|neck|tail|came to eat/.test(i.what),
        )
        .map((i) => ({ n, i })),
    )
    .sort((a, b) => b.n.from - a.n.from || a.n.id - b.n.id);
  return {
    ref: "world:tree",
    kind: "tree",
    icon: "🌳",
    title: "The tree of life",
    subtitle: [
      `Every line of descent on this world, from ${first.name.toLowerCase()} ${ago(first.at)} to the ${count(living.length)} lineages living now`,
    ],
    color: null,
    place: null,
    stats: [
      stat("Lines ever", count(nodes.length)),
      stat("Living lineages", count(living.length)),
      stat("Died out", count(died.length)),
      stat("Kinds of body", count(kinds.length)),
      stat("First life", ago(first.at)),
      stat("Innovations", count(innovations)),
    ],
    ...(tab ? { tab } : {}),
    tabs: [
      {
        id: "tree",
        name: "Tree",
        blocks: [
          {
            type: "text",
            lines: [
              [
                `Each bar is a line of descent, from when it arose to when it died out (✝), to now, or to its last daughter. Lines hang from their mothers where they branched off. The world is ${ago(tree.worldAge).replace(" ago", " old")}: the dawn's long ages are drawn narrow, the ages of bodies wide.`,
              ],
            ],
          },
          phyloBlock(
            tree,
            nodes.map((n) => n.id),
          ),
        ],
      },
      {
        id: "dawn",
        name: "The dawn",
        blocks: [
          {
            type: "list",
            title: "Life before the ages",
            items: tree.rungs.map((r) =>
              item(
                [
                  `${ago(r.at)} — `,
                  r.node !== null ? link(r.name, nodes[r.node]!.ref) : r.name,
                  `: ${r.words}`,
                ],
                r.node !== null ? nodes[r.node]!.ref : null,
              ),
            ),
          },
          ...(g.prior !== "earthlike"
            ? []
            : [
                {
                  type: "text" as const,
                  lines: [
                    [
                      "On this world, as on Earth, life began in the water: its first billions of years were cells alone.",
                    ],
                  ],
                },
              ]),
        ],
      },
      {
        id: "kinds",
        name: "Kinds of body",
        blocks: [
          {
            type: "lineup",
            title: "The first of each kind",
            apart: true,
            items: kinds.map((n) => ({
              ref: n.ref,
              name: n.name,
              body: n.body,
              words: ago(n.from),
            })),
          },
          { type: "table", columns: ["Kind", "Arose", "Living heirs"], rows: kindRows },
        ],
      },
      {
        id: "innovations",
        name: "Innovations",
        blocks: [
          {
            type: "list",
            title: "What life came to do, oldest first",
            items: notable
              .slice(0, 90)
              .map(({ n, i }) =>
                item(
                  [`${ago(n.from)} — ${i.what}, in `, link(n.name, n.ref), ` (${i.why})`],
                  n.ref,
                ),
              ),
            ...(notable.length > 90 ? { more: notable.length - 90 } : {}),
          },
        ],
      },
      {
        id: "dyings",
        name: "Great dyings",
        blocks: [
          {
            type: "bars",
            title: "Lines that died out, age by age",
            bars: dyings.map((d) => ({
              label: [
                link(
                  `${ageSpan(d.k)[0]}–${ageSpan(d.k)[1]} My ago (${g.deep.ages[d.k]!.kind})`,
                  ageRef(0, d.k),
                ),
              ],
              ref: ageRef(0, d.k),
              value: d.n,
              color: (g.deep.ages[d.k]!.kind === "impact" ||
              g.deep.ages[d.k]!.kind === "great volcanism"
                ? [0.98, 0.36, 0.3]
                : [0.56, 0.7, 0.98]) as Rgb,
            })),
            unit: "count",
          },
        ],
      },
    ],
    followable: false,
    year: yearNow(world),
  };
}

/** The lines of the tree that arose and died in an age (for its page). */
export function ageLines(world: World, age: number): { arose: Item[]; died: Item[] } {
  const tree = treeOf(world),
    [a, b] = ageSpan(age),
    within = (my: number | null) => my !== null && my <= a && my > b,
    pick = (n: LifeNode) => n.species === null && n.kind !== "dawn";
  return {
    arose: tree.nodes
      .filter((n) => pick(n) && within(n.from))
      .map((n) => item([link(n.name, n.ref), ` — ${n.what}`], n.ref)),
    died: tree.nodes
      .filter((n) => pick(n) && within(n.to))
      .map((n) => item([link(n.name, n.ref), ` — ${n.fate ?? ""}`], n.ref)),
  };
}
