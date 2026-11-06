// node tools/s1-gate.ts [--ci] [--soft] [--shots dir] [--save file.save] [--water file.save] [--renders]: gate 90, the world can be heard (Sound, first slice), at a phone's size, by real touch.
// A headless browser has no ears, so it measures. On far saves, else (as on CI) a young world:
//   1. renders: every place's numbers; each against every other, above what the same place from another seed differs from itself; no silence, no clipping, no place as loud as a cue;
//   2. cues rendered: each sounds, each is over when it should be; fifty ships firing as the rules let them is a fight and not a wall; what follows the greatest fire is quieter;
//   3. on the phone: not running before a touch; running after one; 🔊 by touch, remembered between visits, and off means suspended;
//   4. the real output through the real graph at the real places, told by the page as a person sees them; a hidden tab; ten fast changes of scale;
//   5. real presses and real films: a page, a fleet's beams and breaking ships under the node bound, Skip by touch; a window's bell by history's own news, and with 🔊 off none;
//   6. the paths nobody watches: no AudioContext at all; a water people; a world's hashes the same before and after; WebKit at least loaded.
// What it cannot tell is whether it sounds good: it writes WAV files to the shots folder, named by place, for a person.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";
import { preview } from "vite";
import { chromium, webkit, type BrowserContext, type Page } from "playwright";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  type World,
} from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { populationContext } from "../src/sim/index.ts";
import { lifeHere } from "../src/host/biochem.ts";
import { folksNear, landfallsOf } from "../src/sim/index.ts";
import {
  CUES,
  CUE_LASTS,
  CUE_RULES,
  NODE_BOUND,
  airOf,
  type Air,
  type Cue,
} from "../src/app/sound-mix.ts";

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
  waterFile = arg("--water");
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
console.log("gate 90, the world can be heard");

type Heard = { rms: number; peak: number; bands: number[]; moves: number };
type Rendered = Heard & { wav?: string; ms: number; nodesPeak: number; lasts: number };
type SoundState = {
  can: boolean;
  ctx: string;
  time: number;
  on: boolean;
  place: string;
  air: Air;
  nodes: number;
  nodesPeak: number;
  voices: number;
  voicesPeak: number;
  awake: number;
  played: Record<Cue, number>;
  dropped: Record<Cue, number>;
  unheard: number;
  told: number;
  startMs: number;
  errors: string[];
  states: string[];
  pumping: boolean;
};

/** How unlike two stretches of sound are: dB over the octaves (none counted below -70), and how much each moves. */
function unlike(a: Heard, b: Heard): number {
  let sum = 0;
  a.bands.forEach((x, i) => {
    const d = Math.max(-70, x) - Math.max(-70, b.bands[i]!);
    sum += d * d;
  });
  const m = 2 * (a.moves - b.moves);
  return Math.sqrt((sum + m * m) / (a.bands.length + 1));
}
const dbfs = (x: number) => (20 * Math.log10(Math.max(x, 1e-6))).toFixed(1);

const forged = (o: Partial<Air> & { place: Air["place"] }): Air => ({ ...airOf(o.place), ...o });
/** Every place the slice promises, by the name a listener would give it. */
const PLACES: readonly (readonly [string, Air])[] = [
  ["title", forged({ place: "title" })],
  ["town-day", forged({ place: "town" })],
  ["town-night", forged({ place: "town", night: 1 })],
  ["town-rain", forged({ place: "town", rain: 0.8 })],
  ["town-market", forged({ place: "town", market: true })],
  ["town-feast", forged({ place: "town", feast: true })],
  ["town-war", forged({ place: "town", war: true })],
  ["land", forged({ place: "land" })],
  ["land-night", forged({ place: "land", night: 1 })],
  ["land-lifeless", forged({ place: "land", alive: false })],
  ["land-thin-air", forged({ place: "land", thin: 0.9 })],
  ["land-hard-wind", forged({ place: "land", wind: 1 })],
  ["shore", forged({ place: "shore" })],
  ["water-town", forged({ place: "town", under: true })],
  ["halls", forged({ place: "halls" })],
  ["globe", forged({ place: "globe" })],
  ["stars", forged({ place: "stars" })],
  ["galaxy", forged({ place: "galaxy" })],
  ["battle", forged({ place: "battle" })],
  ["town-after-the-fire", forged({ place: "town", hush: 1 })],
  ["worst-war-downpour-night", forged({ place: "town", war: true, rain: 1, night: 1 })],
];
/** Those a person must tell apart with their eyes shut (each pair): far above the measure's own noise. */
const APART = [
  "town-day",
  "shore",
  "land",
  "water-town",
  "globe",
  "stars",
  "galaxy",
  "battle",
  "title",
];
/** And those told apart from what they vary, by less, but above the noise still. */
const VARIES: readonly (readonly [string, string])[] = [
  ["town-day", "town-night"],
  ["town-day", "town-rain"],
  ["town-day", "town-market"],
  ["town-day", "town-war"],
  ["land", "land-night"],
  ["land", "land-thin-air"],
  ["land", "land-hard-wind"],
];

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
const openFile = (file: string, universe: "earth" | "alien"): World => {
  const u = universe === "earth" ? EARTH : ALIEN,
    doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as Parameters<
      typeof loadWorld
    >[0],
    probe = u.build(seedFromText(doc.seed));
  return loadWorld(doc, (s) => u.build(s), rulesetId(probe, u.version), {
    allowRulesetChange: true,
  }).world;
};
const youngWorld = (): World => {
  const world = EARTH.build(seedFromText("first light"));
  world.runTo(30 * YEAR);
  return world;
};
const townOf = (w: World): string =>
  [...populationContext(w).settlements.all()]
    .filter((s) => s.population > 0)
    .sort((a, b) => b.population - a.population)[0]!.ref;

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4290, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  });
const phone = {
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: ci || soft ? 1 : 2,
  hasTouch: true,
  isMobile: true,
};
const context: BrowserContext = await browser.newContext(phone),
  page: Page = await context.newPage(),
  errors: string[] = [];
page.setDefaultTimeout(slow(60000));
const listen = (p: Page, into: string[]) => {
  p.on("pageerror", (e) => into.push(`${e.message}\n${e.stack ?? ""}`));
  p.on("console", (m) => {
    if (m.type() === "error") into.push(m.text());
  });
};
listen(page, errors);
const k = <T>(code: string, on: Page = page): Promise<T> => on.evaluate(code) as Promise<T>;
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
  if (!shots) return;
  // (A picture missed, on a machine whose GPU is busy, is not the sound's failure; each is read by a person.)
  await page
    .screenshot({ path: join(shots, `${name}.png`) })
    .catch((e: unknown) => say(`no picture of ${name}: ${String(e).slice(0, 80)}`));
};
const S = "globalThis.causalis.sound";
const state = (on: Page = page) => k<SoundState>(`${S}.state()`, on);
const measure = (ms = 1500) => k<Heard & { ran: number }>(`${S}.measure(${ms})`);

async function loadSave(f: Forged, name: string, extra = "") {
  const keep = `${f.universe}:${name}`,
    q = `universe=${f.universe}&seed=${encodeURIComponent(f.seed)}`;
  await page.goto(`${base}?${q}&hold=1`);
  const drawn = () =>
    page.waitForFunction(
      () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
      undefined,
      { timeout: slow(180000) },
    );
  await drawn();
  await page.evaluate(
    async ([data, as]) => {
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
      await c.save(as as string);
    },
    [f.bytes.toString("base64"), keep],
  );
  await page.goto(`${base}?${q}&load=${encodeURIComponent(keep)}&hold=1${extra}`);
  await drawn();
  await page.waitForTimeout(slow(600));
}

/** Pressed by a real touch at its real place on the screen, what is there checked first. */
async function press(selector: string, on: Page = page): Promise<boolean> {
  const at = await k<{ x: number; y: number; w: number; h: number; top: boolean } | null>(
    `(() => {
    for (const e of document.querySelectorAll(${JSON.stringify(selector)})) {
      if (e.getBoundingClientRect().width > 0) e.scrollIntoView({ block: "center" });
      const r = e.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        const x = r.x + r.width / 2, y = r.y + r.height / 2, hit = document.elementFromPoint(x, y);
        return { x, y, w: r.width, h: r.height, top: !!hit && (hit === e || e.contains(hit)) };
      }
    }
    return null;
  })()`,
    on,
  );
  if (!at) {
    problems.push(`nothing to press at ${selector}`);
    return false;
  }
  check(at.top, `something lies over ${selector}`);
  check(at.x + at.w / 2 <= 431 && at.x - at.w / 2 >= -1, `${selector} lies off the phone's edge`);
  await on.touchscreen.tap(at.x, at.y);
  await on.waitForTimeout(slow(250));
  return true;
}
/** 🔊 where a person finds it: on the screen, a thumb's size, and over nothing else that takes a touch. */
async function buttonWell(where: string, on: Page = page, under = false): Promise<void> {
  const b = await k<{
    w: number;
    h: number;
    x: number;
    y: number;
    top: boolean;
    over: string[];
    shown: boolean;
    parent: string;
  } | null>(
    `(() => {
    const e = document.querySelector(".sound-button");
    if (!e) return null;
    const r = e.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2,
      hit = document.elementFromPoint(x, y),
      over = [];
    for (const o of document.querySelectorAll("button, a, input, select, .page-window, .panel, .life-strip, .reign-strip, .home-cap, .home-who, .fleet-tally, .film-words")) {
      if (o === e || o.contains(e) || e.contains(o)) continue;
      const q = o.getBoundingClientRect();
      if (q.width <= 0 || q.height <= 0 || getComputedStyle(o).visibility === "hidden") continue;
      if (q.right > r.left && q.left < r.right && q.bottom > r.top && q.top < r.bottom) over.push((o.className && o.className.toString()) || o.tagName);
    }
    return { w: r.width, h: r.height, x: r.x, y: r.y, top: hit === e || e.contains(hit), over, shown: r.width > 0 && getComputedStyle(e).visibility !== "hidden", parent: e.parentElement?.className || e.parentElement?.tagName || "" };
  })()`,
    on,
  );
  if (!b) {
    problems.push(`${where}: no 🔊`);
    return;
  }
  say(
    `🔊 ${where}: ${Math.round(b.w)}x${Math.round(b.h)} at ${Math.round(b.x)},${Math.round(b.y)} in ${b.parent}${b.over.length ? `; over ${b.over.join(", ")}` : ""}`,
  );
  check(b.shown, `${where}: 🔊 is not shown`);
  check(b.w >= 44 && b.h >= 44, `${where}: 🔊 is ${b.w}x${b.h}`);
  check(
    b.x >= 0 && b.x + b.w <= 430 && b.y >= 0 && b.y + b.h <= 932,
    `${where}: 🔊 off the screen`,
  );
  // (`under`: a sheet that covers the corner's tools covers it too, for as long as a person is choosing.)
  if (under) return;
  check(b.top, `${where}: something lies over 🔊`);
  check(b.over.length === 0, `${where}: 🔊 stands over ${b.over.join(", ")}`);
}
/** A far-off place on the screen a touch does nothing at: the world's own dark, in the very corner. (A touch on the world opens what it lands on, and a page stands over the corner's tools.) */
const touchAnywhere = async () => {
  await page.touchscreen.tap(4, 4);
  await page.waitForTimeout(slow(350));
};
/** The clock let go for a moment, for what runs only as the world runs. */
const closePages = () =>
  k(`document.querySelector(".page-window .close, .page-window button.close")?.click?.()`);

// —— 1 and 2: the renders, on the title page, before a touch.
await page.goto(`${base}?menu=1`);
await until("the title", () => k<boolean>(`!!document.querySelector(".title-screen")`));
await page.waitForTimeout(slow(300));
{
  const st0 = await state();
  check(st0.ctx === "none", `before any touch the context is ${st0.ctx}`);
  await buttonWell("on the title");
  await shot("00-title");
  const render = (o: unknown) => k<Rendered>(`${S}.render(${JSON.stringify(o)})`);
  const first: Record<string, Heard> = {},
    floors: Record<string, number> = {};
  let floor = 0,
    slowest = 0;
  console.log("  place                         rms dBFS  peak   moves  floor   render×  bands");
  for (const [name, air] of PLACES) {
    const a = await render({ air, seconds: 12, seed: 11, wav: !!shots, from: 2 }),
      b = await render({ air, seconds: 12, seed: 8123, from: 2 }),
      d = unlike(a, b);
    first[name] = a;
    floors[name] = d;
    floor = Math.max(floor, d);
    slowest = Math.max(slowest, a.ms / 12000);
    if (shots && a.wav) writeFileSync(join(shots, `${name}.wav`), Buffer.from(a.wav, "base64"));
    console.log(
      `  ${name.padEnd(28)} ${dbfs(a.rms).padStart(7)} ${a.peak.toFixed(2).padStart(6)} ${a.moves.toFixed(1).padStart(6)} ${d.toFixed(1).padStart(6)} ${(12000 / a.ms).toFixed(0).padStart(7)}x  ${a.bands.map((x) => x.toFixed(0)).join(" ")}`,
    );
    // (A phone's speaker gives little under 320 Hz: what is over it is what is heard on the floor device.)
    const onPhone = 10 * Math.log10(a.bands.slice(3).reduce((p, x) => p + Math.pow(10, x / 10), 0));
    if (name !== "town-after-the-fire")
      check(
        onPhone > -44,
        `${name}: next to nothing on a phone's speaker (${onPhone.toFixed(1)} dB over 320 Hz)`,
      );
    say(`${name}: ${onPhone.toFixed(1)} dB over 320 Hz, what a phone's speaker gives`);
    check(a.rms > 0.003, `${name}: no signal (rms ${a.rms})`);
    check(a.peak < 1, `${name}: it clips (peak ${a.peak})`);
    check(a.rms < 0.16, `${name}: as loud as a cue (rms ${a.rms}, ${dbfs(a.rms)} dBFS)`);
  }
  // The bar: what the same place, from other randomness, differs from itself; the measure's own noise.
  const bar = floor * 1.5;
  say(`the measure's own noise: at most ${floor.toFixed(2)}; the bar ${bar.toFixed(2)}`);
  let nearest = { d: Infinity, pair: "" };
  for (let i = 0; i < APART.length; i++)
    for (let j = i + 1; j < APART.length; j++) {
      const A = APART[i]!,
        B = APART[j]!,
        d = unlike(first[A]!, first[B]!);
      if (d < nearest.d) nearest = { d, pair: `${A} / ${B}` };
      check(
        d > bar * 2,
        `${A} and ${B} are near alike: ${d.toFixed(2)} (bar ${(bar * 2).toFixed(2)})`,
      );
    }
  say(`the nearest of those told apart: ${nearest.pair}, ${nearest.d.toFixed(2)}`);
  console.log("        " + APART.map((a) => a.slice(0, 6).padStart(7)).join(""));
  for (const A of APART)
    console.log(
      `  ${A.slice(0, 6).padEnd(6)}` +
        APART.map((B) => unlike(first[A]!, first[B]!).toFixed(1).padStart(7)).join(""),
    );
  for (const [A, B] of VARIES) {
    const d = unlike(first[A]!, first[B]!);
    say(`${A} / ${B}: ${d.toFixed(2)}`);
    check(d > bar, `${A} and ${B} are near alike: ${d.toFixed(2)} (bar ${bar.toFixed(2)})`);
  }
  check(
    first["town-after-the-fire"]!.rms < first["town-day"]!.rms * 0.7,
    `what follows the greatest fire is not quieter: ${first["town-after-the-fire"]!.rms} against ${first["town-day"]!.rms}`,
  );
  // A place crossfades: from the town to the stars, nothing clips on the way.
  const fade = await render({
    air: forged({ place: "town" }),
    then: { air: forged({ place: "stars" }), at: 4 },
    seconds: 10,
    seed: 5,
    wav: !!shots,
  });
  if (shots && fade.wav)
    writeFileSync(join(shots, "crossfade-town-to-stars.wav"), Buffer.from(fade.wav, "base64"));
  check(fade.peak < 1, `a crossfade clips: ${fade.peak}`);
  // The cues, each alone on silence: that it sounds and is over when it should be, and against the air.
  const placeRms = Math.max(...APART.filter((x) => x !== "battle").map((x) => first[x]!.rms));
  const heardCue: Partial<Record<Cue, Rendered>> = {};
  for (const cue of CUES) {
    const len = cue === "fire" ? 22 : 7,
      r = await render({
        air: airOf("town"),
        silent: true,
        seconds: len,
        seed: 3,
        wav: !!shots,
        cues: [{ cue, at: 0.1 }],
      });
    heardCue[cue] = r;
    const end = CUE_LASTS[cue];
    say(
      `cue ${cue.padEnd(8)} peak ${r.peak.toFixed(2)}, loudest ${dbfs(r.peak)} dBFS, over at ${r.lasts.toFixed(2)} s (it should last ${end} s)`,
    );
    check(r.peak > 0.02, `${cue} does not sound`);
    check(r.peak < 1, `${cue} clips: ${r.peak}`);
    check(r.lasts < 0.1 + end + 0.4, `${cue} is not over when it should be: ${r.lasts}`);
    if (shots && r.wav) writeFileSync(join(shots, `cue-${cue}.wav`), Buffer.from(r.wav, "base64"));
  }
  check(
    heardCue.fire!.peak > placeRms * 2,
    `the greatest fire is no louder than a place (${heardCue.fire!.peak} against ${placeRms})`,
  );
  check(
    heardCue.event!.peak > placeRms * 1.5,
    `a great event's bell is under the air (${heardCue.event!.peak} against ${placeRms})`,
  );
  // Fifty ships firing, as the rules let through at their worst: over the stars for ten seconds.
  const fight: { cue: Cue; at: number; level: number }[] = [];
  for (let t = 0.2; t < 10; t += CUE_RULES.beam.wait / 1000)
    fight.push({ cue: "beam", at: t, level: 1 / (1 + 48 / 30) });
  for (let t = 0.2; t < 10; t += CUE_RULES.missile.wait / 1000)
    fight.push({ cue: "missile", at: t, level: 1 / (1 + 24 / 24) });
  for (let t = 0.2; t < 10; t += CUE_RULES.break.wait / 1000)
    fight.push({ cue: "break", at: t, level: 1 });
  const wall = await render({
      air: forged({ place: "stars" }),
      seconds: 10,
      seed: 9,
      cues: fight,
      wav: !!shots,
    }),
    calm = first.stars!;
  if (shots && wall.wav)
    writeFileSync(join(shots, "fifty-ships.wav"), Buffer.from(wall.wav, "base64"));
  say(
    `fifty ships at the worst the rules allow: ${dbfs(wall.rms)} dBFS, peak ${wall.peak.toFixed(2)}, moves ${wall.moves.toFixed(1)} (the stars ${dbfs(calm.rms)})`,
  );
  check(wall.peak < 1, `fifty ships clip: ${wall.peak}`);
  check(wall.rms < 0.5, `fifty ships are a wall: ${wall.rms}`);
  // The greatest fire over a town: the air gone at once, the blow, and quiet after.
  const fell = await render({
      air: forged({ place: "town" }),
      then: { air: forged({ place: "town", hush: 1 }), at: 3 },
      seconds: 40,
      seed: 21,
      wav: !!shots,
      cues: [{ cue: "fire", at: 3 }],
    }),
    after = await render({
      air: forged({ place: "town" }),
      then: { air: forged({ place: "town", hush: 1 }), at: 3 },
      seconds: 40,
      seed: 21,
      from: 26,
      cues: [{ cue: "fire", at: 3 }],
    });
  if (shots && fell.wav)
    writeFileSync(join(shots, "greatest-fire-on-a-town.wav"), Buffer.from(fell.wav, "base64"));
  say(
    `the greatest fire: peak ${fell.peak.toFixed(2)}; 23 s on and after, ${dbfs(after.rms)} dBFS against the town's ${dbfs(first["town-day"]!.rms)}`,
  );
  check(fell.peak < 1, `the greatest fire clips: ${fell.peak}`);
  check(
    after.rms < first["town-day"]!.rms * 0.75,
    `what follows the fire is no quieter: ${after.rms} against ${first["town-day"]!.rms}`,
  );
  say(
    `the worst place renders ${(1 / slowest).toFixed(0)} times as fast as it plays, here, in one thread`,
  );
}

// (--renders: these numbers alone, while a mix is being set.)
if (argv.includes("--renders")) {
  await browser.close();
  await server.close();
  for (const p of problems) console.log(`  - ${p}`);
  console.log(
    problems.length ? `gate 90, renders: ${problems.length} problem(s)` : "gate 90, renders passed",
  );
  process.exit(problems.length ? 1 : 0);
}
// —— The title on the phone: a touch starts it, a press of 🔊 stops it, and it is remembered.
{
  await touchAnywhere();
  await until("the context running after a touch", async () => (await state()).ctx === "running");
  const st = await state();
  say(
    `after a touch: ${st.ctx}; the graph built in ${st.startMs.toFixed(1)} ms; ${st.nodes} nodes`,
  );
  const m = await measure(1500);
  say(
    `the title, as a speaker gets it: ${dbfs(m.rms)} dBFS, peak ${m.peak.toFixed(2)}; its clock ran ${m.ran.toFixed(2)} s`,
  );
  check(m.ran > 0.8, `the context's clock did not run: ${m.ran}`);
  check(m.rms > 0.002, `the title is silent: ${m.rms}`);
  await press(".sound-button");
  const off = await state();
  check(!off.on && off.ctx === "suspended", `🔊 off, and the context is ${off.ctx}`);
  check(!off.pumping, "🔊 off, and the timer still runs");
  await buttonWell("on the title, off");
  await page.reload();
  await until("the title", () => k<boolean>(`!!document.querySelector(".title-screen")`));
  await page.waitForTimeout(slow(300));
  await touchAnywhere();
  const kept = await state();
  check(!kept.on && kept.ctx === "none", `off was not remembered: ${kept.on}, ${kept.ctx}`);
  check(
    (await k<string>(`document.querySelector(".sound-button").textContent`)) === "🔇",
    "off is not shown as off",
  );
  await press(".sound-button");
  await until("running at 🔊 pressed", async () => (await state()).ctx === "running");
  check((await state()).on, "🔊 on was not taken up");
}

// —— 3. A far world (or a young one), on the phone.
const world = saveFile ? openFile(saveFile, saveUniverse) : youngWorld(),
  made = pack(world, saveFile ? saveUniverse : "earth"),
  town = townOf(world);
await loadSave(made, "gate90");
{
  const st = await state();
  check(st.ctx === "none", `a new page, before a touch: ${st.ctx}`);
  await buttonWell("at the globe");
  await touchAnywhere();
  await until("running after a touch", async () => (await state()).ctx === "running");
  await page.waitForTimeout(slow(600));
  await shot("01-globe");
}
const before = JSON.stringify(await ask<unknown>("hashes"));
const real: Record<string, Heard> = {};
/** A place as the page tells it: the real graph's real output, and the word it was told. */
const hear = async (name: string, place: string, ms = 2600) => {
  await until(`${name} told`, async () => (await state()).place === place, slow(15000));
  // (The crossfade over.)
  await page.waitForTimeout(1800);
  const m = await measure(ms),
    st = await state();
  real[name] = m;
  say(
    `${name.padEnd(18)} told ${st.place}${st.air.under ? ", under water" : ""}${st.air.rain > 0 ? `, rain ${st.air.rain.toFixed(2)}` : ""}${st.air.war ? ", at war" : ""}${st.air.night ? `, night ${st.air.night}` : ""}${st.air.held ? ", paused" : ""}: ${dbfs(m.rms)} dBFS, peak ${m.peak.toFixed(2)}, moves ${m.moves.toFixed(1)}; ${st.nodes} nodes, ${st.awake} layers awake; bands ${m.bands.map((x) => x.toFixed(0)).join(" ")}`,
  );
  check(m.rms > 0.0008, `${name}: silent at the speaker (${m.rms})`);
  check(m.peak < 1, `${name}: clips at the speaker (${m.peak})`);
};
await hear("globe", "globe");
const again = await measure(2600);
const liveFloor = unlike(real.globe!, again);
say(`the same place heard twice, live, differs by ${liveFloor.toFixed(2)}`);
await k(`globalThis.causalis.sky()`);
await hear("stars", "stars");
await k(`globalThis.causalis.galaxy()`);
await hear("galaxy", "galaxy");
await shot("02-galaxy");
await buttonWell("at the galaxy");
await k(`globalThis.causalis.goTo(${JSON.stringify(town)})`);
await until(
  "the town",
  () =>
    k<boolean>(
      `globalThis.causalis.scale() === "village" && globalThis.causalis.planNow()?.ref === ${JSON.stringify(town)}`,
    ),
  slow(90000),
);
await hear(
  "town",
  (await k<boolean>(`!!globalThis.causalis.planNow()?.colony`)) ? "halls" : "town",
);
await shot("03-town");
await buttonWell("in the town");
for (const [a, b] of [
  ["town", "stars"],
  ["town", "galaxy"],
  ["town", "globe"],
  ["stars", "galaxy"],
  ["stars", "globe"],
] as const) {
  const d = unlike(real[a]!, real[b]!);
  say(`live: ${a} / ${b} ${d.toFixed(2)}`);
  check(
    d > Math.max(liveFloor * 2, 2),
    `live, ${a} and ${b} are near alike: ${d.toFixed(2)} (the same place differs by ${liveFloor.toFixed(2)})`,
  );
}
// Out of the town: the land.
await k(`globalThis.causalis.zoomThrough("out")`);
await until("the land", () => k<boolean>(`globalThis.causalis.scale() === "region"`), slow(60000));
await until(
  "the land told",
  async () => ["land", "shore", "halls"].includes((await state()).place),
  slow(15000),
);
await hear("land", (await state()).place);
await shot("04-land");
await buttonWell("on the land");
{
  // The clock runs: told it, the air comes forward and the small sounds begin. Told so by the page's reading.
  const held = (await state()).air.held;
  check(held, "the clock paused, and the air is not held back");
}
// —— Ten changes of scale, fast: nothing stacks, nothing errors.
{
  const was = await state();
  // (Real changes of scale, each let finish; then ten places told as fast as a thumb could ask, the worst for the crossfades.)
  for (const way of ["in", "out", "out", "in"]) {
    await k(`globalThis.causalis.zoomThrough(${JSON.stringify(way)})`).catch(() => {});
    await page.waitForTimeout(slow(200));
  }
  const places = [
    "town",
    "stars",
    "galaxy",
    "battle",
    "shore",
    "globe",
    "town",
    "battle",
    "stars",
    "land",
  ];
  const meter = measure(1800);
  for (const place of places) {
    await k(`${S}.tell({ ...${S}.state().air, place: ${JSON.stringify(place)} })`);
    await page.waitForTimeout(60);
  }
  const m = await meter,
    st = await state();
  say(
    `ten fast changes: told ${st.told - was.told} times; ${st.nodes} nodes (peak ${st.nodesPeak}), peak ${m.peak.toFixed(2)}`,
  );
  check(st.told - was.told >= 10, `ten fast changes told ${st.told - was.told} times`);
  check(st.nodes <= NODE_BOUND, `ten fast changes left ${st.nodes} nodes`);
  check(m.peak < 1, `ten fast changes clip: ${m.peak}`);
  check(st.errors.length === 0, `errors in the graph: ${st.errors.join("; ")}`);
  await page.waitForTimeout(600);
}
// —— The tab hidden, and shown: as a browser says it.
{
  const setHidden = (hidden: boolean) =>
    k(`(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => ${hidden} });
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => ${JSON.stringify(hidden ? "hidden" : "visible")} });
      document.dispatchEvent(new Event("visibilitychange"));
    })()`);
  await setHidden(true);
  await until("quiet with the tab hidden", async () => (await state()).ctx === "suspended");
  const away = await state();
  check(!away.pumping, "the timer runs with the tab hidden");
  const t0 = away.time;
  await page.waitForTimeout(500);
  check((await state()).time - t0 < 0.05, "the context's clock runs with the tab hidden");
  await setHidden(false);
  await until("back with the tab shown", async () => (await state()).ctx === "running");
  check((await state()).pumping, "the timer did not come back with the tab");
  await k(`delete document.hidden; delete document.visibilityState`);
}
// —— Real presses: a page, by touch; 🔊 off and nothing sounds.
{
  await k(`globalThis.causalis.goTo(${JSON.stringify(town)})`);
  await until(
    "the town again",
    () => k<boolean>(`globalThis.causalis.scale() === "village"`),
    slow(90000),
  );
  await page.waitForTimeout(slow(600));
  const was = await state();
  await press(".log-open");
  await until("a page opened", () => k<boolean>(`!!globalThis.causalis.pageOpen()`), slow(15000));
  const st = await state();
  say(
    `pressed a tool and a page came: press ${st.played.press - was.played.press}, page ${st.played.page - was.played.page}`,
  );
  check(st.played.press > was.played.press, "a button pressed by touch made no sound");
  check(st.played.page > was.played.page, "a page opening made no sound");
  await k(`globalThis.causalis.closePage?.()`);
  await closePages();
  await page.waitForTimeout(slow(300));
  await press(".sound-button");
  const off = await state();
  check(off.ctx === "suspended", `🔊 off in the town, and the context is ${off.ctx}`);
  await k(`globalThis.causalis.open("world:log")`);
  await until("a page opened", () => k<boolean>(`!!globalThis.causalis.pageOpen()`), slow(15000));
  const quiet = await state();
  check(quiet.played.page === off.played.page, "a page sounded with 🔊 off");
  check(quiet.unheard > off.unheard, "a page opening with 🔊 off went uncounted");
  await k(`globalThis.causalis.closePage?.()`);
  await closePages();
  await page.waitForTimeout(slow(300));
  await press(".sound-button");
  await until("back on", async () => (await state()).ctx === "running");
}
// —— Frame time with it on against off: the same town, the same way.
{
  const frames = () =>
    k<{ mean: number; p95: number; n: number }>(`new Promise((done) => {
    const out = []; let last = performance.now(), end = last + ${slow(5000)};
    const step = (t) => { out.push(t - last); last = t; if (t < end) requestAnimationFrame(step); else { out.sort((a, b) => a - b); done({ mean: out.reduce((a, b) => a + b, 0) / out.length, p95: out[Math.floor(out.length * 0.95)], n: out.length }); } };
    requestAnimationFrame(step);
  })`);
  await page.waitForTimeout(slow(800));
  const on1 = await frames();
  await press(".sound-button");
  const offF = await frames();
  await press(".sound-button");
  await until("back on", async () => (await state()).ctx === "running");
  const on2 = await frames();
  say(
    `frames in the town: on ${on1.mean.toFixed(1)} ms (p95 ${on1.p95.toFixed(1)}, ${on1.n}); off ${offF.mean.toFixed(1)} (p95 ${offF.p95.toFixed(1)}, ${offF.n}); on again ${on2.mean.toFixed(1)} (p95 ${on2.p95.toFixed(1)}, ${on2.n})`,
  );
  if (!ci && !soft)
    check(
      Math.min(on1.mean, on2.mean) < offF.mean * 1.2 + 1.5,
      `sound costs frames: ${on1.mean}, ${on2.mean} against ${offF.mean}`,
    );
}
// —— 5. Real films, where the world has them.
{
  const fights = await ask<{ best: string | null } | null>("star.fights").catch(() => null);
  if (fights?.best) {
    const f = "globalThis.causalis.fleetFilm",
      was = await state();
    await k(`void ${f}.play(${JSON.stringify(fights.best)})`);
    await until(
      "the fleet's film",
      () => k<boolean>(`${f}.playing && ${f}.state().act === "orbit" && !${f}.state().cutting`),
      slow(60000),
    );
    await page.waitForTimeout(slow(500));
    await buttonWell("over a fleet's film");
    await shot("05-fleet-film");
    const place = (await state()).place;
    check(place === "stars", `over a fleet's fight, the place told is ${place}`);
    // (Into the fight.)
    await k(`${f}.scrub(0.25)`).catch(() => {});
    const m = await measure(slow(6000)),
      st = await state(),
      beams = st.played.beam - was.played.beam,
      missiles = st.played.missile - was.played.missile,
      breaks = st.played.break - was.played.break,
      dropped = st.dropped.beam - was.dropped.beam + st.dropped.missile - was.dropped.missile;
    const seen = await k<{ beams: number; missiles: number; wrecks: number }>(`${f}.state()`).catch(
      () => ({ beams: 0, missiles: 0, wrecks: 0 }),
    );
    say(
      `a fleet's film: ${beams} beams, ${missiles} missiles, ${breaks} ships breaking played; ${dropped} held back by the rules; ${st.voicesPeak} voices at most; ${st.nodesPeak} nodes at most (bound ${NODE_BOUND}); ${dbfs(m.rms)} dBFS, peak ${m.peak.toFixed(2)}; drawn then: ${JSON.stringify({ beams: seen.beams, missiles: seen.missiles, wrecks: seen.wrecks })}`,
    );
    check(beams + missiles + breaks > 0, "a fleet's film played and nothing of it was heard");
    check(st.nodesPeak <= NODE_BOUND, `${st.nodesPeak} nodes against a bound of ${NODE_BOUND}`);
    check(m.peak < 1, `a fleet's film clips: ${m.peak}`);
    // Skip, by touch: what was sounding is over soon after, and nothing new begins.
    await press(".film-skip");
    await until("the film skipped", () => k<boolean>(`!${f}.playing`), slow(60000));
    const after = await state();
    await page.waitForTimeout(2500);
    const later = await state();
    check(
      later.played.beam === after.played.beam && later.played.missile === after.played.missile,
      "a skipped film goes on firing",
    );
    say(`after Skip: ${later.voices} voices sounding, ${later.nodes} nodes`);
  } else say("no fight in this world: a young one has none");
  const jump = await ask<unknown>("lanes.jump").catch(() => null);
  if (jump) {
    const was = await state(),
      J = "globalThis.causalis.jumpFilm";
    await k(`void ${J}.play()`);
    await until("the jump's film", () => k<boolean>(`${J}.playing`), slow(20000));
    await until(
      "the jump's blow",
      async () => (await state()).played.jump > was.played.jump,
      slow(60000),
    );
    await buttonWell("over a jump's film");
    await shot("06-jump-film");
    const st = await state();
    check(st.place === "stars", `in the lane, the place told is ${st.place}`);
    await until(
      "out of the lane",
      async () => (await state()).played.out > was.played.out,
      slow(60000),
    );
    await press(".film-skip").catch(() => false);
    await until("the jump over", () => k<boolean>(`!${J}.playing`), slow(60000));
    say("a jump through a lane: its two cues heard, at their moments");
  }
}
// —— A window's bell by history's own news, then with 🔊 off none. (History moves from here: the hashes are read first.)
const after = JSON.stringify(await ask<unknown>("hashes"));
check(before === after, "hearing moved history: the hashes differ");
say(`hashes the same before and after: ${before === after}`);
if (saveFile) {
  await k(`localStorage.setItem("causalis.events", "window")`);
  const q = `universe=${made.universe}&seed=${encodeURIComponent(made.seed)}`;
  await page.goto(
    `${base}?${q}&load=${encodeURIComponent(`${made.universe}:gate90`)}&events=1&hold=1`,
  );
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: slow(180000) },
  );
  await touchAnywhere();
  await until("running", async () => (await state()).ctx === "running");
  const go = async (): Promise<boolean> => {
    // (The world let run until history itself sends news great enough for a window.)
    await k(`globalThis.causalis.client.setSpeed(${YEAR})`);
    const end = Date.now() + slow(45000);
    while (Date.now() < end) {
      if (await k<boolean>(`!!globalThis.causalis.eventOpen?.()`)) return true;
      await page.waitForTimeout(200);
    }
    return false;
  };
  const was = await state();
  if (await go()) {
    await page.waitForTimeout(slow(300));
    const st = await state();
    say(`a great event's window: its bell played ${st.played.event - was.played.event} time(s)`);
    check(st.played.event > was.played.event, "a great event's window made no sound");
    await shot("07-window");
    // (The window is over all of it: 🔊 waits under it. It is let be, by touch; then 🔊 off, and the next: none.)
    await k(`globalThis.causalis.client.setSpeed(0)`);
    await press(".event-window .event-be");
    await until(
      "the window let be",
      () => k<boolean>(`!globalThis.causalis.eventOpen?.()`),
      slow(10000),
    );
    await press(".sound-button");
    check((await state()).ctx === "suspended", "🔊 off did not take, after a window");
    const off = await state();
    await page.waitForTimeout(slow(800));
    if (await go()) {
      const s2 = await state();
      check(s2.played.event === off.played.event, "a great event sounded with 🔊 off");
      check(s2.ctx === "suspended", `🔊 off through a great event, and the context is ${s2.ctx}`);
      say("🔊 off, then a great event: its window, and no sound");
      await k(`globalThis.causalis.client.setSpeed(0)`);
      await press(".event-window .event-be");
      await until(
        "the second window let be",
        () => k<boolean>(`!globalThis.causalis.eventOpen?.()`),
        slow(10000),
      );
    } else {
      say("no second great event came in the time");
      await k(`globalThis.causalis.client.setSpeed(0)`);
    }
    await press(".sound-button");
    await until("back on, after the windows", async () => (await state()).ctx === "running");
  } else say("no great event came in the time allowed: its window's cue was not pressed here");
  await k(`localStorage.removeItem("causalis.events")`);
}
// —— The modes that put the corner away, as a person gets into them: 🔊 stays, over nothing. The greatest fire and a landing by their films.
{
  await loadSave(made, "gate90");
  await touchAnywhere();
  await until("running", async () => (await state()).ctx === "running");
  await k(`globalThis.causalis.goTo(${JSON.stringify(town)})`);
  await until(
    "the town",
    () =>
      k<boolean>(`globalThis.causalis.scale() === "village" && !!globalThis.causalis.planNow()`),
    slow(90000),
  );
  await page.waitForTimeout(slow(800));
  const seen = (sel: string) =>
    k<boolean>(
      `(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; })()`,
    );
  /** Into a mode, as far as this world allows: a young one has fewer ways in. Told plainly if it does not come. */
  const enter = async (what: string, ok: () => Promise<boolean>, ms: number) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await ok().catch(() => false)) return true;
      await page.waitForTimeout(120);
    }
    say(`NOT REACHED here: ${what}`);
    return false;
  };
  const survey = await ask<{ n: number; state: string }[]>("home.survey", { town }).catch(() => []),
    stands = survey.find((x) => x.state === "stands");
  if (stands) {
    await k(`globalThis.causalis.home.open(${JSON.stringify({ town, n: stands.n })})`);
    if (
      await enter(
        "a home",
        () => k<boolean>(`document.body.classList.contains("homing")`),
        slow(30000),
      )
    ) {
      await page.waitForTimeout(slow(600));
      await buttonWell("in a home");
      await shot("10-home");
    }
    await k("globalThis.causalis.home.close()");
    await page.waitForTimeout(slow(500));
  }
  if (await seen(".town-live")) {
    await press(".town-live");
    if (await enter("the sheet of lives", () => seen(".life-picker .life-card"), slow(60000))) {
      await page.waitForTimeout(slow(300));
      await buttonWell("under the sheet of lives", page, true);
      await shot("11-lives");
      await press(".life-picker .life-live");
      if (await enter("a life's strip", () => seen(".life-strip"), slow(90000))) {
        await page.waitForTimeout(slow(600));
        await buttonWell("living a life");
        await shot("12-life");
        if (await seen(".life-walk")) {
          await press(".life-walk");
          if (
            await enter(
              "a life at the hand's pace",
              () => k<boolean>("!!globalThis.causalis.possess.state()"),
              slow(60000),
            )
          ) {
            await page.waitForTimeout(slow(600));
            await buttonWell("possessing");
            await shot("13-possess");
          }
        }
      }
    }
  } else say("NOT REACHED here: Live here is not on this town");
  await loadSave(made, "gate90");
  await touchAnywhere();
  await until("running", async () => (await state()).ctx === "running");
  const book = await ask<{ realms: { ref: string }[] }>("wealth.book").catch(() => null),
    realm = book?.realms[0]?.ref;
  if (realm) {
    await k(`globalThis.causalis.open(${JSON.stringify(`${realm}#leaders`)})`);
    if (await enter("a realm's leaders", () => seen(".leader-rule"), slow(30000))) {
      await press(".leader-rule");
      if (await enter("a ruler's bar", () => seen(".reign-strip"), slow(90000))) {
        await page.waitForTimeout(slow(600));
        await buttonWell("ruling");
        await shot("14-reign");
      }
    }
  } else say("NOT REACHED here: no realm in the wealth book");
  await loadSave(made, "gate90");
  await touchAnywhere();
  await until("running", async () => (await state()).ctx === "running");
  // The greatest fire: by its own film where history holds one; else through the page's own hook, on the real graph.
  const land = await ask<{
      wars: { raids?: { great?: boolean; event: string; town: string }[] }[];
    }>("wars.map").catch(() => null),
    strike = land?.wars.flatMap((w) => w.raids ?? []).find((r) => r.great),
    was = await state();
  if (strike) {
    await k(`void globalThis.causalis.watchRaid(${JSON.stringify(strike.event)})`);
    await until(
      "the greatest fire heard",
      async () => (await state()).played.fire > was.played.fire,
      slow(120000),
    );
    say(`the greatest fire by its film, at ${strike.town}: heard`);
    await shot("15-greatest-fire");
    await k("globalThis.causalis.stopRaidFilm?.()");
  } else {
    say("no greatest fire in this world's history: its hook pressed on the real graph");
    await k(`${S}.fireSeen(-1); ${S}.fireSeen(0);`);
    check(
      (await state()).played.fire === was.played.fire + 1,
      "the greatest fire's hook made no sound",
    );
    const blow = await measure(2500);
    await k(`${S}.fireSeen(1)`);
    check(
      (await state()).played.fire === was.played.fire + 1,
      "the greatest fire sounded twice as its seconds passed",
    );
    say(`the greatest fire, at the speaker: ${dbfs(blow.rms)} dBFS, peak ${blow.peak.toFixed(2)}`);
    check(blow.peak > 0.2 && blow.peak < 1, `the greatest fire at the speaker: peak ${blow.peak}`);
    await k(`${S}.fireSeen(-1)`);
  }
  // A landing, by its own film where this world holds one.
  const life = saveFile ? lifeHere(world) : null,
    landing = life
      ? folksNear(world)
          .flatMap((f) => landfallsOf(world, f, life).map((l) => ({ f, l })))
          .find(({ l }) => l.arrival.visit !== undefined)
      : undefined;
  if (landing) {
    const before2 = await state(),
      L = "globalThis.causalis.landfallFilm";
    await k(
      `void ${L}.play(${JSON.stringify(landing.f.star)}, ${landing.f.planet}, ${landing.l.n})`,
    );
    await enter("a landing's film", () => k<boolean>(`${L}.playing`), slow(30000));
    await until(
      "a landing heard",
      async () => (await state()).played.landing > before2.played.landing,
      slow(90000),
    );
    await buttonWell("over a landing's film");
    await shot("16-landing");
    await press(".film-skip").catch(() => false);
    await until("the landing over", () => k<boolean>(`!${L}.playing`), slow(60000));
    say("a landing by its film: heard, and Skip by touch");
  } else say("NOT REACHED here: no landing in this world to film");
}
// —— A water people.
if (waterFile) {
  const w = openFile(waterFile, "alien"),
    f = pack(w, "alien"),
    t = townOf(w);
  await loadSave(f, "gate90water");
  await touchAnywhere();
  await until("running", async () => (await state()).ctx === "running");
  await k(`globalThis.causalis.goTo(${JSON.stringify(t)})`);
  await until(
    "the water people's town",
    () => k<boolean>(`globalThis.causalis.scale() === "village"`),
    slow(90000),
  );
  await hear("water town", "town");
  await k(`globalThis.causalis.closePage?.()`);
  await closePages();
  await page.waitForTimeout(slow(400));
  const st = await state();
  check(st.air.under, "a water people's town is not heard as under water");
  await shot("08-water-town");
  await buttonWell("in a water people's town");
  const d = unlike(real["water town"]!, real.town!);
  say(`live: water town / town ${d.toFixed(2)}`);
  check(d > Math.max(liveFloor * 2, 2), `a water people's town is near a dry one: ${d.toFixed(2)}`);
  // (Its highs are gone through the water: 5 to 10 kHz next to nothing, at the speaker.)
  const b = real["water town"]!.bands;
  say(`water town, 5 to 10 kHz at the speaker: ${b[7]?.toFixed(0)} dB`);
  check(b[7] !== undefined && b[7] < -65, `the water takes no highs off a town: ${b[7]} dB`);
}
const st9 = await state();
check(st9.errors.length === 0, `errors in the graph: ${st9.errors.join("; ")}`);
check(st9.nodesPeak <= NODE_BOUND, `${st9.nodesPeak} nodes against a bound of ${NODE_BOUND}`);
say(`nodes at worst, this page: ${st9.nodesPeak} of ${NODE_BOUND}; voices ${st9.voicesPeak}`);
await context.close();

// —— 6. No AudioContext at all: the game runs the same, silently, and no button says otherwise.
{
  const bare = await browser.newContext(phone),
    p = await bare.newPage(),
    wrong: string[] = [];
  listen(p, wrong);
  p.setDefaultTimeout(slow(60000));
  await p.addInitScript(() => {
    const g = globalThis as unknown as Record<string, unknown>;
    delete g.AudioContext;
    delete g.OfflineAudioContext;
    delete g.webkitAudioContext;
  });
  await p.goto(`${base}?universe=earth&seed=${encodeURIComponent("first light")}&hold=1`);
  await p.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: slow(180000) },
  );
  await p.touchscreen.tap(60, 640);
  await p.waitForTimeout(slow(400));
  const st = await state(p);
  check(!st.can && st.ctx === "none", `with no AudioContext: ${st.can}, ${st.ctx}`);
  check(
    (await k<number>(`document.querySelectorAll(".sound-button").length`, p)) === 0,
    "a 🔊 with nothing behind it",
  );
  check(wrong.length === 0, `errors with no AudioContext: ${wrong.join("; ").slice(0, 400)}`);
  check(
    (await k<number>("globalThis.causalis.drawn()", p)) > 0,
    "with no AudioContext, nothing is drawn",
  );
  say("no AudioContext: no 🔊, no error, the world drawn");
  await bare.close();
}
// —— The genesis: 🔊 by itself, over nothing.
{
  const dawn = await browser.newContext(phone),
    p = await dawn.newPage(),
    wrong: string[] = [];
  listen(p, wrong);
  p.setDefaultTimeout(slow(60000));
  await p.goto(`${base}?universe=alien&seed=${encodeURIComponent("amber 412")}&genesis=1`);
  await p.waitForSelector(".sound-button", { timeout: slow(90000) });
  await p.waitForTimeout(slow(2500));
  await buttonWell("at the genesis", p);
  if (shots) await p.screenshot({ path: join(shots, "17-genesis.png") }).catch(() => {});
  check(wrong.length === 0, `errors at the genesis: ${wrong.join("; ").slice(0, 300)}`);
  await dawn.close();
}
// —— WebKit, at least loaded.
if (!ci) {
  try {
    const safari = await webkit.launch(),
      c = await safari.newContext({ viewport: phone.viewport, hasTouch: true, isMobile: true }),
      p = await c.newPage(),
      wrong: string[] = [];
    listen(p, wrong);
    await p.goto(`${base}?menu=1`);
    await p.waitForSelector(".title-screen", { timeout: slow(30000) });
    const was = await state(p);
    await p.touchscreen.tap(60, 640);
    await p.waitForTimeout(slow(900));
    const st = await state(p);
    say(
      `WebKit: can make sound: ${st.can}; 🔊 ${(await k<number>(`document.querySelectorAll(".sound-button").length`, p)) > 0 ? "there" : "none"}; before a touch ${was.ctx}, after one ${st.ctx}; graph built ${st.startMs.toFixed(1)} ms; ${st.nodes} nodes; errors ${JSON.stringify([...st.errors, ...wrong]).slice(0, 300)}`,
    );
    check(was.ctx === "none", `WebKit, before a touch: ${was.ctx}`);
    check(st.errors.length === 0, `WebKit graph errors: ${st.errors.join("; ")}`);
    if (shots) await p.screenshot({ path: join(shots, "09-webkit-title.png") });
    await safari.close();
  } catch (e) {
    say(`WebKit could not be loaded here: ${String(e).slice(0, 200)}`);
  }
}

await browser.close();
await server.close();
check(errors.length === 0, `errors in the page: ${errors.join("\n").slice(0, 900)}`);
if (problems.length) {
  console.log(`gate 90: ${problems.length} problem(s)`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("gate 90 passed");
process.exit(0);
