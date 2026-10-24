import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { homePlanet } from "../../src/sim/index.ts";
import { isProvinceWorld, lineOf, treeOfLife } from "../../src/gen/index.ts";
import { why } from "../../src/causal/index.ts";
import type { Block, Line, PageModel } from "../../src/bridge/index.ts";

const world = EARTH.build(seedFromText("first light"));
world.runTo(3 * YEAR);
const page = (ref: string) => EARTH.queries.page!(world, { ref }) as PageModel,
  g = homePlanet(world).generated,
  fine = isProvinceWorld(g) ? g.fine : g,
  tree = treeOfLife(fine);

/** Every ref a block names: its lines' links, its rows', its charted lines' and its bodies'. */
function refsOf(blocks: readonly Block[]): string[] {
  const out: string[] = [],
    line = (l: Line) => {
      for (const s of l) if (typeof s !== "string") out.push(s.ref);
    };
  for (const b of blocks) {
    if (b.type === "phylo") out.push(...b.lines.map((l) => l.ref));
    if (b.type === "lineup") out.push(...b.items.map((i) => i.ref));
    if (b.type === "list")
      for (const i of b.items) {
        line(i.line);
        if (i.ref) out.push(i.ref);
      }
    if (b.type === "facts") for (const r of b.rows) line(r.value);
    if (b.type === "table") for (const r of b.rows) for (const c of r.cells) line(c);
    if (b.type === "bars") for (const x of b.bars) line(x.label);
  }
  return out;
}

test("the tree of life has a page: every line charted, its dawn, its kinds of body, its innovations, its dyings", () => {
  const p = page("world:tree");
  assert.equal(p.kind, "tree");
  assert.equal(p.title, "The tree of life");
  assert.deepEqual(
    p.tabs.map((t) => t.id),
    ["tree", "dawn", "kinds", "innovations", "dyings"],
  );
  for (const t of p.tabs) assert.ok(t.blocks.length > 0, `${t.name} has blocks`);
  const chart = p.tabs[0]!.blocks.find((b) => b.type === "phylo");
  assert.ok(chart && chart.type === "phylo");
  assert.equal(chart.lines.length, tree.nodes.length, "every line of the tree is charted");
  assert.ok(chart.fold !== undefined && chart.fold < chart.from, "the dawn is folded");
  // The lines' fates: the living run to now, the dead end where they died.
  for (const l of chart.lines) {
    const n = tree.nodes[l.id]!;
    assert.equal(l.ref, n.ref);
    assert.ok(l.end <= l.from);
    if (l.fate === "lives") assert.equal(l.end, 0);
    if (l.fate === "died") assert.equal(l.end, n.to);
  }
  assert.equal(
    String(p.stats.find((s) => s.label === "Lines ever")!.value),
    String(tree.nodes.length),
  );
  // A tab asked for is the tab it opens on.
  assert.equal(page("world:tree#kinds").tab ?? "kinds", "kinds");
});

test("every line of the tree opens a page, and every name on those pages leads to one", () => {
  const seen = new Set<string>();
  for (const n of tree.nodes) {
    const p = page(n.ref);
    assert.notEqual(p.kind, "unknown", `${n.name} has a page`);
    assert.equal(p.kind, n.species !== null ? "lineage" : "clade", n.name);
    if (n.species === null) {
      assert.equal(p.crumbs?.length ? "crumbs" : "", "crumbs", `${n.name} leads up to the tree`);
      assert.ok(p.tabs.some((t) => t.id === "ancestry"));
    }
    for (const t of p.tabs) for (const r of refsOf(t.blocks)) seen.add(r);
  }
  for (const r of [...seen]
    .filter((r) => r.startsWith("clade:") || r.startsWith("age:"))
    .slice(0, 60))
    assert.notEqual(page(r).kind, "unknown", `${r} leads to a page`);
});

test("a lineage's page tells its ancestry: the bodies it came of, its line charted, what changed", () => {
  const s = g.life.species.find((x) => x.body && x.died === null && x.niche === "grazer")!,
    p = page(s.ref),
    tab = p.tabs.find((t) => t.id === "ancestry");
  assert.ok(tab, `${s.name} has an ancestry`);
  const lineup = tab.blocks.find((b) => b.type === "lineup"),
    chart = tab.blocks.find((b) => b.type === "phylo");
  assert.ok(lineup && lineup.type === "lineup");
  assert.equal(lineup.items.at(-1)!.ref, s.ref, "it stands last, after its forebears");
  assert.ok(lineup.items.at(-1)!.self);
  assert.ok(lineup.items.filter((i) => i.body).length >= 2, "its forebears' bodies are drawn");
  assert.ok(chart && chart.type === "phylo");
  const id = tree.ofSpecies[s.index]!;
  assert.equal(chart.focus, id);
  for (const f of lineOf(tree, id))
    assert.ok(
      chart.lines.some((l) => l.id === f.id),
      `${f.name} is charted`,
    );
  // The people's page tells theirs.
  const people = g.life.species.find((x) => x.niche === "upright ape");
  if (people) assert.ok(page(people.ref).tabs.some((t) => t.id === "ancestry"));
});

test("why a line arose is told from the line it came of", () => {
  const ghost = tree.nodes.find((n) => n.kind === "stem" && n.parent >= 0)!,
    e = why(world, ghost.ref as Ref);
  assert.equal(e.basis, "generated");
  assert.ok(e.claim.includes(ghost.name), e.claim);
  assert.ok(
    e.causes.some((c) => c.cause.ref === tree.nodes[ghost.parent]!.ref),
    "its mother is a cause",
  );
  // A lineage's why names its mother line too.
  const s = g.life.species.find((x) => x.body && x.niche === "grazer")!,
    mother = tree.nodes[tree.nodes[tree.ofSpecies[s.index]!]!.parent]!;
  assert.ok(
    why(world, s.ref as Ref).causes.some((c) => c.cause.ref === mother.ref),
    `${s.name}'s why names ${mother.name}`,
  );
});

test("looking at the tree never changes history", () => {
  const before = JSON.stringify(world.domainHashes());
  page("world:tree");
  for (const n of tree.nodes.slice(0, 30)) page(n.ref);
  assert.equal(JSON.stringify(world.domainHashes()), before);
});
