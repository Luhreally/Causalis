// node tools/brush-walk.ts [--shots dir] [--desk] [--soft]: the god's brushes used as a player would, on the built app: at a
// phone's size by touch (or, with --desk, at 1366 by 800 with a mouse). Opened from the corner; each brush picked
// in turn and a stroke drawn across the ground on the world, on a land and in a town; size and strength changed;
// Undo; Apply where a stroke can kill; put away. A picture of each step, and in words: where the stroke fell
// against where the finger went, whether the camera moved under the finger, and what the panel said.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { gzipSync } from "node:zlib";
import { chromium, type CDPSession, type Page } from "playwright";
import { YEAR, rulesetId, saveWorld, seedFromText } from "../src/kernel/index.ts";
import { EARTH } from "../src/host/planet.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  desk = argv.includes("--desk"),
  at = argv.indexOf("--shots"),
  shots = at >= 0 ? argv[at + 1] : undefined;
if (shots) mkdirSync(shots, { recursive: true });
const slow = (ms: number) => (soft ? ms * 4 : ms);
const GPU = [
  "--enable-gpu",
  "--ignore-gpu-blocklist",
  "--use-angle=d3d11",
  "--force_high_performance_gpu",
];
const W = desk ? 1366 : 430,
  H = desk ? 800 : 932;
const say = (s: string) => console.log(`  ${s}`);
const problems: string[] = [];

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4393, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : GPU,
  });
const context = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: desk ? 1 : 2,
    hasTouch: !desk,
    isMobile: !desk,
  }),
  page: Page = await context.newPage(),
  errors: string[] = [];
await context.addInitScript(() => localStorage.setItem("causalis.quality", "balanced"));
page.setDefaultTimeout(slow(60000));
page.on("pageerror", (e) => errors.push(e.message));
const cdp: CDPSession | null = desk ? null : await context.newCDPSession(page);
const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;
const settle = (ms: number) => page.waitForTimeout(slow(ms));
const until = async (what: string, ok: () => Promise<boolean>, ms = slow(20000)) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await page.waitForTimeout(80);
  }
  say(`(${what} did not come)`);
  return false;
};
let n = 0;
const shot = async (name: string) => {
  if (shots)
    await page.screenshot({ path: join(shots, `${String(++n).padStart(2, "0")}-${name}.png`) });
};
const status = () => k<string>(`document.querySelector(".brush-status")?.textContent ?? ""`);
const count = () =>
  k<number>(`globalThis.causalis.client.query({ type: "brush.state" }).then((s) => s.count)`);
const camera = () =>
  k<string>(
    `(() => { const r = globalThis.causalis.rig; return [r.distance, r.yaw ?? 0, r.pitch ?? 0, r.target?.x ?? 0, r.target?.z ?? 0].map((v) => Number(v).toFixed(3)).join(","); })()`,
  );

/** A finger (or the mouse's button) drawn from one point to another in steps. */
async function stroke(x0: number, y0: number, x1: number, y1: number, steps = 12): Promise<void> {
  if (cdp) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: x0, y: y0 }],
    });
    for (let i = 1; i <= steps; i++) {
      const x = x0 + ((x1 - x0) * i) / steps,
        y = y0 + ((y1 - y0) * i) / steps;
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
      await page.waitForTimeout(30);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } else {
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++)
      await page.mouse.move(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
    await page.mouse.up();
  }
}
async function tap(sel: string): Promise<boolean> {
  const loc = page.locator(sel).first();
  if (!(await loc.isVisible().catch(() => false))) {
    say(`(nothing to press at ${sel})`);
    return false;
  }
  if (desk) await loc.click();
  else await loc.tap();
  await settle(300);
  return true;
}
/** What is in the way of a point the finger would paint at. */
const under = (x: number, y: number) =>
  k<string>(
    `(() => { const e = document.elementFromPoint(${x}, ${y}); return e ? e.tagName.toLowerCase() + "." + (e.className || "") : "nothing"; })()`,
  );

// A world thirty years on from its seed (towns and realms in it), as phone-audit forges one.
{
  const world = EARTH.build(seedFromText("first light"));
  world.runTo(30 * YEAR);
  const bytes = gzipSync(
      JSON.stringify(saveWorld(world, rulesetId(world, EARTH.version), { universe: EARTH.name })),
    ),
    q = `universe=earth&seed=${encodeURIComponent(world.seed.text)}`;
  await page.goto(`${base}?${q}&hold=1`);
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: slow(120000) },
  );
  await page.evaluate(async (data) => {
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
    await c.importSave(Uint8Array.from(atob(data), (ch) => ch.charCodeAt(0)));
    await c.save("earth:brushes");
  }, bytes.toString("base64"));
  await page.goto(`${base}?${q}&load=earth%3Abrushes&hold=1`);
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: slow(120000) },
  );
}
await settle(1500);
const most = await k<{ cell: number; centre: number }>(
  `globalThis.causalis.client.query({ type: "people.map" }).then((p) => [...p].sort((a, b) => b.people - a.people)[0])`,
);
await k(`globalThis.causalis.faceSpot(${most.centre}, 2)`);
await settle(1500);
await shot("world");

// Where a stroke is drawn: across the ground left of the middle, clear of the panel, the bar and the column.
const mid = desk ? { x0: 520, y0: 380, x1: 700, y1: 420 } : { x0: 120, y0: 420, x1: 300, y1: 460 };

async function brushes(scale: string): Promise<void> {
  say(`— on the ${scale} —`);
  if (!(await tap(".brush-toggle"))) {
    problems.push(`${scale}: no 🖌 to open the brushes`);
    return;
  }
  await until("the brushes' panel", () =>
    k<boolean>(`!document.querySelector(".brush-panel").hidden`),
  );
  await settle(600);
  await shot(`${scale}-open`);
  const box = await k<{ top: number; bottom: number; left: number; right: number }>(
    `(() => { const r = document.querySelector(".brush-panel").getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; })()`,
  );
  say(
    `the panel: ${box.left.toFixed(0)},${box.top.toFixed(0)} to ${box.right.toFixed(0)},${box.bottom.toFixed(0)} — it covers ${((((box.bottom - box.top) * (box.right - box.left)) / (W * H)) * 100).toFixed(0)}% of the screen`,
  );
  say(
    `under the stroke's start: ${await under(mid.x0, mid.y0)}; its end: ${await under(mid.x1, mid.y1)}`,
  );
  // (Each scale begins at the smallest and gentlest, as a first try would.)
  await page.locator(".brush-controls select").nth(1).selectOption({ index: 0 });
  await page.locator(".brush-controls select").nth(2).selectOption({ index: 0 });
  const kinds = await k<string[]>(
    `[...document.querySelector(".brush-controls select").options].map((o) => o.value)`,
  );
  for (const kind of kinds) {
    await page.locator(".brush-controls select").first().selectOption(kind);
    await settle(300);
    const before = await count(),
      cam = await camera();
    await stroke(mid.x0, mid.y0, mid.x1, mid.y1);
    await settle(400);
    const said = await status(),
      moved = (await camera()) !== cam;
    await shot(`${scale}-${kind}-drawn`);
    if (await page.locator(".brush-apply").isVisible()) {
      say(`${kind}: asks to Apply: ${said}`);
      await tap(".brush-apply");
    }
    await until(
      `${kind} kept`,
      async () =>
        (await count()) > before || /saved|cannot|Choose|No living|too large/i.test(await status()),
      slow(12000),
    );
    await settle(800);
    const after = await count(),
      last = await k<{ cells: number[]; provinces: number[]; dead: number } | null>(
        `globalThis.causalis.client.query({ type: "brush.state" }).then((s) => s.strokes.at(-1) ?? null)`,
      );
    say(
      `${kind}: ${after > before ? `kept, ${last?.cells.length} cells in ${last?.provinces.length} lands${last?.dead ? `, ${last.dead} dead` : ""}` : "not kept"}; said “${said}” then “${await status()}”${moved ? "; the camera moved under the stroke" : ""}`,
    );
    if (moved) problems.push(`${scale} ${kind}: the camera moved while painting`);
    await shot(`${scale}-${kind}-after`);
  }
  // Size and strength: the largest and strongest raise, then Undo before it lands.
  const selects = page.locator(".brush-controls select");
  await selects.nth(0).selectOption("raise");
  await selects.nth(1).selectOption({ index: 3 });
  await selects.nth(2).selectOption({ index: 3 });
  const before = await count();
  await stroke(mid.x0, mid.y0 + 30, mid.x1, mid.y1 + 30);
  await settle(300);
  await shot(`${scale}-big-drawn`);
  const undid = await tap(".brush-undo");
  await settle(2600);
  say(
    `Undo ${undid ? "pressed" : "not to be found"}: ${(await count()) === before ? "nothing kept" : "it was kept anyway"}; “${await status()}”`,
  );
  if ((await count()) !== before) problems.push(`${scale}: Undo did not stop a stroke`);
  await shot(`${scale}-undone`);
  if (!(await tap(".brush-close"))) problems.push(`${scale}: no way to put the brushes away`);
  await settle(400);
  say(`put away: ${await k<boolean>(`document.querySelector(".brush-panel").hidden`)}`);
}

await brushes("world");
// A land.
const first = await k<{ cell: number }>(
  `globalThis.causalis.client.query({ type: "towns.map", args: {} }).then((t) => [...t].sort((a, b) => b.people - a.people)[0])`,
);
await k(`globalThis.causalis.descend(${first.cell})`);
await until("the land", () => k<boolean>(`globalThis.causalis.scale() === "region"`), slow(60000));
await settle(3000);
await shot("land");
await brushes("land");
// A town: the land's greatest.
const great = await k<{ ref: string; cell: number; people: number }>(
  `globalThis.causalis.client.query({ type: "towns.map", args: {} }).then((t) => [...t].sort((a, b) => b.people - a.people)[0])`,
);
await k(`globalThis.causalis.goTo(${JSON.stringify(great.ref)})`);
await until("the town", () => k<boolean>(`globalThis.causalis.scale() === "village"`), slow(60000));
await settle(3000);
await shot("town");
await brushes("town");

if (errors.length) problems.push(`errors on the page: ${errors.slice(0, 3).join(" | ")}`);
console.log(
  problems.length
    ? `brush walk: ${problems.length} problem(s)\n  ${problems.join("\n  ")}`
    : "brush walk: no problem found",
);
await browser.close();
await server.close();
