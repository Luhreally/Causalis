// A town entered, looked at (town mode): on a save given, at a phone's size and a desk's, the town gone to, 🏘️ pressed,
// the mode's own chrome up and the god game's away, its people drawn near and large where the place has them, each of
// its four sheets opened, orders given through them (hands put to crafts, food held back, a good forbidden), a notice
// told and put away, one of its people and a building tapped for their pages, the town left (the god game's chrome
// back) and come back to (the same people, gone on, its orders kept). The HUD is read for overlap in every state by the
// overlap gate's own reading (tools/hud-read.ts). Stills into --shots. (npm run build first: it reads dist/.)
//   node tools/place-look.ts --save file.save [--shots dir] [--people 400] [--soft] [--browser webkit] [--only phone]
// --browser webkit: Playwright's WebKit in place of Chromium (the nearest thing to a phone's Safari that runs here).
// The site looked at is seen at three stages besides (early, middle, near done), each from near to far on a dolly, the
// town's month taking it on between them: the same thing, in the same place, at every distance.
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { preview } from "vite";
import { chromium, webkit, type Page } from "playwright";
import { loadWorld, rulesetId, seedFromText, type Ref } from "../src/kernel/index.ts";
import { EARTH } from "../src/host/planet.ts";
import { populationContext } from "../src/sim/index.ts";
import type { PlaceFrame, PlaceWorkSheet } from "../src/bridge/index.ts";
import { hudRead, type HudRead } from "./hud-read.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  shots = arg("--shots"),
  saveFile = arg("--save"),
  people = Number(arg("--people") ?? 400),
  engine = arg("--browser") ?? "chromium",
  only = arg("--only"),
  // (A town by its ref in place of the one nearest --people; a thing it is asked to raise before it is entered ("walls");
  // and whether its other peoples are looked for, each in their own people's figure.)
  townRef = arg("--town"),
  ask = arg("--ask"),
  peoples = argv.includes("--peoples");
if (!saveFile) throw new Error("--save file.save");
if (shots) mkdirSync(shots, { recursive: true });
const slow = (ms: number) => (soft ? ms * 4 : ms);
/** Frames of a site's dolly at each of its stages. */
const DOLLY = 24;
const GPU = [
  "--enable-gpu",
  "--ignore-gpu-blocklist",
  "--use-angle=d3d11",
  "--force_high_performance_gpu",
];
const problems: string[] = [],
  say = (s: string) => console.log(`  ${s}`),
  check = (ok: boolean, what: string) => {
    if (!ok) problems.push(what);
    say(`${ok ? "ok " : "NOT"} ${what}`);
  };

// The town: the one nearest so many people, read off the save here.
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
        .reduce((a, b) =>
          Math.abs(b.population - people) < Math.abs(a.population - people) ? b : a,
        );
if (!town) throw new Error(`no town ${townRef} in this save`);
console.log(
  `a town entered: ${town.name} (${town.ref}), ${town.population} people, year ${Math.floor(world.now / 31_536_000)}`,
);

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4417, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!,
  browser =
    engine === "webkit"
      ? await webkit.launch()
      : await chromium.launch({
          args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : GPU,
        });
console.log(`browser: ${engine} ${browser.version()}`);
const READ = hudRead([], 1);

type State = { on: boolean; town: string | null; tells: string | null; told: PlaceFrame | null };

for (const view of [
  {
    name: "phone",
    options: {
      viewport: { width: 430, height: 932 },
      // (Playwright's WebKit here shows nothing of a WebGL canvas at two pixels a point: the game draws into its buffer and
      // the still is bare. At one it is shown.)
      deviceScaleFactor: soft || engine === "webkit" ? 1 : 2,
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
  page.setDefaultTimeout(slow(60000));
  page.on("pageerror", (e) => errors.push(`${e.message}\n${e.stack ?? ""}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>,
    until = async (what: string, ok: () => Promise<boolean>, ms = slow(30000)) => {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        if (await ok().catch(() => false)) return true;
        await page.waitForTimeout(100);
      }
      problems.push(`${view.name}: ${what} did not come`);
      say(`NOT ${what}`);
      return false;
    },
    shot = async (name: string) => {
      if (shots) await page.screenshot({ path: join(shots, `${view.name}-${name}.png`) });
    },
    state = () => k<State>("globalThis.causalis.place.state()"),
    // (Which two windows lie over one another, without their words.)
    pair = (x: string) =>
      x
        .split(" / ")
        .map((part) => part.split(" “")[0])
        .join(" / "),
    usualOver = new Set<string>(),
    read = async (name: string) => {
      const r = await k<HudRead>(READ),
        // (What lies over what with any page open in the town as it is without the mode is not the mode's.)
        over = r.overlaps.filter((x) => !usualOver.has(pair(x)));
      check(
        over.length === 0,
        `${name}: nothing of the HUD lies over anything (${over.slice(0, 3).join("; ")})`,
      );
      check(
        r.covered.length === 0,
        `${name}: every control can be reached (${r.covered.slice(0, 3).join("; ")})`,
      );
      check(
        r.off.length === 0 && r.gone.length === 0,
        `${name}: nothing off the screen (${[...r.off, ...r.gone].slice(0, 3).join("; ")})`,
      );
      // (Of the town mode's own controls: a page's links are as they are everywhere.)
      const small = r.small.filter((x) => /place-|town-place/.test(x));
      if (view.name === "phone")
        check(
          small.length === 0,
          `${name}: none of its own controls smaller than a fingertip (${small.slice(0, 4).join("; ")})`,
        );
      return r;
    },
    tap = (x: number, y: number) =>
      view.name === "phone" ? page.touchscreen.tap(x, y) : page.mouse.click(x, y),
    box = (selector: string) =>
      k<{ x: number; y: number; w: number; h: number } | null>(
        `(() => { for (const e of document.querySelectorAll(${JSON.stringify(selector)})) { const r = e.getBoundingClientRect(); if (r.width > 0 && r.height > 0) return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; } return null; })()`,
      ),
    press = async (selector: string, what: string): Promise<boolean> => {
      const at = await box(selector);
      check(!!at, `${what} is there to press`);
      if (!at) return false;
      // (What the finger meets there: the key itself, or what lies over it or has it scrolled out from under.)
      const met = await k<string | null>(
        `(() => { for (const e of document.querySelectorAll(${JSON.stringify(selector)})) { const r = e.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) continue; const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return t && (t === e || e.contains(t)) ? null : (t ? t.tagName + "." + t.className : "nothing") + " at " + Math.round(r.x + r.width / 2) + ", " + Math.round(r.y + r.height / 2); } return null; })()`,
      );
      check(met === null, `${what} is what a finger there meets (${met ?? ""})`);
      await tap(at.x, at.y);
      await page.waitForTimeout(slow(350));
      return true;
    },
    shownCount = (selector: string) =>
      k<number>(
        `[...document.querySelectorAll(${JSON.stringify(selector)})].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).length`,
      ),
    sheetText = () => k<string>(`document.querySelector(".place-sheet-body")?.textContent ?? ""`),
    flyTo = (to: { x: number; z: number }, distance: number, pitch = -42) =>
      k(
        `globalThis.causalis.rig.flyTo({ target: { x: ${to.x * 0.1}, y: 0.3, z: ${to.z * 0.1} }, distance: ${distance}, pitch: ${pitch} }, 0.01)`,
      ),
    // (The town's clock on to the middle of a day, an hour a second, then stopped; with a site's crew at it where asked.)
    midday = async (what: string, crewOf?: string) => {
      await k(`globalThis.causalis.client.setSpeed(3600)`);
      await until(
        what,
        async () => {
          const hour = ((((await state()).told?.t ?? 0) % 86400) + 86400) % 86400;
          return (
            hour > 10.5 * 3600 &&
            hour < 13 * 3600 &&
            (!crewOf ||
              ((
                await k<PlaceWorkSheet | null>(
                  `globalThis.causalis.client.query({ type: "place.work", args: { ref: ${JSON.stringify(town.ref)} } })`,
                )
              )?.sites.find((q) => q.ref === crewOf)?.busy ?? 0) > 0)
          );
        },
        slow(90000),
      );
      await k(`globalThis.causalis.client.setSpeed(0)`);
    };

  // The save loaded, held.
  const name = "earth:place-look",
    q = `universe=earth&seed=${encodeURIComponent(doc.seed)}`;
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
    { timeout: slow(180000) },
  );
  await page.waitForTimeout(slow(600));

  // The town gone to.
  await k(`globalThis.causalis.goTo(${JSON.stringify(town.ref)})`);
  await until(
    "the town drawn",
    async () =>
      (await k<string>("globalThis.causalis.scale()")) === "village" &&
      (await k<string | undefined>("globalThis.causalis.planNow()?.ref")) === town.ref,
  );
  await page.waitForTimeout(slow(2500));
  const usual = await k<number>("globalThis.causalis.planNow().people.length");
  await shot("1-town-before");
  await read("the town before it is entered");
  // (A page open in the town as it is without the mode: what lies over what then is the town view's own, told and set aside.)
  await k(`globalThis.causalis.open(${JSON.stringify(town.ref)})`);
  await until(
    "the town's own page",
    async () => (await k<string | null>("globalThis.causalis.pageOpen()")) === town.ref,
  );
  await page.waitForTimeout(slow(700));
  for (const x of (await k<HudRead>(READ)).overlaps) usualOver.add(pair(x));
  say(
    `with any page open before the mode, lying over one another: ${[...usualOver].join("; ") || "nothing"}`,
  );
  await k("globalThis.causalis.closePage()");
  await page.waitForTimeout(slow(400));

  // What it is asked to raise first (--ask), as the god game asks it: its answer told.
  if (ask) {
    const answer = await k<string>(
      `globalThis.causalis.client.command("town.ask", { village: ${JSON.stringify(town.ref)}, kind: "raise", what: ${JSON.stringify(ask)} }).then(() => "asked", (e) => "not asked: " + e.message)`,
    );
    check(answer === "asked", `the town is asked for ${ask} (${answer})`);
    await page.waitForTimeout(slow(1200));
  }
  // Entered: 🏘️ on its bar. The mode's chrome up, the god game's away, the eye near.
  if (!(await press(".town-place", "🏘️ on the town's bar"))) continue;
  await until("the town entered and its people told", async () => {
    const s = await state();
    return (
      s.on && !!s.told && (await k<number>("globalThis.causalis.planNow().placed?.length ?? 0")) > 0
    );
  });
  await page.waitForTimeout(slow(1800));
  const first = await state(),
    placed = await k<number>("globalThis.causalis.planNow().people.length");
  check(
    placed > 0,
    `the plan's people are the place's (${placed}; the town's usual were ${usual})`,
  );
  check(
    (first.told?.kept ?? 0) === Math.min(6000, town.population),
    `it keeps ${first.told?.kept} of the town's ${town.population}`,
  );
  check((await shownCount(".place-bar")) === 1, "the mode's own bar is up");
  check(
    (await shownCount("#hud > .panel .bar, #hud > .palette, .town-live")) === 0,
    "the god game's bar, its hand and Live here are away",
  );
  const bar = await box(".place-bar");
  check(!!bar && bar.h <= 60, `the mode's bar is one row (${Math.round(bar?.h ?? 0)} px tall)`);
  // Its clock runs at the paces of its own bar.
  await press('.place-pace[data-pace="3600"]', "the hour-a-second pace");
  await page.waitForTimeout(slow(8000));
  await press('.place-pace[data-pace="600"]', "the ten-minutes-a-second pace");
  await page.waitForTimeout(slow(2500));
  const later = await state();
  check(
    (later.told?.t ?? 0) > (first.told?.t ?? 0) + 3600,
    `its clock went on (${(((later.told?.t ?? 0) - (first.told?.t ?? 0)) / 3600).toFixed(1)} h)`,
  );
  say(`doing: ${later.told?.doing.join(",")}`);
  await shot("2-entered");
  await read("the town entered");
  // Its other peoples, each in their own people's figure (--peoples): those the plan says are of another people are
  // drawn in that people's figure, as many as stand in sight, and one of each is gone to and looked at near.
  if (peoples) {
    const of = await k<{ kind: number; name: string; n: number }[]>(
        `(() => { const p = globalThis.causalis.planNow(); return (p.peoples ?? []).map((o) => ({ kind: o.kind, name: o.name, n: p.people.filter((q) => q.kind === o.kind).length })); })()`,
      ),
      all = await k<number>("globalThis.causalis.planNow().people.length");
    check(
      of.length > 0,
      `its land is of more than one people (${of.map((o) => `${o.n} of the ${all} drawn are of ${o.name}`).join("; ")})`,
    );
    await midday("the middle of a day, its people about");
    await page.waitForTimeout(slow(1500));
    const drawn = await k<{ kind: number; drawn: number }[]>("globalThis.causalis.place.peoples()");
    for (const o of of)
      check(
        (drawn.find((d) => d.kind === o.kind)?.drawn ?? 0) > 0,
        `${o.name}: ${drawn.find((d) => d.kind === o.kind)?.drawn ?? 0} drawn in their own figure now`,
      );
    await shot("2p-peoples-entered");
    for (const o of of) {
      // (One of them out of doors, where the place has them.)
      const who = await k<{ i: number; x: number; z: number } | null>(
        `(() => { const c = globalThis.causalis, p = c.planNow(); for (let i = 0; i < p.people.length; i++) if (p.people[i].kind === ${o.kind}) { const m = c.place.personAt(i); if (m) return { i, x: m.x, z: m.z }; } return null; })()`,
      );
      check(!!who, `one of ${o.name} is out of doors`);
      if (!who) continue;
      for (const [distance, name] of [
        [1.6, "near"],
        [4, "mid"],
        [12, "far"],
      ] as const) {
        await flyTo(who, distance, -28);
        await page.waitForTimeout(slow(1300));
        await shot(`2p-people-${o.kind}-${name}`);
      }
      await read(`one of ${o.name} looked at`);
      await k(`globalThis.causalis.open(globalThis.causalis.planNow().people[${who.i}].ref)`);
      await until("their page", async () =>
        /^plc:/.test((await k<string | null>("globalThis.causalis.pageOpen()")) ?? ""),
      );
      await page.waitForTimeout(slow(900));
      const words = await k<string>(`document.querySelector(".page-window")?.textContent ?? ""`);
      check(words.includes(o.name.replace(/^the /, "")), `their page says they are of ${o.name}`);
      await shot(`2p-people-${o.kind}-page`);
      await read(`the page of one of ${o.name}`);
      await k("globalThis.causalis.closePage()");
    }
    await press('.place-pace[data-pace="600"]', "the ten-minutes-a-second pace");
  }

  // One of its people is large enough to tap, and a tap near them gives their page, needs first.
  await press('.place-pace[data-pace="0"]', "the pause");
  await page.waitForTimeout(slow(500));
  const seen = await k<{ i: number; x: number; y: number } | null>(
    `(() => { const c = globalThis.causalis, n = c.planNow().people.length, W = innerWidth, H = innerHeight; for (let i = 0; i < n; i++) { const p = c.personOnScreen(i); if (p && p.x > 40 && p.x < W - 40 && p.y > H * 0.2 && p.y < H * 0.8 && document.elementFromPoint(p.x + 14, p.y - 10)?.tagName === "CANVAS") return { i, x: p.x, y: p.y }; } return null; })()`,
  );
  check(!!seen, "one of its people stands on the screen");
  if (seen) {
    // (A fingertip off them: the nearest within reach is taken.)
    await tap(seen.x + 14, seen.y - 10);
    if (
      !(await until("a person's page", async () =>
        /^(plc|folk):/.test((await k<string | null>("globalThis.causalis.pageOpen()")) ?? ""),
      ))
    )
      say(
        `the page open: ${await k<string | null>("globalThis.causalis.pageOpen()")}; the mode ${JSON.stringify(await k("(() => { const s = globalThis.causalis.place.state(); return { on: s.on, town: s.town, people: globalThis.causalis.planNow()?.people.length, placed: globalThis.causalis.planNow()?.placed?.length }; })()"))}`,
      );
    await page.waitForTimeout(slow(700));
    const text = await k<string>(`document.querySelector(".page-window")?.textContent ?? ""`);
    for (const word of ["Hunger", "Tiredness", "Cold", "Why", "In hand"])
      check(text.includes(word), `their page says "${word}"`);
    check(text.indexOf("Hunger") < text.indexOf("Home"), "their needs lead their page");
    await shot("3-person-page");
    await read("a person's page open");
    await k("globalThis.causalis.closePage()");
    await page.waitForTimeout(slow(400));
  }
  // A granary's (or its first building's) page, by the place: what it holds first.
  await k(`globalThis.causalis.open(${JSON.stringify(`plcl:${town.ref}:0`)})`);
  await until("the square's page", async () =>
    ((await k<string | null>("globalThis.causalis.pageOpen()")) ?? "").startsWith("plcl:"),
  );
  await page.waitForTimeout(slow(500));
  await read("a building's page open");
  await k("globalThis.causalis.closePage()");
  await page.waitForTimeout(slow(300));

  // Its four sheets, each opened from its tab at the foot.
  await press('.place-tab[data-tab="people"]', "the People tab");
  await until("the People sheet", async () => (await shownCount(".place-row")) > 3);
  check((await shownCount(".place-chip")) >= 3, "its people can be narrowed by trade");
  await shot("4-sheet-people");
  await read("the People sheet open");
  await press(".place-chip:nth-child(2)", "a trade's chip");
  await page.waitForTimeout(slow(1300));
  await read("the People sheet narrowed to a trade");

  await press('.place-tab[data-tab="stocks"]', "the Stocks tab");
  await until("the Stocks sheet", async () => (await shownCount(".place-stock")) > 0);
  check(/today \+/.test(await sheetText()), "its goods say what was made and used today");
  say(`stocks: ${(await sheetText()).slice(0, 500)}`);
  await shot("5-sheet-stocks");
  await read("the Stocks sheet open");
  // Orders from it: food held back, a good forbidden.
  await press(".place-step:last-of-type", "hold back a month more");
  await until("the granary holding back a month", async () =>
    /holds back 1 month/.test(await sheetText()),
  );
  await press(".place-sell", "a good's Sold key");
  await until("a good held from sale", async () => (await shownCount(".place-sell.on")) > 0);

  await press('.place-tab[data-tab="work"]', "the Work tab");
  await until("the Work sheet", async () => /grown hands/.test(await sheetText()));
  const before = await sheetText();
  // (More hands to crafts, twice, and the order given.)
  for (let n = 0; n < 4; n++)
    await press(
      ".place-sheet-body .place-line:nth-of-type(3) .place-step:last-of-type",
      "more hands to crafts",
    );
  await shot("6-sheet-work");
  await read("the Work sheet open, an order being set");
  await press(".place-order", "Give the order");
  await until("the order taken", async () => /Ordered/.test(await sheetText()));
  await press('.place-pace[data-pace="600"]', "the ten-minutes-a-second pace");
  await until(
    "its hands moved",
    async () =>
      (await sheetText()) !== before && /changes are told|has been told/.test(await sheetText()),
  );
  say(`work: ${(await sheetText()).slice(0, 220)}`);
  await read("the Work sheet open, the order given");

  await press('.place-tab[data-tab="build"]', "the Build tab");
  await until("the Build sheet", async () => /answer/.test(await sheetText()));
  await shot("7-sheet-build");
  await read("the Build sheet open");
  say(`build: ${(await sheetText()).slice(0, 200)}`);
  if ((await shownCount(".place-sheet-body .place-order")) > 0) {
    await press(".place-sheet-body .place-order", "Raise, on the first thing it can raise");
    await until("what was asked told", async () =>
      /Under way|Not now|answer/.test(await sheetText()),
    );
    await page.waitForTimeout(slow(1500));
    say(`build after asking: ${(await sheetText()).slice(0, 200)}`);
    await read("the Build sheet after asking");
  }
  // A site: what it was asked to raise, on its Work sheet; taken in hand with a crew of its own, given a hand more; its
  // lot's page; and the thing seen going up, from near to far (a dolly: the same thing at every distance, nothing moved).
  const workNow = () =>
      k<PlaceWorkSheet | null>(
        `globalThis.causalis.client.query({ type: "place.work", args: { ref: ${JSON.stringify(town.ref)} } })`,
      ),
    site = (await workNow())?.sites[0],
    // (Where a site stands on the town's ground: its lot, or for its walls the length their line has come to.)
    spotOf = (ref: string) => {
      const n = Number(ref.slice(ref.lastIndexOf(":") + 1));
      return k<{ x: number; z: number } | null>(
        n === 999_999_999
          ? "globalThis.causalis.place.wallsAt()"
          : `globalThis.causalis.place.lotAt(${n - 3})`,
      );
    },
    walls = !!site && site.ref.endsWith(":999999999");
  if (ask) check(!!site, `what was asked for (${ask}) is a site of the place`);
  if (site) {
    await press('.place-tab[data-tab="work"]', "the Work tab");
    await until("its sites on the Work sheet", async () => /Going up/.test(await sheetText()));
    await k(`document.querySelector(".place-site").scrollIntoView({ block: "start" })`);
    await page.waitForTimeout(slow(300));
    say(`site: ${await k<string>(`document.querySelector(".place-site").textContent`)}`);
    await shot(site.inHand ? "7e-site-in-hand-kept" : "7e-site-left-to-the-town");
    await read("the Work sheet with a site going up");
    if (site.inHand) {
      // (Given back, then taken again: both keys.)
      await press(".place-site-keys .place-order", "Give back");
      await until("the site given back", async () => (await workNow())?.sites[0]?.inHand === false);
      await page.waitForTimeout(slow(1200));
      await shot("7e2-site-given-back");
      await read("a site given back");
    }
    await press(".place-site-keys .place-order", "Take in hand");
    await until("the site in hand", async () => (await workNow())?.sites[0]?.inHand === true);
    await page.waitForTimeout(slow(1200));
    const had = (await workNow())!.sites[0]!.hands;
    if (had < site.most) {
      await press(".place-site-keys .place-step:nth-of-type(2)", "a hand more to the site");
      await until("a hand more", async () => (await workNow())!.sites[0]!.hands === had + 1);
    }
    await page.waitForTimeout(slow(1200));
    await k(`document.querySelector(".place-site").scrollIntoView({ block: "start" })`);
    say(`site in hand: ${await k<string>(`document.querySelector(".place-site").textContent`)}`);
    await shot("7f-site-in-hand");
    await read("a site in hand");
    await k(`globalThis.causalis.open(${JSON.stringify(site.ref)})`);
    await until("the site's page", async () =>
      ((await k<string | null>("globalThis.causalis.pageOpen()")) ?? "").startsWith("plcl:"),
    );
    await page.waitForTimeout(slow(700));
    const told = await k<string>(`document.querySelector(".page-window")?.textContent ?? ""`);
    say(`site's page: ${told.slice(0, 1500)}`);
    for (const word of ["Going up", "tonnes still wanted", "Tools", "Food", "by your order"])
      check(told.includes(word), `the site's page says "${word}"`);
    if (walls)
      check(
        /their line staked out|of their ring standing/.test(told),
        "its walls' page says how far about their ring they stand",
      );
    await shot("7g-site-page");
    await read("a site's page open");
    await k("globalThis.causalis.closePage()");
    await press(".place-sheet-shut", "the sheet's close");
    // Its crew at it by day: the clock run on to the middle of a working day, then stopped.
    await press('.place-pace[data-pace="3600"]', "the hour-a-second pace");
    await until(
      "the middle of a day with the crew at the site",
      async () => {
        const s = await state(),
          hour = (((s.told?.t ?? 0) % 86400) + 86400) % 86400;
        return hour > 10 * 3600 && hour < 13 * 3600 && ((await workNow())?.sites[0]?.busy ?? 0) > 0;
      },
      slow(90000),
    );
    await press('.place-pace[data-pace="0"]', "the pause");
    const at = await spotOf(site.ref);
    check(!!at, "the site stands on the town drawn");
    check(
      ((await state()).told?.sites.length ?? 0) === 1,
      "the place tells the page how far its site has got",
    );
    if (at) {
      for (const distance of [2.5, 5, 9, 16, 30, 55, 90]) {
        await flyTo(at, distance);
        await page.waitForTimeout(slow(1400));
        await shot(`7h-site-dolly-${String(distance).padStart(4, "0")}`);
      }
      await read("the town with a site in hand, from afar");
      // Its stages: given back to the town's month, which takes it on a month a second; stopped at three (early, middle,
      // near done), and each seen from near to far. Nothing of it moves with the eye, and what is drawn of it near is what
      // is drawn of it far.
      await press('.place-tab[data-tab="work"]', "the Work tab");
      await until("its sites on the Work sheet again", async () =>
        /Going up/.test(await sheetText()),
      );
      await k(`document.querySelector(".place-site").scrollIntoView({ block: "start" })`);
      await press(".place-site-keys .place-order", "Give back, for its stages");
      await until("the site given back", async () => (await workNow())?.sites[0]?.inHand === false);
      await press(".place-sheet-shut", "the sheet's close");
      // (The one of its sites that has got least far, where it has more than one: all its stages are still to come.)
      const young = [...((await workNow())?.sites ?? [])].sort((x, y) => x.share - y.share)[0]!;
      say(`stages of: ${young.name}, ${Math.round(young.share * 100)} in a hundred now`);
      for (const [stage, share] of [
        ["early", 0.12],
        ["middle", 0.5],
        ["late", 0.86],
      ] as const) {
        await k(`globalThis.causalis.client.setSpeed(${30 * 86400})`);
        const came = await until(
          `the site ${stage} (${share})`,
          async () => {
            const x = (await workNow())?.sites.find((q) => q.ref === young.ref);
            return !x || x.share >= share;
          },
          slow(240000),
        );
        await k(`globalThis.causalis.client.setSpeed(0)`);
        const now = (await workNow())?.sites.find((q) => q.ref === young.ref);
        say(
          `stage ${stage}: ${now ? `${Math.round(now.share * 100)} in a hundred, ${now.stage}` : "it stands"}`,
        );
        if (!came || !now) break;
        // Taken in hand again where it has got to, and the clock on to the middle of a day with its crew at it: who builds
        // it is seen with it. (Its plan is read again as it has got on, and its walls' site is where their line has come to.)
        await k(
          `globalThis.causalis.place.order("place.site", { ask: ${young.ask}, hands: ${Math.max(1, Math.min(young.most, 10))} })`,
        );
        await until(
          `the site in hand, ${stage}`,
          async () => (await workNow())?.sites.find((q) => q.ref === young.ref)?.inHand === true,
        );
        await midday(`the middle of a day with its crew at the site, ${stage}`, young.ref);
        await page.waitForTimeout(slow(4500));
        const spot = (await spotOf(young.ref)) ?? at,
          busy = (await workNow())?.sites.find((q) => q.ref === young.ref)?.busy ?? 0;
        say(
          `stage ${stage}: ${busy} of its crew at it, at ${Math.round(spot.x)}, ${Math.round(spot.z)}`,
        );
        // A dolly of twenty-four frames from near to far, each a seventh further than the last: through every level of
        // detail the town is drawn at, a step small enough that anything that pops, slides or changes shape shows between
        // two frames.
        for (let n = 0; n < DOLLY; n++) {
          await flyTo(spot, 2.5 * Math.pow(68 / 2.5, n / (DOLLY - 1)));
          await page.waitForTimeout(slow(n ? 700 : 1400));
          await shot(`7s-stage-${stage}-${String(n).padStart(2, "0")}`);
        }
        // (From above, straight down: what stands on what.)
        await flyTo(spot, 12, -88);
        await page.waitForTimeout(slow(1400));
        await shot(`7t-stage-${stage}-from-above`);
        await k(
          `globalThis.causalis.place.order("place.site", { ask: ${young.ask}, hands: null })`,
        );
        await until(
          `the site given back, ${stage}`,
          async () => (await workNow())?.sites.find((q) => q.ref === young.ref)?.inHand === false,
        );
        await read(`a site ${stage} in its raising`);
      }
      await flyTo(at, 9, -48);
      await page.waitForTimeout(slow(900));
    }
    await press('.place-pace[data-pace="600"]', "the ten-minutes-a-second pace");
  } else say("nothing is going up here: no site was looked at");
  // Its log: what has happened, each line leading to a page.
  await press('.place-tab[data-tab="log"]', "the Log tab");
  await until("the Log sheet", async () => (await shownCount(".place-log-row")) > 0);
  say(`log: ${(await sheetText()).slice(0, 160)}`);
  await shot("7b-sheet-log");
  await read("the Log sheet open");
  // What threatens it: its Dangers sheet, an order against a threat given, a fire sent on the town and seen on its
  // people (its notice, who turned out, who was hurt, who lost a home), and a building opened to the homeless.
  await press('.place-tab[data-tab="dangers"]', "the Dangers tab");
  await until("the Dangers sheet", async () => /Your orders against them/.test(await sheetText()));
  say(`dangers: ${(await sheetText()).slice(0, 1200)}`);
  await shot("7i-sheet-dangers");
  await read("the Dangers sheet open");
  await k(
    `document.querySelector(".place-sheet-body .place-sell").scrollIntoView({ block: "center" })`,
  );
  await page.waitForTimeout(slow(300));
  await press(".place-sheet-body .place-sell", "Keep a fire watch");
  await until(
    "the fire watch kept",
    async () => (await shownCount(".place-sheet-body .place-sell.on")) > 0,
  );
  await shot("7i2-dangers-order-kept");
  await read("an order against a threat kept");
  await k(
    `globalThis.causalis.client.command("act.fire", { village: ${JSON.stringify(town.ref)} })`,
  );
  await press('.place-pace[data-pace="600"]', "the ten-minutes-a-second pace");
  await until(
    "the fire told on its notice line",
    async () => /^Fire at /.test((await state()).tells ?? ""),
    slow(40000),
  );
  await k(`document.querySelector(".place-sheet-body").scrollTop = 0`);
  await until("those it left without a home told", async () =>
    /Without a home/.test(await sheetText()),
  );
  await press('.place-pace[data-pace="0"]', "the pause");
  say(`notice: ${(await state()).tells}`);
  say(`dangers after a fire: ${(await sheetText()).slice(0, 1400)}`);
  await shot("7j-dangers-fire");
  await read("the Dangers sheet after a fire");
  if ((await shownCount(".place-sheet-body .place-chips .place-chip")) > 0) {
    await k(
      `document.querySelector(".place-sheet-body .place-chips").scrollIntoView({ block: "center" })`,
    );
    await page.waitForTimeout(slow(300));
    await press(
      ".place-sheet-body .place-chips .place-chip",
      "a building, to open it to the homeless",
    );
    await until(
      "a building opened to them",
      async () => (await shownCount(".place-sheet-body .place-chips .place-chip.on")) > 0,
    );
    await shot("7k-dangers-shelter");
    await read("a shelter opened");
  }
  // One of those it hurt: where on their body, who tends them, how long abed; and what its land knows of care.
  if ((await shownCount(".place-sheet-body .place-log-row")) > 0) {
    check(/tended (by|at) /.test(await sheetText()), "its hurt are said to be tended, and by whom");
    check(
      /Its land knows|The town keeps/.test(await sheetText()),
      "the sheet says what its land knows of care",
    );
    await k(
      `document.querySelector(".place-sheet-body .place-log-row").scrollIntoView({ block: "center" })`,
    );
    await page.waitForTimeout(slow(300));
    await shot("7k2-dangers-hurt");
    await read("the Dangers sheet at those lying hurt");
    await press(".place-sheet-body .place-log-row", "one lying hurt");
    await until("the hurt one's page", async () =>
      /^(plc:|folk|person)/.test((await k<string | null>("globalThis.causalis.pageOpen()")) ?? ""),
    );
    // (Their page is filled a part at a time, its health after its needs: read once it says how they are, and how long
    // that took said. One up again since the sheet was read says so instead.)
    const hurtName = await k<string>(
        `document.querySelector(".place-sheet-body .place-log-row")?.textContent ?? ""`,
      ),
      asked = Date.now(),
      pageText = () => k<string>(`document.querySelector(".page-window")?.textContent ?? ""`);
    for (const end = Date.now() + slow(8000); Date.now() < end;) {
      if (/Hurt in the fire/.test(await pageText())) break;
      await page.waitForTimeout(100);
    }
    const hurtPage = await pageText();
    say(
      `a hurt one's page (${Date.now() - asked} ms; pressed: ${hurtName.slice(0, 60)}): ${hurtPage.slice(0, 900)}`,
    );
    check(/Hurt in the fire/.test(hurtPage), "their page says they were hurt in the fire");
    await shot("7k3-hurt-page");
    await read("a hurt one's page open");
    await k("globalThis.causalis.closePage()");
  }
  await press(".place-sheet-shut", "the sheet's close");
  await page.waitForTimeout(slow(600));
  await shot("7l-fire-fought");
  await read("a fire being fought, its notice up");
  await press('.place-pace[data-pace="600"]', "the ten-minutes-a-second pace");
  // Its log again, by day.
  await press('.place-tab[data-tab="log"]', "the Log tab");
  await until("the Log sheet by day", async () => /Today/.test(await sheetText()));
  say(`log by day: ${(await sheetText()).slice(0, 500)}`);
  await shot("7m-log-by-day");
  await read("the Log sheet by day");
  // An order by name, from the People sheet: one put to crafts.
  await press('.place-tab[data-tab="people"]', "the People tab");
  await until("the People sheet again", async () => (await shownCount(".place-row-order")) > 3);
  await press(".place-row-order", "a person's order key");
  if (
    !(await until(
      "the trades one can be put to",
      async () => (await shownCount(".place-person-orders .place-chip")) >= 5,
      slow(8000),
    ))
  )
    say(
      `the sheet then: ${await k<string>(`JSON.stringify({ tab: document.querySelector(".place-tab.on")?.dataset.tab ?? null, sheet: !document.querySelector(".place-sheet")?.hidden, rows: document.querySelectorAll(".place-row-order").length, on: document.querySelectorAll(".place-row-order.on").length, page: globalThis.causalis.pageOpen(), scroll: document.querySelector(".place-sheet-body")?.scrollTop })`)}`,
    );
  await shot("7c-person-order");
  await read("an order by name being chosen");
  await press(".place-person-orders .place-chip:nth-child(3)", "Crafts, for them");
  await page.waitForTimeout(slow(1500));
  // One put at a building by name, and a household given a home: the keys under the trades.
  await press(".place-row-order", "a person's order key, again");
  if ((await shownCount(".place-person-posts .place-chip")) > 0) {
    await press(".place-person-posts .place-chip", "a building to put them at");
    await page.waitForTimeout(slow(1500));
    await press(".place-row-order", "a person's order key, a third time");
  } else say("no building stands to put anyone at");
  if (
    await until(
      "homes with room, to give a household",
      async () => (await shownCount(".place-person-homes .place-chip")) > 0,
      slow(8000),
    )
  ) {
    await shot("7c2-person-post-and-home");
    await read("the keys to put one at a building and give a household a home");
    await press(".place-person-homes .place-chip", "a home for their household");
    await page.waitForTimeout(slow(1500));
    const moved = await k<{ rows: { words: string }[] } | null>(
      `globalThis.causalis.client.query({ type: "place.log", args: { ref: ${JSON.stringify(town.ref)} } })`,
    );
    check(
      !!moved?.rows.some((r) => /moved with their household to a home given them/.test(r.words)),
      "the household moved to the home given it",
    );
  } else
    say(
      `the People sheet then: ordering ${await shownCount(".place-row-order.on")}, ${(await k<string>(`document.querySelector(".place-person")?.textContent ?? ""`)).slice(0, 300)}; homes with room ${JSON.stringify(await k(`globalThis.causalis.client.query({ type: "place.people", args: { ref: ${JSON.stringify(town.ref)}, occ: null } }).then((s) => s?.homes)`))}`,
    );
  // One of no trade (a child, one grown old): no building to be put at, and a home for their household all the same.
  const noTrade = await k<{ x: number; y: number } | null>(
    `(() => { for (const e of document.querySelectorAll(".place-chips .place-chip")) if (/^No trade/.test(e.textContent ?? "")) { e.scrollIntoView({ block: "center" }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; } return null; })()`,
  );
  if (noTrade) {
    await tap(noTrade.x, noTrade.y);
    await until(
      "the People sheet narrowed to those of no trade",
      async () =>
        /^No trade/.test(
          await k<string>(
            `document.querySelector(".place-chips .place-chip.on")?.textContent ?? ""`,
          ),
        ) && (await shownCount(".place-row-order")) > 0,
    );
    await page.waitForTimeout(slow(1300));
    await press(".place-row-order", "the order key of one of no trade");
    const offered = await until(
      "homes with room, to give a household (of no trade)",
      async () => (await shownCount(".place-person-homes .place-chip")) > 0,
      slow(8000),
    );
    check(
      (await shownCount(".place-person-posts .place-chip")) === 0,
      "one of no trade is offered no building to be put at",
    );
    if (offered) {
      await k(`document.querySelector(".place-person-homes").scrollIntoView({ block: "center" })`);
      await page.waitForTimeout(slow(300));
      await shot("7c3-no-trade-home");
      await read("the keys to give the household of one of no trade a home");
    } else
      say(
        `the People sheet then: ordering ${await shownCount(".place-row-order.on")}, ${(await k<string>(`document.querySelector(".place-person")?.textContent ?? ""`)).slice(0, 300)}`,
      );
    await press(".place-row-order", "the order key again, to put its keys away");
  }
  // A building's work stopped, from the Work sheet, where the town has a building worked in.
  await press('.place-tab[data-tab="work"]', "the Work tab");
  await until("the Work sheet again", async () => /grown hands/.test(await sheetText()));
  if ((await shownCount(".place-sheet-body .place-sell")) > 0) {
    await k(
      `document.querySelector(".place-sheet-body .place-sell").scrollIntoView({ block: "center" })`,
    );
    await page.waitForTimeout(slow(300));
    await press(".place-sheet-body .place-sell", "a building's Going key");
    await until(
      "its work stopped",
      async () => (await shownCount(".place-sheet-body .place-sell.on")) > 0,
    );
    await shot("7d-building-stopped");
    await read("a building's work stopped");
  } else say("no building here has anyone working in it: the stop key was not pressed");
  await press(".place-sheet-shut", "the sheet's close");
  check((await shownCount(".place-sheet")) === 0, "the sheet closes");

  // A notice: told, and put away.
  const noticed = await until("a notice told", async () => !!(await state()).tells, slow(20000));
  if (noticed) {
    say(`notice: ${(await state()).tells}`);
    await shot("8-notice");
    await read("a notice up");
    const was = (await state()).tells;
    await press(".place-notice-shut", "the notice's close");
    check((await state()).tells !== was, "the notice is put away");
  }

  // Left: the god game's chrome back, its usual people; what it did by its orders told to its land.
  const leaving = await state();
  await press(".place-leave", "Leave");
  await until(
    "the town left",
    async () =>
      !(await state()).on &&
      !(await k<number>("globalThis.causalis.planNow().placed?.length ?? 0")),
  );
  await page.waitForTimeout(slow(800));
  check((await shownCount("#hud > .panel .bar")) > 0, "the god game's bar is back");
  check((await shownCount(".place-bar")) === 0, "the mode's bar is away");
  await shot("9-left");
  await read("the town left");
  const kept = await k<{ places: { town: string; people: number; t: number }[]; bytes: number }>(
    `globalThis.causalis.client.query({ type: "place.kept" })`,
  );
  check(
    kept.places.some((p) => p.town === town.ref),
    `the place is kept after leaving (${kept.places.length} kept, ${kept.bytes} bytes)`,
  );
  await press(".town-place", "🏘️ again");
  await until("the town entered again", async () => (await state()).on && !!(await state()).told);
  const again = await state();
  check(
    (again.told?.t ?? 0) >= (leaving.told?.t ?? 0),
    "it goes on from where it was left, not from the start",
  );
  check(again.told?.managed === true, "its orders are kept");
  check(again.told?.unsettled === 0, "what it did by its orders was told to its land on leaving");
  await shot("10-entered-again");
  await press(".place-leave", "Leave");
  await page.waitForTimeout(slow(600));
  check(
    errors.length === 0,
    `no errors on the page (${errors.slice(0, 2).join(" | ").slice(0, 300)})`,
  );
  await context.close();
}
await browser.close();
await server.close();
console.log(
  problems.length
    ? `FAILED: ${problems.length}\n${problems.map((p) => `  - ${p}`).join("\n")}`
    : "all as it should be",
);
process.exit(problems.length ? 1 : 0);
