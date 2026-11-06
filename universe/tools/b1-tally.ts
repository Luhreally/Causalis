// node tools/b1-tally.ts <universe>=<file.save> ... [--run years] [--lines n]: the people bar and the history written out, read over whole worlds.
// The bar at every peopled land and at no land: how many are on it, the commonest reason and its share, each reading's commonest word, the slowest read, bad words.
// With --run: the bar at a world's three greatest seats, year by year: how often it changes. The file: its size, how long, the most in one slice, links that lead nowhere. It reads; hashes must not move.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { loadWorld, rulesetId, seedFromText, YEAR } from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { politiesOf, populationContext } from "../src/sim/index.ts";
import { barOf } from "../src/host/bar.ts";
import { writtenIndex, writtenRead } from "../src/host/inspect/written.ts";
import { pageOf } from "../src/host/inspect/index.ts";
import { HistoryFile } from "../src/ui/written-file.ts";
import type { BarPerson, WrittenEntry, WrittenYear } from "../src/bridge/index.ts";

const argv = process.argv.slice(2),
  opt = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? Number(argv[at + 1]) : 0;
  },
  runYears = opt("--run"),
  showLines = opt("--lines"),
  files = argv.filter((a) => a.includes("="));
const BAD =
  /undefined|NaN|\bnull\b|\[object|\bev:\d|\bpol:\d|town:\d|cell:\d|\{\w+\}|\bcourt:|\brule:/;
const top = (m: Map<string, number>) =>
  [...m].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
const tally = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
const oneLine = (p: BarPerson) =>
  `${p.name} | ${p.why} | ${p.readings.mood.glyph}${p.readings.mood.short} ${p.readings.doing.glyph}${p.readings.doing.short} ${p.readings.health.glyph}${p.readings.health.short} | ${p.readings.mood.label}: ${p.readings.mood.words} ${p.readings.doing.words} ${p.readings.health.words}`;
let largest = { name: "", bytes: 0 };
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
    name = `${doc.seed}@${Math.floor(world.now / YEAR)}`,
    ctx = populationContext(world),
    lands = ctx.provinces.all().filter((p) => p.total() > 0),
    kinds = new Map<string, number>(),
    whys = new Map<string, number>(),
    moods = new Map<string, number>(),
    doings = new Map<string, number>(),
    healths = new Map<string, number>(),
    seats = new Map<string, number>();
  let slow = 0,
    sum = 0,
    reads = 0,
    most = 0,
    none = 0,
    bad = 0,
    longest = 0;
  const lines = new Set<string>();
  const read = (cell: number | null) => {
    const t = performance.now(),
      got = barOf(world, { cell, town: null, pins: [], followed: [] }),
      d = performance.now() - t;
    slow = Math.max(slow, d);
    sum += d;
    reads++;
    most = Math.max(most, got.people.length);
    if (!got.people.length) none++;
    for (const p of got.people) {
      tally(kinds, p.kind);
      tally(whys, p.why);
      tally(moods, `${p.readings.mood.label}:${p.readings.mood.short}`);
      tally(doings, p.readings.doing.short);
      tally(healths, p.readings.health.short);
      tally(seats, p.key);
      longest = Math.max(longest, p.why.length);
      const said = oneLine(p);
      if (BAD.test(said)) {
        bad++;
        if (bad < 6) console.log(`  BAD ${said}`);
      }
      if (lines.size < 4000) lines.add(said);
    }
    return got;
  };
  for (const p of lands) read(p.cell);
  read(null);
  const all = Math.max(
    1,
    [...kinds.values()].reduce((a, b) => a + b, 0),
  );
  console.log(
    `${name}: ${lands.length} peopled lands, ${politiesOf(world).living().length} realms; bar at most ${most} faces, mean ${(all / reads).toFixed(1)}, none on it at ${none} places; reads mean ${(sum / reads).toFixed(1)} ms, slowest ${slow.toFixed(0)} ms; bad ${bad}`,
  );
  console.log(
    `  kinds ${top(kinds)
      .map(([k, n]) => `${k} ${((n / all) * 100).toFixed(0)}%`)
      .join(
        ", ",
      )}; commonest sentence ${(((top(whys)[0]?.[1] ?? 0) / all) * 100).toFixed(1)}% "${top(whys)[0]?.[0]}"; longest why ${longest} chars`,
  );
  console.log(
    `  mood ${top(moods)
      .slice(0, 5)
      .map(([k, n]) => `${k} ${n}`)
      .join(", ")}`,
  );
  console.log(
    `  doing ${top(doings)
      .slice(0, 6)
      .map(([k, n]) => `${k} ${n}`)
      .join(", ")}`,
  );
  console.log(
    `  health ${top(healths)
      .slice(0, 6)
      .map(([k, n]) => `${k} ${n}`)
      .join(", ")}`,
  );
  if (showLines) {
    const seen = [...lines];
    for (let i = 0; i < Math.min(showLines, seen.length); i++)
      console.log(
        `  LINE ${seen[Math.floor((i * seen.length) / Math.min(showLines, seen.length))]}`,
      );
  }

  // The file, read as a person's press reads it: slice by slice, with what the slowest cost.
  const t0 = performance.now(),
    index = writtenIndex(world),
    tIndex = performance.now() - t0,
    hf = new HistoryFile(index);
  let slowest = 0;
  const timed = <T>(f: () => T): T => {
    const t = performance.now(),
      got = f();
    slowest = Math.max(slowest, performance.now() - t);
    return got;
  };
  for (let i = 0; i < index.years.length; i += 60)
    hf.years(
      timed(() =>
        writtenRead(world, { kind: "years", years: index.years.slice(i, i + 60) }),
      ) as WrittenYear[],
    );
  for (const [kind, refs, n] of [
    ["realms", index.realms, 10],
    ["wars", index.wars, 24],
    ["people", index.people, 12],
  ] as const)
    for (let i = 0; i < refs.length; i += n)
      hf.entries(
        kind,
        timed(() => writtenRead(world, { kind, refs: refs.slice(i, i + n) })) as WrittenEntry[],
      );
  const made = hf.finish(),
    html = made.html.join(""),
    text = made.text.join(""),
    ms = performance.now() - t0,
    ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]!)),
    hrefs = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]!),
    broken = hrefs.filter((h) => !ids.has(h)),
    badFile = BAD.exec(text);
  const bytes = Buffer.byteLength(html);
  if (bytes > largest.bytes) largest = { name, bytes };
  console.log(
    `  file: ${(bytes / 1e6).toFixed(2)} MB page, ${(Buffer.byteLength(text) / 1e6).toFixed(2)} MB plain; ${index.realms.length} realms, ${index.wars.length} wars, ${index.people.length} people, ${index.years.length} years; ${(ms / 1000).toFixed(1)} s in all, first reading ${tIndex.toFixed(0)} ms, slowest slice ${slowest.toFixed(0)} ms; ${hrefs.length} links, ${broken.length} lead nowhere; bad word ${badFile ? JSON.stringify(text.slice(Math.max(0, badFile.index - 60), badFile.index + 40)) : "none"}`,
  );
  for (const l of index.left) console.log(`    left: ${l}`);

  // Year by year: how often the bar changes at a world's three greatest seats.
  if (runYears) {
    const seatsAt = [...politiesOf(world).living()]
        .sort((a, b) => b.members.length - a.members.length)
        .slice(0, 3)
        .map((r) => r.seat),
      was = seatsAt.map((c) =>
        barOf(world, { cell: c, town: null, pins: [], followed: [] })
          .people.map((p) => p.key)
          .join(";"),
      );
    let changes = 0;
    const startYear = Math.floor(world.now / YEAR);
    for (let y = 1; y <= runYears; y++) {
      world.runTo((startYear + y) * YEAR);
      seatsAt.forEach((c, i) => {
        const got = barOf(world, { cell: c, town: null, pins: [], followed: [] }),
          now = got.people.map((p) => p.key).join(";");
        if (now !== was[i]) {
          changes++;
          if (changes <= 6)
            console.log(
              `    year ${startYear + y}, seat ${i}: ${was[i]!.replace(/rule:pol:\d+:\d+\||court:pol:\d+:\d+:\d+\|/g, "")} -> ${now.replace(/rule:pol:\d+:\d+\||court:pol:\d+:\d+:\d+\|/g, "")}`,
            );
          was[i] = now;
        }
      });
    }
    console.log(
      `  over ${runYears} years, 3 seats: ${changes} changes, ${((changes / (runYears * 3)) * 100).toFixed(1)}% of seat-years`,
    );
  } else if (JSON.stringify(world.domainHashes()) !== before)
    console.log(`  HASHES MOVED on ${name}`);
  else console.log("  hashes the same");
  // A person of it, read off their page, as a person gets it.
  void pageOf;
}
console.log(`largest file ${(largest.bytes / 1e6).toFixed(2)} MB on ${largest.name}`);
