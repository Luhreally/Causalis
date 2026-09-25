// node tools/tour.ts <out-dir> [year] [engine] [phone|desktop] — load the built app
// (npm run build first) at a year, and screenshot the key views: the globe, its
// people lens, the region of the most peopled farming province with its villages,
// and a village's inspector. For looking at what a change did.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium, firefox, webkit } from "playwright";

const [out, yearArg = "280", engine = "webkit", size = "phone"] = process.argv.slice(2);
if (!out) throw new Error("usage: node tools/tour.ts <out-dir> [year] [engine] [phone|desktop]");
mkdirSync(out, { recursive: true });
const root = fileURLToPath(new URL("..", import.meta.url));
const server = await preview({
  root,
  logLevel: "silent",
  preview: { port: 4181, strictPort: false },
});
const base = server.resolvedUrls!.local[0]!;
const ENGINES = { chromium, firefox, webkit };
const browser = await ENGINES[engine as keyof typeof ENGINES].launch();
const viewport = size === "phone" ? { width: 390, height: 844 } : { width: 1280, height: 800 };
const page = await browser.newPage({ viewport });
page.on("pageerror", (e) => console.log(`[pageerror] ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") console.log(`[console] ${m.text()}`);
});

type Api = {
  client?: { query<T>(q: { type: string; args?: unknown }): Promise<T>; setSpeed(s: number): void };
  drawn?: () => number;
  descend?: (cell: number) => void;
  select?: (n: number) => void;
  villages?: () => number;
};
const api = <T>(fn: (c: Api) => T | Promise<T>) => page.evaluate(fn as never) as Promise<T>;
const until = async (what: string, test: () => Promise<boolean>, ms = 60000) => {
  const end = Date.now() + ms;
  while (!(await test())) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 250));
  }
};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

await page.goto(`${base}?year=${yearArg}`);
await until("the globe", () =>
  page.evaluate(() => ((globalThis as { causalis?: Api }).causalis?.drawn?.() ?? 0) > 0),
);
await page.evaluate(() => (globalThis as { causalis?: Api }).causalis!.client!.setSpeed(0));
await wait(1500);
await page.screenshot({ path: join(out, "1-globe.png") });
await page.getByRole("button", { name: "People" }).click();
await wait(1500);
await page.screenshot({ path: join(out, "2-people.png") });
const home = await page.evaluate(async () => {
  const c = (globalThis as { causalis?: Api }).causalis!;
  const map = await c.client!.query<{ cell: number; people: number; farming: boolean }[]>({
    type: "people.map",
  });
  const farming = map.filter((e) => e.farming).sort((a, b) => b.people - a.people);
  return (farming[0] ?? map.sort((a, b) => b.people - a.people)[0])?.cell ?? -1;
});
console.log("most peopled province", home);
await page.evaluate((cell) => (globalThis as { causalis?: Api }).causalis!.descend!(cell), home);
await until("the region", () =>
  page.evaluate(() => (globalThis as { causalis?: Api }).causalis?.drawn?.() === 128 * 128),
);
await until(
  "its villages",
  () => page.evaluate(() => ((globalThis as { causalis?: Api }).causalis?.villages?.() ?? 0) > 0),
  15000,
).catch(() => console.log("no villages in this province"));
await wait(2000);
await page.screenshot({ path: join(out, "3-region.png") });
const first = await page.evaluate(async (cell) => {
  const c = (globalThis as { causalis?: Api }).causalis!;
  const list = await c.client!.query<{ tile: number; name: string }[]>({
    type: "settlements",
    args: { cell },
  });
  if (list[0]) c.select!(list[0].tile);
  return list[0]?.name ?? null;
}, home);
console.log("first village", first);
await wait(1500);
await page.screenshot({ path: join(out, "4-village.png") });
void api;
await browser.close();
await server.close();
