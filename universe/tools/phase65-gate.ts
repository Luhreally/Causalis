// node tools/phase65-gate.ts [--ci] [--soft] [--shots dir] — the Phase 65 gate: what a world can do, and
// a world chosen by the age it reaches, at a phone's size. On the title: Earth-like or never seen, then
// an age, and two lists kept apart: "Reached in year N" from the worlds run in full, and "Plausibly" from
// reading what a world holds with no history run. A seed typed in is read the same way. A result opens
// at its year behind the jump's screen, how long it takes said before it starts, and the world stands
// where the catalogue said. The stage chip by the date is its age, read from its measures and named for
// its own means; tapped, it says why it stands there and what it lacks for the next, each measure a page.
// A catalogue of other rules stays listed, and is said to be from an earlier version. (That reading moves nothing of history is
// tests/host/reading.test.ts's to hold.)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium } from "playwright";

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
  "--enable-unsafe-webgpu",
  "--force_high_performance_gpu",
];

const problems: string[] = [],
  check = (ok: boolean, what: string) => {
    if (!ok) problems.push(what);
  },
  say = (s: string) => console.log(`  ${s}`);

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4265, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  });
const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
  }),
  page = await context.newPage(),
  errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;
const text = async (sel: string) => ((await page.textContent(sel).catch(() => "")) ?? "").trim();
const shot = async (name: string, full = false) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`), fullPage: full });
};
const until = async (what: string, ok: () => Promise<boolean>, ms = slow(60000)) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await page.waitForTimeout(60);
  }
  problems.push(`${what} did not come`);
  return false;
};
const drawn = () =>
  until(
    "the first picture",
    () => k<boolean>("(globalThis.causalis?.drawn?.() ?? 0) > 0"),
    slow(120000),
  );
const fits = async (sel: string, what: string) => {
  const bad = await page.$$eval(
    sel,
    (list) =>
      list.filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && (r.left < 0 || r.right > innerWidth + 0.5);
      }).length,
  );
  check(bad === 0, `${bad} of ${what} run off the phone's screen`);
};

const catalogue = JSON.parse(readFileSync(join(root, "public", "catalogue.json"), "utf8")) as {
  rulesets: Record<string, string>;
  lastYear: number;
  agreementOf: Record<string, Record<string, { allowed: number; reached: number }>>;
  seeds: {
    universe: string;
    seed: string;
    ages: Record<string, { year: number; name: string }>;
  }[];
};

try {
  // 1. The title: the choice is there, and opens on the kinds, the ages, and a world's two kinds of answer.
  await page.goto(base);
  await page.waitForSelector(".title-menu .choice", { timeout: slow(60000) });
  check(
    await page.isVisible(".title-menu .choice:has-text('A world that gets there')"),
    "the title has no way to choose a world by its age",
  );
  await page.tap(".title-menu .choice:has-text('A world that gets there')");
  await page.waitForSelector(".picker .pick-age", { timeout: slow(30000) });
  await until("the worlds run in full", async () => (await page.$$(".pick-run")).length > 0);
  await fits(".picker .pick-age, .picker .pick-row, .picker h3", "the picker's rows");
  const ages = await page.$$eval(".pick-age", (b) => b.map((x) => x.textContent ?? ""));
  check(
    // (Ten, the information age's signals between orbit and other worlds, and the seven past ours of Phase 66.)
    ages.length === 18 && ages.some((a) => a.includes("Other stars")),
    `eighteen ages to choose among, got ${ages.length}`,
  );
  const short = await page.$$eval(".pick-age, .picker .choice", (b) =>
    Math.min(...b.map((x) => x.getBoundingClientRect().height)),
  );
  check(short >= 40, `its buttons are ${short} px tall on a phone`);

  // 2. Earth-like, Other stars: those run say the year; those read say "Plausibly", and are kept apart.
  await page.tap(".pick-age[data-id='stars']");
  await until("the worlds that reached the stars", async () =>
    /Reached in (about )?year/.test(await text(".pick-reached")),
  );
  const runRows = await page.$$eval(".pick-run", (rows) =>
    rows.map((r) => ({
      seed: (r as HTMLElement).dataset.seed!,
      year: Number((r as HTMLElement).dataset.year),
      words: r.textContent ?? "",
    })),
  );
  const earth = catalogue.seeds.filter((s) => s.universe === "earth" && s.ages.stars);
  check(
    runRows.length === earth.length,
    `${earth.length} Earth-like worlds reached the stars in the catalogue, ${runRows.length} are listed`,
  );
  for (const r of runRows) {
    const c = earth.find((e) => e.seed === r.seed);
    check(
      c?.ages.stars?.year === r.year,
      `${r.seed} says year ${r.year}, its run ${c?.ages.stars?.year}`,
    );
    check(/Reached in (about )?year/.test(r.words), `${r.seed} does not say it was reached`);
    check(/minute|hour/.test(r.words), `${r.seed} does not say how long it takes`);
  }
  say(`Earth-like, Other stars: ${runRows.map((r) => `${r.seed} ${r.year}`).join(", ")}`);
  await until(
    "the worlds read for what they hold",
    async () => (await page.$$(".pick-read-row")).length > 0,
    slow(90000),
  );
  await until("the reading done", async () =>
    Boolean(await page.getAttribute(".pick-status", "data-seconds")),
  );
  const readSeconds = Number(await page.getAttribute(".pick-status", "data-seconds")),
    readCount = Number(await page.getAttribute(".pick-status", "data-read")),
    found = await page.$$eval(".pick-read-row", (rows) =>
      rows.map((r) => ({
        seed: (r as HTMLElement).dataset.seed!,
        words: r.textContent ?? "",
      })),
    );
  say(
    `Plausibly: ${found.map((r) => r.seed).join(", ")}: ${readCount} worlds read in ${readSeconds} s (${Math.round((readSeconds * 1000) / Math.max(1, readCount))} ms each)`,
  );
  for (const r of found) {
    check(/^.*Plausibly/.test(r.words), `${r.seed} is not said to be plausible`);
    check(!/Reached/.test(r.words), `${r.seed} was read, not run, and says it was reached`);
    check(!runRows.some((x) => x.seed === r.seed), `${r.seed} is on both lists`);
  }
  // What the reading has been worth is told of this universe's worlds, not of all of them.
  const worth = catalogue.agreementOf.earth!.stars!;
  check(
    (await text(".pick-plausible")).includes(`${worth.reached} of ${worth.allowed} had come to it`),
    `the screen does not say ${worth.reached} of ${worth.allowed} of Earth-like worlds came to it`,
  );
  await page.locator(".pick-reached").scrollIntoViewIfNeeded();
  await page.evaluate(() =>
    document.querySelector(".pick-reached")?.scrollIntoView({ block: "start" }),
  );
  await page.waitForTimeout(600);
  await shot("1-the-picker-earth-stars");
  await fits(".picker .pick-row", "the picker's rows");

  // 3. A never seen world: what's shown is of that universe, with its own means named.
  await page.tap(".picker .choice:has-text('Never seen')");
  await page.tap(".pick-age[data-id='engines']");
  await until("alien worlds that reached engines", async () =>
    /Reached in (about )?year/.test(await text(".pick-reached")),
  );
  const alienRows = await page.$$eval(".pick-run", (rows) => rows.map((r) => r.textContent ?? ""));
  check(
    alienRows.some((w) => /As (Tide mills|The ground's heat|Cold chemistry|Sun engines)/.test(w)),
    `a world never seen is named for its own means: ${alienRows.slice(0, 3).join(" | ")}`,
  );
  await until(
    "a reading of worlds never seen",
    async () => Boolean(await page.getAttribute(".pick-status", "data-seconds")),
    slow(120000),
  );
  const alienRead = await page.$$eval(".pick-read-row", (rows) =>
    rows.map((r) => (r as HTMLElement).dataset.seed!),
  );
  say(
    `Never seen, Engines: ${alienRows.length} run; plausibly ${alienRead.join(", ")}: ${await page.getAttribute(".pick-status", "data-glanced")} glanced at, ${await page.getAttribute(".pick-status", "data-read")} read, ${await page.getAttribute(".pick-status", "data-seconds")} s`,
  );
  check(alienRead.length > 0, "no world never seen reads as allowing engines");
  await page.tap(".pick-run");
  await page.waitForSelector(".pick-more .pick-open", { timeout: slow(10000) });
  await page.evaluate(() =>
    document.querySelector(".pick-reached")?.scrollIntoView({ block: "start" }),
  );
  await page.waitForTimeout(600);
  await shot("2-the-picker-alien-engines");
  await fits(".pick-more, .pick-open", "a world's detail");

  // 4. A seed typed in: read at once, allowed or shut with why, with no history run.
  await page.tap(".picker .choice:has-text('Earth-like')");
  await page.tap(".pick-age[data-id='engines']");
  await page.fill(".pick-own .seed-input", "kestrel 154");
  await page.tap(".pick-own .pick-read");
  await until("the seed's reading", async () => (await text(".pick-own-said")).includes("Read in"));
  const own = await text(".pick-own-said"),
    shutWhy = await text(".pick-own-said .pick-age-line.shut");
  say(`kestrel 154, read: ${shutWhy}`);
  check(/✗/.test(shutWhy) && /coal/.test(shutWhy), `kestrel 154 is said to want coal: ${shutWhy}`);
  check(
    /Never came to Engines|does not allow/.test(own),
    `kestrel 154 at Engines says: ${own.slice(0, 80)}`,
  );
  await page.evaluate(() =>
    document.querySelector(".pick-own")?.scrollIntoView({ block: "start" }),
  );
  await page.waitForTimeout(600);
  await shot("3-a-seed-read");
  await fits(".pick-own p, .pick-own .seed-row", "a seed's reading");

  // 5. A catalogue under other rules stays listed, and is said to be from an earlier version.
  await page.route("**/catalogue.json", async (route) => {
    const reply = JSON.stringify({ ...catalogue, rulesets: { earth: "other", alien: "other" } });
    await route.fulfill({ status: 200, contentType: "application/json", body: reply });
  });
  await page.goto(base);
  await page.waitForSelector(".title-menu .choice", { timeout: slow(60000) });
  await page.tap(".title-menu .choice:has-text('A world that gets there')");
  await until("the catalogue said to be earlier", async () =>
    (await text(".pick-reached")).includes("earlier version"),
  );
  check((await page.$$(".pick-run")).length > 0, "a catalogue of other rules was not listed");
  check(
    (await text(".pick-reached")).includes("Reached in about year"),
    "an earlier version's years read as exact",
  );
  await until(
    "the reading, beside it",
    async () => (await page.$$(".pick-read-row")).length > 0,
    slow(90000),
  );
  await page.unroute("**/catalogue.json");
  say("a catalogue of other rules stays listed, close and not exact, and says so");

  // And one the bake found a world no longer keeping to, under the very same rules.
  await page.route("**/baked/manifest.json", async (route) => {
    const reply = JSON.stringify({ worlds: [], catalogueMoved: "first light at year 1500" });
    await route.fulfill({ status: 200, contentType: "application/json", body: reply });
  });
  await page.goto(base);
  await page.waitForSelector(".title-menu .choice", { timeout: slow(60000) });
  await page.tap(".title-menu .choice:has-text('A world that gets there')");
  await until("the catalogue no longer kept to, said to be earlier", async () =>
    (await text(".pick-reached")).includes("earlier version"),
  );
  check(
    (await page.$$(".pick-run")).length > 0,
    "a catalogue history has moved from was not listed",
  );
  await page.unroute("**/baked/manifest.json");
  say("a catalogue whose worlds no longer keep to it is said to be earlier too");

  // 6. Picking a result opens the world at its year, the chip says what the catalogue said.
  const near = catalogue.seeds
    .filter((s) => s.universe === "earth" && s.ages.writing)
    .sort((a, b) => a.ages.writing!.year - b.ages.writing!.year)[0]!;
  await page.goto(base);
  await page.waitForSelector(".title-menu .choice", { timeout: slow(60000) });
  await page.tap(".title-menu .choice:has-text('A world that gets there')");
  await page.waitForSelector(".pick-age[data-id='writing']", { timeout: slow(30000) });
  await page.tap(".pick-age[data-id='writing']");
  await until("the row of the nearest world", async () =>
    page.isVisible(`.pick-run[data-seed='${near.seed}']`),
  );
  await page.tap(`.pick-run[data-seed='${near.seed}']`);
  const said = await text(`.pick-run[data-seed='${near.seed}'] .pick-time`);
  check(/under a minute|minutes?/.test(said), `how long it takes is said: ${said}`);
  await page.tap(`.pick-run[data-seed='${near.seed}'] .pick-open`);
  await page.waitForURL(new RegExp(`year=${near.ages.writing!.year}`), { timeout: slow(60000) });
  const screenCame = await until("the jump's screen", async () => page.isVisible(".jump-screen"));
  check(screenCame, "no screen while the world runs to its year");
  await drawn();
  const stage = () =>
    k<{ id: string; name: string; since: number; stages: { id: string; year: number }[] } | null>(
      "globalThis.causalis?.worldStage?.() ?? null",
    );
  await until("the world's age, read", async () => (await stage()) !== null);
  const st = await stage();
  const now = await k<{ t: number }>(`globalThis.causalis.client.query({ type: "now" })`);
  say(
    `${near.seed} opened at year ${Math.floor(now.t / (365 * 86400))}: ${st?.name}; catalogue said Writing in ${near.ages.writing!.year}`,
  );
  check(
    Math.floor(now.t / (365 * 86400)) >= near.ages.writing!.year,
    "it did not open at the year the catalogue said",
  );
  check(st?.id === "writing" || st?.id === "iron", `it stands at ${st?.id}, not Writing`);
  await page.waitForTimeout(slow(800));
  await shot("4-opened-at-its-year");

  // 7. The chip: named as the world names it; tapped, why here and what it lacks; each measure a page.
  const stageChip = page.locator(".stat-chip.stage").first();
  const chipText = await stageChip.textContent().catch(() => "");
  check(
    !!st && (chipText ?? "").includes(st.name),
    `the chip says “${chipText}”, the age ${st?.name}`,
  );
  const box = await stageChip.boundingBox();
  check(!!box && box.x + box.width <= 430, "the chip runs off a phone's screen");
  await stageChip.tap();
  await until(
    "the page of what it can do",
    async () => (await k<string | null>("globalThis.causalis.pageOpen()")) === "world:means",
  );
  await until("its words", async () => (await text(".page-window")).includes("What it lacks"));
  const why = await text(".page-window");
  check(/What it can do/.test(why), "the page is not What it can do");
  check(/What it lacks for/.test(why), "the page does not say what it lacks");
  await page.waitForTimeout(300);
  await shot("5-why-here");
  await page.locator(".page-window :text('What it lacks for')").first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await shot("5b-what-it-lacks");
  // Each of the six opens a page that says what it is and what it stands at.
  for (const id of ["energy", "materials", "precision", "computing", "life", "reach"]) {
    await k(`globalThis.causalis.open("means:${id}")`);
    await until(`the page of ${id}`, async () =>
      (await text(".page-window")).includes("What brings it"),
    );
  }
  await k(`globalThis.causalis.open("means:energy")`);
  await page.waitForTimeout(300);
  await shot("6-a-measure");
  // Its matter: what it can do now, and what later ages would ask of it.
  await k(`globalThis.causalis.open("world:means")`);
  await page.waitForTimeout(200);
  await page.tap(".page-window button:has-text('Its matter')");
  await until("its matter's functions", async () =>
    (await text(".page-window")).includes("switch a current"),
  );
  const matter = await text(".page-window");
  check(/hold a fusion flame/.test(matter), "later functions are not told");
  await page
    .locator(".page-window :text('What its matter does now')")
    .first()
    .scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await shot("7-its-matter");
  await k(`globalThis.causalis.open("subst:copper")`);
  await until("the stuff's properties", async () => (await text(".page-window")).includes("MS/m"));
  await k(`globalThis.causalis.open("subst:silicon")`);
  await until("a later stuff's page", async () => (await text(".page-window")).includes("eV"));

  // 8. On a wide screen: the same route.
  const wide = await browser.newContext({ viewport: { width: 1280, height: 800 } }),
    desk = await wide.newPage();
  desk.on("pageerror", (e) => errors.push(e.message));
  await desk.goto(base);
  await desk.waitForSelector(".title-menu .choice", { timeout: slow(60000) });
  await desk.click(".title-menu .choice:has-text('A world that gets there')");
  await desk.waitForSelector(".pick-run", { timeout: slow(30000) });
  await desk.click(".pick-run");
  await desk.waitForSelector(".pick-more .pick-open", { timeout: slow(10000) });
  if (shots) await desk.screenshot({ path: join(shots, "8-the-picker-wide.png") });
  await desk.close();
  await wide.close();

  const own2 = errors.filter((e) => !/Failed to load resource|ERR_/i.test(e));
  check(own2.length === 0, `errors in the page: ${own2.slice(0, 3).join("; ")}`);
} finally {
  await browser.close();
  await server.close();
}

if (problems.length) {
  console.log(`\nthe Phase 65 gate fails:\n${problems.map((p) => `  ✗ ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("\nthe Phase 65 gate passes");
process.exit(0);
