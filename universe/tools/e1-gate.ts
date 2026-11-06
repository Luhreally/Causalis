// node tools/e1-gate.ts [--ci] [--soft] [--shots dir] [--save file.save --universe earth|alien] [--seed text --universe earth|alien]: gate 99, a living ecology through history (E1), at a phone's size, by real touch.
// On a far save, else (as on CI) a young world run on:
//   1. off the world: an old save loads with it all empty and runs on; woods move for more than one reason; every turn's words and a land's page read aloud clean; a lode at its eve gives out, its town told; the same world saved and loaded says the same;
//   2. the same land before and after, on the Forest lens pressed by touch: its legend on the screen, its colour in the pixels differs;
//   3. the land's page, opened and read off the real screen: what its woods were and came to, and what did it; the mine's line on the land's page and its town's;
//   4. the land itself: the same land before and after, its green in the pixels differs.
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync, inflateSync } from "node:zlib";
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
import { ALIEN, EARTH } from "../src/host/planet.ts";
import {
  digMeans,
  homePlanet,
  lodesOf,
  populationContext,
  woodsOf,
  woodsRead,
} from "../src/sim/index.ts";
import { LODE, lodeSize } from "../src/rules/index.ts";
import { oresIn } from "../src/sim/index.ts";
import { why } from "../src/causal/index.ts";
import { pageOf } from "../src/host/inspect/index.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  shots = arg("--shots"),
  saveFile = arg("--save"),
  seedText = arg("--seed"),
  eveFile = arg("--eve"),
  universe = (arg("--universe") ?? "alien") as "earth" | "alien";
if (shots) mkdirSync(shots, { recursive: true });
const slow = (ms: number) => (ci || soft ? ms * 4 : ms),
  problems: string[] = [],
  check = (ok: boolean, what: string) => {
    if (!ok) problems.push(what);
  },
  say = (s: string) => console.log(`  ${s}`);
console.log("gate 99, a living ecology through history");

const BAD = /undefined|NaN|\[object|\bnull\b|\b(ev|pol|town|war|cell):\d/;
const u = saveFile || seedText ? universe : "earth",
  U = u === "earth" ? EARTH : ALIEN;
const open = (file: string): World => {
  const doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8"));
  return loadWorld(doc, (s) => U.build(s), rulesetId(U.build(seedFromText(doc.seed)), U.version), {
    allowRulesetChange: true,
  }).world;
};
const world: World = saveFile ? open(saveFile) : U.build(seedFromText(seedText ?? "first light")),
  ctx = populationContext(world),
  g = homePlanet(world).generated,
  from = Math.floor(world.now / YEAR);
const pack = (w: World) => ({
  bytes: gzipSync(JSON.stringify(saveWorld(w, rulesetId(w, U.version), { universe: U.name }))),
  seed: w.seed.text,
});

// An old save has none of this: it loads empty, and goes on.
check(woodsOf(world)?.begun === false, "a world came with its woods begun");
check(lodesOf(world)?.dormant() === true, "a world came with lodes dug");
if (saveFile) {
  const before = woodsRead(ctx, 0);
  check(Number.isFinite(before.now), "a land's woods are no number on an old save");
}

const nowOf = () => {
  const m = new Map<number, number>();
  for (let c = 0; c < g.offworld.base; c++) m.set(c, woodsRead(ctx, c).now);
  return m;
};
// A first run on, to begin the woods, and the land as it stood then.
const span = saveFile ? 200 : 120;
world.runTo((from + 1) * YEAR);
const firstForge = pack(world),
  woods0 = nowOf();
for (let y = from + 2; y <= from + span; y++) world.runTo(y * YEAR);
const woods = woodsOf(world)!,
  woods1 = nowOf();
const moved = [...woods1].map(([c, v]) => ({ c, d: v - (woods0.get(c) ?? 0) }));
const reasons = Object.entries(woods.tally).filter(([, n]) => n > 0);
say(`after ${span} years: ${reasons.map(([w, n]) => `${w} ${n}`).join(", ")}`);
const movedFar = moved.filter((m) => Math.abs(m.d) >= 0.1).length;
say(`${movedFar} lands moved a tenth or more`);
if (ctx.medium !== "water") {
  check(movedFar >= 5, `only ${movedFar} lands' woods moved a tenth in ${span} years`);
  check(reasons.length >= 2, `woods moved for only ${reasons.length} reason`);
}

// Every turn's words, and a land's page, read aloud.
const turnsEv = world.events.all().filter((e) => e.type === "ecology.woods-turn");
say(`${turnsEv.length} woods-turn events`);
for (const e of turnsEv.slice(-40)) {
  const line = why(world, e.id).claim;
  check(!BAD.test(String(line)), `a turn's words: ${line}`);
}
if (turnsEv[0]) say(`said: ${why(world, turnsEv.at(-1)!.id).claim}`);

// A land that moved, its woods read: the most moved, of those no one lives on if one moved far enough (nothing but its woods differs there).
const ours = moved
    .filter(
      (m) =>
        g.centre[m.c]! >= 0 &&
        (g.tectonics.elevation[m.c]! > 0 ? ctx.medium !== "water" : ctx.medium === "water"),
    )
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d) || a.c - b.c),
  peopled = ours,
  empty = ours.filter((m) => !ctx.provinces.get(m.c)?.total() && Math.abs(m.d) >= 0.15),
  watched = empty[0] ?? ours[0],
  land = watched?.c ?? 0,
  moves = watched?.d ?? 0;
say(
  `the land to watch: ${land}, moved ${(moves * 100).toFixed(0)} in a hundred; ${peopled.length} peopled, ${peopled.filter((m) => woodsRead(ctx, m.c).first > 0.02).length} with woods at first; ${lodesOf(world)!.all().length} lodes dug`,
);

// A lode at its eve: a land whose means reach no deeper, whose people dig it this year.
const lodes = lodesOf(world)!;
let eve: { cell: number; kind: string } | null = null;
for (const l of lodes.all()) {
  const p = ctx.provinces.get(l.cell);
  if (!p || p.total() < 100 || l.out !== null || !ctx.settlements.seenIn(l.cell).length) continue;
  // (Machines that think sort its heaps for ever: nothing gives out under them.)
  const means = digMeans(ctx, l.cell);
  if (means >= 2) continue;
  let near = means;
  for (let k = g.grid.offsets[l.cell]!; k < g.grid.offsets[l.cell + 1]!; k++) {
    const n = g.grid.neighbours[k]!;
    if (ctx.provinces.get(n)) near = Math.max(near, digMeans(ctx, n));
  }
  if (near >= 2) continue;
  l.tier = Math.max(l.tier, near);
  eve = { cell: l.cell, kind: l.kind };
  break;
}
let lodeLand: number | null = null,
  town: string | null = null,
  townName = "";
if (eve) {
  const l = lodes.get(eve.cell, eve.kind)!,
    size = lodeSize(
      eve.kind,
      Math.max(0, ...oresIn(ctx, eve.cell, eve.kind).map((o) => o.richness)),
    ),
    limit = size * LODE.depths[l.tier]!;
  l.dug = Math.max(l.dug, limit - 1);
  const was = lodes.tally.out;
  world.runTo((from + span + 2) * YEAR);
  check(
    lodes.tally.out > was,
    `a lode at its eve did not give out: ${eve.kind} of land ${eve.cell}`,
  );
  const done = lodes.get(eve.cell, eve.kind)!;
  check(done.out !== null, "the lode is not marked done");
  if (done.ref) {
    const said = String(why(world, done.ref).claim ?? "");
    say(`said: ${said}`);
    check(/gave out in year/.test(said) && !BAD.test(said), `its words: ${said}`);
  }
  lodeLand = eve.cell;
  const s = ctx.settlements.seenIn(eve.cell)[0]!;
  town = s.ref;
  townName = s.name;
  say(`a mine given out: the ${eve.kind} of land ${eve.cell}, at ${townName}`);
} else say("no lode dug yet at its people's depth (a young world, or machines that think)");

// Pages, node side.
const textOf = (ref: string) => JSON.stringify(pageOf(world, ref)).replace(/"ref":"[^"]*"/g, "");
const landText = textOf(`cell:0:${land}`);
check(!/undefined|NaN/.test(landText), `the land's page: ${landText.slice(0, 200)}`);
check(
  /of the land/.test(landText) || woodsRead(ctx, land).first === 0,
  "its page says nothing of its woods",
);
if (lodeLand !== null) {
  const t = textOf(`cell:0:${lodeLand}`);
  check(/gave out in year/.test(t), "the land's page does not say its lode gave out");
  check(/gave out in year/.test(textOf(town!)), "the town's page does not say its lode gave out");
}
// Saved and loaded, it says the same.
const packed = pack(world),
  again = loadWorld(
    JSON.parse(gunzipSync(packed.bytes).toString("utf8")),
    (s) => U.build(s),
    rulesetId(world, U.version),
    { allowRulesetChange: true },
  ).world;
check(
  JSON.stringify(woodsOf(again)!.save()) === JSON.stringify(woods.save()),
  "its woods came back different from a save",
);
check(
  JSON.stringify(lodesOf(again)!.save()) === JSON.stringify(lodes.save()),
  "its lodes came back different from a save",
);
say(`the save: ${Math.round(packed.bytes.length / 1024)} KB`);

// The screen.
const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4299, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!,
  GPU = [
    "--enable-gpu",
    "--ignore-gpu-blocklist",
    "--use-angle=d3d11",
    "--force_high_performance_gpu",
  ],
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  });
const browserContext = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
  }),
  page: Page = await browserContext.newPage(),
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
const shot = async (name: string) => {
  const b = await page.screenshot(shots ? { path: join(shots, `${name}.png`) } : {});
  return b;
};
async function loadSave(f: { bytes: Buffer; seed: string }) {
  const name = `${u}:gate99`,
    q = `universe=${u}&seed=${encodeURIComponent(f.seed)}`;
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
  await page.waitForTimeout(slow(800));
}
/** Press what is at a thing's real place on the phone: on the screen, and the thing a finger there would touch. */
async function press(selector: string, what: string): Promise<boolean> {
  const at = await k<{
    x: number;
    y: number;
    w: number;
    h: number;
    top: boolean;
    over: string;
  } | null>(`(() => {
    const e = document.querySelector(${JSON.stringify(selector)});
    if (!e) return null;
    e.scrollIntoView({ block: "center", inline: "center" });
    const r = e.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return null;
    const x = r.x + r.width / 2, y = r.y + r.height / 2, at = document.elementFromPoint(x, y);
    return { x, y, w: r.width, h: r.height, top: !!at && (at === e || e.contains(at)), over: at ? String(at.className || at.tagName) : "" };
  })()`);
  if (!at) {
    problems.push(`nothing to press: ${what}`);
    return false;
  }
  check(at.top, `${what} lies under ${at.over}`);
  await page.touchscreen.tap(at.x, at.y);
  await page.waitForTimeout(slow(400));
  return true;
}
/** The pixel at a place of a shot (8-bit RGB or RGBA, not interlaced): a little patch's mean. */
function decode(png: Buffer): {
  rows: Buffer;
  width: number;
  height: number;
  channels: number;
  stride: number;
} {
  let at = 8,
    width = 0,
    height = 0,
    channels = 0;
  const idat: Buffer[] = [];
  while (at + 12 <= png.length) {
    const size = png.readUInt32BE(at),
      type = png.toString("latin1", at + 4, at + 8),
      body = png.subarray(at + 8, at + 8 + size);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      channels = body[9] === 6 ? 4 : 3;
    } else if (type === "IDAT") idat.push(body);
    else if (type === "IEND") break;
    at += size + 12;
  }
  const raw = inflateSync(Buffer.concat(idat)),
    stride = width * channels,
    rows = Buffer.alloc(stride * height),
    paeth = (a: number, b: number, c: number) => {
      const p = a + b - c,
        pa = Math.abs(p - a),
        pb = Math.abs(p - b),
        pc = Math.abs(p - c);
      return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
    };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!,
      src = y * (stride + 1) + 1,
      dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? rows[dst + x - channels]! : 0,
        b = y > 0 ? rows[dst - stride + x]! : 0,
        c = x >= channels && y > 0 ? rows[dst - stride + x - channels]! : 0,
        predicted =
          filter === 0
            ? 0
            : filter === 1
              ? a
              : filter === 2
                ? b
                : filter === 3
                  ? (a + b) >> 1
                  : paeth(a, b, c);
      rows[dst + x] = (raw[src + x]! + predicted) & 255;
    }
  }
  return { rows, width, height, channels, stride };
}
function patch(png: Buffer, cx: number, cy: number, r = 3): [number, number, number] {
  const { rows, width, height, channels, stride } = decode(png);
  let r0 = 0,
    g0 = 0,
    b0 = 0,
    n = 0;
  for (let y = Math.max(0, Math.round(cy) - r); y <= Math.min(height - 1, Math.round(cy) + r); y++)
    for (
      let x = Math.max(0, Math.round(cx) - r);
      x <= Math.min(width - 1, Math.round(cx) + r);
      x++
    ) {
      const q = y * stride + x * channels;
      r0 += rows[q]!;
      g0 += rows[q + 1]!;
      b0 += rows[q + 2]!;
      n++;
    }
  return [r0 / n, g0 / n, b0 / n];
}
const centre = g.centre[land]!;
/** The share of two shots' pixels (of the middle of the screen, off the chrome) that differ to the eye. */
function differing(a: Buffer, b: Buffer, box?: [number, number, number, number]): number {
  const A = decode(a),
    B = decode(b);
  if (A.width !== B.width || A.height !== B.height) return 1;
  let n = 0,
    all = 0;
  const [x0, y0, x1, y1] = box ?? [
    0,
    Math.floor(A.height * 0.34),
    A.width,
    Math.floor(A.height * 0.84),
  ];
  for (let y = y0; y < y1; y += 2)
    for (let x = x0; x < x1; x += 2) {
      const p = y * A.stride + x * A.channels,
        q = y * B.stride + x * B.channels;
      all++;
      if (
        Math.abs(A.rows[p]! - B.rows[q]!) +
          Math.abs(A.rows[p + 1]! - B.rows[q + 1]!) +
          Math.abs(A.rows[p + 2]! - B.rows[q + 2]!) >
        36
      )
        n++;
    }
  return n / Math.max(1, all);
}
const forest = async (name: string): Promise<[number, number, number] | null> => {
  await press(".mapmodes .mode[aria-label='Forest']", "the Forest lens");
  const title = await k<string>(`(() => {
    const e = document.querySelector(".mapmodes .legend-title");
    return e && e.getBoundingClientRect().height > 0 ? e.textContent : "";
  })()`);
  check(title === "Forest", `the legend says "${title}"`);
  await page.waitForTimeout(slow(1200));
  // Turn to the land.
  await k(`globalThis.causalis.faceSpot?.(${centre})`);
  await page.waitForTimeout(slow(1500));
  const at = await k<{ x: number; y: number } | null>(
      `globalThis.causalis.spotOnScreen?.(${centre}) ?? null`,
    ),
    png = await shot(name);
  say(
    `${name}: the land's spot at ${at ? `${Math.round(at.x)}, ${Math.round(at.y)}` : "behind the world"}`,
  );
  return at ? patch(png as Buffer, at.x, at.y) : null;
};

/** The land itself: the same place, what is planted on it and how it looks. */
const standOn = async (name: string) => {
  await k(`globalThis.causalis.goTo("cell:0:${land}")`);
  await until(
    "the land",
    () => k<boolean>(`globalThis.causalis.scale() === "region"`),
    slow(60000),
  );
  await page.waitForTimeout(slow(1500));
  // (As the land is, not as the lens paints it: the land's own Land button, by touch.)
  const landButton = await k<{ x: number; y: number } | null>(`(() => {
    for (const b of document.querySelectorAll("button")) {
      const r = b.getBoundingClientRect();
      if (b.textContent.trim() === "Land" && r.width > 0 && r.height > 0 && r.y < 300) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    return null;
  })()`);
  if (landButton) await page.touchscreen.tap(landButton.x, landButton.y);
  else problems.push("the land's Land button is not on the screen");
  await page.waitForTimeout(slow(1500));
  const trees = await k<number>("globalThis.causalis.landTrees?.() ?? -1"),
    png = (await shot(name)) as Buffer;
  return { trees, png };
};
// Before.
await loadSave(firstForge);
const before = await forest("forest-before");
const landBefore = await standOn("land-before");
// After.
await loadSave(packed);
const after = await forest("forest-after");
const landAfter = await standOn("land-after");
{
  const share = differing(landBefore.png, landAfter.png);
  say(
    `the land itself: ${landBefore.trees} trees then ${landAfter.trees}; ${(share * 100).toFixed(1)}% of its pixels differ; its woods moved ${Math.round(moves * 100)} in a hundred`,
  );
  if (Math.abs(moves) >= 0.15 && ctx.medium !== "water") {
    check(landBefore.trees >= 0 && landAfter.trees >= 0, "a land's trees can't be read");
    check(
      moves > 0 ? landAfter.trees > landBefore.trees : landAfter.trees < landBefore.trees,
      `the land's woods moved ${Math.round(moves * 100)} in a hundred, and its trees went ${landBefore.trees} to ${landAfter.trees}`,
    );
    check(
      share >= 0.03,
      `the same land before and after: only ${(share * 100).toFixed(1)}% of its pixels differ`,
    );
  }
}
if (before && after) {
  const d =
    Math.abs(before[0] - after[0]) +
    Math.abs(before[1] - after[1]) +
    Math.abs(before[2] - after[2]);
  say(`its colour: ${before.map(Math.round)} then ${after.map(Math.round)} (${Math.round(d)})`);
  if (Math.abs(moves) >= 0.15 && ctx.medium !== "water")
    check(
      d >= 12,
      `the land moved ${Math.round(moves * 100)} in a hundred and its colour moved ${Math.round(d)}`,
    );
} else if (ctx.medium !== "water") problems.push("the land could not be seen on the globe");

// Pages, off the real screen.
const pageWords = () => k<string>(`document.querySelector(".page-window")?.innerText ?? ""`);
const openPage = async (ref: string, what: string) => {
  await k(`globalThis.causalis.pageWindowOpen(${JSON.stringify(ref)})`);
  await until(
    what,
    () =>
      k<boolean>(
        `(document.querySelector(".page-window")?.getBoundingClientRect().height ?? 0) > 40 && (document.querySelector(".page-window")?.innerText ?? "").length > 40`,
      ),
    slow(20000),
  );
  await page.waitForTimeout(slow(600));
};
const tapTab = async (label: string): Promise<boolean> => {
  const p = await k<{ x: number; y: number; top: boolean } | null>(`(() => {
    const e = [...document.querySelectorAll(".page-window .tabs .tab")].find((b) => b.textContent.includes(${JSON.stringify(label)}));
    if (!e) return null;
    e.scrollIntoView({ block: "nearest", inline: "center" });
    const r = e.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2, at = document.elementFromPoint(x, y);
    return { x, y, top: !!at && (at === e || e.contains(at)) };
  })()`);
  if (!p) return false;
  check(p.top, `the tab ${label} lies under something`);
  await page.touchscreen.tap(p.x, p.y);
  await page.waitForTimeout(slow(500));
  return true;
};
/** A link on the page by its words, pressed by touch at its real place. */
const tapLink = async (words: RegExp): Promise<boolean> => {
  const p = await k<{ x: number; y: number; top: boolean; text: string } | null>(`(() => {
    const re = new RegExp(${JSON.stringify(words.source)}, "i");
    for (const e of document.querySelectorAll(".page-window a, .page-window .link, .page-window button")) {
      const r0 = e.getBoundingClientRect();
      if (!(r0.width > 0 && r0.height > 0) || !re.test(e.textContent)) continue;
      e.scrollIntoView({ block: "center" });
      const r = e.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2, at = document.elementFromPoint(x, y);
      return { x, y, top: !!at && (at === e || e.contains(at)), text: e.textContent };
    }
    return null;
  })()`);
  if (!p) return false;
  check(p.top, `the link "${p.text}" lies under something`);
  await page.touchscreen.tap(p.x, p.y);
  await page.waitForTimeout(slow(800));
  return true;
};
{
  await openPage(`cell:0:${land}`, "the land's page");
  await tapTab("Life");
  const t = await pageWords();
  check(/of the land/.test(t), `the land's Life tab on the screen: ${t.slice(0, 300)}`);
  check(!BAD.test(t), `a broken word on the land's Life tab: ${t.slice(0, 300)}`);
  await shot("land-woods-page");
  const line = t.split("\n").filter((l) => /In year \d+ they/.test(l));
  say(
    `read off the land's page: ${
      line.slice(-2).join(" / ") ||
      t
        .split("\n")
        .filter((l) => /of the land/.test(l))
        .join(" / ")
    }`,
  );
  await k("globalThis.causalis.closePage?.()");
}
if (lodeLand !== null) {
  await openPage(`cell:0:${lodeLand}`, "the mine's land's page");
  await tapTab("Land");
  const t = await pageWords();
  check(/gave out in year/.test(t), `the land's page on the screen: ${t.slice(0, 300)}`);
  check(!BAD.test(t), `a broken word on the land's page: ${t.slice(0, 200)}`);
  await shot("land-mine");
  say(`read off the land's page: ${(t.match(/The [^.]*gave out in year[^\n]*/) ?? [""])[0]}`);
  await k("globalThis.causalis.closePage?.()");
  await openPage(town!, "the town's page");
  const w = await pageWords();
  let told = /gave out in year/.test(w);
  for (const tab of ["Now", "Life", "Overview"])
    if (!told && (await tapTab(tab))) told = /gave out in year/.test(await pageWords());
  check(told, `the town's page on the screen does not say so: ${w.slice(0, 300)}`);
  await shot("town-mine");
  say(
    `read off the town's page: ${((await pageWords()).match(/The [^.\n]*gave out in year[^\n]*/) ?? [""])[0]}`,
  );
  await k("globalThis.causalis.closePage?.()");
}
// A mine giving out by itself, watched: the day before, in its town, the clock let run as anyone's does.
if (eveFile) {
  const probe = open(eveFile),
    pc = populationContext(probe),
    was = new Set(
      lodesOf(probe)!
        .done()
        .map((l) => `${l.cell}:${l.kind}`),
    ),
    y0 = Math.floor(probe.now / YEAR);
  let gone: { cell: number; kind: string; ref: string | null } | null = null;
  for (let y = y0 + 1; y <= y0 + 6 && !gone; y++) {
    probe.runTo(y * YEAR);
    const l = lodesOf(probe)!
      .done()
      .find(
        (x) =>
          !was.has(`${x.cell}:${x.kind}`) &&
          pc.settlements.seenIn(x.cell).length &&
          // (A land still digging another lode still has its mine.)
          lodesOf(probe)!
            .all()
            .filter((o) => o.cell === x.cell)
            .every((o) => o.out !== null),
      );
    if (l) gone = { cell: l.cell, kind: l.kind, ref: l.ref };
  }
  check(!!gone, "the eve's save brought no mine to its end");
  if (gone) {
    const said = gone.ref ? String(why(probe, gone.ref as never).claim) : "";
    say(`by itself: ${said}`);
    check(/gave out in year/.test(said) && !BAD.test(said), `its words: ${said}`);
    const place = pc.settlements.seenIn(gone.cell)[0]!;
    const eve = readFileSync(eveFile),
      doc = JSON.parse(gunzipSync(eve).toString("utf8")) as { seed: string };
    await loadSave({ bytes: eve as Buffer, seed: doc.seed });
    await k(`globalThis.causalis.goTo(${JSON.stringify(place.ref)})`);
    await until(
      "the town",
      () =>
        k<boolean>(
          `globalThis.causalis.scale() === "village" && globalThis.causalis.planNow()?.ref === ${JSON.stringify(place.ref)}`,
        ),
      slow(90000),
    );
    await page.waitForTimeout(slow(1500));
    type MineNow = { x: number; z: number; spent?: boolean } | null;
    const mineNow = () => k<MineNow>("globalThis.causalis.planNow()?.works?.mine ?? null");
    const m0 = await mineNow();
    say(`the day before, at ${place.name}: its mine ${JSON.stringify(m0)}`);
    check(!m0?.spent, "its mine is done before it gave out");
    if (m0) await k(`globalThis.causalis.faceTown(${m0.x}, ${m0.z}, 110)`);
    await page.waitForTimeout(slow(1500));
    // (The same hour of the same day of the year, before and after: what differs is its mine, and not the sun.)
    const noon = 91 * 86400 + 12 * 3600,
      noonAfter = async () => {
        const { t } = await k<{ t: number }>("globalThis.causalis.client.advance(0)"),
          at = Math.floor(t / YEAR) * YEAR + noon;
        await k(`globalThis.causalis.client.advance(${at > t ? at : at + YEAR})`);
        await page.waitForTimeout(slow(2500));
        return k<string>(
          `document.querySelector("#hud")?.innerText.match(/year \\d+, day \\d+, \\d+:\\d+/)?.[0] ?? ""`,
        );
      };
    say(`its clock before: ${await noonAfter()}`);
    if (m0) await k(`globalThis.causalis.faceTown(${m0.x}, ${m0.z}, 110)`);
    await page.waitForTimeout(slow(1500));
    const pngBefore = (await shot("mine-before")) as Buffer;
    await k(`globalThis.causalis.client.setSpeed(${365 * 86400})`);
    const came = await until(
      "its mine's end, the clock running",
      async () => !!(await mineNow())?.spent,
      slow(120000),
    );
    await k("globalThis.causalis.client.setSpeed(0)");
    await page.waitForTimeout(slow(1500));
    const m1 = await mineNow();
    say(`after it gave out: its mine ${JSON.stringify(m1)}`);
    if (came && m1) {
      say(`its clock after: ${await noonAfter()}`);
      await k(`globalThis.causalis.faceTown(${m1.x}, ${m1.z}, 110)`);
      await page.waitForTimeout(slow(2000));
      const pngAfter = (await shot("mine-after")) as Buffer,
        share = differing(pngBefore, pngAfter),
        // (About the middle of the view, where it was turned to: a mine's own pixels are few among a whole town's.)
        near = differing(pngBefore, pngAfter, [215 - 80, 560 - 80, 215 + 80, 560 + 80]);
      say(
        `${(share * 100).toFixed(1)}% of the whole view differs, ${(near * 100).toFixed(1)}% about its mine`,
      );
      check(
        near > 0.01,
        `its mine gave out and only ${(near * 100).toFixed(2)}% of the pixels about it differ`,
      );
    }
    await openPage(place.ref, "the town's page after");
    const w = await pageWords();
    let told = /gave out in year/.test(w);
    for (const tab of ["Now", "Life", "Overview"])
      if (!told && (await tapTab(tab))) told = /gave out in year/.test(await pageWords());
    check(told, `the town's page after its mine gave out: ${w.slice(0, 300)}`);
    const text = await pageWords();
    say(
      `read off the town's page: ${(text.match(/The [^.\n]*gave out in year[^\n]*/) ?? [""])[0]}`,
    );
    await shot("mine-town-page");
    // A land named in that line, pressed by touch.
    const pressed = await tapLink(/'s land|land$/);
    if (pressed) {
      const at = await k<string>('String(globalThis.causalis.pageOpen() ?? "")');
      say(`a link pressed: ${at}`);
      check(at.startsWith("cell:") || at.length > 0, "a link pressed by touch went nowhere");
    }
    await k("globalThis.causalis.closePage?.()");
  }
}
if (errors.length) problems.push(`page errors: ${errors.slice(0, 3).join(" | ").slice(0, 600)}`);

await browser.close();
await new Promise<void>((done) => server.httpServer.close(() => done()));
if (problems.length) {
  console.error(`gate 99 FAILED:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log("gate 99 passed");
process.exit(0);
