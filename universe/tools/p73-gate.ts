// node tools/p73-gate.ts [--ci] [--soft] [--shots dir] [--save file.save] [--young-save file.save]: gate 87, your hand in it (galaxy-plan.md, Phase 73, first slice), at a phone's size.
// On a far save with real history, else (as on CI) a young world given it for the eye to read:
//   1. 🎬 pressed by touch: the age of the stars, each moment under its own line, its subject on the screen in the pixels; the clock held; history's hashes the same at the end of it as before; Its page pressed;
//   2. the lenses, pressed by touch: each differs from no lens in the pixels, and has its colours said; one on at a time;
//   3. a ship pressed by touch in a fleet's film: aboard, the eye behind her, in the pixels; who is aboard has a page; the screen says it changes nothing; a drag turns the eye; the ship broken with the rider aboard;
//   4. the paths nobody watches: 🎬 on a world with nothing among the stars; a film whose subject is gone; a lens with nothing to show. No error on the page, no raw ref.
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";
import { preview } from "vite";
import { chromium, type Page } from "playwright";
import {
  YEAR,
  loadWorld,
  makeRef,
  rulesetId,
  saveWorld,
  seedFromText,
  type Ref,
  type World,
} from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import {
  STARWAR,
  STARWAR_EVENTS,
  clusterOf,
  filledOf,
  nationsOf,
  politiesOf,
  starWarsOf,
  worldNation,
  type FilledWorld,
  type Holding,
} from "../src/sim/index.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  shots = arg("--shots"),
  saveFile = arg("--save"),
  plainFile = arg("--plain");
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
console.log("gate 87, your hand in it");

type Forged = {
  readonly bytes: Buffer;
  readonly universe: "earth" | "alien";
  readonly seed: string;
};

function pack(world: World, universe: "earth" | "alien"): Forged {
  const u = universe === "earth" ? EARTH : ALIEN;
  return {
    bytes: gzipSync(
      JSON.stringify(saveWorld(world, rulesetId(world, u.version), { universe: u.name })),
    ),
    universe,
    seed: world.seed.text,
  };
}

/** A young world given a realm among the stars and a fleet's battle for one of its worlds. */
function forgeYoung(): Forged {
  const world = EARTH.build(seedFromText("first light"));
  world.runTo(40 * YEAR);
  const realms = politiesOf(world).living(),
    a = realms[0]!,
    filled = filledOf(world)!,
    store = nationsOf(world)!,
    any = world.events.at(0).id as Ref,
    stars = clusterOf(world).slice(0, 12);
  stars.forEach((star, i) => {
    const key = `${star.ref}/0`,
      w: FilledWorld = {
        key,
        body: -1,
        star: star.ref,
        planet: 0,
        cell: null,
        realm: a.ref,
        name: a.town,
        from: a.seat,
        sailed: 5,
        arrives: 15,
        distance: star.distance,
        drive: "fusion",
        lanes: 0,
        comers: 0,
        held: null,
        voyage: any,
        arrived: any,
        people: 2_000_000 + 100_000 * i,
        filled: null,
        filledYear: null,
      };
    filled.add(w);
    const gone = i > 6,
      h: Holding = {
        key,
        star: star.ref,
        planet: 0,
        cell: null,
        index: i,
        holder: gone ? null : a.ref,
        how: "sent",
        since: 20,
        event: any,
        ...(gone ? { left: { from: a.ref, year: 25 + i / 3, event: any } } : {}),
        ...(i === 8 ? { dark: { since: 28, before: 3_000_000, event: any, poor: true } } : {}),
        ...(gone ? { own: { drive: "fusion", lanes: false } } : {}),
      };
    store.add(h);
  });
  store.addNation({
    ref: a.ref,
    realm: a.ref,
    name: a.town,
    seat: null,
    founded: 15,
    event: null,
    worlds: 7,
    greatest: 12,
    greatestYear: 22,
    lostFleet: 36,
    lost: store
      .all()
      .filter((h) => h.left)
      .map((h) => [h.index, h.left!.year, 2_000_000, 20]),
    fell: null,
  });
  const taken = store.all().find((h) => h.left)!,
    battle = world.events.emit({
      type: STARWAR_EVENTS.battle.type,
      subjects: [a.ref, worldNation(taken.index)],
      place: null,
      causes: [{ ref: any, role: "trigger", weight: 1 }],
      data: { won: true, strength: 5, defence: 3.2, year: 38 },
    });
  starWarsOf(world).add({
    ref: makeRef(STARWAR, 0, starWarsOf(world).all().length),
    realm: a.ref,
    enemy: worldNation(taken.index),
    declared: 30,
    event: any,
    sailed: 30,
    arrives: 38,
    strength: 5,
    battle,
    won: true,
    ended: any,
    at: { key: taken.key, star: taken.star, planet: taken.planet },
  });
  return pack(world, "earth");
}

function fromFile(file: string): Forged {
  const universe = file.includes("earth--") ? "earth" : "alien",
    u = universe === "earth" ? EARTH : ALIEN,
    doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as Parameters<
      typeof loadWorld
    >[0],
    probe = u.build(seedFromText(doc.seed)),
    world = loadWorld(doc, (s) => u.build(s), rulesetId(probe, u.version), {
      allowRulesetChange: true,
    }).world;
  return pack(world, universe);
}

/** A young world with nothing among the stars. */
function plainYoung(): Forged {
  const world = EARTH.build(seedFromText("first light"));
  world.runTo(40 * YEAR);
  return pack(world, "earth");
}

const made = saveFile ? fromFile(saveFile) : forgeYoung(),
  plain = plainFile ? fromFile(plainFile) : plainYoung();

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4287, strictPort: false } }),
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
const settleFor = (ms: number) => page.waitForTimeout(slow(ms));
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};
const ask = <T>(type: string, args: unknown = {}) =>
  k<T>(
    `globalThis.causalis.client.query({ type: ${JSON.stringify(type)}, args: ${JSON.stringify(args)} })`,
  );

async function loadSave(f: Forged, tail = "&hold=1") {
  const name = `${f.universe}:gate87`,
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
  await page.goto(`${base}?${q}&load=${encodeURIComponent(name)}${tail}`);
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: slow(180000) },
  );
  await k("globalThis.causalis.client.setSpeed(0)");
}

/** What stands at a point, for a press that would land on the wrong thing. */
const under = (x: number, y: number) =>
  k<string>(
    `(() => { const e = document.elementFromPoint(${x}, ${y}); return e ? (e.className || e.tagName) + "" : "nothing"; })()`,
  );

/** Press what a selector names, by touch, where it stands once it has stopped moving; true if what it hit was it. */
async function press(selector: string, thumb = true): Promise<boolean> {
  const place = () =>
    k<{ x: number; y: number; w: number; h: number } | null>(`(() => {
    for (const e of document.querySelectorAll(${JSON.stringify(selector)})) {
      const r = e.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
    }
    return null;
  })()`);
  let at = await place();
  for (let i = 0; i < 12 && at; i++) {
    await page.waitForTimeout(slow(60));
    const again = await place();
    if (again && Math.abs(again.x - at.x) < 0.5 && Math.abs(again.y - at.y) < 0.5) break;
    at = again;
  }
  if (!at) {
    problems.push(`nothing to press at ${selector}`);
    return false;
  }
  check(
    !thumb || Math.min(at.w, at.h) >= 43.5,
    `${selector} is ${Math.round(at.w)} by ${Math.round(at.h)}, under a thumb's 44`,
  );
  const hit = await k<boolean>(`(() => {
    const e = document.elementFromPoint(${at.x}, ${at.y}), t = document.querySelector(${JSON.stringify(selector)});
    return !!e && !!t && (e === t || t.contains(e));
  })()`);
  if (!hit) problems.push(`${selector}: a tap there lands on ${await under(at.x, at.y)}`);
  await page.touchscreen.tap(at.x, at.y);
  await page.waitForTimeout(slow(300));
  say(`pressed ${selector} at ${Math.round(at.x)},${Math.round(at.y)}`);
  return hit;
}

/** The share of a part of the shot (0 … 1 of its height) that differs between two shots. */
async function unlike(a: string, b: string, from = 0, to = 1): Promise<number> {
  return page.evaluate(
    async ([a, b, from, to]) => {
      const load = async (d: string) => {
          const bm = await createImageBitmap(
              await (await fetch(`data:image/png;base64,${d}`)).blob(),
            ),
            c = new OffscreenCanvas(bm.width, bm.height),
            x = c.getContext("2d")!;
          x.drawImage(bm, 0, 0);
          return { x, w: bm.width, h: bm.height };
        },
        A = await load(a as string),
        B = await load(b as string),
        top = Math.round(A.h * (from as number)),
        high = Math.round(A.h * ((to as number) - (from as number))),
        pa = A.x.getImageData(0, top, A.w, high).data,
        pb = B.x.getImageData(0, top, A.w, high).data;
      let n = 0;
      for (let i = 0; i < pa.length; i += 4)
        if (
          Math.abs(pa[i]! - pb[i]!) +
            Math.abs(pa[i + 1]! - pb[i + 1]!) +
            Math.abs(pa[i + 2]! - pb[i + 2]!) >
          60
        )
          n++;
      return n / (pa.length / 4);
    },
    [a, b, from, to] as const,
  );
}

/** The share of the shot's middle not nearly black, and how many tones it holds: a shot of nothing has neither. */
async function looked(d: string): Promise<{ lit: number; tones: number }> {
  return page.evaluate(async (data) => {
    const bm = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob()),
      c = new OffscreenCanvas(bm.width, bm.height),
      x = c.getContext("2d")!;
    x.drawImage(bm, 0, 0);
    const top = Math.round(bm.height * 0.25),
      px = x.getImageData(0, top, bm.width, Math.round(bm.height * 0.45)).data,
      tones = new Set<number>();
    let lit = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i]! + px[i + 1]! + px[i + 2]! > 60) lit++;
      tones.add(((px[i]! >> 4) << 8) | ((px[i + 1]! >> 4) << 4) | (px[i + 2]! >> 4));
    }
    return { lit: lit / (px.length / 4), tones: tones.size };
  }, d);
}

/** How much of a shot's map is this colour, flat. */
async function colorShare(d: string, rgb: readonly [number, number, number]): Promise<number> {
  return page.evaluate(
    async ([data, want]) => {
      const bm = await createImageBitmap(
          await (await fetch(`data:image/png;base64,${data as string}`)).blob(),
        ),
        c = new OffscreenCanvas(bm.width, bm.height),
        x = c.getContext("2d")!;
      x.drawImage(bm, 0, 0);
      const w = want as readonly number[],
        top = Math.round(bm.height * 0.25),
        h = Math.round(bm.height * 0.6),
        px = x.getImageData(0, top, bm.width, h).data;
      let n = 0;
      for (let i = 0; i < px.length; i += 4)
        if (
          Math.abs(px[i]! / 255 - w[0]!) +
            Math.abs(px[i + 1]! / 255 - w[1]!) +
            Math.abs(px[i + 2]! / 255 - w[2]!) <
          0.14
        )
          n++;
      return n / (px.length / 4);
    },
    [d, [...rgb]] as const,
  );
}

const png = async () => (await page.screenshot()).toString("base64");
const words = () => k<string>(`document.body.innerText`);
const closePage = () => k("globalThis.causalis.closePage?.()");
const rawRef = /\b(?:pol|snat|swar|ev|star|civ|run|folk|gstar):\d+:\d+/;
const hashes = () => ask<Record<string, string>>("hashes");
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
type DirectorNow = {
  watching: boolean;
  told: string;
  take: { kind: string; words: string } | null;
  filming: boolean;
  touring: boolean;
  tourAt: number;
  tourOf: number;
  stop: string | null;
};
const director = () => k<DirectorNow>("globalThis.causalis.director()");

// —— The path nobody watches first: 🎬 on a world with nothing among the stars.
await loadSave(plain);
await settleFor(1200);
{
  const tour = await ask<{ stops: unknown[]; lenses: unknown[] }>("star.tour");
  say(
    `a world with nothing among the stars: ${tour.stops.length} moments, ${tour.lenses.length} lenses`,
  );
  check(
    tour.stops.length === 0,
    `a world with nothing among the stars has ${tour.stops.length} moments of them`,
  );
  check(tour.lenses.length === 0, "a world with nothing among the stars goes round them");
  await k("globalThis.causalis.client.setSpeed(0)");
  await press(".director-button");
  await settleFor(400);
  const d = await director();
  check(d.watching, "🎬 did nothing on a world with nothing among the stars");
  check(!d.touring, "🎬 tells an age of the stars on a world with none");
  await shot("plain-director");
  await k("globalThis.causalis.watchIt(false)");
  // A lens with nothing to show: it says so.
  await k("globalThis.causalis.stars()");
  await until("the stars", () => k<boolean>(`!!globalThis.causalis.starLens?.()`));
  await settleFor(1500);
  for (const lens of ["trade", "war"] as const) {
    await press(`.star-lens[data-lens="${lens}"]`);
    await settleFor(1800);
    const said = await k<string>(`document.querySelector(".star-lens-legend").innerText`);
    say(`${lens} with nothing: ${said.replace(/\n/g, " / ")}`);
    check(/yet/i.test(said), `the ${lens} lens with nothing to show says "${said}"`);
    check(
      (await k<{ marks: number }>("globalThis.causalis.starLens()")).marks === 0,
      `the ${lens} lens draws something where there is nothing`,
    );
    await shot(`plain-${lens}`);
  }
}

await loadSave(made);
await settleFor(1500);
const before = await hashes(),
  nowAt = () => ask<number>("world.now").catch(() => 0);
const tour = await ask<{
  stops: {
    key: string;
    year: number;
    words: string;
    page: string | null;
    film: { kind: string };
  }[];
  lenses: string[];
}>("star.tour");
say(
  `the age here: ${tour.stops.map((s) => `${s.key} ${s.year}`).join(", ")}; lenses ${tour.lenses.join(", ")}`,
);
for (const s of tour.stops) say(`  ${s.words}`);
check(tour.stops.length >= (saveFile ? 5 : 1), `only ${tour.stops.length} moments to show`);
check(
  tour.stops.every((s, i) => i === 0 || s.year >= tour.stops[i - 1]!.year),
  "the moments are out of order",
);
check(!rawRef.test(tour.stops.map((s) => s.words).join(" ")), "a raw ref in the moments' words");
void nowAt;

// —— 1. 🎬 pressed by touch.
await press(".director-button");
await until("the eye on the age of the stars", async () => (await director()).touring);
await until("the stars around first", async () => (await director()).take?.kind === "stars");
await settleFor(1200);
await shot("tour-open");
{
  const opened = await director();
  say(`opened: ${opened.told}`);
  check(/age of the stars/i.test(opened.told), `the first word is "${opened.told}"`);
  check(
    /moments?/.test(opened.told),
    `the first word does not say how many moments: "${opened.told}"`,
  );
}
const seenStops = new Map<string, { lit: number; tones: number; words: string }>();
{
  // Each moment in turn, a look at what is on the screen, then on to the next.
  const end = Date.now() + slow(tour.stops.length * 70000);
  let last = "",
    lastN = 0;
  while (Date.now() < end) {
    const d = await director();
    if (!d.touring || !d.watching) break;
    if (d.stop && d.stop !== last) {
      last = d.stop;
      lastN = d.tourAt;
      // (Its subject has had time to come on: a film's first shot, a cut, a fade.)
      const key = d.stop;
      // (Not slowed as much as the rest: a short film under a slow renderer is over by then.)
      await page.waitForTimeout(key === "fleet" ? 9000 : 3800);
      const now = await director();
      if (now.stop !== key) continue;
      const shotNow = await png();
      // (A slow shot may outlast the moment: then it says nothing of it.)
      if ((await director()).stop !== key) continue;
      if (shots)
        await page.screenshot({
          path: join(shots, `stop-${String(lastN).padStart(2, "0")}-${key}.png`),
        });
      const look = await looked(shotNow),
        line = await k<{ text: string; shown: boolean; top: number; bottom: number }>(`(() => {
          const e = document.querySelector(".tour-line"), r = e.getBoundingClientRect();
          return { text: e.innerText, shown: !e.hidden && r.height > 0, top: r.top, bottom: r.bottom };
        })()`);
      seenStops.set(key, { ...look, words: line.text });
      say(
        `${lastN} of ${d.tourOf} ${key}: lit ${(look.lit * 100).toFixed(0)}%, ${look.tones} tones; line ${Math.round(line.top)} to ${Math.round(line.bottom)}: ${line.text.replace(/\n/g, " / ").slice(0, 110)}`,
      );
      check(line.shown, `no line over the moment ${key}`);
      check(/Next/i.test(line.text), `the line over ${key} offers no way on`);
      check(!rawRef.test(line.text), `a raw ref on the line over ${key}`);
      check(
        look.tones > 24,
        `the moment ${key} shows ${look.tones} tones at its middle: nothing is on the screen`,
      );
      // Hashes while the clock is still held, in the middle of the telling.
      if (d.tourAt === d.tourOf) {
        const during = await hashes();
        check(same(before, during), "watching the age of the stars moved history");
        say(`history's hashes at the last moment: ${same(before, during) ? "the same" : "MOVED"}`);
      }
      await press(".tour-next");
      await until(
        `past the moment ${key}`,
        async () => (await director()).stop !== key,
        slow(60000),
      );
    } else await page.waitForTimeout(100);
  }
  check(
    seenStops.size >= Math.min(tour.stops.length, saveFile ? 4 : 1),
    `only ${seenStops.size} moments were seen on the screen`,
  );
}
// (What the tour ended on: the clock let go, the round among the stars.)
{
  const after = await director();
  check(!after.touring, "the telling never ended");
  await until(
    "the round among the stars",
    async () => (await director()).take?.kind === "stars",
    slow(30000),
  );
  const d = await director();
  say(`after the telling: ${d.take?.kind}, "${d.told}"`);
  check(
    (await k<string>(`document.querySelector("body").className`)).includes("filming") === false,
    "the film's chrome outlived the telling",
  );
  await settleFor(600);
  await shot("round");
  await k("globalThis.causalis.watchIt(false)");
  await k("globalThis.causalis.client.setSpeed(0)");
}

// —— Its page: the line's other way out, on a fresh telling.
await loadSave(made);
await settleFor(1200);
{
  const was = await hashes();
  await press(".director-button");
  await until("the first moment", async () => !!(await director()).stop, slow(40000));
  await settleFor(2500);
  const d = await director();
  const stop = tour.stops.find((s) => s.key === d.stop);
  if (stop?.page) {
    await press(".tour-page");
    await until(
      "its page",
      () => k<boolean>(`!!document.querySelector(".page-window:not([hidden])")`),
      slow(60000),
    );
    await settleFor(800);
    await shot("stop-page");
    const said = await words();
    check(!rawRef.test(said), `a raw ref on the page of ${stop.key}: ${rawRef.exec(said)?.[0]}`);
    const after = await director();
    check(!after.watching, "the eye goes on over a page it was asked to stop at");
    await closePage();
  } else say(`the first moment, ${d.stop}, has no page`);
  await k("globalThis.causalis.client.setSpeed(0)");
  void was;
}

// —— 2. The lenses, by touch.
await loadSave(made);
await settleFor(1200);
await k("globalThis.causalis.stars()");
await until("the stars", () => k<boolean>(`!!globalThis.causalis.starLens?.()`));
await settleFor(2500);
await press(".panel:not([hidden]) .inspector .close", false);
await settleFor(800);
await shot("lens-holds");
{
  const was = await hashes(),
    holdsShot = await png(),
    legendShown = await k<boolean>(`!document.querySelector(".star-lens-legend").hidden`);
  check(legendShown, "no legend under the lens on");
  // No lens: tapped again.
  await press(`.star-lens[data-lens="holds"]`);
  await settleFor(2600);
  const off = await png();
  await shot("lens-off");
  const offState = await k<{ lens: string | null }>("globalThis.causalis.starLens()");
  check(offState.lens === null, "a lens tapped again stays on");
  check(
    await k<boolean>(`document.querySelector(".star-lens-legend").hidden`),
    "the legend stays with no lens on",
  );
  const holdsApart = await unlike(off, holdsShot, 0.25, 0.85);
  say(`who holds against no lens: ${(holdsApart * 100).toFixed(2)}% of the map differs`);
  check(holdsApart > 0.004, `who holds and no lens are alike: ${(holdsApart * 100).toFixed(2)}%`);
  const shotsOf = new Map<string, string>([["holds", holdsShot]]);
  for (const lens of ["peoples", "lanes", "trade", "war"] as const) {
    await press(`.star-lens[data-lens="${lens}"]`);
    await settleFor(3000);
    const s = await png();
    shotsOf.set(lens, s);
    await shot(`lens-${lens}`);
    const st = await k<{ lens: string | null; marks: number; lines: number; note: string | null }>(
        "globalThis.causalis.starLens()",
      ),
      on = await k<number>(`document.querySelectorAll(".star-lens.on").length`),
      said = await k<string>(`document.querySelector(".star-lens-legend").innerText`),
      apart = await unlike(off, s, 0.25, 0.85);
    say(
      `${lens}: ${st.marks} marks, ${st.lines} lines; ${(apart * 100).toFixed(2)}% differs; ${said.replace(/\n/g, " / ").slice(0, 200)}`,
    );
    check(st.lens === lens, `the ${lens} lens did not come on`);
    check(on === 1, `${on} lenses lit at once`);
    check(said.length > 8, `the ${lens} lens says nothing of its colours`);
    check(!rawRef.test(said), `a raw ref under the ${lens} lens`);
    if (st.marks || st.lines)
      check(
        apart > 0.002,
        `the ${lens} lens has ${st.marks} marks and looks like no lens: ${(apart * 100).toFixed(2)}%`,
      );
    if (lens === "lanes") check(apart > 0.004, "the lanes lens does not change the map");
  }
  // Each from the others.
  const names = [...shotsOf.keys()];
  for (let i = 0; i < names.length; i++)
    for (let j = i + 1; j < names.length; j++) {
      const a = names[i]!,
        b = names[j]!,
        apart = await unlike(shotsOf.get(a)!, shotsOf.get(b)!, 0.25, 0.85);
      check(apart > 0.002, `${a} and ${b} look alike: ${(apart * 100).toFixed(2)}%`);
    }
  // Back to who holds: the chips and its discs again.
  await press(`.star-lens[data-lens="holds"]`);
  await settleFor(2600);
  check(
    await k<boolean>(
      `!!globalThis.causalis.starLens() && (globalThis.causalis.nationsShown?.() ?? 0) > 0`,
    ),
    "who holds did not come back",
  );
  const during = await hashes();
  check(same(was, during), "the lenses moved history");
  say(`history's hashes after the lenses: ${same(was, during) ? "the same" : "MOVED"}`);
  // What each read costs, the worst of them, a second time (the first reads every people).
  const cost = await k<Record<string, number>>(`(async () => {
    const out = {};
    for (const lens of ["peoples", "lanes", "trade", "war"]) {
      await globalThis.causalis.client.query({ type: "star.lens", args: { lens } });
      const t = performance.now();
      await globalThis.causalis.client.query({ type: "star.lens", args: { lens } });
      out[lens] = Math.round(performance.now() - t);
    }
    return out;
  })()`);
  say(`a lens's read, again, ms: ${JSON.stringify(cost)}`);
}

// —— 3. A ship pressed by touch.
{
  const fights = await ask<{ best: string | null; fights: { id: string; ships: boolean }[] }>(
      "star.fights",
    ),
    id = fights.best;
  check(!!id, "no fight to ride in");
  if (id) {
    const was = await hashes(),
      f = "globalThis.causalis.fleetFilm";
    await k(`void ${f}.play(${JSON.stringify(id)})`);
    await until(
      "the fleet's film",
      () => k<boolean>(`${f}.playing && ${f}.state().act === "orbit" && !${f}.state().cutting`),
      slow(60000),
    );
    // (Into the fight: they have come, and something to see.)
    await k(`${f}.pause(true)`);
    const st = await k<{ end: number }>(`${f}.state()`);
    await k(`${f}.scrub(${(12 / 48).toFixed(3)})`);
    await settleFor(600);
    void st;
    const whole = await png();
    await shot("ride-whole");
    const hint = await k<boolean>(`${f}.playing`);
    void hint;
    const ship = await k<{ x: number; y: number } | null>(`${f}.shipOnScreen(0)`);
    check(!!ship, "no ship on the screen to press");
    if (ship) {
      await page.touchscreen.tap(ship.x, ship.y);
      await until("aboard a ship", async () => !!(await k(`${f}.riding()`)));
      await until("who is aboard", async () => {
        const r = await k<{ crew: string | null } | null>(`${f}.riding()`);
        return !!r && (await k<string>(`document.querySelector(".ride-who").textContent`)) !== "…";
      });
      await settleFor(700);
      await shot("ride-aboard");
      const r = await k<{
          ship: string;
          id: number;
          crew: string | null;
          crewRef: string | null;
          alive: boolean;
          onScreen: { x: number; y: number } | null;
        }>(`${f}.riding()`),
        aboard = await png(),
        apart = await unlike(whole, aboard, 0.1, 0.65),
        note = await k<string>(`document.querySelector(".ride-note").innerText`);
      say(
        `aboard the ${r.ship} with ${r.crew}: ${(apart * 100).toFixed(1)}% of the view differs; ship at ${JSON.stringify(r.onScreen)}: ${note}`,
      );
      check(apart > 0.03, `going aboard changes ${(apart * 100).toFixed(2)}% of the view`);
      check(
        /changes nothing/i.test(note),
        `the screen does not say riding changes nothing: ${note}`,
      );
      check(!!r.onScreen, "the ship ridden is not on the screen");
      if (r.onScreen) {
        const hudTop = await k<number>(
          `document.querySelector(".ride-hud").getBoundingClientRect().top`,
        );
        check(
          Math.abs(r.onScreen.x - 215) < 130 && r.onScreen.y > 150 && r.onScreen.y < hudTop - 10,
          `the ship ridden stands at ${Math.round(r.onScreen.x)},${Math.round(r.onScreen.y)}, the controls from ${Math.round(hudTop)}: not clear in the shot`,
        );
      }
      // Her page, and who is with us.
      await press(".ride-ship");
      await until("the ship's page", () =>
        k<boolean>(`/not ship by ship/i.test(document.body.innerText)`),
      );
      await settleFor(500);
      await shot("ride-ship-page");
      {
        const said = await words();
        check(!rawRef.test(said), `a raw ref on the ship's page: ${rawRef.exec(said)?.[0]}`);
        if (r.crew) check(said.includes(r.crew), `the ship's page does not name ${r.crew}`);
        check(/not ship by ship/i.test(said), "the ship's page has lost its words");
      }
      await closePage();
      await settleFor(300);
      // (Those of a world gone its own way are named nowhere; a realm's are.)
      if (!r.crewRef) {
        await k(`${f}.ride(0)`);
        await until(
          "who is aboard a ship of the realm",
          async () => (await k<string>(`document.querySelector(".ride-who").textContent`)) !== "…",
        );
        await settleFor(300);
        const r0 = await k<{ crew: string | null; crewRef: string | null }>(`${f}.riding()`);
        r.crew = r0.crew;
        r.crewRef = r0.crewRef;
        say(`aboard a ship of the attacker, with ${r.crew}`);
      }
      if (r.crewRef) {
        await press(".ride-who");
        await until("the page of who is aboard", () =>
          k<boolean>(
            `!!document.querySelector(".page-window:not([hidden])") && !/^…$/.test(document.querySelector(".page-title")?.textContent ?? "")`,
          ),
        );
        await settleFor(600);
        await shot("ride-crew-page");
        const said = await words();
        check(
          !/no such|unknown/i.test(
            await k<string>(`document.querySelector(".page-window").innerText`),
          ),
          "the page of who is aboard is no one's",
        );
        check(!rawRef.test(said), `a raw ref on the crew's page: ${rawRef.exec(said)?.[0]}`);
        await closePage();
        await settleFor(300);
      } else problems.push("no ship of this fight has anyone aboard to read");
      // A drag turns the eye: one thumb.
      {
        const a = await png();
        await page.evaluate(() => {
          const c = document.querySelector("canvas")!,
            at = (x: number, y: number, type: string, buttons: number) =>
              c.dispatchEvent(
                new PointerEvent(type, {
                  bubbles: true,
                  pointerId: 7,
                  pointerType: "touch",
                  clientX: x,
                  clientY: y,
                  buttons,
                }),
              );
          at(120, 400, "pointerdown", 1);
          at(170, 400, "pointermove", 1);
          at(260, 420, "pointermove", 1);
          at(260, 420, "pointerup", 0);
        });
        await settleFor(500);
        const b = await png(),
          turned = await unlike(a, b, 0.1, 0.65);
        say(`a drag aboard: ${(turned * 100).toFixed(1)}% of the view differs`);
        check(turned > 0.01, `a drag aboard turns nothing: ${(turned * 100).toFixed(2)}%`);
        check(!!(await k(`${f}.riding()`)), "a drag aboard put the rider off");
      }
      // Next ship.
      await press(".ride-next");
      await settleFor(400);
      const r2 = await k<{ id: number } | null>(`${f}.riding()`);
      check(!!r2 && r2.id !== r.id, "Next ship stays on the same ship");
      await shot("ride-next");
      // A ship that dies with them aboard.
      const doomed = await k<number | null>(`(() => {
        const s = ${f}.sample();
        return null;
      })()`);
      void doomed;
      const script = await ask<unknown>("star.fight", { id });
      void script;
      const brk = await k<{ id: number; at: number } | null>(`${f}.doomed?.() ?? null`);
      if (brk) {
        await k(`${f}.ride(${brk.id})`);
        const end = (await k<{ end: number }>(`${f}.state()`)).end;
        await k(`${f}.scrub(${((brk.at - 0.4) / end).toFixed(4)})`);
        await settleFor(200);
        check(!!(await k(`${f}.riding()`)), "could not ride a ship that will break");
        await k(`${f}.pause(false)`);
        await until(
          "the ship broken up",
          () => k<boolean>(`!!${f}.riding() && ${f}.riding().broke`),
          slow(15000),
        );
        await settleFor(500);
        await shot("ride-broken");
        const said = await k<string>(`document.querySelector(".ride-note").innerText`);
        say(`broken: ${said}`);
        check(/broken up/i.test(said), `her breaking up is not told: ${said}`);
        await until(
          "back to the whole fight",
          async () => !(await k(`${f}.riding()`)),
          slow(20000),
        );
        check(await k<boolean>(`${f}.playing`), "the film stopped when the ship ridden broke");
        await shot("ride-after");
      } else say("no ship breaks in this fight");
      const during = await hashes();
      check(same(was, during), "riding moved history");
      say(`history's hashes after riding: ${same(was, during) ? "the same" : "MOVED"}`);
    }
    await k(`${f}.skip()`);
    await settleFor(400);
    await k(`${f}.skip()`);
    await until("the fleet's film over", () => k<boolean>(`!${f}.playing`), slow(40000));
  }
}

// —— 4. A film whose subject has gone: the eye goes on, and no error.
await k(`globalThis.causalis.farFilm.play("ev:0:999999").then((ok) => (globalThis.__gone = ok))`);
await settleFor(500);
check((await k<boolean>("globalThis.__gone")) === false, "a film of nothing played");
await k(
  `globalThis.causalis.nationFilm.play("pol:0:999999").then((ok) => (globalThis.__gone2 = ok))`,
);
await settleFor(500);
check((await k<boolean>("globalThis.__gone2")) === false, "a realm of nothing played");

if (errors.length) problems.push(`errors on the page:\n${errors.slice(0, 5).join("\n")}`);
await browser.close();
await server.close();
if (problems.length) {
  console.log(`gate 87 FAILED:\n- ${problems.join("\n- ")}`);
  process.exitCode = 1;
} else console.log("gate 87 passed");
process.exit();
