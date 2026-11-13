// node tools/looks-probe.ts <earth|alien> <file.save>: the pictures of what a world's markets sell (host/inspect/ware-looks.ts), every land,
// every good: how many things are drawn and how many have no picture, by their kind; that each draws to solids (ui/specimen.ts's parts, a
// beast's body); what they cost to read; and a few of them said as their shape and colour. Reads a save; runs no years.
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { loadWorld, rulesetId, seedFromText, type World } from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { GOODS } from "../src/rules/index.ts";
import { marketsOf, politiesOf, populationContext } from "../src/sim/index.ts";
import { waresBlock, waresOf } from "../src/host/inspect/wares.ts";
import { companiesOf, exchangeOf, exchangePage } from "../src/host/inspect/exchange.ts";
import { specimenParts } from "../src/ui/specimen.ts";
import type { Portrait } from "../src/bridge/index.ts";

const [universe = "earth", file = "", dump = ""] = process.argv.slice(2),
  U = universe === "earth" ? EARTH : ALIEN,
  doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as Parameters<
    typeof loadWorld
  >[0],
  world: World = loadWorld(
    doc,
    (s) => U.build(s),
    rulesetId(U.build(seedFromText(doc.seed)), U.version),
    { allowRulesetChange: true },
  ).world,
  ctx = populationContext(world);
const year = Math.floor(world.now / (365.25 * 86400));
console.log(`\n=== ${doc.seed} (${universe}) year ${year}`);
const lands = ctx.provinces
  .all()
  .filter((p) => p.total() > 0 && marketsOf(world).get(p.cell))
  .sort((a, b) => b.total() - a.total() || a.cell - b.cell);

const said = (p: Portrait): string =>
  p.kind === "thing"
    ? `${p.form} (${p.made}, ${p.color.map((c) => c.toFixed(2)).join("/")})`
    : p.kind === "plant"
      ? `${p.form} (seed ${p.seed.toFixed(2)}, leaf ${p.leaf.map((c) => c.toFixed(2)).join("/")})`
      : p.kind === "creature"
        ? `beast ${p.name}`
        : p.kind === "company"
          ? `mark ${p.arms.division} + ${p.good ? said(p.good) : "nothing"}`
          : p.kind === "element"
            ? `element ${p.symbol}`
            : p.kind;
const drawn = (p: Portrait): boolean =>
  p.kind === "creature" ? !!p.body : p.kind === "company" ? true : specimenParts(p).length > 0;

const t0 = performance.now();
let parts = 0,
  pictured = 0,
  blank = 0,
  empty = 0;
const byKind = new Map<string, { pictured: number; none: number }>(),
  shapes = new Map<string, number>(),
  ex: string[] = [],
  /** One of each picture's shape, for a sheet of them (with a third argument: the file to write them to). */
  sheet = new Map<string, { name: string; p: Portrait }>();
for (const p of lands)
  for (let g = 0; g < GOODS.length; g++) {
    const b = waresBlock(world, p.cell, g);
    if (!b || b.type !== "composition") continue;
    const wares = waresOf(world, p.cell, g);
    b.parts.forEach((x, i) => {
      const w = wares[i]!;
      if (w.key === "others") return;
      parts++;
      const kind = w.key.split(":")[0]!,
        k = byKind.get(kind) ?? { pictured: 0, none: 0 };
      byKind.set(kind, k);
      if (!x.thumb) {
        k.none++;
        blank++;
        return;
      }
      k.pictured++;
      pictured++;
      if (!drawn(x.thumb)) empty++;
      const s = said(x.thumb);
      if (!sheet.has(s.replace(/ \(.*/, "")))
        sheet.set(s.replace(/ \(.*/, ""), { name: w.name, p: x.thumb });
      shapes.set(s.replace(/ \(.*/, ""), (shapes.get(s.replace(/ \(.*/, "")) ?? 0) + 1);
      if (ex.length < 12 && !ex.some((e) => e.startsWith(w.name))) ex.push(`${w.name} → ${s}`);
    });
  }
const t1 = performance.now();
console.log(
  `  ${lands.length} lands: ${parts} things named, ${pictured} with a picture, ${blank} without, ${empty} drawn empty; read in ${(t1 - t0).toFixed(0)} ms (the wares and their pictures)`,
);
for (const [k, v] of [...byKind].sort())
  console.log(`    ${k}: ${v.pictured} pictured, ${v.none} not`);
console.log(
  `  shapes: ${[...shapes]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 24)
    .map(([s, n]) => `${s} ${n}`)
    .join("; ")}`,
);
for (const e of ex) console.log(`    ${e}`);

// The exchanges' marks.
const exchanges = politiesOf(world)
  .living()
  .map((r) => exchangeOf(world, r.ref))
  .filter((e): e is NonNullable<typeof e> => !!e)
  .sort((a, b) => b.companies.length - a.companies.length);
if (exchanges.length) {
  const e = exchanges[0]!,
    t2 = performance.now(),
    page = exchangePage(world, `exchange:${e.realm}`),
    t3 = performance.now(),
    board = page.tabs[0]!.blocks.find((b) => b.type === "board");
  const rows = board?.type === "board" ? board.rows : [];
  console.log(
    `  ${e.name}: ${rows.length} rows, ${rows.filter((r) => r.thumb).length} with a mark (page ${(t3 - t2).toFixed(1)} ms)`,
  );
  for (const r of rows.slice(0, 5))
    console.log(`    ${r.name} → ${r.thumb ? said(r.thumb) : "none"}`);
  for (const r of rows.slice(0, 3)) if (r.thumb) sheet.set(r.name, { name: r.name, p: r.thumb });
} else {
  const any = lands.flatMap((p) => companiesOf(world, p.cell)).length;
  console.log(`  no exchange (${any} companies)`);
}

if (dump) {
  writeFileSync(dump, JSON.stringify([...sheet.values()]));
  console.log(`  ${sheet.size} pictures for a sheet in ${dump}`);
}
