// node tools/l6-gate.ts [--ci] [--soft] [--shots dir] [--save file.save] [--alien file.save]: gate 86, a home you can look into (Lives L6, first slice), at a phone's size, by real touch.
// On far saves, else (as on CI) a young world run a few decades:
//   1. the rule: the same home, the same things; no wood, no wooden bed; a people of the water, no bed and no hearth; where nothing burns, no fire; poor against rich;
//   2. a home's page opened, 🏠 Look in pressed by touch: the town put away, the roof off, its clock held, hashes the same before and after;
//   3. something in it tapped by touch: its page says what it is for, what it is made of and what it is worth; someone in it tapped, and their sheet;
//   4. in the pixels: a poor home and a rich one, a young home and a far one, look different: how many colours they show;
//   5. the paths nobody watches: a home with no one in it, a ruin, the first homes of a young world, a ruler's, a water people's. No error, no raw ref, no sentence wrong at its one.
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
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { furnish, roomsOf, type DwellingFacts } from "../src/rules/index.ts";
import { populationContext } from "../src/sim/index.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  shots = arg("--shots"),
  saveFile = arg("--save"),
  alienFile = arg("--alien");
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
console.log("gate 86, a home you can look into");

// 1. The rule, pure.
{
  const facts = (o: Partial<DwellingFacts>): DwellingFacts => ({
    key: 77,
    level: 1,
    form: "square",
    walls: "timber",
    people: 4,
    medium: "land",
    grips: true,
    scale: 1,
    burns: true,
    heat: null,
    warmth: 15,
    knows: () => true,
    coin: 5000,
    price: (g) => [1, 1.4, 1, 2, 1.6, 8, 6, 5, 3, 2, 3, 24, 12, 5][g] ?? 1,
    wood: true,
    cloth: true,
    vessel: "clay",
    metal: "iron",
    work: ["weaver"],
    fought: false,
    court: false,
    noHouses: false,
    ruin: 0,
    ...o,
  });
  const ways = (f: DwellingFacts) => furnish(f).things.map((t) => t.way);
  check(
    JSON.stringify(furnish(facts({}))) === JSON.stringify(furnish(facts({}))),
    "the same home does not hold the same things",
  );
  const poor = furnish(facts({ coin: 60, level: 0 })),
    rich = furnish(facts({ coin: 200000, level: 2, court: true }));
  check(poor.rooms.length === 1, `the poorest have ${poor.rooms.length} rooms`);
  check(rich.rooms.length >= 6, `the richest have ${rich.rooms.length} rooms`);
  check(
    rich.things.length >= poor.things.length + 12,
    `rich ${rich.things.length} things, poor ${poor.things.length}`,
  );
  check(roomsOf(facts({ coin: 1e7, level: 0 })) === 1, "a hut gave more than one room");
  check(
    !furnish(facts({ wood: false, coin: 1e6 })).things.some((t) => t.stuff === "wood"),
    "a land with no wood has a wooden thing",
  );
  const sea = ways(facts({ medium: "water", burns: false, grips: false, coin: 1e5 }));
  check(
    !sea.some((w) => /bed|hearth|stove|table|lamp/.test(w)),
    `a water people have ${sea.join()}`,
  );
  check(
    sea.some((w) => /hollow|hammock/.test(w)),
    "a water people sleep nowhere",
  );
  const cold = ways(facts({ burns: false, coin: 200, knows: () => false }));
  check(
    !cold.some((w) => /hearth|stove|lamp/.test(w)),
    `where nothing burns they have ${cold.join()}`,
  );
  const fallen = furnish(facts({ ruin: 2 }));
  check(
    fallen.things.every((t) => t.need === "ruin"),
    "a ruin holds a family's things",
  );
  const off = furnish(facts({ coin: 3e6, level: 2 }));
  for (const t of off.things) {
    const r = off.rooms[t.room]!;
    check(
      Math.abs(t.x - r.x) <= r.w / 2 + 0.05 && Math.abs(t.z - r.z) <= r.d / 2 + 0.05,
      `${t.way} stands outside its room`,
    );
  }
}

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
  const world = EARTH.build(seedFromText("first light"));
  world.runTo(30 * YEAR);
  return pack(world, "earth");
};

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4286, strictPort: false } }),
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
  const name = `${f.universe}:gate86`,
    q = `universe=${f.universe}&seed=${encodeURIComponent(f.seed)}`;
  await page.goto(`${base}?${q}&hold=1`);
  await page.waitForFunction(
    () => !!(globalThis as { causalis?: { client?: unknown } }).causalis?.client,
    undefined,
    {
      timeout: slow(120000),
    },
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

async function press(selector: string): Promise<boolean> {
  const where = () =>
    k<{ x: number; y: number; w: number; h: number } | null>(`(() => {
    for (const e of document.querySelectorAll(${JSON.stringify(selector)})) {
      e.scrollIntoView({ block: "center" });
      const r = e.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
    }
    return null;
  })()`);
  let at = await where();
  if (!at) {
    problems.push(`nothing to press at ${selector}`);
    return false;
  }
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(slow(120));
    const now = await where();
    if (!now) break;
    if (now.x === at.x && now.y === at.y) break;
    at = now;
  }
  check(at.h >= 44, `${selector} is ${Math.round(at.h)} px tall`);
  await page.touchscreen.tap(at.x, at.y);
  await page.waitForTimeout(slow(300));
  return true;
}

type Spot = {
  kind: string;
  n: number;
  x: number;
  y: number;
  way: string | null;
  shape: string | null;
};
type Survey = {
  n: number;
  level: number;
  state: string;
  coin: number;
  rooms: number;
  people: number;
  figure: boolean;
};
type HomeState = {
  ref: string;
  title: string;
  line: string;
  state: string;
  level: number;
  coin: number;
  rooms: number;
  things: string[];
  folk: { name: string; at: string; doing: string }[];
  lifted: boolean;
  flying: boolean;
  builtMs: number;
  sceneMs: number;
  parts: number;
};
const homeState = () => k<HomeState | null>("globalThis.causalis.home.state()"),
  spots = () => k<Spot[]>("globalThis.causalis.home.spots()");
const pageText = () => k<string>(`document.querySelector(".page-window")?.innerText ?? ""`);
/** A page's words checked: no raw ref, no wrong one. */
const readWell = (text: string, where: string) => {
  check(
    !/\b(dwell|dwelt|lot|bldg|folk|agent):[a-z0-9]/i.test(text),
    `a raw ref on ${where}: ${text.slice(0, 200)}`,
  );
  check(
    !/\b1 (rooms|people|years|homes|lots)\b/.test(text),
    `"1 ..." wrong on ${where}: ${text.slice(0, 300)}`,
  );
  check(!/undefined|NaN|\[object/.test(text), `a broken word on ${where}: ${text.slice(0, 300)}`);
};

/** How many colours a shot of the home shows, what share of it is bright, and how like another it is. */
const colourOf = (d: string): Promise<{ colours: number; bright: number }> =>
  page.evaluate(async (data) => {
    const bm = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob()),
      c = new OffscreenCanvas(bm.width, bm.height),
      x = c.getContext("2d")!;
    x.drawImage(bm, 0, 0);
    const top = Math.round(bm.height * 0.17),
      h = Math.round(bm.height * 0.68),
      px = x.getImageData(0, top, bm.width, h).data,
      seen = new Map<number, number>();
    let bright = 0;
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i]!,
        g = px[i + 1]!,
        b = px[i + 2]!,
        key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      seen.set(key, (seen.get(key) ?? 0) + 1);
      const hi = Math.max(r, g, b),
        lo = Math.min(r, g, b);
      if (hi - lo > 70) bright++;
    }
    const total = px.length / 4;
    let colours = 0;
    for (const n of seen.values()) if (n / total > 0.0015) colours++;
    return { colours, bright: bright / total };
  }, d);
const unlike = (a: string, b: string): Promise<number> =>
  page.evaluate(
    async ([p, q]) => {
      const read = async (d: string) => {
        const bm = await createImageBitmap(
            await (await fetch(`data:image/png;base64,${d}`)).blob(),
          ),
          c = new OffscreenCanvas(bm.width, bm.height),
          x = c.getContext("2d")!;
        x.drawImage(bm, 0, 0);
        return x.getImageData(
          0,
          Math.round(bm.height * 0.17),
          bm.width,
          Math.round(bm.height * 0.68),
        ).data;
      };
      const A = await read(p as string),
        B = await read(q as string);
      let n = 0;
      for (let i = 0; i < A.length; i += 16)
        if (
          Math.abs(A[i]! - B[i]!) +
            Math.abs(A[i + 1]! - B[i + 1]!) +
            Math.abs(A[i + 2]! - B[i + 2]!) >
          60
        )
          n++;
      return n / (A.length / 16);
    },
    [a, b] as const,
  );

const openHome = async (town: string, n: number): Promise<HomeState | null> => {
  const why = await k<string | null>(
    `globalThis.causalis.home.open(${JSON.stringify({ town, n })})`,
  );
  if (why) {
    problems.push(`home ${n} of ${town}: ${why}`);
    return null;
  }
  await until("its roof lifted", async () => {
    const s = await homeState();
    return !!s && s.lifted && !s.flying;
  });
  await page.waitForTimeout(slow(250));
  return homeState();
};
const closeHome = async () => {
  await k("globalThis.causalis.home.close()");
  await page.waitForTimeout(slow(120));
};
/** The town the eye goes down to. */
async function goDown(ref: string): Promise<void> {
  await k(`globalThis.causalis.goTo(${JSON.stringify(ref)})`);
  await until(
    "the town",
    () =>
      k<boolean>(
        `globalThis.causalis.scale() === "village" && globalThis.causalis.planNow()?.ref === ${JSON.stringify(ref)}`,
      ),
    slow(60000),
  );
  await page.waitForTimeout(slow(800));
}
/** The world as a save holds it, to look through its towns for a home of a kind the one looked at lacks. */
let lookThrough: (test: (s: Survey) => boolean) => { town: string; home: Survey } | null = () =>
  null;
/** The town to look at: the one with the most lots standing, the eye gone to it. */
async function toTown(world: Forged): Promise<string> {
  const doc = JSON.parse(gunzipSync(world.bytes).toString("utf8")) as Parameters<
      typeof loadWorld
    >[0],
    u = world.universe === "earth" ? EARTH : ALIEN,
    w = loadWorld(doc, (s) => u.build(s), rulesetId(u.build(seedFromText(doc.seed)), u.version), {
      allowRulesetChange: true,
    }).world,
    towns = [...populationContext(w).settlements.all()]
      .filter((s) => s.population > 0)
      .sort((a, b) => b.population - a.population),
    // (A town big enough to show rich and poor, not one so great its lots are all one tower: the second rank of them.)
    town = towns[Math.min(towns.length - 1, Math.floor(towns.length * 0.02))]!;
  say(`${towns.length} towns; looking at ${town.name}, ${Math.round(town.population)} people`);
  lookThrough = (test) => {
    for (const s of towns.slice(0, 600)) {
      const home = (u.queries["home.survey"]!(w, { town: s.ref }) as Survey[]).find(test);
      if (home) return { town: s.ref, home };
    }
    return null;
  };
  await goDown(town.ref);
  return town.ref;
}

// 2–4. A far world (or a young one).
const made = saveFile ? fromFile(saveFile, "earth") : youngWorld();
await loadSave(made);
const town = await toTown(made);
const survey = await ask<Survey[]>("home.survey", { town });
say(
  `${survey.length} homes read: ${survey.filter((s) => s.state === "stands").length} standing, ${survey.filter((s) => s.people > 0).length} with people known`,
);
check(survey.length > 0, "no home in the town");
const standing = survey.filter((s) => s.state === "stands"),
  byCoin = [...standing].sort((a, b) => a.coin - b.coin),
  poor = byCoin.find((s) => s.people > 0) ?? byCoin[0]!,
  rich = byCoin.at(-1)!;
say(
  `poorest ${Math.round(poor.coin)} coin, ${poor.rooms} rooms; richest ${Math.round(rich.coin)} coin, ${rich.rooms} rooms, level ${rich.level}`,
);

// The home's page, 🏠 Look in pressed by touch.
const before = JSON.stringify(await ask<unknown>("hashes"));
const homeRef = `dwell:${town}:${poor.n}`;
await k(`globalThis.causalis.open(${JSON.stringify(homeRef)})`);
await page.waitForTimeout(slow(500));
await shot("page-home");
let text = await pageText();
readWell(text, "a home's page");
check(/WHOSE|Whose/i.test(text), `a home's page says not whose it is: ${text.slice(0, 300)}`);
check(/THEY PAY|They pay/i.test(text), "a home's page says not what they pay");
check(
  /SIZE|Size/i.test(text) && /AGE|Age/i.test(text) && /BEFORE|Before/i.test(text),
  "a home's page lacks its size, age or what it was before",
);
await press(".page-window .home-look");
await until("its roof lifted", async () => {
  const s = await homeState();
  return !!s && s.lifted && !s.flying;
});
await page.waitForTimeout(slow(300));
const poorState = await homeState();
if (poorState) {
  say(
    `in: ${poorState.title}: ${poorState.line}; ${poorState.things.length} things; built in ${poorState.builtMs} ms (scene ${poorState.sceneMs}), ${poorState.parts} parts`,
  );
  check(poorState.things.length > 0, "nothing in the poorest home");
}
const poorShot = await shot("home-poor");
const poorC = await colourOf(poorShot);
check(
  await k<boolean>(`document.body.classList.contains("homing")`),
  "the town's chrome stayed up",
);

// Something in it tapped by touch.
const list = await spots();
const pick = list.find(
  (s) =>
    s.kind === "thing" &&
    s.shape !== "rug" &&
    s.shape !== "bulb" &&
    s.x > 40 &&
    s.x < 390 &&
    s.y > 180 &&
    s.y < 800,
);
check(!!pick, "nothing in it to tap on the screen");
if (pick) {
  await page.touchscreen.tap(pick.x, pick.y);
  await until("a thing's page", () =>
    k<boolean>(`String(globalThis.causalis.pageOpen() ?? "").startsWith("dwelt:")`),
  );
  await page.waitForTimeout(slow(300));
  await shot("page-thing");
  text = await pageText();
  readWell(text, "a thing's page");
  check(
    /FOR|For/.test(text) && /MADE OF|Made of/i.test(text) && /WORTH|Worth/i.test(text),
    `a thing's page lacks for, made of or worth: ${text.slice(0, 300)}`,
  );
  await k("globalThis.causalis.closePage?.()");
  await page.waitForTimeout(slow(200));
}
// Someone in it, or of it, by touch.
const someone = (await spots()).find((s) => s.kind === "person" && s.y > 180 && s.y < 800);
if (someone) {
  await page.touchscreen.tap(someone.x, someone.y);
  await until("their sheet", () => k<boolean>(`!document.querySelector(".home-who").hidden`));
  await shot("home-who");
  check(await k<boolean>(`!!document.querySelector(".home-their")`), "no way to their page");
} else say("no one in at this hour");
await press(".home-leave");
await page.waitForTimeout(slow(500));
check(!(await homeState()), "Back out left the home open");
check(
  await k<boolean>(`!document.body.classList.contains("homing")`),
  "the town's chrome stayed away",
);
await shot("town-after");

// Rich beside poor, in the pixels.
const richState = await openHome(town, rich.n);
const richShot = await shot("home-rich");
const richC = await colourOf(richShot);
if (richState)
  say(
    `rich: ${richState.title}: ${richState.line}; ${richState.things.length} things; built in ${richState.builtMs} ms, ${richState.parts} parts`,
  );
await closeHome();
const parted = await unlike(poorShot, richShot);
say(
  `poor: ${poorC.colours} colours, ${(poorC.bright * 100).toFixed(1)}% bright; rich: ${richC.colours} colours, ${(richC.bright * 100).toFixed(1)}% bright; ${(parted * 100).toFixed(0)}% of the shot differs`,
);
check(parted > 0.15, `a poor home and a rich one are alike in the shot: ${parted}`);
if (rich.coin > poor.coin * 8 && rich.rooms > poor.rooms) {
  check(
    (richState?.things.length ?? 0) >= (poorState?.things.length ?? 0) + 5,
    `a rich home holds ${richState?.things.length} things, a poor one ${poorState?.things.length}`,
  );
  check(
    richC.bright >= poorC.bright + 0.05 || richC.colours >= poorC.colours + 5,
    `a rich home is ${richC.bright} strongly coloured in ${richC.colours} colours, a poor one ${poorC.bright} in ${poorC.colours}`,
  );
}

// The paths nobody watches.
// (A ruin and a ruler's home, wherever in the world they are.)
const ruin = lookThrough((s) => s.state === "fell" || s.state === "razed");
if (ruin) {
  await goDown(ruin.town);
  const s = await openHome(ruin.town, ruin.home.n);
  await shot("home-ruin");
  say(`ruin: ${s?.title}: ${s?.line}; ${s?.things.join()}`);
  check(!s || s.folk.length === 0, "someone lives in a ruin");
  check((s?.things.length ?? 0) > 0, "a ruin holds nothing");
  await k(`globalThis.causalis.open(${JSON.stringify(`dwell:${ruin.town}:${ruin.home.n}`)})`);
  await page.waitForTimeout(slow(400));
  await shot("home-ruin-page");
  text = await pageText();
  readWell(text, "a ruin's page");
  check(/STOOD|Stood/.test(text), `a ruin still stands, by its page: ${text.slice(0, 200)}`);
  check(!/\b0 homes\b|\bof 0\b/.test(text), `a ruin's page counts nothing: ${text.slice(0, 400)}`);
  await k("globalThis.causalis.closePage?.()");
  await closeHome();
} else say("no ruin in this world");
const crowned = lookThrough((s) => s.figure);
if (crowned) {
  await goDown(crowned.town);
  const s = await openHome(crowned.town, crowned.home.n);
  await shot("home-ruler");
  say(`ruler's: ${s?.title}: ${s?.line}; ${s?.things.length} things`);
  check((s?.rooms ?? 0) >= 2, `a ruler's home is ${s?.rooms} rooms`);
  await k(`globalThis.causalis.open(${JSON.stringify(`dwell:${crowned.town}:${crowned.home.n}`)})`);
  await page.waitForTimeout(slow(400));
  await shot("home-ruler-page");
  text = await pageText();
  readWell(text, "a ruler's home's page");
  check(/HOME OF|Home of/.test(text), `a ruler's home says not whose: ${text.slice(0, 300)}`);
  await k("globalThis.causalis.closePage?.()");
  await closeHome();
} else say("no ruler's home in this world");
await goDown(town);
const empty = standing.find((s) => s.people === 0);
if (empty) {
  const s = await openHome(town, empty.n);
  await shot("home-empty");
  say(`empty: ${s?.title}: ${s?.line}`);
  check(!!s && /no one/i.test(s.line), `a home with no one says ${s?.line}`);
  await k(`globalThis.causalis.open(${JSON.stringify(`dwell:${town}:${empty.n}`)})`);
  await page.waitForTimeout(slow(400));
  readWell(await pageText(), "an empty home's page");
  await k("globalThis.causalis.closePage?.()");
  await closeHome();
}
const ruler = survey.find((s) => s.figure);
if (ruler) {
  const s = await openHome(town, ruler.n);
  await shot("home-ruler-here");
  say(`ruler's, here: ${s?.title}: ${s?.line}; ${s?.things.length} things`);
  await closeHome();
}
// A lot's own page offers it, and one that does not exist says so.
await k(`globalThis.causalis.open(${JSON.stringify(`lot:${town}:${poor.n}`)})`);
await page.waitForTimeout(slow(400));
if (poor.n < 1_000_000)
  check(
    await k<boolean>(`!!document.querySelector(".page-window .home-look")`),
    "a lot's page offers no look in",
  );
await k("globalThis.causalis.closePage?.()");
await k(`globalThis.causalis.open(${JSON.stringify(`dwell:${town}:999999`)})`);
await page.waitForTimeout(slow(400));
readWell(await pageText(), "a home that is not");
await k("globalThis.causalis.closePage?.()");

const after = JSON.stringify(await ask<unknown>("hashes"));
check(before === after, "looking into a home moved a hash");

// Anyone in it, by touch: their page; then taken, and lived as, which is what moves history. Its page's Go to, as a person has it.
const sheet = async (): Promise<boolean> => {
  await openHome(town, poor.n);
  const one = (await spots()).find((s) => s.kind === "person" && s.y > 180 && s.y < 800);
  if (!one) {
    await closeHome();
    return false;
  }
  await page.touchscreen.tap(one.x, one.y);
  return until("their sheet", () => k<boolean>(`!document.querySelector(".home-who").hidden`));
};
const homing = () => k<boolean>(`document.body.classList.contains("homing")`);
if (await sheet()) {
  await press(".home-their");
  await until("their page", () =>
    k<boolean>(
      `!!globalThis.causalis.pageOpen() && !document.querySelector(".page-window").hidden`,
    ),
  );
  await page.waitForTimeout(slow(300));
  await shot("home-their-page");
  readWell(await pageText(), "their page, from a home");
  check(await homing(), "their page closed the home");
  check(
    await k<boolean>(`getComputedStyle(document.querySelector(".home-acts")).display === "none"`),
    "a home's buttons lie over a page",
  );
  await k("globalThis.causalis.closePage?.()");
  await page.waitForTimeout(slow(300));
  check(
    await k<boolean>(`getComputedStyle(document.querySelector(".home-acts")).display !== "none"`),
    "a home's buttons did not come back",
  );
  await closeHome();
  // Its page's Go to: the home gives way, the town is there.
  await k(`globalThis.causalis.open(${JSON.stringify(homeRef)})`);
  await page.waitForTimeout(slow(400));
  await press(".page-window .home-look");
  await until("its roof lifted", async () => !!(await homeState())?.lifted);
  await press(".home-page");
  await until("its page", () =>
    k<boolean>(`String(globalThis.causalis.pageOpen() ?? "").startsWith("dwell:")`),
  );
  await page.waitForTimeout(slow(300));
  await press(".page-window .go-to");
  await until("the home to give way", async () => !(await homing()));
  await page.waitForTimeout(slow(600));
  await shot("home-goto");
  check(
    await k<boolean>(`globalThis.causalis.scale() === "village"`),
    "Go to, from a home, left the town",
  );
  // Taken.
  if (await sheet()) {
    await press(".home-take");
    await until(
      "them taken",
      () => k<boolean>(`document.body.classList.contains("possessing")`),
      slow(90000),
    );
    await page.waitForTimeout(slow(800));
    await shot("home-possessed");
    check(!(await homing()), "a home stays open under one possessed");
    check(!(await homeState()), "a home is open under one possessed");
    await press(".possess-letgo");
    await until("let go", () => k<boolean>(`!document.body.classList.contains("possessing")`));
    await page.waitForTimeout(slow(600));
  }
  // Lived as, and 🏠 Go in from their strip.
  if (await sheet()) {
    await press(".home-live");
    await until(
      "their life",
      () => k<boolean>(`document.body.classList.contains("living")`),
      slow(90000),
    );
    await page.waitForTimeout(slow(1200));
    await shot("home-lived");
    check(!(await homing()), "a home stays open under one lived as");
    await press(".life-goin");
    await until("their home, from their strip", async () => !!(await homeState())?.lifted);
    await until("the eye over their home", async () => !(await homeState())?.flying);
    await page.waitForTimeout(slow(400));
    const lifeShot = await shot("home-goin"),
      lifeC = await colourOf(lifeShot);
    say(`their home, from their strip: ${lifeC.colours} colours`);
    check(lifeC.colours >= 12, `their home, from their strip, is nothing to see: ${lifeC.colours}`);
    check(
      (await spots()).filter((s) => s.y > 120 && s.y < 830 && s.x > 0 && s.x < 430).length > 2,
      "little of their home lies on the screen, from their strip",
    );
    await press(".home-leave");
    await page.waitForTimeout(slow(600));
    check(!(await homeState()), "Back out left their home open");
    check(
      await k<boolean>(`document.body.classList.contains("living")`),
      "backing out of their home ended their life",
    );
    await shot("home-goin-out");
  }
} else say("no one in at this hour to take");

// A water people's town, a far save given (or nothing on CI).
if (alienFile) {
  const alien = fromFile(alienFile, "alien");
  await loadSave(alien);
  const t = await toTown(alien),
    homes = await ask<Survey[]>("home.survey", { town: t }),
    one = homes.find((s) => s.state === "stands" && s.people > 0) ?? homes[0];
  say(`alien: ${homes.length} homes`);
  if (one) {
    const s = await openHome(t, one.n);
    const d = await shot("home-alien");
    say(`alien home: ${s?.title}: ${s?.line}; ${s?.things.join()}`);
    const c = await colourOf(d);
    say(`alien: ${c.colours} colours`);
    check(
      (!!s &&
        !s.things.some((w) => /joined-bed|sprung-bed/.test(w)) ===
          (await k<boolean>(`globalThis.causalis.planNow()?.body?.medium === "water"`))) ||
        (await k<boolean>(`globalThis.causalis.planNow()?.body?.medium !== "water"`)),
      "a water people have a bed",
    );
    await k(`globalThis.causalis.open(${JSON.stringify(`dwell:${t}:${one.n}`)})`);
    await page.waitForTimeout(slow(400));
    readWell(await pageText(), "an alien home's page");
    await k("globalThis.causalis.closePage?.()");
    await closeHome();
  }
}

for (const e of errors) problems.push(`page error: ${e.slice(0, 400)}`);
await browser.close();
await server.close();
if (problems.length) {
  console.log(`gate 86: ${problems.length} problems`);
  for (const p of problems) console.log(`  x ${p}`);
  process.exit(1);
}
console.log("gate 86: passed");
process.exit(0);
