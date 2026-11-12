// A world's founding stocks, read (B1 of the life plan, docs/architecture/asks-2026-11-12-plan.md Part B): which
// stock each lineage descends from, as its tree of life puts it, and its look. The stocks are the first bodies on
// the tree after the dawn's own (the first walker and crawler ashore, and the swimmers, crawlers, burrowers and
// drifters of the dawn's seas): every line that came of one of them shares its plan. A world with more than six
// such lines folds the smallest into its nearest kin's (one of the same dawn body), so a world has three to six as
// the tree allows. Each stock's plan is drawn under the world's numbers (rules/stocks.ts), keyed on the world's
// digest and the stock's line, never on the seed's stream.
//
// A pure reading kept by the world's digest (the last few worlds asked of), worked out only when a beast is first
// drawn or told; never stored, never hashed: no world's history, name or save changes. Earth's beasts have none,
// and are drawn as they always were.
import { finish, hashString, mix } from "../kernel/index.ts";
import {
  kindPlan,
  lookOf,
  stockOf,
  type BeastLook,
  type CreatureBody,
  type Stock,
  type StockWorld,
} from "../rules/index.ts";
import { lineOf, treeOfLife, type LifeNode, type TreeOfLife } from "./evolution.ts";
import { climateMean } from "./bodies.ts";
import type { HomeWorld } from "./homeworld.ts";
import type { Species } from "./biosphere.ts";
import { worldLife } from "./life.ts";

/** The dawn's own bodies, from which the stocks came. */
const DAWN_WAYS: ReadonlySet<string> = new Set([
  "sea swimmer",
  "sea crawler",
  "burrower",
  "drifter",
  "walker",
  "land crawler",
]);

/** The most stocks a world keeps apart. */
const MOST_STOCKS = 6;

/** A world's stocks: each stock's plan, and each line's stock and its own kind's line. */
export type WorldStocks = {
  readonly stocks: readonly Stock[];
  /** Per line of the tree: its stock (-1: none, a line of the dawn before them or a plant). */
  readonly ofLine: Int16Array;
  /** Per line: the founder of its own kind (the line its kind's plan is keyed on; -1: none). */
  readonly kindLine: Int32Array;
  /** Per stock: its living lineages. */
  readonly living: readonly number[];
  readonly tree: TreeOfLife;
};

const KEPT = new Map<string, WorldStocks | null>();

/**
 * The world as generated on its fine grid, whose tree it is (a world the simulation runs on its provinces carries
 * its fine one): every reading here is of it, so a beast looks the same whichever is asked of.
 */
function fineOf(g: HomeWorld): HomeWorld {
  return (g as { readonly fine?: HomeWorld }).fine ?? g;
}

/** A keyed draw in [0, 1). */
function drawOf(key: string): (k: number) => number {
  const h = hashString(key);
  return (k: number) => finish(mix(h, k + 1), 2) / 4294967296;
}

/** A world's numbers as its stocks were shaped by them. */
export function stockWorldOf(g: HomeWorld): StockWorld {
  const life = worldLife(g);
  return {
    gravity: g.planet.gravity,
    warmth: climateMean(g.planet),
    star: g.star.temperature,
    insolation: g.planet.insolation,
    ocean: g.planet.oceanFraction,
    liquid: life.family,
    pigment: life.pigment,
    bone: life.bone,
    shell: life.shell,
    blood: life.blood,
  };
}

/** A world's stocks (null on an Earth-like world, whose beasts are Earth's, or one with none). */
export function worldStocks(world: HomeWorld): WorldStocks | null {
  const g = fineOf(world);
  if (g.prior === "earthlike" || !g.life.species.length) return null;
  const kept = KEPT.get(g.digest);
  if (kept !== undefined) return kept;
  const tree = treeOfLife(g);
  if (g.physical) {
    const out = physicalStocks(g, tree);
    if (KEPT.size >= 6) KEPT.delete(KEPT.keys().next().value!);
    KEPT.set(g.digest, out);
    return out;
  }
  const nodes = tree.nodes,
    n = nodes.length,
    first = new Int32Array(n).fill(-1),
    dawnOf = new Int32Array(n).fill(-1),
    kindLine = new Int32Array(n).fill(-1);
  // Each line's first stem after the dawn's own, the dawn body it came of, and its own kind's founder.
  for (const node of nodes) {
    if (!node.genome || node.kind === "dawn" || node.kind === "plant") continue;
    const line = lineOf(tree, node.id);
    let dawn = -1,
      found = -1,
      kind = -1;
    for (const a of line) {
      if (a.kind === "stem" && DAWN_WAYS.has(a.way)) dawn = a.id;
      else if (a.kind === "stem") {
        if (found < 0) found = a.id;
        kind = a.id;
      }
    }
    first[node.id] = found;
    dawnOf[node.id] = dawn;
    kindLine[node.id] = kind;
  }
  // The groups: each first stem's lines, the largest (in lineages the biosphere holds) first.
  const groups = new Map<number, number[]>();
  for (const node of nodes) {
    const f = first[node.id]!;
    if (f >= 0) groups.set(f, [...(groups.get(f) ?? []), node.id]);
  }
  const held = (ids: readonly number[]) => ids.filter((i) => nodes[i]!.species !== null).length;
  let order = [...groups.keys()].sort(
    (a, b) => held(groups.get(b)!) - held(groups.get(a)!) || a - b,
  );
  // More than a world keeps apart: the smallest folded into the largest of the same dawn body, else the largest.
  while (order.length > MOST_STOCKS) {
    const small = order[order.length - 1]!,
      dawn = dawnOf[small]!,
      into = order.slice(0, -1).find((f) => dawnOf[f] === dawn && dawn >= 0) ?? order[0]!;
    groups.set(into, [...groups.get(into)!, ...groups.get(small)!]);
    groups.delete(small);
    order = order.slice(0, -1);
  }
  // Numbered by when their first line arose, the oldest first.
  order = [...order].sort((a, b) => nodes[b]!.from - nodes[a]!.from || a - b);
  const numbers = stockWorldOf(g),
    ofLine = new Int16Array(n).fill(-1),
    names = new Set<string>(),
    stocks: Stock[] = order.map((f, id) => {
      let s = stockOf(numbers, drawOf(`stock ${g.digest} ${f}`), id);
      // (Two stocks of one world never share a name.)
      for (let k = 1; names.has(s.name) && k < 6; k++)
        s = {
          ...s,
          name: s.name.replace(" stock", ` stock ${["", "II", "III", "IV", "V", "VI"][k]}`),
        };
      names.add(s.name);
      for (const i of groups.get(f)!) ofLine[i] = id;
      return s;
    });
  // A line of the dawn is drawn of the stock its first descendant founded.
  for (const node of nodes)
    if (ofLine[node.id]! < 0 && node.genome && node.kind === "stem") {
      const kid = order.findIndex((f) => lineOf(tree, f).some((a) => a.id === node.id));
      ofLine[node.id] = kid >= 0 ? kid : 0;
    }
  const living = stocks.map(() => 0);
  for (const s of g.life.species) {
    if (s.died !== null || !s.body) continue;
    const at = ofLine[tree.ofSpecies[s.index] ?? -1] ?? -1;
    if (at >= 0) living[at]!++;
  }
  const out: WorldStocks = { stocks, ofLine, kindLine, living, tree };
  if (KEPT.size >= 6) KEPT.delete(KEPT.keys().next().value!);
  KEPT.set(g.digest, out);
  return out;
}

/**
 * The stocks of a world whose living things were read from its physics (B3): its own founding stocks, every lineage
 * of which says which it came of; each line of the tree is of its genome's stock, and a stock's look is drawn as
 * any is (rules/stocks.ts), keyed on the world and the stock.
 */
function physicalStocks(g: HomeWorld, tree: TreeOfLife): WorldStocks {
  const nodes = tree.nodes,
    n = nodes.length,
    ids = [
      ...new Set(
        g.life.species.flatMap((s) => (s.body?.stock !== undefined ? [s.body.stock] : [])),
      ),
    ].sort((a, b) => a - b),
    at = new Map(ids.map((id, i) => [id, i])),
    numbers = stockWorldOf(g),
    names = new Set<string>(),
    stocks: Stock[] = ids.map((id, i) => {
      let s = stockOf(numbers, drawOf(`stock ${g.digest} ${id}`), i);
      for (let k = 1; names.has(s.name) && k < 6; k++)
        s = {
          ...s,
          name: s.name.replace(" stock", ` stock ${["", "II", "III", "IV", "V", "VI"][k]}`),
        };
      names.add(s.name);
      return s;
    }),
    ofLine = new Int16Array(n).fill(-1),
    kindLine = new Int32Array(n).fill(-1);
  for (const node of nodes) {
    const st = node.genome?.stock;
    if (st !== undefined && at.has(st)) ofLine[node.id] = at.get(st)!;
  }
  // (A line's kind is its first stem of its stock on the way down to it.)
  for (const node of nodes) {
    if (ofLine[node.id]! < 0) continue;
    for (const a of lineOf(tree, node.id))
      if (a.kind === "stem" && ofLine[a.id] === ofLine[node.id]) {
        kindLine[node.id] = a.id;
        break;
      }
  }
  const living = stocks.map(() => 0);
  for (const s of g.life.species) {
    if (s.died !== null || !s.body || s.body.stock === undefined) continue;
    const i = at.get(s.body.stock);
    if (i !== undefined) living[i]!++;
  }
  return { stocks, ofLine, kindLine, living, tree };
}

const LOOKS = new Map<string, BeastLook | null>();

/** A line's look on the tree (null: Earth's, or a line drawn of no stock). */
export function lineLookOf(world: HomeWorld, line: number): BeastLook | null {
  const g = fineOf(world),
    ws = worldStocks(g),
    node: LifeNode | undefined = ws?.tree.nodes[line];
  if (!ws || !node?.body) return null;
  const key = `${g.digest} ${line}`,
    kept = LOOKS.get(key);
  if (kept !== undefined) return kept;
  const at = ws.ofLine[line] ?? -1;
  let look: BeastLook | null = null;
  if (at >= 0) {
    const stock = ws.stocks[at]!,
      kind = ws.kindLine[line] ?? -1,
      // (The stock's first line bears its plan as it is; another kind's line may have changed one deep trait.)
      plan =
        kind >= 0 && !isFirst(ws, kind)
          ? kindPlan(stock, drawOf(`kind ${g.digest} ${kind}`))
          : stock,
      genome = node.genome;
    look = lookOf(
      plan,
      node.body,
      drawOf(`look ${g.digest} ${node.ref}`),
      Math.max(0, (ws.living[at] ?? 1) - (node.kind === "crown" && node.to === null ? 1 : 0)),
      genome ? { eyes: genome.eyes, feelers: genome.feelers, pattern: genome.pattern } : null,
    );
  }
  if (LOOKS.size >= 2048) LOOKS.delete(LOOKS.keys().next().value!);
  LOOKS.set(key, look);
  return look;
}

/** Whether a line is a stock's own first line (whose kind bears the stock's plan unchanged). */
function isFirst(ws: WorldStocks, line: number): boolean {
  const node = ws.tree.nodes[line]!,
    parent = node.parent >= 0 ? ws.tree.nodes[node.parent] : undefined;
  return !!parent && (parent.kind === "dawn" || DAWN_WAYS.has(parent.way));
}

/** A lineage's look (null: Earth's, a grass, or one the tree drew of no stock). */
export function beastLookOf(g: HomeWorld, s: Species): BeastLook | null {
  if (!s.body || g.prior === "earthlike") return null;
  const ws = worldStocks(g);
  if (!ws) return null;
  const line = ws.tree.ofSpecies[s.index] ?? -1;
  return line >= 0 ? lineLookOf(g, line) : null;
}

/** A lineage's body as it crosses to the page: its facts, and its look where it has one. */
export function beastPlanOf(
  g: HomeWorld,
  s: Species,
): (CreatureBody & { readonly look?: BeastLook }) | null {
  if (!s.body) return null;
  const look = beastLookOf(g, s);
  return look ? { ...s.body, look } : s.body;
}

/** The stock a world's people came of, through their forebears (null: Earth's, or none). */
export function peopleStock(g: HomeWorld): BeastLook | null {
  const ws = worldStocks(g);
  if (!ws) return null;
  const them = ws.tree.nodes.find((n) => n.kind === "people");
  if (!them || them.parent < 0) return null;
  const fore = ws.tree.nodes[them.parent]!;
  // (Their forebears' own look where the tree drew a body for them, else the stock of the line they came of.)
  if (fore.body) return lineLookOf(g, fore.id);
  const up = fore.parent >= 0 ? lineLookOf(g, fore.parent) : null;
  return up;
}
