// node tools/b1-gate.ts [--ci] [--soft] [--shots dir] [--save file.save] [--universe earth|alien] [--water file.save] [--nogrip file.save]: gate 96, the people bar and the history written out, at a phone's size, by real touch.
// On far saves, else (as on CI) a young world run a few decades:
//   1. the reading, node side: the bar at every peopled land, no broken word, at most a handful, the same twice; a pin's paths;
//   2. the bar on the screen, its words read off the screen, a chip pressed by touch: their page, the same name and face, how they are told; hashes the same;
//   3. ⌖ Go to by touch: down to where they live, and the bar follows the place, and holds still;
//   4. pin by touch, kept through a reload, off by touch; a pin on another world does not come; one who left a seat says so; fold by touch;
//   5. it never lies over a tool, at every scale; it stands aside in a possession, a life and a reign;
//   6. one press writes the history out: how far along it is, nothing long on the page's thread, kept by touch at its real place; opened in a fresh browser with no network, links lead somewhere, its words are the game's; hashes the same;
//   7. the paths nobody watches: a world with no people yet; year 40 with no realm; a water people; a no-grip people; a desk.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";
import { preview } from "vite";
import { chromium, webkit, type Page } from "playwright";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  type World,
} from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { politiesOf, populationContext } from "../src/sim/index.ts";
import { barOf } from "../src/host/bar.ts";
import type { BarRead } from "../src/bridge/index.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  shots = arg("--shots"),
  saveFile = arg("--save"),
  saveUniverse = (arg("--universe") ?? "alien") as "earth" | "alien",
  waterFile = arg("--water"),
  noGripFile = arg("--nogrip");
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
console.log("gate 96, the people bar and the history written out");
const BAD = /undefined|NaN|\[object|\bev:\d|\bpol:\d|town:\d|cell:\d|\brule:pol|\bcourt:pol/;

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
const fromFile = (file: string, universe: "earth" | "alien"): World => {
  const u = universe === "earth" ? EARTH : ALIEN,
    doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as Parameters<
      typeof loadWorld
    >[0],
    probe = u.build(seedFromText(doc.seed));
  return loadWorld(doc, (s) => u.build(s), rulesetId(probe, u.version), {
    allowRulesetChange: true,
  }).world;
};

/** 1. The bar at every peopled land of a world, node side. A rule that looks fine at the two places a gate opens has been wrong on a whole world. */
function tally(world: World, name: string): void {
  const before = JSON.stringify(world.domainHashes()),
    lands = populationContext(world)
      .provinces.all()
      .filter((p) => p.total() > 0);
  let most = 0,
    none = 0,
    slowest = 0;
  const whys = new Map<string, number>();
  let all = 0;
  for (const p of lands) {
    const t = performance.now(),
      got = barOf(world, { cell: p.cell, town: null, pins: [], followed: [] });
    slowest = Math.max(slowest, performance.now() - t);
    most = Math.max(most, got.people.length);
    if (!got.people.length) none++;
    for (const x of got.people) {
      all++;
      whys.set(x.why, (whys.get(x.why) ?? 0) + 1);
      const said = `${x.name} ${x.why} ${x.readings.mood.words} ${x.readings.doing.words} ${x.readings.health.words}`;
      check(!BAD.test(said), `${name}: a broken word: ${said}`);
    }
  }
  const top = [...whys].sort((a, b) => b[1] - a[1])[0];
  say(
    `${name}: ${lands.length} peopled lands: at most ${most} on the bar, no one at ${none}; commonest "${top?.[0]}" ${((100 * (top?.[1] ?? 0)) / Math.max(1, all)).toFixed(0)}%; slowest read ${slowest.toFixed(0)} ms`,
  );
  check(most <= 6, `${name}: ${most} on the bar at one place`);
  if (lands.length) check(none === 0, `${name}: ${none} peopled lands with no one on the bar`);
  // The same world, the same people, and reading moves nothing.
  if (lands[0]) {
    const a = JSON.stringify(
        barOf(world, { cell: lands[0].cell, town: null, pins: [], followed: [] }),
      ),
      b = JSON.stringify(barOf(world, { cell: lands[0].cell, town: null, pins: [], followed: [] }));
    check(a === b, `${name}: two readings of one moment differ`);
  }
  // One pinned who no longer holds the seat says so, with no face; one who never was a person says so too.
  const r = politiesOf(world).living()[0];
  if (r) {
    const got = barOf(world, {
        cell: null,
        town: null,
        pins: [
          { ref: `rule:${r.ref}`, name: "Someone Before" },
          { ref: "court:pol:0:999999:424242", name: "One Long Gone" },
        ],
        followed: [],
      }),
      left = got.people[0],
      gone = got.people[1];
    check(
      !!left?.gone && !left.portrait && /^No longer rules /.test(left.why),
      `${name}: one who left a seat reads ${JSON.stringify(left)}`,
    );
    check(!!gone?.gone && !gone.portrait, `${name}: one gone reads ${JSON.stringify(gone)}`);
  }
  check(JSON.stringify(world.domainHashes()) === before, `${name}: reading moved the hashes`);
}

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4296, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  });
const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: ci || soft ? 1 : 2,
    hasTouch: true,
    isMobile: true,
    acceptDownloads: true,
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
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};
async function loadSave(f: Forged) {
  const name = `${f.universe}:gate96`,
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
/** A thing pressed by touch at its real place on the screen; what is under the finger is checked first. */
async function press(selector: string, what = selector): Promise<boolean> {
  const where = () =>
    k<{ x: number; y: number; w: number; h: number; top: boolean } | null>(`(() => {
    for (const e of document.querySelectorAll(${JSON.stringify(selector)})) {
      e.scrollIntoView({ block: "center", inline: "nearest" });
      const r = e.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        const x = r.x + r.width / 2, y = r.y + r.height / 2, at = document.elementFromPoint(x, y);
        return { x, y, w: r.width, h: r.height, top: !!at && (at === e || e.contains(at) || at.contains(e)) };
      }
    }
    return null;
  })()`);
  let at = await where();
  if (!at) {
    problems.push(`nothing to press at ${what}`);
    return false;
  }
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(slow(100));
    const now = await where();
    if (!now) break;
    if (now.x === at.x && now.y === at.y) break;
    at = now;
  }
  check(at.top, `${what}: something else lies over it at ${Math.round(at.x)}, ${Math.round(at.y)}`);
  check(
    at.x - at.w / 2 >= 0 && at.x + at.w / 2 <= innerW() && at.y + at.h / 2 <= innerH(),
    `${what}: off the screen at ${Math.round(at.x)}, ${Math.round(at.y)}`,
  );
  await page.touchscreen.tap(at.x, at.y);
  await page.waitForTimeout(slow(300));
  return true;
}
const innerW = () => page.viewportSize()!.width,
  innerH = () => page.viewportSize()!.height;
const pageText = () =>
  k<string>(
    `(() => { const e = document.querySelector(".page-window"); return e && e.getBoundingClientRect().height > 0 ? e.innerText : ""; })()`,
  );
const pageNow = () => k<string | null>("globalThis.causalis.pageOpen()");
const closePage = async () => {
  await k(`globalThis.causalis.closePage?.()`);
  await page.waitForTimeout(slow(200));
};
/** The bar as it is on the screen: each chip's words, its place, and whether it is what a finger would meet. */
type Seen = {
  height: number;
  chips: {
    key: string;
    kind: string;
    ref: string;
    words: string;
    x: number;
    y: number;
    w: number;
    h: number;
    top: boolean;
    now: number;
    clipped: boolean;
  }[];
  fold: { x: number; y: number; h: number; w: number } | null;
};
const barSeen = () =>
  k<Seen>(`(() => {
    const b = document.querySelector(".people-bar"), box = b?.getBoundingClientRect();
    const chips = [...document.querySelectorAll(".people-chip")].map((c) => {
      const r = c.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2,
        at = r.height > 0 ? document.elementFromPoint(x, y) : null, now = c.querySelector(".people-now"),
        reads = [...c.querySelectorAll(".people-read")], last = reads[reads.length - 1]?.getBoundingClientRect(),
        nr = now?.getBoundingClientRect();
      return { key: c.dataset.key, kind: c.dataset.kind, ref: c.querySelector(".people-open").dataset.ref,
        words: r.height > 0 ? c.innerText : "", x, y, w: r.width, h: r.height, top: !!at && c.contains(at), now: reads.length,
        clipped: !!last && !!nr && last.right > nr.right + 0.5 };
    });
    const f = document.querySelector(".people-fold"), fr = f?.getBoundingClientRect();
    return { height: box?.height ?? 0, chips, fold: fr && fr.height > 0 ? { x: fr.x + fr.width / 2, y: fr.y + fr.height / 2, h: fr.height, w: fr.width } : null };
  })()`);
/** Whatever can be pressed that the bar lies over: nothing, at every scale. */
const overTools = () =>
  k<string[]>(`(() => {
    const bar = document.querySelector(".people-bar");
    if (!bar || bar.getBoundingClientRect().height === 0) return [];
    const parts = [...bar.querySelectorAll(".people-chip, .people-fold")].map((e) => e.getBoundingClientRect()).filter((r) => r.height > 0 && r.right > 0 && r.left < innerWidth);
    const out = [];
    for (const e of document.querySelectorAll("#hud button, #hud a, #hud input, #hud select")) {
      if (bar.contains(e)) continue;
      const r = e.getBoundingClientRect();
      if (r.height === 0 || r.width === 0 || getComputedStyle(e).visibility === "hidden") continue;
      if (parts.some((p) => p.left < r.right - 1 && p.right > r.left + 1 && p.top < r.bottom - 1 && p.bottom > r.top + 1)) out.push((e.getAttribute("aria-label") || e.innerText || e.className).slice(0, 40));
    }
    return out;
  })()`);
const barGone = async (what: string) => {
  const s = await barSeen();
  check(s.height === 0, `${what}: the bar did not stand aside (${s.height} px)`);
};
/** The bar on the screen and read, at a scale. */
const barWell = async (name: string, least = 1): Promise<Seen> => {
  await until(
    `${name}: the bar`,
    async () => (await barSeen()).chips.filter((c) => c.h > 0).length >= least,
    slow(20000),
  );
  const s = await barSeen(),
    on = s.chips.filter((c) => c.h > 0);
  const said = on.map((c) => c.words.replace(/\s+/g, " ")).join(" || ");
  say(`${name}: ${said}`);
  check(!BAD.test(said), `${name}: a broken word on the bar: ${said}`);
  const inPlace = on.filter((c) => c.x >= 0 && c.x <= innerW());
  check(
    inPlace.every((c) => c.top),
    `${name}: something lies over a chip: ${JSON.stringify(inPlace.filter((c) => !c.top).map((c) => [c.key, c.x, c.y]))}`,
  );
  check(
    on.every((c) => c.y + c.h / 2 <= innerH() && c.y - c.h / 2 >= 0),
    `${name}: a chip off the screen`,
  );
  check(
    on.every((c) => c.now === 3),
    `${name}: a chip without its three readings`,
  );
  check(!on.some((c) => c.clipped), `${name}: a reading cut off: ${said}`);
  const over = await overTools();
  check(!over.length, `${name}: the bar lies over ${over.join(", ")}`);
  await shot(`${name}-bar`);
  return s;
};

/** A far world, or a young one: the whole walk. */
async function walk(world: World, f: Forged, name: string): Promise<void> {
  await loadSave(f);
  const before = JSON.stringify(await ask<unknown>("hashes"));
  await page.waitForTimeout(slow(1200));
  const atGlobe = await barWell(`${name}-globe`);
  const first = atGlobe.chips.find((c) => c.h > 0 && c.x <= innerW());
  if (!first) {
    problems.push(`${name}: no one on the bar`);
    return;
  }

  // 2. A chip by touch: their page, the same name and the same face.
  const chipName = first.words.split("\n")[0]!.replace(/^📌 /, "");
  await press(`.people-chip[data-key="${first.key}"] .people-open`, "a chip");
  await until("their page", async () => (await pageNow()) === first.ref);
  // (A page's window comes first and its words after, as the worker reads them.)
  await until(
    `${name}: their page's words`,
    async () => (await pageText()).includes(chipName),
    slow(30000),
  );
  await page.waitForTimeout(slow(400));
  const text = await pageText();
  check(
    text.includes(chipName),
    `${name}: the page does not name ${chipName}: ${text.slice(0, 200)}`,
  );
  check(
    /How they are now|As history last had them/.test(text),
    `${name}: their page does not say how they are: ${text.slice(0, 300)}`,
  );
  await shot(`${name}-page`);
  say(`${name}, their page: ${text.replace(/\s+/g, " ").slice(0, 420)}`);
  check(!BAD.test(text), `${name}: a broken word on their page: ${text.slice(0, 400)}`);
  const same = await k<boolean>(`(async () => {
    const page = await globalThis.causalis.client.query({ type: "page", args: { ref: ${JSON.stringify(first.ref)} } });
    const read = await globalThis.causalis.client.query({ type: "people.bar", args: { cell: null, town: null, pins: [{ ref: ${JSON.stringify(first.ref)}, name: page.title }], followed: [] } });
    return read.people[0].name === page.title && JSON.stringify(read.people[0].portrait) === JSON.stringify(page.portrait);
  })()`);
  check(same, `${name}: the bar's face or name is not their page's`);

  // 3. ⌖ Go to, by touch: where they live; and the bar follows the place.
  const place = await ask<{ scale: string; town?: string } | null>("place", { ref: first.ref });
  if (place?.scale === "village") {
    await press(".page-window .go-to", "⌖ Go to");
    await until(
      "their town",
      () =>
        k<boolean>(
          `globalThis.causalis.scale() === "village" && globalThis.causalis.planNow()?.ref === ${JSON.stringify(place.town)}`,
        ),
      slow(60000),
    );
    await page.waitForTimeout(slow(1500));
    await k(`globalThis.causalis.closePage?.()`);
    await page.waitForTimeout(slow(2500));
    const atTown = await barWell(`${name}-town`);
    check(
      atTown.chips.some((c) => c.key === first.key) || first.kind !== "ruler",
      `${name}: the ruler is not on the bar in their own town`,
    );
    // Held still: it does not shuffle while nothing moves.
    const moved0 = await k<number>("globalThis.causalis.peopleBar.moved");
    await page.waitForTimeout(slow(5000));
    const moved1 = await k<number>("globalThis.causalis.peopleBar.moved"),
      reads = await k<number>("globalThis.causalis.peopleBar.reads");
    check(moved1 === moved0, `${name}: the row moved ${moved1 - moved0} times with the world held`);
    say(`${name}: ${reads} readings so far; ${moved1 - moved0} moves in 5 s held`);
  } else await closePage();

  // 4. Pin by touch: someone's page, kept through a reload; off by touch. A pin carried to another world doesn't come.
  const heir =
    (await barSeen()).chips.find((c) => c.kind === "heir" || c.kind === "rival") ?? first;
  await k(`globalThis.causalis.open(${JSON.stringify(heir.ref)})`);
  await until("the page to pin from", async () => (await pageNow()) === heir.ref);
  await page.waitForTimeout(slow(400));
  await press(".page-window .bar-pin", "📌 Keep them on the people bar");
  await until("the pin", () =>
    k<boolean>(`globalThis.causalis.barPins.has(${JSON.stringify(heir.ref)})`),
  );
  await closePage();
  await until(
    "the pinned chip",
    async () => (await barSeen()).chips.some((c) => c.h > 0 && c.words.startsWith("📌")),
    slow(10000),
  );
  await barWell(`${name}-pinned`);
  await press(".people-chip .people-off:not([hidden])", "× on a pinned chip");
  await until("the pin gone", () =>
    k<boolean>(`!globalThis.causalis.barPins.has(${JSON.stringify(heir.ref)})`),
  );
  // (Another world's pins: keyed by world. One forged under another world's name does not appear here.)
  const other = await k<number>(`(() => {
    localStorage.setItem("causalis.bar.pins:alien:some other world", JSON.stringify([{ ref: "rule:pol:0:1", name: "From Elsewhere" }]));
    return globalThis.causalis.barPins.all.filter((p) => p.name === "From Elsewhere").length;
  })()`);
  check(other === 0, `${name}: another world's pin came here`);

  // One pinned who leaves the seat, with the bar open: forged under a name that no longer holds it.
  const rulerRef = (await barSeen()).chips.find((c) => c.ref.startsWith("rule:"))?.ref;
  if (rulerRef) {
    await k(`globalThis.causalis.barPins.toggle(${JSON.stringify(rulerRef)}, "Someone Before")`);
    await until(
      "one who left the seat",
      async () => (await barSeen()).chips.some((c) => /Someone Before/.test(c.words)),
      slow(10000),
    );
    const left = (await barSeen()).chips.find((c) => /Someone Before/.test(c.words))!;
    say(`${name}: one who left the seat: ${left.words.replace(/\s+/g, " ")}`);
    check(/No longer rules/.test(left.words), `${name}: one who left: ${left.words}`);
    await shot(`${name}-left-seat`);
    await press(`.people-chip[data-key="${left.key}"] .people-open`, "one who left the seat");
    await until("how it passed", async () => ((await pageNow()) ?? "").startsWith("ev:"));
    await closePage();
    await k(`globalThis.causalis.barPins.off(${JSON.stringify(rulerRef)})`);
    await page.waitForTimeout(slow(1000));
  }

  // A swipe along the row with a real finger: it moves, and opens nothing.
  const along = await k<{ x0: number; x1: number; y: number } | null>(`(() => {
    const r = document.querySelector(".people-row");
    if (!r || r.scrollWidth <= r.clientWidth + 4) return null;
    r.scrollLeft = 0;
    const b = r.getBoundingClientRect();
    return { x0: b.right - 12, x1: b.left + 12, y: b.y + b.height / 2 };
  })()`);
  if (along) {
    const cdp = await context.newCDPSession(page),
      finger = (x: number) => [{ x, y: along.y, id: 1 }];
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: finger(along.x0),
    });
    for (let i = 1; i <= 10; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: finger(along.x0 + ((along.x1 - along.x0) * i) / 10),
      });
      await page.waitForTimeout(16);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(slow(500));
    const went = await k<number>(`document.querySelector(".people-row").scrollLeft`);
    say(`${name}: a swipe along the bar moved it ${Math.round(went)} px`);
    check(went > 20, `${name}: a swipe along the people bar moved it ${went} px`);
    check((await pageNow()) === null, `${name}: a swipe along the bar opened a page`);
    await k(`document.querySelector(".people-row").scrollLeft = 0`);
    await cdp.detach();
  }

  // Fold, by touch: the row goes, the button stays; and back.
  const s0 = await barSeen();
  if (s0.fold) {
    await page.touchscreen.tap(s0.fold.x, s0.fold.y);
    await page.waitForTimeout(slow(300));
    const s1 = await barSeen();
    check(
      s1.chips.every((c) => c.h === 0) && !!s1.fold,
      `${name}: folding left ${s1.chips.filter((c) => c.h > 0).length} chips`,
    );
    await shot(`${name}-folded`);
    await page.touchscreen.tap(s1.fold!.x, s1.fold!.y);
    await page.waitForTimeout(slow(300));
    check(
      (await barSeen()).chips.some((c) => c.h > 0),
      `${name}: it did not open again`,
    );
  } else problems.push(`${name}: no fold button`);

  // 5. At star scale: over nothing, and read off the world still.
  await k(`globalThis.causalis.closePage?.()`);
  for (let i = 0; i < 4; i++) {
    const was = await k<string>("globalThis.causalis.scale()");
    if (was === "galaxy" || was === "cluster") break;
    await k(`globalThis.causalis.zoomThrough?.("out")`).catch(() => undefined);
    await page.waitForTimeout(slow(1500));
    const now = await k<string>("globalThis.causalis.scale()");
    say(`${name}: out to ${now}`);
    if (now !== "village" && now !== "region") {
      await page.waitForTimeout(slow(1800));
      // (A star's card has the foot of a phone: the bar gives way to it, and comes back when it is put by.)
      if (now !== "globe") {
        await barGone(`${name}, under a ${now}'s card`);
        await k(
          `document.querySelector("#hud > .panel:not([hidden]) > .inspector:not([hidden]) .close")?.click()`,
        );
        await page.waitForTimeout(slow(600));
      }
      if (now === "cluster" || now === "galaxy") {
        // (On a phone the foot of the stars' map is its legend's.)
        await page.waitForTimeout(slow(1200));
        await barGone(`${name}, at the ${now}`);
        await shot(`${name}-${now}-aside`);
        const back = await k<boolean>(`(async () => {
          await globalThis.causalis.zoomThrough?.("in");
          await new Promise((r) => setTimeout(r, ${slow(2400)}));
          return !document.querySelector(".people-bar").classList.contains("aside");
        })()`);
        check(back, `${name}: the bar did not come back on the way down from the ${now}`);
      } else if (
        (await k<boolean>(
          `!!document.querySelector("#hud > .panel:not([hidden]) > .inspector:not([hidden], .page-window)")`,
        )) === false
      )
        await barWell(`${name}-${now}`);
    }
  }
  check(!errors.length, `${name}: errors: ${errors.slice(0, 3).join(" | ")}`);

  // 6. One press writes the history out.
  await k(`globalThis.causalis.open("world:chronicle#years")`);
  await until("The Years", async () => /something told|Nothing/.test(await pageText()));
  await page.waitForTimeout(slow(600));
  await k(
    `(() => { globalThis.__long = 0; globalThis.__far = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) globalThis.__long = Math.max(globalThis.__long, e.duration); }).observe({ entryTypes: ["longtask"] }); } catch {} })()`,
  );
  const t0 = Date.now();
  await press(".written-go", "📜 Write the whole history out");
  const fars: string[] = [];
  const end = Date.now() + slow(180000);
  while (Date.now() < end) {
    const s = await k<{ says: string; far: number; keeps: number }>(`(() => {
      const f = document.querySelector(".written-fill");
      return { says: document.querySelector(".written-says")?.innerText ?? "", far: f ? f.getBoundingClientRect().width : 0, keeps: document.querySelectorAll(".written-keep").length };
    })()`);
    if (s.says && fars.at(-1) !== s.says) fars.push(s.says);
    if (s.keeps >= 2) break;
    await page.waitForTimeout(60);
  }
  const ms = Date.now() - t0,
    long = await k<number>("globalThis.__long");
  check(
    fars.length >= 3 || f.seed === "first light",
    `${name}: how far along it is was not said: ${fars.join(" / ")}`,
  );
  say(
    `${name}, the file: ${ms} ms; the page's thread stood at most ${Math.round(long)} ms; said along the way: ${fars.slice(0, 2).join(" / ")} … ${fars.at(-1)}`,
  );
  check(long < 700, `${name}: the page's thread stood ${Math.round(long)} ms writing it`);
  await shot(`${name}-written`);
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: slow(30000) }),
    press(".written-keep", "⤓ The page"),
  ]);
  const out = shots ?? join(root, "dist");
  const path = join(out, `${name}-history.html`);
  await download.saveAs(path);
  const html = readFileSync(path, "utf8");
  say(`${name}: kept as ${download.suggestedFilename()}, ${(html.length / 1e6).toFixed(2)} MB`);
  check(html.length < 12e6, `${name}: the file is ${(html.length / 1e6).toFixed(1)} MB`);
  check(!/<script|src=|https?:|url\(/.test(html), `${name}: the file reaches outside itself`);
  const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]!)),
    hrefs = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]!),
    broken = hrefs.filter((h) => !ids.has(h));
  check(
    !broken.length,
    `${name}: ${broken.length} of the file's links lead nowhere: ${broken.slice(0, 3).join(", ")}`,
  );
  check(hrefs.length > 5, `${name}: only ${hrefs.length} links in the file`);
  // In a fresh browser, with no network, read off the screen.
  const fresh = await browser.newContext({
    viewport: { width: 430, height: 932 },
    hasTouch: true,
    isMobile: true,
  });
  await fresh.setOffline(true);
  const reader = await fresh.newPage(),
    asked: string[] = [];
  reader.on("request", (r) => {
    if (!r.url().startsWith("file:")) asked.push(r.url());
  });
  await reader.goto(pathToFileURL(path).href);
  const seenWords = await reader.evaluate(() => document.body.innerText);
  check(!asked.length, `${name}: the file asked the network for ${asked[0]}`);
  check(/What was left out/i.test(seenWords), `${name}: the file does not say what it left out`);
  check(/Realms and their rulers/i.test(seenWords), `${name}: no realms in it`);
  check(!BAD.test(seenWords), `${name}: a broken word in the file: ${BAD.exec(seenWords)?.[0]}`);
  const wide = await reader.evaluate(() => document.documentElement.scrollWidth);
  check(wide <= 431, `${name}: the file's page is ${wide} wide on a phone`);
  if (hrefs[0]) {
    const box = await reader.evaluate(
      (to) => {
        const a = document.querySelector(`a[href="#${to}"]`)!;
        a.scrollIntoView({ block: "center" });
        // (A link that wraps: the middle of its first line, not of the box around both.)
        const r = a.getClientRects()[0]!;
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      },
      hrefs.find((h) => h !== "realms" && h !== "wars" && h !== "people" && h !== "years") ??
        hrefs[0]!,
    );
    await reader.touchscreen.tap(box.x, box.y);
    await reader.waitForTimeout(300);
    check(/#./.test(reader.url()), `${name}: a link in the file went nowhere: ${reader.url()}`);
    if (shots) await reader.screenshot({ path: join(shots, `${name}-file.png`) });
  }
  say(`${name}, the file reads: ${seenWords.replace(/\s+/g, " ").slice(0, 300)}`);
  await fresh.close();
  // Safari's engine, where it is here: the same file with no network.
  if (!ci) {
    try {
      const wk = await webkit.launch();
      const ctx = await wk.newContext();
      const p = await ctx.newPage();
      await p.setContent(html);
      const words = await p.evaluate(() => document.body.innerText);
      check(/Realms and their rulers/i.test(words), `${name}: WebKit read: ${words.slice(0, 100)}`);
      say(`${name}: WebKit read the file, ${words.length.toLocaleString("en-US")} characters`);
      await wk.close();
    } catch (error) {
      say(`${name}: no WebKit here (${(error as Error).message.slice(0, 80)})`);
    }
  }
  await closePage();
  const after = JSON.stringify(await ask<unknown>("hashes"));
  check(before === after, `${name}: reading moved history`);
  say(`${name}: hashes ${before === after ? "the same" : "MOVED"}`);
  void world;
}

/** Stands aside in a possession, a life and a reign, by what really enters them. */
async function aside(name: string, town: string, realm: string): Promise<void> {
  await k(`globalThis.causalis.goTo(${JSON.stringify(town)})`);
  await until(
    "the town",
    () =>
      k<boolean>(
        `globalThis.causalis.scale() === "village" && globalThis.causalis.planNow()?.ref === ${JSON.stringify(town)}`,
      ),
    slow(60000),
  );
  await page.waitForTimeout(slow(800));
  // A reign, from the realm's leaders tab by touch.
  await k(`globalThis.causalis.open(${JSON.stringify(`${realm}#leaders`)})`);
  await until(
    "the leaders tab",
    () => k<boolean>(`!!document.querySelector(".leader-rule")`),
    slow(60000),
  );
  await page.waitForTimeout(slow(300));
  await press(".leader-rule", "👑 Rule as them");
  await until(
    "the ruling bar",
    () => k<boolean>(`!!document.querySelector(".reign-strip")`),
    slow(120000),
  );
  await page.waitForTimeout(slow(800));
  await barGone(`${name}, in a reign`);
  await shot(`${name}-ruling`);
  await press(".reign-letgo", "let go of the reign");
  await until(
    "let go",
    () => k<boolean>(`!document.body.classList.contains("ruling")`),
    slow(60000),
  );
  await page.waitForTimeout(slow(800));
  // (Walking in the ruler, as their chip does.)
  const ruled = await k<string | null>(
    `globalThis.causalis.leaders.home ? (async () => { const list = await globalThis.causalis.client.query({ type: "leaders.of", args: { realm: ${JSON.stringify(realm)} } }); await globalThis.causalis.leaders.home(list.leaders[0]); await new Promise((r) => setTimeout(r, ${slow(800)})); return await globalThis.causalis.leaders.possess(); })() : "no leaders"`,
  );
  check(!ruled, `${name}: could not walk in the ruler: ${ruled}`);
  await until(
    "possessing",
    () => k<boolean>(`document.body.classList.contains("possessing")`),
    slow(40000),
  );
  await page.waitForTimeout(slow(600));
  await barGone(`${name}, possessed`);
  await shot(`${name}-possessing`);
  // In a possession, the bar's place is not read.
  const reads0 = await k<number>("globalThis.causalis.peopleBar.reads");
  await page.waitForTimeout(slow(2500));
  check(
    (await k<number>("globalThis.causalis.peopleBar.reads")) === reads0,
    `${name}: the bar was read during a possession`,
  );
  await press(".possess-live", "🏠 Live as them");
  await until(
    "their life",
    () => k<boolean>(`document.body.classList.contains("living")`),
    slow(40000),
  );
  await page.waitForTimeout(slow(600));
  await barGone(`${name}, in a life`);
  await shot(`${name}-living`);
  check(!errors.length, `${name}: errors in a life: ${errors.slice(0, 3).join(" | ")}`);
}

try {
  const young = !saveFile;
  if (saveFile) {
    const w = fromFile(saveFile, saveUniverse),
      f = pack(w, saveUniverse),
      name = "far";
    tally(w, name);
    await walk(w, f, name);
    const seat = politiesOf(w)
      .living()
      .map((r) => ({ r, t: populationContext(w).settlements.seenIn(r.seat)[0] }))
      .find((x) => x.t);
    if (seat) await aside(name, seat.t!.ref, seat.r.ref);
    for (const [file, tag] of [
      [waterFile, "water"],
      [noGripFile, "nogrip"],
    ] as const) {
      if (!file) continue;
      const ww = fromFile(file, "alien");
      tally(ww, tag);
      await loadSave(pack(ww, "alien"));
      await page.waitForTimeout(slow(1500));
      await barWell(`${tag}-globe`);
      const t = populationContext(ww)
          .provinces.all()
          .filter((p) => p.total() > 0)[0],
        town = t ? populationContext(ww).settlements.seenIn(t.cell)[0] : undefined;
      if (town) {
        await k(`globalThis.causalis.goTo(${JSON.stringify(town.ref)})`);
        await until(
          `${tag}: its town`,
          () => k<boolean>(`globalThis.causalis.scale() === "village"`),
          slow(60000),
        );
        await page.waitForTimeout(slow(2500));
        const s = await barWell(`${tag}-town`),
          c = s.chips.find((x) => x.h > 0 && x.x <= innerW());
        if (c) {
          await press(`.people-chip[data-key="${c.key}"] .people-open`, `${tag}: a chip`);
          await until(`${tag}: their page`, async () => (await pageNow()) === c.ref);
          await page.waitForTimeout(slow(300));
          const words = await pageText();
          say(`${tag}: ${words.replace(/\s+/g, " ").slice(0, 300)}`);
          check(!BAD.test(words), `${tag}: a broken word on their page`);
          await shot(`${tag}-page`);
          await closePage();
        }
      }
    }
    // On a desk.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(slow(2500));
    await k(`globalThis.causalis.closePage?.()`);
    await barWell("desk");
    await page.setViewportSize({ width: 430, height: 932 });
  }
  if (young || ci) {
    // Year 40 with no realm, and a world with no people yet.
    const u = EARTH.build(seedFromText("first light")),
      w0 = u;
    const nobody = barOf(w0, { cell: null, town: null, pins: [], followed: [] });
    check(
      nobody.people.length === 0,
      `a world at its beginning has ${nobody.people.length} on the bar`,
    );
    say(`no people yet: ${nobody.people.length} on the bar`);
    await loadSave(pack(w0, "earth"));
    await page.waitForTimeout(slow(3000));
    await barGone("no people yet");
    w0.runTo(40 * YEAR);
    tally(w0, "young");
    const realms = politiesOf(w0).living().length;
    say(`year 40: ${realms} realms`);
    await walk(w0, pack(w0, "earth"), "young");
  }
} catch (error) {
  problems.push(`stopped: ${(error as Error).stack ?? error}`);
} finally {
  if (shots) writeFileSync(join(shots, "problems.txt"), problems.join("\n"));
  await browser.close();
  await server.close();
}
check(!errors.length, `errors: ${errors.slice(0, 4).join(" | ")}`);
if (problems.length) {
  console.log(`gate 96: ${problems.length} problem(s):`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("gate 96: passed");
process.exit(0);
