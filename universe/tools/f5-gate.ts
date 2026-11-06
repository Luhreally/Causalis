// node tools/f5-gate.ts [--ci] [--soft] [--shots dir] [--save file.save] [--earth file.save]: gate 89, the tree of what can be done (F5), at a phone's size, by real touch.
// On a far save, else (as on CI) a young world run a few decades:
//   1. the rule: whether and why from one reading, and the sentences differ from world to world;
//   2. from the world's page by touch: the age's chip, 🪜, what can be done here: what's odd about it, seven functions; hashes the same before and after;
//   3. a line of it pressed: the thing's page; the rest in one tap;
//   4. beside another world, a chip pressed by touch: two columns that fit the phone, and that differ in the pixels;
//   5. the paths nobody watches: a world beside itself, a seed typed that nothing has run, a lifeless world. No error, no raw ref, no sentence wrong at its one.
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
import { generateHomeWorld, provinceWorld } from "../src/gen/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { canWorldOf } from "../src/host/can.ts";
import {
  EARTHLIKE,
  OPEN,
  PRINCIPLES,
  causesOf,
  openSteps,
  readCan,
  whyShut,
} from "../src/rules/index.ts";
import { spreadOf } from "../src/sim/index.ts";

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
console.log("gate 89, the tree of what can be done");

// 1. The rule, pure: every step shut says why, none open does, and two worlds do not read alike.
const readOf = (universe: "earth" | "alien", seed: string) => {
  const fine = generateHomeWorld(seedFromText(seed), universe === "earth" ? EARTHLIKE : OPEN),
    g = provinceWorld(fine),
    w = canWorldOf(g, fine.life.people ? spreadOf(g, seed).lands.map(([c]) => c) : [], true),
    open = openSteps(w);
  return { w, open, read: readCan(w, open, () => false) };
};
const said = new Map<string, string>();
for (const [u, seed] of [
  ["alien", "vale 471"],
  ["alien", "kestrel 557"],
  ["alien", "quill 742"],
  ["earth", "first light"],
] as const) {
  const { w, open, read } = readOf(u, seed);
  for (const p of PRINCIPLES) {
    const why = whyShut(p.id, w, open);
    check(
      open.has(p.id) === (why === null),
      `${seed}: ${p.id} open ${open.has(p.id)}, why ${JSON.stringify(why)}`,
    );
  }
  said.set(
    seed,
    JSON.stringify(
      read.map((f) => [f.words, f.rungs.filter((r) => r.state === "shut").map((r) => r.why)]),
    ),
  );
  say(
    `${seed}: ${open.size} open; ${causesOf(w, open).length} causes; ${read.find((f) => f.id === "heat")!.words}`,
  );
}
check(new Set(said.values()).size === said.size, "two worlds read alike");

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
const fromFile = (file: string, universe: "earth" | "alien"): Forged => {
  const u = universe === "earth" ? EARTH : ALIEN,
    doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as Parameters<
      typeof loadWorld
    >[0],
    probe = u.build(seedFromText(doc.seed)),
    world = loadWorld(doc, (s) => u.build(s), rulesetId(probe, u.version), {
      allowRulesetChange: true,
    }).world;
  return pack(world, universe);
};
const youngWorld = (): Forged => {
  const world = ALIEN.build(seedFromText("vale 471"));
  world.runTo(30 * YEAR);
  return pack(world, "alien");
};

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4289, strictPort: false } }),
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
const shot = async (name: string) => {
  const b = await page.screenshot(shots ? { path: join(shots, `${name}.png`) } : {});
  return b.toString("base64");
};

async function loadSave(f: Forged) {
  const name = `${f.universe}:gate89`,
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
  await page.goto(`${base}?${q}&load=${encodeURIComponent(name)}&hold=1`);
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: slow(180000) },
  );
  await page.waitForTimeout(slow(600));
}

/** Press what a selector finds by real touch at its place on the screen, what is at that place being it. */
async function press(selector: string, nth = 0, chrome = false): Promise<boolean> {
  const where = () =>
    k<{ x: number; y: number; w: number; h: number; hit: boolean } | null>(`(() => {
    const all = [...document.querySelectorAll(${JSON.stringify(selector)})].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    const e = all[${nth}];
    if (!e) return null;
    e.scrollIntoView({ block: "center" });
    const r = e.getBoundingClientRect(),
      x = r.x + r.width / 2,
      y = r.y + r.height / 2,
      at = document.elementFromPoint(x, y),
      // (A name in a line opens as its whole line does: the line is what the thumb has to hit.)
      box = (e.closest(".entry") ?? e).getBoundingClientRect();
    return { x, y, w: box.width, h: box.height, hit: !!at && (at === e || e.contains(at) || at.contains(e)) };
  })()`);
  let at = await where();
  if (!at) {
    problems.push(`nothing to press at ${selector}`);
    return false;
  }
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(slow(100));
    const now = await where();
    if (!now) break;
    if (now.x === at.x && now.y === at.y) break;
    at = now;
  }
  if (!chrome) check(at.h >= 44, `${selector} is ${Math.round(at.h)} px tall`);
  check(at.x > 0 && at.x < 430 && at.y > 0 && at.y < 932, `${selector} lies off the phone`);
  check(at.hit, `something else lies over ${selector}`);
  await page.touchscreen.tap(at.x, at.y);
  await page.waitForTimeout(slow(300));
  return true;
}

const pageText = () => k<string>(`document.querySelector(".page-window")?.innerText ?? ""`);
const open = () => k<string | null>("globalThis.causalis.pageOpen()");
/** A page's words checked: no raw ref, no wrong one. */
const readWell = (text: string, where: string) => {
  check(
    !/\b(prin|subst|cell|can|world):[a-z0-9]/i.test(text),
    `a raw ref on ${where}: ${text.slice(0, 300)}`,
  );
  check(
    !/\b1 (steps|years|lands|more steps)\b/.test(text),
    `"1 ..." wrong on ${where}: ${text.slice(0, 300)}`,
  );
  check(
    !/\b0 (steps|more)\b|undefined|NaN|\[object|null\b/.test(text),
    `a broken word on ${where}: ${text.slice(0, 400)}`,
  );
  check(
    !/saltpetre|charcoal|nitric|recipe/i.test(text),
    `how a charge is made, on ${where}: ${text.slice(0, 300)}`,
  );
};
/** How much of a part of the screen is each tone's colour: what the eye goes by, not a count of words. */
const tones = (d: string, x0: number, x1: number) =>
  page.evaluate(
    async ([data, a, b]) => {
      const bm = await createImageBitmap(
          await (await fetch(`data:image/png;base64,${data as string}`)).blob(),
        ),
        c = new OffscreenCanvas(bm.width, bm.height),
        x = c.getContext("2d")!,
        s = bm.width / 430;
      x.drawImage(bm, 0, 0);
      const px = x.getImageData(
        Math.round((a as number) * s),
        0,
        Math.round(((b as number) - (a as number)) * s),
        bm.height,
      ).data;
      let red = 0,
        green = 0,
        n = 0;
      for (let i = 0; i < px.length; i += 16) {
        const r = px[i]!,
          g = px[i + 1]!,
          u = px[i + 2]!;
        n++;
        if (r > g + 22 && r > u + 22) red++;
        if (g > r + 14 && g > u + 8) green++;
      }
      return { red: red / n, green: green / n };
    },
    [d, x0, x1] as const,
  );

// 2–4. A far world (or a young one).
const made = saveFile ? fromFile(saveFile, "alien") : youngWorld();
await loadSave(made);
const before = JSON.stringify(await ask<unknown>("hashes"));
say(`loaded ${made.seed}`);

// From the world's page, by touch.
await k(`globalThis.causalis.open("world:means")`);
await until("the world's page", async () => (await open()) === "world:means");
await page.waitForTimeout(slow(400));
await shot("means");
await press(`.page-window .entry a[href="#world:can"]`);
await until("what can be done", async () => (await open()) === "world:can");
await page.waitForTimeout(slow(500));
const t0 = Date.now();
await ask("page", { ref: "world:can" });
say(`the page read again in ${Date.now() - t0} ms`);
await shot("can-top");
let text = await pageText();
readWell(text, "what can be done");
for (const w of [
  /odd about it/i,
  /holding an edge/i,
  /heat, and how high/i,
  /a charge/i,
  /throwing things far/i,
  /under its own power/i,
  /flight/i,
  /talking at a distance/i,
])
  check(w.test(text), `no ${w} on the page: ${text.slice(0, 200)}`);
say(text.slice(0, 900).replace(/\n+/g, " | "));
// (The page down, a screen at a time, to look at.)
for (let i = 1; i <= 3; i++) {
  await k(`(() => { document.querySelector(".page-window").scrollTop = ${i} * 780; })()`);
  await page.waitForTimeout(slow(250));
  await shot(`can-${i}`);
}

// A line pressed: the thing's page.
const lineRef = await k<string | null>(
  `document.querySelector(".page-window .entry.tone-have.line a[href^='#prin:'], .page-window .entry.tone-open.line a[href^='#prin:']")?.getAttribute("href")?.slice(1) ?? null`,
);
check(!!lineRef, "no line of it opens a thing's page");
if (lineRef) {
  await press(`.page-window .entry a[href="#${lineRef}"]`);
  await until("the thing's page", async () => (await open()) === lineRef);
  await page.waitForTimeout(slow(300));
  await shot("line-pressed");
  await press(".page-window .nav-back", 0, true);
  await until("back", async () => (await open()) === "world:can");
}
// The rest, in one tap.
await press(`.page-window .tabs .tab:nth-child(2)`, 0, true);
await page.waitForTimeout(slow(300));
await shot("rest");
text = await pageText();
readWell(text, "the rest");
check(/riding|vessel|glass/i.test(text), `the rest says nothing: ${text.slice(0, 200)}`);

// Beside another world, by touch.
await press(`.page-window .tabs .tab:nth-child(3)`, 0, true);
await page.waitForTimeout(slow(300));
await shot("beside-pick");
await press(`.can-chip[data-seed="first light"]`);
await until(
  "first light beside it",
  async () =>
    (await open()) === "can:earth|first%20light" && !!(await k(`document.querySelector(".sides")`)),
  slow(30000),
);
await page.waitForTimeout(slow(500));
await k(`document.querySelectorAll(".sides")[1]?.scrollIntoView({ block: "start" })`);
await page.waitForTimeout(slow(300));
const besideShot = await shot("beside-parts");
await k(`document.querySelector(".page-window").scrollTop = 0`);
await page.waitForTimeout(slow(200));
await shot("beside-top");
text = await pageText();
readWell(text, "beside another");
check(/why they part/i.test(text), `no why they part: ${text.slice(0, 300)}`);
const fit = await k<{ most: number; cells: number; wide: number }>(`(() => {
  const cells = [...document.querySelectorAll(".sides-cell")].map((e) => e.getBoundingClientRect());
  const w = document.querySelector(".page-window");
  return { most: Math.max(...cells.map((r) => r.right)), cells: cells.length, wide: w.scrollWidth - w.clientWidth };
})()`);
say(`${fit.cells} cells side by side; the furthest ends at ${Math.round(fit.most)} px`);
check(fit.cells >= 8, `only ${fit.cells} cells side by side`);
check(fit.most <= 430, `a cell ends at ${fit.most} px, off a phone`);
check(fit.wide <= 1, `the page runs ${fit.wide} px wider than its window`);
const left = await k<{ a: number; b: number }>(`(() => {
  const r = document.querySelector(".sides-cells")?.children;
  return { a: r[0].getBoundingClientRect().left, b: r[1].getBoundingClientRect().left };
})()`);
check(left.b > left.a + 100, "the two columns are not side by side");
if (saveFile) {
  const a = await tones(besideShot, 0, left.b - 2),
    b = await tones(besideShot, left.b, 430);
  say(
    `the columns in the pixels: here ${(a.red * 100).toFixed(1)}% red ${(a.green * 100).toFixed(1)}% green; beside ${(b.red * 100).toFixed(1)}% red ${(b.green * 100).toFixed(1)}% green`,
  );
  check(
    a.red > b.red + 0.02 || a.green + 0.02 < b.green,
    `the two columns look alike: ${JSON.stringify([a, b])}`,
  );
}

// The paths nobody watches.
await k(`document.querySelector(".page-window").scrollTop = 0`);
// A world beside itself.
const selfRef = `can:${made.universe}|${encodeURIComponent(made.seed)}`;
await k(`globalThis.causalis.open(${JSON.stringify(selfRef)})`);
await until("itself", async () => (await open()) === selfRef);
await page.waitForTimeout(slow(300));
await shot("beside-self");
text = await pageText();
readWell(text, "a world beside itself");
check(/nothing parts a world from itself/i.test(text), `beside itself: ${text.slice(0, 300)}`);
// A seed typed by touch, that nothing has run.
await press(".can-seed");
await page.keyboard.type("no one has run this 9");
await press(".can-go");
await until(
  "a typed seed",
  async () =>
    /^can:alien\|no%20one/.test(String(await open())) &&
    !!(await k(`document.querySelector(".sides")`)),
  slow(30000),
);
await page.waitForTimeout(slow(300));
await shot("beside-typed");
text = await pageText();
readWell(text, "a typed seed");
// A lifeless world: its column says so.
let lifeless: string | null = null;
for (let i = 0; i < 80 && !lifeless; i++) {
  const g = generateHomeWorld(seedFromText(`barren ${i}`), OPEN, 8);
  if (!g.life.species.length) lifeless = `barren ${i}`;
}
say(`a lifeless world: ${lifeless}`);
if (lifeless) {
  const ref = `can:alien|${encodeURIComponent(lifeless)}`;
  await k(`globalThis.causalis.open(${JSON.stringify(ref)})`);
  await until(
    "a lifeless world",
    async () => (await open()) === ref && !!(await k(`document.querySelector(".sides")`)),
    slow(30000),
  );
  await page.waitForTimeout(slow(300));
  await shot("beside-lifeless");
  text = await pageText();
  readWell(text, "a lifeless world beside it");
  check(/no people/i.test(text), `a lifeless world's column: ${text.slice(0, 300)}`);
}
const empty = await ask<{ title: string }>("page", { ref: "can:alien|" });
check(!!empty?.title, "an empty seed broke the page");

await k("globalThis.causalis.closePage?.()");
const after = JSON.stringify(await ask<unknown>("hashes"));
check(before === after, "reading what can be done moved a hash");

// Earth, a far save given: nothing odd said of it that is false.
if (earthFile) {
  const earth = fromFile(earthFile, "earth");
  await loadSave(earth);
  const h0 = JSON.stringify(await ask<unknown>("hashes")),
    t1 = Date.now();
  await k(`globalThis.causalis.open("world:can")`);
  await until("Earth's page", async () => (await open()) === "world:can");
  await page.waitForTimeout(slow(500));
  say(`Earth's page opened in ${Date.now() - t1} ms`);
  await shot("earth");
  text = await pageText();
  readWell(text, "Earth's page");
  say(text.slice(0, 700).replace(/\n+/g, " | "));
  await k(`globalThis.causalis.open(${JSON.stringify("can:alien|vale%20471")})`);
  await until(
    "vale 471 beside Earth",
    async () => !!(await k(`document.querySelector(".sides")`)),
    slow(30000),
  );
  await page.waitForTimeout(slow(400));
  await shot("earth-beside");
  readWell(await pageText(), "vale 471 beside Earth");
  check(h0 === JSON.stringify(await ask<unknown>("hashes")), "Earth's page moved a hash");
}

for (const e of errors) problems.push(`page error: ${e.slice(0, 400)}`);
await browser.close();
await server.close();
if (problems.length) {
  console.log(`gate 89: ${problems.length} problems`);
  for (const p of problems) console.log(`  x ${p}`);
  process.exit(1);
}
console.log("gate 89: passed");
process.exit(0);
