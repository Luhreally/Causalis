// Live a Line looked at (asked 2026-11-27): on a fresh world held still, at a phone's size and a desk's, the mode entered
// by the planet bar's 🦠 Begin as a cell (and, on the desk, by a tree-of-life line's 🧬 Live this line); the welcome; the
// guide's first lesson; the cell steered by the keys; filled and divided, and a daughter chosen by a tap; its page, a link,
// Back and Forward; the guide's panel; a help page; What now?; the frame at four times the CPU's work while it swims; and
// Wake, after which the world must be exactly where it was (its clock, and every domain's hash). Every state is read for
// overlap by the overlap gate's reading (tools/hud-read.ts), and kept as a still (--shots). (npm run build first.)
//   node tools/line-look.ts [--shots dir] [--seed "first light"] [--only phone|desk] [--frames 150]
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium, type Page } from "playwright";
import { hudRead, type HudRead } from "./hud-read.ts";

const argv = process.argv.slice(2),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  shots = arg("--shots"),
  seed = arg("--seed") ?? "first light",
  only = arg("--only"),
  frames = Number(arg("--frames") ?? 150);
if (shots) mkdirSync(shots, { recursive: true });
const problems: string[] = [],
  say = (s: string) => console.log(`  ${s}`),
  check = (ok: boolean, what: string) => {
    if (!ok) problems.push(what);
    say(`${ok ? "ok " : "NOT"} ${what}`);
  };

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4447, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"],
  });
const READ = hudRead([], 1);
type State = {
  on: boolean;
  my: number;
  gen: number;
  energy: number | null;
  worth: number | null;
  x: number | null;
  steered: number;
  choosing: number;
  layer: string | null;
  page: string | null;
  nav: { back: boolean; forward: boolean; at: number; length: number };
  guide: { done: string[]; welcomed: boolean; hidden: boolean };
  stepMs: number;
  ended: boolean;
};

for (const view of [
  {
    name: "phone",
    options: {
      viewport: { width: 430, height: 932 },
      deviceScaleFactor: 3,
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
  const phone = view.name === "phone",
    k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>,
    state = () => k<State>("globalThis.causalis.lineMode.state()"),
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
    read = async (name: string) => {
      const r = await k<HudRead>(READ);
      check(
        r.overlaps.length === 0,
        `${name}: nothing lies over anything (${r.overlaps.slice(0, 3).join("; ")})`,
      );
      check(
        r.covered.length === 0,
        `${name}: every control can be reached (${r.covered.slice(0, 3).join("; ")})`,
      );
      check(
        r.off.length === 0 && r.gone.length === 0,
        `${name}: nothing off the screen (${[...r.off, ...r.gone].slice(0, 3).join("; ")})`,
      );
      const small = r.small.filter((x) => /line-/.test(x));
      check(
        small.length === 0,
        `${name}: no control of the mode smaller than a fingertip (${small.slice(0, 4).join("; ")})`,
      );
      // (Words clipped: anything of the mode's whose text runs past its own box.)
      const clipped = await k<string[]>(
        `[...document.querySelectorAll(".line-hud button, .line-hud .line-when, .line-hud .line-clock-words")].filter((e) => e.offsetParent && (e.scrollWidth > e.clientWidth + 1)).map((e) => e.className + " “" + e.textContent.slice(0, 30) + "”")`,
      );
      check(clipped.length === 0, `${name}: no words clipped (${clipped.slice(0, 3).join("; ")})`);
    },
    look = async (name: string, what: string) => {
      await page.waitForTimeout(400);
      await shot(name);
      await read(what);
    },
    tap = (x: number, y: number) => (phone ? page.touchscreen.tap(x, y) : page.mouse.click(x, y)),
    box = (selector: string) =>
      k<{ x: number; y: number } | null>(
        `(() => { for (const e of document.querySelectorAll(${JSON.stringify(selector)})) { const r = e.getBoundingClientRect(); if (r.width > 0 && r.height > 0) return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; } return null; })()`,
      ),
    press = async (selector: string, what: string): Promise<boolean> => {
      const at = await box(selector);
      check(!!at, `${what} is there to press`);
      if (!at) return false;
      const met = await k<string | null>(
        `(() => { for (const e of document.querySelectorAll(${JSON.stringify(selector)})) { const r = e.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) continue; const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return t && (t === e || e.contains(t)) ? null : (t ? t.tagName + "." + t.className : "nothing"); } return null; })()`,
      );
      check(met === null, `${what} is what a finger there meets (${met ?? ""})`);
      await tap(at.x, at.y);
      await page.waitForTimeout(300);
      return true;
    },
    pressText = async (selector: string, words: RegExp, what: string) => {
      const sel = await k<string | null>(
        `(() => { const all = [...document.querySelectorAll(${JSON.stringify(selector)})].filter((e) => e.getBoundingClientRect().width > 0); const i = all.findIndex((e) => ${words}.test(e.textContent ?? "")); if (i < 0) return null; all[i].dataset.lookPick = "1"; return "[data-look-pick]"; })()`,
      );
      if (!sel) {
        check(false, `${what} is there to press`);
        return false;
      }
      const ok = await press(sel, what);
      await k(`document.querySelector("[data-look-pick]")?.removeAttribute("data-look-pick")`);
      return ok;
    };

  await page.goto(`${base}?universe=earth&seed=${encodeURIComponent(seed)}&hold=1`);
  await page.waitForFunction(
    () => !!(globalThis as { causalis?: { client?: unknown } }).causalis?.client,
    undefined,
    {
      timeout: 180000,
    },
  );
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: 240000 },
  );
  await k(`(() => { try { localStorage.removeItem("causalis-line-guide"); } catch {} })()`);
  await page.waitForTimeout(1500);
  const t0 = await k<number>("globalThis.causalis.client.status?.t ?? -1"),
    h0 = JSON.stringify(await k("globalThis.causalis.client.query({ type: 'hashes' })"));
  say(`the world held at t ${t0}`);
  // (The mode's chunk not fetched until it is entered.)
  const fetched = await k<number>(
    `performance.getEntriesByType("resource").filter((r) => /\\/line-[^/]*\\.js$/.test(r.name)).length`,
  );
  check(fetched === 0, `the mode's chunk is not fetched before it is entered (${fetched})`);

  // —— In, by the planet bar's key (opened from its fold where the bar folds it away).
  let pressed = false;
  if (!(await box('button[title="Begin as a cell"]'))) {
    const fold = await box(".bar-fold");
    if (fold) await tap(fold.x, fold.y);
    await page.waitForTimeout(400);
  }
  if (await box('button[title="Begin as a cell"]'))
    pressed = await press('button[title="Begin as a cell"]', "🦠 Begin as a cell");
  if (!pressed) {
    say("(the bar's key not to be had on this screen: entered by the look tools' hook)");
    await k("globalThis.causalis.line.open(null)");
  }
  if (
    await page
      .waitForSelector(".place-load:not([hidden])", { timeout: 2500 })
      .then(() => true)
      .catch(() => false)
  )
    await shot("00-loading");
  if (
    !(await until(
      "the mode entered",
      async () => !!(await k<boolean>("globalThis.causalis.lineMode?.state().on")),
      60000,
    ))
  )
    continue;
  await page.waitForTimeout(800);
  check(
    await k<boolean>("document.body.classList.contains('lining')"),
    "the god game's chrome is put away",
  );
  check(
    (await state()).layer?.includes("line-welcome") ?? false,
    "the welcome stands the first time (what this is, how to leave)",
  );
  await look("01-welcome", "the welcome");
  await pressText(".line-card-go", /Begin/, "Begin");
  await look("02-first-lesson", "the drop, the guide's first lesson");

  // —— Steered by the keys: it goes, and stops as it is let go.
  const x0 = (await state()).x;
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(1800);
  await page.keyboard.up("KeyD");
  await page.waitForTimeout(300);
  const s1 = await state();
  check(
    s1.steered > 1 && s1.x !== x0,
    `the cell steered (${s1.steered.toFixed(1)} s, x ${x0?.toFixed(1)} → ${s1.x?.toFixed(1)})`,
  );
  check(s1.guide.done.includes("steer"), "the lesson to steer ticked itself off");
  await look("03-steered", "after steering");

  // —— Danger: a hunter beside it grips it (the ring of beads, the red edge); taken, the line goes on by itself.
  if (await k<boolean>("globalThis.causalis.lineMode.threaten()")) {
    await page.waitForTimeout(350);
    await shot("03b-gripped");
    await until(
      "the line to go on after the cell was taken",
      async () => {
        const s = await state();
        return !s.ended && s.layer === null && (s as unknown as { steered: number }).steered >= 0;
      },
      8000,
    );
    await page.waitForTimeout(3000);
    check(
      !(await state()).ended,
      "taken, the line went on as one of its own with nothing to press",
    );
  } else say("(no hunter in the drop yet to threaten it)");

  // —— Filled, divided by its key, and a daughter chosen by a tap.
  await k("globalThis.causalis.lineMode.feed()");
  await page.waitForTimeout(400);
  await press(".line-act-0", "➗ Divide");
  await until("the daughters to choose among", async () => (await state()).choosing > 0, 5000);
  await look("04-daughters", "the daughters");
  await press('.line-daughter[data-daughter="0"]', "the first daughter");
  const s2 = await state();
  check(
    s2.gen === 1 && s2.choosing === 0 && !s2.layer,
    `a daughter chosen: generation ${s2.gen + 1}`,
  );
  check(
    s2.guide.done.includes("divide") && s2.guide.done.includes("choose"),
    "the lessons to divide and choose ticked off",
  );

  // —— Its page, a link, Back and Forward.
  await press(".line-name", "the cell's name");
  check((await state()).page === "cell", "the cell's page opened");
  await look("05-page", "the cell's page");
  await pressText(".line-page .line-link", /generations/, "its line's link");
  check((await state()).page === "line", "its line's page");
  await press(".line-page-back", "‹ Back");
  let s3 = await state();
  check(s3.page === "cell" && s3.nav.forward, "Back to the cell's page, Forward to be had");
  await press(".line-page-ahead", "Forward ›");
  s3 = await state();
  check(s3.page === "line", "Forward to its line again");
  await look("06-line-page", "its line's page");
  await press(".line-page .line-page-help", "the page's ?");
  check((await state()).page === "help:pages", "the page's ? opens its help");
  await press(".line-page-close", "✕ Close");
  check(!(await state()).layer, "the page closed");

  // —— The guide's panel; the top's ?; What now?.
  await press(".line-guide-button", "📘 Guide");
  await look("07-guide", "the guide's panel");
  await press(".line-guide-panel .line-page-close", "the guide's ✕ Close");
  await press(".line-bar .line-help", "the top's ?");
  check((await state()).page === "help:mode", "the top's ? tells what this mode is");
  await look("08-help", "the help page");
  await press(".line-page-close", "✕ Close");
  await press(".line-now", "💡 What now?");
  const said = await k<string>(`document.querySelector(".line-now-said")?.textContent ?? ""`);
  check(said.length > 10, `What now? says: “${said}”`);
  await look("09-now", "What now?'s words");

  // —— The frame at four times the CPU's work, going.
  const cdp = await page.context().newCDPSession(page);
  const throttled = async (what: string) => {
    await page.keyboard.down("KeyW");
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.waitForTimeout(1000);
    const gaps = (
      await k<number[]>(`new Promise((done) => { const g = []; let last = performance.now();
      const tick = () => { const t = performance.now(); g.push(t - last); last = t; if (g.length < ${frames}) requestAnimationFrame(tick); else done(g); };
      requestAnimationFrame(tick); })`)
    ).sort((a, b) => a - b);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    await page.keyboard.up("KeyW");
    const p80 = Math.round(gaps[Math.floor(gaps.length * 0.8)]! * 10) / 10;
    say(`p80 frame at CPU ×4, ${what}: ${p80} ms (${gaps.length} frames)`);
    if (phone) check(p80 <= 22, `the mode's p80 frame ≤ 22 ms at CPU ×4, ${what} (${p80})`);
  };
  await throttled("a cell swimming");
  say(`the drop's step with the cell held: ${(await state()).stepMs.toFixed(3)} ms`);

  // —— Past the cells: the stage's end, a body founded, lived in its shallows, young had and one chosen.
  await k("globalThis.causalis.lineMode.ripen()");
  await page.waitForTimeout(400);
  await look("11-first-bodies", "the cell stage's end");
  await pressText(".line-card-go", /Found a body/, "🐚 Found a body");
  await until(
    "the bodies to found",
    async () => ((await state()) as unknown as { offered: number }).offered > 0,
    15000,
  );
  await look("12-founders", "the bodies to found");
  await press('.line-body[data-body="0"]', "the first body");
  type Body = State & {
    living: boolean;
    body: { name: string; way: string; mass: number } | null;
    bodies: number;
    pickMs: number;
    turnMs: number;
    beastStepMs: number;
    beast: { x: number; z: number; fed: number } | null;
  };
  const b0 = (await state()) as Body;
  check(
    b0.living && !!b0.body,
    `a body founded and lived: ${b0.body?.name}, ${b0.body?.mass} kg (picker drawn in ${b0.pickMs.toFixed(1)} ms, its world in ${b0.turnMs.toFixed(1)} ms)`,
  );
  if (phone) check(b0.pickMs <= 4, `the picker drawn in ≤ 4 ms (${b0.pickMs.toFixed(2)})`);
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(1500);
  await page.keyboard.up("KeyW");
  const b1 = (await state()) as Body;
  check(
    !!b1.beast && !!b0.beast && Math.hypot(b1.beast.x - b0.beast.x, b1.beast.z - b0.beast.z) > 0.3,
    `the beast went where it was steered (${b0.beast?.x.toFixed(1)},${b0.beast?.z.toFixed(1)} → ${b1.beast?.x.toFixed(1)},${b1.beast?.z.toFixed(1)})`,
  );
  await look("13-body", "the body lived");
  await press(".line-name", "the body's name");
  check((await state()).page === "body", "the body's page opened");
  await look("14-body-page", "the body's page");
  await press(".line-page-close", "✕ Close");
  await press(".line-now", "💡 What now?");
  check(
    (await k<string>(`document.querySelector(".line-now-said")?.textContent ?? ""`)).length > 10,
    "What now? speaks of the body",
  );
  await throttled("a body going");
  say(
    `the meadow's step with the beast held: ${((await state()) as Body).beastStepMs.toFixed(3)} ms`,
  );
  await k("globalThis.causalis.lineMode.young()");
  await until(
    "the young to choose among",
    async () => ((await state()) as unknown as { offered: number }).offered > 0,
    15000,
  );
  await look("15-young", "the young");
  await press('.line-body[data-body="0"]', "the first young one");
  await until("the next age", async () => ((await state()) as Body).bodies === 2, 15000);
  const b2 = (await state()) as Body;
  check(
    b2.living && b2.turnMs <= 30,
    `on into the next age: ${b2.body?.name}, ${b2.body?.mass} kg, ${b2.my} My ago (its turn ${b2.turnMs.toFixed(1)} ms)`,
  );
  await look("16-next-age", "the next age");

  // —— Wake: back to the world, exactly where it was.
  await press(".line-wake", "☀️ Wake");
  await until(
    "woken",
    async () => !(await k<boolean>("globalThis.causalis.lineMode.state().on")),
    10000,
  );
  await page.waitForTimeout(800);
  check(
    !(await k<boolean>("document.body.classList.contains('lining')")),
    "the god game's chrome is back",
  );
  const t1 = await k<number>("globalThis.causalis.client.status?.t ?? -1"),
    h1 = JSON.stringify(await k("globalThis.causalis.client.query({ type: 'hashes' })"));
  check(t1 === t0, `the world's clock where it was (${t0} → ${t1})`);
  check(h1 === h0, "every domain's hash as it was");
  await look("17-woken", "the world after waking");
  check((await state()).guide.done.includes("wake"), "the lesson to wake ticked off");

  // —— On the desk: in again by a line of the tree of life, and the line kept.
  if (!phone) {
    await k(`globalThis.causalis.open("world:tree")`);
    await page.waitForTimeout(2500);
    const opened = await k<boolean>(
      `(() => { const r = [...document.querySelectorAll(".phylo-row")].find((x) => /walk|beast|fish|swim/i.test(x.textContent ?? "")) ?? document.querySelectorAll(".phylo-row")[8]; if (!r) return false; r.click(); return true; })()`,
    );
    check(opened, "a line of the tree of life opened");
    await page.waitForTimeout(2500);
    if (await pressText(".page-actions button", /Live this line/, "🧬 Live this line")) {
      await until(
        "the mode entered from the tree",
        async () => !!(await k<boolean>("globalThis.causalis.lineMode.state().on")),
        30000,
      );
      await page.waitForTimeout(800);
      await look("18-from-tree", "entered from a line of the tree");
      await k("globalThis.causalis.lineMode.close()");
      await k("globalThis.causalis.lineMode.wake()");
      await page.waitForTimeout(500);
      check(
        (await k<number>("globalThis.causalis.client.status?.t ?? -1")) === t0,
        "the clock still where it was after a second waking",
      );
    }
  }
  check(
    errors.length === 0,
    `no errors on the page (${errors.slice(0, 2).join(" | ").slice(0, 400)})`,
  );
  await context.close();
}
await browser.close();
await server.close();
console.log(
  problems.length ? `${problems.length} problems:\n  ${problems.join("\n  ")}` : "all well",
);
process.exit(problems.length ? 1 : 0);
