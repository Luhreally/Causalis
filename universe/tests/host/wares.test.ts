import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { GOODS, G, keptLife } from "../../src/rules/index.ts";
import { marketGoodRef, marketsOf, politiesOf, populationContext } from "../../src/sim/index.ts";
import {
  WARES_SHOWN,
  betweenItems,
  betweenWords,
  grainName,
  tradeItems,
  tradeWords,
  shod,
  toolForm,
  waresBlock,
  waresOf,
} from "../../src/host/inspect/wares.ts";
import { companiesOf, exchangeOf, exchangePage } from "../../src/host/inspect/exchange.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { wareLook } from "../../src/host/inspect/ware-looks.ts";
import { ALIEN } from "../../src/host/planet.ts";
import { homePlanet } from "../../src/sim/index.ts";
import { specimenParts } from "../../src/ui/specimen.ts";
import type { Line } from "../../src/bridge/index.ts";

// What is sold under each good (asked 2026-11-12): each of a market's broad goods split into the few named things a land makes or is
// brought, with shares; a land's trade said as those things; companies and an exchange late in a world. The first light's world in its
// age of works and lending (700), read whole: every land, every good.
const world = EARTH.build(seedFromText("first light"));
world.runTo(700 * YEAR);
const words = (l: Line) => l.map((s) => (typeof s === "string" ? s : s.text)).join("");
const ctx = populationContext(world),
  lands = ctx.provinces.all().filter((p) => p.total() > 0 && marketsOf(world).get(p.cell));

test("a grass is sold as its grain, a millet as itself", () => {
  assert.equal(grainName({ name: "brindled water grass" }), "brindled water grain");
  assert.equal(grainName({ name: "dun millet" }), "dun millet");
});

test("every land's every good it has splits into a few named things whose shares make the whole", () => {
  let named = 0;
  for (const p of lands)
    for (let g = 0; g < GOODS.length; g++) {
      const m = marketsOf(world).get(p.cell)!,
        has = m.stock[g]! > 0 || m.book("made", g) > 0 || m.book("in", g) > 0,
        w = waresOf(world, p.cell, g);
      assert.equal(w.length > 0, has, `land ${p.cell} ${GOODS[g]!.id}: named only what it has`);
      if (!has) continue;
      named++;
      assert.ok(w.length <= WARES_SHOWN + 1, `land ${p.cell} ${GOODS[g]!.id}: ${w.length} things`);
      const sum = w.reduce((n, x) => n + x.share, 0);
      assert.ok(Math.abs(sum - 1) < 1e-6, `land ${p.cell} ${GOODS[g]!.id}: shares sum to ${sum}`);
      for (const x of w) {
        assert.ok(x.name && !/undefined|NaN|\[object/.test(x.name), `a name: "${x.name}"`);
        assert.ok(x.share > 0, `${x.name} has a share`);
        if (x.key !== "others")
          assert.ok(words(x.from).length > 4, `${x.name} says where it is from`);
      }
      // (Read again in the same moment, the same: cached, never moved.)
      assert.equal(waresOf(world, p.cell, g), w);
    }
  assert.ok(named > lands.length * 4, `${named} goods named over ${lands.length} lands`);
});

test("tools name their metal and machines name their kind, by what a land knows", () => {
  const tools = new Set<string>(),
    machines = new Set<string>();
  for (const p of lands) {
    for (const w of waresOf(world, p.cell, G.tools)) tools.add(w.name);
    for (const w of waresOf(world, p.cell, G.machines)) machines.add(w.name);
  }
  assert.ok(
    [...tools].some((n) => /^(iron|steel|bronze|copper) /.test(n)),
    `metal tools: ${[...tools].join("; ")}`,
  );
  assert.ok(
    [...machines].some((n) => /engines|looms|locomotives|clocks|dynamos|motor/.test(n)),
    `machines by kind: ${[...machines].join("; ")}`,
  );
  // (Nothing named that no land of the world could make: no phones before anyone has machines in the pocket.)
  assert.ok(![...machines].includes("phones"), "no phones at 700");
});

test("a good's page opens on what is sold under it", () => {
  const p = lands.find((x) => marketsOf(world).get(x.cell)!.book("made", G.tools) > 0)!;
  // (Before its numbers: only a line a page of any kind may open with stands above it.)
  const page = pageOf(world, marketGoodRef(p.cell, G.tools)),
    blocks = page.tabs[0]!.blocks,
    at = blocks.findIndex((b) => b.type === "composition"),
    first = blocks[at]!;
  assert.ok(
    at >= 0 && at < blocks.findIndex((b) => b.type === "facts"),
    `blocks: ${blocks.map((b) => b.type)}`,
  );
  assert.equal(first.type, "composition");
  assert.match(
    first.type === "composition" ? (first.title ?? "") : "",
    /What is sold as tools here/,
  );
  assert.deepEqual(waresBlock(world, p.cell, G.tools), first);
});

test("a land's trade is said as the things themselves, a few partners at most", () => {
  let said = 0;
  for (const p of lands) {
    const out = tradeWords(world, p.cell, "out");
    if (!out) continue;
    said++;
    const text = words(out.line);
    assert.ok(!/undefined|NaN|\[object/.test(text), text);
    assert.ok(/ to /.test(text), text);
    assert.ok(text.split(";").length <= 4, text);
  }
  assert.ok(said > 10, `${said} lands send something`);
  const f = marketsOf(world).flows.find((x) => x.from !== x.to)!;
  assert.match(words(betweenWords(world, f.from, f.to) ?? []), / to /);
});

test("companies are a land's works with lending, named for its town and what it makes; an exchange lists them with an index", () => {
  const all = lands.flatMap((p) => companiesOf(world, p.cell));
  assert.ok(all.length > 0, "companies by 700");
  for (const c of all) {
    assert.ok(c.town && c.name.startsWith(c.town.name), c.name);
    assert.ok(c.share > 0 && c.share < 20_000, `${c.name}: ${c.share} coin a share`);
    assert.ok(c.years.length >= 2, `${c.name}: its books`);
  }
  const ex = politiesOf(world)
    .living()
    .map((r) => exchangeOf(world, r.ref))
    .find((e) => !!e);
  assert.ok(ex, "an exchange by 700");
  assert.ok(ex.companies.length >= 2 && ex.index.length >= 2 && ex.index[0]!.value === 100);
  const page = exchangePage(world, `exchange:${ex.realm}`),
    blocks = page.tabs[0]!.blocks;
  assert.equal(page.title, ex.name);
  assert.ok(blocks.some((b) => b.type === "board" && b.rows.length >= 2));
  assert.ok(blocks.some((b) => b.type === "chart" && b.points.length >= 2));
  // (A realm with none, or no realm: a page that says so.)
  assert.match(JSON.stringify(exchangePage(world, "exchange:pol:0:999999").tabs), /No exchange/);
});

test("each thing sold has a picture drawn from what it is, where the page lists it", () => {
  let parts = 0,
    pictured = 0;
  const kinds = new Set<string>();
  for (const p of lands)
    for (let g = 0; g < GOODS.length; g++) {
      const b = waresBlock(world, p.cell, g);
      if (b?.type !== "composition") continue;
      for (const x of b.parts) {
        if (/^And others/.test(words(x.name))) continue;
        parts++;
        if (!x.thumb) continue;
        pictured++;
        kinds.add(x.thumb.kind === "thing" ? x.thumb.form : x.thumb.kind);
        // (A specimen draws to solids; a beast has a body to draw.)
        if (x.thumb.kind === "creature") assert.ok(x.thumb.body);
        else assert.ok(specimenParts(x.thumb).length > 0, JSON.stringify(x.thumb));
      }
    }
  assert.ok(pictured >= parts * 0.97, `${pictured} of ${parts} things pictured`);
  for (const k of ["creature", "plant", "axe", "storage jar", "tunic"])
    assert.ok(kinds.has(k), `a ${k} among ${[...kinds].join(", ")}`);
  assert.ok(
    [...kinds].some((k) => /engine|loom|clock|locomotive/.test(k)),
    "a machine drawn",
  );
  // (The trade's lines, each a picture of the greatest thing that went.)
  const sent = lands.map((p) => tradeItems(world, p.cell, "out")).find((t) => !!t)!;
  assert.ok(sent.items.length > 0 && sent.items.every((i) => !!i.thumb));
  const f = marketsOf(world).flows.find((x) => x.from !== x.to)!;
  assert.ok(betweenItems(world, f.from, f.to).every((i) => !!i.thumb));
  // (The exchange's companies, each with its mark: its realm's shield and what it makes.)
  const ex = politiesOf(world)
    .living()
    .map((r) => exchangePage(world, `exchange:${r.ref}`).tabs[0]!.blocks)
    .find((bs) => bs.some((b) => b.type === "board"))!;
  const board = ex.find((b) => b.type === "board")!;
  assert.ok(board.type === "board" && board.rows.every((r) => r.thumb?.kind === "company"));
});

test("a grain is drawn in its world's own leaf: Earth's green and a far world's are not the same", () => {
  const far = ALIEN.build(seedFromText("alien 7")),
    grass = (w: typeof world) =>
      homePlanet(w).generated.life.species.find((s) => s.niche === "seed grass")!,
    a = grass(world),
    b = grass(far),
    pa = wareLook(world, 0, G.grain, { key: `grass:${a.index}`, ref: a.ref }),
    pb = wareLook(far, 0, G.grain, { key: `grass:${b.index}`, ref: b.ref });
  assert.ok(pa?.kind === "plant" && pb?.kind === "plant");
  assert.notDeepEqual(pa.leaf, pb.leaf);
  assert.notDeepEqual(specimenParts(pa), specimenParts(pb));
});

test("one thing, one picture: a tool row is one tool of one metal, a garment row one garment, each drawn as itself", () => {
  const tools = new Set<string>(),
    worn = new Set<string>();
  for (const p of lands) {
    for (const w of waresOf(world, p.cell, G.tools)) {
      if (!w.key.startsWith("tools:")) continue;
      const [, , kind] = w.key.split(":"),
        look = wareLook(world, p.cell, G.tools, w);
      assert.ok(kind, `${w.key}: a tool row names its kind`);
      assert.ok(!/ and |,/.test(w.name), `${w.name}: one thing, not several`);
      assert.ok(
        look?.kind === "thing" && look.form === toolForm(kind),
        `${w.name} drawn as ${JSON.stringify(look)}`,
      );
      tools.add(toolForm(kind));
    }
    for (const w of waresOf(world, p.cell, G.clothing)) {
      if (w.key === "others") continue;
      const look = wareLook(world, p.cell, G.clothing, w),
        form = w.key.split(":").at(-1)!;
      assert.ok(!/ and |,/.test(w.name), `${w.name}: one garment`);
      assert.ok(
        look?.kind === "thing" && look.form === form,
        `${w.name} drawn as ${JSON.stringify(look)}`,
      );
      worn.add(form);
    }
  }
  for (const t of ["axe", "saw", "sickle", "plough share"])
    assert.ok(tools.has(t), `${t} among the tools sold: ${[...tools].join(", ")}`);
  assert.ok(
    [...worn].some((f) => /tunic|shirt|gown|dress/.test(f)),
    `a garment: ${[...worn].join(", ")}`,
  );
  assert.ok(
    [...worn].some((f) => /boot|shoe|sandal/.test(f)),
    `footwear: ${[...worn].join(", ")}`,
  );
  // (Earth's people go on feet; a people of the water has none to shoe.)
  assert.equal(shod(world), true);
  // (Kestrel 557 as it was made, life kept: its own tree's people walk.)
  assert.equal(shod(ALIEN.build(seedFromText(keptLife("kestrel 557")))), false);
});

test("reading moves no history", () => {
  const before = JSON.stringify(world.domainHashes());
  for (const p of lands.slice(0, 20)) {
    pageOf(world, `cell:0:${p.cell}#economy`);
    for (let g = 0; g < GOODS.length; g++) waresOf(world, p.cell, g);
  }
  assert.equal(JSON.stringify(world.domainHashes()), before);
});
