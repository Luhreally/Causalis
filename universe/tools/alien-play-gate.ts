// node tools/alien-play-gate.ts [--ci] [--soft] [--shots dir] [--only earth|alien]: gate 121, another people's world played (asked
// 2026-11-13: "i should lowkey be able to play the alien worlds too, like when in the galaxy its other species"), at a phone's size.
// On two home worlds (Earth's first light; the alien 41, whose sky holds a people of the water), a people of another star not in
// its camps:
//   1. the numbers: its world's seed is made from what is read of it, and asking moves nothing at home;
//   2. its world seen whole from home; "Play their world" pressed by touch; what will be as seen and what will not, said first;
//   3. its world made and its history run to the age they were read at, behind a screen that says so, the page never frozen;
//   4. there: the globe, a land, a town and a person's page, each seen; its star and warmth the ones read; its people's figures the
//      body and the look read from home; the bar says whose world it is;
//   5. some years lived there; back to the galaxy by the bar: the home world as it was left, to the hash, at their world;
//   6. entered again: taken up where it was left, not made again; no error in the page;
//   7. nothing of the HUD over anything else, off the screen or covered, at a phone's size and a desk's, that is not so on the home world
//      too (the owner's rule: no panel or button ever covers another; tools/overlap-gate.ts holds the home world to it).
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium, type Page } from "playwright";
import { Rng, YEAR, seedFromText, seedName } from "../src/kernel/index.ts";
import { foreignPlanets } from "../src/gen/index.ts";
import { ALIEN, EARTH, clusterOf } from "../src/host/planet.ts";
import { enterPlan } from "../src/host/enter.ts";
import { figureBody } from "../src/host/folk.ts";
import { folkFactsOf } from "../src/host/natives.ts";
import { folkStage, folksNear, type Folk } from "../src/sim/index.ts";
import type { Entered, LandPlan } from "../src/bridge/index.ts";
import { hudRead, type HudRead } from "./hud-read.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  shots = arg("--shots"),
  only = arg("--only");
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
console.log("gate 121, another people's world played");

type Home = { readonly universe: "earth" | "alien"; readonly seed: string; readonly wet: boolean };
const HOMES: readonly Home[] = [
  { universe: "earth", seed: "first light", wet: false },
  // (Its sky holds a people of the water, in its towns as the chronicle opens.)
  { universe: "alien", seed: "alien 41", wet: true },
];
/** The steps a world comes to within its first centuries: a run a gate can wait for. */
const NEAR = ["villages", "towns", "cities"];

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4321, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  });

type Causalis = {
  causalis?: {
    client?: unknown;
    drawn?: () => number;
    entered?: { here: Entered; makeMs: number; runMs: number; years: number; loaded: boolean };
  };
};

async function walk(home: Home): Promise<void> {
  const tag = home.universe,
    u = home.universe === "earth" ? EARTH : ALIEN,
    world = u.build(seedFromText(home.seed)),
    folks = folksNear(world),
    f: Folk | undefined =
      folks.find(
        (x) => NEAR.includes(folkStage(x, 0)) && (!home.wet || x.body.medium === "water"),
      ) ?? folks.find((x) => NEAR.includes(folkStage(x, 0)));
  if (!f) {
    problems.push(`${tag}: no people in its villages, towns or cities about this world's stars`);
    return;
  }
  // 1. The numbers.
  const s = clusterOf(world).find((x) => x.ref === f.star)!,
    p = foreignPlanets(new Rng(world.seed), s)[f.planet]!,
    before = JSON.stringify(world.domainHashes()),
    plan = enterPlan(world, f.star, f.planet, home.universe);
  check(JSON.stringify(world.domainHashes()) === before, `${tag}: asking moved the home world`);
  if (!plan.ok) {
    problems.push(`${tag}: the ${f.name} cannot be entered: ${plan.why}`);
    return;
  }
  const figure = JSON.stringify(figureBody(f.body, folkFactsOf(f, s)));
  say(
    `${tag} “${home.seed}”: the ${f.name}, ${f.body.name}, of the ${f.body.medium}, ${plan.stageWords}; ${s.spectral} star ${s.distance.toFixed(0)} ly out, ${p.temperature.toFixed(0)} °C, ${p.gravity.toFixed(2)} g; life ${f.life.pigment}, ${f.life.blood} blood, ${f.life.hand}-handed`,
  );
  check(home.wet ? f.body.medium === "water" : true, `${tag}: no people of the water found`);
  check(
    f.life.pigment !== "chlorophyll" || f.life.hand !== "left" || f.life.blood !== "iron",
    `${tag}: their life's chemistry is Earth's own`,
  );

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
  const shot = async (name: string) => {
    if (shots) await page.screenshot({ path: join(shots, `${tag}-${name}.png`) });
  };
  const until = async (what: string, ok: () => Promise<boolean>, ms = slow(60000)) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await ok().catch(() => false)) return true;
      await page.waitForTimeout(80);
    }
    problems.push(`${tag}: ${what} did not come`);
    return false;
  };
  const settle = (ms: number) => page.waitForTimeout(slow(ms));
  const ask = <T>(type: string, args: unknown = {}) =>
    k<T>(
      `globalThis.causalis.client.query({ type: ${JSON.stringify(type)}, args: ${JSON.stringify(args)} })`,
    );
  const drawn = () =>
    page.waitForFunction(() => ((globalThis as Causalis).causalis?.drawn?.() ?? 0) > 0, undefined, {
      timeout: slow(240000),
    });
  const words = (selector: string) =>
    k<string>(`document.querySelector(${JSON.stringify(selector)})?.innerText ?? ""`);
  /** Whether something is on the screen, with a size. */
  const seen = (selector: string) =>
    k<boolean>(
      `(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < innerHeight; })()`,
    );
  /** Pressed by a finger, where it is on the screen (brought into view first, as a thumb would scroll to it). */
  const press = async (selector: string) => {
    const at = page.locator(selector).first();
    await at.scrollIntoViewIfNeeded();
    await at.tap();
  };
  /** The world's bar opened out, on a phone: its menu is folded under "More". */
  const menu = async (selector: string) => {
    if (await seen(selector)) return;
    await page
      .locator(".bar-fold")
      .first()
      .tap()
      .catch(() => {});
    await settle(300);
  };

  /** What of the HUD lies over something, is covered, or is off the screen (tools/hud-read.ts). */
  const READ = hudRead([], 1),
    faults = async () => {
      const r = await k<HudRead>(READ);
      return [...r.overlaps, ...r.covered, ...r.off];
    },
    /** A world's faults that the home world's globe does not have too. */
    own = (there: readonly string[], home: readonly string[]) =>
      there.filter((x) => !home.includes(x));

  /** Whether the page is at their world (by its seed's name: a home world may itself be of the open universe). */
  const theirs = (url: URL) =>
    seedName(url.searchParams.get("seed") ?? "").startsWith(`${f.name}, from `);
  /** Whether something is in the page with a size, on the screen or a scroll away. */
  const inPage = (selector: string) =>
    k<boolean>(
      `(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4; })()`,
    );

  // 2. Their world seen whole from home, and the way in pressed.
  const q = `universe=${home.universe}&seed=${encodeURIComponent(home.seed)}`;
  await page.goto(`${base}?${q}&hold=1`);
  await drawn();
  await k("globalThis.causalis.client.setSpeed(0)");
  // (Kept once, as a world played is: the way back takes it up by its save.)
  await until("the home world kept", async () => /load=/.test(page.url()), slow(90000));
  const homeHashes = JSON.stringify(await ask("hashes")),
    homeNow = (await ask<{ t: number }>("now")).t,
    homeUrl = page.url();
  await settle(1500);
  const homeFaults = await faults();
  await k(`globalThis.causalis.toFolkWorld(${JSON.stringify(f.star)}, ${f.planet})`);
  await until("the way into their world", () => inPage(".folk-play"));
  await settle(1200);
  await shot("1-from-home");
  await press(".folk-play");
  await until("what entering means", () => seen(".enter-ask .enter-go"));
  const asked = await words(".enter-ask");
  check(asked.includes(f.name), `${tag}: the asking does not name the ${f.name}`);
  check(
    /As it was seen/.test(asked) && /Not as it was seen/.test(asked),
    `${tag}: the asking does not say what agrees`,
  );
  check(/stays here/.test(asked), `${tag}: the asking does not say what is done there stays there`);
  await shot("2-asked");

  // 3. Made, and run to the age they were read at.
  const t0 = Date.now();
  await press(".enter-ask .enter-go");
  await page.waitForURL(theirs, { timeout: slow(120000) });
  check(
    seedName(new URL(page.url()).searchParams.get("seed") ?? "").startsWith(`${f.name}, from `),
    `${tag}: the page went to another world than theirs`,
  );
  // (The page answers while their world is made and run: frames go on being drawn behind the screen's words.)
  let turns = 0,
    shown = "";
  const beat = setInterval(() => {
    void page
      .evaluate(
        () =>
          new Promise<string>((done) =>
            requestAnimationFrame(() =>
              done(
                (document.querySelector(".enter-making") as HTMLElement | null)?.innerText ?? "",
              ),
            ),
          ),
      )
      .then((w) => {
        turns++;
        if (w) shown = w;
      })
      .catch(() => {});
  }, 250);
  await page.waitForFunction(() => !!(globalThis as Causalis).causalis?.entered, undefined, {
    timeout: slow(600000),
  });
  clearInterval(beat);
  await drawn();
  const seconds = (Date.now() - t0) / 1000,
    came = (await k<NonNullable<Causalis["causalis"]>["entered"]>("globalThis.causalis.entered"))!,
    heap = await k<number>("performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0");
  say(
    `${tag}: entered in ${seconds.toFixed(1)} s (made ${(came.makeMs / 1000).toFixed(1)} s, run ${came.years} years in ${(came.runMs / 1000).toFixed(1)} s); the page's heap ${heap.toFixed(0)} MB; ${turns} frames answered behind the screen${shown ? `; it said “${shown.split("\n").slice(0, 2).join(" / ")}”` : ""}`,
  );
  check(!came.loaded, `${tag}: a world first entered was taken up from a save`);
  check(came.here.name === f.name, `${tag}: the world entered is not the ${f.name}'s`);
  check(
    came.here.arrived,
    `${tag}: their world never came to the age they were read at (${came.here.age})`,
  );
  check(turns > 0, `${tag}: the page did not answer while their world was made`);
  await k("globalThis.causalis.client.setSpeed(0)");
  await settle(1500);

  // 4. There: the star and the warmth read, their bodies and look; the globe, a land, a town, a person.
  const summary = await ask<{
    star: { spectral: string };
    planet: { meanTemperature: number; gravity: number };
  }>("planet.summary");
  check(
    summary.star.spectral === s.spectral,
    `${tag}: their star is a ${summary.star.spectral}, read a ${s.spectral}`,
  );
  check(
    Math.abs(summary.planet.meanTemperature - p.temperature) < 0.01 &&
      Math.abs(summary.planet.gravity - p.gravity) < 1e-9,
    `${tag}: their world's warmth or pull is not the one read`,
  );
  await menu(".world-entered");
  const bar = await words(".world-entered");
  check(bar.includes(f.name), `${tag}: the bar does not say whose world it is (“${bar}”)`);
  await shot("3-globe");
  const map = await ask<{ cell: number; people: number }[]>("people.map"),
    lands = [...map].sort((a, b) => b.people - a.people);
  say(
    `${tag}: ${lands.length} peopled lands, ${lands.reduce((a, x) => a + x.people, 0).toLocaleString("en")} people; the age: ${came.here.age}`,
  );
  check(lands.length > 0, `${tag}: no one lives on their world`);
  // (A land with a town in it, the most peopled first.)
  let town: { ref: string; name: string } | null = null,
    cell = lands[0]?.cell ?? 0;
  for (const land of lands.slice(0, 12)) {
    const lp = await ask<LandPlan>("towns.land", { cell: land.cell });
    if (lp.towns.length) {
      cell = land.cell;
      town = [...lp.towns].sort((a, b) => b.population - a.population)[0]!;
      break;
    }
  }
  await k(`globalThis.causalis.descend(${cell})`);
  await until(
    "their land",
    async () => (await k<string>("globalThis.causalis.scale()")) === "region",
  );
  await settle(2500);
  await shot("4-land");
  check(!!town, `${tag}: no town on their world, read ${plan.stageWords}`);
  if (town) {
    // (By day: its chronicle's years turn at midnight.)
    await k(
      `globalThis.causalis.client.advance(${(await ask<{ t: number }>("now")).t + 12 * 3600})`,
    );
    await k(`globalThis.causalis.goTo(${JSON.stringify(town.ref)})`);
    await until(
      "their town",
      async () => (await k<string>("globalThis.causalis.scale()")) === "village",
    );
    await settle(4000);
    const tp = await ask<{ body: unknown; name?: string }>("village.plan", { ref: town.ref });
    check(
      JSON.stringify(tp.body) === figure,
      `${tag}: the figures of their town are not the body and look read from home`,
    );
    say(`${tag}: the town of ${town.name}; its figures are the ${f.body.name} read from home`);
    await shot("5-town");
    // A person of it: the first the people bar names there.
    const read = await ask<{ people: { ref: string; name: string; portrait: unknown }[] }>(
        "people.bar",
        { cell, town: town.ref, pins: [], followed: [] },
      ),
      one = read.people.find((x) => x.portrait) ?? read.people[0];
    check(!!one, `${tag}: no one of their town to open a page of`);
    if (one) {
      await k(`globalThis.causalis.open(${JSON.stringify(one.ref)})`);
      await until("a person's page", () => seen(".page-window"));
      await settle(1500);
      const told = await words(".page-window");
      check(told.includes(one.name.split(" ")[0]!), `${tag}: the page does not name ${one.name}`);
      say(`${tag}: ${one.name}'s page: “${told.replace(/\s+/g, " ").slice(0, 110)}…”`);
      await shot("6-person");
      await k("globalThis.causalis.closePage?.()");
    }
  }

  // 5. Some years lived there, then back to the galaxy by the bar.
  const there = (await ask<{ t: number }>("now")).t,
    on = there + 3 * YEAR;
  await k(`globalThis.causalis.client.advance(${on})`);
  const lived = (await ask<{ t: number }>("now")).t;
  check(lived >= on, `${tag}: their world did not go on`);
  // (Up by the bar's own ways back, as a thumb goes: the town to its land, the land to the world.)
  for (const back of [/The land/, /The world/]) {
    if ((await k<string>("globalThis.causalis.scale()")) === "globe") break;
    await page.getByRole("button", { name: back }).first().tap();
    await settle(1500);
  }
  await until(
    "their world whole again",
    async () => (await k<string>("globalThis.causalis.scale()")) === "globe",
  );
  await menu(".world-galaxy");
  check(await seen(".world-galaxy"), `${tag}: no way back to the galaxy on the screen`);
  await press(".world-galaxy");
  await page.waitForURL((url) => url.searchParams.get("seed") === home.seed, {
    timeout: slow(180000),
  });
  await drawn();
  await k("globalThis.causalis.client.setSpeed(0)");
  await until("their world as the galaxy has it", () => inPage(".folk-play"), slow(120000));
  check((await ask<{ t: number }>("now")).t === homeNow, `${tag}: the home world's year moved`);
  check(
    JSON.stringify(await ask("hashes")) === homeHashes,
    `${tag}: the home world came back changed`,
  );
  await settle(1200);
  await shot("7-back");

  // 6. Entered again: taken up where it was left.
  await press(".folk-play");
  await until("the asking, again", () => seen(".enter-ask .enter-go"));
  check(
    /been here before/.test(await words(".enter-ask")),
    `${tag}: it does not know it was entered before`,
  );
  const t1 = Date.now();
  await press(".enter-ask .enter-go");
  await page.waitForURL(theirs, { timeout: slow(120000) });
  await page.waitForFunction(() => !!(globalThis as Causalis).causalis?.entered, undefined, {
    timeout: slow(300000),
  });
  await drawn();
  const again = (await k<NonNullable<Causalis["causalis"]>["entered"]>(
      "globalThis.causalis.entered",
    ))!,
    now = (await ask<{ t: number }>("now")).t;
  say(
    `${tag}: entered again in ${((Date.now() - t1) / 1000).toFixed(1)} s, at its year ${Math.floor(now / YEAR)} (left in ${Math.floor(lived / YEAR)})`,
  );
  check(again.loaded, `${tag}: entered again, their world was made again`);
  check(now >= lived, `${tag}: entered again, their world had gone back (${now} < ${lived})`);
  await settle(1500);
  await shot("8-again");

  // 7. The HUD on their world, by the home world's: at a phone's size, then at a desk's.
  const phone = own(await faults(), homeFaults);
  check(phone.length === 0, `${tag}: on their world, at a phone's size: ${phone.join("; ")}`);
  await press(".world-entered");
  await until("what this world is, told", () => seen(".enter-about"));
  const about = await words(".enter-about");
  check(
    about.includes(f.name) && /Not as it was seen/.test(about),
    `${tag}: the bar's line does not open what this world is`,
  );
  await shot("9-about");
  const told = own(await faults(), homeFaults).filter((x) => !/enter-/.test(x));
  check(told.length === 0, `${tag}: under what this world is, told: ${told.join("; ")}`);
  await press(".enter-about .enter-stay");
  const farUrl = page.url();
  await page.setViewportSize({ width: 1366, height: 800 });
  await page.goto(homeUrl);
  await drawn();
  await settle(2500);
  const deskHome = await faults();
  await page.goto(farUrl);
  await page.waitForFunction(() => !!(globalThis as Causalis).causalis?.entered, undefined, {
    timeout: slow(300000),
  });
  await drawn();
  await settle(2500);
  const desk = own(await faults(), deskHome);
  check(desk.length === 0, `${tag}: on their world, at a desk's size: ${desk.join("; ")}`);
  say(
    `${tag}: the HUD on their world: ${phone.length} faults of its own at a phone's size, ${desk.length} at a desk's (the home world's own: ${homeFaults.length}, ${deskHome.length})`,
  );
  await shot("10-desk");
  check(
    errors.length === 0,
    `${tag}: errors in the page: ${errors.slice(0, 3).join(" | ").slice(0, 600)}`,
  );
  await context.close();
}

try {
  for (const home of HOMES) if (!only || only === home.universe) await walk(home);
} finally {
  await browser.close();
  await new Promise<void>((done) => server.httpServer.close(() => done()));
}
if (problems.length) {
  console.log("gate 121 fails:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("gate 121 passes: another people's world is played, left and taken up again");
