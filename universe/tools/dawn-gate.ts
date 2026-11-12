// node tools/dawn-gate.ts [--ci] [--soft] [--shots dir] — gate 111, how life began here (B2 of the life plan,
// docs/architecture/asks-2026-11-12-plan.md Part B; asked 2026-11-12: "make sure the aliens and how life emerges from
// worlds are real primitives and i see all diffrent types of species"), on the built app at a phone's size (430 by
// 932), by real touch:
//   1. three worlds opened, each made and not run (one of the Earth universe, two open ones of other dawns): from its
//      world's page, its Life page pressed; where its life began and on what, when its air changed, in words;
//   2. "Under the glass" pressed: its first seas' drop alive, its kinds named under it; the three worlds' places and
//      small lives must differ on the screen, their drops in the pixels;
//   3. its stocks and its roles pressed; on one, another world set beside it from a chip, by touch;
//   4. on every page: no raw id, no broken word, and nothing lying off the phone.
// (npm run build first; --soft draws in software, as CI's browser does.)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium, type Page } from "playwright";

const argv = process.argv.slice(2),
  ci = argv.includes("--ci"),
  soft = argv.includes("--soft"),
  shots = argv.includes("--shots") ? argv[argv.indexOf("--shots") + 1] : undefined;
if (shots) mkdirSync(shots, { recursive: true });
const slow = (ms: number) => (ci || soft ? ms * 4 : ms);
const GPU = [
  "--use-angle=d3d11",
  "--ignore-gpu-blocklist",
  "--enable-gpu",
  "--force_high_performance_gpu",
];
const problems: string[] = [],
  check = (ok: boolean, what: string) => {
    if (!ok) problems.push(what);
  },
  say = (s: string) => console.log(`  ${s}`);
console.log("gate 111: how life began here");

/** Three worlds whose life began apart (tools/dawn-tally.ts): Earth's at vents, one in tide pools, one in sunlit films under a dim star. */
const WORLDS: readonly (readonly [string, string])[] = [
  ["earth", "first light"],
  ["alien", "alien 7"],
  ["alien", "alien 29"],
];

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4328, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  });
const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 1,
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
const until = async (what: string, ok: () => Promise<boolean>, ms = slow(30000)) => {
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
const open = () => k<string | null>("globalThis.causalis.pageOpen()");
const pageText = () => k<string>(`document.querySelector(".page-window")?.innerText ?? ""`);

/** Press what a selector finds by real touch at its place on the screen, what is at that place being it. */
async function press(selector: string, nth = 0, chrome = false): Promise<boolean> {
  const where = () =>
    k<{ x: number; y: number; h: number; hit: boolean } | null>(`(() => {
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
      box = (e.closest(".entry") ?? e).getBoundingClientRect();
    return { x, y, h: box.height, hit: !!at && (at === e || e.contains(at) || at.contains(e)) };
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

/** A page's words checked: no raw ref or id, no broken word. */
const readWell = (text: string, where: string) => {
  check(
    !/\b(life|lifewith|world|can|prin|subst|cell|clade|spec|plnt|moon):[a-z0-9]/i.test(text),
    `a raw ref on ${where}: ${text.slice(0, 300)}`,
  );
  check(
    !/\b(h2-co2|h2-sulfur|h2-iron|ammonia-iron|breathe-o2|breathe-h2|breathe-nitrate|breathe-sulfate|split-water|light-sulfur|light-iron|light-hydrogen|dim-red)\b/.test(
      text,
    ),
    `a raw id on ${where}: ${text.slice(0, 300)}`,
  );
  check(
    !/undefined|NaN|\[object|\bnull\b|Infinity/.test(text),
    `a broken word on ${where}: ${text.slice(0, 300)}`,
  );
};
/** Nothing of the page lies off the phone: every block within its width, the page no wider than its window. */
const fits = async (where: string) => {
  const f = await k<{ wide: number; off: string[] }>(`(() => {
    const w = document.querySelector(".page-window");
    if (!w) return { wide: 0, off: ["no page"] };
    const off = [...w.querySelectorAll("*")]
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (r.right > 431 || r.left < -1);
      })
      .slice(0, 4)
      .map((e) => (e.className || e.tagName) + " " + Math.round(e.getBoundingClientRect().right));
    return { wide: w.scrollWidth - w.clientWidth, off };
  })()`);
  check(f.wide <= 1, `${where}: the page runs ${f.wide} px wider than its window`);
  check(!f.off.length, `${where}: off the phone: ${f.off.join(", ")}`);
};
/** The drop's glass in the pixels: its mean colour and how much of it is each hue, from its canvas. */
const glassOf = () =>
  k<{
    r: number;
    g: number;
    b: number;
    hues: number[];
    box: { x: number; y: number; w: number; h: number };
  } | null>(`(() => {
    const c = document.querySelector(".page-window canvas.drop-glass");
    if (!c) return null;
    const x = c.getContext("2d"), d = x.getImageData(0, 0, c.width, c.height).data, hues = new Array(12).fill(0);
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 16) {
      const R = d[i], G = d[i + 1], B = d[i + 2];
      r += R; g += G; b += B; n++;
      const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
      if (mx - mn < 40 || mx < 70) continue;
      let h = mx === R ? (G - B) / (mx - mn) : mx === G ? 2 + (B - R) / (mx - mn) : 4 + (R - G) / (mx - mn);
      h = ((h * 60) + 360) % 360;
      hues[Math.floor(h / 30)]++;
    }
    const box = c.getBoundingClientRect();
    return { r: r / n, g: g / n, b: b / n, hues: hues.map((v) => v / n), box: { x: box.x, y: box.y, w: box.width, h: box.height } };
  })()`);

type Seen = {
  seed: string;
  began: string;
  kinds: string[];
  glass: { r: number; g: number; b: number; hues: number[] } | null;
};
const seen: Seen[] = [];

for (const [universe, seed] of WORLDS) {
  await page.goto(`${base}?universe=${universe}&seed=${encodeURIComponent(seed)}&hold=1`);
  try {
    await page.waitForFunction(
      () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
      undefined,
      { timeout: slow(300000) },
    );
  } catch {
    problems.push(`${seed}: the world did not open`);
    continue;
  }
  await page.waitForTimeout(slow(800));
  const name = seed.replace(/\s+/g, "-"),
    life = await ask<{ subtitle: ({ ref?: string } | string)[] }>("page", { ref: "world:life" }),
    home = life.subtitle.map((s) => (typeof s === "string" ? null : (s.ref ?? null))).find(Boolean);
  check(!!home, `${seed}: the Life page names no world page`);
  // 1. From its world's page, its Life page by touch.
  await k(`globalThis.causalis.open(${JSON.stringify(home)})`);
  await until(`${seed}: its world's page`, async () => (await open()) === home);
  await page.waitForTimeout(slow(400));
  await shot(`${name}-world`);
  await press(`.page-window a[href="#world:life"]`);
  await until(`${seed}: its Life page`, async () => (await open()) === "world:life");
  await page.waitForTimeout(slow(500));
  await shot(`${name}-life`);
  let text = await pageText();
  readWell(text, `${seed}'s Life page`);
  await fits(`${seed}'s Life page`);
  for (const w of [
    /Where it began/i,
    /What it first ran on/i,
    /Its air/i,
    /Where life could have begun/i,
    /When its air changed/i,
  ])
    check(w.test(text), `${seed}: no ${w} on its Life page`);
  const began = (/Began at\s*\n?\s*([^\n]+)/i.exec(text)?.[1] ?? "").trim();
  check(!!began, `${seed}: no place its life began, on the screen`);
  say(
    `${seed}: began at ${began}; ${(/What it first ran on:?\s*([^\n]+)/i.exec(text)?.[1] ?? "").slice(0, 120)}`,
  );
  // 2. Under the glass, by touch: its first seas' drop, alive.
  await press(`.page-window .tabs .tab:nth-child(3)`, 0, true);
  await page.waitForTimeout(slow(2500));
  await k(
    `document.querySelector(".page-window canvas.drop-glass")?.scrollIntoView({ block: "center" })`,
  );
  await page.waitForTimeout(slow(1500));
  await shot(`${name}-glass`);
  const glass = await glassOf(),
    kinds = await k<string[]>(
      `[...document.querySelectorAll(".page-window .drop-legend > *")].map((e) => e.innerText.replace(/\\s*\\d+\\s*$/, "").trim()).filter(Boolean)`,
    );
  text = await pageText();
  readWell(text, `${seed}'s drop`);
  await fits(`${seed}'s drop`);
  check(!!glass, `${seed}: no drop under the glass`);
  if (glass)
    check(
      glass.box.x >= 0 &&
        glass.box.x + glass.box.w <= 431 &&
        glass.box.y >= 0 &&
        glass.box.y + glass.box.h <= 933,
      `${seed}: the drop lies off the phone (${JSON.stringify(glass.box)})`,
    );
  check(kinds.length >= 3, `${seed}: ${kinds.length} kinds named under the drop`);
  say(`${seed}: under the glass, ${kinds.join(", ")}`);
  seen.push({
    seed,
    began,
    kinds,
    glass: glass && { r: glass.r, g: glass.g, b: glass.b, hues: glass.hues },
  });
  // 3. Its stocks and its roles.
  await press(`.page-window .tabs .tab:nth-child(4)`, 0, true);
  await page.waitForTimeout(slow(600));
  await shot(`${name}-stocks`);
  readWell(await pageText(), `${seed}'s stocks`);
  await fits(`${seed}'s stocks`);
  await press(`.page-window .tabs .tab:nth-child(5)`, 0, true);
  await page.waitForTimeout(slow(400));
  await shot(`${name}-roles`);
  text = await pageText();
  readWell(text, `${seed}'s roles`);
  check(/living lineage/i.test(text), `${seed}: its roles say nothing: ${text.slice(0, 200)}`);
  // (Another world beside it, by touch, once.)
  if (seed === "alien 29") {
    await press(`.page-window .tabs .tab:nth-child(6)`, 0, true);
    await page.waitForTimeout(slow(400));
    await press(`.can-chip[data-seed="first light"]`);
    await until(
      `${seed}: first light beside it`,
      async () =>
        (await open()) === "lifewith:earth|first%20light" &&
        !!(await k(`document.querySelector(".sides")`)),
    );
    await page.waitForTimeout(slow(500));
    await shot(`${name}-beside`);
    text = await pageText();
    readWell(text, `${seed} beside first light`);
    await fits(`${seed} beside first light`);
    check(
      /How their life began/i.test(text),
      `${seed}: nothing set beside it: ${text.slice(0, 200)}`,
    );
  }
  await k("globalThis.causalis.closePage?.()");
}

// The three worlds apart, on the screen.
check(seen.length === WORLDS.length, `only ${seen.length} of ${WORLDS.length} worlds seen`);
check(
  new Set(seen.map((s) => s.began)).size === seen.length,
  `their places alike: ${seen.map((s) => s.began).join(" / ")}`,
);
for (let i = 0; i < seen.length; i++)
  for (let j = i + 1; j < seen.length; j++) {
    const a = seen[i]!,
      b = seen[j]!;
    check(
      a.kinds.join("+") !== b.kinds.join("+"),
      `${a.seed} and ${b.seed}: the same small lives (${a.kinds.join(", ")})`,
    );
    if (a.glass && b.glass) {
      const hue = a.glass.hues.reduce((s, v, h) => s + Math.abs(v - b.glass!.hues[h]!), 0),
        mean =
          Math.abs(a.glass.r - b.glass.r) +
          Math.abs(a.glass.g - b.glass.g) +
          Math.abs(a.glass.b - b.glass.b);
      say(
        `${a.seed} and ${b.seed}: their drops' hues apart by ${(hue * 100).toFixed(1)}%, their mean colours by ${mean.toFixed(1)}`,
      );
      check(
        hue > 0.004 || mean > 3,
        `${a.seed} and ${b.seed}: their drops look alike in the pixels`,
      );
    }
  }

for (const e of errors) problems.push(`page error: ${e.slice(0, 400)}`);
await browser.close();
await server.close();
if (problems.length) {
  console.log(`gate 111: ${problems.length} problems`);
  for (const p of problems) console.log(`  x ${p}`);
  process.exit(1);
}
console.log("gate 111: passed");
process.exit(0);
