// node tools/a1-gate.ts [--ci] [--soft] [--shots dir] [--save file.save] [--earth file.save]: gate 91, the years can be read and a person knows what's next (A1), at a phone's size, by real touch.
// On a far save, else (as on CI) a young world run a few decades:
//   1. the reading, pure: the same years from one reading; no raw word; a run's note the same reading; Earth, a water people, no fire, no one at all each told what's next, F5's whether;
//   2. the Years by touch: a tab that costs nothing till opened; a few dozen rows of thousands; each kind's filter, one that leaves nothing; a year gone to; a name pressed; hashes the same;
//   3. what's next by touch from the stage chip, on the screen;
//   4. a run at speed by touch and back: the note on the screen, once, its line pressed; held while a page or a film stands; nothing twice;
//   5. the paths nobody watches: a world with no one on it, a run of a few years.
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";
import { preview } from "vite";
import { chromium, type Page } from "playwright";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  type World,
} from "../src/kernel/index.ts";
import { generateHomeWorld } from "../src/gen/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { annalsIndex, annalsRead, runTold, withoutYear } from "../src/host/inspect/annals.ts";
import { nextBlock } from "../src/host/inspect/next.ts";
import { hereOf } from "../src/host/inspect/can.ts";
import { lacksNow } from "../src/host/reading.ts";
import { OPEN, whyShut } from "../src/rules/index.ts";
import type { Block, Line } from "../src/bridge/index.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  shots = arg("--shots"),
  saveFile = arg("--save"),
  earthFile = arg("--earth");
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
console.log("gate 91, the years and what's next");

const plain = (l: Line) => l.map((s) => (typeof s === "string" ? s : s.text)).join("");
const blockWords = (b: Block) =>
  b.type === "list" ? b.items.map((i) => plain(i.line)).join(" | ") : "";
/** Words checked: no raw ref, no raw number, no word a machine would say. */
const readWell = (text: string, where: string) => {
  check(
    !/\b(prin|subst|cell|pol|war|ev|town|sick|star|snat):\d/i.test(text),
    `a raw ref on ${where}: ${text.slice(0, 300)}`,
  );
  check(
    !/\bundefined\b|\bNaN\b|\[object|\bnull\b/.test(text),
    `a broken word on ${where}: ${text.slice(0, 400)}`,
  );
  check(
    !/\b[a-z]+\.[a-z-]+\b(?=[ .:,]|$)/.test(text.replace(/\d\.\d/g, "")),
    `an event's raw name on ${where}: ${text.slice(0, 300)}`,
  );
  check(!/\b1 (years|lands|towns|battles|realms)\b/.test(text), `"1 ..." on ${where}`);
};

// 1. The reading, pure.
check(
  withoutYear("Famine in the steppe, year 1873: food for 69% of 100 people", 1873) ===
    "Famine in the steppe: food for 69% of 100 people",
  "a year in the middle of an event's words",
);
check(
  withoutYear("A ship sent through the lanes in 2942 came, year 2972", 2972) ===
    "A ship sent through the lanes in 2942 came",
  "a year at the end of an event's words, or another year lost",
);

type Forged = {
  readonly bytes: Buffer;
  readonly universe: "earth" | "alien";
  readonly seed: string;
};
const pack = (world: World, universe: "earth" | "alien"): Forged => {
  const u = universe === "earth" ? EARTH : ALIEN;
  return {
    bytes: gzipSync(
      JSON.stringify(saveWorld(world, rulesetId(world, u.version), { universe: u.name })),
    ),
    universe,
    seed: world.seed.text,
  };
};
const worldOf = (file: string, universe: "earth" | "alien"): World => {
  const u = universe === "earth" ? EARTH : ALIEN,
    doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as Parameters<
      typeof loadWorld
    >[0],
    probe = u.build(seedFromText(doc.seed));
  return loadWorld(doc, (s) => u.build(s), rulesetId(probe, u.version), {
    allowRulesetChange: true,
  }).world;
};
const young = (universe: "earth" | "alien", seed: string, years = 30): World => {
  const world = (universe === "earth" ? EARTH : ALIEN).build(seedFromText(seed));
  world.runTo(years * YEAR);
  return world;
};

/** A world read through: the scroll's words, what's next, what a run came to; reading moves nothing. */
function readThrough(world: World, name: string) {
  const before = JSON.stringify(world.domainHashes()),
    t0 = performance.now(),
    index = annalsIndex(world),
    t1 = performance.now(),
    now = Math.floor(world.now / YEAR);
  let lines = 0,
    worst = 0;
  const seen = new Set<string>();
  for (let i = 0; i < index.years.length; i += 200)
    for (const y of annalsRead(world, index.years.slice(i, i + 200))) {
      check(y.lines.length > 0, `${name}: year ${y.year} is told and says nothing`);
      worst = Math.max(worst, y.lines.length);
      for (const l of y.lines) {
        lines++;
        const w = plain(l.line);
        readWell(w, `${name}, year ${y.year}`);
        check(w.length > 8, `${name}, year ${y.year}: "${w}"`);
        check(!new RegExp(`year ${y.year}\\b`).test(w), `${name}: its year again: ${w}`);
        check(!/\d°[NS]/.test(w), `${name}: where it lies, in figures: ${w}`);
        seen.add(w);
      }
    }
  const run = runTold(world, (now - 240) * YEAR, now * YEAR),
    next = nextBlock(world);
  check(run === null || run.lines.length <= 3, `${name}: a note of ${run?.lines.length} lines`);
  for (const l of run?.lines ?? []) readWell(plain(l.line), `${name}'s run`);
  readWell(blockWords(next), `${name}: what's next`);
  check(!!blockWords(next), `${name}: nothing said of what's next`);
  // (What's next is F5's: a way it calls shut is a way What can be done here calls shut.)
  const lack = lacksNow(world);
  const here = hereOf(world);
  if (lack && here.peopled.length) {
    for (const l of lack.lacks) {
      const road = lack.age.asks.find((a) => a.words === l.words)?.road ?? [];
      if (!road.length) continue;
      const all = road.every((id) => !here.known.has(id) && !here.open.has(id)),
        says = /never will|Not as its lands stand/.test(blockWords(next));
      if (all) {
        check(!!whyShut(road[0]!, here.w, here.open), `${name}: F5 has no why for ${road[0]}`);
        check(says, `${name}: F5 shuts ${road[0]}, and what's next doesn't say so`);
      }
    }
  }
  check(before === JSON.stringify(world.domainHashes()), `${name}: reading its years moved a hash`);
  say(
    `${name} at ${now}: ${index.years.length} years told, ${lines} lines, the fullest ${worst}; index ${(t1 - t0).toFixed(0)} ms. Next: ${blockWords(next).slice(0, 220)}`,
  );
  return { index, next, run };
}

let barren: string | null = null;
for (let i = 0; i < 80 && !barren; i++) {
  const g = generateHomeWorld(seedFromText(`barren ${i}`), OPEN, 8);
  if (!g.life.species.length) barren = `barren ${i}`;
}
say(`a world with no one: ${barren}`);
const noOne = young("alien", barren ?? "barren 0", 5);
{
  const r = readThrough(noOne, "a world with no one");
  check(r.index.years.length <= 1, `a world with no one has ${r.index.years.length} years`);
  check(/^Nothing/.test(blockWords(r.next)), `no one, what's next: ${blockWords(r.next)}`);
  check(r.run === null, "a world with no one had a run to tell of");
}
readThrough(young("alien", "vale 471"), "young vale 471");
readThrough(young("alien", "kestrel 557"), "young kestrel 557");
readThrough(young("earth", "first light"), "young first light");

const madeWorld = saveFile ? worldOf(saveFile, "alien") : young("alien", "vale 471");
if (saveFile) readThrough(madeWorld, madeWorld.seed.text);
if (earthFile) readThrough(worldOf(earthFile, "earth"), "first light");
const made = pack(madeWorld, "alien");

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4291, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  });
const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: ci || soft ? 1 : 2,
    hasTouch: true,
    isMobile: true,
  }),
  page: Page = await context.newPage(),
  errors: string[] = [];
page.setDefaultTimeout(slow(60000));
page.on("pageerror", (e) => errors.push(`${e.message}\n${e.stack ?? ""}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;
const until = async (what: string, ok: () => Promise<boolean>, ms = slow(25000)) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await page.waitForTimeout(80);
  }
  problems.push(`${what} did not come`);
  return false;
};
const ask = <T>(type: string, args: unknown = {}) =>
  k<T>(
    `globalThis.causalis.client.query({ type: ${JSON.stringify(type)}, args: ${JSON.stringify(args)} })`,
  );
const shot = (name: string) => page.screenshot(shots ? { path: join(shots, `${name}.png`) } : {});

async function loadSave(f: Forged, q0 = "") {
  const name = `${f.universe}:gate91`,
    q = `universe=${f.universe}&seed=${encodeURIComponent(f.seed)}`;
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
      const bytes = Uint8Array.from(atob(data as string), (c) => c.charCodeAt(0));
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
      await c.importSave(bytes);
      await c.save(keep as string);
    },
    [f.bytes.toString("base64"), name],
  );
  await page.goto(`${base}?${q}&load=${encodeURIComponent(name)}&hold=1${q0}`);
  // (Its first real fall can come as the clock is let go: a card, not a window, while a gate reads.)
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: slow(180000) },
  );
  await page.waitForTimeout(slow(600));
}

/** Press what a selector finds by real touch at its place on the screen, what is at that place being it. */
async function press(selector: string, nth = 0): Promise<boolean> {
  const where = () =>
    k<{ x: number; y: number; w: number; h: number; hit: boolean } | null>(`(() => {
    const all = [...document.querySelectorAll(${JSON.stringify(selector)})].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    const e = all[${nth}];
    if (!e) return null;
    const sticky = e.closest(".years-bar") || e.closest(".timebar") || e.closest(".ran-note");
    if (!sticky) {
      e.scrollIntoView({ block: "center" });
    }
    const r = e.getClientRects()[0] ?? e.getBoundingClientRect(),
      x = r.x + r.width / 2,
      y = r.y + r.height / 2,
      at = document.elementFromPoint(x, y),
      // (A name in a line opens as its whole line does: the line is what the thumb has to hit.)
      box = (e.closest(".entry, .ran-line") ?? e).getBoundingClientRect();
    return { x, y, w: box.width, h: box.height, hit: !!at && (at === e || e.contains(at) || at.contains(e)) };
  })()`);
  let at = await where();
  if (!at) {
    problems.push(`nothing to press at ${selector}`);
    return false;
  }
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(slow(60));
    const now = await where();
    if (!now) break;
    if (now.x === at.x && now.y === at.y) break;
    at = now;
  }
  // (The bar's and the page's own chrome keep the sizes they have across the game: this gate's thumbs are its own things'.)
  if (!/\.tabs|\.nav-back|\.timebar/.test(selector))
    check(at.h >= 44 && at.w >= 44, `${selector} is ${Math.round(at.w)} by ${Math.round(at.h)} px`);
  check(at.x > 0 && at.x < 430 && at.y > 0 && at.y < 932, `${selector} lies off the phone`);
  check(at.hit, `something else lies over ${selector}`);
  await page.touchscreen.tap(at.x, at.y);
  await page.waitForTimeout(slow(250));
  return true;
}

const open = () => k<string | null>("globalThis.causalis.pageOpen()");
/** The years on the screen, as a person reads them: what is in the page's window and not under its bar. */
const onScreen = () =>
  k<{ year: number; text: string; h: number }[]>(`(() => {
  const win = document.querySelector(".page-window");
  if (!win) return [];
  const box = win.getBoundingClientRect(),
    bar = document.querySelector(".years-bar")?.getBoundingClientRect();
  return [...document.querySelectorAll(".years-row")].flatMap((row) => {
    const r = row.getBoundingClientRect();
    if (r.height <= 0 || r.bottom <= (bar?.bottom ?? box.top) || r.top >= Math.min(box.bottom, innerHeight)) return [];
    return [{ year: Number(row.dataset.year), text: row.innerText, h: r.height }];
  });
})()`);
const chip = (i: number) => `.years-chip:nth-child(${i + 1})`;

// 2. The Years.
await loadSave(made);
const hashes0 = JSON.stringify(await ask<unknown>("hashes"));
say(`loaded ${made.seed}`);
const noneYet = await k<number>(`document.querySelectorAll(".years-row").length`);
check(noneYet === 0, "the years drawn before anyone asked");
await k(`globalThis.causalis.open("world:chronicle")`);
await until("the chronicle", async () => (await open()) === "world:chronicle");
await page.waitForTimeout(slow(300));
check(
  (await k<number>(`document.querySelectorAll(".years-row").length`)) === 0,
  "the chronicle's first tab draws the years",
);
const tabAt = await k<number>(
  `[...document.querySelectorAll(".page-window .tabs .tab")].findIndex((b) => /The Years/.test(b.textContent))`,
);
check(tabAt >= 0, "no tab of the years");
const opening = Date.now();
await press(`.page-window .tabs .tab:nth-child(${tabAt + 1})`);
await until("the years", async () => (await onScreen()).length > 0);
say(`the tab open, by touch, to words on the screen: ${Date.now() - opening} ms`);
await shot("years-top");
const index = await ask<{ now: number; years: number[]; masks: number[] }>("annals.index"),
  shownFirst = await onScreen();
// (Half a phone's height, and the newest year may be a full one: two, and more as the eye goes down.)
check(shownFirst.length >= 2, `only ${shownFirst.length} years on the screen`);
for (const r of shownFirst) readWell(r.text, `the year ${r.year} on the screen`);
const t1 = Date.now();
await ask("annals.read", { years: index.years.slice(0, 24) });
say(
  `${index.years.length} years told of ${index.now}; a piece read in ${Date.now() - t1} ms (asked over the worker's wire); on the screen first: ${shownFirst
    .slice(0, 3)
    .map((r) => r.text.replace(/\n+/g, " "))
    .join(" // ")
    .slice(0, 420)}`,
);
// The filter's chips and the row of the year fit the phone.
const off = await k<
  string[]
>(`[...document.querySelectorAll(".years-bar button, .years-bar input")].flatMap((b) => {
  const r = b.getBoundingClientRect();
  return r.width && (r.right > 430 || r.left < 0 || r.height < 44 || r.width < 44) ? [b.className + " " + Math.round(r.left) + "-" + Math.round(r.right) + " h" + Math.round(r.height)] : [];
})`);
check(!off.length, `in the bar, off the phone or too small: ${off.join(", ")}`);
// A scroll: down through the world, a few rows at a time in the page.
const rowsNow = () => k<number>(`document.querySelectorAll(".years-row").length`);
let most = await rowsNow(),
  flown = 0;
const scrolling = Date.now();
const tall = await k<number>(`document.querySelector(".page-window").scrollHeight`);
for (let i = 1; i <= 6; i++) {
  await k(
    `(() => { const w = document.querySelector(".page-window"); w.scrollTop = ${Math.round((tall * i) / 6)}; })()`,
  );
  await page.waitForTimeout(slow(180));
  flown += 1;
  most = Math.max(most, await rowsNow());
}
say(
  `scrolled ${flown} leaps through ${tall} px in ${Date.now() - scrolling} ms; at most ${most} rows drawn at once`,
);
check(most <= 130, `${most} rows drawn at once of ${index.years.length}`);
await until("the years far down", async () => (await onScreen()).length > 0);
await shot("years-far-down");
// To a year, by touch: the year on the screen, under the bar.
const within = index.years[Math.floor(index.years.length / 3)] ?? index.years[0] ?? 0;
await press(".years-at");
await page.keyboard.type(String(within));
await press(".years-to");
await until(
  `year ${within} on the screen`,
  async () => (await onScreen()).some((r) => Math.abs(r.year - within) <= 60),
  slow(8000),
);
const atYear = await onScreen();
say(
  `went to ${within}: on the screen ${atYear
    .map((r) => r.year)
    .slice(0, 6)
    .join(", ")}`,
);
await shot("years-gone-to");
// A year nobody told: past the end. It says the nearest.
await k(`(() => { const i = document.querySelector(".years-at"); if (i) i.value = ""; })()`);
await press(".years-at");
await page.keyboard.type("99999");
await press(".years-to");
await page.waitForTimeout(slow(500));
const nearest = await k<string>(`document.querySelector(".years-says").textContent`);
check(/nearest/.test(nearest) || !index.years.length, `a year past the end said: ${nearest}`);
// Each filter by touch; one that leaves nothing says so.
const allShown = index.years.filter((_, i) => index.masks[i]! & 32).length;
for (let i = 1; i <= 5; i++) {
  await press(chip(i));
  await page.waitForTimeout(slow(350));
  const left = index.years.filter((_, y) => index.masks[y]! & (1 << (i - 1))).length,
    words = await k<string>(`document.querySelector(".years-says").textContent`),
    rows = await onScreen();
  say(`filter ${i}: ${left} years; ${words}`);
  check(
    left ? rows.length > 0 : rows.length === 0 && /^Nothing of /.test(words),
    `the filter ${i}: ${left} years, ${rows.length} on the screen, "${words}"`,
  );
  for (const r of rows) readWell(r.text, `filter ${i}, year ${r.year}`);
  await shot(`years-filter-${i}`);
}
await press(chip(0));
await page.waitForTimeout(slow(300));
check(
  allShown === 0 || (await onScreen()).length > 0,
  "the years did not come back with no filter",
);
await press(".years-order");
await page.waitForTimeout(slow(300));
const oldest = await onScreen();
check(
  !oldest.length || oldest[0]!.year === index.years.filter((_, i) => index.masks[i]! & 32)[0],
  `oldest first begins at ${oldest[0]?.year}`,
);
await shot("years-oldest");
// A name pressed by touch: its own page, and back to where it was.
const nameRef = await k<string | null>(
  `(() => { const box = document.querySelector(".page-window").getBoundingClientRect(), bar = document.querySelector(".years-bar").getBoundingClientRect(); for (const a of document.querySelectorAll(".years-line a.ref-link")) { const r = a.getBoundingClientRect(); if (r.top > bar.bottom + 4 && r.bottom < Math.min(box.bottom, innerHeight) - 4 && r.width > 12) return a.getAttribute("href").slice(1); } return null; })()`,
);
check(!!nameRef || !allShown, "no name on the screen to press");
if (nameRef) {
  await press(`.years-line a[href="#${nameRef}"]`);
  await until(`the page of ${nameRef}`, async () => (await open()) === nameRef);
  await shot("years-name-pressed");
  const title = await k<string>(`document.querySelector(".page-window")?.innerText ?? ""`);
  readWell(title.slice(0, 300), `the page of ${nameRef}`);
  await press(".page-window .nav-back");
  await until("back to the chronicle", async () => /^world:chronicle/.test(String(await open())));
}
await k("globalThis.causalis.closePage?.()");
await page.waitForTimeout(slow(200));
check(
  hashes0 === JSON.stringify(await ask<unknown>("hashes")),
  "reading the years moved a hash in the page",
);

// 3. What's next, by touch from the stage chip.
const chipSel = ".timebar .beside-date .stat-chip";
await until(
  "the stage chip",
  async () => !!(await k(`document.querySelector(${JSON.stringify(chipSel)})`)),
);
const t2 = Date.now();
await press(chipSel);
await until("the stage's page", async () => (await open()) === "world:means");
// (Under the page's title, in the first look; the whole of it a thumb's push down, by real scroll.)
await until(
  "what's next under the title",
  async () =>
    await k<boolean>(`(() => {
    const e = [...document.querySelectorAll(".page-window *")].find((x) => x.children.length === 0 && /Next:|No age yet|Nothing/.test(x.textContent) && x.getBoundingClientRect().height > 0);
    if (!e) return false;
    const r = e.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= innerHeight;
  })()`),
);
say(`the chip pressed, to what's next on the screen: ${Date.now() - t2} ms`);
await shot("next-title");
await k(`(() => {
  const h = [...document.querySelectorAll(".page-window h3")].find((e) => /What's next/.test(e.textContent));
  h?.scrollIntoView({ block: "start" });
})()`);
await page.waitForTimeout(slow(250));
check(
  await k<boolean>(`(() => {
    const h = [...document.querySelectorAll(".page-window h3")].find((e) => /What's next/.test(e.textContent));
    if (!h) return false;
    const r = h.getBoundingClientRect();
    return r.height > 0 && r.top >= 0 && r.bottom <= innerHeight;
  })()`),
  "what's next does not come onto the screen",
);
await shot("next");
const nextWords = await k<string>(`(() => {
  const h = [...document.querySelectorAll(".page-window h3")].find((e) => /What's next/.test(e.textContent));
  return h?.parentElement?.innerText ?? "";
})()`);
say(`on the screen: ${nextWords.replace(/\n+/g, " | ").slice(0, 400)}`);
readWell(nextWords, "what's next");
check(nextWords.length > 20, `what's next says: ${nextWords}`);
await k("globalThis.causalis.closePage?.()");
await page.waitForTimeout(slow(200));
check(hashes0 === JSON.stringify(await ask<unknown>("hashes")), "what's next moved a hash");

// 4. A run by touch, and back: the note, once.
const noteUp = () =>
  k<{ h: number; top: number; bottom: number; text: string; hit: boolean } | null>(`(() => {
  const n = document.querySelector(".ran-note");
  if (!n || n.hidden) return null;
  const r = n.getBoundingClientRect();
  if (!r.height) return null;
  const at = document.elementFromPoint(r.x + r.width / 2, r.y + Math.min(30, r.height / 2));
  return { h: r.height, top: r.top, bottom: r.bottom, text: n.innerText, hit: !!at && n.contains(at) };
})()`);
const yearNow = async () =>
  Math.floor((await k<number>(`globalThis.causalis.client.status?.t ?? 0`)) / YEAR);
const statusYear = async () =>
  Math.floor(
    (
      await k<{ t: number }>(
        `globalThis.causalis.client.query({ type: "time" }).catch(() => ({ t: 0 }))`,
      )
    ).t / YEAR,
  );
void yearNow;
void statusYear;
const clock = () => k<string>(`document.querySelector(".timebar .clock")?.textContent ?? ""`);
const speeds = () => k<number>(`document.querySelectorAll(".timebar .speed").length`);
const runSeconds = saveFile ? slow(14000) : slow(6000);
await press(`.timebar .speed:nth-child(${await speeds()})`);
say(`running at its fastest, by touch: ${await clock()}`);
await page.waitForTimeout(runSeconds);
const running = await clock();
check(!(await noteUp()), "a note came while the world still ran");
// A page opened while it runs: the pause comes with the page up, and the note waits.
await k(`globalThis.causalis.open("world:ledger")`);
await until("a page", async () => (await open()) === "world:ledger");
await press(`.timebar .speed:nth-child(1)`).catch(() => false);
await k(`(() => { document.querySelector(".timebar .speed").click(); })()`);
await page.waitForTimeout(slow(2500));
say(`stopped, a page up: ${await clock()} (ran to ${running})`);
check(!(await noteUp()), "a note came over a page");
await k("globalThis.causalis.closePage?.()");
// A film's chrome as it came on: it waits for that too.
await k(`document.body.classList.add("filming")`);
await page.waitForTimeout(slow(1800));
check(!(await noteUp()), "a note came during a film");
await k(`document.body.classList.remove("filming")`);
const came = await until("the note", async () => !!(await noteUp()), slow(9000));
if (came) {
  await page.waitForTimeout(slow(250));
  const n = (await noteUp())!;
  await shot("note");
  say(
    `the note, ${Math.round(n.h)} px tall from ${Math.round(n.top)}: ${n.text.replace(/\n+/g, " | ").slice(0, 500)}`,
  );
  readWell(n.text, "the note");
  check(/years?\b/.test(n.text), `the note says no years: ${n.text}`);
  check(n.hit, "something lies over the note");
  check(n.bottom <= 932 && n.top >= 0, "the note lies off the phone");
  check(n.h <= 932 * 0.56, `the note is ${Math.round(n.h)} px tall`);
  // A film beginning under it: it steps aside and comes back, not again from the start.
  await k(`document.body.classList.add("living")`);
  await page.waitForTimeout(slow(1000));
  check(!(await noteUp()), "the note stands over a life");
  await k(`document.body.classList.remove("living")`);
  await until("the note back", async () => !!(await noteUp()), slow(3000));
  // Its line pressed by touch: its page, and the note gone for good.
  const lineSel = ".ran-note .ran-line";
  await press(lineSel);
  await until("a page from the note", async () => !!(await open()), slow(8000));
  await shot("note-pressed");
  await k("globalThis.causalis.closePage?.()");
  await page.waitForTimeout(slow(2200));
  check(!(await noteUp()), "the note came twice for one run");
} else say("no note came");
if (saveFile) check(came, "a run at speed of a far world told nothing");
// A second run, its note pressed to read those years.
await press(`.timebar .speed:nth-child(${await speeds()})`);
await page.waitForTimeout(runSeconds);
await press(`.timebar .speed:nth-child(1)`);
if (
  await until("a second note", async () => !!(await noteUp()), slow(9000)).then((ok) => {
    if (!ok) problems.pop();
    return ok;
  })
) {
  await press(".ran-read");
  await until("the years from the note", async () => (await onScreen()).length > 0, slow(9000));
  const from = await onScreen();
  say(
    `read those years: on the screen ${from
      .map((r) => r.year)
      .slice(0, 5)
      .join(", ")}`,
  );
  await shot("note-read");
  await k("globalThis.causalis.closePage?.()");
}

// 5. The paths nobody watches: a world with no one on it, opened.
await loadSave(pack(noOne, "alien"));
const h0 = JSON.stringify(await ask<unknown>("hashes"));
await k(`globalThis.causalis.open("world:chronicle#years")`);
await until("the barren world's years", async () =>
  /Nothing has happened|have something told|Nothing yet/.test(
    await k<string>(`document.querySelector(".years-says")?.textContent ?? ""`),
  ),
);
await shot("no-one-years");
say(`no one, the years: ${await k<string>(`document.querySelector(".years-says").textContent`)}`);
await k("globalThis.causalis.closePage?.()");
await press(chipSel);
await until("the barren world's stage", async () => (await open()) === "world:means");
await page.waitForTimeout(slow(300));
await shot("no-one-next");
const none = await k<string>(`(() => {
  const h = [...document.querySelectorAll(".page-window h3")].find((e) => /What's next/.test(e.textContent));
  return h?.parentElement?.innerText ?? "";
})()`);
say(`no one, what's next: ${none.replace(/\n+/g, " | ")}`);
check(/Nothing/.test(none), `no one: ${none}`);
check(h0 === JSON.stringify(await ask<unknown>("hashes")), "a world with no one: a hash moved");

for (const e of errors) problems.push(`page error: ${e.slice(0, 400)}`);
await browser.close();
await server.close();
if (problems.length) {
  console.log(`gate 91: ${problems.length} problems`);
  for (const p of [...new Set(problems)].slice(0, 40)) console.log(`  x ${p.slice(0, 500)}`);
  process.exit(1);
}
console.log("gate 91: passed");
process.exit(0);
