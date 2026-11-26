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
    press = async (selector: string, what: string): Promise<boolean> => {
      const at = await box(selector);
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
    v ? `${((v.tex + v.vb + v.ib) / 1048576).toFixed(1)} MB (textures ${(v.tex / 1048576).toFixed(1)}, meshes ${((v.vb + v.ib) / 1048576).toFixed(1)})` : "not told";
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
  await look("02-choose-on-entry", "the ways asked on entering");
  await press('.place-mode-choice[data-mode="hand"]', "✋ Run it");
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
    const c = await k<{ ms: number; frames: number }>("globalThis.causalis.place.uiCost()");
    await press('.place-pace[data-pace="0"]', "the pause");
    await k("globalThis.causalis.place.inspect(null)");
    say(
      `the mode's chrome: ${(c.ms / Math.max(1, c.frames)).toFixed(3)} ms a frame over ${c.frames} frames (its alerts, clock, sky, ring and name)`,
    );
    check(c.frames > 0 && c.ms / c.frames < 0.3, "the mode's chrome costs a frame under 0.3 ms");
  }
  await press(".place-alert", "the gravest alert");
  await page.waitForTimeout(1300);
  await look("05-alert-tapped", "an alert tapped: the eye gone there");
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
    // (A child has no orders to give.)
    if ((await shown(".place-insp-order")) > 0) {
      await press(".place-insp-order", "the inspector's Orders");
      await look("17-insp-orders", "a person's orders in the inspector");
      await press(".place-insp-order", "Orders, closed");
    } else say("the one inspected keeps no work: no orders to look at");
    // A sheet opened under it: the inspector above it, peeked.
    await press('.place-tab[data-tab="people"]', "the People tab, the inspector open");
    await page.waitForTimeout(1200);
    await look("18-insp-and-sheet", "the inspector over a sheet");
    await press(".place-sheet-shut", "the sheet's close");
    await press(".place-insp-follow", "follow");
    await page.waitForTimeout(800);
    await look("19-insp-follow", "the eye kept with them");
    await press(".place-insp-follow", "follow, let go");
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
  }
  // Where a good is made, with its bills (N10), and the market, with what it takes; at half height.
  const made = await k<{ ref: string | null; market: number | null }>(
    `globalThis.causalis.client.query({ type: "place.work", args: { ref: ${JSON.stringify(town.ref)} } }).then((s) => ({ ref: s?.bills.find((b) => b.ref)?.ref ?? null, market: s?.buildings.find((b) => /market/.test(b.name))?.lot ?? null }))`,
  );
  for (const [ref, still, words] of [
    [made.ref, "20b-insp-making", "a building where a good is made, its bills"],
    [made.market !== null ? `plcl:${town.ref}:${made.market + 3}` : null, "20c-insp-market", "the market, what it takes"],
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

  // The menu: sound, the ways, leaving.
  await press(".place-menu-key", "≡");
  check((await shown(".place-menu-item")) === 3, "the menu has its three items");
  await look("06-menu", "the menu open");
  await press(".place-menu-key", "≡ again, to close it");

  // Every sheet.
  for (const tab of ["people", "stocks", "work", "build", "dangers", "log"]) {
    await press(`.place-tab[data-tab="${tab}"]`, `the ${tab} tab`);
    await until(`the ${tab} sheet`, async () => !/^…$/.test(await text(".place-sheet-body")));
    await page.waitForTimeout(700);
    say(`${tab}: ${(await text(".place-sheet-body")).slice(0, 300)}`);
    await look(`07-sheet-${tab}`, `the ${tab} sheet open`);
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
  for (const lens of ["needs", "mood", "room", "work", "age", "danger"]) {
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
  check(
    (await k<number>("globalThis.causalis.place.overlaid().lots")) === 0,
    "no overlay once put away",
  );

  // The night: its people still to be told apart.
  await toHour(22, 24, "the town's night");
  await page.waitForTimeout(1500);
  await look("08-night", "the town at night");
  await toHour(10, 12, "the town's morning");

  // Run by its head, then watched, then by hand again.
  await press(".place-mode", "how it is run");
  await look("09-choosing", "the ways shown from the bar");
  await press('.place-mode-choice[data-mode="steward"]', "🏛 Its head runs it");
  await page.waitForTimeout(2500);
  await look("10-steward", "the town run by its head");
  await press(".place-mode", "how it is run");
  await press('.place-mode-choice[data-mode="watch"]', "👁 Watch it");
  await page.waitForTimeout(3000);
  await look("11-watch", "the town watched");
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
