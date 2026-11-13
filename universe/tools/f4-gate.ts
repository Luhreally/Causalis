// node tools/f4-gate.ts [--ci] [--soft] [--shots dir]: gate 71, F4 (rocky worlds differ) at a phone's size. A small
// rocky world whose people have no copper within reach, "alien 132", is run on in node to year 750. Read in node:
// long blades known before any bronze, iron known with no bronze behind it, mirrors' engines where no coal lies
// near; Earth read as ever. Then the world opened at 750, held, and on a phone:
//   1. its hash as it was run there;
//   2. long blades' page: named for its flakes, a tick on what it asks, found only by a land with no metal;
//   3. bronze's page and iron's: bronze never known, iron's needs say flakes;
//   4. the sun engines' page: a tick on what it asks, and only where no coal lies within reach;
//   5. a world with too little metal for a hardener ("alien 12"), read in node: bronze shut, why in its words;
//   6. the world's hash as it was, and no error in the page.
// (npm run build first; the gate writes its save and manifest into dist/baked.)
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { preview } from "vite";
import { chromium } from "playwright";
import { YEAR, rulesetId, saveWorld, seedFromText } from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { functionsOf, meansOfWorld } from "../src/gen/index.ts";
import { homePlanet, loreOf, populationContext } from "../src/sim/index.ts";
import { keptLife } from "../src/rules/index.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  shotsAt = argv.indexOf("--shots"),
  shots = shotsAt >= 0 ? argv[shotsAt + 1] : undefined;
if (shots) mkdirSync(shots, { recursive: true });
const slow = (ms: number) => (ci || soft ? ms * 4 : ms);

const GPU = [
  "--enable-gpu",
  "--ignore-gpu-blocklist",
  "--use-angle=d3d11",
  "--force_high_performance_gpu",
];
const problems: string[] = [],
  check = (ok: boolean, what: string) => {
    if (!ok) problems.push(what);
  },
  say = (s: string) => console.log(`  ${s}`);

// (Both as they were made, life kept: of alien 132's own tree its people now swim, and alien 12's lands lie elsewhere.)
const SEED = keptLife("alien 132"),
  AT = 750,
  THIN = keptLife("alien 12");

const root = fileURLToPath(new URL("..", import.meta.url)),
  baked = join(root, "dist", "baked"),
  started = performance.now(),
  alien = ALIEN.build(seedFromText(SEED)),
  ruleset = rulesetId(alien, ALIEN.version);
alien.runTo(AT * YEAR);
const lore = loreOf(alien),
  lands = populationContext(alien).provinces.all(),
  firstOf = (id: string): number | null => {
    let first: number | null = null;
    for (const p of lands) {
      const k = lore.get(p.cell, id);
      if (k && (first === null || k.year < first)) first = k.year;
    }
    return first;
  },
  edges = firstOf("set-edges"),
  iron = firstOf("iron"),
  sun = firstOf("sun-engines"),
  bronze = firstOf("bronze");
say(
  `${SEED} to year ${AT}: long blades ${edges}, iron ${iron}, sun engines ${sun}, bronze ${bronze}`,
);
check(edges !== null, "no land of alien 132 has long blades by year 750");
check(iron !== null, "no land of alien 132 has iron by year 750");
check(bronze === null, `alien 132 knows bronze in ${bronze}`);
check(sun !== null, "no land of alien 132 has sun engines by year 750");

// Read in node: what its star's want of metals does; Earth as ever.
const thin = homePlanet(ALIEN.build(seedFromText(THIN))).generated,
  hardens = functionsOf(thin).find((f) => f.id === "harden-copper")!,
  earth = meansOfWorld(homePlanet(EARTH.build(seedFromText("first light"))).generated);
say(
  `${THIN}: hardens copper ${hardens.met}: “${hardens.why}”; Earth's first road ${earth.firstRoad}`,
);
check(!hardens.met && /of the Sun's metals/.test(hardens.why), `${THIN} hardens copper`);
check(earth.firstRoad && !earth.edgeRoad && earth.rides, "Earth has left its first road");

const direct = alien.domainHashes(),
  bytes = gzipSync(JSON.stringify(saveWorld(alien, ruleset, { universe: ALIEN.name }))),
  file = `alien-${AT}.save`;
mkdirSync(baked, { recursive: true });
writeFileSync(join(baked, file), bytes);
writeFileSync(
  join(baked, "manifest.json"),
  JSON.stringify({
    worlds: [{ universe: ALIEN.name, seed: SEED, year: AT, file, bytes: bytes.length, ruleset }],
  }),
);

type PageNow = { title: string; words: string; facts: { label: string; value: string }[] };

const server = await preview({
    root,
    logLevel: "silent",
    preview: { port: 4271, strictPort: false },
  }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  });
const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: ci || soft ? 1 : 3,
    hasTouch: true,
    isMobile: true,
  }),
  page = await context.newPage(),
  errors: string[] = [];
page.setDefaultTimeout(slow(60000));
page.on("pageerror", (e) => errors.push(`${e.message}\n${e.stack ?? ""}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;
const hashes = () => k<unknown>(`globalThis.causalis.client.query({ type: "hashes", args: {} })`);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const until = async (what: string, ok: () => Promise<boolean>, ms = slow(60000)) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await page.waitForTimeout(60);
  }
  problems.push(`${what} did not come`);
  return false;
};
const pageNow = () =>
  k<PageNow>(`(() => ({
    title: document.querySelector(".page-title")?.textContent ?? "",
    words: document.querySelector(".page-window")?.textContent ?? "",
    facts: [...document.querySelectorAll(".page-window .fact")].map((f) => ({
      label: f.querySelector(".fact-label")?.textContent ?? "",
      value: f.querySelector(".fact-value")?.textContent ?? "",
    })),
  }))()`);
const pageWhen = async (ref: string, ok: (p: PageNow) => boolean): Promise<PageNow> => {
  await k("globalThis.causalis.closePage()");
  await k(`globalThis.causalis.open(${JSON.stringify(ref)})`);
  const seen: { page?: PageNow } = {};
  await until(`the page of ${ref}`, async () => {
    const p = await pageNow();
    if (p.title === "" || p.title === "…" || !ok(p)) return false;
    seen.page = p;
    return true;
  });
  return seen.page ?? (await pageNow());
};
const fact = (p: PageNow, label: string) => p.facts.find((f) => f.label === label)?.value ?? "";

await page.goto(`${base}?universe=alien&seed=${encodeURIComponent(SEED)}&year=${AT}&hold`);
await until(
  "the first picture",
  () => k<boolean>("(globalThis.causalis?.drawn?.() ?? 0) > 0"),
  slow(180000),
);
const hashed = await hashes();
check(same(hashed, direct), "the world fetched is not the world run there");

const blades = await pageWhen("prin:set-edges", (p) => p.words.includes("Needs first"));
say(`“${blades.title}”: found by “${fact(blades, "Found by")}”`);
check(/flakes set in a spine$/.test(blades.title), `long blades titled “${blades.title}”`);
check(
  /no metal to work/.test(fact(blades, "Found by")),
  `long blades' page does not say what sends a land to them: “${fact(blades, "Found by")}”`,
);
check(/✓/.test(fact(blades, "Asks of its world's matter")), "long blades' asks show no tick");
if (shots) await page.screenshot({ path: join(shots, "blades.png") });

const irons = await pageWhen("prin:iron", (p) => p.words.includes("Needs first"));
say(`iron needs “${fact(irons, "Needs first")}”`);
check(/flakes/.test(fact(irons, "Needs first")), "iron's page does not name flakes as a way to it");

const engines = await pageWhen("prin:sun-engines", (p) => p.words.includes("Needs first"));
say(`“${engines.title}”: found by “${fact(engines, "Found by")}”`);
check(
  /no coal lies within reach/.test(fact(engines, "Found by")),
  "sun engines say nothing of coal",
);
check(/✓/.test(fact(engines, "Asks of its world's matter")), "sun engines' asks show no tick");

check(same(await hashes(), hashed), "the world's hash changed while its pages were read");
for (const e of errors) problems.push(`page error: ${e.slice(0, 300)}`);

console.log(
  `F4 gate (71): ${((performance.now() - started) / 1000).toFixed(0)} s, ${problems.length} problems`,
);
for (const p of problems) console.log(`  - ${p}`);
await browser.close();
await server.close();
process.exit(problems.length ? 1 : 0);
