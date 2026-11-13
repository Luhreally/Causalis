// node tools/alliance-pages-gate.ts [--ci] [--soft] [--shots dir] [--seed text] [--year n]: gate 114, an alliance read whole (asked 2026-11-12: "alliances should
// have more details and stats tbh like the leauges"):
//   1. pure, on the world the app runs (first light, year 450, made here alike): every alliance's members add up to its totals, its tabs each read with numbers, the
//      ranking holds every alliance, two set side by side, and no word a raw id;
//   2. by real touch at 430 by 932: the Alliances lens chosen, the camera left where it was; every alliance ranked; the greatest pressed, each of its six tabs
//      opened with its numbers, its Members table adding up to its totals on the screen; set beside another; its "On the map" pressed from another lens, the
//      Alliances lens chosen and the camera unmoved; nothing off the screen, no page errors.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium } from "playwright";
import { hudRead, type HudRead } from "./hud-read.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  shots = arg("--shots"),
  seed = arg("--seed") ?? "first light",
  year = Number(arg("--year") ?? 450);
if (shots) mkdirSync(shots, { recursive: true });
const slow = (ms: number) => (ci || soft ? ms * 4 : ms);
const GPU = [
  "--enable-gpu",
  "--ignore-gpu-blocklist",
  "--use-angle=d3d11",
  "--force_high_performance_gpu",
];
const problems: string[] = [],
  check = (ok: boolean, what: string) => {
    if (!ok) problems.push(what);
  },
  say = (s: string) => console.log(`  ${s}`);
console.log("gate 114, an alliance read whole");

const BAD = /undefined|NaN|\[object|\bnull\b|Infinity|\b(ev|pol|war|cell|town|bloc|allyvs):\d/;
const TABS: readonly (readonly [string, RegExp])[] = [
  ["Overview", /Its weight in the world/i],
  ["Members", /Their weight, the greatest first/i],
  ["Strength", /By the years|History holds no years/i],
  ["Wars", /since its realms were bound|fought no war since/i],
  ["History", /Bound since year|No one wrote down/i],
  ["Within", /What holds it together/i],
];

type Span = string | { text: string; ref: string };
type Model = {
  ref: string;
  title: string;
  stats: { label: string; value: Span[] }[];
  tabs: { id: string; name: string; blocks: Record<string, unknown>[] }[];
};
const plain = (x: unknown): string =>
  typeof x === "string"
    ? x
    : Array.isArray(x)
      ? x.map(plain).join("")
      : x && typeof x === "object" && "text" in x
        ? String((x as { text: unknown }).text)
        : "";
/** Every word a page model would put on the screen. */
const wordsOf = (m: unknown): string => {
  const out: string[] = [];
  const walk = (x: unknown, key = "") => {
    if (key === "ref" || key === "why" || key === "keys" || key === "color" || key === "swatch")
      return;
    if (typeof x === "string") out.push(x);
    else if (Array.isArray(x)) x.forEach((y) => walk(y));
    else if (x && typeof x === "object")
      for (const [k, v] of Object.entries(x as Record<string, unknown>)) walk(v, k);
  };
  walk(m);
  return out.join(" ");
};
const digits = (s: string) => Number(s.replace(/[^\d]/g, ""));
/** The members' rows summed against the alliance's own stats: lands, people, hosts. */
function addsUp(m: Model): string[] {
  const out: string[] = [],
    table = m.tabs.find((t) => t.id === "members")?.blocks.find((b) => b.type === "table") as
      { rows: { keys: number[] }[] } | undefined;
  if (!table) return [`${m.title} has no Members table`];
  for (const [i, label] of [
    [1, "Lands"],
    [2, "People"],
    [3, "Hosts"],
  ] as const) {
    const sum = table.rows.reduce((n, r) => n + (r.keys[i] ?? 0), 0),
      stat = m.stats.find((s) => s.label === label);
    if (!stat) out.push(`${m.title} has no ${label}`);
    else if (Math.abs(digits(plain(stat.value).split(" ")[0]!) - Math.round(sum)) > 1)
      out.push(
        `${m.title}: its realms' ${label.toLowerCase()} come to ${sum}, its page says ${plain(stat.value)}`,
      );
  }
  const realms = m.stats.find((s) => s.label === "Realms");
  if (realms && digits(plain(realms.value)) !== table.rows.length)
    out.push(`${m.title}: ${table.rows.length} rows for ${plain(realms.value)} realms`);
  return out;
}

// 1. Pure, on the same world.
{
  const { EARTH } = await import("../src/host/planet.ts");
  const { seedFromText, YEAR } = await import("../src/kernel/index.ts");
  const { pageOf } = await import("../src/host/inspect/index.ts");
  const { alliancesOf } = await import("../src/host/inspect/ties.ts");
  const { tiesOf } = await import("../src/sim/index.ts");
  const world = EARTH.build(seedFromText(seed));
  world.runTo(year * YEAR);
  const list = alliancesOf(world);
  say(`${list.length} alliances at year ${year}`);
  check(list.length >= 2, `only ${list.length} alliances`);
  const t0 = performance.now(),
    all = pageOf(world, "world:alliances") as unknown as Model,
    listMs = performance.now() - t0,
    t1 = performance.now(),
    top = list[0] ? (pageOf(world, list[0].ref) as unknown as Model) : null,
    topMs = performance.now() - t1;
  say(
    `read: the Alliances page ${listMs.toFixed(0)} ms, the greatest alliance's ${topMs.toFixed(0)} ms`,
  );
  check(listMs < 400 && topMs < 400, "an alliance's page reads slowly");
  const ranked = all.tabs[0]?.blocks.find((b) => b.type === "table") as
    { rows: unknown[] } | undefined;
  check(
    ranked?.rows.length === list.length,
    `the ranking holds ${ranked?.rows.length} of ${list.length}`,
  );
  check(!BAD.test(wordsOf(all)), `the Alliances page says ${BAD.exec(wordsOf(all))?.[0]}`);
  for (const a of list) {
    const m = pageOf(world, a.ref) as unknown as Model,
      w = wordsOf(m);
    problems.push(...addsUp(m));
    check(
      !BAD.test(w),
      `${m.title} says ${BAD.exec(w)?.[0]} in "${w.slice(Math.max(0, w.search(BAD) - 60), w.search(BAD) + 60)}"`,
    );
    for (const [name] of TABS)
      check(
        m.tabs.some((t) => t.name === name),
        `${m.title} has no ${name} tab`,
      );
  }
  if (list[1]) {
    const c = pageOf(world, `allyvs:${list[0]!.head}|${list[1].head}`) as unknown as Model;
    check(/side by side/.test(c.title), `two alliances side by side: ${c.title}`);
    check(!BAD.test(wordsOf(c)), `two alliances side by side say ${BAD.exec(wordsOf(c))?.[0]}`);
  }
  for (const l of tiesOf(world).leagues()) {
    const m = pageOf(world, `league:${l.event}`) as unknown as Model;
    check(!BAD.test(wordsOf(m)), `a compact's page says ${BAD.exec(wordsOf(m))?.[0]}`);
    check(m.tabs.length >= 3, `a compact's page has ${m.tabs.length} tabs`);
  }
  if (top)
    say(
      `the greatest: ${top.title}; ${top.stats.map((s) => `${s.label} ${plain(s.value)}`).join(", ")}`,
    );
}

// 2. By real touch.
const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4331, strictPort: false } }),
  site = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  });
const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: ci || soft ? 1 : 2,
    hasTouch: true,
    isMobile: true,
  }),
  page = await context.newPage(),
  errors: string[] = [];
page.setDefaultTimeout(slow(60000));
page.on("pageerror", (e) => errors.push(`${e.message}\n${e.stack ?? ""}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};
const until = async (what: string, ok: () => Promise<boolean>, ms = slow(30000)) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await page.waitForTimeout(80);
  }
  problems.push(`${what} did not come`);
  return false;
};
const settle = (ms: number) => page.waitForTimeout(slow(ms));
type At = { x: number; y: number; under: string | null };
/** The middle of the first of them shown that a text matches, and what lies over it there. */
const centre = (sel: string, text = "") =>
  k<At | null>(`(() => {
    for (const e of document.querySelectorAll(${JSON.stringify(sel)})) {
      if (${JSON.stringify(text)} && !e.innerText.includes(${JSON.stringify(text)})) continue;
      e.scrollIntoView({ block: "center", inline: "nearest" });
      const r = e.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) continue;
      const x = r.left + Math.min(r.width / 2, 40), y = r.top + r.height / 2, top = document.elementFromPoint(x, y);
      return { x, y, under: top && (e === top || e.contains(top)) ? null : String(top ? top.className || top.tagName : "nothing") };
    }
    return null;
  })()`);
/** A tap by a finger, where it shows. */
const tap = async (sel: string, what: string, text = "") => {
  let at: At | null = null;
  await until(`${what} on the screen`, async () => {
    at = await centre(sel, text);
    return !!at;
  });
  if (!at) return false;
  const p = at as At;
  check(!p.under, `${what} lies under ${p.under}`);
  check(
    p.x >= 0 && p.x <= 430 && p.y > 0 && p.y < 932,
    `${what} lies off the screen, at ${Math.round(p.x)}, ${Math.round(p.y)}`,
  );
  await page.touchscreen.tap(p.x, p.y);
  await settle(400);
  return true;
};
const pageNow = () => k<string | null>("globalThis.causalis.pageOpen() ?? null");
const pageText = () =>
  k<string>(`(() => {
    for (const e of document.querySelectorAll(".page-window")) {
      const r = e.getBoundingClientRect();
      if (r.height > 0 && r.width > 0) return e.innerText;
    }
    return "";
  })()`);
/** What of the page lies off the screen: the window itself, and anything in it not inside a table that scrolls on its own. */
const offScreen = () =>
  k<string[]>(`(() => {
    const out = [], W = innerWidth, H = innerHeight;
    if (document.documentElement.scrollWidth > W + 1) out.push("the page is wider than the screen");
    for (const win of document.querySelectorAll(".page-window")) {
      const r = win.getBoundingClientRect();
      if (!(r.width > 0)) continue;
      if (r.left < -1 || r.right > W + 1 || r.top < -1 || r.bottom > H + 1) out.push("the window, at " + [r.left, r.top, r.right, r.bottom].map(Math.round));
      for (const e of win.querySelectorAll("*")) {
        if (e.closest(".table-wrap") && !e.classList.contains("table-wrap")) continue;
        const q = e.getBoundingClientRect();
        if (!(q.width > 0 && q.height > 0)) continue;
        if (q.right > r.right + 2 || q.left < r.left - 2) out.push((e.className || e.tagName) + " past the window's side, " + Math.round(q.left) + " to " + Math.round(q.right));
      }
    }
    return out.slice(0, 4);
  })()`);
/** The owner's rule: no window of the HUD over another, no control covered or off the screen (tools/hud-read.ts, as gate 106 reads it). */
const READ = hudRead([], 1);
const hudFine = async (where: string) => {
  const r = await k<HudRead>(READ);
  for (const o of r.overlaps) problems.push(`${where}: overlap: ${o}`);
  for (const c of r.covered) problems.push(`${where}: covered: ${c}`);
  for (const o of r.off) problems.push(`${where}: off the screen: ${o}`);
};
const camera = () =>
  k<{ yaw: number; pitch: number; distance: number }>(
    `(() => { const r = globalThis.causalis.rig; return { yaw: r.yaw, pitch: r.pitch, distance: r.distance }; })()`,
  );
const still = (a: { yaw: number; pitch: number; distance: number }, b: typeof a) =>
  Math.abs(a.yaw - b.yaw) < 0.5 &&
  Math.abs(a.pitch - b.pitch) < 0.5 &&
  Math.abs(a.distance - b.distance) < 0.02;
const barOpen = () => k<boolean>("document.body.classList.contains('bar-open')");
const lensButton = async (name: string) => {
  const sel = `.mapmodes .mode[aria-label="${name}"]`;
  if (!(await centre(sel)) && (await centre(".bar-fold"))) await tap(".bar-fold", "the bar's ☰");
  await tap(sel, `the ${name} lens`);
  if (await barOpen()) await tap(".bar-fold", "the bar's ☰, to fold it");
};
const lensNow = () =>
  k<string | null>(
    `document.querySelector(".mapmodes .mode.on")?.getAttribute("aria-label") ?? null`,
  );
const model = (ref: string) =>
  k<Model>(
    `globalThis.causalis.client.query({ type: "page", args: { ref: ${JSON.stringify(ref)} } })`,
  );

const q = `universe=earth&seed=${encodeURIComponent(seed)}&year=${year}&hold=1`;
await page.goto(`${site}?${q}`);
await page.waitForFunction(
  () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
  undefined,
  { timeout: slow(400000) },
);
await k("globalThis.causalis.client.setSpeed(0)");
await settle(2500);
await k("globalThis.causalis.closePage?.()");
if (await centre(".ran-close")) await tap(".ran-close", "the run's note's ×");
const read = await k<{ alliances: { ref: string; name: string; town: string; realms: number }[] }>(
  `globalThis.causalis.client.query({ type: "blocs.lens" })`,
);
say(`${read.alliances.length} alliances on the lens`);
// The lens chosen: the camera stays.
{
  const looked = await camera();
  await lensButton("Alliances");
  await until(
    "the alliances' key",
    async () => (await k<number>(`document.querySelectorAll(".alliance-key").length`)) >= 2,
  );
  await settle(2000);
  const now = await camera();
  check(
    still(looked, now),
    `choosing the Alliances lens moved the camera: ${JSON.stringify(looked)} to ${JSON.stringify(now)}`,
  );
  await shot("0-lens");
}
// Every alliance ranked.
await tap(".legend-action", "Every alliance");
await until("the Alliances page", async () => (await pageNow()) === "world:alliances");
await until("its ranking", async () => /Their weight, the greatest first/i.test(await pageText()));
{
  const text = await pageText(),
    rows = await k<number>(
      `document.querySelector(".page-window .table-wrap")?.querySelectorAll("tr.row").length ?? 0`,
    ),
    swatches = await k<number>(
      `document.querySelector(".page-window .table-wrap")?.querySelectorAll("tr.row .swatch").length ?? 0`,
    );
  say(`the ranking: ${rows} rows, ${swatches} with their colour`);
  check(
    rows === Math.min(60, read.alliances.length),
    `the ranking shows ${rows} rows for ${read.alliances.length} alliances`,
  );
  check(swatches === rows, `${rows - swatches} ranked alliances without their colour`);
  for (const a of read.alliances.slice(0, 8))
    check(text.includes(a.town), `the ranking leaves out ${a.town}`);
  check(!BAD.test(text), `the ranking says ${BAD.exec(text)?.[0]}`);
  for (const o of await offScreen()) problems.push(`the ranking: ${o}`);
  await hudFine("the ranking");
  await k(`document.querySelector(".page-window .table-wrap")?.scrollIntoView({ block: "start" })`);
  await settle(300);
  await shot("1-ranking");
}
// The greatest pressed.
const top = read.alliances[0]!;
await tap(".page-window tr.row", `${top.town} in the ranking`, top.town);
await until("the greatest alliance's page", async () => (await pageNow()) === top.ref);
await until("its overview", async () => /Its weight in the world/i.test(await pageText()));
for (const [i, [name, want]] of TABS.entries()) {
  const at = await k<number>(
    `[...document.querySelectorAll(".page-window .tabs .tab")].findIndex((b) => b.textContent.trim().startsWith(${JSON.stringify(name)}))`,
  );
  check(at >= 0, `the alliance's page has no ${name} tab on the screen`);
  if (at < 0) continue;
  await tap(`.page-window .tabs .tab:nth-child(${at + 1})`, `the ${name} tab`);
  if (
    !(await until(`the ${name} tab's words`, async () => want.test(await pageText()), slow(15000)))
  )
    continue;
  await settle(500);
  const text = await pageText();
  check(/\d/.test(text), `the ${name} tab has no numbers`);
  check(!BAD.test(text), `the ${name} tab says ${BAD.exec(text)?.[0]}`);
  for (const o of await offScreen()) problems.push(`the ${name} tab: ${o}`);
  await hudFine(`the ${name} tab`);
  say(`${name}: ${text.replace(/\s+/g, " ").slice(0, 200)}`);
  await shot(`2-${i}-${name.toLowerCase()}`);
  if (name === "Members") {
    // Its rows on the screen, summed, against its totals.
    const m = await model(top.ref),
      shown = await k<number>(
        `document.querySelector(".page-window .table-wrap")?.querySelectorAll("tr.row").length ?? 0`,
      );
    for (const p of addsUp(m)) problems.push(p);
    check(shown === top.realms, `the Members table shows ${shown} rows for ${top.realms} realms`);
    const lands = await k<number>(
      `[...document.querySelector(".page-window .table-wrap").querySelectorAll("tr.row")].reduce((n, r) => n + Number(r.children[1].innerText.replace(/[^\\d]/g, "")), 0)`,
    );
    const stat = m.stats.find((s) => s.label === "Lands");
    check(
      stat !== undefined && digits(plain(stat.value).split(" ")[0]!) === lands,
      `the Members table's lands on the screen come to ${lands}, its page says ${stat ? plain(stat.value) : "none"}`,
    );
    say(
      `members: ${shown} rows, their lands on the screen ${lands}; ${m.stats
        .slice(1, 4)
        .map((s) => `${s.label} ${plain(s.value)}`)
        .join(", ")}`,
    );
  }
}
// Set beside another.
if (read.alliances.length >= 2) {
  await tap(`.page-window .tabs .tab:nth-child(1)`, "the Overview tab");
  await until("the overview again", async () => /Set it beside/i.test(await pageText()));
  const other = read.alliances[1]!.name;
  await tap(
    ".page-window .entry",
    `${other}, set beside it`,
    `${other[0]!.toUpperCase()}${other.slice(1)}, `,
  );
  await until("two side by side", async () => ((await pageNow()) ?? "").startsWith("allyvs:"));
  await until("their tally", async () =>
    /Their numbers, pulled against each other/i.test(await pageText()),
  );
  const text = await pageText();
  check(!BAD.test(text), `two alliances side by side say ${BAD.exec(text)?.[0]}`);
  for (const o of await offScreen()) problems.push(`side by side: ${o}`);
  await hudFine("side by side");
  await settle(800);
  await shot("3-side-by-side");
}
// Its "On the map" from another lens: the Alliances lens, the camera where it was.
{
  await k("globalThis.causalis.closePage?.()");
  await settle(400);
  await lensButton("Land");
  await settle(1200);
  await k(`globalThis.causalis.open(${JSON.stringify(top.ref)})`);
  await until("the alliance's page, again", async () => (await pageNow()) === top.ref);
  await settle(800);
  const looked = await camera();
  await tap(".page-window .scene-act", "On the map", "On the map");
  await until("the page put by", async () => (await pageNow()) === null);
  await until("the Alliances lens", async () => (await lensNow()) === "Alliances");
  await settle(2000);
  const now = await camera();
  check(
    still(looked, now),
    `"On the map" moved the camera: ${JSON.stringify(looked)} to ${JSON.stringify(now)}`,
  );
  check(
    (await k<number>(`document.querySelectorAll(".alliance-key").length`)) >= 1,
    `"On the map" shows no alliance's key`,
  );
  await hudFine("on the map");
  await shot("4-on-the-map");
}
for (const e of errors.slice(0, 5)) say(`ERROR ${e.slice(0, 300)}`);
check(errors.length === 0, `${errors.length} errors on the page`);
await browser.close();
await server.close();
if (problems.length) {
  console.log(`gate 114 FAILED:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("gate 114 passed");
