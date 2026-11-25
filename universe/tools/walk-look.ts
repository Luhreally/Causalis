// A town's people seen moving (town mode): on a save given, at a phone's size and a desk's, the town entered and its
// day run to the morning, then watched at the pace given. Two things are taken. A track: for some seconds every frame
// the page draws, where each of its people stands (the town's own `place.personAt`), and from it what the eye calls
// not fluid, in numbers: how far the fastest goes in a frame, how a walk begins and ends (the first and last steps
// against its middle ones), the sharpest turn in one frame, how many set off in the very same frame, frames in which
// everyone on the way stood still. And stills: the eye fixed over the busiest stretch, so many frames one after
// another near and far, and a dolly from near to far for what changes with distance. --cost: the frame's time at the
// phone's size, the frame rate let run free, in place of the stills.
//   node tools/walk-look.ts --save file.save --dist dir [--shots dir] [--pace 600] [--frames 48] [--only phone]
//     [--browser webkit] [--town ref] [--cost]
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { preview } from "vite";
import { chromium, webkit, type Page } from "playwright";
import { loadWorld, rulesetId, seedFromText, type Ref } from "../src/kernel/index.ts";
import { EARTH } from "../src/host/planet.ts";
import { populationContext } from "../src/sim/index.ts";
import type { PlaceFrame } from "../src/bridge/index.ts";
import { hudRead, type HudRead } from "./hud-read.ts";

const argv = process.argv.slice(2),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  shots = arg("--shots"),
  saveFile = arg("--save"),
  dist = arg("--dist"),
  engine = arg("--browser") ?? "chromium",
  only = arg("--only"),
  townRef = arg("--town"),
  pace = Number(arg("--pace") ?? 600),
  frames = Number(arg("--frames") ?? 48),
  cost = argv.includes("--cost");
if (!saveFile) throw new Error("--save file.save");
if (shots) mkdirSync(shots, { recursive: true });
const GPU = [
  "--enable-gpu",
  "--ignore-gpu-blocklist",
  "--use-angle=d3d11",
  "--force_high_performance_gpu",
];
const say = (s: string) => console.log(`  ${s}`);

const bytes = readFileSync(saveFile),
  doc = JSON.parse(gunzipSync(bytes).toString("utf8")) as Parameters<typeof loadWorld>[0],
  world = loadWorld(
    doc,
    (s) => EARTH.build(s),
    rulesetId(EARTH.build(seedFromText(doc.seed)), EARTH.version),
    { allowRulesetChange: true },
  ).world,
  ctx = populationContext(world),
  town = townRef
    ? ctx.settlements.get(townRef as Ref)!
    : ctx.settlements
        .all()
        .filter((s) => ctx.settlements.held(s.ref))
        .reduce((a, b) => (Math.abs(b.population - 400) < Math.abs(a.population - 400) ? b : a));
if (!town) throw new Error(`no town ${townRef} in this save`);
console.log(`people seen moving: ${town.name} (${town.ref}), ${town.population} people`);

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({
    root,
    logLevel: "silent",
    ...(dist ? { build: { outDir: dist } } : {}),
    preview: { port: 4431, strictPort: false },
  }),
  base = server.resolvedUrls!.local[0]!,
  browser =
    engine === "webkit"
      ? await webkit.launch()
      : await chromium.launch({
          args: cost ? [...GPU, "--disable-frame-rate-limit", "--disable-gpu-vsync"] : GPU,
        });
console.log(
  `browser: ${engine} ${browser.version()}; the pace ${pace} of its clock's seconds a second`,
);

type State = { on: boolean; told: PlaceFrame | null };
type Track = { at: number[]; t: number[]; n: number; xs: number[][]; zs: number[][] };

/** A track taken in the page: every frame for `seconds`, where each of the first `most` of its people stands. */
const TRACK = (seconds: number, most: number) => `new Promise((done) => {
  const c = globalThis.causalis, n = Math.min(${most}, c.planNow().people.length);
  const out = { at: [], t: [], n, xs: [], zs: [] }, end = performance.now() + ${seconds * 1000};
  const frame = () => {
    const xs = new Array(n), zs = new Array(n);
    for (let i = 0; i < n; i++) { const m = c.place.personAt(i); xs[i] = m ? Math.round(m.x * 1000) / 1000 : null; zs[i] = m ? Math.round(m.z * 1000) / 1000 : null; }
    out.at.push(performance.now()); out.t.push(c.place.state().told?.t ?? 0); out.xs.push(xs); out.zs.push(zs);
    if (performance.now() < end) requestAnimationFrame(frame); else done(out);
  };
  requestAnimationFrame(frame);
})`;

const median = (a: number[]) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)]!;
};

/** What a track says of how its people move; and the busiest stretch of it. */
function read(track: Track): { x: number; z: number } {
  const F = track.at.length,
    dts: number[] = [];
  for (let f = 1; f < F; f++) dts.push(track.at[f]! - track.at[f - 1]!);
  const dt = median(dts) / 1000;
  let walkers = 0,
    fastest = 0,
    sharp = 0,
    sharpMany = 0,
    turns = 0;
  const begins: number[] = [],
    ends: number[] = [],
    starts = new Array<number>(F).fill(0),
    moving = new Array<number>(F).fill(0),
    speeds: number[] = [],
    busy = new Map<string, number>();
  for (let i = 0; i < track.n; i++) {
    // (Each walk of theirs in the track: the frames they moved in, one after another.)
    const steps: number[] = [0];
    for (let f = 1; f < F; f++) {
      const x0 = track.xs[f - 1]![i],
        x1 = track.xs[f]![i],
        z0 = track.zs[f - 1]![i]!,
        z1 = track.zs[f]![i]!;
      steps.push(
        x0 === null || x1 === null || x0 === undefined || x1 === undefined
          ? -1
          : Math.hypot(x1 - x0, z1 - z0),
      );
    }
    let any = false,
      f = 1;
    while (f < F) {
      if (!(steps[f]! > 0.002)) {
        f++;
        continue;
      }
      const from = f;
      while (f < F && steps[f]! > 0.002) f++;
      const walk = steps.slice(from, f),
        far = walk.reduce((a, b) => a + b, 0);
      if (walk.length < 4 || far < 1.5) continue;
      any = true;
      starts[from]!++;
      const mid = median(walk);
      // (Whole in the track: begun and ended inside it, seen or not just before and after.)
      if (from > 1 && steps[from - 1]! >= 0) begins.push(walk[0]! / mid);
      if (f < F - 1 && steps[f]! >= 0) ends.push(walk[walk.length - 1]! / mid);
      speeds.push(mid / dt);
      for (let g = from; g < f; g++) {
        moving[g]!++;
        fastest = Math.max(fastest, steps[g]! / dt);
        const key = `${Math.round(track.xs[g]![i]! / 16)},${Math.round(track.zs[g]![i]! / 16)}`;
        busy.set(key, (busy.get(key) ?? 0) + 1);
        if (g > from) {
          const a0 = Math.atan2(
              track.xs[g - 1]![i]! - track.xs[g - 2]![i]!,
              track.zs[g - 1]![i]! - track.zs[g - 2]![i]!,
            ),
            a1 = Math.atan2(
              track.xs[g]![i]! - track.xs[g - 1]![i]!,
              track.zs[g]![i]! - track.zs[g - 1]![i]!,
            ),
            turn = Math.abs(Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0))) * (180 / Math.PI);
          if (turn > 0.5) turns++;
          if (turn > 30) sharpMany++;
          sharp = Math.max(sharp, turn);
        }
      }
    }
    if (any) walkers++;
  }
  // (Frames in which those on the way a frame before and a frame after all stood still: the clock held.)
  let held = 0;
  for (let f = 2; f < F - 1; f++)
    if (moving[f] === 0 && moving[f - 1]! > 1 && moving[f + 1]! > 1) held++;
  const walks = starts.reduce((a, b) => a + b, 0),
    together = Math.max(...starts);
  say(
    `a track of ${F} frames, ${(dt * 1000).toFixed(1)} ms a frame; ${walkers} of ${track.n} walked in it, ${walks} walks`,
  );
  say(
    `their pace on the screen: the middle walk ${median(speeds).toFixed(1)} m/s, the fastest step ${fastest.toFixed(0)} m/s`,
  );
  say(
    `a walk's first step against its middle one ${median(begins).toFixed(2)}, its last ${median(ends).toFixed(2)} (1: begun and ended at full pace; of ${begins.length} and ${ends.length} walks)`,
  );
  say(
    `the sharpest turn in one frame ${sharp.toFixed(0)}°; frames turned more than 30° in: ${sharpMany} of ${turns} turned in`,
  );
  say(
    `the most walks begun in one frame: ${together} of ${walks}; frames everyone on the way stood still in: ${held}`,
  );
  let best = { x: 0, z: 0 },
    most = 0;
  for (const [key, count] of busy)
    if (count > most) {
      most = count;
      const [x, z] = key.split(",").map(Number) as [number, number];
      best = { x: x * 16, z: z * 16 };
    }
  return best;
}

for (const view of [
  {
    name: "phone",
    options: {
      viewport: { width: 430, height: 932 },
      deviceScaleFactor: engine === "webkit" ? 1 : 2,
      hasTouch: true,
      isMobile: true,
    },
  },
  { name: "desk", options: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 } },
] as const) {
  if (only && only !== view.name) continue;
  console.log(`${view.name} (${view.options.viewport.width}x${view.options.viewport.height})`);
  const context = await browser.newContext(view.options),
    page: Page = await context.newPage(),
    errors: string[] = [];
  page.setDefaultTimeout(60000);
  page.on("pageerror", (e) => errors.push(`${e.message}\n${e.stack ?? ""}`));
  const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>,
    until = async (what: string, ok: () => Promise<boolean>, ms = 60000) => {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        if (await ok().catch(() => false)) return true;
        await page.waitForTimeout(100);
      }
      say(`NOT ${what}`);
      return false;
    },
    state = () => k<State>("globalThis.causalis.place.state()"),
    W = view.options.viewport.width,
    H = view.options.viewport.height,
    // (The middle of the screen, where the eye is set: a square of it.)
    side = Math.min(W, 560),
    clip = { x: (W - side) / 2, y: Math.round(H * 0.5 - side * 0.5), width: side, height: side },
    flyTo = (to: { x: number; z: number }, distance: number, pitch = -38) =>
      k(
        `globalThis.causalis.rig.flyTo({ target: { x: ${to.x * 0.1}, y: 0.3, z: ${to.z * 0.1} }, distance: ${distance}, pitch: ${pitch} }, 0.01)`,
      ),
    setPace = async (seconds: number) => {
      await page.evaluate(
        `document.querySelector('.place-pace[data-pace="${seconds}"]')?.click() ?? globalThis.causalis.place.pace(${seconds})`,
      );
    },
    sequence = async (name: string, count: number, each?: (f: number) => Promise<unknown>) => {
      if (!shots) return;
      const t0 = Date.now();
      for (let f = 0; f < count; f++) {
        if (each) await each(f);
        await page.screenshot({
          path: join(shots, `${view.name}-${name}-${String(f).padStart(2, "0")}.png`),
          clip,
        });
      }
      say(`${name}: ${count} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    };

  const name = "earth:walk-look",
    q = `universe=earth&seed=${encodeURIComponent(doc.seed)}`;
  await page.goto(`${base}?${q}&hold=1`);
  await page.waitForFunction(
    () => !!(globalThis as { causalis?: { client?: unknown } }).causalis?.client,
    undefined,
    { timeout: 120000 },
  );
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: 180000 },
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
    { timeout: 180000 },
  );
  await page.waitForTimeout(600);
  await k(`globalThis.causalis.goTo(${JSON.stringify(town.ref)})`);
  await until(
    "the town drawn",
    async () =>
      (await k<string>("globalThis.causalis.scale()")) === "village" &&
      (await k<string | undefined>("globalThis.causalis.planNow()?.ref")) === town.ref,
  );
  await page.waitForTimeout(2500);
  await page.evaluate(`document.querySelector(".town-place").click()`);
  await until("the town entered and its people told", async () => {
    const s = await state();
    return (
      s.on && !!s.told && (await k<number>("globalThis.causalis.planNow().placed?.length ?? 0")) > 0
    );
  });
  await page.waitForTimeout(1500);
  // On to the morning, its people setting out.
  await setPace(3600);
  await until(
    "the morning",
    async () => {
      const hour = ((((await state()).told?.t ?? 0) % 86400) + 86400) % 86400;
      return hour > 6.5 * 3600 && hour < 9 * 3600;
    },
    90000,
  );
  await setPace(pace);
  await page.waitForTimeout(1200);
  const r = await k<HudRead>(hudRead([], 1));
  say(
    `the HUD in the town entered: ${r.overlaps.length} lying over one another, ${r.covered.length} out of reach, ${r.off.length + r.gone.length} off the screen ${[...r.overlaps, ...r.covered].slice(0, 3).join("; ")}`,
  );
  const told = (await state()).told;
  say(
    `the hour ${(((((told?.t ?? 0) % 86400) + 86400) % 86400) / 3600).toFixed(1)}; on the way now ${told?.eta.filter((e) => e > 0).length} of ${told?.eta.length}`,
  );

  // The track, the eye over the square.
  await flyTo({ x: 0, z: 0 }, 6);
  await page.waitForTimeout(800);
  const track = await k<Track>(TRACK(6, 500)),
    spot = read(track);
  say(`the busiest stretch: ${spot.x}, ${spot.z} m from the square`);

  if (cost) {
    // The frame's time: the eye where a town entered is watched from, its clock running; and stopped.
    for (const [what, seconds] of [
      ["its clock running", pace],
      ["its clock stopped", 0],
      ["its clock running", pace],
      ["its clock stopped", 0],
    ] as const) {
      await setPace(seconds);
      await flyTo({ x: 0, z: 0 }, 5);
      await page.waitForTimeout(1500);
      const ms = await k<number[]>(
        `new Promise((done) => { const at = []; const f = () => { at.push(performance.now()); if (at.length < 900) requestAnimationFrame(f); else done(at.slice(1).map((x, i) => x - at[i])); }; requestAnimationFrame(f); })`,
      );
      const mean = ms.reduce((a, b) => a + b, 0) / ms.length,
        shown = await k<number>(
          `(() => { const c = globalThis.causalis, n = c.planNow().people.length; let s = 0; for (let i = 0; i < n; i++) if (c.personOnScreen(i)) s++; return s; })()`,
        );
      say(
        `the frame, ${what}: mean ${mean.toFixed(3)} ms, middle ${median(ms).toFixed(3)} ms over ${ms.length} frames (${shown} of its people out of doors)`,
      );
    }
  } else {
    await flyTo(spot, 2.2);
    await page.waitForTimeout(900);
    await sequence("near", frames);
    await flyTo(spot, 5);
    await page.waitForTimeout(900);
    await sequence("mid", frames);
    // (A dolly from near to far: what changes with distance, and how.)
    await sequence("dolly", 24, async (f) => {
      await flyTo(spot, 1.6 * (14 / 1.6) ** (f / 23));
      await page.waitForTimeout(60);
    });
    // (And slowly, a minute a second: a walk seen stride by stride.)
    if (pace !== 60) {
      await setPace(60);
      await flyTo(spot, 2.2);
      await page.waitForTimeout(900);
      const slow = await k<Track>(TRACK(6, 500));
      say("a minute a second:");
      read(slow);
      await sequence("slow", frames);
    }
  }
  if (errors.length) say(`errors: ${errors.slice(0, 3).join(" | ")}`);
  await context.close();
}
await browser.close();
await server.close();
