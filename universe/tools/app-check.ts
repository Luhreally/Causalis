// node tools/app-check.ts [--shots dir] [chromium webkit firefox] — load the built app
// (npm run build first) in real browser engines and check that it boots, that the
// simulation runs in its worker (and in-thread with ?inline), that time advances,
// and that nothing is logged as an error. --shots saves a screenshot per engine.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium, firefox, webkit, type BrowserType, type Page } from "playwright";

const root = fileURLToPath(new URL("..", import.meta.url));
const ENGINES: Record<string, BrowserType> = { chromium, webkit, firefox };
const args = process.argv.slice(2);
const shotsAt = args.includes("--shots") ? args[args.indexOf("--shots") + 1] : undefined;
const wanted = args.filter((a) => a in ENGINES);
const engines = wanted.length ? wanted : Object.keys(ENGINES);

const server = await preview({
  root,
  logLevel: "silent",
  preview: { port: 4179, strictPort: false },
});
const base = server.resolvedUrls?.local[0];
if (!base) throw new Error("the preview server did not start");

type AppState = { mode: string; t: number; drawn: number };
type Exposed = {
  mode: string;
  client?: { status: { t: number } | null; query<T>(q: { type: string }): Promise<T> };
  descend?: (cell: number) => void;
  villages?: () => number;
  watch?: (ref: string) => void;
  watching?: () => number;
  sky?: () => void;
  skyBodies?: () => number;
  stars?: () => void;
  starCount?: () => number;
  drawn?: () => number;
  select?: (cell: number) => void;
  walk?: () => number;
  bench?: { fps: number; frameMs: number; instances: number; tier: string };
};
async function state(page: Page): Promise<AppState | null> {
  return page.evaluate(() => {
    const c = (globalThis as { causalis?: Exposed }).causalis;
    return c && c.client?.status
      ? { mode: c.mode, t: c.client.status.t, drawn: c.drawn?.() ?? 0 }
      : null;
  });
}

async function waitFor<T>(
  what: string,
  get: () => Promise<T | null>,
  ok: (v: T) => boolean,
  ms = 20000,
): Promise<T> {
  const until = Date.now() + ms;
  for (;;) {
    const v = await get();
    if (v !== null && ok(v)) return v;
    if (Date.now() > until) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

const problems: string[] = [],
  warnings: string[] = [];

class NoWebGL extends Error {}
for (const engine of engines) {
  // CI machines have no GPU: Chromium needs its software GL allowed, Firefox its
  // WebGL forced on (software rendering is slow, but draws the same scene).
  const linux = process.platform === "linux";
  const browser = await ENGINES[engine]!.launch({
    ...(engine === "chromium" && linux
      ? {
          args: [
            "--enable-unsafe-swiftshader",
            "--use-angle=swiftshader",
            "--ignore-gpu-blocklist",
          ],
        }
      : {}),
    ...(engine === "firefox"
      ? { firefoxUserPrefs: { "webgl.force-enabled": true, "webgl.disabled": false } }
      : {}),
  });
  try {
    // The Earth globe a century on, when there are villages to meet people in, and the
    // sandbox (where time must move), each in a worker and in-thread.
    const cases = [
      // A century on, the planet has villages, market towns and realms to look at.
      { query: "?year=120", name: "earth", moves: false, pick: 20000 },
      { query: "?year=120&inline", name: "earth", moves: false, pick: 20000 },
      { query: "?universe=sandbox", name: "sandbox", moves: true, pick: 3 },
      { query: "?universe=sandbox&inline", name: "sandbox", moves: true, pick: 3 },
      // Open worlds: a sea people's, and one where no people rose at all.
      { query: "?universe=alien&seed=alien%2055&year=40", name: "sea", moves: false, pick: 20000 },
      {
        query: "?universe=alien&seed=alien%200&year=40",
        name: "lifeless",
        // With no one to reckon, its years turn at once: time must still move.
        moves: true,
        pick: 20000,
      },
    ];
    for (const { query, name, moves, pick } of cases) {
      const label = `${engine} ${name}${query.includes("inline") ? " inline" : ""}`,
        page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
        errors: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${base}${query}`);
      // The world is run a century on before its first frame (the whole planet), and
      // software GL on a CI machine is slow: allow for both.
      const first = await waitFor(
        `${label} to start and draw`,
        () => state(page),
        (s) => s.drawn > 0,
        process.env.CI ? 180000 : 90000,
      ).catch(async (error: Error) => {
        const said = await page.evaluate(
          () => (globalThis as { causalis?: { error?: string } }).causalis?.error,
        );
        if (said === "webgl") throw new NoWebGL(label);
        throw new Error(
          `${error.message}${errors.length ? ` (page said: ${errors.slice(0, 3).join(" | ")})` : ""}`,
        );
      });
      const later = moves
        ? await waitFor(
            `${label} time to advance`,
            () => state(page),
            (s) => s.t > first.t,
            10000,
          )
        : first;
      // Open the inspector on a place and wait for its facts and its why-tree.
      await page.evaluate(
        (cell) => (globalThis as { causalis?: Exposed }).causalis?.select?.(cell),
        pick,
      );
      await page.waitForSelector(".inspector:not([hidden]) .fact", { timeout: 10000 });
      await page.waitForSelector(".inspector:not([hidden]) .why .claim", { timeout: 10000 });
      const expected = query.includes("inline") ? "in-thread" : "worker";
      if (later.mode !== expected)
        problems.push(`${label}: ran ${later.mode}, expected ${expected}`);
      if (errors.length) problems.push(`${label}: ${errors.join(" | ")}`);
      console.log(
        `${label.padEnd(24)} ${later.mode.padEnd(9)} t ${first.t} → ${later.t}, ${later.drawn} drawn  (${browser.version()})`,
      );
      if (shotsAt && !query.includes("inline")) {
        mkdirSync(shotsAt, { recursive: true });
        await page.screenshot({ path: join(shotsAt, `${engine}-${name}.png`) });
      }
      if (name === "earth") {
        // The most peopled province's inspector shows its market.
        await page.evaluate(async () => {
          const c = (globalThis as { causalis?: Exposed }).causalis!;
          const map = await c.client!.query<{ cell: number; centre: number; people: number }[]>({
            type: "people.map",
          });
          // Pick the spot at the middle of the most peopled province.
          c.select!([...map].sort((a, b) => b.people - a.people || a.cell - b.cell)[0]!.centre);
        });
        // Its page (Phase 10 M92): its market and its realm, each a tab of its own.
        await page.waitForFunction(
          () => {
            const tabs = [...document.querySelectorAll(".page-window .tab")].map(
              (t) => t.textContent,
            );
            return tabs.includes("Economy") && tabs.includes("Realm");
          },
          undefined,
          { timeout: 10000 },
        );
        await page.click(".page-window .tab:has-text('Economy')");
        await page.waitForSelector(".page-window .table .entry", { timeout: 10000 });
        if (shotsAt && !query.includes("inline"))
          await page.screenshot({ path: join(shotsAt, `${engine}-market.png`) });
        // Their language, and the globe coloured by languages (hues by family). (A label's
        // own words come first; its ⓘ to the book of concepts follows them.)
        await page.click(".page-window .tab:has-text('People')");
        await page.waitForFunction(
          () =>
            [...document.querySelectorAll(".page-window .fact-label")].some(
              (x) => x.firstChild?.textContent === "Tongue",
            ),
          undefined,
          { timeout: 10000 },
        );
        await page.evaluate(() =>
          [...document.querySelectorAll<HTMLButtonElement>("button")]
            .find((b) => b.textContent === "Tongues")
            ?.click(),
        );
        if (shotsAt && !query.includes("inline")) {
          await new Promise((r) => setTimeout(r, 1500));
          await page.screenshot({ path: join(shotsAt, `${engine}-tongues.png`) });
        }
        // The god's hand: withhold the rain here, confirm, and see the act listed.
        await page.click(".page-window .tab:has-text('Overview')");
        await page.waitForSelector(".page-window .tool", { timeout: 10000 });
        await page.evaluate(() =>
          [...document.querySelectorAll<HTMLButtonElement>(".page-window .tool")]
            .find((b) => b.textContent === "Withhold the rain")!
            .click(),
        );
        await page.click(".page-window .confirm .act");
        await page.waitForFunction(
          () =>
            [...document.querySelectorAll(".page-window .line")].some((l) =>
              /^By your hand: you withheld the rain/.test(l.textContent ?? ""),
            ),
          undefined,
          { timeout: 10000 },
        );
        if (shotsAt && !query.includes("inline"))
          await page.screenshot({ path: join(shotsAt, `${engine}-hand.png`) });
        // Follow the land: the toggle holds, and news of it comes as the years pass.
        await page.click(".page-window .follow");
        await page.waitForFunction(
          () =>
            document.querySelector(".page-window .follow")?.textContent === "Following this land ✓",
          undefined,
          { timeout: 10000 },
        );
        await page.waitForSelector(".tidings .tiding .tiding-claim", { timeout: 30000 });
        const news = await page.evaluate(
          () => document.querySelector(".tidings .tiding .tiding-claim")?.textContent ?? "",
        );
        console.log(`${(label + " tidings").padEnd(24)} ${later.mode.padEnd(9)} ${news}`);
        // Its years as charts, and the chronicle of the world.
        await page.click(".page-window .tab:has-text('People')");
        await page.waitForSelector(".page-window .chart svg", {
          timeout: 10000,
        });
        await page.evaluate(() =>
          [...document.querySelectorAll<HTMLButtonElement>(".panel:not([hidden]) .link")]
            .find((b) => b.textContent?.includes("Chronicle"))!
            .click(),
        );
        // The chronicle opens in the page window: its ages told, its firsts compared.
        await page.waitForFunction(
          () =>
            document.querySelector(".page-window .page-title")?.textContent === "The Chronicle" &&
            document.querySelectorAll(".page-window .block-text p").length >= 2,
          undefined,
          { timeout: 20000 },
        );
        await page.click(".page-window .tab:has-text('Firsts')");
        await page.waitForFunction(
          () => document.querySelectorAll(".page-window .table tr.entry").length >= 3,
          undefined,
          { timeout: 10000 },
        );
        if (shotsAt && !query.includes("inline"))
          await page.screenshot({ path: join(shotsAt, `${engine}-chronicle.png`) });
        // And the ledger: the realms side by side.
        await page.evaluate(() =>
          [...document.querySelectorAll<HTMLButtonElement>(".panel:not([hidden]) .link")]
            .find((b) => b.textContent?.includes("Ledger"))!
            .click(),
        );
        await page.waitForFunction(
          () =>
            document.querySelector(".page-window .page-title")?.textContent === "The Ledger" &&
            document.querySelectorAll(".page-window .bar-row").length >= 1,
          undefined,
          { timeout: 20000 },
        );
        // Down into the region around a copper deposit, then a tile's inspector.
        await page.evaluate(async () => {
          const c = (globalThis as { causalis?: Exposed }).causalis!;
          const deposits = await c.client!.query<{ kind: string; province: number }[]>({
            type: "deposits",
          });
          c.descend!(deposits.find((d) => d.kind === "copper")!.province);
        });
        await waitFor(
          `${label} region`,
          () => state(page),
          (s) => s.drawn === 128 * 128,
        );
        await page.evaluate(() =>
          (globalThis as { causalis?: Exposed }).causalis?.select?.(64 * 128 + 64),
        );
        await page.waitForSelector(".panel:not([hidden]) .inspector:not([hidden]) .fact", {
          timeout: 10000,
        });
        console.log(`${(label + " region").padEnd(24)} ${later.mode.padEnd(9)} 16384 tiles drawn`);
        if (shotsAt && !query.includes("inline"))
          await page.screenshot({ path: join(shotsAt, `${engine}-region.png`) });

        // Down to the most peopled province's first village: meet a family, open a person.
        const village = await page.evaluate(async () => {
          const c = (globalThis as { causalis?: Exposed }).causalis!;
          const map = await c.client!.query<{ cell: number; people: number }[]>({
            type: "people.map",
          });
          for (const p of [...map].sort((a, b) => b.people - a.people || a.cell - b.cell)) {
            const vs = await c.client!.query<{ tile: number; name: string; ref: string }[]>({
              type: "settlements",
              args: { cell: p.cell },
            } as { type: string });
            if (vs.length) {
              c.descend!(p.cell);
              return vs[0]!;
            }
          }
          return null;
        });
        if (!village) problems.push(`${label}: no village a century on`);
        else {
          await waitFor(
            `${label} villages`,
            () =>
              page.evaluate(
                () => (globalThis as { causalis?: Exposed }).causalis?.villages?.() ?? null,
              ),
            (n) => n > 0,
          );
          await page.evaluate(
            (tile) => (globalThis as { causalis?: Exposed }).causalis?.select?.(tile),
            village.tile,
          );
          // A shrine raised by the god's hand: confirmed, then listed with its why.
          const shrine = page.locator(".page-window .tool", {
            hasText: "Raise a shrine",
          });
          await shrine.waitFor({ timeout: 10000 });
          await shrine.click();
          await page
            .locator(".page-window .tool", {
              hasText: "Raise a shrine — confirm",
            })
            .click();
          await page
            .locator(".page-window .line", {
              hasText: "A shrine you raised stands here",
            })
            .waitFor({ timeout: 10000 });
          // A family met (the town's Families): its household's page, then one of them.
          await page.click(".page-window .tab:has-text('Families')");
          const meet = page.locator(".page-window .act", {
            hasText: "Meet a family",
          });
          await meet.waitFor({ timeout: 10000 });
          await meet.click();
          await page.waitForFunction(
            () =>
              / household$/.test(
                document.querySelector(".page-window .page-title")?.textContent ?? "",
              ),
            undefined,
            { timeout: 10000 },
          );
          if (shotsAt && !query.includes("inline"))
            await page.screenshot({ path: join(shotsAt, `${engine}-village.png`) });
          await page.click(".page-window .line.entry");
          await page.waitForFunction(
            () => {
              const title = document.querySelector(".page-window .page-title")?.textContent ?? "…";
              return (
                title !== "…" &&
                !/household$/.test(title) &&
                title.includes(" ") &&
                !!document.querySelector(".page-window .why .claim")
              );
            },
            undefined,
            { timeout: 10000 },
          );
          const who = await page.evaluate(
            () => document.querySelector(".page-window .page-title")?.textContent ?? "",
          );
          console.log(
            `${(label + " people").padEnd(24)} ${later.mode.padEnd(9)} met ${who} of ${village.name}`,
          );
          if (shotsAt && !query.includes("inline"))
            await page.screenshot({ path: join(shotsAt, `${engine}-person.png`) });

          // Through the microscope: the village's day, with its watched families.
          await page.evaluate(
            (ref) => (globalThis as { causalis?: Exposed }).causalis?.watch?.(ref),
            village.ref,
          );
          const watched = await waitFor(
            `${label} watching`,
            () =>
              page.evaluate(
                () => (globalThis as { causalis?: Exposed }).causalis?.watching?.() ?? null,
              ),
            (n) => n > 0,
          );
          console.log(
            `${(label + " watch").padEnd(24)} ${later.mode.padEnd(9)} ${watched} people of ${village.name} watched`,
          );
          if (shotsAt && !query.includes("inline")) {
            await new Promise((r) => setTimeout(r, 1500));
            await page.screenshot({ path: join(shotsAt, `${engine}-watch.png`) });
          }

          // The hand: laid on the village, everyone there is someone, one by one.
          await page.evaluate(async (ref) => {
            const c = (globalThis as { causalis?: Exposed }).causalis!;
            await (
              c.client as unknown as { command(t: string, a: unknown): Promise<unknown> }
            ).command("hand.lay", { village: ref });
            c.watch!(ref);
          }, village.ref);
          const held = await waitFor(
            `${label} the hand`,
            () =>
              page.evaluate(
                () => (globalThis as { causalis?: Exposed }).causalis?.watching?.() ?? null,
              ),
            (n) => n > watched,
          );
          console.log(
            `${(label + " hand").padEnd(24)} ${later.mode.padEnd(9)} ${held} people of ${village.name} under the hand`,
          );
          if (shotsAt && !query.includes("inline")) {
            await new Promise((r) => setTimeout(r, 1500));
            await page.screenshot({ path: join(shotsAt, `${engine}-hand-village.png`) });
          }
        }
      }
      if (name === "sea") {
        // Out to the star's system: its worlds and moons drawn, going round.
        await page.evaluate(() => (globalThis as { causalis?: Exposed }).causalis?.sky?.());
        const bodies = await waitFor(
          `${label} the sky`,
          () =>
            page.evaluate(
              () => (globalThis as { causalis?: Exposed }).causalis?.skyBodies?.() ?? null,
            ),
          (n) => n > 3,
        );
        console.log(
          `${(label + " sky").padEnd(24)} ${later.mode.padEnd(9)} ${bodies} bodies of the star's system`,
        );
        if (shotsAt) {
          await new Promise((r) => setTimeout(r, 1500));
          await page.screenshot({ path: join(shotsAt, `${engine}-sky.png`) });
        }
        // Out again, to the stars around.
        await page.evaluate(() => (globalThis as { causalis?: Exposed }).causalis?.stars?.());
        const stars = await waitFor(
          `${label} the stars`,
          () =>
            page.evaluate(
              () => (globalThis as { causalis?: Exposed }).causalis?.starCount?.() ?? null,
            ),
          (n) => n > 500,
        );
        console.log(
          `${(label + " stars").padEnd(24)} ${later.mode.padEnd(9)} ${stars} stars within reach`,
        );
        if (shotsAt) {
          await new Promise((r) => setTimeout(r, 1500));
          await page.screenshot({ path: join(shotsAt, `${engine}-stars.png`) });
        }
      }
      await page.close();
    }
    // A first visit: the welcome, and a choice that starts a universe.
    {
      const first = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await first.goto(base);
      await first.waitForSelector(".welcome .choice", { timeout: 20000 });
      const choices = await first.$$eval(".welcome .choice", (bs) => bs.length);
      await first.click(".welcome .choice");
      await first.waitForURL(/universe=earth/, { timeout: 20000 });
      console.log(`${(engine + " welcome").padEnd(24)} ${choices} ways to begin; Earth chosen`);
      await first.close();
    }
    // Keeping a world: save it from the saves page, see it listed, and take it up again.
    // (With the guided walk asked for: tapping a land moves it on; Skip ends it.)
    {
      const kept = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await kept.goto(`${base}?universe=earth&seed=kept&walk`);
      await kept.waitForFunction(
        () => ((globalThis as { causalis?: Exposed }).causalis?.drawn?.() ?? 0) > 0,
        undefined,
        { timeout: 60000 },
      );
      const stepOf = () =>
        kept.evaluate(() => (globalThis as { causalis?: Exposed }).causalis?.walk?.() ?? -2);
      const first = await stepOf();
      await kept.evaluate(() => (globalThis as { causalis?: Exposed }).causalis?.select?.(1000));
      await kept.waitForFunction(
        () => (globalThis as { causalis?: Exposed }).causalis?.walk?.() === 1,
        undefined,
        { timeout: 10000 },
      );
      await kept.click(".walk .link:has-text('Skip')");
      const after = await stepOf();
      if (first !== 0 || after !== -1)
        throw new Error(`the guided walk went ${first} → ${after}, not 0 → 1 → skipped`);
      console.log(`${(engine + " walk").padEnd(24)} shown, moved on by a tap, skipped`);
      await kept.click(".panel:not([hidden]) .world-line button:has-text('Saves')");
      await kept.click(".panel:not([hidden]) .inspector .act:has-text('Save this world now')");
      const line = kept.locator(".panel:not([hidden]) .inspector .line", { hasText: "“kept”" });
      await line.first().waitFor({ timeout: 20000 });
      const listed = (await line.first().textContent()) ?? "";
      await line.first().click();
      await kept
        .locator(".panel:not([hidden]) .inspector p", { hasText: /back at year/ })
        .first()
        .waitFor({ timeout: 20000 });
      console.log(`${(engine + " saves").padEnd(24)} saved, listed (${listed}), loaded`);
      await kept.close();
    }
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${base}?bench=3000`);
    const bench = await waitFor(
      `${engine} bench`,
      () => page.evaluate(() => (globalThis as { causalis?: Exposed }).causalis?.bench ?? null),
      () => true,
      30000,
    );
    console.log(
      `${(engine + " bench").padEnd(18)} ${bench.instances} figures: ${bench.fps.toFixed(1)} fps (${bench.frameMs.toFixed(1)} ms), ${bench.tier}`,
    );
    await page.close();
  } catch (error) {
    // A page that says it has no WebGL is a warning: the same pages are checked on
    // machines with a GPU.
    if (error instanceof NoWebGL)
      warnings.push(
        `${error.message}: this browser has no WebGL here, so its pages were not drawn`,
      );
    else problems.push(`${engine}: ${(error as Error).message}`);
  } finally {
    await browser.close();
  }
}
await server.close();
for (const w of warnings)
  console.log(process.env.GITHUB_ACTIONS ? `::warning title=app-check::${w}` : `warning: ${w}`);
if (problems.length) {
  // In CI, each problem is an annotation (readable without the job's log).
  for (const p of problems)
    console.log(process.env.GITHUB_ACTIONS ? `::error title=app-check::${p}` : p);
  process.exitCode = 1;
} else console.log(`the app runs in ${engines.join(", ")}`);
