// The town mode's own chrome, looked at (asked 2026-11-25: "the ui and ux could be better for the rimworld/df/og
// causalis mode"): on a save given, at a phone's size and a desk's, a town gone to and its 🏘️ Run town pressed; the
// ways to run it asked on entering; by hand: the bar (its date, season, year, clock, warmth and weather), the paces'
// pill (a day a second measured), the alert column after a fire is sent on it, an alert tapped (the eye goes there and
// its inspector opens), the menu, every sheet, the inspector at each of its heights and docked, one of its people
// chosen (a ring and their name over them), a building's inspector, the night; run by its head; watched; left. Every
// state is read for overlap by the overlap gate's own reading (tools/hud-read.ts) and its stills kept (--shots), to be
// looked at. (npm run build first: it reads dist/.)
//   node tools/place-ui-look.ts --save file.save [--shots dir] [--people 400 | --town ref] [--browser webkit] [--only phone]
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
  server = await preview({ root, logLevel: "silent", preview: { port: 4437, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!,
  browser =
    engine === "webkit"
      ? await webkit.launch()
      : await chromium.launch({
          args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"],
        });
console.log(`browser: ${engine} ${browser.version()}`);
const READ = hudRead([], 1);
type State = { on: boolean; town: string | null; told: PlaceFrame | null; ran: string };

for (const view of [
  {
    name: "phone",
    options: {
      viewport: { width: 430, height: 932 },
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
  const phone = view.name === "phone",
    k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>,
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
    // (Where the eye is, x and z of the stage's camera, for Go to (R7); null where it cannot be read.)
    eye = () =>
      k<[number, number] | null>(
        "(() => { const c = globalThis.causalis.stage?.camera; const p = c?.getPosition?.(); return p ? [p.x, p.z] : null; })()",
      ),
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
      if (phone)
        check(
          small.length === 0,
          `${name}: none of its own controls smaller than a fingertip (${small.slice(0, 4).join("; ")})`,
        );
    },
    look = async (name: string, what: string) => {
      await page.waitForTimeout(400);
      await shot(name);
      await read(what);
    },
    tap = (x: number, y: number) => (phone ? page.touchscreen.tap(x, y) : page.mouse.click(x, y)),
    box = (selector: string) =>
      k<{ x: number; y: number; w: number; h: number } | null>(
        `(() => { for (const e of document.querySelectorAll(${JSON.stringify(selector)})) { const r = e.getBoundingClientRect(); if (r.width > 0 && r.height > 0) return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; } return null; })()`,
      ),
    shown = (selector: string) =>
      k<number>(
        `[...document.querySelectorAll(${JSON.stringify(selector)})].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).length`,
      ),
    text = (selector: string) =>
      k<string>(`document.querySelector(${JSON.stringify(selector)})?.textContent ?? ""`),
    /** The lessons' card's What now? key a footer in its flow: under its list and within the card, over none of it (U2). */
    guideFooter = async (where: string): Promise<void> => {
      const laid = await k<{ now: number; list: number; card: number; end: number } | null>(
        `(() => { const n = document.querySelector(".place-guide-now")?.getBoundingClientRect(), l = document.querySelector(".place-guide-list")?.getBoundingClientRect(), c = document.querySelector(".place-guide")?.getBoundingClientRect(); return n && l && c && n.height > 0 ? { now: n.top, list: l.bottom, card: c.bottom, end: n.bottom } : null; })()`,
      );
      check(
        !!laid && laid.now >= laid.list - 0.5 && laid.end <= laid.card + 0.5,
        `What now? on the lessons' card a footer under its list, ${where} (${JSON.stringify(laid)})`,
      );
    },
    press = async (selector: string, what: string): Promise<boolean> => {
      // (Scrolled to within what holds it, as a finger would: a person's page at half the screen on a phone runs past its
      // fold. Then where it has come to rest: a sheet still rising or a row of tabs still scrolling moves it from under it.)
      await k<void>(
        `(() => { for (const e of document.querySelectorAll(${JSON.stringify(selector)})) { const r = e.getBoundingClientRect(); if (r.width > 0 && r.height > 0) { e.scrollIntoView({ block: "nearest", inline: "nearest" }); return; } } })()`,
      );
      let at = await box(selector);
      for (let n = 0; at && n < 20; n++) {
        await page.waitForTimeout(100);
        const next = await box(selector);
        if (next && Math.abs(next.x - at.x) < 0.5 && Math.abs(next.y - at.y) < 0.5) break;
        at = next;
      }
      check(!!at, `${what} is there to press`);
      if (!at) return false;
      const met = await k<string | null>(
        `(() => { for (const e of document.querySelectorAll(${JSON.stringify(selector)})) { const r = e.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) continue; const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return t && (t === e || e.contains(t)) ? null : (t ? t.tagName + "." + t.className : "nothing"); } return null; })()`,
      );
      check(met === null, `${what} is what a finger there meets (${met ?? ""})`);
      await tap(at.x, at.y);
      await page.waitForTimeout(350);
      return true;
    },
    /** The town's clock run at an hour a second to an hour of its day, then stopped. */
    toHour = async (from: number, to: number, what: string) => {
      await k(`globalThis.causalis.client.setSpeed(3600)`);
      await until(
        what,
        async () => {
          const h = ((((await state()).told?.t ?? 0) % 86400) + 86400) % 86400;
          return h >= from * 3600 && h < to * 3600;
        },
        90000,
      );
      await press('.place-pace[data-pace="0"]', "the pause");
    };

  const name = "earth:place-ui-look",
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
  await page.waitForTimeout(2500);
  check(/Run town/.test(await text(".town-place")), "the god game's key says 🏘️ Run town");
  await look("01-god-bar", "the town, before it is run");
  // (What the page holds on its graphics card, the god game's scene and the town's, before it is run and while it is.)
  const vram = () =>
    k<{ tex: number; vb: number; ib: number } | null>(
      "(() => { const v = globalThis.causalis.stage?.device?._vram; return v ? { tex: v.tex, vb: v.vb, ib: v.ib } : null; })()",
    );
  const mb = (v: { tex: number; vb: number; ib: number } | null) =>
    v
      ? `${((v.tex + v.vb + v.ib) / 1048576).toFixed(1)} MB (textures ${(v.tex / 1048576).toFixed(1)}, meshes ${((v.vb + v.ib) / 1048576).toFixed(1)})`
      : "not told";
  const godVram = await vram();
  say(`graphics memory before the town is run: ${mb(godVram)}`);

  // Entered: its loading screen while its chunk comes and its people are read (O1), then the ways to run it asked.
  // (The mode's chunk fetched as over a slow line, a second and a half: its loading screen stands to be looked at.)
  await page.route(/townplace-[^/]*\.js$/, async (r) => {
    await new Promise((done) => setTimeout(done, 1500));
    await r.continue();
  });
  if (!(await press(".town-place", "🏘️ Run town"))) continue;
  if (
    await page
      .waitForSelector(".place-load:not([hidden])", { timeout: 3000 })
      .then(() => true)
      .catch(() => false)
  )
    // (At once: it stands a few hundred ms, less than a look's wait.)
    await shot("01b-loading");
  await until("the town entered", async () => {
    const s = await state();
    return s.on && !!s.told;
  });
  {
    const c = await k<{ loaded: number }>("globalThis.causalis.place.uiCost()");
    say(`the loading screen stood ${Math.round(c.loaded)} ms`);
    check((await shown(".place-load")) === 0, "the loading screen is away once entered");
  }
  await page.waitForTimeout(1500);
  check((await shown(".place-mode-choice")) === 3, "the three ways are asked on entering");
  // (The first time in, a welcome over the ways: G4. Once a way is chosen, never again.)
  check(
    (await shown(".place-welcome")) > 0 && /Welcome/.test(await text(".place-welcome")),
    "a welcome the first time in",
  );
  check(/leave/i.test(await text(".place-welcome")), "the welcome says how to leave");
  await look("02-choose-on-entry", "the ways asked on entering");
  await press('.place-mode-choice[data-mode="hand"]', "✋ Run it");
  check((await shown(".place-welcome")) === 0, "the welcome gone once a way is chosen");
  await page.waitForTimeout(1200);
  const date = await text(".place-date");
  check(
    /^(Winter|Spring|Summer|Autumn) · day \d+ · year \d+$/.test(date),
    `the bar's date: "${date}"`,
  );
  const air = await text(".place-air");
  check(/-?\d+°/.test(air), `the bar's warmth and weather: "${air}"`);
  await look("03-hand", "the town run by hand");
  say(`graphics memory while it is run: ${mb(await vram())}`);

  // (The paces in plain units a second, as the god bar's "1 month/s": never "1m" read as a month. U2.)
  const paceWords = await k<string[]>(
    '[...document.querySelectorAll(".place-pace[data-pace]")].filter((e) => e.dataset.pace !== "0").map((e) => e.textContent ?? "")',
  );
  check(
    paceWords.length === 4 && paceWords.every((w) => /^\d+ (min|hr|day)\/s$/.test(w)),
    `the paces in plain units a second: ${paceWords.join(", ")}`,
  );
  // A day a second: how far its clock goes in four seconds of the page's.
  await press('.place-pace[data-pace="86400"]', "the day-a-second pace");
  const t0 = (await state()).told?.t ?? 0,
    w0 = Date.now();
  await page.waitForTimeout(4000);
  const t1 = (await state()).told?.t ?? 0,
    secs = (Date.now() - w0) / 1000;
  say(
    `a day a second: ${((t1 - t0) / 86400 / secs).toFixed(2)} days of the town a second of the page`,
  );
  check(t1 - t0 > 86400, "its clock goes on by days at a day a second");
  await press('.place-pace[data-pace="600"]', "the ten-minutes-a-second pace");

  // Alerts: a fire sent on the town, told in the column; tapped, the eye goes there.
  await k(
    `globalThis.causalis.client.command("act.fire", { village: ${JSON.stringify(town.ref)} })`,
  );
  await until(
    "a fire in the alerts",
    async () => !!(await state()).told?.notices.some((n) => n.key.startsWith("fire")),
    40000,
  );
  await page.waitForTimeout(1200);
  await press('.place-pace[data-pace="0"]', "the pause");
  say(
    `alerts: ${((await state()).told?.notices ?? []).map((n) => `[${n.level}${n.icon} ${n.n}] ${n.words}`).join(" | ")}`,
  );
  check((await shown(".place-alert")) > 0, "the alert column is shown");
  await look("04-alerts-fire", "the alerts, a fire among them");
  // (Entered at midnight all are within: the eye as it is put on entering, by day, where most of them are out of doors.)
  await k("globalThis.causalis.place.reframe()");
  await page.waitForTimeout(1800);
  const px = await k<number>("globalThis.causalis.place.figurePx()");
  say(`its people stand ${px.toFixed(1)} px tall as the eye is put on entering, by day`);
  check(px >= 24, `its people are a finger's breadth tall on entering (${px.toFixed(1)} px)`);
  await look("03b-entry-by-day", "the eye as put on entering, by day");
  // What the mode's chrome costs a frame of the page: four seconds at ten minutes a second, one of its people chosen.
  {
    const one = await k<string | null>("globalThis.causalis.planNow()?.people[0]?.ref ?? null");
    if (one) await k(`globalThis.causalis.place.inspect(${JSON.stringify(one)})`);
    await press('.place-pace[data-pace="600"]', "the ten-minutes-a-second pace");
    await k("globalThis.causalis.place.uiCost()");
    await page.waitForTimeout(4000);
    const c = await k<{ ms: number; frames: number; signs?: unknown }>(
      "globalThis.causalis.place.uiCost()",
    );
    say(`  of it, the signs over heads: ${JSON.stringify(c.signs ?? null)}`);
    await press('.place-pace[data-pace="0"]', "the pause");
    await k("globalThis.causalis.place.inspect(null)");
    say(
      `the mode's chrome: ${(c.ms / Math.max(1, c.frames)).toFixed(3)} ms a frame over ${c.frames} frames (its alerts, clock, sky, ring and name)`,
    );
    check(c.frames > 0 && c.ms / c.frames < 0.3, "the mode's chrome costs a frame under 0.3 ms");
  }
  // Over heads near the eye (Q1): what bears most on them or what they are at, and a mark between two talking; none over
  // another.
  {
    let b = { signs: 0, talks: 0, near: 0 };
    for (let tries = 0; tries < 12 && !b.signs; tries++) {
      await page.waitForTimeout(500);
      b = await k<{ signs: number; talks: number; near: number }>(
        "globalThis.causalis.place.state().bubbles",
      );
    }
    say(
      `over heads near the eye: ${b.signs} signs, ${b.talks} of them two talking, of ${b.near} near it with one`,
    );
    say(
      `  what they cost: ${JSON.stringify(await k("globalThis.causalis.place.state().bubbles.ms"))}`,
    );
    check(b.signs > 0 || b.near === 0, "signs over heads near the eye, where any near it has one");
    const over = await k<number>(
      `(() => { const r = [...document.querySelectorAll(".place-bubble:not(.off)")].map((e) => e.getBoundingClientRect()); let n = 0; for (let a = 0; a < r.length; a++) for (let c = a + 1; c < r.length; c++) if (r[a].left < r[c].right - 1 && r[c].left < r[a].right - 1 && r[a].top < r[c].bottom - 1 && r[c].top < r[a].bottom - 1) n++; return n; })()`,
    );
    check(over === 0, `no sign over another (${over})`);
    await look("03c-bubbles", "signs over heads near the eye");
  }
  await press(".place-alert", "the gravest alert");
  await page.waitForTimeout(1300);
  await look("05-alert-tapped", "an alert tapped: the eye gone there");
  // (The notice line's words and its alert's key count from one reading: a count in the words is the key's. U2.)
  await page.waitForTimeout(1500);
  const told = await k<{ words: string; n: string } | null>(
    `(() => { const w = document.querySelector(".place-notice:not([hidden]) .place-notice-words[data-key]"); if (!w) return null; const n = document.querySelector(\`.place-alert[data-key="\${CSS.escape(w.dataset.key)}"] .place-alert-n\`); return { words: w.textContent ?? "", n: n?.textContent ?? "" }; })()`,
  );
  if (told && /^\S+ (\d+) /.test(told.words) && told.n && told.n !== "99+")
    check(
      told.words.match(/^\S+ (\d+) /)![1] === told.n,
      `the notice's words and its key's count agree: "${told.words.slice(0, 60)}" / ${told.n}`,
    );
  if ((await shown(".place-alert-more")) > 0) {
    await press(".place-alert-more", "the alerts the column has no room for");
    await look("05b-alerts-more", "the rest of the alerts told");
  }
  await k("globalThis.causalis.closePage?.()");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  // The inspector: one of its people tapped (a ring at their feet, their name over them), at each height, each tab.
  type Inspected = {
    ref: string | null;
    height: string;
    name: string;
    chosen: number | null;
    answered: number | null;
  };
  const inspected = async () =>
    (await k<{ inspected: Inspected }>("globalThis.causalis.place.state()")).inspected;
  await press('.place-pace[data-pace="0"]', "the pause");
  // (The gravest alert may be one lying abed indoors, out of sight: the eye taken to the fire's, where its crew stand.)
  const anyone = () =>
    k<boolean>(
      `(() => { const c = globalThis.causalis, n = c.planNow().people.length, W = innerWidth, H = innerHeight; for (let i = 0; i < n; i++) { const p = c.personOnScreen(i); if (p && p.x > 8 && p.x < W - 8 && p.y > H * 0.15 && p.y < H * 0.8 && document.elementFromPoint(p.x, p.y)?.tagName === "CANVAS") return true; } return false; })()`,
    );
  if (!(await anyone()) && (await box('.place-alert[data-key="fire"]'))) {
    await press('.place-alert[data-key="fire"]', "the fire's alert");
    await page.waitForTimeout(1300);
    await k("globalThis.causalis.closePage?.()");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }
  // (The eye close on a house can have its crew behind its walls: drawn back a little, as a finger would pinch.)
  for (let tries = 0; tries < 3 && !(await anyone()); tries++) {
    const vp = page.viewportSize()!;
    await page.mouse.move(vp.width / 2, vp.height * 0.45);
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(900);
  }
  const seen = await k<{ i: number; x: number; y: number } | null>(
    `(() => { const c = globalThis.causalis, n = c.planNow().people.length, W = innerWidth, H = innerHeight; for (let i = 0; i < n; i++) { const p = c.personOnScreen(i); if (p && p.x > 8 && p.x < W - 8 && p.y > H * 0.15 && p.y < H * 0.8 && document.elementFromPoint(p.x, p.y)?.tagName === "CANVAS") return { i, x: p.x, y: p.y }; } return null; })()`,
  );
  check(!!seen, "one of its people stands on the screen, clear of the chrome");
  if (seen) {
    // (How long the host takes to answer the plainest asking now, to tell its queue from the inspector's own reading.)
    const rt = await k<number>(
      `(async () => { const t0 = performance.now(); await globalThis.causalis.client.query({ type: "place.kept", args: {} }); return Math.round(performance.now() - t0); })()`,
    );
    say(`the host answers a plain asking in ${rt} ms before the tap`);
    await tap(seen.x, seen.y);
    await until("their inspector", async () => /^plc/.test((await inspected()).ref ?? ""));
    const asked = Date.now();
    await until(
      "the inspector names them",
      async () => !/^…?$/.test(await text(".place-insp-name")),
      8000,
    );
    say(
      `the inspector told who they are in ${Date.now() - asked} ms as the tool polls; its first answer came ${(await inspected()).answered} ms after it was asked`,
    );
    await page.waitForTimeout(600);
    const ins = await inspected();
    say(`inspected: ${JSON.stringify(ins)}`);
    check(
      !/^…?$/.test(await text(".place-insp-name")),
      `the inspector names them ("${await text(".place-insp-name")}")`,
    );
    check(ins.chosen !== null, "the one tapped is chosen");
    check(
      (await shown(".place-ring")) === 1 && (await shown(".place-tag")) === 1,
      "a ring at their feet and their name over them",
    );
    check((await shown(".page-window:not([hidden])")) === 0, "no page of the god game's opens");
    await look("12-insp-first", "one of its people inspected");
    const clipped = () =>
      k<string[]>(
        `[...document.querySelectorAll(".place-insp button")].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && b.scrollWidth > b.clientWidth + 1; }).map((b) => b.className + " " + JSON.stringify(b.textContent))`,
      );
    {
      // (On a phone its tabs are under its peek: at half the screen.)
      if (phone) {
        await k('globalThis.causalis.place.inspectHeight("half")');
        await page.waitForTimeout(400);
      }
      await press('.place-insp-tab[data-tab="mood"]', "the Mood tab, to show the tabs");
      const cut = await clipped();
      check(
        cut.length === 0,
        `no key of the inspector's cut short (${cut.slice(0, 4).join("; ")})`,
      );
      await press('.place-insp-tab[data-tab="now"]', "back to the first tab");
      if (phone) {
        await k('globalThis.causalis.place.inspectHeight("peek")');
        await page.waitForTimeout(400);
      }
    }
    say(`inspector: ${(await text(".place-insp")).slice(0, 400)}`);
    if (phone) {
      await press(".place-insp-handle", "the inspector's handle, to half");
      await look("13-insp-half", "the inspector at half the screen");
      await press(".place-insp-handle", "the inspector's handle, to all of it");
      await look("14-insp-full", "the inspector at its full height");
    }
    for (const tab of ["mood", "health", "skills", "social", "gear", "life", "work"]) {
      await press(`.place-insp-tab[data-tab="${tab}"]`, `the inspector's ${tab} tab`);
      await page.waitForTimeout(700);
      say(`${tab}: ${(await text(".place-insp-body")).slice(0, 400)}`);
      // (Q2: whom they know as a web of portraits, and why they think as they do of each.)
      if (
        tab === "social" &&
        (await shown(
          ".place-insp-person.tie-friend, .place-insp-person.tie-known, .place-insp-person.tie-rival",
        )) > 0
      ) {
        check(
          (await shown(".place-insp-web")) === 1,
          "the Social tab draws the web of whom they know",
        );
        check(
          /Known well to/.test(await text(".place-insp-body")),
          "the Social tab says how the town thinks of them",
        );
      }
      // (What they hold slot by slot and by its stuff, R3.)
      if (tab === "gear") {
        check(
          (await shown(".place-insp-slot")) >= 1,
          "the Gear tab has their things in their slots",
        );
        check((await shown(".place-insp-stuff-swatch")) >= 1, "and all of it by its stuff");
      }
      await look(`15-insp-${tab}`, `the inspector's ${tab} tab`);
    }
    // (One hurt in the fire: their Health tab, the wounded member on their figure.)
    const hurt = await k<number | null>(
      `globalThis.causalis.client.query({ type: "place.people", args: { ref: ${JSON.stringify(town.ref)}, occ: null } }).then((s) => s?.rows.find((r) => r.health === 1 && r.occ !== 0)?.id ?? null)`,
    );
    if (hurt !== null) {
      await k(`globalThis.causalis.place.inspect(${JSON.stringify(`plc:${town.ref}:${hurt}`)})`);
      await until(
        "the one hurt inspected",
        async () => !/^…?$/.test(await text(".place-insp-name")),
        8000,
      );
      if (phone) await k('globalThis.causalis.place.inspectHeight("full")');
      await press('.place-insp-tab[data-tab="health"]', "the hurt one's health tab");
      await page.waitForTimeout(800);
      say(`hurt: ${(await text(".place-insp-body")).slice(0, 500)}`);
      check((await shown(".place-insp-figure")) === 1, "their body is drawn");
      await look("15h-insp-health-hurt", "one hurt in the fire, their health");
      if (phone) await k('globalThis.causalis.place.inspectHeight("full")');
      if (ins.ref) await k(`globalThis.causalis.place.inspect(${JSON.stringify(ins.ref)})`);
      await page.waitForTimeout(800);
    } else say("no one of its grown lies hurt to look at");
    await press(".place-insp-info", "ⓘ");
    await look("16-insp-prose", "the inspector's words behind ⓘ");
    await press(".place-insp-info", "ⓘ again");
    await press('.place-insp-tab[data-tab="now"]', "the inspector's first tab");
    // (At half the screen, where its orders show.)
    if (phone) {
      await k('globalThis.causalis.place.inspectHeight("half")');
      await page.waitForTimeout(400);
    }
    // The lessons (G1): opening a person ticked off, its Show me lighting the real key where it is out.
    {
      const done = () =>
        k<string[]>(
          '[...document.querySelectorAll(".place-guide-lesson.done")].map((e) => e.dataset.lesson)',
        );
      if (!phone) {
        check((await shown(".place-guide")) > 0, "the lessons' card out on a desk");
        check(
          (await done()).includes("enter") && (await done()).includes("person"),
          "entering and opening a person ticked off",
        );
        // (A lesson done has no Show me: the first of those whose key is out on a person's page not yet done.)
        const todo = await k<string>(
          '["mood", "back", "follow"].find((l) => document.querySelector(`.place-guide-lesson[data-lesson="${l}"] .place-guide-show`)) ?? ""',
        );
        check(todo !== "", "a lesson not yet done whose key is out on a person's page");
        if (todo) {
          await press(
            `.place-guide-lesson[data-lesson="${todo}"] .place-guide-show`,
            `Show me, for the lesson "${todo}"`,
          );
          await page.waitForTimeout(300);
          check(
            (await shown(".place-glow")) > 0,
            `Show me lights the real key for the lesson "${todo}"`,
          );
        }
        await look("16g-lessons", "the lessons beside a person's page");
        await guideFooter("on a desk");
      } else
        check((await shown(".place-guide")) === 0, "the lessons hidden on a phone till asked for");
    }
    // What this tab is, in plain words (G2): from the inspector's ?, and Back to them.
    const inspKind = () => k<string>('document.querySelector(".place-insp")?.dataset.kind ?? ""');
    await press(".place-insp-helpkey", "? on a person's page");
    await until("what this is", async () => (await inspKind()) === "help", 8000);
    say(`help: ${(await text(".place-insp")).slice(0, 200)}`);
    check(
      /What is this\?/.test(await text(".place-insp-names")),
      "what the tab is, in plain words",
    );
    await look("16h-help", "what a tab is, in plain words");
    await press(".place-insp-back", "‹ Back from what this is");
    await until(
      "them again, after what this is",
      async () => (await inspKind()) === "person",
      8000,
    );
    check((await inspKind()) === "person", "Back from what this is comes to them");
    // (A child has no orders to give.)
    if ((await shown(".place-insp-order")) > 0) {
      await press(".place-insp-order", "the inspector's Orders");
      await look("17-insp-orders", "a person's orders in the inspector");
      // (Drafting by name among them, R9.)
      check((await shown(".place-insp-draft .place-chip")) >= 2, "a draft among their orders");
      await press(".place-insp-order", "Orders, closed");
    } else say("the one inspected keeps no work: no orders to look at");
    // Their table, and what they take where they need it (P4): on their first screen.
    check((await shown(".place-insp-table")) > 0, "their household's table told on their page");
    say(
      `table: ${await text(".place-insp-table")}${(await shown(".place-insp-takes")) ? ` · ${await text(".place-insp-takes")}` : ""}`,
    );
    // Their family (P3): from their page, and Back to them.
    {
      const kind = () => k<string>('document.querySelector(".place-insp")?.dataset.kind ?? ""');
      await k('document.querySelector(".place-insp-family")?.scrollIntoView({ block: "center" })');
      await page.waitForTimeout(300);
      await press(".place-insp-family", "Family ▸, on a person's page");
      await until("their family", async () => (await kind()) === "family", 8000);
      await page.waitForTimeout(400);
      say(`family: ${(await text(".place-insp")).slice(0, 300)}`);
      check((await shown(".place-family-row")) >= 2, "their family's page tells their parents");
      await look("16b-family", "one's family in the town");
      await press(".place-insp-back", "‹ Back to them from their family");
      await until("them again", async () => (await kind()) === "person", 8000);
      check((await kind()) === "person", "Back from their family comes to them");
      // Their character and mind (R2), beside their family's key, and Back.
      await k(
        'document.querySelector(".place-insp-character")?.scrollIntoView({ block: "center" })',
      );
      await page.waitForTimeout(300);
      await press(".place-insp-character", "Character ▸, on a person's page");
      await until("their character", async () => (await kind()) === "character", 8000);
      await page.waitForTimeout(400);
      say(`character: ${(await text(".place-insp")).slice(0, 300)}`);
      check((await shown(".place-insp-leaning")) === 5, "their five leanings drawn");
      await look("16c-character", "one's character and mind");
      await press(".place-insp-back", "‹ Back to them from their character");
      await until("them again", async () => (await kind()) === "person", 8000);
      check((await kind()) === "person", "Back from their character comes to them");
      // Their body and what it is written in (R4), and Back.
      await k('document.querySelector(".place-insp-bodykey")?.scrollIntoView({ block: "center" })');
      await page.waitForTimeout(300);
      await press(".place-insp-bodykey", "Body ▸, on a person's page");
      await until("their body", async () => (await kind()) === "body", 8000);
      await page.waitForTimeout(400);
      say(`body: ${(await text(".place-insp")).slice(0, 300)}`);
      await look("16d-body", "one's body and what it is written in");
      await press(".place-insp-back", "‹ Back to them from their body");
      await until("them again", async () => (await kind()) === "person", 8000);
      check((await kind()) === "person", "Back from their body comes to them");
      // Why they do what they do (R7): ❓ beside them, each step a page or a place to go to, and Back.
      await k('document.querySelector(".place-insp-whykey")?.scrollIntoView({ block: "center" })');
      await page.waitForTimeout(300);
      await press(".place-insp-whykey", "Why? ▸, beside their family on their page");
      await until("why they do it", async () => (await kind()) === "why", 8000);
      await page.waitForTimeout(400);
      say(`why: ${(await text(".place-insp")).slice(0, 300)}`);
      check(
        (await shown(".place-insp-whystep")) >= 3,
        "what they do, why, and what lies behind it",
      );
      await look("16e-why", "why one does what they do");
      if ((await shown(".place-insp-go")) > 0) {
        const was = await eye();
        await press(".place-insp-go", "🎯 Go to, on a step of why");
        await page.waitForTimeout(1400);
        const now = await eye();
        if (was && now)
          check(
            Math.hypot(now[0] - was[0], now[1] - was[1]) > 0.01 || (await kind()) === "why",
            "Go to sends the eye, the page staying",
          );
      }
      await press(".place-insp-back", "‹ Back to them from why");
      await until("them again", async () => (await kind()) === "person", 8000);
      check((await kind()) === "person", "Back from why comes to them");
    }
    // A sheet opened under it: the inspector above it, peeked.
    await press('.place-tab[data-tab="people"]', "the People tab, the inspector open");
    await page.waitForTimeout(1200);
    await look("18-insp-and-sheet", "the inspector over a sheet");
    {
      const was = (await inspected()).ref,
        rows = await k<number>(`document.querySelectorAll(".place-person-row").length`);
      if (rows > 1) {
        await k(
          `(() => { const want = ${JSON.stringify(was)}; for (const b of document.querySelectorAll(".place-person-row")) { b.scrollIntoView({ block: "center" }); return true; } })()`,
        );
        await page.waitForTimeout(300);
        await press(".place-person:nth-child(2) .place-person-row", "a row of the People sheet");
        await until(
          "one opened from the People sheet",
          async () => (await inspected()).ref !== was,
          8000,
        );
        await press(".place-insp-back", "‹ Back from one opened from the People sheet");
        await until(
          "Back to the one before the sheet's",
          async () => (await inspected()).ref === was,
          8000,
        );
      } else say("the People sheet has no rows to open");
    }
    await press(".place-sheet-shut", "the sheet's close");
    // Every way back (asked 2026-11-26: "it doesnt let me click back when i click on person/like follow closesly"):
    // each lets the eye go of whom it was kept with and leads back, from Follow closely and 🎯 alike.
    const now = () =>
        k<{ following: boolean; inspected: Inspected }>("globalThis.causalis.place.state()"),
      reopen = async (what: string) => {
        await k(`globalThis.causalis.place.inspect(null)`);
        await k(`globalThis.causalis.place.inspect(${JSON.stringify(ins.ref)})`);
        await until(what, async () => !/^…?$/.test(await text(".place-insp-name")), 8000);
        if (phone) await k('globalThis.causalis.place.inspectHeight("peek")');
        await page.waitForTimeout(300);
      },
      kept = async (what: string) => {
        await press(".place-insp-follow", `🎯 ${what}`);
        await page.waitForTimeout(600);
        check((await now()).following, `${what}: the eye is kept with them`);
      };
    // (From the first opened: what was looked at before closed, then it opened anew.)
    await reopen("opened first");
    if (phone) await k('globalThis.causalis.place.inspectHeight("half")');
    await page.waitForTimeout(300);
    if ((await shown(".place-insp-pin")) > 0) await press(".place-insp-pin", "☆ Follow closely");
    if (phone) await k('globalThis.causalis.place.inspectHeight("peek")');
    await page.waitForTimeout(300);
    await kept("followed closely");
    await look("19-insp-follow", "the eye kept with them");
    await press(".place-insp-back", "‹ Back, from the first");
    await page.waitForTimeout(900);
    {
      const s = await now();
      check(
        !s.following && s.inspected.ref === null,
        `Back from the first lets the eye go and closes (${JSON.stringify(s.inspected.ref)}, ${s.following})`,
      );
    }
    await look("19b-back-closed", "Back from the first: closed, the eye where it was");
    // ×.
    await reopen("reopened for ×");
    await kept("for ×");
    await press(".place-insp-shut", "× with the eye kept");
    {
      const s = await now();
      check(!s.following && s.inspected.ref === null, "× closes and lets the eye go");
    }
    // A drag over the land: the eye let go, the inspector left open.
    await reopen("reopened for a drag");
    await kept("for a drag");
    {
      const vp = page.viewportSize()!,
        y = vp.height * 0.3;
      await page.mouse.move(vp.width * 0.3, y);
      await page.mouse.down();
      for (let s = 1; s <= 6; s++) await page.mouse.move(vp.width * (0.3 + s * 0.05), y + s * 4);
      await page.mouse.up();
      await page.waitForTimeout(500);
      const s = await now();
      check(!s.following && s.inspected.ref === ins.ref, "a drag over the land lets the eye go");
    }
    // To another (as a thought's source or a friend's name leads), then Back to the first.
    const other = await k<string | null>(
      `globalThis.causalis.client.query({ type: "place.people", args: { ref: ${JSON.stringify(town.ref)}, occ: null } }).then((s) => { const r = s?.rows.find((r) => \`plc:${town.ref}:\${r.id}\` !== ${JSON.stringify(ins.ref)}); return r ? \`plc:${town.ref}:\${r.id}\` : null; })`,
    );
    if (other) {
      await kept("before going to another");
      await k(`globalThis.causalis.place.inspect(${JSON.stringify(other)})`);
      await until("the other inspected", async () => (await now()).inspected.ref === other, 8000);
      await page.waitForTimeout(600);
      await look("19c-to-another", "another inspected, Back to the first");
      say(`back key: ${await text(".place-insp-back")}`);
      await press(".place-insp-back", "‹ Back to the first");
      await until("Back to the first", async () => (await now()).inspected.ref === ins.ref, 8000);
      check(!(await now()).following, "Back from another: the eye let go");
      check(
        !(await k<boolean>(`document.querySelector(".place-insp-ahead")?.disabled ?? true`)),
        "Forward is lit, the one gone back from ahead",
      );
      await press(".place-insp-ahead", "› Forward to the other again");
      await until("Forward to the other", async () => (await now()).inspected.ref === other, 8000);
      await look("19d-forward", "Forward: the other again");
      check(
        await k<boolean>(`document.querySelector(".place-insp-ahead")?.disabled ?? false`),
        "Forward greyed, nothing ahead",
      );
      await press(".place-insp-back", "‹ Back to the first again");
      await until(
        "Back to the first again",
        async () => (await now()).inspected.ref === ins.ref,
        8000,
      );
      // Escape: closed, the eye let go.
      await kept("for Escape");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
      {
        const s = await now();
        check(!s.following && s.inspected.ref === null, "Escape lets the eye go and closes");
      }
      // A tap on the bare ground: closed, the eye let go. (Well clear of anyone: a tap within TAP_REACH, 44 px, of one
      // chooses them, and they walk while it is found. On the scene's canvas, not a portrait's: at desk the first spot
      // found was the inspector's portrait, docked at the left, and the click met it, not the town.)
      await reopen("reopened for a tap on the ground");
      await kept("for a tap on the ground");
      const bare = await k<{ x: number; y: number } | null>(
        `(() => { const c = globalThis.causalis, W = innerWidth, H = innerHeight; for (let y = H * 0.2; y < H * 0.6; y += 23) for (let x = 20; x < W - 20; x += 29) { { const e = document.elementFromPoint(x, y); if (e?.tagName !== "CANVAS" || e.closest(".place-insp, .place-sheet, .place-hud")) continue; } let near = false; const n = c.planNow().people.length; for (let i = 0; i < n && !near; i++) { const p = c.personOnScreen(i); if (p && Math.hypot(p.x - x, p.y - y) < 70) near = true; } if (!near) return { x, y }; } return null; })()`,
      );
      if (bare) {
        await tap(bare.x, bare.y);
        await page.waitForTimeout(600);
        const s = await now();
        check(!s.following, "a tap beside them on the town lets the eye go");
        // (Where a lot lay under it, that lot is opened instead.)
        if (/^plcl:/.test(s.inspected.ref ?? "")) say("the tap met a lot: it opened");
        else check(s.inspected.ref === null, "a tap on the bare ground closes");
      } else say("no bare ground on the screen to tap");
    } else say("no other of its people to go to");
  }
  // A building's inspector.
  const lot = await k<number | null>(
    `globalThis.causalis.client.query({ type: "place.work", args: { ref: ${JSON.stringify(town.ref)} } }).then((s) => s?.buildings[0]?.lot ?? null)`,
  );
  if (lot !== null) {
    await k(`globalThis.causalis.place.inspect(${JSON.stringify(`plcl:${town.ref}:${lot + 3}`)})`);
    await until("a building's inspector", async () => (await text(".place-insp-body")).length > 0);
    await page.waitForTimeout(900);
    say(`building: ${(await text(".place-insp")).slice(0, 400)}`);
    say(`the building's first answer came ${(await inspected()).answered} ms after it was asked`);
    await look("20-insp-lot", "a building inspected");
    // (How warm it keeps those in it: P5.)
    check((await shown(".place-insp-warmth")) > 0, "a building's warmth told on its page");
    // Its zone (O2): made a meeting place by its key, the page saying so; the Zones overlay below shows it.
    check((await shown(".place-insp-zones .place-chip")) >= 2, "a lot's page has its zone keys");
    // (On a phone the page opens peeked, its zone keys below the fold: raised and scrolled to, as a finger would.)
    await k('globalThis.causalis.place.inspectHeight("half")');
    await page.waitForTimeout(400);
    await k(
      'document.querySelector(".place-insp-zones .place-chip:nth-child(2)")?.scrollIntoView({ block: "center" })',
    );
    await page.waitForTimeout(300);
    await press(".place-insp-zones .place-chip:nth-child(2)", "Meeting place, on the lot's page");
    await until(
      "the lot zoned a meeting place",
      async () => /A meeting place/.test(await text(".place-insp-body")),
      8000,
    );
    say(`zoned: ${(await text(".place-insp-body")).match(/A meeting place[^.]*\./)?.[0] ?? ""}`);
    check(/Ground: /.test(await text(".place-insp-body")), "a lot's page says what its ground is");
    await look("20b-insp-zone", "a lot zoned a meeting place");
    // The guard's post (O7): posted here by its key, the page saying what it watches; and back to the square.
    await k('document.querySelector(".place-insp-post")?.scrollIntoView({ block: "center" })');
    await page.waitForTimeout(300);
    await press(".place-insp-post", "Post the guard here, on the lot's page");
    await until(
      "the lot made the guard's post",
      async () => /The guard's post by your order/.test(await text(".place-insp-body")),
      8000,
    );
    check(
      /The guard's post by your order/.test(await text(".place-insp-body")),
      "a lot posted says it is the guard's post",
    );
    say(
      `posted: ${(await text(".place-insp-body")).match(/The guard's post by your order[^.]*\.[^.]*\./)?.[0] ?? ""}`,
    );
    await look("20b2-insp-post", "a lot made the guard's post");
    await k('document.querySelector(".place-insp-post")?.scrollIntoView({ block: "center" })');
    await page.waitForTimeout(300);
    await press(".place-insp-post", "the guard's post, back to the square");
    await until(
      "the post let go",
      async () => !/The guard's post by your order/.test(await text(".place-insp-body")),
      8000,
    );
    // Inside it (O3): its plan on its tiles; one of those there opened from it, and Back to the plan, and to the lot.
    await k('document.querySelector(".place-insp-inside")?.scrollIntoView({ block: "center" })');
    await page.waitForTimeout(300);
    await press(".place-insp-inside", "Inside ▸, on the lot's page");
    await until("the plan inside", async () => (await shown(".place-inside-plan")) > 0, 8000);
    await page.waitForTimeout(600);
    say(`inside: ${(await text(".place-insp-body")).slice(0, 300)}`);
    check((await shown(".place-inside-plan")) > 0, "the plan inside is drawn");
    await look("20c-inside", "inside a building, on its tiles");
    // (No one there now, as at night: a home's inside, where its household is, its people opened from it.)
    let homeToo = false;
    if ((await shown(".place-insp-people .place-insp-person")) === 0) {
      const home = await k<number | null>(
        `globalThis.causalis.client.query({ type: "place.overlay", args: { ref: ${JSON.stringify(town.ref)}, of: "room" } }).then((o) => o?.lots?.find((l) => /^[1-9]/.test(l.words))?.lot ?? null)`,
      );
      if (home !== null) {
        await k(
          `globalThis.causalis.place.inspect(${JSON.stringify(`plci:${town.ref}:${home + 3}`)})`,
        );
        homeToo = true;
        await until(
          "a home's plan",
          async () => (await shown(".place-insp-people .place-insp-person")) > 0,
          8000,
        );
        await page.waitForTimeout(600);
        await look("20d-inside-home", "inside a home, its household there");
      }
    }
    if ((await shown(".place-insp-people .place-insp-person")) > 0) {
      await k(
        'document.querySelector(".place-insp-people .place-insp-person")?.scrollIntoView({ block: "center" })',
      );
      await page.waitForTimeout(300);
      await press(".place-insp-people .place-insp-person", "one of those inside");
      await until("their page", async () => (await shown(".place-inside-plan")) === 0, 8000);
      await press(".place-insp-back", "‹ Back to the plan inside");
      await until("the plan again", async () => (await shown(".place-inside-plan")) > 0, 8000);
      check((await shown(".place-inside-plan")) > 0, "Back from one inside comes to the plan");
      await press(".place-insp-ahead", "› Forward to them again");
      await until("their page again", async () => (await shown(".place-inside-plan")) === 0, 8000);
      check((await shown(".place-inside-plan")) === 0, "Forward goes to them again");
      await press(".place-insp-back", "‹ Back to the plan");
      await until("the plan once more", async () => (await shown(".place-inside-plan")) > 0, 8000);
    } else say("no one inside now: none to open from the plan");
    if (homeToo) await press(".place-insp-back", "‹ Back from the home to the building's plan");
    await press(".place-insp-back", "‹ Back to the lot's page");
    await until(
      "the lot's page",
      async () => /Ground: /.test(await text(".place-insp-body")),
      8000,
    );
    check(
      /Ground: /.test(await text(".place-insp-body")),
      "Back from inside comes to the lot's page",
    );
    // Its things (O5): one kept in a home opened from its plan, on its own page; its holder a tap away; Back and Forward.
    const kept = await k<number | null>(
      `globalThis.causalis.client.query({ type: "place.overlay", args: { ref: ${JSON.stringify(town.ref)}, of: "room" } }).then((o) => o?.lots?.find((l) => /^[1-9]/.test(l.words))?.lot ?? null)`,
    );
    const kind = () => k<string>('document.querySelector(".place-insp")?.dataset.kind ?? ""');
    if (kept !== null) {
      await k(
        `globalThis.causalis.place.inspect(${JSON.stringify(`plci:${town.ref}:${kept + 3}`)})`,
      );
      await until("a home's things", async () => (await shown(".place-inside-item")) > 0, 8000);
    }
    if (kept !== null && (await shown(".place-inside-item")) > 0) {
      await k('document.querySelector(".place-inside-item")?.scrollIntoView({ block: "center" })');
      await page.waitForTimeout(300);
      await press(".place-inside-item", "a thing kept in the home");
      await until("the thing's page", async () => (await kind()) === "item", 8000);
      await page.waitForTimeout(600);
      say(`thing: ${(await text(".place-insp")).slice(0, 400)}`);
      check(
        /Held by/.test(await text(".place-insp-body")) &&
          (await shown(".place-insp-body .place-meter")) > 0,
        "a thing's page says who holds it and how worn it is",
      );
      await look("20e-item", "a thing on its own page");
      // (Its wear's words whole within the page, wrapped where they must be, not cut at its edge: U2.)
      const worn = await k<{ right: number; edge: number; cut: boolean } | null>(
        `(() => { const v = document.querySelector(".place-insp-wear .place-insp-value"), b = document.querySelector(".place-insp-body"); if (!v || !b) return null; const r = v.getBoundingClientRect(); return { right: r.right, edge: b.getBoundingClientRect().right, cut: v.scrollWidth > v.clientWidth + 1 }; })()`,
      );
      check(
        !!worn && !worn.cut && worn.right <= worn.edge + 0.5,
        `a thing's wear said whole on its page (${JSON.stringify(worn)})`,
      );
      const holder = await k<string | null>(
        `(() => { const l = [...document.querySelectorAll(".place-insp-facts .place-insp-label")].find((e) => e.textContent === "Held by"); return l?.nextElementSibling?.getAttribute("data-ref") ?? null; })()`,
      );
      check(!!holder, "its holder is a key");
      if (holder) {
        const sel = `.place-insp-facts .place-link[data-ref="${holder}"]`;
        await k(
          `document.querySelector(${JSON.stringify(sel)})?.scrollIntoView({ block: "center" })`,
        );
        await page.waitForTimeout(300);
        await press(sel, "its holder, on the thing's page");
        await until("its holder's page", async () => (await kind()) === "person", 8000);
        await press(".place-insp-back", "‹ Back to the thing");
        await until("the thing again", async () => (await kind()) === "item", 8000);
        check((await kind()) === "item", "Back from its holder comes to the thing");
        await press(".place-insp-ahead", "› Forward to its holder again");
        await until("its holder again", async () => (await kind()) === "person", 8000);
        check((await kind()) === "person", "Forward goes to its holder again");
        await press(".place-insp-back", "‹ Back to the thing once more");
        await until("the thing once more", async () => (await kind()) === "item", 8000);
      }
      await press(".place-insp-back", "‹ Back to the home's plan");
      await until("the home's plan", async () => (await kind()) === "inside", 8000);
      check((await kind()) === "inside", "Back from a thing comes to the plan it was kept in");
      await press(".place-insp-back", "‹ Back to the lot's page from the home");
      await until(
        "the lot's page again",
        async () => /Ground: /.test(await text(".place-insp-body")),
        8000,
      );
    } else say("no home with its things to open");
    // Its fields and flock (O6): from the fields' page, out in them; one out there opened, Back and Forward, Back to it.
    await k(`globalThis.causalis.place.inspect(${JSON.stringify(`plcl:${town.ref}:1`)})`);
    await until("the fields' page", async () => (await shown(".place-insp-inside")) > 0, 8000);
    await k('document.querySelector(".place-insp-inside")?.scrollIntoView({ block: "center" })');
    await page.waitForTimeout(300);
    await press(".place-insp-inside", "Out in the fields ▸, on the fields' page");
    await until("the fields laid out", async () => (await kind()) === "fields", 8000);
    await page.waitForTimeout(600);
    say(`fields: ${(await text(".place-insp")).slice(0, 400)}`);
    check(
      (await shown(".place-fields-plan")) > 0 && (await shown(".place-fields-field")) > 0,
      "the fields are drawn off the town's plan",
    );
    await look("20f-fields", "the fields and the flock");
    if ((await shown(".place-insp-people .place-insp-person")) > 0) {
      await k(
        'document.querySelector(".place-insp-people .place-insp-person")?.scrollIntoView({ block: "center" })',
      );
      await page.waitForTimeout(300);
      await press(".place-insp-people .place-insp-person", "one out in the fields");
      await until("their page", async () => (await kind()) === "person", 8000);
      await press(".place-insp-back", "‹ Back to the fields");
      await until("the fields again", async () => (await kind()) === "fields", 8000);
      check((await kind()) === "fields", "Back from one out there comes to the fields");
      await press(".place-insp-ahead", "› Forward to them again");
      await until("them again", async () => (await kind()) === "person", 8000);
      check((await kind()) === "person", "Forward goes to them again");
      await press(".place-insp-back", "‹ Back to the fields once more");
      await until("the fields once more", async () => (await kind()) === "fields", 8000);
    } else say("no one out in the fields now");
    await press(".place-insp-back", "‹ Back to the fields' page");
    await until("the fields' page again", async () => (await kind()) === "lot", 8000);
    check((await kind()) === "lot", "Back from the fields comes to their page");
    // Below the town (O8): from the square's page; its ground cut through, its water and wells, its lodes; Back to it.
    await k(`globalThis.causalis.place.inspect(${JSON.stringify(`plcl:${town.ref}:0`)})`);
    await until("the square's page", async () => (await shown(".place-insp-below")) > 0, 8000);
    await k('document.querySelector(".place-insp-below")?.scrollIntoView({ block: "center" })');
    await page.waitForTimeout(300);
    await press(".place-insp-below", "Below ground ▸, on the square's page");
    await until("below the town", async () => (await kind()) === "below", 8000);
    await page.waitForTimeout(600);
    say(`below: ${(await text(".place-insp")).slice(0, 400)}`);
    check(
      (await shown(".place-below-cut")) > 0 && /mm of rain/.test(await text(".place-insp-body")),
      "below the town: its ground cut through, its water said",
    );
    await look("20g-below", "below the town");
    // Its ground level by level (R8): a level down, and Back to below the town.
    await k('document.querySelector(".place-insp-levels")?.scrollIntoView({ block: "center" })');
    await page.waitForTimeout(300);
    await press(".place-insp-levels", "Its ground, level by level ▸, below the town");
    await until("its levels", async () => (await kind()) === "levels", 8000);
    await page.waitForTimeout(400);
    const first = await text(".place-levels-label");
    await press(".place-levels-down", "▼ the level below");
    await page.waitForTimeout(300);
    const second = await text(".place-levels-label");
    say(`levels: ${first} → ${second}; ${(await text(".place-insp-body")).slice(0, 240)}`);
    check(first !== second && /^2 of /.test(second), "a level down, its own");
    await look("20q-levels", "the town's ground, a level down");
    await press(".place-insp-back", "‹ Back to below the town from its levels");
    await until("below the town again", async () => (await kind()) === "below", 8000);
    check((await kind()) === "below", "Back from its levels comes to below the town");
    // What now? (G3): from the menu, a page of the inspector's with one to three things, each with somewhere to go.
    {
      await press(".place-menu-key", "the menu, for What now?");
      await page.waitForTimeout(300);
      await press(".place-menu-now", "💡 What now?, from the menu");
      await until("what now", async () => (await kind()) === "whatnow", 8000);
      const tips = await shown(".place-tip");
      say(`what now: ${(await text(".place-insp-body")).slice(0, 300)}`);
      check(tips >= 1 && tips <= 3, "one to three things worth doing next");
      check(
        (await shown(".place-tip-go")) +
          (await shown(".place-tip-open")) +
          (await shown(".place-tip-sheet")) >=
          tips,
        "each with somewhere to go",
      );
      await look("20j-whatnow", "what now");
      await press(".place-insp-back", "‹ Back from what now");
      await page.waitForTimeout(400);
    }
    // (Its lessons asked for from the menu, on a phone in the sheet's place, and put back by a sheet; ticks kept.)
    if (phone) {
      await press(".place-menu-key", "the menu, for the lessons");
      await page.waitForTimeout(300);
      await press(".place-menu-lessons", "🎓 Lessons, from the menu");
      await page.waitForTimeout(400);
      check((await shown(".place-guide")) > 0, "the lessons out on a phone when asked for");
      const ticked = await k<string[]>(
        '[...document.querySelectorAll(".place-guide-lesson.done")].map((e) => e.dataset.lesson)',
      );
      say(`lessons done: ${ticked.join(", ")}`);
      for (const l of ["enter", "person", "back", "follow", "mood"])
        check(ticked.includes(l), `the lesson "${l}" ticked off by doing it`);
      await look("20h-lessons", "the lessons on a phone, asked for");
      await guideFooter("on a phone");
      await press(".place-guide-shut", "× the lessons put away");
      await page.waitForTimeout(300);
      check((await shown(".place-guide")) === 0, "the lessons put away");
    }
    await press(".place-insp-back", "‹ Back to the square's page");
    await until("the square's page again", async () => (await kind()) === "lot", 8000);
    check((await kind()) === "lot", "Back from below comes to the square's page");
    // Its legends (O9): from the square's page; a work on its own page from them, Back and Forward; Back to the square's.
    await k('document.querySelector(".place-insp-legends")?.scrollIntoView({ block: "center" })');
    await page.waitForTimeout(300);
    await press(".place-insp-legends", "Its legends ▸, on the square's page");
    await until("its legends", async () => (await kind()) === "legends", 8000);
    await page.waitForTimeout(600);
    say(`legends: ${(await text(".place-insp")).slice(0, 400)}`);
    check((await shown(".place-legend-line")) > 0, "its legends tell what befell it");
    await look("20h-legends", "the town's legends");
    if ((await shown("button.place-legend-work")) > 0) {
      await k(
        'document.querySelector("button.place-legend-work")?.scrollIntoView({ block: "center" })',
      );
      await page.waitForTimeout(300);
      await press("button.place-legend-work", "one of its works, in its legends");
      await until("the work's page", async () => (await kind()) === "work", 8000);
      await page.waitForTimeout(400);
      say(`work: ${(await text(".place-insp")).slice(0, 300)}`);
      await look("20i-work", "a work on its own page");
      await press(".place-insp-back", "‹ Back to its legends");
      await until("its legends again", async () => (await kind()) === "legends", 8000);
      check((await kind()) === "legends", "Back from a work comes to the legends");
      await press(".place-insp-ahead", "› Forward to the work again");
      await until("the work again", async () => (await kind()) === "work", 8000);
      check((await kind()) === "work", "Forward goes to the work again");
      await press(".place-insp-back", "‹ Back to its legends once more");
      await until("its legends once more", async () => (await kind()) === "legends", 8000);
    } else say("no work of the town's kept yet");
    await press(".place-insp-back", "‹ Back to the square's page from its legends");
    await until("the square's page once more", async () => (await kind()) === "lot", 8000);
    check((await kind()) === "lot", "Back from its legends comes to the square's page");
    // Its gate (P2): from the square's page; shut to newcomers and opened again by its key; Back to the square's.
    await k('document.querySelector(".place-insp-gate")?.scrollIntoView({ block: "center" })');
    await page.waitForTimeout(300);
    await press(".place-insp-gate", "At the gate ▸, on the square's page");
    await until("its gate", async () => (await kind()) === "gate", 8000);
    await page.waitForTimeout(600);
    say(`gate: ${(await text(".place-insp")).slice(0, 400)}`);
    await look("20k-gate", "who comes to the town's gate");
    if ((await shown(".place-insp-gate-key")) > 0) {
      const pressed = async () =>
        await k('document.querySelector(".place-insp-gate-key")?.getAttribute("aria-pressed")');
      await press(".place-insp-gate-key", "Shut the gate to newcomers");
      await until("the gate shut", async () => (await pressed()) === "true", 8000);
      check((await pressed()) === "true", "its gate shut by its key");
      await press(".place-insp-gate-key", "Open the gate to newcomers");
      await until("the gate open", async () => (await pressed()) === "false", 8000);
      check((await pressed()) === "false", "its gate opened again by its key");
    } else say("no order can be given the town watched");
    await press(".place-insp-back", "‹ Back to the square's page from its gate");
    await until("the square's page from its gate", async () => (await kind()) === "lot", 8000);
    check((await kind()) === "lot", "Back from its gate comes to the square's page");
    // Its bound (P6): from the square's page, and Back.
    await k('document.querySelector(".place-insp-bound")?.scrollIntoView({ block: "center" })');
    await page.waitForTimeout(300);
    await press(".place-insp-bound", "The bound ▸, on the square's page");
    await until("its bound", async () => (await kind()) === "bound", 8000);
    await page.waitForTimeout(400);
    say(`bound: ${(await text(".place-insp")).slice(0, 300)}`);
    await look("20l-bound", "the town's bound");
    await press(".place-insp-back", "‹ Back to the square's page from its bound");
    await until("the square's page from its bound", async () => (await kind()) === "lot", 8000);
    check((await kind()) === "lot", "Back from its bound comes to the square's page");
    // Its faith and rank (P7): from the square's page, and Back.
    await k('document.querySelector(".place-insp-faith")?.scrollIntoView({ block: "center" })');
    await page.waitForTimeout(300);
    await press(".place-insp-faith", "Faith and rank ▸, on the square's page");
    await until("its faith", async () => (await kind()) === "faith", 8000);
    await page.waitForTimeout(400);
    say(`faith: ${(await text(".place-insp")).slice(0, 300)}`);
    check((await shown(".place-insp-rite")) > 0, "its rites told");
    await look("20m-faith", "the town's faith and rank");
    await press(".place-insp-back", "‹ Back to the square's page from its faith");
    await until("the square's page from its faith", async () => (await kind()) === "lot", 8000);
    check((await kind()) === "lot", "Back from its faith comes to the square's page");
    // What it lives on (R5): from the square's page, and Back.
    await k('document.querySelector(".place-insp-making")?.scrollIntoView({ block: "center" })');
    await page.waitForTimeout(300);
    await press(".place-insp-making", "What it lives on ▸, on the square's page");
    await until("what it lives on", async () => (await kind()) === "making", 8000);
    await page.waitForTimeout(400);
    say(`making: ${(await text(".place-insp")).slice(0, 300)}`);
    check((await shown(".place-insp-stuff-swatch")) >= 1, "all it holds, by its stuff");
    await look("20o-making", "what the town lives on");
    await press(".place-insp-back", "‹ Back to the square's page from what it lives on");
    await until(
      "the square's page from what it lives on",
      async () => (await kind()) === "lot",
      8000,
    );
    check((await kind()) === "lot", "Back from what it lives on comes to the square's page");
    // Its works and orders (R6): from the square's page, and Back.
    await k('document.querySelector(".place-insp-civic")?.scrollIntoView({ block: "center" })');
    await page.waitForTimeout(300);
    await press(".place-insp-civic", "Its works and orders ▸, on the square's page");
    await until("its works and orders", async () => (await kind()) === "civic", 8000);
    await page.waitForTimeout(400);
    say(`civic: ${(await text(".place-insp")).slice(0, 300)}`);
    await look("20p-civic", "the town's works and orders");
    await press(".place-insp-back", "‹ Back to the square's page from its works and orders");
    await until("the square's page from its works", async () => (await kind()) === "lot", 8000);
    check((await kind()) === "lot", "Back from its works and orders comes to the square's page");
    // Its beasts and power (R9): from the square's page, and Back.
    await k('document.querySelector(".place-insp-beasts")?.scrollIntoView({ block: "center" })');
    await page.waitForTimeout(300);
    await press(".place-insp-beasts", "Beasts and power ▸, on the square's page");
    await until("its beasts and power", async () => (await kind()) === "beasts", 8000);
    await page.waitForTimeout(400);
    say(`beasts: ${(await text(".place-insp")).slice(0, 300)}`);
    check((await shown(".place-insp-rung")) === 4, "the four rungs of what drives its works");
    await look("20r-beasts", "the town's beasts and power");
    await press(".place-insp-back", "‹ Back to the square's page from its beasts and power");
    await until("the square's page from its beasts", async () => (await kind()) === "lot", 8000);
    check((await kind()) === "lot", "Back from its beasts and power comes to the square's page");
    // One of its dead (R1): the Log's names lead to them; their page outlives them, and Back comes again.
    {
      await press('.place-tab[data-tab="log"]', "the log tab, for one of its dead");
      // (What the Log is, in plain words, G2: its sheet's ?, a page of the inspector's.)
      {
        await until("the log sheet's ?", async () => (await shown(".place-sheet-help")) > 0, 8000);
        await press(".place-sheet-help", "? on the Log");
        await until("what the Log is", async () => (await kind()) === "help", 8000);
        check(/Log/.test(await text(".place-insp-names")), "what the Log is, in plain words");
        await look("20i-sheet-help", "what a sheet is, over it");
        await press(".place-insp-shut", "× what the Log is");
        await page.waitForTimeout(300);
      }
      await until("the log sheet", async () => !/^…$/.test(await text(".place-sheet-body")));
      await page.waitForTimeout(500);
      const refs = await k<string[]>(
        `[...document.querySelectorAll('.place-log-names .place-link[data-ref^="plc:"]')].map((b) => b.dataset.ref).slice(0, 40)`,
      );
      // (Its rows' Go to keys, R7: to whom each was of, and where.)
      const gos = await shown(".place-log-go");
      say(`the log's Go to keys: ${gos}`);
      check(gos > 0, "the log's rows have Go to keys");
      if (gos > 0) {
        // (Its keys to different places in turn, up to four: a row of where the eye already is sends it nowhere, and in a fire
        // every row is of the burning lot the eye was sent to. U2.)
        let moved = false,
          read = true,
          tried = 0;
        for (let i = 0; i < Math.min(gos, 4) && !moved; i++) {
          await k(
            `(() => { for (const x of document.querySelectorAll("[data-look-try]")) x.removeAttribute("data-look-try"); const seen = new Set(), keys = [...document.querySelectorAll(".place-log-go")].filter((e) => { const r = e.getBoundingClientRect(), w = e.getAttribute("aria-label"); if (!(r.width > 0 && r.height > 0) || seen.has(w)) return false; seen.add(w); return true; }), e = keys[${i}]; if (e) e.setAttribute("data-look-try", "1"); })()`,
          );
          if (!(await shown('[data-look-try="1"]'))) break;
          const was = await eye();
          await press('[data-look-try="1"]', `🎯 Go to, on the log's key ${i + 1}`);
          await page.waitForTimeout(1400);
          const now = await eye();
          tried++;
          say(
            `the log's key ${i + 1}: ${await k<string>('document.querySelector("[data-look-try]")?.getAttribute("aria-label") ?? "(gone)"')}; the eye ${JSON.stringify(was)} to ${JSON.stringify(now)}; following ${await k<string>('String(document.querySelector(".place-insp-follow")?.classList.contains("on"))')}`,
          );
          if (!was || !now) read = false;
          else if (Math.hypot(now[0] - was[0], now[1] - was[1]) > 0.01) moved = true;
        }
        if (read) check(moved, `a row's Go to sends the eye (${tried} of its keys tried)`);
        else say("the eye's place could not be read");
      }
      await press('.place-tab[data-tab="log"]', "the log tab again, to close it");
      let found = false;
      for (const ref of refs) {
        await k(`globalThis.causalis.place.inspect(${JSON.stringify(ref)})`);
        await page.waitForTimeout(250);
        if ((await kind()) === "dead") {
          found = true;
          break;
        }
      }
      if (found) {
        await page.waitForTimeout(400);
        say(`dead: ${(await text(".place-insp")).slice(0, 300)}`);
        check(
          /^Died day \d+ of year \d+/.test(await text(".place-insp-sub")),
          "when they died, on their page",
        );
        await look("20n-dead", "one of its dead, on a page that outlives them");
        const kin = await shown(".place-insp-kin button");
        if (kin > 0) {
          await press(
            ".place-insp-kin button",
            "one of their kin or those they knew, from the page of the dead",
          );
          await page.waitForTimeout(500);
          await press(".place-insp-back", "‹ Back to the page of the dead");
          await until("the page of the dead again", async () => (await kind()) === "dead", 8000);
          check((await kind()) === "dead", "Back from their kin comes to the page of the dead");
        } else say("none of their kin or those they knew has a page");
      } else say("none of the log's names is one of its dead kept for their page");
    }
    // Raised by hand (P1): a home's lot page offers what the town could raise on its lots; asked there, it is offered no more.
    if (kept !== null) {
      await k(
        `globalThis.causalis.place.inspect(${JSON.stringify(`plcl:${town.ref}:${kept + 3}`)})`,
      );
      await until("a home's lot page", async () => (await kind()) === "lot", 8000);
      await k('globalThis.causalis.place.inspectHeight("half")');
      await page.waitForTimeout(600);
      const offered = await shown(".place-insp-raise-key");
      if (offered > 0) {
        say(`raise here: ${(await text(".place-insp-raise")).slice(0, 300)}`);
        await k(
          'document.querySelector(".place-insp-raise-key")?.scrollIntoView({ block: "center" })',
        );
        await page.waitForTimeout(300);
        await look("20j-raise-here", "what could be raised on a home's lots");
        // (Where it clears homes it asks first, saying what it clears, and nothing is asked of the town till Raise. U2.)
        const clears = /clears the homes? of/.test(
          await text(".place-insp-raise .place-build-row"),
        );
        await press(".place-insp-raise-key", "Raise here, on a home's lot page");
        await page.waitForTimeout(300);
        if (clears) {
          const ask = await text(".place-insp-raise-sure");
          check(
            (await shown(".place-insp-raise-yes")) === 1 &&
              (await shown(".place-insp-raise-no")) === 1 &&
              /^Clears \d+ households?'s? homes?: raise /.test(ask),
            `Raise here asks first, saying what it clears: "${ask}"`,
          );
          const keys = await k<number[]>(
            '[...document.querySelectorAll(".place-insp-raise-yes, .place-insp-raise-no")].map((e) => Math.min(e.getBoundingClientRect().width, e.getBoundingClientRect().height))',
          );
          check(
            keys.length === 2 && keys.every((x) => x >= 44),
            `its Raise and Cancel keys 44 px: ${keys.join(", ")}`,
          );
          await look("20j2-raise-sure", "Raise here asking first what it clears");
          // (Cancel clears nothing: the offer stands as it was.)
          await press(".place-insp-raise-no", "Cancel, on Raise here's question");
          await page.waitForTimeout(400);
          check(
            (await shown(".place-insp-raise-key")) === offered &&
              (await shown(".place-insp-raise-sure")) === 0,
            "cancelled: nothing cleared, the offer as it was",
          );
          await press(".place-insp-raise-key", "Raise here again");
          await page.waitForTimeout(300);
          await press(".place-insp-raise-yes", "Raise, clearing the homes it said");
        }
        await until(
          "the asking taken",
          async () => (await shown(".place-insp-raise-key")) < offered,
          8000,
        );
        check(
          (await shown(".place-insp-raise-key")) < offered,
          "raised there: no longer offered on its lots",
        );
      } else say("nothing the town could raise on this home's lots");
    }
    await k('globalThis.causalis.place.inspectHeight("peek")');
  }
  // Where a good is made, with its bills (N10), and the market, with what it takes; at half height.
  const made = await k<{ ref: string | null; market: number | null }>(
    `globalThis.causalis.client.query({ type: "place.work", args: { ref: ${JSON.stringify(town.ref)} } }).then((s) => ({ ref: s?.bills.find((b) => b.ref)?.ref ?? null, market: s?.buildings.find((b) => /market/.test(b.name))?.lot ?? null }))`,
  );
  for (const [ref, still, words] of [
    [made.ref, "20b-insp-making", "a building where a good is made, its bills"],
    [
      made.market !== null ? `plcl:${town.ref}:${made.market + 3}` : null,
      "20c-insp-market",
      "the market, what it takes",
    ],
  ] as const) {
    if (!ref) continue;
    await k(`globalThis.causalis.place.inspect(${JSON.stringify(ref)})`);
    await until(words, async () => (await text(".place-insp-body")).length > 0);
    await k(`globalThis.causalis.place.inspectHeight("full")`);
    await page.waitForTimeout(900);
    say(`${words}: ${(await text(".place-insp-body")).slice(0, 300)}`);
    await look(still, words);
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  check((await shown(".place-insp")) === 0, "Esc lets go of what was inspected");

  // The menu: sound, the ways, what now, the lessons, leaving.
  await press(".place-menu-key", "≡");
  check(
    (await shown(".place-menu-item")) === 5,
    "the menu has its five items: sound, the ways, what now, the lessons, leaving",
  );
  await look("06-menu", "the menu open");
  await press(".place-menu-key", "≡ again, to close it");

  // Every sheet.
  for (const tab of ["people", "stocks", "work", "build", "dangers", "log"]) {
    await press(`.place-tab[data-tab="${tab}"]`, `the ${tab} tab`);
    await until(`the ${tab} sheet`, async () => !/^…$/.test(await text(".place-sheet-body")));
    await page.waitForTimeout(700);
    say(`${tab}: ${(await text(".place-sheet-body")).slice(0, 300)}`);
    await look(`07-sheet-${tab}`, `the ${tab} sheet open`);
    // (The Log's Go to keys on the line of the name they are of, never wrapped away from it: U2.)
    if (tab === "log") {
      const apart = await k<string[]>(
        `[...document.querySelectorAll(".place-log-who")].flatMap((u) => { const n = u.querySelector(".place-link")?.getBoundingClientRect(); if (!n || !n.height) return []; return [...u.querySelectorAll(".place-log-go")].filter((g) => { const r = g.getBoundingClientRect(); return r.height > 0 && Math.abs(r.top + r.height / 2 - (n.top + n.height / 2)) > 8 && u.getBoundingClientRect().width < u.parentElement.getBoundingClientRect().width - 1; }).map(() => u.textContent ?? ""); })`,
      );
      check(
        apart.length === 0,
        `the Log's 🎯 keys beside their names (${apart.slice(0, 3).join(" | ")})`,
      );
    }
    // (The Work sheet's priorities grid, each kind's skill under its key.)
    if (tab === "work" && (await box(".place-grid-open"))) {
      // (Below the sheet's fold where its healer's line comes first: scrolled to, as a finger would.)
      await page.evaluate(() =>
        document.querySelector(".place-grid-open")?.scrollIntoView({ block: "center" }),
      );
      await page.waitForTimeout(300);
      await press(".place-grid-open", "the priorities grid");
      await page.waitForTimeout(900);
      say(`grid: ${(await text(".place-grid")).slice(0, 300)}`);
      await page.evaluate(() =>
        document.querySelector(".place-grid")?.scrollIntoView({ block: "start" }),
      );
      await page.waitForTimeout(300);
      check((await shown(".place-grid-lv")) > 0, "the grid tells each kind's skill");
      // (Its columns past the right edge told where there are any, and each name's full words on its key: U2.)
      const cue = await k<{ over: boolean; hint: string; named: boolean }>(
        `(() => { const g = document.querySelector(".place-grid"), h = document.querySelector(".place-grid-hint"), n = document.querySelector(".place-grid-rows .place-grid-row:not(.place-grid-head) .place-grid-name"); return { over: !!g && g.scrollWidth > g.clientWidth + 1, hint: h && !h.hidden && h.getBoundingClientRect().height > 0 ? h.textContent : "", named: !!n && (n.title ?? "").length > 2 }; })()`,
      );
      check(
        !cue.over || /swipe/i.test(cue.hint),
        `the grid's columns past its edge told: "${cue.hint}"`,
      );
      check(cue.named, "each name in the grid whole on its key's title");
      await look("07b-grid", "the priorities grid, with skills");
      await page.evaluate(() =>
        document.querySelector(".place-grid-open")?.scrollIntoView({ block: "center" }),
      );
      await page.waitForTimeout(300);
      await press(".place-grid-open", "the priorities grid, closed");
    }
  }
  await press(".place-sheet-shut", "the sheet's close");

  // Its overlays: each laid on its lots, its legend under the pill; one with a sheet open beside it.
  await k("globalThis.causalis.closePage?.()");
  await press(".place-lens-key", "🗺 the overlays");
  for (const lens of ["needs", "mood", "room", "comfort", "work", "age", "danger", "zones"]) {
    await press(`.place-lens-chip[data-lens="${lens}"]`, `the ${lens} overlay`);
    await until(
      `the ${lens} overlay laid`,
      async () =>
        (await k<number>("globalThis.causalis.place.overlaid().lots")) > 0 ||
        /Nothing burns/.test(await text(".place-lens-legend")),
      8000,
    );
    await page.waitForTimeout(500);
    const laid = await k<{ lots: number; spots: unknown[] }>(
        "globalThis.causalis.place.overlaid()",
      ),
      n = laid.lots;
    say(
      `${lens} overlay: ${n} lots tinted on the ground, ${laid.spots.length} of them on the screen; legend "${await text(".place-lens-legend")}"`,
    );
    check(n > 0 || lens === "danger", `the ${lens} overlay tints its lots`);
    await look(`21-overlay-${lens}`, `the ${lens} overlay`);
  }
  await press('.place-tab[data-tab="people"]', "the People tab, an overlay shown");
  await page.waitForTimeout(800);
  await look("22-overlay-and-sheet", "an overlay with a sheet open");
  await press(".place-sheet-shut", "the sheet's close");
  await press(".place-lens-off", "× no overlay");
  // (The lot zoned above let go: the town as it was.)
  if (lot !== null)
    await k(`globalThis.causalis.place.order("place.zone", { lot: ${lot}, zone: null })`);
  check(
    (await k<number>("globalThis.causalis.place.overlaid().lots")) === 0,
    "no overlay once put away",
  );

  // The people bar's pins in the town's People sheet (asked 2026-11-26: "people i have pinned from that town should be in
  // the people tab"): one of its people pinned on the bar and one pinned who is no one of it; the Pinned chip first,
  // the one of it first in All, marked, followed in full; the other greyed under the chip; each let go of by its key.
  {
    const row = await k<{ ref: string; name: string; id: number } | null>(
      `globalThis.causalis.client.query({ type: "place.people", args: { ref: ${JSON.stringify(town.ref)}, occ: null } }).then((s) => { const r = s?.rows.find((x) => !x.ref.startsWith("plc:")) ?? s?.rows[3]; return r ? { ref: r.ref, name: r.name, id: r.id } : null; })`,
    );
    // (One who is elsewhere: the first the people bar puts before the world as a whole, of no town.)
    const far = await k<{ ref: string; name: string } | null>(
      `globalThis.causalis.client.query({ type: "people.bar", args: { cell: null, town: null, pins: [], followed: [] } }).then((r) => { const x = r?.people.find((y) => !y.gone && !y.ref.startsWith("plc:")); return x ? { ref: x.ref, name: x.name } : null; })`,
    );
    if (row && far) {
      await k(
        `(() => { const b = globalThis.causalis.barPins; for (const x of [...b.all]) b.off(x.ref); b.toggle(${JSON.stringify(row.ref)}, ${JSON.stringify(row.name)}); b.toggle(${JSON.stringify(far.ref)}, ${JSON.stringify(far.name)}); })()`,
      );
      await page.waitForTimeout(1200);
      await press('.place-tab[data-tab="people"]', "the People tab, two pinned");
      await page.waitForTimeout(1500);
      const ref = JSON.stringify(row.ref),
        fake = JSON.stringify(far.ref),
        chip = await text(".place-chip-pinned"),
        here = await k<number>(
          `globalThis.causalis.client.query({ type: "place.people", args: { ref: ${JSON.stringify(town.ref)}, occ: 102, pins: globalThis.causalis.barPins.all.map((x) => x.ref) } }).then((s) => s?.pinned ?? -1)`,
        ),
        bar = await k<number>("globalThis.causalis.barPins.all.length");
      say(
        `pinned: chip "${chip}", ${here} of its people pinned, ${bar} on the bar; first row "${(await text(".place-person-row")).slice(0, 60)}"`,
      );
      check(
        chip.endsWith(` ${here + 1}`),
        `the Pinned chip counts its pinned and the one elsewhere (${chip}; ${here} + 1)`,
      );
      check(
        await k<boolean>(
          `document.querySelector(".place-person-row")?.classList.contains("pinned") ?? false`,
        ),
        "the pinned first in All, marked",
      );
      await press(".place-chip-pinned", "📌 Pinned");
      await page.waitForTimeout(1500);
      check(
        await k<boolean>(
          `!!document.querySelector(\`.place-person[data-ref=\${JSON.stringify(${ref})}] .place-person-row.pinned\`)`,
        ),
        "under the chip: the one of it pinned on the bar",
      );
      check(
        (await shown(".place-away-row")) === 1 &&
          (await text(".place-away-row")).includes(far.name),
        `under the chip: the one elsewhere, greyed, with where they are (${await text(".place-away")})`,
      );
      await look("23-pinned", "the pinned, here and elsewhere");
      const tier = await k<string>(
        `globalThis.causalis.client.query({ type: "place.inspect", args: { ref: ${JSON.stringify(town.ref)}, of: ${JSON.stringify(`plc:${town.ref}:${row.id}`)} } }).then((x) => (x?.tier ? \`\${x.tier.pinned ? "pinned: " : ""}\${x.tier.words}\` : ""))`,
      );
      say(`the one pinned, as its tier reads: ${tier}`);
      check(/^pinned: .*full/i.test(tier), `the one pinned is followed in full, by word (${tier})`);
      await press(`.place-person[data-ref=${fake}] .place-row-unpin`, "📌✕ the one elsewhere");
      await page.waitForTimeout(1500);
      check((await shown(".place-away-row")) === 0, "the one elsewhere let go of");
      await press(`.place-person[data-ref=${ref}] .place-row-unpin`, "📌✕ the one of it");
      await page.waitForTimeout(1500);
      check(
        !(await k<boolean>(
          `globalThis.causalis.barPins.has(${ref}) || globalThis.causalis.barPins.has(${fake})`,
        )),
        "both off the people bar",
      );
      check(
        !(await k<boolean>(
          `!!document.querySelector(\`.place-person[data-ref=\${JSON.stringify(${ref})}]\`)`,
        )),
        "the one of it no longer under the chip",
      );
      await k(
        `[...document.querySelectorAll(".place-chip")].find((b) => /^All/.test(b.textContent ?? ""))?.click()`,
      );
      await page.waitForTimeout(600);
      await press(".place-sheet-shut", "the sheet's close");
    } else say("no one of it, or no one elsewhere, to pin");
  }

  // The night: its people still to be told apart.
  await toHour(22, 24, "the town's night");
  await page.waitForTimeout(1500);
  await look("08-night", "the town at night");
  await toHour(10, 12, "the town's morning");

  // Run by its head, then watched, then by hand again.
  await press(".place-mode", "how it is run");
  await look("09-choosing", "the ways shown from the bar");
  check((await shown(".place-welcome")) === 0, "no welcome again: it is shown once");
  await press('.place-mode-choice[data-mode="steward"]', "🏛 Its head runs it");
  await page.waitForTimeout(2500);
  await look("10-steward", "the town run by its head");
  await press(".place-mode", "how it is run");
  await press('.place-mode-choice[data-mode="watch"]', "👁 Watch it");
  await page.waitForTimeout(3000);
  await look("11-watch", "the town watched");
  // (Watched: one of its people tapped, the eye goes with them; Back lets it go and closes.)
  {
    const one = await k<{ x: number; y: number } | null>(
      `(() => { const c = globalThis.causalis, n = c.planNow().people.length, W = innerWidth, H = innerHeight; for (let i = 0; i < n; i++) { const p = c.personOnScreen(i); if (p && p.x > 8 && p.x < W - 8 && p.y > H * 0.15 && p.y < H * 0.6 && (() => { const e = document.elementFromPoint(p.x, p.y); return e?.tagName === "CANVAS" && !e.closest(".place-insp, .place-sheet, .place-hud"); })()) return { x: p.x, y: p.y }; } return null; })()`,
    );
    if (one) {
      await k("globalThis.causalis.place.inspect(null)");
      await tap(one.x, one.y);
      await until(
        "one watched inspected",
        async () => /^plc/.test((await inspected()).ref ?? ""),
        8000,
      );
      await page.waitForTimeout(800);
      check(
        (await k<{ following: boolean }>("globalThis.causalis.place.state()")).following,
        "watched: the eye goes with the one tapped",
      );
      await look("11b-watch-with", "the town watched, the eye with one of its people");
      await press(".place-insp-back", "‹ Back, watched");
      await page.waitForTimeout(800);
      const s = await k<{ following: boolean; inspected: { ref: string | null } }>(
        "globalThis.causalis.place.state()",
      );
      check(!s.following, "watched: Back lets the eye go");
      check(s.inspected.ref === null, `watched: Back from the first closes (${s.inspected.ref})`);
    } else say("watched: no one on the screen to tap");
  }
  await press(".place-mode", "how it is run");
  await press('.place-mode-choice[data-mode="hand"]', "✋ Run it");
  await page.waitForTimeout(800);

  // Left: the god game's chrome back.
  await press(".place-leave", "◂ Leave");
  await until("the town left", async () => !(await state()).on);
  await page.waitForTimeout(800);
  check((await shown(".place-bar")) === 0, "the mode's bar is away");
  // What befell it while it was run, told as the god game's chrome comes back (O1).
  {
    const told = await page
      .waitForSelector(".ran-note:not([hidden])", { timeout: 4000 })
      .then(() => true)
      .catch(() => false);
    say(`the note on leaving: ${told ? (await text(".ran-note")).slice(0, 200) : "none"}`);
    if (told) await look("12-left-note", "what befell it, told on leaving");
  }
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
