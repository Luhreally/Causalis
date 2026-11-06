// node tools/a1-tally.ts <universe> <file.save>...: what the years say over whole worlds: commonest shapes, longest year, emptiest stretch.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { loadWorld, rulesetId, seedFromText, YEAR } from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import {
  annalsIndex,
  annalsOf,
  annalsRead,
  annalsTally,
  runTold,
} from "../src/host/inspect/annals.ts";
import { ALL_LINES, ALL_WORTH, ANNAL_ALL } from "../src/bridge/index.ts";
const args = process.argv.slice(2),
  show = args.includes("--show");
const files = args.filter((a) => a !== "--show");
const plain = (l: readonly unknown[]) =>
  l.map((s) => (typeof s === "string" ? s : (s as { text: string }).text)).join("");
for (const f of files) {
  const [uni, file] = f.split("="),
    U = uni === "earth" ? EARTH : ALIEN;
  const doc = JSON.parse(gunzipSync(readFileSync(file!)).toString("utf8"));
  const { world } = loadWorld(
    doc,
    (s) => U.build(s),
    rulesetId(U.build(seedFromText(doc.seed)), U.version),
    { allowRulesetChange: true },
  );
  const before = JSON.stringify(world.domainHashes());
  const t0 = performance.now();
  annalsOf(world);
  const t1 = performance.now();
  const ix = annalsIndex(world);
  const allYears = ix.years.filter((_, i) => ix.masks[i]! & ANNAL_ALL);
  const t2 = performance.now();
  const lines = annalsRead(world, allYears.slice(-30));
  const t3 = performance.now();
  const whole = annalsRead(world, ix.years.slice());
  let read: typeof whole = [];
  for (let i = 0; i < ix.years.length; i += 200)
    read = read.concat(annalsRead(world, ix.years.slice(i, i + 200)));
  const now = Math.floor(world.now / YEAR);
  console.log(
    `\n=== ${doc.seed} year ${now}: ${world.events.count} events; index ${(t1 - t0).toFixed(0)} ms; 30 years read ${(t3 - t2).toFixed(1)} ms; ${ix.years.length} years told; ${allYears.length} with no filter (${Math.round((100 * allYears.length) / (now + 1))}%)`,
  );
  const shapes = new Map<string, number>(),
    tall = annalsTally(world);
  let most = 0,
    mostY = 0,
    chars = 0,
    nlines = 0,
    bad = 0,
    coords = 0;
  const allSet = new Set(allYears);
  const samples: string[] = [];
  for (const y of read) {
    const shown = y.lines.filter((l) => l.worth >= ALL_WORTH).slice(0, ALL_LINES);
    if (y.lines.length > most) {
      most = y.lines.length;
      mostY = y.year;
    }
    for (const l of shown) {
      const w = plain(l.line);
      const shape = w
        .replace(/\d[\d,.]*/g, "#")
        .replace(/\b[A-Z][\p{L}']+(?: [A-Z][\p{L}']+)*/gu, "N")
        .slice(0, 60);
      shapes.set(shape, (shapes.get(shape) ?? 0) + 1);
      chars += w.length;
      nlines++;
      if (/undefined|null\b|NaN|\[object|[a-z]+:\d+:\d+/.test(w)) {
        bad++;
        if (bad < 6) console.log("BAD", y.year, w);
      }
      if (/\d°[NS]/.test(w)) coords++;
    }
    if (shown.length && samples.length < 400)
      samples.push(`${y.year}. ${shown.map((l) => plain(l.line)).join(" ")}`);
  }
  // Keys over the no-filter lines.
  const keys = new Map<string, number>();
  for (const [y, list] of tall) {
    for (const t of list.filter((x) => x.worth >= ALL_WORTH).slice(0, ALL_LINES))
      keys.set(t.key, (keys.get(t.key) ?? 0) + 1);
  }
  console.log(
    "kinds:",
    [...keys]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 22)
      .map(([k, n]) => `${k} ${n}`)
      .join("; "),
  );
  console.log("commonest shapes:");
  for (const [s, n] of [...shapes].sort((a, b) => b[1] - a[1]).slice(0, 12))
    console.log(`  ${n}x ${s}`);
  let gap = 0,
    gapAt = 0,
    last = -1;
  for (const y of allYears) {
    if (y - last > gap) {
      gap = y - last;
      gapAt = last;
    }
    last = y;
  }
  if (now - last > gap) {
    gap = now - last;
    gapAt = last;
  }
  console.log(
    `longest year ${mostY} (${most} lines told in all); ${nlines} lines shown no filter, mean ${(chars / Math.max(1, nlines)).toFixed(0)} chars; bad ${bad}; with coordinates ${coords}; emptiest stretch ${gap} years after ${gapAt}`,
  );
  const ran = runTold(world, (now - 240) * YEAR, now * YEAR),
    ranS = runTold(world, (now - 10) * YEAR, now * YEAR);
  console.log("RAN 240:", ran ? ran.lines.map((l) => plain(l.line)).join(" | ") : null);
  console.log("RAN 10:", ranS ? ranS.lines.map((l) => plain(l.line)).join(" | ") : null);
  if (show) {
    const step = Math.max(1, Math.floor(samples.length / 40));
    for (let i = 0; i < samples.length; i += step) console.log(samples[i]!.slice(0, 330));
  }
  console.log("hashes same:", before === JSON.stringify(world.domainHashes()));
}
