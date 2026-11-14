// node tools/goods-probe.ts <earth|alien> <file.save> [lands=3]: what a world's markets sell under each good (host/inspect/wares.ts), its
// lands' trade said specifically, its companies and exchanges (host/inspect/exchange.ts), and what each page costs to read. The greatest
// market towns first, then one of the middle. A whole world tallied too: how many lands name each thing first, so a claim no land should
// make everywhere shows. Reads a save; runs no years; one world to a process.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { loadWorld, rulesetId, seedFromText, type World } from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { GOODS } from "../src/rules/index.ts";
import { marketsOf, politiesOf, populationContext, realmName } from "../src/sim/index.ts";
import { tradeWords, waresBlock, waresOf } from "../src/host/inspect/wares.ts";
import { companiesOf, exchangeOf, landCompanyBlocks } from "../src/host/inspect/exchange.ts";
import { pageOf } from "../src/host/inspect/index.ts";
import { marketGoodRef } from "../src/sim/index.ts";

const [universe = "earth", file = "", lands = "3"] = process.argv.slice(2),
  U = universe === "earth" ? EARTH : ALIEN,
  doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as Parameters<
    typeof loadWorld
  >[0],
  world: World = loadWorld(
    doc,
    (s) => U.build(s),
    rulesetId(U.build(seedFromText(doc.seed)), U.version),
    {
      allowRulesetChange: true,
    },
  ).world,
  ctx = populationContext(world),
  plain = (l: readonly (string | { text: string })[]) =>
    l.map((s) => (typeof s === "string" ? s : s.text)).join("");
const year = Math.floor(world.now / (365.25 * 86400));
console.log(`\n=== ${doc.seed} (${universe}) year ${year}`);
const peopled = ctx.provinces
  .all()
  .filter((p) => p.total() > 0 && marketsOf(world).get(p.cell))
  .sort((a, b) => b.total() - a.total() || a.cell - b.cell);
// What this reading adds to a land's pages, read cold (nothing of the world read yet): every good's page block, its trade both ways, its
// companies; and the exchange of its realm, which reads every land of the realm.
{
  const cold = peopled[Math.floor(peopled.length * 0.75)]!,
    t0 = performance.now();
  for (let g = 0; g < GOODS.length; g++) waresBlock(world, cold.cell, g);
  tradeWords(world, cold.cell, "out");
  tradeWords(world, cold.cell, "in");
  landCompanyBlocks(world, cold.cell);
  const t1 = performance.now(),
    realm = politiesOf(world).of(cold.cell);
  if (realm) exchangeOf(world, realm.ref);
  console.log(
    `  cold, one land (${cold.cell}): its fourteen goods, its trade, its companies ${(t1 - t0).toFixed(1)} ms; its realm's exchange ${(performance.now() - t1).toFixed(1)} ms more`,
  );
}

// (The greatest few, the seat of the realm with the most companies listed, and one of the middle.)
const listed = politiesOf(world)
    .living()
    .map((r) => exchangeOf(world, r.ref))
    .filter((e): e is NonNullable<typeof e> => !!e)
    .sort((a, b) => b.companies.length - a.companies.length)[0],
  seatLand = listed
    ? peopled.find((p) => p.cell === politiesOf(world).get(listed.realm as never)?.seat)
    : undefined;
const pick = [
  ...peopled.slice(0, Number(lands) - 1),
  seatLand,
  peopled[Math.floor(peopled.length / 2)],
].filter((p, i, a) => p && a.indexOf(p) === i);
for (const p of pick) {
  if (!p) continue;
  const town =
    ctx.settlements.seenIn(p.cell).find((s) => s.market) ?? ctx.settlements.seenIn(p.cell)[0];
  console.log(
    `\n-- land ${p.cell} (${town?.name ?? "?"}, ${p.total()} people, ${(() => {
      const r = politiesOf(world).of(p.cell);
      return r ? realmName(r) : "no realm";
    })()})`,
  );
  for (let g = 0; g < GOODS.length; g++) {
    const w = waresOf(world, p.cell, g);
    if (!w.length) continue;
    const m = marketsOf(world).get(p.cell)!;
    if (!(m.stock[g]! > 0 || m.book("made", g) > 0 || m.book("in", g) > 0)) continue;
    console.log(
      `  ${GOODS[g]!.name}: ${w.map((x) => `${x.name} ${Math.round(x.share * 100)}%${x.from.length ? ` (${plain(x.from)})` : ""}`).join("; ")}`,
    );
  }
  const out = tradeWords(world, p.cell, "out"),
    inn = tradeWords(world, p.cell, "in");
  console.log(`  sends: ${out ? plain(out.line) : "nothing"}`);
  console.log(`  brings: ${inn ? plain(inn.line) : "nothing"}`);
  const cs = companiesOf(world, p.cell);
  if (cs.length)
    console.log(
      `  companies: ${cs.map((c) => `${c.name} (${c.what}, ${Math.round(c.share)} coin a share)`).join("; ")}`,
    );
}

// The whole world: what each land names first, under each good.
const firsts = new Map<string, Map<string, number>>(),
  tFirsts = performance.now();
for (const p of peopled)
  for (let g = 0; g < GOODS.length; g++) {
    const w = waresOf(world, p.cell, g)[0];
    if (!w) continue;
    const by = firsts.get(GOODS[g]!.name) ?? new Map<string, number>();
    by.set(w.name, (by.get(w.name) ?? 0) + 1);
    firsts.set(GOODS[g]!.name, by);
  }
console.log(
  `
-- first thing named, over ${peopled.length} lands (every land's every good read in ${(performance.now() - tFirsts).toFixed(0)} ms, the pick's lands already read)`,
);
for (const [good, by] of firsts)
  console.log(
    `  ${good}: ${[...by]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([n, k]) => `${n} ${k}`)
      .join(", ")}${by.size > 5 ? `, ${by.size - 5} more` : ""}`,
  );

// Exchanges: each realm's, its greatest companies and its index.
const ex = politiesOf(world)
  .living()
  .map((r) => exchangeOf(world, r.ref))
  .filter((e): e is NonNullable<typeof e> => !!e)
  .sort((a, b) => b.companies.length - a.companies.length);
console.log(`\n-- ${ex.length} exchanges`);
for (const e of ex.slice(0, 3))
  console.log(
    `  ${e.name}: ${e.companies.length} companies; first ${e.companies
      .slice(0, 4)
      .map((c) => `${c.name} ${Math.round(c.share)}`)
      .join(", ")}; index ${e.index.map((x) => `${x.year}:${Math.round(x.value)}`).join(" ")}`,
  );

// What a page costs to read: a good's page (its wares), a land's page (its trade, its companies), an exchange's, each first read and again.
const time = (what: string, f: () => unknown) => {
  const t0 = performance.now();
  f();
  const a = performance.now() - t0,
    t1 = performance.now();
  f();
  console.log(
    `  ${what}: ${a.toFixed(1)} ms first, ${(performance.now() - t1).toFixed(1)} ms again`,
  );
};
console.log(`\n-- read times`);
const top = pick[0]!;
time("a good's page (machines)", () => pageOf(world, marketGoodRef(top.cell, 11)));
time("a good's page (grain)", () => pageOf(world, marketGoodRef(top.cell, 0)));
time("a land's economy", () => pageOf(world, `cell:0:${top.cell}#economy`));
if (ex[0]) time("an exchange", () => pageOf(world, `exchange:${ex[0]!.realm}`));
