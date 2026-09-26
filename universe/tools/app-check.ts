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
  drawn?: () => number;
  select?: (cell: number) => void;
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
    // The Earth globe 240 years on, when there are villages to meet people in, and the
    // sandbox (where time must move), each in a worker and in-thread.
    const cases = [
      { query: "?year=240", name: "earth", moves: false, pick: 20000 },
      { query: "?year=240&inline", name: "earth", moves: false, pick: 20000 },
      { query: "?universe=sandbox", name: "sandbox", moves: true, pick: 3 },
      { query: "?universe=sandbox&inline", name: "sandbox", moves: true, pick: 3 },
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
      // Software GL on a CI machine is slow: allow a minute for the first frame.
      const first = await waitFor(
        `${label} to start and draw`,
        () => state(page),
        (s) => s.drawn > 0,
        process.env.CI ? 60000 : 20000,
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
          const map = await c.client!.query<{ cell: number; people: number }[]>({
            type: "people.map",
          });
          c.select!([...map].sort((a, b) => b.people - a.people || a.cell - b.cell)[0]!.cell);
        });
        await page.waitForFunction(
          () =>
            [...document.querySelectorAll(".panel:not([hidden]) .inspector h3")].some(
              (h) => h.textContent === "Their market",
            ) &&
            [...document.querySelectorAll(".panel:not([hidden]) .inspector h3")].some(
              (h) => h.textContent === "Their rulers",
            ) &&
            document.querySelectorAll(".panel:not([hidden]) .inspector .line").length > 3,
          undefined,
          { timeout: 10000 },
        );
        if (shotsAt && !query.includes("inline"))
          await page.screenshot({ path: join(shotsAt, `${engine}-market.png`) });
        // The god's hand: withhold the rain here, confirm, and see the act listed.
        await page.waitForSelector(".panel:not([hidden]) .tool", { timeout: 10000 });
        await page.evaluate(() =>
          [...document.querySelectorAll<HTMLButtonElement>(".panel:not([hidden]) .tool")]
            .find((b) => b.textContent === "Withhold the rain")!
            .click(),
        );
        await page.click(".panel:not([hidden]) .confirm .act");
        await page.waitForFunction(
          () =>
            [...document.querySelectorAll(".panel:not([hidden]) .inspector .line")].some((l) =>
              /^By your hand: you withheld the rain/.test(l.textContent ?? ""),
            ),
          undefined,
          { timeout: 10000 },
        );
        if (shotsAt && !query.includes("inline"))
          await page.screenshot({ path: join(shotsAt, `${engine}-hand.png`) });
        // Follow the land: the toggle holds, and news of it comes as the years pass.
        await page.click(".panel:not([hidden]) .inspector .follow");
        await page.waitForFunction(
          () =>
            document.querySelector(".panel:not([hidden]) .inspector .follow")?.textContent ===
            "Following this land ✓",
          undefined,
          { timeout: 10000 },
        );
        await page.waitForSelector(".tidings .tiding .tiding-claim", { timeout: 30000 });
        const news = await page.evaluate(
          () => document.querySelector(".tidings .tiding .tiding-claim")?.textContent ?? "",
        );
        console.log(`${(label + " tidings").padEnd(24)} ${later.mode.padEnd(9)} ${news}`);
        // Its years as charts, and the chronicle of the world.
        await page.waitForSelector(".panel:not([hidden]) .inspector .chart svg", {
          timeout: 10000,
        });
        await page.evaluate(() =>
          [...document.querySelectorAll<HTMLButtonElement>(".panel:not([hidden]) .link")]
            .find((b) => b.textContent === "Chronicle")!
            .click(),
        );
        await page.waitForFunction(
          () =>
            document.querySelector(".panel:not([hidden]) .inspector h2")?.textContent ===
              "Chronicle" &&
            document.querySelectorAll(".panel:not([hidden]) .inspector .facts .line").length >= 3,
          undefined,
          { timeout: 10000 },
        );
        if (shotsAt && !query.includes("inline"))
          await page.screenshot({ path: join(shotsAt, `${engine}-chronicle.png`) });
        // Down into the region around a copper deposit, then a tile's inspector.
        await page.evaluate(async () => {
          const c = (globalThis as { causalis?: Exposed }).causalis!;
          const deposits = await c.client!.query<{ kind: string; cell: number }[]>({
            type: "deposits",
          });
          c.descend!(deposits.find((d) => d.kind === "copper")!.cell);
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
        if (!village) problems.push(`${label}: no village 240 years on`);
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
          const shrine = page.locator(".panel:not([hidden]) .inspector:not([hidden]) .tool", {
            hasText: "Raise a shrine",
          });
          await shrine.waitFor({ timeout: 10000 });
          await shrine.click();
          await page
            .locator(".panel:not([hidden]) .inspector:not([hidden]) .tool", {
              hasText: "Raise it — confirm",
            })
            .click();
          await page
            .locator(".panel:not([hidden]) .inspector:not([hidden]) .line", {
              hasText: "A shrine you raised stands here",
            })
            .waitFor({ timeout: 10000 });
          const meet = page.locator(".panel:not([hidden]) .inspector:not([hidden]) .act", {
            hasText: "Meet a family",
          });
          await meet.waitFor({ timeout: 10000 });
          await meet.click();
          await page.waitForSelector(".panel:not([hidden]) .inspector .family .person", {
            timeout: 10000,
          });
          if (shotsAt && !query.includes("inline"))
            await page.screenshot({ path: join(shotsAt, `${engine}-village.png`) });
          await page.click(".panel:not([hidden]) .inspector .family .person");
          await page.waitForFunction(
            () => {
              const panel = document.querySelector(".panel:not([hidden]) .inspector");
              const title = panel?.querySelector("h2")?.textContent ?? "…";
              return title !== "…" && title.includes(" ") && !!panel?.querySelector(".why .claim");
            },
            undefined,
            { timeout: 10000 },
          );
          const who = await page.evaluate(
            () => document.querySelector(".panel:not([hidden]) .inspector h2")?.textContent ?? "",
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
      await page.close();
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
