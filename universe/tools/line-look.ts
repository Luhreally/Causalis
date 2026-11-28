// Live a Line looked at (asked 2026-11-27): on a fresh world held still, at a phone's size and a desk's, the mode entered
// by the planet bar's 🦠 Begin as a cell (and, on the desk, by a tree-of-life line's 🧬 Live this line); the welcome; the
// guide's first lesson; the cell steered by the keys; filled and divided, and a daughter chosen by a tap; its page, a link,
// Back and Forward; the guide's panel; a help page; What now?; the frame at four times the CPU's work while it swims; and
// Wake, after which the world must be exactly where it was (its clock, and every domain's hash). Every state is read for
// overlap by the overlap gate's reading (tools/hud-read.ts), and kept as a still (--shots). (npm run build first.)
//   node tools/line-look.ts [--shots dir] [--seed "first light"] [--only phone|desk] [--frames 150]
import { mkdirSync, readFileSync } from "node:fs";
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
  // (A far-year save to look at the story's stars on: copied beside the build, fetched and imported by the page.)
  starsSave = arg("--stars"),
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

  // —— Its stars on a world at the stars (S8, --stars): the long list read for overlap and clipped words, a ship sent to a
  // star of the hand's choosing, the years run until it sails, and it sails there, saying so.
  if (starsSave) {
    const baked = JSON.parse(readFileSync(`${starsSave}.json`, "utf8")) as {
      seat: number;
      realm: string;
      year: number;
    };
    say(`the realm that can sail: ${baked.realm}, its seat ${baked.seat}, the year ${baked.year}`);
    const got = await k<{ t: number; seed: string }>(
      `fetch("stars.save").then((r) => r.arrayBuffer()).then((b) => globalThis.causalis.client.importSave(new Uint8Array(b)))`,
    );
    say(`imported a world at year ${Math.floor(got.t / 31536000)}`);
    await page.waitForTimeout(2500);
    await k("globalThis.causalis.line.open(null)");
    await until(
      "the mode entered",
      async () => !!(await k<boolean>("globalThis.causalis.lineMode?.state().on")),
      60000,
    );
    await page.waitForTimeout(800);
    await k("globalThis.causalis.lineMode.close()");
    type Stars = {
      realm: { name: string } | null;
      wants: string[];
      asked: { ref: string } | null;
      ships: { star: string; asked: boolean; arrives: number }[];
      stars: { ref: string; taken: boolean }[];
    };
    const starsNow = async () => {
      await k("globalThis.causalis.lineMode.story('story:stars')");
      await page.waitForTimeout(300);
      return k<Stars>("globalThis.causalis.lineMode.storyStars()");
    };
    const clippedPage = () =>
      k<string[]>(
        `[...document.querySelectorAll(".line-page button, .line-page .line-fact *")].filter((e) => e.offsetParent && e.scrollWidth > e.clientWidth + 1).map((e) => "“" + e.textContent.slice(0, 40) + "”")`,
      );
    await k(`globalThis.causalis.lineMode.story("story:stars", ${baked.seat})`);
    let st = await starsNow();
    check(
      !!st.realm && !st.wants.length,
      `the cradle's realm can sail (${st.realm?.name}; lacks ${st.wants.join(", ")})`,
    );
    const free = st.stars.filter((x) => !x.taken);
    check(free.length >= 3, `stars in its reach: ${st.stars.length}, ${free.length} free`);
    await look("s1-stars", "its stars, a long list");
    let c = await clippedPage();
    check(c.length === 0, `no words clipped on the stars page (${c.slice(0, 3).join("; ")})`);
    // (Scrolled to its foot: the last star and its key reachable.)
    await k(
      `(() => { const b = document.querySelector(".line-page-body"); if (b) b.scrollTop = b.scrollHeight; })()`,
    );
    await look("s1b-stars-foot", "its stars, scrolled to the foot");
    await k(
      `(() => { const b = document.querySelector(".line-page-body"); if (b) b.scrollTop = 0; })()`,
    );
    // (The last free star: not the one the realm would choose of itself, the nearest in time, so the ask is seen to change it.)
    const want = free.at(-1)?.ref,
      before = st.ships.length;
    if (want) {
      // (Its button, the last of the page's: brought into view, and pressed where a finger would.)
      await k(
        `(() => { const all = [...document.querySelectorAll(".line-page button.line-link")].filter((e) => /Send our next ship here/.test(e.textContent ?? "")); const b = all.at(-1); if (!b) return; b.scrollIntoView({ block: "center" }); b.dataset.lookPick = "1"; })()`,
      );
      await page.waitForTimeout(300);
      await press("[data-look-pick]", "🚀 Send our next ship here, the last star");
      await k(`document.querySelector("[data-look-pick]")?.removeAttribute("data-look-pick")`);
      await until(
        "the ask said back",
        async () =>
          (await k<Stars>("globalThis.causalis.lineMode.storyStars()")).asked?.ref === want,
        20000,
      );
      st = await starsNow();
      check(st.asked?.ref === want, `asked for ${want} (${st.asked?.ref})`);
      await look("s2-asked", "its stars, a ship asked");
      c = await clippedPage();
      check(c.length === 0, `no words clipped once asked (${c.slice(0, 3).join("; ")})`);
      // (The years run a year at a time until its next ship sails: the realm's own time.)
      await k("globalThis.causalis.lineMode.close()");
      const t1 = Date.now();
      let sailed: Stars["ships"][number] | undefined,
        years = 0;
      while (!sailed && years < 90 && Date.now() - t1 < 9 * 60000) {
        const t = await k<number>("globalThis.causalis.client.status?.t ?? 0");
        await k(`globalThis.causalis.client.advance(${t + 365 * 86400})`);
        years++;
        if (years % 3 === 0 || years > 60) {
          st = await starsNow();
          sailed =
            st.ships.length > before
              ? (st.ships.find((x) => x.asked) ?? st.ships.at(-1))
              : undefined;
          await k("globalThis.causalis.lineMode.close()");
        }
      }
      say(`ran ${years} years in ${Math.round((Date.now() - t1) / 1000)} s`);
      check(!!sailed, `its next ship sailed (${years} years)`);
      if (sailed) {
        check(sailed.star === want, `sailed for the star asked (${sailed.star})`);
        check(sailed.asked, "its sailing gives the ask as its reason");
        st = await starsNow();
        check(!st.asked, "the ask spent");
        await look("s3-sailed", "its stars, the ship sailed where asked");
      }
    }
    check(
      errors.length === 0,
      `no errors on the page (${errors.slice(0, 2).join(" | ").slice(0, 400)})`,
    );
    await context.close();
    continue;
  }

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
    // (Taken first: a grip takes its time, and the cell may slip it.)
    if (
      await until(
        "the cell taken by the hunter set on it",
        async () => (await state()).ended,
        15000,
      )
    ) {
      await shot("03c-goes-on");
      await until(
        "the line to go on after the cell was taken",
        async () => {
          const s = await state();
          return !s.ended && s.layer === null;
        },
        8000,
      );
      await page.waitForTimeout(3000);
      check(
        !(await state()).ended,
        "taken, the line went on as one of its own with nothing to press",
      );
    }
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
  check(((await state()).page ?? "").startsWith("help:"), "the page's ? opens its help");
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
    beast: { x: number; z: number; fed: number; ate: number } | null;
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
  // —— The shallows seen from within; what hunts it; a bite.
  type Under = { over: number; eye: number; pool: boolean } | null;
  const u = (await state()) as unknown as {
    under: Under;
    hunted: { by: string[]; larger: number } | null;
  };
  if (u.under)
    check(
      u.under.eye < u.under.over && !u.under.pool,
      `under water: the eye ${u.under.eye.toFixed(2)} m over the floor, the water's face at ${u.under.over.toFixed(2)} m, the pool's face put by`,
    );
  else say("(not a sea's age: on the land)");
  say(
    `hunted by: ${u.hunted?.by.join(", ") || "nothing"}; ${u.hunted?.larger ?? 0} kinds about larger`,
  );
  check(
    /· (a speck|small|middling|large|great),/.test(
      await k<string>(`document.querySelector(".line-hud")?.textContent ?? ""`),
    ),
    "the strip tells the body's size tier",
  );
  const ate0 = ((await state()) as Body).beast?.ate ?? 0;
  if (await pressText(".line-act", /Feed|Eat|Graze|Browse|Peck/, "the eat key")) {
    await until(
      "a bite taken",
      async () => (((await state()) as Body).beast?.ate ?? 0) > ate0,
      6000,
    );
    await page.waitForTimeout(150);
    await shot("13c-bite");
  }
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
  // —— Courting: a mate comes, they court, a nest is made off the water, the young one comes out of it.
  type NestNow = {
    courting: string | null;
    nest: { x: number; z: number; wet: boolean; laid: boolean; eggs: number } | null;
  };
  if (await k<boolean>("globalThis.causalis.lineMode.court()")) {
    const ways: string[] = [];
    await until(
      "the mate come and courting",
      async () => {
        const n = await k<NestNow | null>("globalThis.causalis.lineMode.nest()");
        if (n?.courting && ways.at(-1) !== n.courting) ways.push(n.courting);
        return n?.courting === "courting";
      },
      20000,
    );
    await page.waitForTimeout(600);
    await shot("14b-courting");
    await until(
      "the nest made",
      async () => !!(await k<NestNow | null>("globalThis.causalis.lineMode.nest()"))?.nest,
      8000,
    );
    const made = (await k<NestNow>("globalThis.causalis.lineMode.nest()")).nest!;
    await page.waitForTimeout(300);
    await look("14c-nest", "the nest");
    say(
      `a nest made at ${made.x.toFixed(1)},${made.z.toFixed(1)} (${made.wet ? "its eggs in the water where its line lives" : "on the ground"}; ${ways.join(" → ")})`,
    );
    await until(
      "the young one out of the nest",
      async () => (await k<NestNow>("globalThis.causalis.lineMode.nest()")).nest?.laid === true,
      8000,
    );
    if (
      !(await until(
        "the young to choose among, from the nest",
        async () => ((await state()) as unknown as { offered: number }).offered > 0,
        8000,
      ))
    )
      say(
        `(the strip told: ${await k<string>(`document.querySelector(".line-told")?.textContent ?? ""`)})`,
      );
    await shot("14d-young-of-the-nest");
  } else say("(Court not to be had here)");
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
    `on into the next age: ${b2.body?.name}, ${b2.body?.mass} kg, ${b2.my} My ago (its turn ${b2.turnMs.toFixed(1)} ms on the page, the host asked in ${(b2 as unknown as { askMs: number }).askMs.toFixed(1)} ms)`,
  );
  await look("16-next-age", "the next age");

  // —— Wake: offered beside Make it so; back to the world, exactly where it was.
  await press(".line-wake", "☀️ Wake");
  await page.waitForTimeout(300);
  await look("16b-wake-or-make", "Wake, or make it so");
  await pressText(".line-card-go, .line-card-other", /☀️ Wake/, "the card's ☀️ Wake");
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

  // —— The tribe (S6): a band of the world's people led. Its orders, its seed come up, its land taught to sow.
  type Band = {
    leading: boolean;
    people: number;
    food: number;
    day: number;
    hour: number;
    camp: { x: number; z: number };
    going: boolean;
    born: number;
    grass: boolean;
    seed: { x: number; z: number; n: number; day: number }[];
    sprouted: { x: number; z: number } | null;
    grain: boolean;
    quarry: number | null;
    offers: { icon: string; label: string; can: boolean; words: string }[];
    taught: boolean;
    stepMs: number;
    land: { cell: number; sows: boolean } | null;
  };
  const band = () => k<Band | null>("globalThis.causalis.lineMode.band()");
  await k("globalThis.causalis.line.open('band')");
  await until("the band led", async () => !!(await band())?.leading, 40000);
  await page.waitForTimeout(1200);
  await look("20-band-intro", "a band led: its card");
  await k("globalThis.causalis.lineMode.close()");
  await page.waitForTimeout(1500);
  const bd0 = (await band())!;
  check(
    bd0.people >= 6 && bd0.offers.length === 4,
    `a band of ${bd0.people}, four acts (${bd0.offers.map((o) => o.label).join(", ")})`,
  );
  say(`the band's land: ${JSON.stringify(bd0.land)}; a wild grain there: ${bd0.grain}`);
  await look("21-band", "the band at its camp");
  await throttled("a band led");
  // —— ⛺ Lead this band, from a camp's own page in the god game: that camp's band led, on its land (the last camp of the
  // land, so that the asked one is told from the first, which the mode leads unasked).
  {
    await k("globalThis.causalis.lineMode.wake()");
    await until(
      "back in the god game",
      async () => !(await k<boolean>("document.body.classList.contains('lining')")),
      20000,
    );
    const at = bd0.land!.cell,
      camps = await k<{ id: number }[]>(
        `globalThis.causalis.client.query({ type: "towns.land", args: { cell: ${at} } }).then((p) => p.camps.map((c) => ({ id: c.id })))`,
      ),
      id = camps[camps.length - 1]?.id ?? 0;
    await k(`globalThis.causalis.open("camp:${at}:${id}")`);
    await page.waitForTimeout(2500);
    await look("21b-camp-page", "a camp's page, its key to lead its band");
    // (On a phone a page's keys stand under its numbers: scrolled to, as a finger would.)
    await k(
      `[...document.querySelectorAll(".page-window .scene-act")].find((e) => /Lead this band/.test(e.textContent ?? ""))?.scrollIntoView({ block: "center" })`,
    );
    await page.waitForTimeout(500);
    if (await pressText(".page-window .scene-act", /Lead this band/, "⛺ Lead this band")) {
      await until(
        "that camp's band led",
        async () => {
          const b = await band();
          return !!b?.leading && b.land?.cell === at;
        },
        40000,
      );
      const led = (await band()) ?? { land: null };
      check(
        led.land?.cell === at && (led.land as { id?: number }).id === id,
        `the camp asked by its page is the one led (camp ${at}:${id} → ${JSON.stringify(led.land)})`,
      );
      await page.waitForTimeout(1200);
      await look("21c-camp-led", "the camp's own band led, its card");
      await k("globalThis.causalis.lineMode.close()");
    }
  }
  say(`the band's step: ${bd0.stepMs.toFixed(2)} ms`);
  // (At night: 🌙 Sleep in the hunt's place, and the night passes in a few seconds, seen.)
  if ((await band())!.hour < 7.5 || (await band())!.hour >= 18) {
    check(
      (await band())!.offers[0]?.label === "Sleep",
      `by night, Sleep in the hunt's place (${(await band())!.offers[0]?.label})`,
    );
    await press(".line-act-0", "🌙 Sleep");
    const slept = Date.now();
    await until(
      "the morning, slept to",
      async () => {
        const h = (await band())!.hour;
        return h >= 7.5 && h < 18;
      },
      20000,
    );
    say(`the night slept through in ${((Date.now() - slept) / 1000).toFixed(1)} s`);
    await look("21a-slept", "the morning after sleeping");
  }
  // (The hunters sent after a beast looked at, by day.)
  await k("globalThis.causalis.lineMode.bandMorning()");
  let hunted: { words: string; good: boolean } | null = null;
  for (let a = 0; a < 24 && !hunted; a++) {
    const c = (await band())!.camp;
    await k(
      `globalThis.causalis.lineMode.bandLook(${c.x + Math.cos(a) * (12 + a * 2)}, ${c.z + Math.sin(a) * (12 + a * 2)})`,
    );
    await page.waitForTimeout(60);
    if ((await band())!.quarry !== null)
      hunted = await k("globalThis.causalis.lineMode.bandAct(0)");
  }
  check(
    !!hunted?.good,
    `the hunters sent: ${hunted?.words ?? "no beast they could take was found about the camp"}`,
  );
  await page.waitForTimeout(1200);
  await look("21b-hunt", "the hunters sent");
  // (The gatherers to the grass; a day and a half; walked on; some days; walked back: the seed come up, where a grain grows.)
  await k("globalThis.causalis.lineMode.bandAct(2)");
  await k("globalThis.causalis.lineMode.bandLive(1.5)");
  const bd1 = (await band())!,
    old = bd1.seed.find((s) => s.n >= 3);
  check(!!old, `seed dropped about the fire (${JSON.stringify(bd1.seed)})`);
  if (old) {
    await k("globalThis.causalis.lineMode.bandMorning()");
    let c = (await band())!.camp;
    if (Math.hypot(c.x - old.x, c.z - old.z) < 30) {
      await k(`globalThis.causalis.lineMode.bandLook(${old.x + 60}, ${old.z})`);
      const w = await k<{ good: boolean; words: string }>(
        "globalThis.causalis.lineMode.bandAct(1)",
      );
      check(w.good, `walked on: ${w.words}`);
    }
    await k("globalThis.causalis.lineMode.bandLive(4.5)");
    await k("globalThis.causalis.lineMode.bandMorning()");
    c = (await band())!.camp;
    if (!(await band())!.sprouted && Math.hypot(c.x - old.x, c.z - old.z) >= 10) {
      await k(`globalThis.causalis.lineMode.bandLook(${old.x}, ${old.z + 6})`);
      const w = await k<{ good: boolean; words: string }>(
        "globalThis.causalis.lineMode.bandAct(1)",
      );
      check(w.good, `walked back to the old camp: ${w.words}`);
    }
    await k("globalThis.causalis.lineMode.bandLive(1.5)");
    const bd2 = (await band())!;
    check(
      !!bd2.sprouted === bd2.grain,
      `the seed come up where a wild grain grows (${bd2.grain}): ${JSON.stringify(bd2.sprouted)}`,
    );
    say(
      `after ${bd2.day} days: ${bd2.people} in the band (${bd2.born} born), ${bd2.food.toFixed(1)} days of food`,
    );
    if (bd2.sprouted)
      await k(`globalThis.causalis.lineMode.bandLook(${bd2.sprouted.x}, ${bd2.sprouted.z})`);
    await page.waitForTimeout(1200);
    await look("22-sprouted", "the grain come up at the old camp");
    if (bd2.sprouted && !bd2.land?.sows) {
      await k("globalThis.causalis.lineMode.sow()");
      await page.waitForTimeout(300);
      await look("23-sow", "Teach your land to sow?");
      await pressText(".line-card-go, .line-card-other", /Teach it/, "🌱 Teach it");
      await until("the land taught", async () => !!(await band())?.taught, 20000);
      await page.waitForTimeout(400);
      await look("24-taught", "your land sows");
      const kept = await k<string[]>(
        `globalThis.causalis.client.saves().then((s) => s.map((x) => x.name))`,
      );
      check(
        kept.some((n) => /before your band sowed/.test(n)),
        `the world before it kept (${kept.slice(0, 3).join(", ")})`,
      );

      // —— The line's story (S7): six pages, ‹ and › through them all; the years run until the land's first village
      // comes, and Go and see opens the god game's page of it.
      await pressText(".line-card-go, .line-card-other", /story/, "📜 Your line's story");
      await page.waitForTimeout(500);
      const pageNow = () => k<string | null>("globalThis.causalis.lineMode.state().page");
      check(
        (await pageNow()) === "story:village",
        `the story opened at its village (${await pageNow()})`,
      );
      for (const want of ["story:town", "story:realm"]) {
        await pressText(".line-page .line-link", / ›$/, "the story's next ›");
        await page.waitForTimeout(250);
        check((await pageNow()) === want, `› on to ${want} (${await pageNow()})`);
      }
      for (const want of [
        "story:town",
        "story:village",
        "story:band",
        "story:body",
        "story:cell",
      ]) {
        await pressText(".line-page .line-link", /^‹ /, "the story's ‹");
        await page.waitForTimeout(250);
        check((await pageNow()) === want, `‹ back to ${want} (${await pageNow()})`);
        await look(`25-${want.slice(6)}`, `the story: ${want}`);
      }
      // (The years run, a year at a time, until the land's first village comes: its turn among the lands that sow.)
      await k("globalThis.causalis.lineMode.close()");
      type Village = { ref: string; name: string; founded: number };
      let village = null as Village | null;
      for (let y = 0; y < 12 && !village; y++) {
        const t = await k<number>("globalThis.causalis.client.status?.t ?? 0");
        await k(`globalThis.causalis.client.advance(${t + 365 * 86400})`);
        await k("globalThis.causalis.lineMode.story('story:village')");
        village =
          (await k<{ village: Village | null } | null>("globalThis.causalis.lineMode.storyWorld()"))
            ?.village ?? null;
      }
      check(
        !!village,
        `the band's land has its first village: ${village ? `${village.name}, the year ${village.founded}` : "not in twelve years"}`,
      );
      await page.waitForTimeout(400);
      await look("26-village", "the story: its village come");
      // (S8: its stars, the seventh page, reached by › from its realm and back.)
      await k("globalThis.causalis.lineMode.story('story:realm')");
      await page.waitForTimeout(300);
      await pressText(".line-page .line-link", / ›$/, "the story's next ›");
      await page.waitForTimeout(300);
      check((await pageNow()) === "story:stars", `› on to its stars (${await pageNow()})`);
      say(
        `its stars: ${JSON.stringify(await k("globalThis.causalis.lineMode.storyStars()")).slice(0, 160)}`,
      );
      await look("26b-stars", "the story: its stars");
      await k("globalThis.causalis.lineMode.story('story:village')");
      await page.waitForTimeout(300);
      if (village) {
        await pressText(".line-page button.line-link", /Go and see/, "🏘️ Go and see");
        await until(
          "the god game's page of the village",
          async () =>
            (await k<string | null>("globalThis.causalis.pageOpen() ?? null")) === village!.ref,
          20000,
        );
        check(
          !(await k<boolean>("globalThis.causalis.lineMode.state().on")),
          "the mode left for the god game's own page",
        );
        await look("27-village-page", "the village's page in the god game");
        await k("globalThis.causalis.closePage()");
      }
    }
  }
  await k("globalThis.causalis.lineMode.close()");
  await k("globalThis.causalis.lineMode.wake()");
  await page.waitForTimeout(600);
  check(!(await k<boolean>("globalThis.causalis.lineMode.state().on")), "woken from the band");

  // —— On the desk: in again by a line of the tree of life, and the line kept. (The clock as it stands now: the band's land
  // taught to sow is a command, and the world went on by it.)
  const tAgain = await k<number>("globalThis.causalis.client.status?.t ?? -1");
  say(`the world's clock after the band: ${t0} → ${tAgain} s`);
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
        (await k<number>("globalThis.causalis.client.status?.t ?? -1")) === tAgain,
        "the clock still where it was after a second waking",
      );
    }
  }
  // —— Make it so (S4): the line laid into a new world from its beginning, the old world kept; the new world opened from
  // year 0 in the time allowed, its tree holding the line; first, its people told (S5): the line risen as the world's people
  // where its kind fits, named and shown on a card, or living on beside them. At both sizes, last (the page is left).
  {
    await k("globalThis.causalis.line.open(null)");
    await until(
      "in again for Make it so",
      async () => !!(await k<boolean>("globalThis.causalis.lineMode?.state().on")),
      30000,
    );
    await k("globalThis.causalis.lineMode.close()");
    await page.waitForTimeout(500);
    const living = ((await state()) as unknown as { living: boolean }).living;
    if (!living) {
      await k("globalThis.causalis.lineMode.ripen()");
      await k("globalThis.causalis.lineMode.founders()");
      await page.waitForTimeout(1500);
      await k("globalThis.causalis.lineMode.found(0)");
      await page.waitForTimeout(1500);
      await k("globalThis.causalis.lineMode.close()");
    }
    const before = page.url();
    await press(".line-wake", "☀️ Wake");
    await page.waitForTimeout(300);
    const t0m = Date.now();
    if (await pressText(".line-card-go, .line-card-other", /Make it so/, "✨ Make it so")) {
      await until(
        "the new world's people told",
        async () =>
          await k<boolean>(`/Your line (rises|lives on)/.test(document.body.textContent ?? "")`),
        90000,
      );
      const told = await k<string>(
        `[...document.querySelectorAll(".line-card")].map((e) => e.textContent).join(" | ").slice(0, 400)`,
      );
      say(`the rises card: ${told}`);
      check(
        /Your line rises: the .*folk|beside your world.s people/.test(told),
        "the card names the people",
      );
      if (/Your line rises/.test(told))
        check(
          await k<boolean>(
            `[...document.querySelectorAll(".line-rises-one")].some((e) => e.getBoundingClientRect().width > 40)`,
          ),
          "one of the risen people drawn beside their forebear",
        );
      await look("18b-rises", "the line's people told: named and shown");
      await pressText(
        ".line-card-go, .line-card-other",
        /Open the new world/,
        "🌍 Open the new world",
      );
      await page
        .waitForURL((u) => u.toString() !== before, { timeout: 30000 })
        .catch(() => undefined);
      const seedNow = new URL(page.url()).searchParams.get("seed") ?? "";
      check(seedNow.includes("line "), `the new world's seed carries the line: “${seedNow}”`);
      const came = await page
        .waitForFunction(
          () =>
            ((globalThis as { causalis?: { client?: { status?: { t?: number } } } }).causalis
              ?.client?.status?.t ?? -1) >= 0,
          undefined,
          { timeout: 60000 },
        )
        .then(() => true)
        .catch(() => false);
      const secs = (Date.now() - t0m) / 1000;
      check(
        came,
        `the world remade to year 0 (the page loaded and the world come in ${secs.toFixed(1)} s; its making alone is bounded in tests/host/makeso.test.ts)`,
      );
      await page
        .waitForFunction(
          () => !!(globalThis as { causalis?: { open?: unknown } }).causalis?.open,
          undefined,
          { timeout: 60000 },
        )
        .catch(() => undefined);
      await page.waitForTimeout(2000);
      await k(`globalThis.causalis.open("world:tree")`);
      await page.waitForTimeout(3000);
      const ours = await k<boolean>(`/Your line/.test(document.body.textContent ?? "")`);
      check(ours, "the remade world's tree of life holds your line");
      await shot("19-made-so");
      const saves = await k<string[]>(
        `globalThis.causalis.client.saves().then((s) => s.map((x) => x.name))`,
      );
      check(
        saves.some((n) => !n.includes("line ")),
        `the world it was lived in kept (${saves.slice(0, 4).join(", ")})`,
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
