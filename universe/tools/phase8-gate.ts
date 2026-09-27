// node tools/phase8-gate.ts [--settings low,balanced,high,ultra] [--no-budgets] — the Phase 8 gate (docs/architecture
// §I.8, milestone 82), at an iPhone 15 Plus's size:
//   1. every setting holds the phone floor: entering a village makes no frame longer than a
//      second on the floor (WebKit, a quarter of this machine's pace), and watching it, its
//      slower frames (p90) keep within a thirtieth of a second with the CPU slowed four times
//      (Chromium on this machine's own GPU, an integrated one weaker than the phone's) — Ultra
//      measured and told, for devices past the floor;
//   2. the default world shows what it holds: hunters on at least half its lands with game, a
//      village's hunters running at their game within two minutes of watching, a village's flock
//      in its pasture, people carrying at a work hour, a mine where a land digs;
//   3. another star's world is visited and its life examined: a world of the cluster where
//      another people arose, made whole, alive, its people told;
//   4. the history is the same at every setting: a world run in the page at Low and at Ultra
//      keeps the same checkpoints.
// (npm run build first.)
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium, webkit, type Page } from "playwright";
import { YEAR, seedFromText } from "../src/kernel/index.ts";
import { EARTH } from "../src/host/planet.ts";
import { civilizationsNear, homePlanet, populationContext, wildsOf } from "../src/sim/index.ts";
import { lives } from "../src/gen/index.ts";

const args = process.argv.slice(2),
  at = (flag: string) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined),
  settings = (at("--settings") ?? "low,balanced,high,ultra").split(",");
/** The phone floor runs at a quarter of this machine's pace; a frame's budget there; the watched frames' p90. */
const PHONE = 4,
  ENTRY = 1000,
  WATCH = 34;

/** Chromium on the machine's own GPU (ANGLE over Direct3D 11), not its software stand-in. */
const GPU = ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"];

const problems: string[] = [],
  told: string[] = [];
const say = (line: string) => {
  told.push(line);
  console.log(`  ${line}`);
};

type C = Record<string, (...a: unknown[]) => unknown> & {
  client: { query<T>(q: { type: string; args?: unknown }): Promise<T>; setSpeed(s: number): void };
};

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4251, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!;

/** A page of the Earth seed, some years on, at a setting; the most peopled land's first village. */
async function open(page: Page, setting: string, year: number) {
  await page.addInitScript((q) => localStorage.setItem("causalis.quality", q), setting);
  await page.goto(`${base}?universe=earth&year=${year}`);
  await page.waitForFunction(
    () => ((globalThis as { causalis?: C }).causalis?.drawn?.() as number) > 0,
    undefined,
    {
      timeout: 900000,
    },
  );
  return page.evaluate(async () => {
    const c = (globalThis as { causalis?: C }).causalis!,
      map = await c.client.query<{ cell: number; people: number }[]>({ type: "people.map" }),
      land = [...map].sort((a, b) => b.people - a.people || a.cell - b.cell)[0]!,
      towns = await c.client.query<{ ref: string }[]>({
        type: "settlements",
        args: { cell: land.cell },
      });
    return { cell: land.cell, ref: towns[0]!.ref };
  });
}
async function watch(page: Page, v: { cell: number; ref: string }) {
  await page.evaluate(
    (cell) => ((globalThis as { causalis?: C }).causalis!.descend as (c: number) => void)(cell),
    v.cell,
  );
  await page.waitForFunction(
    () => (((globalThis as { causalis?: C }).causalis?.villages?.() as number) ?? 0) > 0,
    undefined,
    {
      timeout: 60000,
    },
  );
  await page.waitForTimeout(800);
}
/** The gaps between frames for the next `n` frames (ms). */
const frameGaps = (page: Page, n: number) =>
  page.evaluate(
    (n) =>
      new Promise<number[]>((done) => {
        const gaps: number[] = [];
        let last = performance.now();
        const tick = () => {
          const t = performance.now();
          gaps.push(t - last);
          last = t;
          if (gaps.length < n) requestAnimationFrame(tick);
          else done(gaps);
        };
        requestAnimationFrame(tick);
      }),
    n,
  );

console.log("the Phase 8 gate");
// 1. Every setting on the phone floor (--no-budgets: not here, as on a shared machine whose
// pace says nothing of a phone's).
for (const setting of args.includes("--no-budgets") ? [] : settings) {
  // Entering a village (WebKit): the longest frame as it is first drawn.
  {
    const browser = await webkit.launch(),
      page = await browser.newPage({ viewport: { width: 430, height: 932 } }),
      v = await open(page, setting, 300);
    await watch(page, v);
    const gaps = frameGaps(page, 40);
    await page.evaluate(
      (ref) => ((globalThis as { causalis?: C }).causalis!.watch as (r: string) => void)(ref),
      v.ref,
    );
    const worst = Math.round(Math.max(...(await gaps)));
    say(
      `${setting.padEnd(9)} entering a village: longest frame ${worst} ms here, about ${worst * PHONE} ms on the phone floor`,
    );
    if (worst * PHONE > ENTRY)
      problems.push(
        `${setting}: entering a village takes a ${worst * PHONE} ms frame on the phone floor`,
      );
    await browser.close();
  }
  // Watching it with the CPU slowed four times (Chromium, drawing on this machine's own GPU —
  // headless, it would draw in software, and that is no phone's GPU).
  {
    const browser = await chromium.launch({ args: GPU }),
      page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3 }),
      v = await open(page, setting, 300);
    await watch(page, v);
    await page.evaluate(
      (ref) => ((globalThis as { causalis?: C }).causalis!.watch as (r: string) => void)(ref),
      v.ref,
    );
    await page.waitForFunction(
      () => (((globalThis as { causalis?: C }).causalis?.beasts?.() as number) ?? 0) > 0,
      undefined,
      {
        timeout: 60000,
      },
    );
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: PHONE });
    await page.waitForTimeout(1500);
    const gaps = (await frameGaps(page, 240)).sort((a, b) => a - b),
      p90 = Math.round(gaps[Math.floor(gaps.length * 0.9)]!),
      drawn = await page.evaluate(() => (globalThis as { causalis?: C }).causalis!.beasts!());
    say(
      `${setting.padEnd(9)} watching a village (CPU ×${PHONE}): p90 frame ${p90} ms, ${drawn} animals drawn`,
    );
    if (setting !== "ultra" && p90 > WATCH)
      problems.push(`${setting}: a watched village's p90 frame is ${p90} ms on the phone floor`);
    await browser.close();
  }
}

// 2. The default world shows what it holds.
{
  const world = EARTH.build(seedFromText("first light"));
  world.runTo(300 * YEAR);
  const ctx = populationContext(world),
    g = homePlanet(world).generated,
    game = (c: number) =>
      g.life.species.some(
        (s) =>
          s.died === null &&
          ["grazer", "browser", "great beast"].includes(s.niche) &&
          lives(g.life, c, s.index),
      ),
    lands = ctx.provinces.all().filter((p) => p.total() > 0 && game(p.cell)),
    hunted = lands.filter(
      (p) =>
        wildsOf(ctx, p.cell).hunter >= 0 &&
        !wildsOf(ctx, p.cell).lost.includes(wildsOf(ctx, p.cell).hunter),
    );
  say(`hunters on ${hunted.length} of the ${lands.length} peopled lands with game`);
  if (hunted.length < lands.length / 2)
    problems.push(`hunters on only ${hunted.length} of ${lands.length} lands with game`);

  const browser = await chromium.launch(),
    page = await browser.newPage({ viewport: { width: 430, height: 932 } });
  await open(page, "high", 300);
  // A village with a flock, and one with a mine, among the most peopled lands.
  const found = await page.evaluate(async () => {
    const c = (globalThis as { causalis?: C }).causalis!,
      map = await c.client.query<{ cell: number; people: number }[]>({ type: "people.map" });
    let flock: { cell: number; ref: string } | null = null,
      mine: { cell: number; ref: string; what: string } | null = null;
    for (const land of [...map].sort((a, b) => b.people - a.people).slice(0, 80)) {
      const towns = await c.client.query<{ ref: string }[]>({
        type: "settlements",
        args: { cell: land.cell },
      });
      if (!towns[0]) continue;
      const plan = await c.client.query<{
        fauna?: { flock: unknown; wild: { niche: string }[] };
        works?: { mine: { what: string } | null };
      }>({ type: "village.plan", args: { ref: towns[0].ref } });
      if (!flock && plan.fauna?.flock && plan.fauna.wild.some((s) => s.niche === "hunter"))
        flock = { cell: land.cell, ref: towns[0].ref };
      if (!mine && plan.works?.mine)
        mine = { cell: land.cell, ref: towns[0].ref, what: plan.works.mine.what };
      if (flock && mine) break;
    }
    return { flock, mine };
  });
  say(
    found.flock
      ? "a village keeps its flock in its pasture, with hunters about"
      : "no village keeps a flock",
  );
  if (!found.flock)
    problems.push("no village of the default world keeps a flock with hunters about");
  say(found.mine ? `a land digs: a village's mine digs ${found.mine.what}` : "no land digs yet");
  if (!found.mine) problems.push("no land of the default world digs by year 300");
  if (found.flock) {
    await watch(page, found.flock);
    await page.evaluate(
      (ref) => ((globalThis as { causalis?: C }).causalis!.watch as (r: string) => void)(ref),
      found.flock.ref,
    );
    await page.waitForFunction(
      () => (((globalThis as { causalis?: C }).causalis?.beasts?.() as number) ?? 0) > 0,
      undefined,
      {
        timeout: 60000,
      },
    );
    // Watching: a hunt run within two minutes; people carrying at a work hour.
    let hunt = false;
    for (let k = 0; k < 240 && !hunt; k++) {
      const now = await page.evaluate(
        () => (globalThis as { causalis?: C }).causalis!.faunaNow!() as { doing: string }[],
      );
      hunt = now.some((b) => b.doing === "running at the herd");
      if (!hunt) await page.waitForTimeout(500);
    }
    say(
      hunt
        ? "hunters ran at their game within two minutes of watching"
        : "no hunt run in two minutes",
    );
    if (!hunt)
      problems.push("no hunt was seen in two minutes of watching the default world's village");
    const carrying = await page.evaluate(async () => {
      const c = (globalThis as { causalis?: C }).causalis!;
      c.client.setSpeed(3600);
      for (let k = 0; k < 120; k++) {
        const clock = document.querySelector(".panel:not([hidden]) .clock")?.textContent ?? "",
          hour = Number(/(\d\d):\d\d$/.exec(clock)?.[1] ?? -1),
          n = (c.carriersNow!() as unknown[]).length;
        if (hour >= 8 && hour <= 11 && n > 0) return n;
        await new Promise((r) => setTimeout(r, 250));
      }
      return 0;
    });
    say(`${carrying} people carrying what they work at a morning hour`);
    if (!carrying)
      problems.push("no one carries anything in the default world's village of a morning");
  }
  // 3. Another star's world, where another people arose: visited, alive, its people told.
  const civ = civilizationsNear(world)[0];
  if (!civ) problems.push("the cluster holds no other people");
  else {
    await page.evaluate(
      ([ref, i]) => (globalThis as { causalis?: C }).causalis!.visitForeign!(ref, i),
      [civ.star, civ.planet] as const,
    );
    await page.waitForFunction(
      () => (((globalThis as { causalis?: C }).causalis?.visiting?.() as number) ?? -1) >= 0,
      undefined,
      {
        timeout: 60000,
      },
    );
    await page.waitForTimeout(800);
    const text =
        (await page.locator(".panel:not([hidden]) .inspector").first().textContent()) ?? "",
      alive = /Life greens its lands/.test(text),
      people = /A people of another star/i.test(text);
    say(
      `a world of another star visited: ${alive ? "alive" : "lifeless"}, ${people ? "its people told" : "no people told"}`,
    );
    if (!alive || !people)
      problems.push("the other people's world was not shown alive with its people");
  }
  await browser.close();
}

// 4. The same history at every setting.
{
  const chains: Record<string, { t: number; chain: string }[]> = {};
  for (const setting of ["low", "ultra"]) {
    const browser = await chromium.launch(),
      page = await browser.newPage({ viewport: { width: 430, height: 932 } });
    await open(page, setting, 120);
    chains[setting] = await page.evaluate(() =>
      (globalThis as { causalis?: C }).causalis!.client.query<{ t: number; chain: string }[]>({
        type: "checkpoints",
      }),
    );
    await browser.close();
  }
  const low = new Map(chains.low!.map((c) => [c.t, c.chain])),
    same = chains.ultra!.filter((c) => low.has(c.t)),
    differ = same.filter((c) => low.get(c.t) !== c.chain);
  say(`${same.length} checkpoints compared at Low and at Ultra: ${differ.length} differ`);
  if (!same.length) problems.push("no checkpoints to compare between settings");
  if (differ.length)
    problems.push(`the history differs between Low and Ultra at ${differ.length} checkpoints`);
}

await server.close();
console.log(
  problems.length
    ? `\nthe Phase 8 gate fails:\n${problems.map((p) => `  ✗ ${p}`).join("\n")}`
    : "\nthe Phase 8 gate passes",
);
process.exit(problems.length ? 1 : 0);
