// node tools/alliances-gate.ts [--ci] [--soft] [--shots dir] [--seed text] [--year n]: gate 105, every alliance at once (asked 2026-11-11: "did you do the
// leagues view where i can see all the nations generally who are cliqued up or wtv like not just when im clicked on a country"):
//   1. the rule, pure: the alliances' colours far apart, none the grey of those who stand alone;
//   2. by real touch at 430 by 932, on a world the app runs itself (first light, year 450): the alliances lens chosen, no realm open, and more than one
//      alliance's colour seen in the pixels at once (counted against the same view under the land lens, so the sea and the land's own are not counted);
//      its key naming them; a land of each of several alliances pressed, that alliance's page (asked again: "why cant i analyze any other blocs?"); one in the
//      key pressed, its page; every alliance listed, and a realm of one pressed, its page; the realm page's way back to the list;
//      the lens in the land; no page errors, nothing wider than the screen.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium } from "playwright";
import { ALLIANCE_COLORS, ALONE_COLOR } from "../src/host/inspect/ties.ts";

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
console.log("gate 105, every alliance at once");

type Rgb = readonly [number, number, number];
/** A colour as its hue's direction: its channels over its brightest (lit or shaded, the same). */
const norm = (c: Rgb): Rgb => {
  const m = Math.max(c[0], c[1], c[2], 1e-6);
  return [c[0] / m, c[1] / m, c[2] / m];
};
const apart = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// 1. The rule, pure.
{
  let nearest = Infinity;
  for (let i = 0; i < ALLIANCE_COLORS.length; i++)
    for (let j = i + 1; j < ALLIANCE_COLORS.length; j++)
      nearest = Math.min(nearest, apart(ALLIANCE_COLORS[i]!, ALLIANCE_COLORS[j]!));
  say(`${ALLIANCE_COLORS.length} colours, the nearest two ${nearest.toFixed(2)} apart`);
  check(nearest > 0.25, `two alliances' colours are ${nearest.toFixed(2)} apart: too alike`);
  for (const c of ALLIANCE_COLORS)
    check(
      apart(c, ALONE_COLOR) > 0.3,
      `an alliance's colour ${c.join(",")} is as dim as one alone`,
    );
}

// 2. By real touch.
const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4305, strictPort: false } }),
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
type At = { x: number; y: number; w: number; h: number; under: string | null };
/** The middle of the first of them shown that a text matches, and what lies over it there. */
const centre = (sel: string, text = "") =>
  k<At | null>(`(() => {
    for (const e of document.querySelectorAll(${JSON.stringify(sel)})) {
      if (${JSON.stringify(text)} && !e.innerText.startsWith(${JSON.stringify(text)})) continue;
      e.scrollIntoView({ block: "center", inline: "center" });
      const r = e.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) continue;
      const x = r.left + Math.min(r.width / 2, 40), y = r.top + r.height / 2, top = document.elementFromPoint(x, y);
      return { x, y, w: r.width, h: r.height, under: top && (e === top || e.contains(top)) ? null : String(top ? top.className || top.tagName : "nothing") };
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
const words = (sel: string) =>
  k<string>(`(() => {
    for (const e of document.querySelectorAll(${JSON.stringify(sel)})) {
      const r = e.getBoundingClientRect();
      if (r.height > 0 && r.width > 0) return e.innerText;
    }
    return "";
  })()`);
const fits = () => k<boolean>("document.documentElement.scrollWidth <= 431");
const pageNow = () => k<string | null>("globalThis.causalis.pageOpen() ?? null");
const pageText = () => words(".page-window");
const BAD = /undefined|NaN|\[object|\bnull\b|\b(ev|pol|war|cell|town|bloc):\d/;
type Key = {
  ref: string;
  name: string;
  town: string;
  color: Rgb;
  realms: number;
  centre: number | null;
  seat: number | null;
};
const lensRead = () =>
  k<{ alliances: Key[]; lands: [number, Rgb][]; allied: [number, string][] }>(
    `globalThis.causalis.client.query({ type: "blocs.lens" })`,
  );
/** The canvas alone, the HUD put by for the moment: a PNG, in base 64. */
const canvasShot = async (): Promise<string> => {
  await k(`document.getElementById("hud")?.style.setProperty("visibility", "hidden")`);
  await settle(300);
  const png = (await page.screenshot()).toString("base64");
  await k(`document.getElementById("hud")?.style.removeProperty("visibility")`);
  return png;
};
/**
 * How many pixels of a shot are near each colour, by its hue's direction (a lit or shaded land the
 * same), and painted by the lens: unlike the same pixel in `base`, the view without it (so the land's
 * own greens and the sea are not counted). In CSS pixels.
 */
const colourCounts = (
  png: string,
  base: string,
  colors: readonly Rgb[],
  within = 0.13,
): Promise<number[]> =>
  page.evaluate(
    async ([data, before, cs, near]) => {
      const load = async (d: string) => {
          const bm = await createImageBitmap(
              await (await fetch(`data:image/png;base64,${d}`)).blob(),
            ),
            c = new OffscreenCanvas(bm.width, bm.height),
            x = c.getContext("2d")!;
          x.drawImage(bm, 0, 0);
          return { px: x.getImageData(0, 0, bm.width, bm.height).data, w: bm.width };
        },
        A = await load(data as string),
        B = await load(before as string),
        px = A.px,
        was = B.px,
        k = A.w / innerWidth,
        targets = (cs as number[][]).map((t) => {
          const m = Math.max(t[0]!, t[1]!, t[2]!);
          return [t[0]! / m, t[1]! / m, t[2]! / m];
        }),
        out = targets.map(() => 0);
      for (let i = 0; i < px.length && i < was.length; i += 4) {
        const r = px[i]! / 255,
          g = px[i + 1]! / 255,
          b = px[i + 2]! / 255,
          m = Math.max(r, g, b);
        // (Too dark to tell a colour by; or as it was without the lens.)
        if (m < 0.18) continue;
        if (Math.hypot(r - was[i]! / 255, g - was[i + 1]! / 255, b - was[i + 2]! / 255) < 0.12)
          continue;
        let best = -1,
          bestD = near as number;
        for (let t = 0; t < targets.length; t++) {
          const n = targets[t]!,
            d = Math.hypot(r / m - n[0]!, g / m - n[1]!, b / m - n[2]!);
          if (d < bestD) {
            bestD = d;
            best = t;
          }
        }
        if (best >= 0) out[best]!++;
      }
      return out.map((n) => n / (k * k));
    },
    [png, base, colors.map((c) => [...c]), within] as const,
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
// (What the run came to, put by: it lies over the globe.)
if (await centre(".ran-close")) await tap(".ran-close", "the run's note's ×");
await shot("0-globe");
const read = await lensRead();
say(
  `${read.alliances.length} alliances: ${read.alliances.map((a) => `${a.town} ${a.realms}`).join(", ")}`,
);
check(read.alliances.length >= 2, `only ${read.alliances.length} alliances in this world`);
// The view under the land lens first (its pixels near each alliance's colour are the sea's and the land's own), then the alliances lens's.
const shown = read.alliances.slice(0, ALLIANCE_COLORS.length);
const barOpen = () => k<boolean>("document.body.classList.contains('bar-open')");
const lensButton = async (name: string) => {
  const sel = `.mapmodes .mode[aria-label="${name}"]`;
  if (!(await centre(sel)) && (await centre(".bar-fold"))) await tap(".bar-fold", "the bar's ☰");
  await tap(sel, `the ${name} lens`);
  if (await barOpen()) await tap(".bar-fold", "the bar's ☰, to fold it");
};
// (The globe faced to the greatest alliance, as a press on its key faces it: the lens itself never
// turns it, and choosing it must leave the camera where it was.)
{
  const top = read.alliances[0]!.centre;
  if (top !== null) await k(`globalThis.causalis.faceSpot(${top})`);
}
await settle(1500);
const camera = () =>
  k<{ yaw: number; pitch: number; distance: number }>(
    `(() => { const r = globalThis.causalis.rig; return { yaw: r.yaw, pitch: r.pitch, distance: r.distance }; })()`,
  );
const looked = await camera();
await lensButton("Alliances");
await until(
  "the alliances' key",
  async () => (await k<number>(`document.querySelectorAll(".alliance-key").length`)) >= 2,
);
await settle(2500);
{
  const now = await camera();
  check(
    Math.abs(now.yaw - looked.yaw) < 0.5 &&
      Math.abs(now.pitch - looked.pitch) < 0.5 &&
      Math.abs(now.distance - looked.distance) < 0.02,
    `choosing the Alliances lens moved the camera: ${JSON.stringify(looked)} to ${JSON.stringify(now)}`,
  );
}
await lensButton("Land");
await settle(1500);
const without = await canvasShot();
await lensButton("Alliances");
await until(
  "the alliances' key, again",
  async () => (await k<number>(`document.querySelectorAll(".alliance-key").length`)) >= 2,
);
await settle(2000);
check((await pageNow()) === null, `a page is open under the lens: ${await pageNow()}`);
const withLens = await colourCounts(
    await canvasShot(),
    without,
    shown.map((a) => a.color),
  ),
  // (An alliance seen: a few dozen pixels of its colour more than the land shows there of its own.)
  seenOf = shown.map((a, i) => ({ a, n: Math.round(withLens[i]!) })).filter((x) => x.n >= 40);
say(
  `alliances seen at once, with no realm open: ${seenOf.length} (${seenOf.map((x) => `${x.a.town} ${x.n} px`).join(", ")})`,
);
// (Two alliances of the same colour count once: the colours seen, not the list.)
const colours = new Set(seenOf.map((x) => x.a.color.join(",")));
check(colours.size >= 2, `only ${colours.size} alliance colour seen on the globe at once`);
await shot("1-lens");
// Its key.
{
  const keys = await k<string[]>(
    `[...document.querySelectorAll(".alliance-key")].map((b) => b.getAttribute("aria-label"))`,
  );
  say(`the key: ${keys.join(" | ")}`);
  check(
    keys.length === Math.min(4, read.alliances.length),
    `the key names ${keys.length} alliances`,
  );
  for (const a of read.alliances.slice(0, 3))
    check(
      keys.some((x) => x.startsWith(a.name)),
      `the key does not name ${a.name}`,
    );
  const legend = await words(".legend");
  check(!BAD.test(legend), `the key says ${BAD.exec(legend)?.[0]}`);
  check(await fits(), "the key is wider than the screen");
  if (shots)
    await page.screenshot({
      path: join(shots, "2-legend.png"),
      clip: { x: 0, y: 0, width: 430, height: 420 },
    });
}
// Any alliance's land pressed on the globe: its alliance's page (asked 2026-11-11: "why cant i analyze any other blocs? its only the greatest bloc it lets
// me see detail of"). Tried land by land, each where it shows on the globe and nothing lies over it; a town's mark there is passed by.
{
  const centres = new Map(
      (
        await k<{ cell: number; centre: number }[]>(
          `globalThis.causalis.client.query({ type: "people.map" })`,
        )
      ).map((p) => [p.cell, p.centre]),
    ),
    opened = new Set<string>();
  for (const [land, ref] of read.allied) {
    if (opened.has(ref) || opened.size >= 3) continue;
    const spot = centres.get(land);
    if (spot === undefined) continue;
    const at = await k<{ x: number; y: number } | null>(
      `globalThis.causalis.spotOnScreen(${spot})`,
    );
    if (!at || at.x < 10 || at.x > 420 || at.y < 10 || at.y > 922) continue;
    const bare = await k<boolean>(
      `document.elementFromPoint(${at.x}, ${at.y})?.tagName === "CANVAS"`,
    );
    if (!bare) continue;
    await page.touchscreen.tap(at.x, at.y);
    await settle(900);
    const now = await pageNow();
    if (now === ref) {
      opened.add(ref);
      if (opened.size === 1) await shot("2b-land-pressed");
    } else if (now?.startsWith("cell:") || now?.startsWith("spot:"))
      problems.push(`a land of ${ref} pressed opened ${now}, not its alliance`);
    await k("globalThis.causalis.closePage?.()");
    await settle(300);
  }
  say(`alliances opened by a press on their land: ${opened.size} (${[...opened].join(", ")})`);
  check(opened.size >= 2, `only ${opened.size} alliances opened by a press on their land`);
  check(
    [...opened].some((r) => r !== read.alliances[0]!.ref),
    "no alliance but the greatest opened by a press on its land",
  );
}
// One pressed in the key: its page.
{
  const a = read.alliances[0]!;
  await tap(`.alliance-key[data-ref="${a.ref}"]`, `${a.town} in the key`);
  await until("the alliance's page", async () => (await pageNow()) === a.ref);
  await until("who stands in it", async () => /Who stands in it/i.test(await pageText()));
  const text = await pageText();
  say(`its page: ${text.replace(/\s+/g, " ").slice(0, 260)}`);
  check(!BAD.test(text), `an alliance's page says ${BAD.exec(text)?.[0]}`);
  check(await fits(), "an alliance's page is wider than the screen");
  await settle(1200);
  await shot("3-alliance-page");
  await k("globalThis.causalis.closePage?.()");
  await settle(400);
}
// Every alliance listed; a realm of one pressed.
{
  await tap(".legend-action", "Every alliance");
  await until("the list", async () => (await pageNow()) === "world:alliances");
  await until("its alliances", async () => /By their people/i.test(await pageText()));
  const text = await pageText();
  say(`the list: ${text.replace(/\s+/g, " ").slice(0, 300)}`);
  for (const a of read.alliances)
    check(text.toLowerCase().includes(a.name.toLowerCase()), `the list leaves out ${a.name}`);
  check(!BAD.test(text), `the list says ${BAD.exec(text)?.[0]}`);
  check(await fits(), "the list is wider than the screen");
  await shot("4-list");
  await k(`document.querySelector(".page-window .entry")?.scrollIntoView({ block: "start" })`);
  await settle(400);
  await shot("4b-list-members");
  const second = await k<{ name: string; ref: string } | null>(
    `globalThis.causalis.client.query({ type: "page", args: { ref: ${JSON.stringify(read.alliances[0]!.ref)} } }).then((p) => { const it = p.tabs[0].blocks[0].items[1]; return it ? { name: it.line[0].text, ref: it.ref } : null; })`,
  );
  if (second) {
    await tap(".page-window .entry", `${second.name} on the list`, second.name);
    await until(`${second.name}'s page`, async () => (await pageNow()) === second.ref);
    const t = await pageText();
    say(`a member's page: ${t.replace(/\s+/g, " ").slice(0, 160)}`);
    await settle(800);
    await shot("5-member");
    // (Its Bonds tab: the way back to every alliance.)
    const at = await k<number>(
      `[...document.querySelectorAll(".page-window .tabs .tab")].findIndex((b) => b.textContent.includes("Bonds"))`,
    );
    check(at >= 0, "a member's page has no Bonds tab");
    if (at >= 0) {
      await tap(`.page-window .tabs .tab:nth-child(${at + 1})`, "the Bonds tab");
      await until("the Bonds tab", async () => /Stands with/i.test(await pageText()));
      check(
        (await pageText()).toLowerCase().includes(read.alliances[0]!.name.toLowerCase()),
        "a member's Bonds tab does not name its alliance",
      );
      await tap(
        ".page-window .ref-link",
        "Every alliance in the world",
        "Every alliance in the world",
      );
      await until(
        "the list from a realm's page",
        async () => (await pageNow()) === "world:alliances",
      );
    }
  } else problems.push("the greatest alliance lists no realm");
  await k("globalThis.causalis.closePage?.()");
  await settle(400);
}
// The lens in the land: the greatest alliance not green or yellow (the ground's own colours) at its head's seat, its colour on the ground.
{
  const a =
      read.alliances.find((x) => x.color[1] < Math.max(x.color[0], x.color[2]) - 0.1) ??
      read.alliances[0]!,
    land = a.seat;
  if (land !== undefined && land !== null) {
    await k(`globalThis.causalis.descend(${land})`);
    await until(
      "the land",
      () => k<boolean>(`globalThis.causalis.scale() === "region"`),
      slow(60000),
    );
    await settle(4000);
    // (The land under its own lens, then the alliances': lit, hazed by the air, so a looser match.)
    const regionLens = (name: string) =>
      tap(".panel:not([hidden]) .speeds .speed", `the land's ${name} lens`, name);
    await regionLens("Land");
    await settle(2500);
    const bare = await canvasShot();
    await regionLens("Alliances");
    await settle(2500);
    const n = (await colourCounts(await canvasShot(), bare, [a.color], 0.3))[0]!;
    say(
      `in the land of ${a.town}'s alliance: ${Math.round(n)} px of its colour, painted by the lens`,
    );
    check(n > 400, `the alliance's colour is not seen in its land (${Math.round(n)} px)`);
    await shot("6-land");
  } else problems.push("no land of the greatest alliance to go to");
}
for (const e of errors.slice(0, 5)) say(`ERROR ${e.slice(0, 300)}`);
check(errors.length === 0, `${errors.length} errors on the page`);
await browser.close();
await server.close();
if (problems.length) {
  console.log(`gate 105 FAILED:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("gate 105 passed");
