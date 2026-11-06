// node tools/m1-tally.ts <universe:seed:file>...: every town of a far save's board and what it is known for, tallied. How many of each thing, the commonest sentence and its share, what share of boards are nearly empty, how many goods read dear at once, the largest and smallest numbers on any board, what opening costs. Reads, runs no years.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { loadWorld, rulesetId, seedFromText, type World } from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { boardOf, dearPage, knownInLand, boardPage } from "../src/host/inspect/board.ts";
import { politiesOf, populationContext } from "../src/sim/index.ts";

for (const arg of process.argv.slice(2)) {
  const [universe, seed, file] = arg.split("|") as [string, string, string],
    U = universe === "earth" ? EARTH : ALIEN,
    doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as Parameters<
      typeof loadWorld
    >[0],
    world: World = loadWorld(doc, U.build, rulesetId(U.build(seedFromText(seed)), U.version), {
      allowRulesetChange: true,
    }).world;
  const ctx = populationContext(world),
    lands = ctx.provinces.all().filter((p) => p.total() > 0),
    sentences = new Map<string, number>(),
    keys = new Map<string, number>(),
    realmTop = new Map<string, Map<string, number>>(),
    samples: string[] = [];
  let towns = 0,
    none = 0,
    ms = 0,
    thin = 0,
    boards = 0,
    dearMost = 0,
    dearSum = 0,
    lo = Infinity,
    hi = 0,
    loLine = "",
    hiLine = "",
    bad = 0;
  const t0 = performance.now();
  for (const p of lands) {
    const known = knownInLand(world, p.cell),
      seen = ctx.settlements.seenIn(p.cell),
      realm = politiesOf(world).of(p.cell)?.ref ?? "none",
      rt = realmTop.get(realm) ?? new Map<string, number>();
    realmTop.set(realm, rt);
    for (const s of seen) {
      towns++;
      const k = known.get(s.ref) ?? [];
      if (!k.length) none++;
      const line = k.map((x) => x.words).join(", and ");
      sentences.set(line, (sentences.get(line) ?? 0) + 1);
      if (k[0]) {
        const key = k[0].key.replace(/:.*/, "");
        keys.set(key, (keys.get(key) ?? 0) + 1);
        rt.set(k[0].words, (rt.get(k[0].words) ?? 0) + 1);
      }
      if (
        (towns * 2654435761) % 4294967296 <
        4294967296 / Math.max(25, (seen.length * lands.length) / 25)
      )
        samples.push(`${s.name} (${s.population}): known for ${line}`);
    }
    const first = seen[0];
    if (first) {
      const b = boardOf(world, p.cell, first.ref, first.name);
      if (b) {
        boards++;
        if (b.rows.length < 3) thin++;
        dearMost = Math.max(dearMost, b.dear);
        dearSum += b.dear;
        for (const r of b.rows) {
          const n = Number(r.price.replace(/[^0-9.]/g, ""));
          if (!(n > 0) && r.price !== "what all is told in") {
            bad++;
            console.log("  BAD", first.name, r.name, r.price);
          }
          if (n > 0 && n < lo) {
            lo = n;
            loLine = `${first.name}: ${r.name} ${r.price} ${r.each}`;
          }
          if (n > hi) {
            hi = n;
            hiLine = `${first.name}: ${r.name} ${r.price} ${r.each}`;
          }
        }
      }
    }
  }
  ms = performance.now() - t0;
  const all = [...sentences].sort((a, b) => b[1] - a[1]);
  console.log(
    `\n=== ${seed} (${universe}): ${lands.length} peopled lands, ${towns} towns; ${Math.round(ms)} ms for all; ${none} say nothing; ${all.length} different sentences; ${[...realmTop.keys()].length} realms`,
  );
  console.log(
    `commonest: ${all
      .slice(0, 8)
      .map(([w, n]) => `${((100 * n) / towns).toFixed(1)}% ${w}`)
      .join("\n           ")}`,
  );
  console.log(
    `first thing by kind: ${[...keys]
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${k} ${((100 * n) / towns).toFixed(1)}%`)
      .join(", ")}`,
  );
  let worstRealm = 0,
    worstLine = "";
  for (const [r, m] of realmTop) {
    const sum = [...m.values()].reduce((a, b) => a + b, 0);
    if (sum < 8) continue;
    const top = [...m].sort((a, b) => b[1] - a[1])[0]!;
    if (top[1] / sum > worstRealm) {
      worstRealm = top[1] / sum;
      worstLine = `${r}: ${top[1]}/${sum} "${top[0]}"`;
    }
  }
  console.log(`worst realm of 8 towns or more: ${(100 * worstRealm).toFixed(0)}% ${worstLine}`);
  console.log(
    `boards ${boards}; nearly empty (under 3 lines) ${thin}; dear goods at once mean ${(dearSum / Math.max(1, boards)).toFixed(1)} most ${dearMost}; smallest "${loLine}"; largest "${hiLine}"; zero or bad prices ${bad}`,
  );
  // What it costs, and a real board and a real list.
  const biggest = lands
    .flatMap((p) => ctx.settlements.seenIn(p.cell))
    .sort((a, b) => b.population - a.population)[0];
  if (biggest) {
    const a = performance.now(),
      page = boardPage(world, `board:${biggest.ref}`),
      b = performance.now(),
      again = boardPage(world, `board:${biggest.ref}`),
      c = performance.now(),
      dear = dearPage(world, `dear:${biggest.cell}:13`),
      d = performance.now();
    console.log(
      `open: board of ${biggest.name} (${biggest.population}) ${Math.round(b - a)} ms first, ${Math.round(c - b)} ms again; where-dear page ${Math.round(d - c)} ms; tabs ${again.tabs.map((t) => t.name).join(", ")}`,
    );
    const words = (l: readonly unknown[]): string =>
      l.map((x) => (typeof x === "string" ? x : (x as { text: string }).text)).join("");
    for (const t of page.tabs)
      for (const bl of t.blocks) {
        if (bl.type === "board") {
          console.log(`  [${t.name}] known: ${bl.known ? words(bl.known) : "-"}`);
          console.log(`  [${t.name}] coin: ${bl.coin ? words(bl.coin) : "-"}`);
          for (const r of bl.rows)
            console.log(
              `    ${r.name} | ${r.each} | ${r.price} | ${r.words} | ${r.arrow} ${r.trend}`,
            );
        } else if (bl.type === "text")
          for (const l of bl.lines) console.log(`  [${t.name}] ${words(l)}`);
        else if (bl.type === "list")
          for (const it of bl.items.slice(0, 6)) console.log(`  [${t.name}] - ${words(it.line)}`);
      }
    for (const t of dear.tabs)
      for (const bl of t.blocks)
        if (bl.type === "text") for (const l of bl.lines) console.log(`  [${t.name}] ${words(l)}`);
  }
  console.log(`-- fifty lines read:`);
  for (const l of samples.slice(0, 50)) console.log(`  ${l}`);
}
process.exit(0);
