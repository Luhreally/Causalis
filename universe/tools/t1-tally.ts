// node tools/t1-tally.ts <universe>=<file.save> ... [--lines N]: what a whole world remembers: stones per town by quantile, the most in one
// town, the commonest kind and its share, songs per people, the commonest song title and its share, the longest and the shortest verse,
// and bad words on every stone's page. It reads; hashes must not move.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { loadWorld, rulesetId, seedFromText, YEAR } from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { languagesOf, populationContext } from "../src/sim/index.ts";
import { memoryOf, memorialsOf, songFor, stonePage, songPage } from "../src/host/inspect/memory.ts";
const argv = process.argv.slice(2),
  linesAt = argv.indexOf("--lines"),
  want = linesAt >= 0 ? Number(argv[linesAt + 1]) : 0,
  files = argv.filter((a) => a.includes("="));
const plainLine = (l: readonly unknown[]) =>
  l.map((s) => (typeof s === "string" ? s : (s as { text: string }).text)).join("");
const BAD = /undefined|NaN|\bnull\b|\[object|\bev:\d|\bpol:\d|town:\d|\{\w+\}/;
for (const f of files) {
  const [uni, file] = f.split("="),
    U = uni === "earth" ? EARTH : ALIEN,
    doc = JSON.parse(gunzipSync(readFileSync(file!)).toString("utf8")),
    { world } = loadWorld(
      doc,
      (s) => U.build(s),
      rulesetId(U.build(seedFromText(doc.seed)), U.version),
      { allowRulesetChange: true },
    ),
    before = JSON.stringify(world.domainHashes()),
    t0 = performance.now(),
    m = memoryOf(world),
    t1 = performance.now(),
    towns = populationContext(world).settlements.all(),
    peopled = towns.filter((t) => t.population > 0),
    counts = peopled.map((t) => (m.stones.get(t.ref) ?? []).length).sort((a, b) => a - b),
    q = (p: number) => counts[Math.min(counts.length - 1, Math.floor(p * counts.length))] ?? 0,
    withAny = counts.filter((n) => n > 0).length;
  const kinds = new Map<string, number>();
  let total = 0,
    most = "",
    mostN = 0;
  for (const [t, l] of m.stones) {
    total += l.length;
    if (l.length > mostN) {
      mostN = l.length;
      most = t;
    }
    for (const d of l) kinds.set(d.kind, (kinds.get(d.kind) ?? 0) + 1);
  }
  const forms = new Map<string, number>();
  for (const [t] of m.stones)
    for (const s of memorialsOf(world, t)) forms.set(s.form, (forms.get(s.form) ?? 0) + 1);
  const top = [...kinds].sort((a, b) => b[1] - a[1]),
    t2 = performance.now();
  // Every song once: its title, its lines.
  const titles = new Map<string, number>(),
    kindsS = new Map<string, number>(),
    linesAll = new Map<string, number>();
  let longest = "",
    shortest = "",
    bad = 0,
    nSongs = 0;
  for (const d of m.deeds) {
    const s = songFor(world, d);
    nSongs++;
    titles.set(s.title, (titles.get(s.title) ?? 0) + 1);
    kindsS.set(d.kind, (kindsS.get(d.kind) ?? 0) + 1);
    const text = s.lines.join(" / ");
    if (!longest || text.length > longest.length) longest = text;
    if (!shortest || text.length < shortest.length) shortest = text;
    if (BAD.test(text) || BAD.test(s.title) || !s.lines.length) {
      bad++;
      if (bad < 6) console.log("BAD", s.title, text);
    }
    for (const l of s.lines) linesAll.set(l, (linesAll.get(l) ?? 0) + 1);
  }
  const t3 = performance.now();
  const topT = [...titles].sort((a, b) => b[1] - a[1]),
    topL = [...linesAll].sort((a, b) => b[1] - a[1]),
    sp = languagesOf(world).speakers(),
    ls = languagesOf(world)
      .all()
      .map((l) => (sp.get(l.index) ?? []).reduce((n, c) => n + (m.byCell.get(c)?.length ?? 0), 0))
      .filter((n) => n > 0)
      .sort((a, b) => a - b);
  // Every stone's page, and each song's, for bad words.
  let pageBad = 0;
  const words = (p: ReturnType<typeof stonePage>) =>
    [
      p.title,
      ...p.tabs.flatMap((x) =>
        x.blocks.flatMap((b) => (b.type === "text" ? b.lines.map(plainLine) : [])),
      ),
    ].join(" ");
  for (const [t, l] of m.stones)
    for (const d of l) {
      const w =
        words(stonePage(world, `stone:${t}:${d.id}`)) + words(songPage(world, `song:${d.id}`));
      if (BAD.test(w) && pageBad++ < 4) console.log("BAD PAGE", w.slice(0, 400));
    }
  console.log(
    `\n=== ${doc.seed} year ${Math.floor(world.now / YEAR)}: ${world.events.count} events; read ${(t1 - t0).toFixed(0)} ms; stones' plans ${(t2 - t1).toFixed(0)} ms; all songs ${(t3 - t2).toFixed(0)} ms`,
  );
  console.log(
    `towns ${towns.length} peopled ${peopled.length}; with a stone ${withAny} (${Math.round((100 * withAny) / Math.max(1, peopled.length))}%); stones ${total}; per town p50 ${q(0.5)} p90 ${q(0.9)} p99 ${q(0.99)} max ${mostN} (${most})`,
  );
  console.log(
    `kinds: ${top.map(([k, n]) => `${k} ${n} (${Math.round((100 * n) / Math.max(1, total))}%)`).join(", ")}`,
  );
  console.log(
    `forms: ${[...forms]
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${k} ${n}`)
      .join(", ")}`,
  );
  console.log(
    `songs ${nSongs}; of kinds: ${[...kindsS]
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${k} ${n}`)
      .join(", ")}`,
  );
  console.log(
    `songs per people: min ${ls[0] ?? 0} p50 ${ls[Math.floor(ls.length / 2)] ?? 0} max ${ls.at(-1) ?? 0} over ${ls.length} peoples`,
  );
  console.log(
    `commonest titles: ${topT
      .slice(0, 6)
      .map(([k, n]) => `${k} ${n} (${((100 * n) / nSongs).toFixed(1)}%)`)
      .join("; ")}; distinct ${titles.size}`,
  );
  console.log(
    `commonest lines: ${topL
      .slice(0, 4)
      .map(([k, n]) => `"${k}" ${n} (${((100 * n) / nSongs).toFixed(1)}%)`)
      .join("; ")}`,
  );
  console.log(`longest (${longest.length}): ${longest}`);
  console.log(`shortest (${shortest.length}): ${shortest}`);
  console.log(
    `bad verse ${bad}; bad pages ${pageBad}; hashes ${JSON.stringify(world.domainHashes()) === before ? "same" : "MOVED"}`,
  );
  if (want) {
    // Evenly over the world's songs.
    const step = Math.max(1, Math.floor(m.deeds.length / want));
    for (let i = 0, n = 0; i < m.deeds.length && n < want; i += step, n++) {
      const d = m.deeds[i]!,
        s = songFor(world, d);
      console.log(`  [${d.kind} y${d.year} ${s.form}] ${s.title}\n     ${s.lines.join("\n     ")}`);
    }
  }
}
