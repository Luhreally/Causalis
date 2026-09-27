// node tools/look.ts <dir> [year] — the look at a phone's size (the art track's eye): the welcome, the globe
// with the guided walk, a land, a page, the saves, the star's worlds and the stars, a region, a
// village and a city (when there is one), as screenshots in <dir>.
// (npm run build first.)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium } from "playwright";
const dir = process.argv[2]!;
mkdirSync(dir, { recursive: true });
const server = await preview({
  root: fileURLToPath(new URL("..", import.meta.url)),
  logLevel: "silent",
  preview: { port: 4231, strictPort: false },
});
const base = server.resolvedUrls!.local[0]!;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
type C = Record<string, (...a: unknown[]) => unknown> & {
  client?: { query<T>(q: { type: string; args?: unknown }): Promise<T> };
};
const c = () => (globalThis as { causalis?: C }).causalis!;
await page.goto(base);
await page.waitForSelector(".welcome .choice");
await page.screenshot({ path: join(dir, "welcome.png") });
await page.goto(`${base}?universe=earth&year=${process.argv[3] ?? 200}&walk`);
await page.waitForFunction(
  () => ((globalThis as { causalis?: C }).causalis?.drawn?.() as number) > 0,
  undefined,
  { timeout: 600000 },
);
await page.waitForTimeout(1500);
await page.screenshot({ path: join(dir, "globe-walk.png") });
const map = await page.evaluate(() =>
  (globalThis as { causalis?: C }).causalis!.client!.query<
    { centre: number; people: number; cell: number }[]
  >({ type: "people.map" }),
);
const top = [...map].sort((a, b) => b.people - a.people)[0]!;
await page.evaluate((cell) => (globalThis as { causalis?: C }).causalis!.select!(cell), top.centre);
await page.waitForSelector(".page-window .why .claim");
await page.waitForTimeout(800);
await page.screenshot({ path: join(dir, "land.png") });
// A lineage of its living world, on its own page.
const life = page.locator(".page-window .tab", { hasText: "Life" }).first();
if (await life.count()) {
  await life.click();
  const wild = page.locator(".page-window .line.entry").first();
  if (await wild.count()) {
    await wild.click();
    await page.waitForSelector(".page-window .why .claim");
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(dir, "page.png") });
  }
}
await page.click(".panel:not([hidden]) .world-line button:has-text('Saves')");
await page.waitForTimeout(800);
await page.screenshot({ path: join(dir, "saves.png") });
await page.click(".panel:not([hidden]) .world-line button:has-text('Settings')");
await page.waitForTimeout(1500);
await page.screenshot({ path: join(dir, "settings.png") });
// Out to the star's worlds and the stars around, and back.
await page.evaluate(() => (globalThis as { causalis?: C }).causalis!.sky!());
await page.waitForFunction(
  () => (((globalThis as { causalis?: C }).causalis?.skyBodies?.() as number) ?? 0) > 0,
  undefined,
  { timeout: 60000 },
);
await page.waitForTimeout(1500);
await page.screenshot({ path: join(dir, "system.png") });
// Its window folded: the worlds behind it.
await page.click(".panel:not([hidden]) .inspector:not([hidden]) .fold");
await page.waitForTimeout(600);
await page.screenshot({ path: join(dir, "system-folded.png") });
await page.evaluate(() => (globalThis as { causalis?: C }).causalis!.stars!());
await page.waitForFunction(
  () => (((globalThis as { causalis?: C }).causalis?.starCount?.() as number) ?? 0) > 0,
  undefined,
  { timeout: 60000 },
);
await page.waitForTimeout(1500);
await page.screenshot({ path: join(dir, "stars.png") });
await page.goto(`${base}?universe=earth&year=${process.argv[3] ?? 200}`);
await page.waitForFunction(
  () => ((globalThis as { causalis?: C }).causalis?.drawn?.() as number) > 0,
  undefined,
  { timeout: 600000 },
);
// Down to the land, and into a village.
await page.evaluate((cell) => (globalThis as { causalis?: C }).causalis!.descend!(cell), top.cell);
await page.waitForFunction(
  () => (((globalThis as { causalis?: C }).causalis?.villages?.() as number) ?? 0) > 0,
  undefined,
  { timeout: 60000 },
);
await page.waitForTimeout(1500);
await page.screenshot({ path: join(dir, "region.png") });
const vs = await page.evaluate(
  (cell) =>
    (globalThis as { causalis?: C }).causalis!.client!.query<{ ref: string }[]>({
      type: "settlements",
      args: { cell },
    }),
  top.cell,
);
if (vs[0]) {
  await page.evaluate((ref) => (globalThis as { causalis?: C }).causalis!.watch!(ref), vs[0].ref);
  await page.waitForFunction(
    () => (((globalThis as { causalis?: C }).causalis?.watching?.() as number) ?? 0) > 0,
    undefined,
    { timeout: 60000 },
  );
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(dir, "village.png") });
}
// A city, if the world has one yet: its quarters from further off.
const city = await page.evaluate(async () => {
  const c = (globalThis as { causalis?: C }).causalis!;
  const map = await c.client!.query<{ cell: number; people: number }[]>({ type: "people.map" });
  for (const land of [...map].sort((a, b) => b.people - a.people).slice(0, 60)) {
    const vs = await c.client!.query<{ ref: string }[]>({
      type: "settlements",
      args: { cell: land.cell },
    });
    for (const v of vs) {
      const s = await c.client!.query<{ city: unknown }>({
        type: "settlement",
        args: { ref: v.ref },
      });
      if (s.city) return v.ref;
    }
  }
  return null;
});
if (city) {
  await page.evaluate((ref) => (globalThis as { causalis?: C }).causalis!.watch!(ref), city);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: join(dir, "city.png") });
}
await browser.close();
await server.close();
console.log("shots in", dir);
