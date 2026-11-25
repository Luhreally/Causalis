// A town entered, looked at (town mode, first slice): on a save given, at a phone's size and a desk's, the town gone to,
// 🏘️ pressed, its line told, its people drawn where the place has them, one of them and a building tapped for their pages,
// the town left and come back to (the same people, gone on); the HUD read for overlap in each state by the overlap
// gate's own reading (tools/hud-read.ts). Stills into --shots. (npm run build first: it reads dist/.)
//   node tools/place-look.ts --save file.save [--shots dir] [--people 400] [--soft]
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { preview } from "vite";
import { chromium, type Page } from "playwright";
import { loadWorld, rulesetId, seedFromText } from "../src/kernel/index.ts";
import { EARTH } from "../src/host/planet.ts";
import { populationContext } from "../src/sim/index.ts";
import type { PlaceFrame } from "../src/bridge/index.ts";
import { hudRead, type HudRead } from "./hud-read.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  shots = arg("--shots"),
  saveFile = arg("--save"),
  people = Number(arg("--people") ?? 400);
if (!saveFile) throw new Error("--save file.save");
if (shots) mkdirSync(shots, { recursive: true });
const slow = (ms: number) => (soft ? ms * 4 : ms);
const GPU = [
  "--enable-gpu",
  "--ignore-gpu-blocklist",
  "--use-angle=d3d11",
  "--force_high_performance_gpu",
];
const problems: string[] = [],
  say = (s: string) => console.log(`  ${s}`),
  check = (ok: boolean, what: string) => {
    if (!ok) problems.push(what);
    say(`${ok ? "ok " : "NOT"} ${what}`);
  };

// The town: the one nearest so many people, read off the save here.
const bytes = readFileSync(saveFile),
  doc = JSON.parse(gunzipSync(bytes).toString("utf8")) as Parameters<typeof loadWorld>[0],
  world = loadWorld(
    doc,
    (s) => EARTH.build(s),
    rulesetId(EARTH.build(seedFromText(doc.seed)), EARTH.version),
    {
      allowRulesetChange: true,
    },
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
  server = await preview({ root, logLevel: "silent", preview: { port: 4417, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : GPU,
  });
const READ = hudRead([], 1);

type State = { on: boolean; town: string | null; tells: string | null; told: PlaceFrame | null };

for (const view of [
  {
    name: "phone",
    options: {
      viewport: { width: 430, height: 932 },
      deviceScaleFactor: soft ? 1 : 2,
      hasTouch: true,
      isMobile: true,
    },
  },
  { name: "desk", options: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 } },
] as const) {
  console.log(`${view.name} (${view.options.viewport.width}x${view.options.viewport.height})`);
  const context = await browser.newContext(view.options),
    page: Page = await context.newPage(),
    errors: string[] = [];
  page.setDefaultTimeout(slow(60000));
  page.on("pageerror", (e) => errors.push(`${e.message}\n${e.stack ?? ""}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>,
    until = async (what: string, ok: () => Promise<boolean>, ms = slow(30000)) => {
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
    // (Which two windows lie over one another, without their words.)
    pair = (x: string) =>
      x
        .split(" / ")
        .map((part) => part.split(" “")[0])
        .join(" / "),
    usualOver = new Set<string>(),
    read = async (name: string) => {
      const r = await k<HudRead>(READ),
        // (What lies over what with any page open in the town as it is without the mode is not the mode's.)
        over = r.overlaps.filter((x) => !usualOver.has(pair(x)));
      check(
        over.length === 0,
        `${name}: nothing of the HUD lies over anything (${over.slice(0, 3).join("; ")})`,
      );
      check(
        r.covered.length === 0,
        `${name}: every control can be reached (${r.covered.slice(0, 3).join("; ")})`,
      );
      check(
        r.off.length === 0 && r.gone.length === 0,
        `${name}: nothing off the screen (${[...r.off, ...r.gone].slice(0, 3).join("; ")})`,
      );
      // (Of the town mode's own controls: a page's links and the stores' line are as they are everywhere.)
      const small = r.small.filter((x) => /town-place|placed-/.test(x));
      if (view.name === "phone")
        check(
          small.length === 0,
          `${name}: none of its own controls smaller than a fingertip (${small.join("; ")})`,
        );
      return r;
    },
    tap = (x: number, y: number) =>
      view.name === "phone" ? page.touchscreen.tap(x, y) : page.mouse.click(x, y);

  // The save loaded, held.
  const name = "earth:place-look",
    q = `universe=earth&seed=${encodeURIComponent(doc.seed)}`;
  await page.goto(`${base}?${q}&hold=1`);
  await page.waitForFunction(
    () => !!(globalThis as { causalis?: { client?: unknown } }).causalis?.client,
    undefined,
    { timeout: slow(120000) },
  );
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: slow(180000) },
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
    { timeout: slow(180000) },
  );
  await page.waitForTimeout(slow(600));

  // The town gone to.
  await k(`globalThis.causalis.goTo(${JSON.stringify(town.ref)})`);
  await until(
    "the town drawn",
    async () =>
      (await k<string>("globalThis.causalis.scale()")) === "village" &&
      (await k<string | undefined>("globalThis.causalis.planNow()?.ref")) === town.ref,
  );
  await page.waitForTimeout(slow(2500));
  const usual = await k<number>("globalThis.causalis.planNow().people.length");
  await shot("1-town-before");
  await read("the town before it is entered");
  // (A page open in the town as it is without the mode: what lies over what then is the town view's own, told and set aside.)
  await k(`globalThis.causalis.open(${JSON.stringify(town.ref)})`);
  await until(
    "the town's own page",
    async () => (await k<string | null>("globalThis.causalis.pageOpen()")) === town.ref,
  );
  await page.waitForTimeout(slow(700));
  for (const x of (await k<HudRead>(READ)).overlaps) usualOver.add(pair(x));
  say(
    `with any page open before the mode, lying over one another: ${[...usualOver].join("; ") || "nothing"}`,
  );
  await k("globalThis.causalis.closePage()");
  await page.waitForTimeout(slow(400));

  // Entered: 🏘️ on its bar.
  const key = await k<{ x: number; y: number; w: number; h: number } | null>(
    `(() => { const e = document.querySelector(".town-place"); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height } : null; })()`,
  );
  check(!!key, "🏘️ stands on the town's bar");
  if (!key) continue;
  if (view.name === "phone")
    check(
      key.h >= 44 && key.w >= 44,
      `🏘️ is a finger's size (${Math.round(key.w)}x${Math.round(key.h)})`,
    );
  await tap(key.x, key.y);
  await until("the town entered and its people told", async () => {
    const s = await state();
    return (
      s.on &&
      !!s.told &&
      (await k<string>("globalThis.causalis.planNow().people[0]?.ref ?? ''")).startsWith("plc:")
    );
  });
  const first = await state(),
    placed = await k<number>("globalThis.causalis.planNow().people.length");
  say(`its line: ${first.tells}`);
  check(
    placed > 0,
    `the plan's people are the place's (${placed}; the town's usual were ${usual})`,
  );
  check(
    (first.told?.kept ?? 0) === Math.min(6000, town.population),
    `it keeps ${first.told?.kept} of the town's ${town.population}`,
  );
  // Its clock runs: an hour a second for a while, then ten minutes a second.
  await k("globalThis.causalis.place.pace(3600)");
  await page.waitForTimeout(slow(9000));
  await k("globalThis.causalis.place.pace(600)");
  await page.waitForTimeout(slow(3000));
  const later = await state();
  check(
    (later.told?.t ?? 0) > (first.told?.t ?? 0) + 3600,
    `its clock went on (${(((later.told?.t ?? 0) - (first.told?.t ?? 0)) / 3600).toFixed(1)} h)`,
  );
  say(`its line: ${later.tells}`);
  await shot("2-entered");
  await read("the town entered");
  // (And from near, where its people can be told apart.)
  await k("globalThis.causalis.rig.flyTo({ distance: 9, pitch: -42 }, 0.4)");
  await page.waitForTimeout(slow(2500));
  await shot("2b-entered-near");

  // One of its people seen and tapped: their page.
  const seen = await k<{ i: number; x: number; y: number } | null>(
    `(() => { const c = globalThis.causalis, n = c.planNow().people.length, W = innerWidth, H = innerHeight; for (let i = 0; i < n; i++) { const p = c.personOnScreen(i); if (p && p.x > 40 && p.x < W - 40 && p.y > H * 0.35 && p.y < H * 0.8) return { i, x: p.x, y: p.y }; } return null; })()`,
  );
  check(!!seen, "one of its people stands on the screen");
  if (seen) {
    await tap(seen.x, seen.y);
    await until("a person's page", async () =>
      ((await k<string | null>("globalThis.causalis.pageOpen()")) ?? "").startsWith("plc:"),
    );
    await page.waitForTimeout(slow(700));
    const text = await k<string>(`document.querySelector(".page-window")?.textContent ?? ""`);
    for (const word of ["Hunger", "Tiredness", "Home", "Why", "In hand"])
      check(text.includes(word), `their page says "${word}"`);
    await shot("3-person-page");
    await read("a person's page open");
    await k("globalThis.causalis.closePage()");
    await page.waitForTimeout(slow(400));
  }
  // A building's page, by the place: the square's, opened as a tap on it would.
  await k(`globalThis.causalis.open(${JSON.stringify(`plcl:${town.ref}:0`)})`);
  await until("the square's page", async () =>
    ((await k<string | null>("globalThis.causalis.pageOpen()")) ?? "").startsWith("plcl:"),
  );
  await page.waitForTimeout(slow(700));
  await shot("4-lot-page");
  await read("a building's page open");
  await k("globalThis.causalis.closePage()");
  await page.waitForTimeout(slow(300));

  // Left, and come back to: kept, and gone on from where it was.
  const before = await state();
  await k("globalThis.causalis.place.toggle()");
  await until(
    "the town left",
    async () =>
      !(await state()).on &&
      !(await k<string>("globalThis.causalis.planNow().people[0]?.ref ?? ''")).startsWith("plc:"),
  );
  await shot("5-left");
  await read("the town left");
  const kept = await k<{ places: { town: string; people: number; t: number }[]; bytes: number }>(
    `globalThis.causalis.client.query({ type: "place.kept" })`,
  );
  check(
    kept.places.some((p) => p.town === town.ref),
    `the place is kept after leaving (${kept.places.length} kept, ${kept.bytes} bytes)`,
  );
  await k("globalThis.causalis.place.toggle()");
  await until("the town entered again", async () => (await state()).on && !!(await state()).told);
  const again = await state();
  check(
    (again.told?.t ?? 0) >= (before.told?.t ?? 0),
    "it goes on from where it was left, not from the start",
  );
  check(again.told?.kept === before.told?.kept, `the same people are there (${again.told?.kept})`);
  await shot("6-entered-again");
  await k("globalThis.causalis.place.toggle()");
  await page.waitForTimeout(slow(500));
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
    ? `FAILED: ${problems.length}\n${problems.map((p) => `  - ${p}`).join("\n")}`
    : "all as it should be",
);
process.exit(problems.length ? 1 : 0);
