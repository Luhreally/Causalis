// node tools/phase64-gate.ts [--ci] [--soft] [--shots dir] [--baked file] [--frames] — the Phase 64 gate
// (a landing you can watch, asked for 2026-11-03: "emphaize how i wanna see the star wars and landing in
// planets and colonization and all that stuff"), on the built app at an iPhone 15 Plus's size, by touch:
//   1. a far year chosen on the title (the seed run ahead, here to year 1300), which says when landings come;
//   2. the worlds settled found a tap away, each with its landing to watch and its ground to go down to;
//   3. a moon's landing watched: its ship's crossing among the worlds, its moon coming up, its coming down
//      under that moon's own black sky, the first pods, the years going by as it grows into the town that
//      stands there now, the film over in that town; the world's clock held, the world's hash untouched;
//   4. skipped: a tap, and straight to the town as it stands;
//   5. down through the scales as at home: its land, its town, out to its world seen whole with its halls;
//   6. its people: one tapped (their card and page), the hand laid on it, one possessed and let go, the
//      world running on and its save whole;
//   7. the year run on to the next landing, the news told with the way to it;
//   8. the title's shortest way: "When ships come down on other worlds", Begin, and a landing plays by itself.
// (npm run build first; --baked takes a save already made instead of running the world there, the check
// against a world run there at once then left out; --frames, with a GPU, measures the frames in the town.)
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { preview } from "vite";
import { chromium } from "playwright";
import { YEAR, rulesetId, saveWorld, seedFromText } from "../src/kernel/index.ts";
import { EARTH } from "../src/host/planet.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  frames = argv.includes("--frames"),
  shotsAt = argv.indexOf("--shots"),
  shots = shotsAt >= 0 ? argv[shotsAt + 1] : undefined,
  bakedAt = argv.indexOf("--baked"),
  bakedFile = bakedAt >= 0 ? argv[bakedAt + 1] : undefined;
if (shots) mkdirSync(shots, { recursive: true });
const slow = (ms: number) => (ci || soft ? ms * 4 : ms);

const GPU = [
  "--enable-gpu",
  "--ignore-gpu-blocklist",
  "--use-angle=d3d11",
  "--force_high_performance_gpu",
];
/** The year the gate's world stands at: colonies on a planet and on moons, the next landing soon after. */
const AT = 1300;

const problems: string[] = [],
  check = (ok: boolean, what: string) => {
    if (!ok) problems.push(what);
  },
  say = (s: string) => console.log(`  ${s}`);

// The world, run to its year (the same save a deploy's bake would hold).
const root = fileURLToPath(new URL("..", import.meta.url)),
  baked = join(root, "dist", "baked"),
  started = performance.now();
let direct: unknown = null,
  bytes: Buffer,
  ruleset: string;
{
  const world = EARTH.build(seedFromText("first light"));
  ruleset = rulesetId(world, EARTH.version);
  if (bakedFile) bytes = readFileSync(bakedFile);
  else {
    world.runTo(AT * YEAR);
    direct = world.domainHashes();
    bytes = gzipSync(JSON.stringify(saveWorld(world, ruleset, { universe: EARTH.name })));
    say(`the world run to year ${AT} in ${((performance.now() - started) / 1000).toFixed(0)} s`);
  }
}
mkdirSync(baked, { recursive: true });
writeFileSync(join(baked, `earth-${AT}.save`), bytes);
writeFileSync(
  join(baked, "manifest.json"),
  JSON.stringify({
    worlds: [
      {
        universe: "earth",
        seed: "first light",
        year: AT,
        file: `earth-${AT}.save`,
        bytes: bytes.length,
        ruleset,
      },
    ],
  }),
);

const server = await preview({
    root,
    logLevel: "silent",
    preview: { port: 4264, strictPort: false },
  }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  });
const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
  }),
  page = await context.newPage(),
  errors: string[] = [];
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
type FilmState = { stage: string | null; k: number; year: number; words: string; growth: number };
const film = () => k<FilmState>("globalThis.causalis.colonyFilm.state()");
const playing = () => k<boolean>("globalThis.causalis.colonyFilm.playing");
const centre = (sel: string) =>
  k<{ x: number; y: number } | null>(`(() => {
    const e = document.querySelector(${JSON.stringify(sel)});
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  })()`);
type Entry = {
  cell: number;
  town: string | null;
  name: string | null;
  body: string | null;
  kind: string | null;
  people: number;
  founded: number;
  sailing: boolean;
  event: string | null;
};

try {
  // 1. A far year chosen on the title, the seed run ahead offered, what it says of landings.
  await page.goto(base);
  await page.waitForSelector(".title-menu .choice", { timeout: slow(60000) });
  await page.tap(".title-menu .choice:has-text('New world')");
  // (Its shortest way, whose beginning is seen from here; its landing playing, at the end.)
  await page.tap(".choice:has-text('When ships come down on other worlds')");
  await page.waitForTimeout(300);
  check(
    (await page.inputValue('.seed-input, input[aria-label="The world\'s seed"]')) === "first light",
    "the way to a landing did not choose the world run ahead",
  );
  await page.tap(".title-form .begin");
  await page.waitForURL(/seed=first(%20|\+)light.*year=1500.*landing=1|year=1500.*landing=1/, {
    timeout: slow(60000),
  });
  check(/universe=earth/.test(page.url()), `the way to a landing begins ${page.url()}`);
  await page.goto(base);
  await page.waitForSelector(".title-menu .choice", { timeout: slow(60000) });
  await page.tap(".title-menu .choice:has-text('New world')");
  await page.tap(".choice:has-text('At a year of your choosing')");
  await until("the seed run ahead on offer", () => page.isVisible(".year-ahead"));
  await page.tap(".year-ahead");
  await page.fill(".year-input", String(AT));
  await page.dispatchEvent(".year-input", "input");
  const note = (await page.textContent(".year-note")) ?? "";
  await shot("01-title");
  say(`the title: “${note}”`);
  check(/🚀/.test(note), `the title's note says nothing of where landings are found: “${note}”`);
  await page.fill(".year-input", "900");
  await page.dispatchEvent(".year-input", "input");
  const early = (await page.textContent(".year-note")) ?? "";
  check(/first landing/i.test(early), `too early, the title says “${early}”`);
  await page.fill(".year-input", String(AT));
  await page.dispatchEvent(".year-input", "input");
  await page.tap(".title-form .begin");
  await page.waitForURL(new RegExp(`year=${AT}`), { timeout: slow(60000) });
  // (Gates are spared news of landings unless they ask: this one does.)
  await page.goto(`${page.url()}&hold&landings`);
  await until(
    "the first picture",
    () => k<boolean>("(globalThis.causalis?.drawn?.() ?? 0) > 0"),
    slow(180000),
  );
  const at = await worldNow();
  check(at.t === AT * YEAR, `it stands at ${at.t / YEAR}`);
  const before = await hashes();
  if (direct) check(same(before, direct), "the world fetched is not the world run there");

  // 2. The worlds settled, a tap away.
  await until("the worlds settled's button", () => page.isVisible(".colonies-button"), slow(30000));
  const told = await until(
    "word of the worlds settled",
    () => page.isVisible(".colony-news"),
    slow(30000),
  );
  await shot("02-globe-with-news");
  if (told) say(`on opening: “${await page.textContent(".colony-news span")}”`);
  await page.tap(".colonies-button");
  await page.waitForSelector(".colony-row", { timeout: slow(10000) });
  const list = await ask<Entry[]>("colony.list"),
    landed = list.filter((c) => c.town);
  await shot("03-the-worlds-settled");
  say(
    `the worlds settled: ${landed.map((c) => `${c.name} on ${c.body} (${c.people}, ${c.founded})`).join("; ")}`,
  );
  check(landed.length >= 4, `only ${landed.length} colonies at year ${AT}`);
  const rows = await k<number>(`document.querySelectorAll(".colony-row").length`),
    fits = await k<boolean>(`(() => {
      const r = document.querySelector(".colony-sheet").getBoundingClientRect();
      return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
    })()`),
    tall = await k<number>(
      `Math.min(...[...document.querySelectorAll(".colony-row-acts button")].map((b) => b.getBoundingClientRect().height))`,
    );
  check(rows === list.length, `the sheet has ${rows} rows for ${list.length} colonies`);
  check(fits, "the sheet does not fit a phone");
  check(tall >= 40, `its buttons are ${tall} px tall`);
  const moon = landed.find((c) => c.kind === "moon") ?? landed[0]!,
    second = landed.find((c) => c.cell !== moon.cell) ?? moon;

  // 3. A moon's landing watched.
  const clockBefore = (await worldNow()).t;
  await page.tap(`.colony-watch[data-cell="${moon.cell}"]`);
  await until("its film", playing, slow(20000));
  const seen = new Set<string>(),
    years: number[] = [],
    caption: Record<string, string> = {},
    took: Record<string, boolean> = {},
    grown = new Set<number>();
  // (Pictures at the moments that tell it.)
  const moments: [string, number, string][] = [
    ["crossing", 0.5, "04-crossing"],
    ["crossing", 0.92, "05-crossing-arrives"],
    ["arrival", 0.5, "06-arrival"],
    ["descent", 0.55, "07-descent"],
    ["descent", 0.85, "08-touching-down"],
    ["first", 0.9, "09-first-pods"],
    ["growth", 0.25, "10-growing"],
    ["growth", 0.95, "11-grown"],
  ];
  const order = ["crossing", "arrival", "descent", "first", "growth"];
  const end = Date.now() + slow(180000);
  let chromeHidden = true,
    groundBlack = false;
  while (Date.now() < end && (await playing())) {
    const s = await film();
    if (!s.stage) {
      await page.waitForTimeout(40);
      continue;
    }
    seen.add(s.stage);
    years.push(s.year);
    caption[s.stage] = s.words;
    if (s.growth >= 0) grown.add(s.growth);
    chromeHidden &&= await k<boolean>(
      `[...document.querySelectorAll("#hud > *:not(.colony-film):not(.swap):not(.readying)")].every((e) => getComputedStyle(e).display === "none")`,
    );
    if (s.stage === "descent")
      groundBlack ||= await k<boolean>(
        `document.body.dataset.colony === "black" || document.body.dataset.colony === "air"`,
      );
    for (const [stage, share, name] of moments)
      if (
        !took[name] &&
        (order.indexOf(s.stage) > order.indexOf(stage) || (s.stage === stage && s.k >= share))
      ) {
        took[name] = true;
        await shot(name);
      }
    await page.waitForTimeout(ci || soft ? 200 : 60);
  }
  check(!(await playing()), "the film did not end");
  say(`its film: ${[...seen].join(" → ")}; ${[...grown].length} years of its growth drawn`);
  for (const [stage, words] of Object.entries(caption)) say(`  ${stage}: “${words}”`);
  // (A frame where software draws slowly may step over the short ones: never over the order of them.)
  check(
    seen.has("crossing") && seen.has("descent") && seen.has("growth"),
    `the film showed ${[...seen].join(", ")}`,
  );
  check(chromeHidden, "the game's chrome showed over the film");
  check(groundBlack, "no colony's sky over its descent");
  check(grown.size >= 2, `the town was drawn at only ${grown.size} years of its growth`);
  check(
    years.length > 1 && Math.floor(years[0]!) <= moon.founded && years.at(-1)! > moon.founded,
    `the film's years went ${years[0]} … ${years.at(-1)}`,
  );
  // Its end: the town as it stands, its people, its sky, the world's clock where it was, nothing changed.
  check((await scale()) === "village", `it ended at scale ${await scale()}`);
  const after = await hashes();
  check(same(before, after), "watching a landing changed the world's hash");
  check((await worldNow()).t === clockBefore, "the world's clock ran during the film");
  // (The book's page of it, from the list's “?”.)
  const concept = await ask<{ title?: string } | null>("page", { ref: "concept:colonies" });
  check(/colonies/i.test(concept?.title ?? ""), `the book's page: “${concept?.title}”`);
  await page.waitForTimeout(slow(1000));
  await shot("12-the-town-after");
  const shownTown = await k<{ ref: string; colony: boolean; dataset: string | undefined }>(`({
    ref: globalThis.causalis.planNow().ref,
    colony: !!globalThis.causalis.planNow().colony,
    dataset: document.body.dataset.colony,
  })`);
  check(shownTown.ref === moon.town, `it ended in ${shownTown.ref}, not ${moon.town}`);
  check(shownTown.colony, "the town it ended in has no world of its own");
  check(!!shownTown.dataset, "no colony's sky over its town");
  // How it grew: from a first camp to more of it, year on year, as the land's ledger says.
  const growth = await ask<{ year: number; people: number; homes: number }[]>("colony.growth", {
    cell: moon.cell,
    frames: 8,
    axis: 0,
    most: 400,
  });
  say(
    `its growth: ${growth.map((f) => `${f.year}: ${f.people} people, ${f.homes} homes`).join("; ")}`,
  );
  check(
    growth.length >= 3 && growth[0]!.year === moon.founded,
    `its growth has ${growth.length} frames, from ${growth[0]?.year}`,
  );
  check(growth.at(-1)!.people > growth[0]!.people, "its people did not grow through its years");
  check(growth.at(-1)!.homes > growth[0]!.homes, "its homes did not grow through its years");
  // The first in the world's firsts is the very landing the list plays (the eye that watches by itself films it).
  const firsts = await ask<{ what: string; ref: string | null }[]>("world.firsts"),
    firstColony = firsts.find((f) => /colony/i.test(f.what));
  check(
    !!firstColony && landed.some((c) => c.event === firstColony.ref),
    `the world's first colony (${firstColony?.ref}) is none of the list's landings`,
  );

  // 4. Skipped: straight to the town as it stands.
  await page.tap(".colonies-button");
  await page.waitForSelector(".colony-row");
  await page.tap(`.colony-watch[data-cell="${second.cell}"]`);
  await until("a second film", async () => (await film()).stage !== null, slow(30000));
  await page.waitForTimeout(slow(600));
  await page.tap(".film-skip");
  await until("the film skipped", async () => !(await playing()), slow(60000));
  check((await scale()) === "village", `skipped, it stands at scale ${await scale()}`);
  check(
    (await k<string>("globalThis.causalis.planNow().ref")) === second.town,
    "skipped, it is not in the colony's town",
  );

  // A landing asked for from a land and a town of the home world: the same, and back to it by the same way.
  const towns = await ask<{ ref: string; cell: number }[]>("towns.map"),
    home = towns.filter((t) => !t.ref.startsWith("town:1:"))[0]!;
  await k(`globalThis.causalis.goTo("cell:0:${home.cell}")`);
  await until("a land of the home world", async () => (await scale()) === "region", slow(60000));
  await page.waitForTimeout(slow(800));
  await page.tap(".colonies-button");
  await page.waitForSelector(".colony-row");
  await page.tap(`.colony-watch[data-cell="${moon.cell}"]`);
  await until("a film from a land", async () => (await film()).stage !== null, slow(30000));
  await page.tap(".film-skip");
  await until("the film skipped", async () => !(await playing()), slow(60000));
  check(
    (await k<string>("globalThis.causalis.planNow().ref")) === moon.town,
    "from a land of the home world, it ended elsewhere",
  );
  await k(`globalThis.causalis.goTo(${JSON.stringify(home.ref)})`);
  await until(
    "a town of the home world",
    async () => (await k<string>("globalThis.causalis.planNow()?.ref ?? ''")) === home.ref,
    slow(60000),
  );
  await page.waitForTimeout(slow(1000));
  check(
    !(await k<boolean>(`!!document.body.dataset.colony`)),
    "a colony's sky over a town of the home world",
  );
  await shot("12b-home-town-after-a-colony");
  // (A large home town, drawn without a graphics card, can take a frame long enough to outlast a tap's
  // wait. Told, so that a freeze would be seen as one.)
  const frameMs = await page.evaluate(
    () =>
      new Promise<number>((done) => {
        const start = performance.now();
        let left = 5;
        const next = () =>
          --left ? requestAnimationFrame(next) : done((performance.now() - start) / 4);
        requestAnimationFrame(() => requestAnimationFrame(next));
      }),
  );
  say(`  a frame in the home town after a colony: ${Math.round(frameMs)} ms`);
  page.setDefaultTimeout(slow(60000));
  await page.tap(".colonies-button");
  await page.waitForSelector(".colony-row");
  await page.tap(`.colony-watch[data-cell="${moon.cell}"]`);
  await until("a film from a town", async () => (await film()).stage !== null, slow(30000));
  await page.tap(".film-skip");
  await until("the film skipped", async () => !(await playing()), slow(60000));
  check(
    (await k<string>("globalThis.causalis.planNow().ref")) === moon.town,
    "from a town of the home world, it ended elsewhere",
  );

  // 5. Down through the scales as at home: its land, its town, out to its world seen whole.
  await page.tap(".colonies-button");
  await page.waitForSelector(".colony-row");
  await page.tap(`.colony-down[data-cell="${moon.cell}"]`);
  await until("its land", async () => (await scale()) === "region", slow(60000));
  await until(
    "its town on its land",
    async () => (await k<number>("globalThis.causalis.villages()")) > 0,
    slow(60000),
  );
  await page.waitForTimeout(slow(1500));
  await shot("13-its-land");
  const land = await k<{ parts: number }>("({ parts: globalThis.causalis.landParts() })");
  check(land.parts > 0, "its town is not drawn on its land");
  // Its lenses and a tap on its bare ground, as at home; no brushes for its ground.
  check(await page.isHidden(".brush-toggle"), "the god's brushes are offered on a colony's ground");
  for (const lens of ["Height", "Soil", "Land"]) {
    await page.tap(`.speed:has-text("${lens}")`);
    await page.waitForTimeout(slow(500));
  }
  await page.touchscreen.tap(215, 800);
  await page.waitForTimeout(slow(900));
  await k("globalThis.causalis.closePage()");
  await k("globalThis.causalis.zoomThrough('out')");
  await until("its world seen whole", async () => (await scale()) === "world", slow(60000));
  await page.waitForTimeout(slow(1500));
  const halls = await k<number>("globalThis.causalis.hallsShown()");
  await shot("14-its-world");
  check(halls >= 1, "no halls on its world");
  await k("globalThis.causalis.zoomThrough('in')");
  await until("down to its land again", async () => (await scale()) === "region", slow(60000));
  await until(
    "its town on its land again",
    async () => (await k<number>("globalThis.causalis.villages()")) > 0,
    slow(60000),
  );
  await k("globalThis.causalis.zoomThrough('in')");
  await until("its town", async () => (await scale()) === "village", slow(60000));
  check(
    (await k<string>("globalThis.causalis.planNow().ref")) === moon.town,
    "the zoom in from its land came to another town",
  );

  // 6. Its people: one tapped, and one possessed.
  const peopleOf = () =>
    k<{ index: number; x: number; z: number }[]>("globalThis.causalis.peopleNow()");
  /** One of those drawn before the eye, where they are on the screen. */
  const onScreen = async (index: number): Promise<{ x: number; y: number } | null> => {
    const p = (await peopleOf()).find((q) => q.index === index);
    if (!p) return null;
    await k(
      `globalThis.causalis.rig.flyTo({ target: { x: ${p.x * 0.1}, y: 0, z: ${p.z * 0.1} }, distance: 3.5, pitch: -40 })`,
    );
    await page.waitForTimeout(slow(500));
    await page
      .waitForFunction(
        () => !(globalThis as { causalis?: { rig?: { flying?: boolean } } }).causalis?.rig?.flying,
        undefined,
        {
          timeout: slow(15000),
        },
      )
      .catch(() => undefined);
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(slow(300));
      const at = await k<{ x: number; y: number } | null>(
        `globalThis.causalis.personOnScreen(${index})`,
      );
      if (at) return at;
    }
    return null;
  };
  await k(`globalThis.causalis.client.advance(${clockBefore + 9 * 3600})`);
  await until(
    "its morning",
    async () =>
      (await k<number>("globalThis.causalis.client.status?.t ?? 0")) >= clockBefore + 9 * 3600 - 1,
    slow(60000),
  );
  await k("globalThis.causalis.client.setSpeed(0)");
  await page.waitForTimeout(slow(1500));
  const folk = await peopleOf();
  check(folk.length > 0, "no one drawn in its town");
  let carded = false,
    cardWords = "";
  for (const who of folk.slice(0, 6)) {
    const spot = await onScreen(who.index);
    if (!spot) continue;
    await page.touchscreen.tap(spot.x, spot.y);
    await page.waitForTimeout(slow(900));
    const picked = await k<number | null>("globalThis.causalis.watched?.() ?? null");
    if (picked !== null) {
      cardWords = await k<string>(
        `globalThis.causalis.planNow().people[globalThis.causalis.watched()]?.name ?? ""`,
      );
      carded = true;
      break;
    }
  }
  await shot("15-one-of-them");
  say(`one of them tapped: “${cardWords}”`);
  check(carded, "none of its people could be tapped");

  // The hand on it, and one of them possessed; let go, the world running on.
  await k(`globalThis.causalis.closePage()`);
  await k(
    `globalThis.causalis.client.command("hand.lay", { village: ${JSON.stringify(moon.town)} })`,
  );
  await page.waitForTimeout(slow(1200));
  await k(`globalThis.causalis.reloadPlan?.()`);
  await page.waitForTimeout(slow(1500));
  const candidates = await k<{ index: number; name: string; child?: boolean }[]>(
    "globalThis.causalis.possess.candidates()",
  );
  check(candidates.length > 0, "none under the hand in its town");
  const chosen = candidates.find((c) => !c.child);
  let taken = false;
  if (chosen) {
    for (let i = 0; i < 3 && !taken; i++) {
      const holding = await k<string | null>("globalThis.causalis.palette.holding()");
      if (holding !== "possess")
        for (const sel of [".palette-toggle", '.palette-tab[data-kind="flesh"]', ".palette-act"]) {
          if (
            sel === ".palette-toggle" &&
            (await k<boolean>(`!!document.querySelector(".palette.open")`))
          )
            continue;
          const spot = await centre(sel);
          if (spot) {
            await page.touchscreen.tap(spot.x, spot.y);
            await page.waitForTimeout(slow(300));
          }
        }
      const spot = await onScreen(chosen.index);
      if (!spot) continue;
      await page.touchscreen.tap(spot.x, spot.y);
      await page
        .waitForFunction(
          () =>
            !!(
              globalThis as { causalis?: { possess?: { state(): { live: unknown } | null } } }
            ).causalis?.possess?.state()?.live,
          undefined,
          { timeout: slow(20000) },
        )
        .catch(() => undefined);
      taken = await k<boolean>("!!globalThis.causalis.possess.state()?.live");
    }
    check(
      taken,
      `${chosen.name} could not be possessed: “${await k<string>(`document.querySelector(".palette-words")?.textContent ?? ""`)}”`,
    );
  }
  if (taken) {
    await page.waitForTimeout(slow(1500));
    await shot("16-possessed");
    const spot = await centre(".possess-letgo");
    if (spot) await page.touchscreen.tap(spot.x, spot.y);
    await until(
      "let go",
      async () => !(await k<boolean>("!!globalThis.causalis.possess.state()")),
      slow(30000),
    );
    say(`${chosen!.name} possessed and let go`);
  }
  // A page of it: its words and its landing to watch again; its save and load.
  await k(`globalThis.causalis.open(${JSON.stringify(moon.town)})`);
  await page.waitForTimeout(slow(1200));
  const pageWords = await k<string>(
    `[...document.querySelectorAll("button.act")].map((b) => b.textContent).join(" | ")`,
  );
  await shot("17-its-page");
  check(
    /Watch the landing/.test(pageWords),
    `its page does not offer its landing: “${pageWords.slice(0, 160)}”`,
  );
  for (const ref of [`cell:0:${moon.cell}`, moon.event]) {
    if (!ref) continue;
    await k(`globalThis.causalis.open(${JSON.stringify(ref)})`);
    await page.waitForTimeout(slow(900));
    const acts = await k<string>(
      `[...document.querySelectorAll("button.act")].map((b) => b.textContent).join(" | ")`,
    );
    check(
      /Watch the landing/.test(acts),
      `the page of ${ref} does not offer its landing: “${acts.slice(0, 160)}”`,
    );
  }
  await k(`globalThis.causalis.closePage()`);
  // The pages of its lots and buildings, as at home.
  const fabric = await k<{ civics: { at: number; start: number }[] }>(
    "globalThis.causalis.planNow().town",
  );
  for (const ref of [
    `lot:${moon.town}:0`,
    ...(fabric.civics[0]
      ? [`bldg:${moon.town}:${fabric.civics[0].at}:${fabric.civics[0].start}`]
      : []),
  ]) {
    const title = await ask<{ title?: string } | null>("page", { ref })
      .then((p) => p?.title ?? "")
      .catch((e) => `ERROR ${e}`);
    check(!!title && !title.startsWith("ERROR"), `the page of ${ref}: “${title}”`);
  }

  if (frames) {
    // The frames in its town, its people drawn, with the CPU slowed as on the phone floor (gate 60's measure).
    await k(
      `(() => { const r = globalThis.causalis.rig; r.halt(); r.pitch = -14; r.distance = 60; r.target.set(0, 4, 0); })()`,
    );
    await page.waitForTimeout(3000);
    const cdp = await context.newCDPSession(page);
    for (const setting of ["low", "balanced", "high"]) {
      await k(`globalThis.causalis.setQuality(${JSON.stringify(setting)})`);
      await page.waitForTimeout(3000);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await page.waitForTimeout(1000);
      const gaps = await k<number[]>(`new Promise((done) => {
        const gaps = [];
        let last = performance.now();
        const tick = (t) => {
          gaps.push(t - last);
          last = t;
          if (gaps.length < 150) requestAnimationFrame(tick);
          else done(gaps);
        };
        requestAnimationFrame(tick);
      })`);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      gaps.sort((a, b) => a - b);
      say(
        `frames in ${moon.name} (${moon.people} people), ${setting}, CPU ×4: p50 ${gaps[75]!.toFixed(1)} ms, p80 ${gaps[120]!.toFixed(1)} ms, p95 ${gaps[142]!.toFixed(1)} ms`,
      );
    }
    await k(`globalThis.causalis.setQuality("auto")`);
  }

  // 7. The next landing, come to on the clock: the news of it, and the way to it.
  await k(`globalThis.causalis.client.advance(${(moon.founded >= 1310 ? AT + 40 : 1311) * YEAR})`);
  const newsCame = await until(
    "the next landing's news",
    async () =>
      /a landing on/.test(
        (await k<string>(`document.querySelector(".colony-news span")?.textContent ?? ""`)) ?? "",
      ),
    slow(240000),
  );
  if (newsCame) {
    await shot("18-news");
    say(`on the clock: “${await page.textContent(".colony-news span")}”`);
    // Among the alerts too, and its event the very one the list plays.
    const alertsNow = await ask<{ id: string; items: { ref: string }[] }[]>("alerts"),
      lately = alertsNow.find((a) => a.id === "landing"),
      listed = await ask<Entry[]>("colony.list");
    check(!!lately?.items.length, "no alert of the landing");
    check(
      !!lately && listed.some((c) => c.event === lately.items[0]!.ref),
      `the alert's landing (${lately?.items[0]?.ref}) is none of the list's`,
    );
    await k("globalThis.causalis.client.setSpeed(0)");
    await page.tap(".colony-news button");
    await until("its film from the news", playing, slow(30000));
    await page.waitForTimeout(slow(800));
    await page.tap(".film-skip");
    await until("the film skipped", async () => !(await playing()), slow(60000));
    check((await scale()) === "village", `from the news, it ended at scale ${await scale()}`);
  }

  // 8. The title's shortest way, come to its end: a landing playing by itself, then told what to do there.
  await page.goto(`${base}?universe=earth&seed=first%20light&year=${AT}&landing=1&hold`);
  await until("a landing played by itself", playing, slow(180000));
  await until("its film under way", async () => (await film()).stage !== null, slow(60000));
  await shot("19-played-by-itself");
  await page.tap(".film-skip");
  await until("the film skipped", async () => !(await playing()), slow(60000));
  check((await scale()) === "village", `begun at a landing, it ended at scale ${await scale()}`);
  const toldThere = await k<string>(
    `document.querySelector(".colony-news span")?.textContent ?? ""`,
  );
  say(`told at its end: “${toldThere}”`);
  check(/tap anyone/.test(toldThere), `begun at a landing, it was told “${toldThere}”`);

  // The page's own errors.
  const own = errors.filter((e) => !/ERR_|Failed to load resource/i.test(e));
  check(own.length === 0, `errors in the page: ${own.slice(0, 3).join("; ")}`);
} finally {
  rmSync(baked, { recursive: true, force: true });
  await browser.close();
  await server.close();
}

if (problems.length) {
  console.log(`\nthe Phase 64 gate fails:\n${problems.map((p) => `  ✗ ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("\nthe Phase 64 gate passes");
process.exit(0);
