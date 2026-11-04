// node tools/phase63-gate.ts [--ci] [--soft] [--shots dir] — the Phase 63 gate: a far year chosen on
// the title screen, at a phone's size, and run to behind a screen that tells how far it has come and
// about how long is left. Stopped, the world stands whole where it was and takes up from there; left
// for the title, the title; let run, it arrives at the very year and the very world a world run there
// at once comes to. A world a deploy baked ahead is fetched and taken up from where it was baked, and
// comes to the very same world; one of other rules, or damaged, is passed over and the world runs.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { preview } from "vite";
import { chromium } from "playwright";
import { YEAR, rulesetId, saveWorld, seedFromText } from "../src/kernel/index.ts";
import { EARTH } from "../src/host/planet.ts";

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
  server = await preview({ root, logLevel: "silent", preview: { port: 4263, strictPort: false } }),
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
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
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
const yearOn = async () => Number((await page.getAttribute(".jump-screen", "data-year")) ?? -1);
const worldNow = () => k<{ t: number }>(`globalThis.causalis.client.query({ type: "now" })`);
const drawn = () =>
  until(
    "the first picture",
    () => k<boolean>("(globalThis.causalis?.drawn?.() ?? 0) > 0"),
    slow(120000),
  );

try {
  // 1. On the title screen, at a phone's size: a year chosen, and about how long it takes to reach.
  await page.goto(base);
  await page.waitForSelector(".title-menu .choice", { timeout: slow(60000) });
  await page.tap(".title-menu .choice:has-text('New world')");
  const hiddenAtFirst = await page.isHidden(".year-row");
  await page.tap(".choice:has-text('At a year of your choosing')");
  const shown = await page.isVisible(".year-input");
  await page.fill(".year-input", "3000");
  await page.dispatchEvent(".year-input", "input");
  const far = await text(".year-note");
  await page.fill(".year-input", "90");
  await page.dispatchEvent(".year-input", "input");
  const near = await text(".year-note");
  await shot("1-the-year-chosen");
  say(`the title: for year 3,000 “${far}”; for year 90 “${near}”`);
  check(hiddenAtFirst, "the year's row shows before it is asked for");
  check(shown, "the year's row does not show when asked for");
  check(/\d+ minutes? on a phone/.test(far), `year 3,000 is told as “${far}”`);
  check(/under a minute/i.test(near), `year 90 is told as “${near}”`);

  // 2. Begun: behind the screen, its years counted as they pass, and what is left said.
  await page.fill(".year-input", "150");
  await page.dispatchEvent(".year-input", "input");
  await page.tap(".title-form .begin");
  await page.waitForURL(/year=150/, { timeout: slow(60000) });
  const came = await until("the jump's screen", async () => page.isVisible(".jump-screen"));
  const seen: number[] = [];
  let words = "",
    fill = 0,
    moved = false;
  while (await page.isVisible(".jump-screen").catch(() => false)) {
    const y = await yearOn();
    if (y >= 0 && y !== seen.at(-1)) seen.push(y);
    words = (await text(".jump-done")) || words;
    fill = Math.max(
      fill,
      await page
        .$eval(".jump-fill", (e) => parseFloat((e as HTMLElement).style.width) || 0)
        .catch(() => 0),
    );
    if (!moved && seen.length > 2) {
      moved = true;
      await shot("2-on-its-way");
      const box = await page.$eval(".jump-card", (e) => {
        const r = e.getBoundingClientRect();
        return { left: r.left, right: r.right };
      });
      check(box.left >= 0 && box.right <= 430, "the jump's card does not fit a phone");
      const tall = await page.$$eval(".jump-buttons button", (b) =>
        Math.min(...b.map((x) => x.getBoundingClientRect().height)),
      );
      check(tall >= 40, `its buttons are ${tall} px tall on a phone`);
    }
    await page.waitForTimeout(40);
  }
  await drawn();
  const arrived = await worldNow();
  await shot("3-arrived");
  say(
    `it ran: years seen ${seen.slice(0, 6).join(", ")} … ${seen.at(-1)}; “${words}”, ${fill}% drawn`,
  );
  check(came, "no screen stood in front of the run");
  check(seen.length >= 3, `its years were told only ${seen.length} times`);
  check(
    seen.every((y, i) => i === 0 || y >= seen[i - 1]!),
    "its years went backward",
  );
  check(/^Year [\d,]+ of 150$/.test(words), `it says “${words}”`);
  check(arrived.t >= 150 * YEAR, `it arrived at ${arrived.t / YEAR}`);
  // (The world was let go on its first picture, a moment on: it is the same world to the year.)

  // 3. The very world: to the year, as a world run there at once is.
  await page.goto(`${base}?hold&universe=earth&seed=first+light&year=40`);
  await drawn();
  const at40 = await k<{ hashes: Record<string, string>; now: { t: number } }>(`(async () => ({
    hashes: await globalThis.causalis.client.query({ type: "hashes" }),
    now: await globalThis.causalis.client.query({ type: "now" }),
  }))()`);
  const direct = EARTH.build(seedFromText("first light"));
  direct.runTo(40 * YEAR);
  check(at40.now.t === 40 * YEAR, `held, it stands at ${at40.now.t / YEAR}`);
  check(
    JSON.stringify(at40.hashes) === JSON.stringify(direct.domainHashes()),
    "the world jumped to is not the world run there at once",
  );
  say(
    `held at year 40: ${Object.keys(at40.hashes).length} domains alike with a world run there at once`,
  );

  // 4. Stopped: the world stands where it was, whole, and goes on from there.
  await page.goto(`${base}?hold&universe=earth&seed=first+light&year=2000`);
  await until("the screen again", () => page.isVisible(".jump-screen"));
  await until("a few years", async () => (await yearOn()) >= 20, slow(90000));
  const left = await text(".jump-left");
  await page.tap(".jump-stop");
  await drawn();
  const stopped = await worldNow();
  await shot("4-stopped");
  const y = stopped.t / YEAR;
  say(`stopped: it stands at year ${y.toFixed(2)}, saying “${left}” as it was stopped`);
  check(y >= 20 && y < 2000, `stopped, it stands at ${y}`);
  check(!(await page.isVisible(".jump-screen")), "the screen stayed");
  const hashes = await k<Record<string, string>>(
    `globalThis.causalis.client.query({ type: "hashes" })`,
  );
  const direct2 = EARTH.build(seedFromText("first light"));
  direct2.runTo(stopped.t);
  check(
    JSON.stringify(hashes) === JSON.stringify(direct2.domainHashes()),
    "the world stopped is not whole: it is not the world run to that moment",
  );

  // 5. Back to the title, from the screen.
  await page.goto(`${base}?hold&universe=earth&seed=first+light&year=2000`);
  await until("the screen once more", () => page.isVisible(".jump-screen"));
  await until("a year or so", async () => (await yearOn()) >= 1, slow(90000));
  await page.tap(".jump-back");
  const titled = await page
    .waitForSelector(".title-menu .choice", { timeout: slow(60000) })
    .then(() => true)
    .catch(() => false);
  check(titled, "back did not come to the title");
  check(!page.url().includes("year="), `back stands at ${page.url()}`);

  // 6. Baked ahead: the nearest year before the one asked, fetched and run on from.
  const baked = join(root, "dist", "baked"),
    world = EARTH.build(seedFromText("first light")),
    ruleset = rulesetId(world, EARTH.version);
  world.runTo(30 * YEAR);
  const bytes = gzipSync(JSON.stringify(saveWorld(world, ruleset, { universe: EARTH.name })));
  mkdirSync(baked, { recursive: true });
  writeFileSync(join(baked, "earth-30.save"), bytes);
  const manifest = (rules: string, year = 30) =>
    writeFileSync(
      join(baked, "manifest.json"),
      JSON.stringify({
        worlds: [
          {
            universe: "earth",
            seed: "first light",
            year,
            file: "earth-30.save",
            bytes: bytes.length,
            ruleset: rules,
          },
        ],
      }),
    );
  const fetched: string[] = [];
  page.on("response", (r) => {
    if (r.url().includes("earth-30.save")) fetched.push(r.url());
  });
  manifest(ruleset);
  const jumpedFrom = () => k<number>("globalThis.causalis.jumpedFrom");
  await page.goto(`${base}?hold&universe=earth&seed=first+light&year=36`);
  await drawn();
  const taken = await k<{ hashes: Record<string, string>; now: { t: number } }>(`(async () => ({
    hashes: await globalThis.causalis.client.query({ type: "hashes" }),
    now: await globalThis.causalis.client.query({ type: "now" }),
  }))()`);
  world.runTo(36 * YEAR);
  check(fetched.length === 1, `the baked world was fetched ${fetched.length} times`);
  // (Not only the same world, which running from the beginning would come to as well.)
  const took = await jumpedFrom();
  check(took === 30, `it took up from year ${took}, not from the world baked at 30`);
  check(taken.now.t === 36 * YEAR, `taken up, it stands at ${taken.now.t / YEAR}`);
  check(
    JSON.stringify(taken.hashes) === JSON.stringify(world.domainHashes()),
    "the world taken up from a baked one is not the world run there",
  );
  say(`baked at year 30 (${(bytes.length / 1000).toFixed(0)} kB), asked for 36: the same world`);
  // The title offers the seed run ahead, and says how near that brings the year asked.
  await page.goto(base);
  await page.waitForSelector(".title-menu .choice", { timeout: slow(60000) });
  await page.tap(".title-menu .choice:has-text('New world')");
  await page.tap(".choice:has-text('At a year of your choosing')");
  await until("the seed run ahead on offer", () => page.isVisible(".year-ahead"));
  await page.tap(".year-ahead");
  await page.fill(".year-input", "36");
  await page.dispatchEvent(".year-input", "input");
  const offered = await text(".year-note");
  await shot("5-run-ahead-offered");
  say(`with the seed run ahead, the title says “${offered}”`);
  check(/^Run ahead to year 30/.test(offered), `with the seed run ahead it says “${offered}”`);
  check(await page.isHidden(".year-ahead"), "the seed is still offered once it is chosen");
  // Of other rules: passed over.
  fetched.length = 0;
  manifest("other rules");
  await page.goto(`${base}?hold&universe=earth&seed=first+light&year=12`);
  await drawn();
  const passed = await worldNow();
  check(fetched.length === 0, "a world baked under other rules was fetched");
  check((await jumpedFrom()) === 0, "it took up from a world baked under other rules");
  check(
    passed.t === 12 * YEAR,
    `past a baked world of other rules, it stands at ${passed.t / YEAR}`,
  );
  // Damaged: the world runs from where it was.
  fetched.length = 0;
  manifest(ruleset, 10);
  writeFileSync(join(baked, "earth-30.save"), bytes.subarray(0, bytes.length >> 1));
  await page.goto(`${base}?hold&universe=earth&seed=first+light&year=12`);
  await drawn();
  const mended = await worldNow();
  check(fetched.length === 1, "the damaged world was not tried");
  check((await jumpedFrom()) === 0, "it took up from a damaged world");
  check(mended.t === 12 * YEAR, `past a damaged world, it stands at ${mended.t / YEAR}`);
  say("a world baked under other rules is passed over, a damaged one run past");
  // (The damaged one logs its failure: the rest are the page's own.)
  const own = errors.filter((e) => !/decompress|ERR_|Failed to load resource/i.test(e));
  check(own.length === 0, `errors in the page: ${own.slice(0, 3).join("; ")}`);
} finally {
  rmSync(join(root, "dist", "baked"), { recursive: true, force: true });
  await browser.close();
  await server.close();
}

if (problems.length) {
  console.log(`\nthe Phase 63 gate fails:\n${problems.map((p) => `  ✗ ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("\nthe Phase 63 gate passes");
process.exit(0);
