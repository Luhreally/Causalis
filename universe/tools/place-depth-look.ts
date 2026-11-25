// Town mode's depth, looked at (sixth slice): on a save given, at a phone's size and a desk's, a town entered, its Work
// sheet's priorities grid opened, scrolled both ways (its names and its kinds stay put), a key tapped (the order taken,
// the one moved to the grid's head), narrowed to a trade, one let be again; and the page of one of its people read for
// their skill and their priorities. The HUD is read for overlap in every state (tools/hud-read.ts). Stills into --shots.
// (npm run build first: it reads dist/.)
//   node tools/place-depth-look.ts --save file.save [--shots dir] [--people 400] [--browser webkit] [--only phone]
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { preview } from "vite";
import { chromium, webkit, type Page } from "playwright";
import { loadWorld, rulesetId, seedFromText } from "../src/kernel/index.ts";
import { EARTH } from "../src/host/planet.ts";
import { populationContext } from "../src/sim/index.ts";
import type { PlaceFrame, PlaceWorkSheet } from "../src/bridge/index.ts";
import { hudRead, type HudRead } from "./hud-read.ts";

const argv = process.argv.slice(2),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  shots = arg("--shots"),
  saveFile = arg("--save"),
  people = Number(arg("--people") ?? 400),
  engine = arg("--browser") ?? "chromium",
  only = arg("--only");
if (!saveFile) throw new Error("--save file.save");
if (shots) mkdirSync(shots, { recursive: true });
const problems: string[] = [],
  say = (s: string) => console.log(`  ${s}`),
  check = (ok: boolean, what: string) => {
    if (!ok) problems.push(what);
    say(`${ok ? "ok " : "NOT"} ${what}`);
  };

const bytes = readFileSync(saveFile),
  doc = JSON.parse(gunzipSync(bytes).toString("utf8")) as Parameters<typeof loadWorld>[0],
  world = loadWorld(
    doc,
    (s) => EARTH.build(s),
    rulesetId(EARTH.build(seedFromText(doc.seed)), EARTH.version),
    { allowRulesetChange: true },
  ).world,
  ctx = populationContext(world),
  town = ctx.settlements
    .all()
    .filter((s) => ctx.settlements.held(s.ref))
    .reduce((a, b) => (Math.abs(b.population - people) < Math.abs(a.population - people) ? b : a));
console.log(
  `a town entered: ${town.name} (${town.ref}), ${town.population} people, year ${Math.floor(world.now / 31_536_000)}`,
);

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4427, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!,
  browser =
    engine === "webkit"
      ? await webkit.launch()
      : await chromium.launch({
          args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"],
        });
console.log(`browser: ${engine} ${browser.version()}`);
const READ = hudRead([], 1);
type State = { on: boolean; town: string | null; told: PlaceFrame | null };

for (const view of [
  {
    name: "phone",
    options: {
      viewport: { width: 430, height: 932 },
      // (Playwright's WebKit on Windows presents no WebGL canvas at a device scale of 2: at 1 it does.)
      deviceScaleFactor: engine === "webkit" ? 1 : 2,
      hasTouch: true,
      isMobile: true,
    },
  },
  { name: "desk", options: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 } },
] as const) {
  if (only && only !== view.name) continue;
  console.log(`${view.name} (${view.options.viewport.width}x${view.options.viewport.height})`);
  const context = await browser.newContext(view.options),
    page: Page = await context.newPage(),
    errors: string[] = [];
  page.setDefaultTimeout(60000);
  page.on("pageerror", (e) => errors.push(`${e.message}\n${e.stack ?? ""}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>,
    until = async (what: string, ok: () => Promise<boolean>, ms = 30000) => {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        if (await ok().catch(() => false)) return true;
        await page.waitForTimeout(100);
      }
      problems.push(`${view.name}: ${what} did not come`);
      say(`NOT ${what}`);
      return false;
    },
    shot = async (name: string) => {
      if (shots) await page.screenshot({ path: join(shots, `${view.name}-${name}.png`) });
    },
    state = () => k<State>("globalThis.causalis.place.state()"),
    read = async (name: string) => {
      const r = await k<HudRead>(READ);
      check(
        r.overlaps.length === 0,
        `${name}: nothing of the HUD lies over anything (${r.overlaps.slice(0, 3).join("; ")})`,
      );
      check(
        r.covered.length === 0,
        `${name}: every control can be reached (${r.covered.slice(0, 3).join("; ")})`,
      );
      check(
        r.off.length === 0 && r.gone.length === 0,
        `${name}: nothing off the screen (${[...r.off, ...r.gone].slice(0, 3).join("; ")})`,
      );
      const small = r.small.filter((x) => /place-|town-place/.test(x));
      if (view.name === "phone")
        check(
          small.length === 0,
          `${name}: none of its own controls smaller than a fingertip (${small.slice(0, 4).join("; ")})`,
        );
    },
    tap = (x: number, y: number) =>
      view.name === "phone" ? page.touchscreen.tap(x, y) : page.mouse.click(x, y),
    box = (selector: string) =>
      k<{ x: number; y: number; w: number; h: number; l: number; t: number } | null>(
        `(() => { for (const e of document.querySelectorAll(${JSON.stringify(selector)})) { const r = e.getBoundingClientRect(); if (r.width > 0 && r.height > 0) return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height, l: r.x, t: r.y }; } return null; })()`,
      ),
    press = async (selector: string, what: string): Promise<boolean> => {
      const at = await box(selector);
      check(!!at, `${what} is there to press`);
      if (!at) return false;
      await tap(at.x, at.y);
      await page.waitForTimeout(350);
      return true;
    },
    sheetText = () => k<string>(`document.querySelector(".place-sheet-body")?.textContent ?? ""`),
    work = () =>
      k<PlaceWorkSheet | null>(
        `globalThis.causalis.client.query({ type: "place.work", args: { ref: ${JSON.stringify(town.ref)} } })`,
      );

  const name = "earth:place-depth-look",
    q = `universe=earth&seed=${encodeURIComponent(doc.seed)}`;
  await page.goto(`${base}?${q}&hold=1`);
  await page.waitForFunction(
    () => !!(globalThis as { causalis?: { client?: unknown } }).causalis?.client,
    undefined,
    { timeout: 120000 },
  );
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: 180000 },
  );
  await page.evaluate(
    async ([data, keep]) => {
      const b = Uint8Array.from(atob(data as string), (c) => c.charCodeAt(0));
      const c = (
        globalThis as unknown as {
          causalis: {
            client: {
              importSave(b: Uint8Array): Promise<unknown>;
              save(n: string): Promise<unknown>;
            };
          };
        }
      ).causalis.client;
      await c.importSave(b);
      await c.save(keep as string);
    },
    [bytes.toString("base64"), name],
  );
  await page.goto(`${base}?${q}&load=${encodeURIComponent(name)}&hold=1`);
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: 180000 },
  );
  await page.waitForTimeout(600);
  await k(`globalThis.causalis.goTo(${JSON.stringify(town.ref)})`);
  await until(
    "the town drawn",
    async () =>
      (await k<string>("globalThis.causalis.scale()")) === "village" &&
      (await k<string | undefined>("globalThis.causalis.planNow()?.ref")) === town.ref,
  );
  await page.waitForTimeout(2000);
  if (!(await press(".town-place", "🏘️ on the town's bar"))) continue;
  await until("the town entered", async () => {
    const s = await state();
    return s.on && !!s.told;
  });
  await page.waitForTimeout(1200);

  // The Work sheet, its priorities grid opened.
  await press('.place-tab[data-tab="work"]', "the Work tab");
  await until("the Work sheet", async () => /grown hands/.test(await sheetText()));
  check(/Priorities/.test(await sheetText()), "the Work sheet has its priorities");
  await k(`document.querySelector(".place-grid-open").scrollIntoView({ block: "center" })`);
  await page.waitForTimeout(300);
  await read("the Work sheet, its grid shut");
  await press(".place-grid-open", "Priorities by name");
  await until(
    "the grid",
    async () => (await k<number>(`document.querySelectorAll(".place-grid-key").length`)) > 10,
  );
  await k(
    `document.querySelector(".place-sub + .place-line .place-grid-open").scrollIntoView({ block: "start" })`,
  );
  await page.waitForTimeout(400);
  const grid0 = (await work())!.grid;
  say(`grid: ${grid0.rows.length} of ${grid0.all} rows; kinds ${grid0.kinds.join(", ")}`);
  check(grid0.rows.length > 3, "its grown at the trades an order can move are its rows");
  await shot("g1-grid-open");
  await read("the priorities grid open");
  // Every key a fingertip's size; the grid within the sheet; nothing of it under another row's key.
  const keys = await k<{ w: number; h: number }[]>(
    `[...document.querySelectorAll(".place-grid-key")].slice(0, 40).map((e) => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height }; })`,
  );
  check(
    keys.every((b) => b.w >= 40 && b.h >= 40),
    `each key is a fingertip's size (${Math.min(...keys.map((b) => b.w))} x ${Math.min(...keys.map((b) => b.h))} at the least)`,
  );
  const fits = await k<{
    grid: number;
    sheet: number;
    view: number;
    scrollW: number;
    clientW: number;
  }>(
    `(() => { const g = document.querySelector(".place-grid").getBoundingClientRect(), s = document.querySelector(".place-sheet-body").getBoundingClientRect(), e = document.querySelector(".place-grid"); return { grid: g.right, sheet: s.right, view: innerWidth, scrollW: e.scrollWidth, clientW: e.clientWidth }; })()`,
  );
  check(
    fits.grid <= fits.sheet + 0.5 && fits.grid <= fits.view,
    `the grid lies within its sheet (${fits.grid} of ${fits.sheet})`,
  );
  say(`the grid is ${fits.scrollW} wide in a window of ${fits.clientW}`);
  // Scrolled down and across: its kinds stay at the top, its names at the left.
  const headTop = (await box(".place-grid-head .place-grid-kind"))!.t,
    nameLeft = (await box(".place-grid-row:not(.place-grid-head) .place-grid-name"))!.l;
  await k(
    `(() => { const e = document.querySelector(".place-grid"); e.scrollTop = 400; e.scrollLeft = 200; })()`,
  );
  await page.waitForTimeout(400);
  const headTop2 = (await box(".place-grid-head .place-grid-kind"))!.t,
    nameLeft2 = (await box(".place-grid-row:not(.place-grid-head) .place-grid-name"))!.l,
    scrolled = await k<{ top: number; left: number }>(
      `(() => { const e = document.querySelector(".place-grid"); return { top: e.scrollTop, left: e.scrollLeft }; })()`,
    );
  check(scrolled.top > 0, `the grid scrolls down (${scrolled.top})`);
  check(
    Math.abs(headTop2 - headTop) < 1.5,
    `its kinds stay at the top (${headTop} then ${headTop2})`,
  );
  check(
    Math.abs(nameLeft2 - nameLeft) < 1.5,
    `its names stay at the left (${nameLeft} then ${nameLeft2}; scrolled across ${scrolled.left})`,
  );
  await shot("g2-grid-scrolled");
  await read("the grid scrolled");
  await k(
    `(() => { const e = document.querySelector(".place-grid"); e.scrollTop = 0; e.scrollLeft = 0; })()`,
  );
  await page.waitForTimeout(300);
  // A key tapped: the fourth row's Hauling, from never to first. The order is taken; they are the grid's first row now.
  const who = grid0.rows[3]!,
    haul = 3,
    was = who.kinds[haul]!;
  say(`${who.name}: ${who.kinds.join(",")} (${who.set ? "set" : "of themselves"}), ${who.skill}`);
  const cell = await k<{ x: number; y: number } | null>(
    `(() => { const rows = [...document.querySelectorAll(".place-grid-row:not(.place-grid-head)")]; const keys = [...document.querySelectorAll(".place-grid-key:not(.place-grid-free)")]; const e = keys[3 * 5 + ${haul}]; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`,
  );
  check(!!cell, "the key is there to tap");
  if (cell) {
    await tap(cell.x, cell.y);
    await until("the order taken", async () => {
      const row = (await work())?.grid.rows.find((r) => r.id === who.id);
      return !!row && row.set && row.kinds[haul] !== was;
    });
    await page.waitForTimeout(1500);
    const now = (await work())!.grid,
      row = now.rows.find((r) => r.id === who.id)!;
    say(`after the tap: ${row.kinds.join(",")}; first row ${now.rows[0]!.name}`);
    check(now.rows[0]!.id === who.id, "one with priorities set leads the grid");
    await until(
      "the grid drawn anew",
      async () =>
        (await k<string>(
          `document.querySelector(".place-grid-row:not(.place-grid-head) .place-grid-who")?.textContent ?? ""`,
        )) === who.name,
    );
    check(
      (await k<number>(`document.querySelectorAll(".place-grid-free.place-grid-key").length`)) ===
        1,
      "they have a key to be let be",
    );
    await shot("g3-grid-set");
    await read("the grid, an order given");
    // A second tap on the same kind: from first to second.
    const cell2 = await box(".place-grid-row:not(.place-grid-head) .place-grid-key.first");
    if (cell2) await tap(cell2.x, cell2.y);
    await page.waitForTimeout(1500);
    say(
      `after a second tap: ${(await work())!.grid.rows.find((r) => r.id === who.id)!.kinds.join(",")}`,
    );
    // Their page: their skill, their priorities.
    await k(`globalThis.causalis.open(${JSON.stringify(who.ref)})`);
    await until(
      "their page",
      async () => !!(await k<string | null>("globalThis.causalis.pageOpen()")),
    );
    await page.waitForTimeout(800);
    const text = await k<string>(`document.querySelector(".page-window")?.textContent ?? ""`);
    for (const word of ["Skill", "hours given to it", "Priorities", "By your order"])
      check(text.includes(word), `their page says "${word}"`);
    say(`page: ${(text.match(/Skill.{0,330}/) ?? [""])[0]}`);
    say(`page: ${(text.match(/Priorities.{0,260}/) ?? [""])[0]}`);
    await k(
      `(() => { const e = [...document.querySelectorAll(".page-window *")].find((x) => x.children.length === 0 && /^Skill$/.test(x.textContent ?? "")); e?.scrollIntoView({ block: "center" }); })()`,
    );
    await page.waitForTimeout(400);
    await shot("g4-person-skill");
    await read("a person's page, their skill and priorities");
    await k("globalThis.causalis.closePage()");
    await page.waitForTimeout(400);
    // Narrowed to a trade; then let be.
    await press(
      ".place-sheet-body .place-chips .place-chip:nth-child(2)",
      "the grid's Farmers chip",
    );
    await until(
      "the grid narrowed",
      async () =>
        ((await k<number>(
          `document.querySelectorAll(".place-grid-row:not(.place-grid-head)").length`,
        )) ?? 0) > 0 &&
        /place-chip on/.test(
          await k<string>(
            `document.querySelector(".place-sheet-body .place-chips .place-chip:nth-child(2)").className`,
          ),
        ),
    );
    await page.waitForTimeout(1200);
    await shot("g5-grid-narrowed");
    await read("the grid narrowed to a trade");
    await press(".place-sheet-body .place-chips .place-chip:nth-child(1)", "the grid's All chip");
    await page.waitForTimeout(1200);
    await press(".place-grid-free.place-grid-key", "↺, let be");
    await until(
      "them let be",
      async () => !(await work())!.grid.rows.find((r) => r.id === who.id)?.set,
    );
    await page.waitForTimeout(800);
    await read("the grid, one let be again");
  }
  await press(".place-grid-open", "Hide priorities");
  await page.waitForTimeout(400);
  check(
    (await k<number>(`document.querySelectorAll(".place-grid").length`)) === 0,
    "the grid shuts",
  );
  check(
    errors.length === 0,
    `no errors on the page (${errors.slice(0, 2).join(" | ").slice(0, 300)})`,
  );
  await context.close();
}
await browser.close();
await server.close();
console.log(
  problems.length
    ? `PROBLEMS (${problems.length}):\n  ${problems.join("\n  ")}`
    : "all as it should be",
);
process.exit(problems.length ? 1 : 0);
