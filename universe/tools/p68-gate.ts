// node tools/p68-gate.ts [--ci] [--soft] [--shots dir] [--open file.save] [--shut file.save]: gate 80, the law of a universe and the
// first jump (galaxy-plan.md Phase 68, first slice), at a phone's size. On far saves, else (as on CI) a young world given what the
// check needs:
//   1. the numbers: the law is the same read twice and about two in three seeds have it; a dial overrides it; the lanes are a fact of the stars;
//   2. SHUT FIRST: a universe with the law shut: its star map has no lanes, and a page reached by touch says why no one ever jumps;
//   3. OPEN: its star map draws the lanes, in the pixels, where the shut one has none;
//   4. the law's page says so, and its button, pressed by touch, plays the film;
//   5. the film: the ship leaving, the ring open, the sky's streaks in all four quarters of the screen, the far star, the card;
//   6. back to the world; no error in the page; the world's clock where it was.
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
  seedWithAct,
  type World,
} from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { lifeHere } from "../src/host/biochem.ts";
import {
  LANE_LAW_SHARE,
  STAR_DRIVES,
  crossingYears,
  cruise,
  laneLaw,
  routeYears,
} from "../src/rules/index.ts";
import {
  clusterOf,
  folksNear,
  landfallsOf,
  laneMapOf,
  laneRoute,
  lanesOf,
  politiesOf,
} from "../src/sim/index.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  shots = arg("--shots");
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
console.log("gate 80, the law of a universe and the first jump");

type Forged = { bytes: Buffer; universe: "earth" | "alien"; seed: string; world: World };

/** A far save as it is; else a young world, its first jump set down by the real map for the eye to read. */
function forge(universe: "earth" | "alien", seed: string, file?: string): Forged {
  const u = universe === "earth" ? EARTH : ALIEN;
  let world: World;
  if (file) {
    const doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as Parameters<
        typeof loadWorld
      >[0],
      probe = u.build(seedFromText(doc.seed));
    world = loadWorld(doc, (s) => u.build(s), rulesetId(probe, u.version), {
      allowRulesetChange: true,
    }).world;
  } else {
    world = u.build(seedFromText(seed));
    world.runTo(40 * YEAR);
    if (seed.includes("open")) {
      const realm = politiesOf(world).living()[0]!,
        home = laneMapOf(world).stars[0]!.ref,
        s = clusterOf(world).find((x) => x.distance > 15 && laneRoute(world, home, x.ref))!,
        route = laneRoute(world, home, s.ref)!,
        drive = STAR_DRIVES[2]!,
        years = Math.ceil(routeYears(route, cruise(drive)));
      lanesOf(world)!.first = {
        event: world.events.at(0).id,
        realm: realm.ref,
        name: realm.town,
        what: "settlers",
        cell: null,
        star: s.ref,
        planet: 0,
        year: 30,
        arrives: 30 + years,
        hops: route.hops,
        ly: Math.round(route.ly * 10) / 10,
        tonnes: Math.round(route.tonnes),
        machines: Math.round(route.tonnes * 2000),
        distance: Math.round(s.distance * 10) / 10,
        byDrive: Math.round(crossingYears(s.distance, drive)),
        drive: drive.id,
        thrown: null,
      };
    }
  }
  const bytes = gzipSync(
    JSON.stringify(saveWorld(world, rulesetId(world, u.version), { universe: u.name })),
  );
  return { bytes, universe, seed: world.seed.text, world };
}

// 1. The numbers.
let open = 0;
for (let i = 0; i < 1000; i++) if (laneLaw(`seed ${i}`, false).open) open++;
say(`${open} of 1000 seeds have the law (wanted about ${Math.round(LANE_LAW_SHARE * 1000)})`);
check(Math.abs(open - LANE_LAW_SHARE * 1000) < 60, "the law's share is off");
check(laneLaw("x ~lanes shut", true).open === false, "the dial does not shut Earth");
check(laneLaw("x ~lanes open", false).open === true, "the dial does not open a universe");
check(laneLaw("x", true).open === true, "Earth does not start with it on");

const shutSave = arg("--shut"),
  openSave = arg("--open"),
  uni = (file?: string) => (file?.includes("earth--") ? "earth" : "alien");
const shut = forge(uni(shutSave), seedWithAct("harrow 348", "lanes shut"), shutSave),
  opened = forge(uni(openSave), seedWithAct("harrow 348", "lanes open"), openSave),
  lanes = laneMapOf(opened.world);
say(`${lanes.lanes.length} lanes among ${lanes.stars.length} stars`);
check(lanes.lanes.length > lanes.stars.length * 0.8, "too few lanes");
if (seedSame(shut, opened)) {
  const a = folksNear(opened.world).map((f) => f.name),
    b = folksNear(shut.world).map((f) => f.name);
  check(a.join() === b.join(), `the dial moved the peoples: ${a.length} against ${b.length}`);
  check(
    lanes.lanes.length === laneMapOf(shut.world).lanes.length,
    "the lanes run differently under another law: they are a fact of the stars",
  );
}
check(!!lanesOf(opened.world)!.first, "the open world holds no first jump");
check(!lanesOf(shut.world)!.first, "a shut universe holds a jump");
function seedSame(x: Forged, y: Forged): boolean {
  return x.seed.split(" ~")[0] === y.seed.split(" ~")[0];
}

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4280, strictPort: false } }),
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
const until = async (what: string, ok: () => Promise<boolean>, ms = slow(60000)) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await page.waitForTimeout(60);
  }
  problems.push(`${what} did not come`);
  return false;
};
const settle = (ms: number) => page.waitForTimeout(slow(ms));

async function loadSave(f: Forged) {
  const name = `${f.universe}:gate80`,
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
  const b64 = f.bytes.toString("base64");
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
    [b64, name],
  );
  await page.goto(`${base}?${q}&load=${encodeURIComponent(name)}&hold=1`);
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: slow(180000) },
  );
  await k("globalThis.causalis.client.setSpeed(0)");
}

type Read = {
  quarters: number[];
  cool: number;
  warm: number;
  bright: number;
  blue: number;
};
/** What the screen shows now: bright pixels by quarter, and how many are of a cool or a warm light, or the lanes' blue. */
async function read(name: string): Promise<Read> {
  const buf = await page.screenshot(shots ? { path: join(shots, `${name}.png`) } : {});
  return page.evaluate(async (b64) => {
    const bm = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob()),
      c = new OffscreenCanvas(bm.width, bm.height),
      x = c.getContext("2d")!;
    x.drawImage(bm, 0, 0);
    const d = x.getImageData(0, 0, bm.width, bm.height).data,
      s = (bm.width / 430) * (bm.width / 430),
      out: Read = { quarters: [0, 0, 0, 0], cool: 0, warm: 0, bright: 0, blue: 0 };
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i]!,
        g = d[i + 1]!,
        b = d[i + 2]!,
        p = i / 4,
        px = p % bm.width,
        py = Math.floor(p / bm.width);
      // (Past the film's chrome: the year above and the words below are not the sky.)
      if (py < bm.height * 0.1 || py > bm.height * 0.78) continue;
      if (r + g + b > 400) {
        out.bright++;
        out.quarters[(px < bm.width / 2 ? 0 : 1) + (py < bm.height * 0.44 ? 0 : 2)]!++;
      }
      if (b > 180 && g > 140 && r < b) out.cool++;
      if (r > 220 && g > 170 && b < 190) out.warm++;
      if (b > 90 && r < 70 && g > 40 && b > g) out.blue++;
    }
    out.bright = Math.round(out.bright / s);
    out.cool = Math.round(out.cool / s);
    out.warm = Math.round(out.warm / s);
    out.blue = Math.round(out.blue / s);
    out.quarters = out.quarters.map((q) => Math.round(q / s));
    return out;
  }, buf.toString("base64"));
}
const state = () =>
  k<{ stage: string | null; k: number; words: string; year: string; card: boolean }>(
    `globalThis.causalis.jumpFilm.state()`,
  );
const toMap = async () => {
  await k("globalThis.causalis.stars()");
  await settle(1800);
};

try {
  // 2. Shut first: the path nobody watches.
  await loadSave(shut);
  await settle(800);
  // From the world's own panel, by touch.
  await page.locator('.world-menu button[title="The law"]').tap();
  await settle(900);
  await read("0-shut-from-the-world");
  check(
    /no ship ever jumps/i.test(
      await k<string>(`document.querySelector(".page-window")?.innerText ?? ""`),
    ),
    "the world's own panel does not reach the law's page",
  );
  await page.locator(".page-window").getByRole("button", { name: "Close" }).first().tap();
  await settle(400);
  await toMap();
  const shutMap = await read("1-shut-map");
  say(`the shut map: ${JSON.stringify(shutMap)}`);
  await page
    .getByRole("button", { name: /A law of this universe/ })
    .first()
    .tap();
  await settle(900);
  await read("2-shut-page");
  const shutWords = await k<string>(`document.querySelector(".page-window")?.innerText ?? ""`);
  say(`the shut page: ${shutWords.replace(/\s+/g, " ").slice(0, 400)}`);
  check(
    /law of this universe/i.test(shutWords),
    "the shut page does not call it a law of this universe",
  );
  check(/no ship ever jumps/i.test(shutWords), "the shut page does not say why no one ever jumps");
  check(
    !(await page.getByRole("button", { name: /Watch the first jump/ }).count()),
    "a shut universe offers a jump to watch",
  );

  // 3. Open: the lanes on the map, in the pixels.
  await loadSave(opened);
  await settle(800);
  await toMap();
  const openMap = await read("3-open-map");
  say(`the open map: ${JSON.stringify(openMap)}`);
  check(
    openMap.blue > shutMap.blue + 400,
    `the map shows no lanes the shut one has not (${openMap.blue} blue against ${shutMap.blue})`,
  );

  // 4. The page, by touch; the film from its button, by touch.
  await page
    .getByRole("button", { name: /A law of this universe/ })
    .first()
    .tap();
  await settle(900);
  await read("4-open-page");
  const openWords = await k<string>(`document.querySelector(".page-window")?.innerText ?? ""`);
  say(`the open page: ${openWords.replace(/\s+/g, " ").slice(0, 500)}`);
  check(
    /law of this universe/i.test(openWords),
    "the open page does not call it a law of this universe",
  );
  check(/first jump/i.test(openWords), "the open page does not tell the first jump");
  const yearWas = await k<number>("globalThis.causalis.now?.() ?? 0");
  await page
    .getByRole("button", { name: /Watch the first jump/ })
    .first()
    .tap();

  // 5. The film. It must read as a jump in the pixels: each shot told from the one before it.
  await until(
    "the ship leaving",
    async () => {
      const s = await state();
      return s.stage === "leave" && s.k > 0.2;
    },
    slow(90000),
  );
  const leave = await read("5-leave-early");
  await until(
    "the ship well out",
    async () => {
      const s = await state();
      return s.stage === "leave" && s.k > 0.8;
    },
    slow(30000),
  );
  const leave2 = await read("6-leave-late");
  say(`leaving: ${JSON.stringify(leave)}, then ${JSON.stringify(leave2)}`);
  await until(
    "the mouth opening",
    async () => {
      const s = await state();
      return s.stage === "opens" && s.k > 0.75;
    },
    slow(30000),
  );
  const mouth = await read("7-mouth");
  say(`the mouth: ${JSON.stringify(mouth)}`);
  check(mouth.cool > 500, `no ring and no mouth to see (${mouth.cool} cool pixels)`);
  await until("the jump", async () => (await state()).stage === "jump", slow(20000));
  await read("8-jump");
  await until(
    "the sky drawn past",
    async () => {
      const s = await state();
      return s.stage === "through" && s.k > 0.4;
    },
    slow(20000),
  );
  const through = await read("9-through");
  const yearIn = (await state()).year;
  say(`through it: ${JSON.stringify(through)}, ${yearIn}`);
  check(
    through.quarters.every((q) => q > 60),
    `the streaks do not fill the screen: ${JSON.stringify(through.quarters)}`,
  );
  check(
    through.bright > 2 * leave2.bright,
    `the jump looks no different from the leaving (${through.bright} against ${leave2.bright})`,
  );
  await until(
    "out by another star",
    async () => {
      const s = await state();
      return s.stage === "out" && s.k > 0.35;
    },
    slow(90000),
  );
  const out1 = await read("10-out");
  await until(
    "over the far world",
    async () => {
      const s = await state();
      return s.stage === "out" && s.k > 0.9;
    },
    slow(30000),
  );
  const out2 = await read("11-far-world");
  say(`out: ${JSON.stringify(out1)}, then ${JSON.stringify(out2)}`);
  check(
    out1.quarters.reduce((a, b) => a + b, 0) < through.quarters.reduce((a, b) => a + b, 0),
    "the streaks did not end on coming out",
  );
  await until("the card", async () => (await state()).card, slow(30000));
  await settle(300);
  await read("12-card");
  const card = await k<string>(
    `document.querySelector(".jump-film .contact-card")?.innerText ?? ""`,
  );
  say(`the card: ${card.replace(/\s+/g, " ")}`);
  check(
    /How long/.test(card) && /What it cost/.test(card) && /What it did/.test(card),
    "the card leaves something out",
  );

  // 6. Back.
  await page.getByRole("button", { name: /Back to the world/ }).tap();
  await until(
    "the film's end",
    async () => !(await k<boolean>("globalThis.causalis.jumpFilm.playing")),
    slow(30000),
  );
  await settle(700);
  const back = await read("13-back");
  say(`back: ${JSON.stringify(back)}`);
  const yearNow = await k<number>("globalThis.causalis.now?.() ?? 0");
  check(yearNow === yearWas, "watching moved the world's clock");

  // 7. A town met through the lanes: the landing no far save had before them (a far save has one; a young world on CI has not).
  const life = lifeHere(opened.world),
    town = folksNear(opened.world)
      .flatMap((f) => landfallsOf(opened.world, f, life).map((l) => ({ f, l })))
      .find(({ l }) => l.arrival.visit !== undefined && l.natives.stage === "towns");
  if (town) {
    say(
      `a town met: the ${town.f.name}, year ${town.l.arrival.year}, comers won: ${town.l.fight.won}`,
    );
    const landed = () =>
      k<{ stage: string | null; t: number; words: string; card: boolean }>(
        "globalThis.causalis.landfallFilm.state()",
      );
    await k(
      `void globalThis.causalis.landfallFilm.play(${JSON.stringify(town.f.star)}, ${town.f.planet}, ${town.l.n})`,
    );
    await until(
      "the town's landing, out and drawn up",
      async () => {
        const s = await landed();
        return s.stage === "out" && s.t > 10;
      },
      slow(120000),
    );
    await read("14-town-drawn-up");
    await until("the town's fight", async () => (await landed()).t > 16, slow(60000));
    await read("15-town-fight");
    await until("the town's card", async () => (await landed()).card, slow(90000));
    await settle(300);
    await read("16-town-card");
    say(
      `its card: ${(await k<string>(`document.querySelector(".contact-card:not([hidden])")?.innerText ?? ""`)).replace(/\s+/g, " ").slice(0, 420)}`,
    );
    await k("globalThis.causalis.landfallFilm.skip()");
    await until(
      "the town's film's end",
      async () => !(await k<boolean>("globalThis.causalis.landfallFilm.playing")),
      slow(60000),
    );
  } else say("no town met through the lanes on this world");
} catch (e) {
  problems.push(`${(e as Error).message}\n${(e as Error).stack ?? ""}`);
}
for (const e of errors) problems.push(`in the page: ${e}`);
await browser.close();
await server.close();
if (problems.length) {
  console.error(`gate 80 FAILED:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("gate 80 passed");
process.exit(0);
void YEAR;
