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

type AppState = { mode: string; t: number };
async function state(page: Page): Promise<AppState | null> {
  return page.evaluate(() => {
    const c = (
      globalThis as { causalis?: { mode: string; client: { status: { t: number } | null } } }
    ).causalis;
    return c && c.client.status ? { mode: c.mode, t: c.client.status.t } : null;
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

const problems: string[] = [];
for (const engine of engines) {
  const browser = await ENGINES[engine]!.launch();
  try {
    for (const query of ["", "?inline"]) {
      const label = `${engine}${query}`,
        page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
        errors: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${base}${query}`);
      const first = await waitFor(
        `${label} to start`,
        () => state(page),
        (s) => s.t > 0,
      );
      const later = await waitFor(
        `${label} time to advance`,
        () => state(page),
        (s) => s.t > first.t,
        10000,
      );
      const expected = query ? "in-thread" : "worker";
      if (later.mode !== expected)
        problems.push(`${label}: ran ${later.mode}, expected ${expected}`);
      if (errors.length) problems.push(`${label}: ${errors.join(" | ")}`);
      console.log(
        `${label.padEnd(18)} ${later.mode.padEnd(9)} t ${first.t} → ${later.t}  (${browser.version()})`,
      );
      if (shotsAt && !query) {
        mkdirSync(shotsAt, { recursive: true });
        await page.screenshot({ path: join(shotsAt, `${engine}.png`) });
      }
      await page.close();
    }
  } catch (error) {
    problems.push(`${engine}: ${(error as Error).message}`);
  } finally {
    await browser.close();
  }
}
await server.close();
if (problems.length) {
  for (const p of problems) console.log(p);
  process.exitCode = 1;
} else console.log(`the app runs in ${engines.join(", ")}`);
