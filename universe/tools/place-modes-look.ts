// The ways a town entered is run, looked at (town mode; asked 2026-11-25): on a save given, at a phone's size and a
// desk's, a town entered by hand; the ways shown for choosing; watched: the manager's chrome away, the eye led, its line
// read while the clock runs an hour a second; stayed with one, gone on to the next, the view steered by hand and led
// again, an order refused, the page of whom the eye is with opened; left and entered again (the way kept); and back by
// hand. The HUD is read for overlap in every state (tools/hud-read.ts). Stills into --shots.
// (npm run build first: it reads dist/.)
//   node tools/place-modes-look.ts --save file.save [--shots dir] [--people 400 | --town ref] [--browser webkit] [--only phone]
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { preview } from "vite";
import { chromium, webkit, type Page } from "playwright";
import { loadWorld, rulesetId, seedFromText } from "../src/kernel/index.ts";
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
  people = Number(arg("--people") ?? 400),
  townRef = arg("--town"),
  engine = arg("--browser") ?? "chromium",
  only = arg("--only");
if (!saveFile) throw new Error("--save file.save");
if (shots) mkdirSync(shots, { recursive: true });
const problems: string[] = [],
  say = (s: string) => console.log(`  ${s}`),
  check = (ok: boolean, what: string) => {
    if (!ok) problems.push(what);
    say(`${ok ? "ok " : "NOT"} ${what}`);
  };

const bytes = readFileSync(saveFile),
  doc = JSON.parse(gunzipSync(bytes).toString("utf8")) as Parameters<typeof loadWorld>[0],
  world = loadWorld(
    doc,
    (s) => EARTH.build(s),
    rulesetId(EARTH.build(seedFromText(doc.seed)), EARTH.version),
    { allowRulesetChange: true },
  ).world,
  ctx = populationContext(world),
  town = ctx.settlements
    .all()
    .filter((s) => ctx.settlements.held(s.ref) && (!townRef || s.ref === townRef))
    .reduce((a, b) => (Math.abs(b.population - people) < Math.abs(a.population - people) ? b : a));
console.log(
  `a town entered: ${town.name} (${town.ref}), ${town.population} people, year ${Math.floor(world.now / 31_536_000)}`,
);

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4427, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!,
  browser =
    engine === "webkit"
      ? await webkit.launch()
      : await chromium.launch({
          args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"],
        });
console.log(`browser: ${engine} ${browser.version()}`);
const READ = hudRead([], 1);
type Now = {
  id: number | null;
  title: string;
  words: string;
  stay: boolean;
  free: boolean;
  sight: boolean;
  waiting: number;
};
type State = {
  on: boolean;
  town: string | null;
  told: PlaceFrame | null;
  ran: string;
  watching: Now | null;
  captioned: { title: string; words: string; stay: boolean } | null;
};

for (const view of [
  {
    name: "phone",
    options: {
      viewport: { width: 430, height: 932 },
      // (Playwright's WebKit on Windows presents no WebGL canvas at a device scale of 2: at 1 it does.)
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
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>,
    until = async (what: string, ok: () => Promise<boolean>, ms = 30000) => {
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
    read = async (name: string) => {
      const r = await k<HudRead>(READ);
      check(
        r.overlaps.length === 0,
        `${name}: nothing of the HUD lies over anything (${r.overlaps.slice(0, 3).join("; ")})`,
      );
      check(
        r.covered.length === 0,
        `${name}: every control can be reached (${r.covered.slice(0, 3).join("; ")})`,
      );
      check(
        r.off.length === 0 && r.gone.length === 0,
        `${name}: nothing off the screen (${[...r.off, ...r.gone].slice(0, 3).join("; ")})`,
      );
      const small = r.small.filter((x) => /place-|town-place/.test(x));
      if (view.name === "phone")
        check(
          small.length === 0,
          `${name}: none of its own controls smaller than a fingertip (${small.slice(0, 4).join("; ")})`,
        );
    },
    tap = (x: number, y: number) =>
      view.name === "phone" ? page.touchscreen.tap(x, y) : page.mouse.click(x, y),
    box = (selector: string) =>
      k<{ x: number; y: number; w: number; h: number; l: number; t: number } | null>(
        `(() => { for (const e of document.querySelectorAll(${JSON.stringify(selector)})) { const r = e.getBoundingClientRect(); if (r.width > 0 && r.height > 0) return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height, l: r.x, t: r.y }; } return null; })()`,
      ),
    press = async (selector: string, what: string): Promise<boolean> => {
      const at = await box(selector);
      check(!!at, `${what} is there to press`);
      if (!at) return false;
      await tap(at.x, at.y);
      await page.waitForTimeout(350);
      return true;
    };

  const name = "earth:place-modes-look",
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
  await page.waitForTimeout(2000);
  if (!(await press(".town-place", "🏘️ on the town's bar"))) continue;
  await until("the town entered", async () => {
    const s = await state();
    return s.on && !!s.told;
  });
  await page.waitForTimeout(1200);

  const shown = (selector: string) => box(selector).then((b) => !!b),
    lines: string[] = [],
    line = async (): Promise<string> => {
      const c = (await state()).captioned,
        words = c ? `${c.title} | ${c.words}${c.stay ? " [stay]" : ""}` : "";
      if (words && lines.at(-1) !== words) lines.push(words);
      return words;
    };

  // Entered by hand, as before.
  check((await state()).ran === "hand", "a town entered for the first time is run by hand");
  await read("entered, by hand");
  await shot("1-hand");

  // The ways shown for choosing.
  await press(".place-mode", "the key that says how the town is run");
  check(
    (await k<number>(`document.querySelectorAll(".place-mode-choice").length`)) >= 2,
    "the ways are shown for choosing",
  );
  say(
    `the ways: ${await k<string>(`[...document.querySelectorAll(".place-mode-choice")].map((b) => b.textContent).join(" / ")`)}`,
  );
  await read("the ways shown");
  await shot("2-choosing");

  // Watched.
  await press('.place-mode-choice[data-mode="watch"]', "Watch");
  await until("the town watched", async () => (await state()).ran === "watch");
  check(!(await shown(".place-modes")), "the ways are put away once one is chosen");
  check(
    !(await shown(".place-foot")) &&
      !(await shown(".place-sheet")) &&
      !(await shown(".place-notice")),
    "watched, the manager's tabs, sheet and notice line are away",
  );
  check(await shown(".place-watch"), "and a line says who or what the eye is with");
  await until("the eye with someone", async () => {
    const w = (await state()).watching;
    return !!w && w.title.length > 1 && w.title !== "…";
  });
  await line();
  await read("watched, the eye led");
  await shot("3-watch-led");

  // An order is refused, and none reaches the world.
  const refused = await k<string | null>(
    `globalThis.causalis.place.order("place.hold", { months: 1 })`,
  );
  check(!!refused && /watched/.test(refused), `an order is refused (${refused})`);
  check(!(await state()).told?.managed, "and the town is given no order");

  // The clock an hour a second: the eye is led to what happens, and its line is read.
  await k("globalThis.causalis.place.pace(3600)");
  let sights = 0;
  for (let n = 0; n < (view.name === "phone" ? 40 : 24); n++) {
    await page.waitForTimeout(1000);
    await line();
    const w = (await state()).watching;
    if (w?.sight) sights++;
    if (n === 12) await shot("4-watch-running");
  }
  await k("globalThis.causalis.place.pace(600)");
  say(`its line, as it changed (${lines.length}):`);
  for (const l of lines) say(`    ${l}`);
  check(lines.length >= 2, "the eye goes from one to another while the town runs");
  say(`seconds the eye was with a happening: ${sights}`);
  check(!lines.some((l) => /undefined|NaN|null/.test(l)), "nothing unsaid in its lines");
  await read("watched, the clock having run");

  // On to another, and staying with one.
  const before = (await state()).watching?.id ?? null;
  await press(".place-watch-next", "the next key");
  await until("the eye with another", async () => {
    const w = (await state()).watching;
    return !!w && w.title !== "…" && (w.id !== before || w.sight);
  });
  await until("one of its people to stay with", async () => {
    const w = (await state()).watching;
    if (w && w.id !== null && !w.sight && w.title !== "…") return true;
    await k("globalThis.causalis.place.watchNext()");
    await page.waitForTimeout(900);
    return false;
  });
  await press(".place-watch-stay", "the stay key");
  await until("the eye staying", async () => !!(await state()).watching?.stay);
  const stayed = (await state()).watching!;
  await k("globalThis.causalis.place.pace(3600)");
  await page.waitForTimeout(6000);
  await k("globalThis.causalis.place.pace(600)");
  const still = (await state()).watching!;
  check(
    still.id === stayed.id && still.stay,
    `the eye stays with ${stayed.title} through six hours of the town (${still.title}: ${still.words})`,
  );
  await line();
  await read("watched, staying with one");
  await shot("5-watch-stay");

  // Whom the eye is with is in the middle of the screen, where they are drawn.
  const where = await k<{ x: number; y: number } | null>(
    `(() => { const s = globalThis.causalis.place.state(), plan = globalThis.causalis.planNow(); const i = plan.placed ? plan.placed.indexOf(s.watching.id) : -1; return i >= 0 ? globalThis.causalis.personOnScreen(i) : null; })()`,
  );
  if (where) {
    const size = view.options.viewport,
      off = Math.hypot(where.x - size.width / 2, where.y - size.height / 2);
    check(
      off < Math.min(size.width, size.height) * 0.3,
      `the one the eye is with is drawn near the middle of the screen (${Math.round(off)} px off)`,
    );
  } else
    say(
      "(the one the eye is with is within doors, or not among those drawn: the eye is on their lot)",
    );

  // Their page, from their line.
  await press(".place-watch-text", "the watching line");
  await until("their page", () => shown(".page-window"));
  check(!(await shown(".place-watch")), "a page open takes the watching line's place");
  await read("watched, a page open");
  await shot("6-watch-page");
  await k("globalThis.causalis.closePage()");
  await page.waitForTimeout(400);

  // One tapped: the eye goes with them and stays.
  const tapAt = await k<{ x: number; y: number; id: number } | null>(
    `(() => { const s = globalThis.causalis.place.state(), plan = globalThis.causalis.planNow(), W = innerWidth, H = innerHeight; if (!plan.placed) return null; for (let i = 0; i < plan.people.length; i++) { const id = plan.placed[i]; if (id == null || id < 0 || id === s.watching.id) continue; const p = globalThis.causalis.personOnScreen(i); if (p && p.x > 60 && p.x < W - 60 && p.y > 140 && p.y < H - 160) { let lone = true; for (let j = 0; j < plan.people.length; j++) { if (j === i) continue; const q = globalThis.causalis.personOnScreen(j); if (q && Math.hypot(q.x - p.x, q.y - p.y) < 50) { lone = false; break; } } if (lone) return { x: p.x, y: p.y, id }; } } return null; })()`,
  );
  if (tapAt && (view.name === "phone" || tapAt.x > 480)) {
    await tap(tapAt.x, tapAt.y);
    await until("the eye with the one tapped", async () => {
      const w = (await state()).watching;
      return !!w && w.id === tapAt.id && w.stay;
    });
    await line();
    await shot("7-watch-tapped");
  } else say("(no one of its people stood alone on the screen to tap)");

  // The view steered by hand: let go, and led again by the next key.
  const size = view.options.viewport,
    cx = view.name === "phone" ? size.width / 2 : 860,
    cy = size.height / 2;
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(700);
  await page.keyboard.up("ArrowRight");
  await page.waitForTimeout(400);
  if (!(await state()).watching?.free) {
    // (No keys on a phone: a finger's drag.)
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 90, cy + 30, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(500);
  }
  const free = (await state()).watching;
  say(`steered by hand: ${JSON.stringify(free)}`);
  if (free?.free) {
    check(
      /Looking about/.test((await state()).captioned?.title ?? ""),
      "steered by hand, its line says the view is yours",
    );
    await read("watched, the view steered by hand");
    await shot("8-watch-free");
    await press(".place-watch-next", "the next key");
    await until("the eye led again", async () => {
      const w = (await state()).watching;
      return !!w && !w.free && w.title.length > 1;
    });
  } else
    say(
      "(the view's steering did not let go here: keys and drags do not move a followed view in this browser)",
    );

  // Left and entered again: the way is kept.
  await press(".place-leave", "Leave");
  await until("the town left", async () => !(await state()).on);
  check(
    !(await k<boolean>(`document.body.classList.contains("place-watching")`)),
    "leaving puts the watching chrome away",
  );
  await page.waitForTimeout(800);
  await press(".town-place", "🏘️ on the town's bar");
  await until("the town entered again", async () => {
    const s = await state();
    return s.on && !!s.told;
  });
  await until("still watched", async () => (await state()).ran === "watch");
  check(await shown(".place-watch"), "entered again, it is watched as it was left");
  await page.waitForTimeout(1500);
  await read("entered again, watched");

  // Back by hand.
  await press(".place-mode", "the key that says how the town is run");
  await shot("9-choosing-watch");
  await read("the ways shown, watched");
  await press('.place-mode-choice[data-mode="hand"]', "By hand");
  await until("the town run by hand", async () => (await state()).ran === "hand");
  check(
    (await shown(".place-foot")) && !(await shown(".place-watch")),
    "by hand again, the tabs are back and the watching line is away",
  );
  await page.waitForTimeout(600);
  await read("by hand again");
  await shot("10-hand-again");

  // Run by its own head: the manager's chrome stays, the head's decisions are told, each order given as a player's.
  await press(".place-mode", "the key that says how the town is run");
  await press('.place-mode-choice[data-mode="steward"]', "Its head");
  await until("the town run by its head", async () => (await state()).ran === "steward");
  check(await shown(".place-foot"), "run by its head, the tabs are there to overrule it by");
  await until("its head named on the key", async () =>
    /by its head, /.test(await k<string>(`document.querySelector(".place-mode")?.title ?? ""`)),
  );
  say(`the key: ${await k<string>(`document.querySelector(".place-mode")?.title ?? ""`)}`);
  await k("globalThis.causalis.place.pace(3600)");
  await page.waitForTimeout(view.name === "phone" ? 14000 : 9000);
  await k("globalThis.causalis.place.pace(600)");
  await page.waitForTimeout(1500);
  say(
    `its notice line: ${await k<string>(`document.querySelector(".place-notice-text")?.textContent ?? ""`)}`,
  );
  await read("run by its head");
  await shot("11-steward");
  await press('.place-tab[data-tab="log"]', "the Log tab");
  await page.waitForTimeout(1500);
  const heads = await k<string[]>(
    `[...document.querySelectorAll(".place-sheet-body *")].map((e) => e.textContent ?? "").filter((t) => / as (the town's|its) head/.test(t) && t.length < 400)`,
  );
  say(`its head's lines in the Log (${heads.length}):`);
  for (const l of [...new Set(heads)].slice(0, 8)) say(`    ${l}`);
  check(heads.length > 0, "the Log tells what its head decided, and why");
  await read("run by its head, the Log open");
  await shot("12-steward-log");
  check(!!(await state()).told?.managed || heads.length > 0, "its head's orders reached the town");
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
    ? `PROBLEMS (${problems.length}):\n  ${problems.join("\n  ")}`
    : "all as it should be",
);
process.exit(problems.length ? 1 : 0);
