// node tools/phase15-gate.ts [--ci] [--soft] — the Phase 15 gate (docs/architecture §I.15), at
// the user's asking for Classic's detail — "it breaks down inventory and chemistry and the
// inspectability is very good" — done in a real browser on the built app:
//   1. matter: a substance found by its name, its elements drawn as a make-up; a reaction it
//      goes into; a principle and the lands that know it; a good made of something each way;
//   2. stores: a land's broken down, every good's year balancing; a good's year as a flow that
//      balances; the world's goods;
//   3. the Goods lens: one good at a time, chosen under its legend, a land's tooltip its year.
// (npm run build first; --soft draws in software, as CI's browser does.)
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium, type Page } from "playwright";

const ci = process.argv.includes("--ci"),
  soft = process.argv.includes("--soft");
const GPU = [
  "--use-angle=d3d11",
  "--ignore-gpu-blocklist",
  "--enable-gpu",
  "--force_high_performance_gpu",
];
const problems: string[] = [];
const say = (line: string) => console.log(`  ${line}`);
const check = (ok: boolean, problem: string) => {
  if (!ok) problems.push(problem);
};
/** How long to wait on what the frames bring: longer where they come slowly. */
const slow = (ms: number) => (ci || soft ? ms * 4 : ms);
console.log("the Phase 15 gate");

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4267, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  }),
  page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const k = <T>(code: string, on: Page = page): Promise<T> => on.evaluate(code) as Promise<T>;
const q = <T>(type: string, args: unknown = {}): Promise<T> =>
  k<T>(
    `globalThis.causalis.client.query({ type: ${JSON.stringify(type)}, args: ${JSON.stringify(args)} })`,
  );
const until = async (what: string, ok: () => Promise<boolean>, ms = 60000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok()) return true;
    await page.waitForTimeout(250);
  }
  problems.push(`${what} did not come`);
  return false;
};
const text = (sel: string) => page.$eval(sel, (e) => e.textContent ?? "").catch(() => "");
const window_ = () => text(".page-window");
const open = async (ref: string, what: string, has: string) => {
  await k(`globalThis.causalis.open(${JSON.stringify(ref)})`);
  return until(what, async () => (await window_()).includes(has), slow(15000));
};
const tip = () =>
  page
    .$eval(".tooltip", (e) => ((e as HTMLElement).hidden ? "" : (e.textContent ?? "")))
    .catch(() => "");
/** The middle of what a selector names on the screen, or null if it is not shown. */
const centre = (sel: string) =>
  k<{ x: number; y: number } | null>(
    `(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; })()`,
  );
const press = async (sel: string) => {
  const at = await centre(sel);
  if (!at) {
    problems.push(`${sel} was not there to press`);
    return false;
  }
  await page.mouse.click(at.x, at.y);
  return true;
};
/** Turn the world to a spot and rest the pointer on it, once the turn has come to rest. */
const point = async (spot: number) => {
  await k(`globalThis.causalis.faceSpot(${spot}, 2.2)`);
  let at: { x: number; y: number } | null = null;
  for (const end = Date.now() + slow(8000); Date.now() < end;) {
    await k("globalThis.causalis.rig.idle = 0");
    await page.waitForTimeout(400);
    const now = await k<{ x: number; y: number } | null>(
      `globalThis.causalis.spotOnScreen(${spot})`,
    );
    const still = !!now && !!at && Math.hypot(now.x - at.x, now.y - at.y) < 1.5;
    at = now;
    if (still) break;
  }
  if (!at) return false;
  await page.mouse.move(at.x - 8, at.y - 5);
  await page.mouse.move(at.x, at.y, { steps: 3 });
  await page.waitForTimeout(slow(800));
  return true;
};

await page.goto(`${base}?universe=earth&year=300`);
await page.waitForFunction(
  () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
  undefined,
  { timeout: 900000 },
);
await k("globalThis.causalis.client.setSpeed(0)");
await page.waitForTimeout(1500);
const people = await q<{ cell: number; centre: number; people: number }[]>("people.map"),
  land = [...people].sort((a, b) => b.people - a.people)[0]!;

// 1. Matter: a substance found by name, a reaction, a principle, a good.
{
  await page.mouse.move(30, 400);
  await page.keyboard.press("/");
  await page.waitForTimeout(300);
  await page.keyboard.type("malachite");
  const found = await until(
    "malachite, found by its name",
    async () => (await text(".search-results")).includes("Malachite"),
    slow(10000),
  );
  if (found) await page.click(".search-result:has-text('Malachite')");
  const elements = await until(
    "malachite's page, its elements",
    async () => (await window_()).includes("Its elements"),
    slow(15000),
  );
  const bars = await page.$$eval(".page-window .makeup-bar", (x) => x.length);
  const smelting = await open("rxn:smelt-malachite", "the smelting of malachite", "What goes in");
  const reaction = await window_();
  const metal = await open("prin:metalworking", "a principle's page", "Lands that know it");
  const good = await open("good:tools", "a good the world over", "A unit, as copper tools");
  const ways = await page.$$eval(".page-window .makeup-bar", (x) => x.length);
  say(
    `matter: malachite found and opened (${bars} make-up drawn); its smelting (${reaction.includes("charcoal") ? "with charcoal" : "no charcoal"}); a principle's knowers; tools ${ways} ways`,
  );
  check(found && elements && bars >= 1, "a substance is not found by its name and drawn");
  check(smelting && reaction.includes("charcoal"), "a reaction does not say what goes into it");
  check(metal && good && ways === 5, "a principle or a good's ways are not read");
}

// 2. Stores: a land's, a good's year, the world's.
{
  const stores = await open(`cell:0:${land.cell}#stores`, "a land's stores", "Its books"),
    books = await window_();
  const flow = await open(`mkt:${land.cell}:0#year`, "a good's year", "Began with");
  const balanced = await page.$$eval(".page-window .flow-check.ok", (x) => x.length);
  const worldGoods = await open("world:stats#goods", "the world's goods", "The world's stores");
  const held = await page.$$eval(
    ".page-window table tbody tr, .page-window .table-row",
    (x) => x.length,
  );
  say(
    `stores: a land's (${books.includes("every good's year balances") ? "its books balance" : "its books do not balance"}); grain's year (${balanced} balanced flows); the world's goods`,
  );
  check(
    stores && books.includes("every good's year balances"),
    "a land's stores are not broken down, balanced",
  );
  check(flow && balanced >= 1, "a good's year does not balance as a flow");
  check(worldGoods && held >= 0, "the world's goods are not read");
  await k(`document.querySelector(".page-window .close")?.click()`);
}

// 3. The Goods lens: a good chosen under its legend, a land's tooltip its year.
{
  await press(".mapmodes .mode[aria-label='Goods']");
  await page.waitForTimeout(slow(800));
  const legend = await text(".mapmodes .legend-title"),
    picks = await page.$$eval(".legend-picks button", (x) => x.length);
  await press(".legend-picks button[data-choice='tools']");
  await page.waitForTimeout(slow(800));
  await point(land.centre);
  const tipped = await until(
    "a land's tooltip under the goods lens",
    async () => /Goods: tools [\d.]+ a head/.test(await tip()),
    slow(15000),
  );
  const words = await tip();
  say(`the goods lens: ${legend}, ${picks} goods to choose; “${words.slice(0, 90)}”`);
  check(
    legend === "Goods" && picks === 12,
    "the goods lens has not its twelve goods to choose from",
  );
  check(
    tipped && words.includes("In store"),
    "a land's tooltip under the goods lens does not tell its year",
  );
  await press(".mapmodes .mode[aria-label='Land']");
}

await browser.close();
await server.close();
const real = errors.filter((e) => !/favicon|ERR_ABORTED/i.test(e));
if (real.length) problems.push(...real.slice(0, 5).map((e) => `the page logged: ${e}`));
console.log();
if (problems.length) {
  for (const p of problems) console.log(`  ✗ ${p}`);
  console.log("the Phase 15 gate fails");
  process.exit(1);
}
console.log("the Phase 15 gate passes");
