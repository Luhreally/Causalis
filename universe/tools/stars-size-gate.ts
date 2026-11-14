// node tools/stars-size-gate.ts [--ci] [--soft] [--shots dir]: gate 119, the stars' size (C2 of docs/architecture/asks-2026-11-12-plan.md,
// asked 2026-11-12: "diffrent galaxy sizes/world/planet sizes options ... to have even more control of performance and speed").
//   1. the rule, in node: a sky's size is its seed's text alone; a small sky is the usual sky's nearest stars, at the same
//      density (a true sky, not a thinner one), a large one holds the usual whole; the most peoples kept to each;
//   2. the title at a phone's size (430 by 932), by touch: the stars' dial beside the world's size, turned small, large and
//      back, the seed's text saying so; nothing on the form over anything else, nothing off the screen;
//   3. each size begun from the title by touch, its stars opened by touch from its star's system: every star the world holds
//      drawn (counted against the stars the seed's text makes in node), the map's words, the time it took to open, the frames;
//      the level of detail: far stars of a few faces at first sight, round ones once pinched close, none lost;
//   4. a large sky's size read back from its save, the file and the world taken up from it.
// (npm run build first; --soft draws in software, as CI's browser does; --shots keeps pictures.)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { preview } from "vite";
import { chromium, type Page } from "playwright";
import { Rng, seedFromText, seedWithAct } from "../src/kernel/index.ts";
import {
  CLUSTER_LY,
  MOST_CIVILIZATIONS,
  civilizationsOf,
  clusterStars,
  foreignPlanets,
  makeGalaxy,
} from "../src/gen/index.ts";
import { makingAct, makingsOf, skyOf } from "../src/rules/index.ts";

const argv = process.argv.slice(2),
  ci = argv.includes("--ci"),
  soft = argv.includes("--soft"),
  shots = argv.includes("--shots") ? argv[argv.indexOf("--shots") + 1] : undefined;
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
console.log("gate 119, the stars' size");

const SEED = "first light",
  SIZES = [
    { name: "standard", choice: undefined, words: "standard" },
    { name: "small", choice: "small", words: "few" },
    { name: "large", choice: "large", words: "many" },
  ] as const;
const textOf = (seed: string, choice: string | undefined) =>
  choice ? seedWithAct(seed, makingAct("sky", choice)) : seed;

/** What a seed's text makes of its sky, as the world makes it (sim/space/stars.ts, sim/space/contact.ts): its stars and its peoples. */
function skyMade(text: string) {
  const seed = seedFromText(text),
    sky = skyOf(text),
    rng = new Rng(seed),
    stars = clusterStars(rng, makeGalaxy(rng), sky?.radius),
    r2 = new Rng(seed),
    peoples = civilizationsOf(r2, stars, (s) => foreignPlanets(r2, s), sky?.most);
  return {
    radius: sky?.radius ?? CLUSTER_LY,
    most: sky?.most ?? MOST_CIVILIZATIONS,
    stars,
    peoples,
  };
}

// 1. The rule.
const made = new Map<string, ReturnType<typeof skyMade>>();
for (const seed of [SEED, "alien 41"]) {
  const [usual, small, large] = SIZES.map((z) => skyMade(textOf(seed, z.choice))) as [
    ReturnType<typeof skyMade>,
    ReturnType<typeof skyMade>,
    ReturnType<typeof skyMade>,
  ];
  if (seed === SEED) SIZES.forEach((z, i) => made.set(z.name, [usual, small, large][i]!));
  const refs = (s: typeof usual, within = Infinity) =>
      s.stars
        .filter((x) => x.distance <= within)
        .map((x) => x.ref)
        .sort()
        .join(","),
    density = (s: typeof usual) => s.stars.length / s.radius ** 3;
  say(
    `${seed}: ${[usual, small, large].map((s) => `${s.stars.length} stars within ${s.radius} ly, ${s.peoples.length} of at most ${s.most} peoples`).join("; ")}`,
  );
  check(skyOf(seed) === null, `${seed}: a seed with no sky written is not the usual`);
  check(
    usual.radius === 50 && usual.most === 12,
    `${seed}: the usual sky is ${usual.radius} ly, ${usual.most} peoples`,
  );
  check(
    refs(small) === refs(usual, small.radius),
    `${seed}: a small sky is not the usual one's nearest stars`,
  );
  check(
    refs(usual) === refs(large, usual.radius),
    `${seed}: a large sky does not hold the usual one`,
  );
  for (const s of [small, large]) {
    const r = density(s) / density(usual);
    check(r > 0.75 && r < 1.33, `${seed}: ${s.radius} ly's stars are ${r.toFixed(2)} as dense`);
  }
  check(
    small.stars.length < usual.stars.length / 4 && large.stars.length > usual.stars.length * 3,
    `${seed}: ${small.stars.length}, ${usual.stars.length} and ${large.stars.length} stars`,
  );
  for (const s of [usual, small, large])
    check(s.peoples.length <= s.most, `${seed}: ${s.peoples.length} peoples past ${s.most}`);
  check(
    small.peoples.length <= usual.peoples.length && usual.peoples.length <= large.peoples.length,
    `${seed}: peoples ${small.peoples.length}, ${usual.peoples.length}, ${large.peoples.length}`,
  );
}

// 2–4. In the browser, at a phone's size, by touch.
const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4336, strictPort: false } }),
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
const until = async (what: string, ok: () => Promise<boolean>, ms = slow(30000)) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await page.waitForTimeout(80);
  }
  problems.push(`${what} did not come`);
  return false;
};
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};
type Drawn = { stars: number; near: number; far: number; glows: number };
const drawnNow = () => k<Drawn | null>("globalThis.causalis?.starsDrawn?.() ?? null");

/** Press what a selector finds (the first on the screen, or the first whose text is `text`) with a finger. */
async function press(selector: string, text?: string): Promise<boolean> {
  const at = await k<{ x: number; y: number } | null>(`(() => {
    for (const e of document.querySelectorAll(${JSON.stringify(selector)})) {
      if (${JSON.stringify(text ?? null)} !== null && e.textContent.trim() !== ${JSON.stringify(text ?? null)}) continue;
      e.scrollIntoView({ block: "center" });
      const r = e.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    return null;
  })()`);
  if (!at) {
    problems.push(`nothing to press at ${selector}${text ? ` “${text}”` : ""}`);
    return false;
  }
  await page.waitForTimeout(slow(120));
  await page.touchscreen.tap(at.x, at.y);
  await page.waitForTimeout(slow(250));
  return true;
}

/** The title's New world pressed, an Earth like ours chosen on the seed (true: there was one to press). */
async function newWorld(): Promise<boolean> {
  await page.goto(base);
  await page.waitForSelector(".title-menu .choice", { timeout: slow(60000) });
  const at = await k<{ x: number; y: number } | null>(`(() => {
    const b = [...document.querySelectorAll(".title-menu .choice")].find((e) => /New world/.test(e.textContent));
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  if (!at) return false;
  await page.touchscreen.tap(at.x, at.y);
  await page.waitForSelector(".seed-input", { timeout: slow(30000) });
  await press(".choice-row .choice[data-id='earth']");
  await page.fill(".seed-input", SEED);
  await page.dispatchEvent(".seed-input", "input");
  return true;
}

/** The title's new world with its stars' dial turned by touch to a size. */
async function titleAt(choice: string | undefined): Promise<void> {
  check(await newWorld(), "no New world on the title");
  for (let i = 0; i < 3 && makingsOf(await page.inputValue(".seed-input")).sky !== choice; i++)
    await press(".size-row .making-dial[data-subject='sky']");
}

// 2. The title.
{
  check(await newWorld(), "no New world on the title");
  const dial = () =>
    k<string>(
      `document.querySelector(".size-row .making-dial[data-subject='sky']")?.textContent ?? ""`,
    );
  const sizeDial = await k<string>(
    `document.querySelector(".size-row .making-dial[data-subject='size']")?.textContent ?? ""`,
  );
  const turned: string[] = [`“${await page.inputValue(".seed-input")}” ${await dial()}`];
  check(/Stars: standard/.test(await dial()), `the stars' dial reads “${await dial()}” at first`);
  check(/Size: standard/.test(sizeDial), `the world's size dial reads “${sizeDial}”`);
  for (const want of ["small", "large", undefined]) {
    await press(".size-row .making-dial[data-subject='sky']");
    const text = await page.inputValue(".seed-input"),
      words = await dial(),
      z = SIZES.find((x) => x.choice === want)!;
    turned.push(`“${text}” ${words}`);
    check(text === textOf(SEED, want), `the seed's text reads “${text}” for ${z.name}`);
    check(words.endsWith(`: ${z.words}`), `the stars' dial reads “${words}” for ${z.name}`);
    if (want === "large") await shot("1-title-large");
  }
  say(`the title, turned by touch: ${turned.join(" → ")}`);
  // (Nothing on the form over anything else, and nothing off the screen's sides.)
  const laid = await k<{ name: string; x: number; y: number; w: number; h: number }[]>(`(() => {
    const out = [];
    for (const e of document.querySelectorAll(".title-form button, .title-form input, .title-form h3, .title-form .making-dial")) {
      const r = e.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || e.closest("[hidden]")) continue;
      out.push({ name: (e.dataset.subject ?? e.dataset.id ?? e.className ?? e.tagName) + ":" + e.textContent.trim().slice(0, 24), x: r.x, y: r.y + scrollY, w: r.width, h: r.height });
    }
    return out;
  })()`);
  const over: string[] = [];
  for (let i = 0; i < laid.length; i++) {
    const a = laid[i]!;
    if (a.x < -0.5 || a.x + a.w > 430.5) over.push(`${a.name} off the screen's side`);
    for (let j = i + 1; j < laid.length; j++) {
      const b = laid[j]!,
        w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x),
        h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (w > 1 && h > 1) over.push(`${a.name} over ${b.name}`);
    }
  }
  const dials = laid.filter((x) => /^(size|sky):/.test(x.name));
  say(
    `the size row: ${dials.map((d) => `${d.name} at ${Math.round(d.x)},${Math.round(d.y)} ${Math.round(d.w)}×${Math.round(d.h)}`).join("; ")}`,
  );
  check(dials.length === 2, `${dials.length} dials on the size row`);
  check(
    dials.length === 2 && Math.abs(dials[0]!.y - dials[1]!.y) < 2,
    "the stars' dial is not beside the world's size",
  );
  check(!over.length, `on the title: ${over.slice(0, 4).join("; ")}`);
}

// 3. Each size begun, its stars opened.
let largeSeed = "";
for (const z of SIZES) {
  const want = made.get(z.name)!,
    text = textOf(SEED, z.choice);
  await titleAt(z.choice);
  check(
    (await page.inputValue(".seed-input")) === text,
    `${z.name}: the title's seed reads “${await page.inputValue(".seed-input")}”`,
  );
  await press(".title-form .begin");
  await page.waitForURL(/universe=earth&seed=/, { timeout: slow(60000) });
  await until(
    `${z.name}: the world begun`,
    async () => ((await k<number>("globalThis.causalis?.drawn?.() ?? 0")) ?? 0) > 0,
    slow(180000),
  );
  const begun = await k<string>("globalThis.causalis.seed");
  check(begun === text, `${z.name}: begun as “${begun}”`);
  await k("globalThis.causalis.client.setSpeed(0)");
  // Out to its star's system, and from there to the stars by touch.
  await k("globalThis.causalis.sky()");
  await until(`${z.name}: the star's system`, () =>
    k<boolean>(
      `[...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "The stars ›" && b.getBoundingClientRect().width > 0)`,
    ),
  );
  const t0 = Date.now();
  await press("button", "The stars ›");
  await until(
    `${z.name}: the stars drawn`,
    async () => ((await drawnNow())?.stars ?? 0) > 0,
    slow(60000),
  );
  // (From the finger down: press waits a moment before it.)
  const openMs = Date.now() - t0 - slow(120);
  await page.waitForTimeout(slow(800));
  const drawn = await drawnNow(),
    held = await k<number>("globalThis.causalis.starCount()"),
    words = await k<string>(`document.body.innerText`),
    fps = await k<number>(`new Promise((done) => {
      let n = 0;
      const t0 = performance.now(),
        f = () => {
          n++;
          if (performance.now() - t0 < 2000) requestAnimationFrame(f);
          else done(n / ((performance.now() - t0) / 1000));
        };
      requestAnimationFrame(f);
    })`);
  await shot(`2-${z.name}-stars`);
  say(
    `${z.name} (“${begun}”): opened in ${openMs} ms; ${drawn?.stars} stars drawn (${drawn?.near} round, ${drawn?.far} of a few faces, ${drawn?.glows} glows) of ${held} the world holds, ${want.stars.length} its text makes; ${fps.toFixed(0)} frames a second`,
  );
  check(
    held === want.stars.length,
    `${z.name}: the world holds ${held} stars, not ${want.stars.length}`,
  );
  check(
    drawn?.stars === want.stars.length,
    `${z.name}: ${drawn?.stars} stars drawn of ${want.stars.length}`,
  );
  check(
    !drawn || drawn.glows === 0 || drawn.glows === want.stars.length,
    `${z.name}: ${drawn?.glows} glows for ${want.stars.length} stars`,
  );
  check(
    words.includes(`The stars within ${want.radius} light-years`),
    `${z.name}: the map does not say its ${want.radius} light-years`,
  );
  check(
    words.includes(
      `${want.stars.length.toLocaleString("en")} stars within ${want.radius} light-years`,
    ),
    `${z.name}: the map's words do not count its ${want.stars.length} stars`,
  );
  // The level of detail: at first sight of a large sky every star is a few pixels; pinched close, those near are round.
  if (z.name === "large") {
    check(
      (drawn?.far ?? 0) > want.stars.length / 2,
      `large: ${drawn?.far} far stars at first sight`,
    );
    const cdp = await context.newCDPSession(page),
      fingers = (d: number) => [
        { x: 215 - d, y: 466, id: 1 },
        { x: 215 + d, y: 466, id: 2 },
      ];
    // (Three spreads, each a third as far: from some 146 to some 5, short of the 3 past which a pinch goes in to a star.)
    const before = await k<number>("globalThis.causalis.rig.distance");
    for (let pinch = 0; pinch < 3; pinch++) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: fingers(60) });
      for (let i = 1; i <= 12; i++) {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: fingers(60 + i * 10),
        });
        await page.waitForTimeout(16);
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.waitForTimeout(slow(300));
    }
    await cdp.detach();
    await until(
      "a star drawn round, pinched close",
      async () => ((await drawnNow())?.near ?? 0) > 0,
      slow(8000),
    );
    const close = await drawnNow(),
      after = await k<number>("globalThis.causalis.rig.distance");
    await shot("3-large-pinched-close");
    say(
      `pinched close, from ${before.toFixed(0)} to ${after.toFixed(1)}: ${close?.near} round, ${close?.far} of a few faces, ${close?.stars} in all`,
    );
    check(close?.stars === want.stars.length, `pinched close, ${close?.stars} stars drawn`);
    largeSeed = begun;
  }
}

// 4. A large sky read back from its save.
{
  await k(`globalThis.causalis.client.save("earth:gate119")`);
  const b64 = await k<string>(`(async () => {
    const b = await globalThis.causalis.client.exportSave();
    let s = "";
    for (let i = 0; i < b.length; i += 32768) s += String.fromCharCode(...b.subarray(i, i + 32768));
    return btoa(s);
  })()`);
  const bytes = Buffer.from(b64, "base64"),
    doc = JSON.parse((bytes[0] === 123 ? bytes : gunzipSync(bytes)).toString("utf8")) as {
      seed: string;
    },
    sky = skyOf(doc.seed);
  say(
    `the save: ${Math.round(bytes.length / 1024)} KB, its seed “${doc.seed}”, its sky ${JSON.stringify(sky)}`,
  );
  check(doc.seed === largeSeed, `the save's seed is “${doc.seed}”`);
  check(sky?.radius === 80 && sky.most === 24, "the save does not keep a large sky");
  await page.goto(
    `${base}?universe=earth&seed=${encodeURIComponent(largeSeed)}&load=${encodeURIComponent("earth:gate119")}`,
  );
  await until(
    "the large sky's save taken up",
    async () => ((await k<number>("globalThis.causalis?.drawn?.() ?? 0")) ?? 0) > 0,
    slow(180000),
  );
  await k("globalThis.causalis.client.setSpeed(0)");
  const seed = await k<string>("globalThis.causalis.seed");
  await k("globalThis.causalis.stars()");
  await until("the saved sky's stars drawn", async () => ((await drawnNow())?.stars ?? 0) > 0);
  const again = await drawnNow(),
    want = made.get("large")!.stars.length;
  say(`taken up: “${seed}”, ${again?.stars} stars drawn`);
  check(seed === largeSeed, `the save taken up is “${seed}”`);
  check(again?.stars === want, `taken up, ${again?.stars} stars drawn of ${want}`);
}

if (errors.length) problems.push(`errors on the page:\n${errors.slice(0, 5).join("\n")}`);
await browser.close();
await server.close();
if (problems.length) {
  console.log(`gate 119 FAILED:\n- ${problems.join("\n- ")}`);
  process.exitCode = 1;
} else console.log("gate 119 passed");
process.exit();
