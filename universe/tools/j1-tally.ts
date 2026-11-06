// node tools/j1-tally.ts <universe>=<file.save> ... [--lines N] [--years K]: a whole world's cases: per town by quantile, the most in one town, towns with none this
// year and with none over K years, the commonest offence and sentence and their shares, bad words on every case's page, and N real lines. It reads; hashes must not move.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { loadWorld, rulesetId, seedFromText, YEAR } from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { casePage, casesOf, townLawTab, type Case } from "../src/host/inspect/justice.ts";
import { populationContext } from "../src/sim/index.ts";
const argv = process.argv.slice(2),
  linesAt = argv.indexOf("--lines"),
  want = linesAt >= 0 ? Number(argv[linesAt + 1]) : 0,
  yearsAt = argv.indexOf("--years"),
  back = yearsAt >= 0 ? Number(argv[yearsAt + 1]) : 5,
  mostAt_ = argv.indexOf("--most"),
  most = mostAt_ >= 0 ? Number(argv[mostAt_ + 1]) : Infinity,
  files = argv.filter((a) => a.includes("="));
const plainLine = (l: readonly unknown[]) =>
  l.map((s) => (typeof s === "string" ? s : (s as { text: string }).text)).join("");
const BAD = /undefined|NaN|\bnull\b|\[object|\bev:\d|\bpol:\d|town:\d|\{\w+\}|\bfolk:|\bcase:/;
const share = (m: Map<string, number>, total: number) =>
  [...m]
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k} ${n} (${Math.round((100 * n) / Math.max(1, total))}%)`)
    .join(", ");
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
    year = Math.floor(world.now / YEAR),
    peopled = populationContext(world)
      .settlements.all()
      .filter((t) => t.population > 0),
    // (--most N: every k-th town, up to N: a tally of a whole far world takes minutes.)
    every = Math.max(1, Math.ceil(peopled.length / most)),
    towns = peopled.filter((_, i) => i % every === 0),
    t0 = performance.now(),
    all: Case[][] = towns.map((t) => [...casesOf(world, t.ref, year)]),
    t1 = performance.now(),
    counts = all.map((l) => l.length).sort((a, b) => a - b),
    q = (p: number) => counts[Math.min(counts.length - 1, Math.floor(p * counts.length))] ?? 0,
    total = counts.reduce((a, b) => a + b, 0),
    offences = new Map<string, number>(),
    sentences = new Map<string, number>(),
    forms = new Map<string, number>(),
    whys = new Map<string, number>();
  let mostN = -1,
    mostAt = "";
  all.forEach((l, i) => {
    if (l.length > mostN) {
      mostN = l.length;
      mostAt = towns[i]!.ref;
    }
    for (const c of l) {
      offences.set(c.offence, (offences.get(c.offence) ?? 0) + 1);
      sentences.set(c.sentence, (sentences.get(c.sentence) ?? 0) + 1);
      forms.set(c.form, (forms.get(c.form) ?? 0) + 1);
      const w = plainLine(c.why[0]!)
        .replace(/\d[\d,.]*/g, "#")
        .slice(0, 34);
      whys.set(w, (whys.get(w) ?? 0) + 1);
    }
  });
  // Over years: towns with none at all; towns that only ever do one thing.
  let never = 0,
    oneThing = 0,
    looked = 0;
  const step = Math.max(1, Math.floor(towns.length / 400));
  for (let i = 0; i < towns.length; i += step) {
    looked++;
    const kinds = new Set<string>();
    let n = 0;
    for (let y = year; y > year - back; y--)
      for (const c of casesOf(world, towns[i]!.ref, y)) {
        kinds.add(c.offence);
        n++;
      }
    if (!n) never++;
    if (n >= 6 && kinds.size === 1) oneThing++;
  }
  const t2 = performance.now();
  // Every case's page, and each town's tab, for bad words and what's read.
  let bad = 0;
  const words = (p: ReturnType<typeof casePage>) =>
    [
      p.title,
      ...p.tabs.flatMap((x) =>
        x.blocks.flatMap((b) =>
          b.type === "text"
            ? b.lines.map(plainLine)
            : b.type === "list"
              ? b.items.map((it) => plainLine(it.line as readonly unknown[]))
              : b.type === "facts"
                ? b.rows.map((r) =>
                    typeof r.value === "string"
                      ? r.value
                      : plainLine(r.value as readonly unknown[]),
                  )
                : [],
        ),
      ),
    ].join(" ");
  const stepP = Math.max(1, Math.floor(total / 40));
  let k = 0,
    pageMs = 0,
    pageWorst = 0;
  for (const l of all)
    for (const c of l) {
      if (k++ % stepP) continue;
      const a = performance.now(),
        p = casePage(world, c.ref),
        ms = performance.now() - a;
      pageMs += ms;
      pageWorst = Math.max(pageWorst, ms);
      const w = words(p);
      if (BAD.test(w) && bad++ < 6) console.log("BAD PAGE", c.ref, w.slice(0, 400));
    }
  let tabWorst = 0;
  for (let i = 0; i < towns.length; i += step) {
    const a = performance.now(),
      tab = townLawTab(world, towns[i]!.ref);
    tabWorst = Math.max(tabWorst, performance.now() - a);
    const w = tab ? words({ tabs: [tab], title: "" } as never) : "";
    if (BAD.test(w) && bad++ < 6) console.log("BAD TAB", towns[i]!.ref, w.slice(0, 400));
  }
  console.log(
    `\n=== ${doc.seed} year ${year}: towns ${towns.length} of ${peopled.length}; read all ${(t1 - t0).toFixed(0)} ms (${((t1 - t0) / Math.max(1, towns.length)).toFixed(2)} ms a town); ${back} years of ${looked} towns ${(t2 - t1).toFixed(0)} ms`,
  );
  console.log(
    `cases ${total}; per town p10 ${q(0.1)} p50 ${q(0.5)} p90 ${q(0.9)} p99 ${q(0.99)} max ${mostN} (${mostAt}); none this year ${counts.filter((n) => n === 0).length} (${Math.round((100 * counts.filter((n) => n === 0).length) / Math.max(1, towns.length))}%); of ${looked} towns over ${back} years: none at all ${never}, only one kind ${oneThing}`,
  );
  console.log(`offences: ${share(offences, total)}`);
  console.log(`sentences: ${share(sentences, total)}`);
  console.log(`forms: ${share(forms, total)}`);
  console.log(`first whys: ${share(whys, total).split(", ").slice(0, 8).join("; ")}`);
  console.log(
    `pages: mean ${(pageMs / Math.max(1, Math.ceil(total / stepP))).toFixed(1)} ms worst ${pageWorst.toFixed(0)} ms; tab worst ${tabWorst.toFixed(0)} ms; bad ${bad}; hashes ${JSON.stringify(world.domainHashes()) === before ? "same" : "MOVED"}`,
  );
  if (want) {
    const flat = all.flat(),
      s = Math.max(1, Math.floor(flat.length / want));
    for (let i = 0, n = 0; i < flat.length && n < want; i += s, n++) {
      const c = flat[i]!;
      console.log(
        `  [${c.form} ${c.offence}/${c.sentence}] ${c.accused.name}, ${c.accused.age}, ${c.accused.work}, ${c.whatWords}. ${c.accused.name.split(" ")[0]} ${c.came}. WHY: ${c.why.map((l) => plainLine(l)).join(" ")} COST: ${c.cost}`,
      );
    }
  }
}
process.exit(0);
