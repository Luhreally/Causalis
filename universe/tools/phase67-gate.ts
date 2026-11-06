// node tools/phase67-gate.ts [--ci] [--soft] [--shots dir] [--baked file] [--frames]
// The Phase 67 gate ("Star wars seen": a fleet fight among the stars, and a raid's landers coming
// down on a town), on the built app at an iPhone 15 Plus's size, by touch:
//   1. the title's way to the wars among the stars, one tap: its words, its fit, the way in;
//   2. the world opened at its baked year (Earth's "tide 207", its first star war and raid), the
//      film begun by itself, the world's hash as it was run there;
//   3. the plan agrees with the record: the list's best is this fight, a raid that came down, won;
//   4. unpaused, the film plays by itself: its time grows, the chrome is hidden, the year is on its box;
//   5. the orbit moments by scrub (arrive, fight, close, rout, after): the stages, the caption, the
//      tally, the survivors and wrecks, and the budgets of what is drawn;
//   6. the sides fire what they have: beams in the air if and only if a side is a beam arm;
//   7. a scrub is exact: the same share draws the same numbers, whatever came before;
//   8. the pause holds; its button runs the film and holds it again; the course bar scrubs to its middle;
//   9. a ship tapped: its page, and the film still playing where it was;
//  10. down to the town: the film's second act, on the raid's town, at the village scale;
//  11. the town moments by scrub (landers, out, streets, burning, lifting) and the town war's figures;
//  12. tapped in the town: a raider's page, then a defender's, which opens the raid's page;
//  13. it ends in the town, live: the eye free, the clock and the world as they were, no raid's war left;
//  14. the wars button, two taps: the sheet fits a phone, its watches are thumb-sized, and the first
//      fight without a town is watched (a war that stayed in the sky lands nowhere);
//  15. a fought war's page, and its "Watch it" from there;
//  16. with --frames (GPU only): the film at the fight, unpaused, its median frame at 25 ms or less;
//  17. the world's hash as it was;
//  18. the director, its clock let run: a take of the newest fight, when it is recent enough to be
//      filmed; and no error in the page.
// On CI and by default the world is run from year 1380 by twenties until it holds a star war and a
// raid that came down (by year 1900), then saved; --baked <file> takes Earth's "tide 207" save at
// year 2,000. (npm run build first. --frames needs a graphics card.)
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { preview } from "vite";
import { chromium } from "playwright";
import { YEAR, rulesetId, saveWorld, seedFromText } from "../src/kernel/index.ts";
import { EARTH } from "../src/host/planet.ts";
import { starFights } from "../src/host/starfight.ts";
import type { StarFightList, StarFightPlan } from "../src/bridge/index.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  frames = argv.includes("--frames"),
  shotsAt = argv.indexOf("--shots"),
  shots = shotsAt >= 0 ? argv[shotsAt + 1] : undefined,
  bakedAt = argv.indexOf("--baked"),
  bakedFile = bakedAt >= 0 ? argv[bakedAt + 1] : undefined,
  // (A save of another year than the catalogue's: one this gate's own run left behind.)
  yearAt = argv.indexOf("--year"),
  bakedYear = yearAt >= 0 ? Number(argv[yearAt + 1]) : undefined;
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

// The world: Earth's "tide 207", run to its first star war and raid, or its baked save at year 2,000.
const SEED = "tide 207",
  BAKED_YEAR = 2000;
const root = fileURLToPath(new URL("..", import.meta.url)),
  baked = join(root, "dist", "baked"),
  started = performance.now();
let AT = 0,
  direct: unknown = null,
  bytes: Buffer,
  ruleset: string;
{
  const world = EARTH.build(seedFromText(SEED));
  ruleset = rulesetId(world, EARTH.version);
  if (bakedFile) {
    bytes = readFileSync(bakedFile);
    AT = bakedYear ?? BAKED_YEAR;
  } else {
    for (let y = 1380; y <= 1900; y += 20) {
      world.runTo(y * YEAR);
      const found = starFights(world);
      if (
        found.fights.some((x) => x.road === "starwar") &&
        found.fights.some((x) => x.town && x.ships)
      ) {
        AT = y;
        break;
      }
    }
    if (!AT) throw new Error(`no star war and raid by year 1900 on ${SEED}`);
    direct = world.domainHashes();
    bytes = gzipSync(JSON.stringify(saveWorld(world, ruleset, { universe: EARTH.name })));
    say(`the world run to year ${AT} in ${((performance.now() - started) / 1000).toFixed(0)} s`);
  }
}
mkdirSync(baked, { recursive: true });
const file = `earth-${AT}.save`;
writeFileSync(join(baked, file), bytes);
writeFileSync(
  join(baked, "manifest.json"),
  JSON.stringify({
    worlds: [{ universe: "earth", seed: SEED, year: AT, file, bytes: bytes.length, ruleset }],
  }),
);

const server = await preview({
    root,
    logLevel: "silent",
    preview: { port: 4267, strictPort: false },
  }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  });
const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    // (Three times the pixels each way is nine times the drawing: without a graphics card, as on CI,
    // frames then outlast a tap's wait.)
    deviceScaleFactor: ci || soft ? 1 : 3,
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
const ask = <T>(type: string, args: unknown = {}) =>
  k<T>(
    `globalThis.causalis.client.query({ type: ${JSON.stringify(type)}, args: ${JSON.stringify(args)} })`,
  );
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};
const until = async (what: string, ok: () => Promise<boolean>, ms = slow(60000)) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await page.waitForTimeout(60);
  }
  problems.push(`${what} did not come`);
  return false;
};
const hashes = () => ask<unknown>("hashes");
const worldNow = () => ask<{ t: number }>("now");
const scale = () => k<string>("globalThis.causalis.scale()");
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const text = (sel: string) =>
  k<string>(`document.querySelector(${JSON.stringify(sel)})?.textContent ?? ""`);
const centre = (sel: string) =>
  k<{ x: number; y: number } | null>(`(() => {
    const e = document.querySelector(${JSON.stringify(sel)});
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  })()`);
/** A year as a caption or a box says it: with or without thousands separators. */
const hasYear = (words: string, year: number) => words.replace(/[,\s]/g, "").includes(String(year));

const f = "globalThis.causalis.fleetFilm";
/** The film as it says of itself (fleetFilm.state()): its act and fight, its time in the act, what it tells. */
type FilmState = {
  cutting: boolean;
  id: string | null;
  act: "orbit" | "town" | null;
  stage: string | null;
  /** Seconds into the act, and the act's length in seconds. */
  t: number;
  end: number;
  /** The share of the act's time, from 0 to 1. */
  k: number;
  words: string;
  tally: string;
  /** Who is still afloat, the attacker then the defender. */
  left: number[];
  townHeld: boolean;
};
/** What is drawn at a moment (fleetFilm.sample()): shots in the air, wrecks, the town's landers and raiders. */
type FilmSample = {
  beams: number;
  missiles: number;
  wrecks: number;
  landers: { high: number }[];
  raiders: { size: number }[];
  fires: number;
  firesSeen: number;
  fireSpots: (readonly (number | null)[])[];
};
/** The budgets of what is drawn (fleetFilm.shown()), as the layers report them. */
type Shown = { ships: number; drawCalls: number; triangles: number };
const state = () => k<FilmState>(`${f}.state()`);
const playing = () => k<boolean>(`${f}.playing`);
const openPage = () => k<string | null>("globalThis.causalis.pageOpen()");
const frame = () => k<null>("new Promise((done) => requestAnimationFrame(() => done(null)))");
/** The share of its act's time that t seconds into the act is, as the scrub takes it. */
const shareAt = async (t: number) => Math.min(1, t / (await state()).end);
/** The film paused at a share of its act's time; a picture of it, if it is named; the act checked. */
const seek = async (act: 0 | 1, share: number, name: string) => {
  await until("the cut over", async () => !(await state()).cutting, slow(60000));
  await k(`(${f}.pause(true), ${f}.scrub(${share}))`);
  await page.waitForTimeout(slow(400));
  if (name) await shot(name);
  check(
    (await state()).act === (act === 0 ? "orbit" : "town"),
    `${name || `share ${share}`}: the film is not in its ${act === 0 ? "orbit" : "town"} act`,
  );
};

try {
  // 1. The title's way to the wars among the stars: one tap.
  await page.goto(base);
  await page.waitForSelector(".title-menu .starwar-choice", { timeout: slow(60000) });
  const choice = page.locator(".title-menu .starwar-choice").first();
  const chosen = ((await choice.textContent()) ?? "").replace(/\s+/g, " ");
  say(`the title: “${chosen}”`);
  check(/Wars among the stars/.test(chosen), `the title's way says “${chosen}”`);
  // (Once the title has settled: the rows above it take their words a moment after it opens.)
  await page.waitForTimeout(slow(800));
  const box = await choice.boundingBox();
  say(`its row: ${JSON.stringify(box)}`);
  check(
    !!box && box.x >= 0 && box.x + box.width <= 430 && box.y >= 0 && box.y + box.height <= 932,
    "the title's way to the wars does not fit a phone's screen",
  );
  await shot("01-title");
  await page.tap(".title-menu .starwar-choice");
  await page.waitForURL(/starwar=1/, { timeout: slow(60000) });
  check(/seed=tide/.test(page.url()), `the way to the wars begins ${page.url()}`);

  // 2. The world opened at its baked year: the film begun by itself, and the world as it was run there.
  await page.goto(`${base}?universe=earth&seed=tide%20207&year=${AT}&starwar=1&hold`);
  await until("the wars' film", playing, slow(180000));
  await until("the film's first stage", async () => (await state()).stage !== null, slow(60000));
  const before = await hashes(),
    t0 = await worldNow();
  if (direct) check(same(before, direct), "the world fetched is not the world run there");

  // 3. The plan agrees with the record.
  const id = (await state()).id;
  if (!id) throw new Error("the film has no fight");
  const plan = await ask<StarFightPlan | null>("star.fight", { id });
  const list = await ask<StarFightList>("star.fights");
  if (!plan) throw new Error(`the film's fight ${id} has no plan`);
  if (!plan.landing) throw new Error(`the raid ${id} has no landing`);
  const landing = plan.landing;
  check(list.best === id, `the list's best is ${list.best}, not ${id}`);
  check(plan.won === true, "the plan says the raid was not won");
  check(plan.road === "raid", `the plan's road is ${plan.road}`);
  say(`the record: “${plan.claim}” Why: “${plan.why}”`);
  const defended = plan.defender.sky !== "none";

  // 4. It plays by itself: unpaused, its time grows; the chrome hidden; the year on its box.
  const t1 = (await state()).t;
  await k(`${f}.pause(false)`);
  await page.waitForTimeout(slow(2000));
  const t2 = (await state()).t;
  check(t2 > t1, `the film did not play itself: its time went from ${t1} to ${t2}`);
  const chromeHidden = await k<boolean>(
    `[...document.querySelectorAll("#hud > *:not(.fleet-film):not(.swap):not(.readying):not(.page-panel)")].every((e) => getComputedStyle(e).display === "none")`,
  );
  check(chromeHidden, "the game's chrome shows over the film");
  const yearBox = await text(".fleet-film .film-year");
  check(hasYear(yearBox, plan.year), `the film's year box says “${yearBox}”, not ${plan.year}`);

  // 5. The orbit moments, by scrub: each stage where it is due, the caption, the tally, the budgets.
  const orbit: [number, string, string][] = [
    [4, "02-arrive", "arrive"],
    [12, "03-fight", "fight"],
    [28, "04-close", "fight"],
    [38, "05-rout", "rout"],
    [46, "06-after", "after"],
  ];
  for (const [t, name, stage] of orbit) {
    await seek(0, await shareAt(t), name);
    const s = await state(),
      sh = await k<Shown>(`${f}.shown()`);
    if (defended) check(s.stage === stage, `at ${t} s the stage is “${s.stage}”, not “${stage}”`);
    check(sh.ships <= 64, `${sh.ships} ships drawn at ${t} s`);
    check(sh.drawCalls <= 20, `${sh.drawCalls} draw calls at ${t} s`);
    check(sh.triangles <= 12000, `${sh.triangles} triangles at ${t} s`);
    if (t === 12) {
      check(s.words.includes("fire"), `at 12 s the caption is “${s.words}”`);
      const most = await k<number>(`(() => {
        const end = ${f}.state().end;
        let most = 0;
        for (const t of [10, 11, 11.5, 12, 12.5, 13, 14]) {
          ${f}.scrub(Math.min(1, t / end));
          const q = ${f}.sample();
          most = Math.max(most, q.beams + q.missiles);
        }
        return most;
      })()`);
      check(most > 0, "no beam or missile in the air around 12 s");
    }
    if (t === 46) {
      check(
        hasYear(s.words, plan.year),
        `at 46 s the caption “${s.words}” does not say ${plan.year}`,
      );
      check(
        s.tally.includes("ships drawn") && s.tally.includes("not"),
        `at 46 s the tally is “${s.tally}”`,
      );
      if (defended) {
        check(
          (s.left[0] ?? 0) > 0 && (s.left[1] ?? 0) === 0,
          `at 46 s the afloat are ${s.left.join(" and ")}`,
        );
        const smp = await k<FilmSample>(`${f}.sample()`);
        check(smp.wrecks > 0, `${smp.wrecks} wrecks at 46 s`);
      }
    }
  }

  // 6. The sides fire what they have: beams in the air if and only if a side is a beam arm.
  const beamArms = plan.attacker.arm === "beam" || plan.defender.arm === "beam";
  const fired = await k<{ beams: number; missiles: number }>(`(() => {
    const end = ${f}.state().end;
    let beams = 0, missiles = 0;
    for (let t = 8; t <= 33; t += 1) {
      ${f}.scrub(Math.min(1, t / end));
      const q = ${f}.sample();
      beams += q.beams;
      missiles += q.missiles;
    }
    return { beams, missiles };
  })()`);
  say(
    `from 8 to 33 s: ${fired.beams} beam shots and ${fired.missiles} missile shots; arms ${plan.attacker.arm} and ${plan.defender.arm}`,
  );
  check(
    fired.beams > 0 === beamArms,
    `${fired.beams} beam shots in the air, where the arms are ${plan.attacker.arm} and ${plan.defender.arm}`,
  );

  // 7. A scrub is exact: the same share, the same numbers, whatever came before.
  await k(`${f}.pause(true)`);
  await k(`${f}.scrub(0.5)`);
  await frame();
  const a = await k<FilmSample>(`${f}.sample()`);
  await k(`${f}.scrub(0.2)`);
  await frame();
  await k(`${f}.scrub(0.5)`);
  await frame();
  const b = await k<FilmSample>(`${f}.sample()`);
  check(same(a, b), "the same share drew other numbers after a scrub");

  // 8. The pause holds; its button runs the film and holds it again; the course bar scrubs to its middle.
  const held = (await state()).t;
  await page.waitForTimeout(slow(1000));
  check((await state()).t === held, "the film moved while it was paused");
  await page.tap(".fleet-pause");
  await page.waitForTimeout(slow(1000));
  check((await state()).t > held, "its pause button did not start the film");
  await page.tap(".fleet-pause");
  const heldAgain = (await state()).t;
  await page.waitForTimeout(slow(1000));
  check((await state()).t === heldAgain, "its pause button did not hold the film again");
  const course = await centre(".fleet-course");
  check(!!course, "there is no course bar to scrub");
  if (course) await page.touchscreen.tap(course.x, course.y);
  await page.waitForTimeout(slow(400));
  const middle = (await state()).k;
  check(middle >= 0.45 && middle <= 0.55, `the middle of the course scrubs to ${middle}`);

  // 9. A ship tapped: its page; the film still playing where it was.
  await seek(0, await shareAt(12), "");
  const at12 = await state();
  const ship = await k<{ x: number; y: number } | null>(`${f}.shipOnScreen(0)`);
  check(!!ship, "no ship on the screen at 12 s");
  if (ship) await page.touchscreen.tap(ship.x, ship.y);
  // (A press goes aboard, Phase 73; her page is a button of the ride's.)
  await until("aboard a ship", async () => !!(await k(`${f}.riding()`)));
  const shipButton = await centre(".ride-ship");
  check(!!shipButton, "there is no button for the ship ridden");
  if (shipButton) await page.touchscreen.tap(shipButton.x, shipButton.y);
  await until("a ship's page", async () => ((await openPage()) ?? "").startsWith("ship:"));
  // (Its window opens at once, its words a moment after.)
  await until("a ship's page's words", async () => (await text(".page-title")) !== "…");
  await shot("07-ship-page");
  const shipTitle = await text(".page-title"),
    shipWords = await text(".page-window");
  check(/^The /.test(shipTitle), `a ship's page is titled “${shipTitle}”`);
  check(
    shipWords.includes("not ship by ship"),
    "a ship's page does not say that history keeps a fleet as a whole",
  );
  await k("globalThis.causalis.closePage()");
  await k(`${f}.ride(null)`);
  const after9 = await state();
  check(
    after9.t === at12.t && (await playing()),
    "the film moved or stopped while a ship's page was open",
  );

  // 10. Down to the town: the film's second act, on the raid's town, at the village scale.
  await k(`${f}.toAct(1)`);
  await until(
    "the film's town act",
    async () => {
      const s = await state();
      return s.act === "town" && s.townHeld;
    },
    slow(60000),
  );
  const townNow = await k<string>("globalThis.causalis.planNow()?.ref ?? ''");
  check(townNow === landing.town, `the town is ${townNow}, not ${landing.town}`);
  check((await scale()) === "village", `the scale is ${await scale()}`);

  // 11. The town moments, by scrub.
  const townMoments: [number, string][] = [
    [3, "08-landers"],
    [10, "09-out"],
    [20, "10-streets"],
    [30, "11-burning"],
    [42, "12-lifting"],
  ];
  for (const [t, name] of townMoments) {
    await seek(1, await shareAt(t), name);
    const s = await state(),
      smp = await k<FilmSample>(`${f}.sample()`),
      sh = await k<Shown>(`${f}.shown()`),
      tw = await k<{ soldiers: number; fallen: number } | null>("globalThis.causalis.townWar()");
    check(sh.drawCalls <= 22, `${sh.drawCalls} draw calls at ${t} s in the town`);
    if (t === 3)
      check(
        smp.landers.some((l) => l.high > 0),
        "no lander is high at 3 s",
      );
    if (t === 10)
      check(
        smp.landers.every((l) => l.high === 0),
        "a lander is still high at 10 s",
      );
    if (t === 20) {
      const onGround = smp.raiders.filter((r) => r.size > 0).length;
      check(onGround >= 6, `${onGround} raiders on the ground at 20 s`);
      check((tw?.soldiers ?? 0) >= 4, `${tw?.soldiers ?? 0} soldiers of the town's guard at 20 s`);
    }
    if (t === 30) {
      if (landing.razed > 0) {
        check(smp.fires >= 1, `${smp.fires} fires at 30 s, where homes burn`);
        say(`at 30 s: ${smp.fires} homes alight, ${smp.firesSeen} of them on the screen`);
        say(
          `  x, z, high, on the screen: ${smp.fireSpots.map((f) => f.map((n) => (n === null ? "-" : Math.round(n))).join(",")).join(" ")}`,
        );
        check(smp.firesSeen >= 2, `${smp.firesSeen} fires on the screen at 30 s, where homes burn`);
      }
      check((tw?.fallen ?? 0) >= 1, `${tw?.fallen ?? 0} fallen at 30 s`);
      check(
        s.words.includes(landing.dead.toLocaleString("en")),
        `at 30 s the caption “${s.words}” does not give ${landing.dead.toLocaleString("en")} dead`,
      );
    }
    if (t === 42) check(s.words.includes("realm stands"), `at 42 s the caption is “${s.words}”`);
  }

  // 12. Tapped in the town: a raider's page; a defender's, which opens the raid's page.
  await seek(1, await shareAt(20), "");
  const raider = await k<{ x: number; y: number } | null>(
    "globalThis.causalis.fleetFilm.raiderOnScreen()",
  );
  check(!!raider, "no raider on the screen at 20 s");
  // (A finger tries again if nothing comes, as anyone's does; a page that never comes still fails.)
  const tapUntil = async (x: number, y: number, what: string, ref: string) => {
    for (let i = 0; i < 3; i++) {
      await page.touchscreen.tap(x, y);
      for (let w = 0; w < slow(4000) / 60; w++) {
        if ((await openPage().catch(() => "")) === ref) return;
        await page.waitForTimeout(60);
      }
    }
    problems.push(`${what} did not come`);
  };
  if (raider) {
    await tapUntil(raider.x, raider.y, "a raider's page", landing.raiders.ref);
    await shot("13-raider-page");
    await k("globalThis.causalis.closePage()");
  }
  const defender = await k<{ x: number; y: number } | null>(
    "globalThis.causalis.fleetFilm.defenderOnScreen()",
  );
  check(!!defender, "no defender on the screen at 20 s");
  if (defender) {
    await tapUntil(defender.x, defender.y, "the raid's page", plan.event);
    await k("globalThis.causalis.closePage()");
  }

  // 13. It ends in the town, live: the film over, the same town, the eye free, the world and clock as they were.
  await k(`(${f}.scrub(0.98), ${f}.pause(false))`);
  await until("the film over", async () => !(await playing()), slow(30000));
  await page.waitForTimeout(slow(1000));
  await shot("14-town-after");
  check((await scale()) === "village", `after the film the scale is ${await scale()}`);
  const townAfter = await k<string>("globalThis.causalis.planNow()?.ref ?? ''");
  check(townAfter === landing.town, `the film ended in ${townAfter}, not ${landing.town}`);
  check(!(await k<boolean>(`!!${f}.state()?.townHeld`)), "the town is still held after the film");
  check(
    await k<boolean>("!!globalThis.causalis.rig?.enabled"),
    "the eye is not free after the film",
  );
  check(same(before, await hashes()), "the world changed while the film played");
  const t3 = await worldNow();
  check(t3.t === t0.t, `the clock moved from ${t0.t} to ${t3.t}`);
  const townWarAfter = await k<{ ref: string } | null>("globalThis.causalis.townWar()");
  check(
    !townWarAfter || townWarAfter.ref !== plan.id,
    "the town's war is still the raid's after the film",
  );

  // 14. The wars button, two taps: the sheet, then a watch of the first fight without a town.
  await page.tap(".wars-button");
  await until(
    "the sheet of the wars among the stars",
    () => page.isVisible(".star-sheet"),
    slow(30000),
  );
  const sheet = await k<{ fits: boolean; watch: number; rows: number } | null>(`(() => {
    const s = document.querySelector(".star-sheet");
    if (!s) return null;
    const r = s.getBoundingClientRect();
    const watches = [...s.querySelectorAll(".star-watch")].map((b) => b.getBoundingClientRect().height);
    return {
      fits: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight,
      watch: watches.length ? Math.min(...watches) : 0,
      rows: s.querySelectorAll(".colony-row").length,
    };
  })()`);
  check(!!sheet?.fits, "the wars sheet does not fit the screen");
  check((sheet?.watch ?? 0) >= 40, `its watch buttons are ${sheet?.watch ?? 0} px tall`);
  check((sheet?.rows ?? 0) <= 61, `the sheet has ${sheet?.rows ?? 0} rows`);
  await shot("15-sheet");
  const row = list.fights.find((x) => !x.town) ?? list.fights[0];
  check(!!row, "the list has no fight to watch");
  if (row) {
    await page.tap(`.star-sheet .star-row[data-id="${row.id}"] .star-watch`);
    await until("the chosen fight's film", playing, slow(30000));
    check((await state()).id === row.id, `the film plays ${(await state()).id}, not ${row.id}`);
    const rowPlan = await ask<StarFightPlan | null>("star.fight", { id: row.id });
    if (rowPlan && !rowPlan.landing) {
      // A war that stayed in the sky: played to its end, it says what the record says, and lands nowhere.
      await seek(0, 1, "");
      const endWords = (await state()).words;
      check(endWords.includes(rowPlan.claim), `at its end the caption is “${endWords}”`);
      await k(`${f}.pause(false)`);
      await until("the film over", async () => !(await playing()), slow(30000));
      const actNow = await k<string | null>(`${f}.state()?.act ?? null`);
      check(actNow !== "town", "a war that stayed in the sky landed on a town");
      check((await scale()) !== "village", "a war that stayed in the sky ended on the ground");
      await shot("16-road-2-after");
    } else {
      await k(`${f}.skip()`);
      await until("the film skipped", async () => !(await playing()), slow(60000));
    }
  }

  // 15. A fought war's page, and its "Watch it" from there.
  const warRow = list.fights.find((x) => x.road === "starwar");
  if (!warRow) say("no fought war among the stars: its page's way in is not seen");
  else {
    await k(`globalThis.causalis.pageWindowOpen(${JSON.stringify(warRow.page)})`);
    await page.waitForTimeout(slow(600));
    await shot("17-war-page");
    await page.locator('.act:has-text("Watch it")').first().tap();
    await until("the war's film from its page", playing, slow(30000));
    await k(`${f}.skip()`);
    await until("the film skipped", async () => !(await playing()), slow(60000));
  }

  // 17. The frames at the fight, unpaused (a graphics card only).
  if (frames) {
    await page.goto(`${base}?universe=earth&seed=tide%20207&year=${AT}&starwar=1&hold`);
    await until("the wars' film again", playing, slow(180000));
    await until(
      "the film's first stage again",
      async () => (await state()).stage !== null,
      slow(60000),
    );
    await seek(0, await shareAt(12), "");
    await k(`${f}.pause(false)`);
    await page.waitForTimeout(slow(600));
    const gaps = await k<number[]>(`new Promise((done) => {
      const gaps = [];
      let last = performance.now();
      const tick = (t) => {
        gaps.push(t - last);
        last = t;
        if (gaps.length < 120) requestAnimationFrame(tick);
        else done(gaps);
      };
      requestAnimationFrame(tick);
    })`);
    gaps.sort((x, y) => x - y);
    const median = gaps[Math.floor(gaps.length / 2)] ?? 0;
    say(
      `frames at the fight: median ${median.toFixed(1)} ms, slowest ${(gaps.at(-1) ?? 0).toFixed(1)} ms`,
    );
    check(median <= 25, `the film's median frame is ${median.toFixed(1)} ms`);
    await k(`${f}.pause(true)`);
  }

  // 18. Nothing changed by watching the wars among the stars.
  check(same(before, await hashes()), "watching the wars among the stars changed the world");

  // 16. The director: a take of the newest fight, when it is recent enough to be filmed.
  const newest = list.fights[0];
  if (newest && AT - newest.year <= 5) {
    // (The director holds while the clock does: it runs for this, the last step, so the hash above stands.)
    await k("globalThis.causalis.client.setSpeed(86400)");
    await k("globalThis.causalis.watchIt(true)");
    await until(
      "the director's take of a fight, or the film",
      async () =>
        (await k<string | null>("globalThis.causalis.director()?.take?.kind ?? null")) ===
          "starfight" || (await playing()),
      slow(30000),
    );
    if (await playing()) await k(`${f}.skip()`);
    await k("globalThis.causalis.watchIt(false)");
  } else
    say(`the newest fight is ${newest ? AT - newest.year : "none"} years back: no take to watch`);
} catch (e) {
  problems.push(`stopped: ${(e as Error).stack ?? e}`);
  await shot("99-where-it-stopped").catch(() => {});
}
for (const e of errors) problems.push(`error in the page: ${e.slice(0, 400)}`);
await browser.close();
await new Promise<void>((done) => server.httpServer.close(() => done()));
rmSync(baked, { recursive: true, force: true });
console.log(
  `Phase 67 gate: ${((performance.now() - started) / 1000).toFixed(0)} s, ${problems.length} problems`,
);
for (const p of problems) console.log(`  - ${p}`);
process.exit(problems.length ? 1 : 0);
