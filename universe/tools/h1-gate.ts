// node tools/h1-gate.ts [--ci] [--soft] [--shots dir] [--save file.save --universe earth|alien] [--young year] [--seed text] [--frames]: gate 102, a town asked (H1), at a phone's size.
// On a far save, else (as on CI) a young world run on:
//   1. the town's bar pressed by real touch: the sheet's words off the screen, what can be raised and put first;
//   2. a thing to raise pressed: the answer is its own page, by name, with why; ⌖ Go to brings the eye to it;
//   3. the clock let run at a real speed: the site in the pixels about its place on the screen, and more of it as it goes; someone at work on it, pressed; the site pressed: its page says who, how far, what it took;
//   4. let finish: its flag is gone from the same pixels; its page says so; a stone pressed, a song read, The Years keep it;
//   5. a priority asked: more at it in a day, what they say;
//   6. saved half way and loaded, a thing raised still stands after a year's plan;
//   7. a ruler taken by touch, a town of their realm asked by its page's button: who answered answers them.
// --frames: a frame's cost at the town, with an ask under way and without.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync, inflateSync } from "node:zlib";
import { preview } from "vite";
import { chromium, type Page } from "playwright";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  type World,
} from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { townOffers } from "../src/host/inspect/asks.ts";
import { politiesOf, populationContext, townsOf } from "../src/sim/index.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  measure = argv.includes("--frames"),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  shots = arg("--shots"),
  saveFile = arg("--save"),
  u = (arg("--universe") ?? "earth") as "earth" | "alien",
  youngYear = Number(arg("--young") ?? 300),
  U = u === "earth" ? EARTH : ALIEN;
if (shots) mkdirSync(shots, { recursive: true });
const slow = (ms: number) => (ci || soft ? ms * 4 : ms),
  problems: string[] = [],
  check = (ok: boolean, what: string) => {
    if (!ok) problems.push(what);
  },
  say = (s: string) => console.log(`  ${s}`),
  line = (s: string, n = 900) => s.slice(0, n).replace(/\s*\n\s*/g, " | "),
  BAD =
    /undefined|NaN|\[object|\bnull\b|\b(ev|pol|war|cell):\d|Gone from the world|nothing is known of it/;
console.log("gate 102, a town asked");

const open = (file: string): World => {
  const doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8"));
  return loadWorld(doc, (s) => U.build(s), rulesetId(U.build(seedFromText(doc.seed)), U.version), {
    allowRulesetChange: true,
  }).world;
};
const world = saveFile ? open(saveFile) : U.build(seedFromText(arg("--seed") ?? "first light"));
if (!saveFile) world.runTo(youngYear * YEAR);
const ctx = populationContext(world);
say(`${world.seed.text} at year ${Math.floor(world.now / YEAR)}`);

type Rect = { x0: number; y0: number; x1: number; y1: number };
/** The pixels of a shot in a box that pass a test, and a copy of the box's pixels (8-bit, whole RGB or RGBA, not interlaced). */
function read(
  png: Buffer,
  box: Rect,
  test: (r: number, g: number, b: number) => boolean,
): { count: number; rgb: Uint8Array } {
  let at = 8,
    width = 0,
    height = 0,
    channels = 0;
  const idat: Buffer[] = [];
  while (at + 12 <= png.length) {
    const size = png.readUInt32BE(at),
      type = png.toString("latin1", at + 4, at + 8),
      body = png.subarray(at + 8, at + 8 + size);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      channels = body[9] === 6 ? 4 : 3;
    } else if (type === "IDAT") idat.push(body);
    else if (type === "IEND") break;
    at += size + 12;
  }
  const raw = inflateSync(Buffer.concat(idat)),
    stride = width * channels,
    rows = Buffer.alloc(stride * height),
    paeth = (a: number, b: number, c: number) => {
      const p = a + b - c,
        pa = Math.abs(p - a),
        pb = Math.abs(p - b),
        pc = Math.abs(p - c);
      return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
    };
  let count = 0;
  const rgb: number[] = [];
  for (let j = 0; j < height; j++) {
    const filter = raw[j * (stride + 1)]!,
      src = j * (stride + 1) + 1,
      dst = j * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? rows[dst + x - channels]! : 0,
        b = j > 0 ? rows[dst - stride + x]! : 0,
        c = x >= channels && j > 0 ? rows[dst - stride + x - channels]! : 0,
        predicted =
          filter === 0
            ? 0
            : filter === 1
              ? a
              : filter === 2
                ? b
                : filter === 3
                  ? (a + b) >> 1
                  : paeth(a, b, c);
      rows[dst + x] = (raw[src + x]! + predicted) & 255;
    }
    if (j < box.y0 || j >= box.y1) continue;
    for (let i = Math.max(0, box.x0); i < Math.min(width, box.x1); i++) {
      const x = i * channels,
        r = rows[dst + x]!,
        g = rows[dst + x + 1]!,
        b = rows[dst + x + 2]!;
      rgb.push(r, g, b);
      if (test(r, g, b)) count++;
    }
  }
  return { count, rgb: Uint8Array.from(rgb) };
}
/** A site's flag's orange, as it comes out in the light of day. */
const FLAG = (r: number, g: number, b: number) =>
  r > 170 && g > 55 && g < 140 && b < 60 && r > g * 1.6;

// A town to ask: the least of a fair size with a thing to raise and a thing to put first.
const towns = [...ctx.settlements.all()]
    .filter((s) => s.population >= 200 && ctx.settlements.held(s.ref))
    .sort((a, b) => a.population - b.population),
  chosen = (() => {
    for (const s of towns.filter((_, i) => i % Math.max(1, Math.floor(towns.length / 400)) === 0)) {
      const o = townOffers(world, s.ref);
      if (
        o &&
        !o.shut &&
        o.raises.length &&
        o.firsts.length > 1 &&
        (townsOf(world).get(s.ref)?.next ?? 0) > 20
      )
        return { s, o };
    }
    return null;
  })();
check(!!chosen, "no town on this world could be asked for anything");
if (chosen) {
  const { s, o } = chosen,
    realmHere = politiesOf(world).of(s.cell);
  say(
    `town: ${s.name} (${s.ref}), ${s.population} people; raises: ${o.raises.map((r) => r.what).join(", ")}; first: ${o.firsts.map((r) => r.what).join(", ")}; not: ${o.no.map((n) => `${n.name}: ${n.why}`).join("; ")}`,
  );
  const root = fileURLToPath(new URL("..", import.meta.url)),
    server = await preview({
      root,
      logLevel: "silent",
      preview: { port: 4302, strictPort: false },
    }),
    base = server.resolvedUrls!.local[0]!,
    browser = await chromium.launch({
      args: soft
        ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
        : ci
          ? []
          : ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"],
    }),
    context = await browser.newContext({
      viewport: { width: 430, height: 932 },
      deviceScaleFactor: 1,
      hasTouch: true,
      isMobile: true,
    }),
    page: Page = await context.newPage(),
    errors: string[] = [],
    k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>,
    q = `universe=${u}&seed=${encodeURIComponent(world.seed.text)}`,
    frames = (n: number) =>
      k(
        `(async () => { for (let i = 0; i < ${n}; i++) await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(true)))); })()`,
      ),
    drawn = () =>
      page.waitForFunction(() => ((globalThis as any).causalis?.drawn?.() ?? 0) > 0, undefined, {
        timeout: slow(180000),
      }),
    until = async (what: string, ok: () => Promise<boolean>, ms = 60000, must = true) => {
      const end = Date.now() + slow(ms);
      while (Date.now() < end) {
        if (await ok().catch(() => false)) return true;
        await page.waitForTimeout(250);
      }
      if (must) problems.push(`${what} did not come`);
      return false;
    },
    shot = async (name: string): Promise<Buffer> => {
      const png = await page.screenshot();
      if (shots) writeFileSync(join(shots, `${name}.png`), png);
      return png;
    },
    windowWords = () =>
      k<string>(
        `(() => { const e = document.querySelector(".page-window:not([hidden])"); return e && e.getBoundingClientRect().height > 0 ? e.innerText : ""; })()`,
      ),
    sheetWords = () =>
      k<string>(
        `(() => { const e = document.querySelector(".ask-sheet:not([hidden])"); return e && e.getBoundingClientRect().height > 0 ? e.innerText : ""; })()`,
      ),
    /** A finger on a thing on the screen, once nothing else lies over it. */
    tapOn = async (selector: string): Promise<boolean> => {
      const sel = JSON.stringify(selector),
        at = await k<{ x: number; y: number } | null>(
          `(() => { const b = document.querySelector(${sel}); if (!b) return null; b.scrollIntoView({ block: "center" }); const r = b.getBoundingClientRect(); return r.height > 0 ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; })()`,
        );
      if (!at) {
        check(false, `${selector} isn't on the screen`);
        return false;
      }
      const hit = await k<string>(
        `(() => { const e = document.elementFromPoint(${at.x}, ${at.y}); const b = document.querySelector(${sel}); return e && b && (b === e || b.contains(e)) ? "yes" : (e ? e.tagName + "." + e.className : "none"); })()`,
      );
      check(hit === "yes", `${selector} isn't under the finger: ${hit}`);
      await page.touchscreen.tap(at.x, at.y);
      return true;
    },
    closeWindow = async () => {
      await k(`globalThis.causalis.closePage?.()`).catch(() => undefined);
      await frames(4);
    },
    nowT = () => k<number>("globalThis.causalis.client.status?.t ?? 0"),
    /** A page's words without a window: what its model says. */
    pageText = (ref: string) =>
      k<string>(
        `globalThis.causalis.client.query({ type: "page", args: { ref: ${JSON.stringify(ref)} } }).then((p) => JSON.stringify(p))`,
      ),
    /** The eye on the site until it stands still. */
    stood = async () => {
      let was = -1;
      for (let i = 0; i < 40; i++) {
        await frames(2);
        const d = await k<number>(
          "globalThis.causalis.rig.distance + globalThis.causalis.rig.target.x + globalThis.causalis.rig.target.z",
        );
        if (Math.abs(d - was) < 0.001) break;
        was = d;
      }
    },
    /** The clock run at a speed until something holds, then stopped. */
    runUntil = async (speed: number, ok: () => Promise<boolean>, ms: number): Promise<boolean> => {
      await k(`globalThis.causalis.client.setSpeed(${speed})`);
      const end = Date.now() + slow(ms);
      let held = false;
      while (Date.now() < end) {
        if (await ok().catch(() => false)) {
          held = true;
          break;
        }
        await page.waitForTimeout(300);
      }
      await k(`globalThis.causalis.client.setSpeed(0)`);
      await frames(4);
      return held;
    },
    frameCost = async (n: number) =>
      k<{ median: number; p95: number; worst: number }>(
        `(async () => { const d = []; let last = performance.now(); for (let i = 0; i < ${n}; i++) { await new Promise((done) => requestAnimationFrame(done)); const now = performance.now(); d.push(now - last); last = now; } d.sort((a, b) => a - b); return { median: d[Math.floor(${n} / 2)], p95: d[Math.floor(${n} * 0.95)], worst: d[${n} - 1] }; })()`,
      );
  page.setDefaultTimeout(slow(90000));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}?${q}&hold=1`);
  await drawn();
  const bytes = saveFile
    ? readFileSync(saveFile)
    : gzipSync(JSON.stringify(saveWorld(world, rulesetId(world, U.version), { universe: U.name })));
  await page.evaluate(
    async ([data]) => {
      const b = Uint8Array.from(atob(data as string), (c) => c.charCodeAt(0)),
        c = (globalThis as any).causalis.client;
      await c.importSave(b);
      await c.save("gate102");
    },
    [bytes.toString("base64")],
  );
  await page.goto(`${base}?${q}&load=gate102&hold=1`);
  await drawn();
  await k(`globalThis.causalis.goTo(${JSON.stringify(s.ref)})`);
  await until(
    "the town",
    async () => (await k<string>("globalThis.causalis.scale()")) === "village",
  );
  await frames(6);
  // The clock to a morning: what follows is by day.
  const morning = async () => {
    const t = await nowT(),
      day = Math.floor(t / 86400) + 1;
    await k(`globalThis.causalis.client.advance(${day * 86400 + 10 * 3600})`);
    await frames(6);
  };
  await morning();
  // A frame's cost, with nothing asked.
  let costBefore: { median: number; p95: number; worst: number } | null = null;
  if (measure) {
    await k(`globalThis.causalis.faceTown(0, 0, 40)`);
    await stood();
    costBefore = await frameCost(120);
    say(`a frame, nothing asked, the eye 40 off: ${JSON.stringify(costBefore)}`);
  }

  // 1. The bar's 🙏, by touch.
  await tapOn(".bar .town-ask");
  await until("the sheet", async () => (await sheetWords()).length > 20);
  const sheet = await sheetWords();
  say(`sheet: ${line(sheet, 1400)}`);
  await shot("1-sheet");
  check(/Raise something/i.test(sheet), "the sheet doesn't offer anything to raise");
  check(/Put something first/i.test(sheet), "the sheet doesn't offer a priority");
  check(!BAD.test(sheet), `bad words on the sheet: ${sheet.slice(0, 200)}`);
  const row = await k<{ h: number; w: number } | null>(
    `(() => { const r = document.querySelector(".ask-row")?.getBoundingClientRect(); return r ? { h: r.height, w: r.width } : null; })()`,
  );
  check(!!row && row.h >= 44, `a row of the sheet is too small to press (${row?.h})`);

  // 2. Raise what's listed, by touch; a town may say no, and that's an answer: on to the next, as a person would.
  let n = 0,
    answer = "",
    ref = "";
  for (const r of o.raises.slice(0, 4)) {
    if (!(await k<boolean>("globalThis.causalis.asks.sheetOpen()"))) {
      await tapOn(".bar .town-ask");
      await until("the sheet again", async () => (await sheetWords()).length > 20);
    }
    await tapOn(`.ask-row[data-ask="raise:${r.what}"]`);
    await until("the answer's page", async () => /their answer/i.test(await windowWords()), 30000);
    answer = await windowWords();
    say(`answer (${r.what}): ${line(answer, 1500)}`);
    ref = `ask:${s.ref}:${n++}`;
    await shot(`2-answer-${r.what}`);
    check(/their answer/i.test(answer), "no answer on the page");
    check(/\bwhy\b/i.test(answer), "no why on the answer's page");
    check(!BAD.test(answer), `bad words on the answer: ${line(answer, 300)}`);
    if (!/their answer: refused/i.test(answer)) break;
    await closeWindow();
    ref = "";
  }
  check(!!ref, "every thing asked of this town was refused");
  if (ref) {
    // ⌖ Go to, by touch: the eye to the site.
    await tapOn(".page-window:not([hidden]) .go-to");
    await until(
      "the site, as drawn",
      async () => !!(await k<unknown>(`globalThis.causalis.askedSpot(${JSON.stringify(ref)})`)),
      20000,
    );
    await stood();
    const spot = (await k<{ x: number; z: number; size: number } | null>(
        `globalThis.causalis.askedSpot(${JSON.stringify(ref)})`,
      ))!,
      where = async () =>
        k<{ x: number; y: number } | null>(`globalThis.causalis.townScreen(${spot.x}, ${spot.z})`),
      // (Far enough about it to hold its flag, at its corner: a great site stands wider on the screen than a small one.)
      boxOf = (at: { x: number; y: number }, r = 200): Rect => ({
        x0: Math.round(at.x - r),
        y0: Math.max(240, Math.round(at.y - r)),
        x1: Math.round(at.x + r),
        y1: Math.min(860, Math.round(at.y + r)),
      }),
      eye = await k<number>("globalThis.causalis.rig.distance");
    say(`the site: ${JSON.stringify(spot)}; the eye ${eye.toFixed(1)} off`);
    check(eye < 40, `⌖ Go to left the eye ${eye.toFixed(0)} off`);
    await frames(8);
    const at0 = await where();
    check(!!at0, "the site isn't on the screen");
    const box = boxOf(at0 ?? { x: 215, y: 500 }),
      png0 = await shot("3-site-begun"),
      f0 = read(png0, box, FLAG);
    say(`at ${JSON.stringify(at0)}: ${f0.count} of its flag's pixels from where the eye is`);
    check(f0.count >= 6, `the site's flag not in the pixels (${f0.count})`);
    if (measure) {
      const cost = await frameCost(120);
      say(`a frame, a site under way, at the site: ${JSON.stringify(cost)}`);
      await k(`globalThis.causalis.faceTown(0, 0, 40)`);
      await stood();
      const same = await frameCost(120);
      say(`a frame, a site under way, the eye 40 off: ${JSON.stringify(same)}`);
      say(
        `the same eye, with an ask and without: median ${same.median.toFixed(1)} against ${costBefore!.median.toFixed(1)} ms, p95 ${same.p95.toFixed(1)} against ${costBefore!.p95.toFixed(1)}`,
      );
      await k(`globalThis.causalis.open(${JSON.stringify(ref)})`);
      await until("the page", async () => /their answer/i.test(await windowWords()), 30000);
      await tapOn(".page-window:not([hidden]) .go-to");
      await stood();
    }

    // 3. Its work, in a day that can be watched: someone raising it, by name, pressed.
    const raising = async () => {
      const name =
        (await k<string>(
          `(() => { const t = globalThis.causalis.planNow().town; return t.civics.find((c) => c.asked && c.asked.ref === ${JSON.stringify(ref)})?.asked.name ?? t.walls?.asked?.name ?? ""; })()`,
        )) || "-";
      return k<{ index: number; name: string; ref: string; why: string }[]>(
        `globalThis.causalis.peopleNow().filter((p) => (p.why || "").includes(${JSON.stringify(name)}))`,
      );
    };
    let hands = await raising();
    // (The day of rest, or the hour they went home: a day or two on, with the clock running.)
    for (let i = 0; i < 4 && !hands.length; i++) {
      await morning();
      await frames(12);
      hands = await raising();
    }
    const crew = await k<string[]>(
      `(() => { const t = globalThis.causalis.planNow().town, a = t.civics.find((c) => c.asked && c.asked.ref === ${JSON.stringify(ref)})?.asked ?? t.walls?.asked; return a ? [...a.crew] : []; })()`,
    );
    say(
      `at work: ${hands.length} (${line(
        hands
          .slice(0, 4)
          .map((h) => `${h.name}: ${h.why}`)
          .join("; "),
        400,
      )}); crew by page ${crew.length}`,
    );
    check(hands.length > 0, "no one is at work on the site in a day that can be watched");
    const named = hands.filter((h) => crew.includes(h.ref));
    check(
      crew.length === 0 || named.length > 0,
      "those at work on the site aren't those its page names",
    );
    const one = named[0] ?? hands[0];
    if (one) {
      await k(
        `globalThis.causalis.rig.flyTo({ target: { x: ${spot.x * 0.1}, y: 0.5, z: ${spot.z * 0.1} }, distance: 8, pitch: -40 }, 0.01)`,
      );
      await stood();
      const p = await k<{ x: number; y: number } | null>(
        `globalThis.causalis.personOnScreen(${one.index})`,
      );
      if (p) {
        await page.touchscreen.tap(p.x, p.y);
        await frames(6);
        const watched = await k<number | null>("globalThis.causalis.watched()"),
          card = await k<string>("document.body.innerText");
        say(`one of them pressed: ${one.name}, shown ${watched === one.index}`);
        // (They work side by side: the one beside them, under the finger, is one of them too.)
        check(
          watched === one.index ||
            card.includes(one.name) ||
            hands.some((h) => h.index === watched),
          `pressing one at work didn't bring them (${one.name})`,
        );
        await shot("3b-one-at-work");
        await k(
          `document.querySelector(".panel:not(.page-panel) .inspector:not([hidden]) .close")?.click()`,
        );
        await k(`globalThis.causalis.closePage?.()`);
      } else say("the one at work is off the screen from here");
    }
    // Let it run at a real speed: the site's own pixels move, and its page says how far.
    await k(`globalThis.causalis.open(${JSON.stringify(ref)})`);
    await until("the page", async () => /their answer/i.test(await windowWords()), 30000);
    await tapOn(".page-window:not([hidden]) .go-to");
    await stood();
    const later = async () => {
      const pg = JSON.parse(await pageText(ref)) as {
          stats: { label: string; value: unknown }[];
        },
        done = pg.stats.find((x) => x.label === "Done")?.value;
      return Number(/(\d+) in a hundred/.exec(JSON.stringify(done))?.[1] ?? 0);
    };
    const was = await later();
    await runUntil(2592000 / 8, async () => (await later()) >= Math.max(30, was + 15), 45000);
    const share = await later();
    say(`let run: ${was} then ${share} in a hundred done`);
    check(share > was, "the clock ran and the site didn't get any further");
    await morning();
    await k(`globalThis.causalis.closePage?.()`);
    await stood();
    await frames(10);
    const at1 = await where(),
      png1 = await shot("3c-site-later"),
      f1 = read(png1, boxOf(at1 ?? at0 ?? { x: 215, y: 500 }), FLAG);
    let moved = 0;
    if (at1 && at0) {
      const a = read(png0, box, FLAG).rgb,
        b = read(png1, box, FLAG).rgb;
      for (let i = 0; i + 2 < Math.min(a.length, b.length); i += 3)
        if (
          Math.abs(a[i]! - b[i]!) +
            Math.abs(a[i + 1]! - b[i + 1]!) +
            Math.abs(a[i + 2]! - b[i + 2]!) >
          40
        )
          moved++;
    }
    say(`${f1.count} of its flag's pixels; ${moved} pixels about it changed as it went up`);
    check(moved > 150, `the site doesn't look any different as it goes up (${moved} pixels)`);

    // The site pressed, by touch, with no one in front of it: from its own place.
    let opened = "";
    await k(`globalThis.causalis.closePage?.()`);
    await stood();
    const size = spot.size;
    for (const [dx, dz] of [
      [0, 0],
      [size * 0.25, 0],
      [-size * 0.25, 0],
      [0, size * 0.25],
      [0, -size * 0.25],
    ]) {
      const atP = await k<{ x: number; y: number } | null>(
        `globalThis.causalis.townScreen(${spot.x + dx!}, ${spot.z + dz!})`,
      );
      if (!atP) continue;
      const person = await k<number | null>(`globalThis.causalis.townPick(${atP.x}, ${atP.y}, 12)`);
      if (person !== null) continue;
      await page.touchscreen.tap(atP.x, atP.y);
      await until(
        "the site's page",
        async () => /at work|It took/i.test(await windowWords()),
        10000,
        false,
      );
      opened = await windowWords();
      if (/at work|It took/i.test(opened)) break;
      await k(`globalThis.causalis.closePage?.()`);
      await frames(6);
    }
    say(`site pressed: ${line(opened, 1300)}`);
    await shot("4-site-page");
    check(/at work/i.test(opened), "a press on the site didn't bring its page, with who works");
    check(/in a hundred/.test(opened), "the site's page doesn't say how far");
    check(/eaten/.test(opened), "the site's page doesn't say what it took");
    check(!BAD.test(opened), `bad words on the site's page: ${line(opened, 300)}`);
    await k(`globalThis.causalis.closePage?.()`);
    await frames(4);

    // A save made half way, kept for step 6.
    await k(`globalThis.causalis.client.save("gate102half")`);

    // 4. Let it finish, by the clock; it stands.
    const finished = await runUntil(2592000 / 4, async () => (await later()) >= 100, 90000);
    if (!finished) {
      const t = await nowT();
      await k(`globalThis.causalis.client.advance(${Math.round(t + 4 * YEAR)})`);
      await frames(10);
    }
    await morning();
    await frames(16);
    await k(`globalThis.causalis.closePage?.()`);
    await stood();
    const at2 = await where(),
      png2 = await shot("5-finished"),
      f2 = read(png2, boxOf(at2 ?? at0 ?? { x: 215, y: 500 }), FLAG);
    say(`finished: ${f2.count} of its flag's pixels at the same eye, ${f0.count} when begun`);
    check(
      f2.count < Math.max(3, f0.count / 4),
      `its flag still flies (${f2.count} against ${f0.count})`,
    );
    await k(`globalThis.causalis.open(${JSON.stringify(ref)})`);
    await until(
      "the finished page",
      async () => /It took|given up|Stopped:/.test(await windowWords()),
      30000,
    );
    const fin = await windowWords();
    say(`after: ${line(fin, 1300)}`);
    await shot("5b-finished-page");
    check(/It took/.test(fin), `what was asked for wasn't finished: ${line(fin, 700)}`);
    check(!BAD.test(fin), `bad words after: ${line(fin, 300)}`);
    await closeWindow();

    // A stone, in the town, by touch; its song; The Years.
    await until(
      "the plan with its stone",
      async () =>
        !!(await k<boolean>(
          `(globalThis.causalis.planNow().memorials ?? []).some((m) => /asking/.test(m.title))`,
        )),
      20000,
      false,
    );
    const stones = await k<{ ref: string; title: string }[]>(
      "globalThis.causalis.planNow().memorials ?? []",
    );
    say(`stones: ${JSON.stringify(stones.map((x) => x.title))}`);
    const mine = stones.find((x) => /asking/.test(x.title));
    check(!!mine, "the town keeps no stone of what it was asked");
    /** A stone it keeps, gone to and pressed by touch, and its song read: what's on the screen, as a person reads it. */
    const stoneAndSong = async (ref: string, tag: string): Promise<string> => {
      await k(`globalThis.causalis.open(${JSON.stringify(ref)})`);
      await until("the stone's page", async () => /asking/i.test(await windowWords()), 20000);
      await tapOn(".page-window:not([hidden]) .go-to");
      await stood();
      await frames(10);
      await shot(`${tag}-stone`);
      const fresh = await k<{ list: { ref: string }[] } | null>("globalThis.causalis.stones()"),
        st = fresh?.list.find((x) => x.ref === ref);
      check(!!st, "the stone isn't on the screen once gone to");
      if (!st) return "";
      // (Where a finger can get at it: a far city's stone stands taller than the screen's open part, and someone may stand before it.
      // Under a reign the clock runs on, and a crowd can come over it between the look and the press: as a person would, press again.)
      const onStone = () =>
        k<{ x: number; y: number } | null>(
          `(() => {
            const c = globalThis.causalis, s = c.stones()?.list.find((x) => x.ref === ${JSON.stringify(ref)});
            if (!s) return null;
            for (const f of [0.5, 0.35, 0.65, 0.25, 0.75, 0.15, 0.85]) {
              const y = s.footY + (s.headY - s.footY) * f, e = document.elementFromPoint(s.footX, y);
              if (e && e.tagName === "CANVAS" && c.townPick(s.footX, y, 12) === null) return { x: s.footX, y };
            }
            return null;
          })()`,
        );
      let got = false,
        pressed = false;
      for (let go = 0; go < 4 && !got; go++) {
        const onIt = await onStone();
        if (!onIt) {
          await frames(10);
          continue;
        }
        pressed = true;
        await page.touchscreen.tap(onIt.x, onIt.y);
        for (let w = 0; w < 12 && !got; w++) {
          await frames(4);
          got = /asking/i.test(await windowWords());
        }
        if (!got) await closeWindow().catch(() => {});
      }
      check(pressed, "no part of the stone can be got at on the screen");
      check(got, "the stone's page, pressed, did not come");
      if (!got) return "";
      const sw = await windowWords();
      say(`stone: ${line(sw, 1100)}`);
      await shot(`${tag}-stone-page`);
      check(/stone of the asking/i.test(sw), `a press on the stone brought: ${line(sw, 200)}`);
      check(!BAD.test(sw), `bad words on the stone: ${line(sw, 300)}`);
      const song = `song:${ref.slice(ref.lastIndexOf(s.ref) + s.ref.length + 1)}`;
      await k(`globalThis.causalis.open(${JSON.stringify(song)})`);
      await until(
        "its song",
        async () => {
          const w = await windowWords();
          return w.length > 80 && !/No one sings|Gone from the world/.test(w);
        },
        20000,
      );
      const sg = await windowWords();
      say(`song: ${line(sg, 900)}`);
      await shot(`${tag}-song`);
      check(!BAD.test(sg), `bad words in the song: ${line(sg, 300)}`);
      await closeWindow();
      return `${sw} ${sg}`;
    };
    if (mine) await stoneAndSong(mine.ref, "5c");
    const thisYear = Math.floor((await nowT()) / YEAR),
      years = await k<unknown>(
        `globalThis.causalis.client.query({ type: "annals.read", args: { years: ${JSON.stringify(Array.from({ length: 8 }, (_, i) => thisYear - i))} } })`,
      ),
      told = JSON.stringify(years).match(/[^"]*(was asked|as it was asked)[^"]*/g) ?? [];
    say(`The Years: ${line(told.slice(0, 3).join(" / "), 500)}`);
    check(told.length > 0, "The Years don't keep what the town was asked");

    // 5. A priority, by touch: more of them at it.
    await tapOn(".bar .town-ask");
    await until("the sheet again", async () => (await sheetWords()).length > 20);
    const list2 = await sheetWords();
    check(/Asked already/i.test(list2), "the sheet doesn't remember what was asked");
    const firsts = await k<string[]>(
      `[...document.querySelectorAll('.ask-sheet .ask-row[data-ask^="first:"]')].map((x) => x.dataset.ask).filter((x) => !/food|homes/.test(x))`,
    );
    let put = false;
    for (const f of firsts.slice(0, 3)) {
      if (!(await k<boolean>("globalThis.causalis.asks.sheetOpen()"))) {
        await tapOn(".bar .town-ask");
        await until("the sheet again", async () => (await sheetWords()).length > 20);
      }
      await tapOn(`.ask-row[data-ask="${f}"]`);
      await until(
        "the priority's answer",
        async () => /their answer/i.test(await windowWords()),
        30000,
      );
      const pr = await windowWords();
      say(`priority (${f}): ${line(pr, 1300)}`);
      await shot("6-priority");
      check(!BAD.test(pr), `bad words on a priority's page: ${line(pr, 300)}`);
      await closeWindow();
      if (!/their answer: refused/i.test(pr)) {
        put = true;
        break;
      }
    }
    if (put) {
      await until(
        "the plan's priority",
        async () => !!(await k<unknown>("globalThis.causalis.planNow()?.town?.first")),
        20000,
      );
      await morning();
      await frames(20);
      let at = 0,
        doing = "";
      for (let i = 0; i < 4 && !at; i++) {
        const st = await k<{ doing: { kind: string; n: number }[] } | null>(
          "globalThis.causalis.stores()",
        );
        at = st?.doing.find((d) => d.kind === "first")?.n ?? 0;
        doing = JSON.stringify(st?.doing.slice(0, 8));
        if (!at) {
          await morning();
          await frames(12);
        }
      }
      say(`at what was put first today: ${at}; the day: ${doing}`);
      check(at > 0, "no one is at what the town was asked to put first");
      const whys = await k<string[]>(
        `globalThis.causalis.peopleNow().map((p) => p.why || "").filter((w) => /as the town was asked/.test(w)).slice(0, 4)`,
      );
      say(`what they're at: ${line(whys.join(" / "), 400)}`);
      await shot("6b-priority-town");
    }

    // 6. Saved half way, loaded, and run on: it finishes. And a thing raised stands after a year's plan.
    await page.goto(`${base}?${q}&load=gate102half&hold=1`);
    await drawn();
    await k(`globalThis.causalis.goTo(${JSON.stringify(s.ref)})`);
    await until(
      "the town, loaded",
      async () => (await k<string>("globalThis.causalis.scale()")) === "village",
    );
    await frames(10);
    const half = await later();
    check(half > 0 && half < 100, `a save made half way read ${half} in a hundred`);
    const t3 = await nowT();
    await k(`globalThis.causalis.client.advance(${Math.round(t3 + 3 * YEAR)})`);
    await frames(12);
    const after = await later(),
      stands = await k<{ fell: unknown; done: number; now: number } | null>(
        `(() => { const a = globalThis.causalis.planNow().town; const c = a.civics.find((x) => x.asked && x.asked.ref === ${JSON.stringify(ref)}); const w = a.walls?.asked; const m = c?.asked ?? w; return m ? { fell: c ? c.fell : null, done: m.done, now: globalThis.causalis.client.status.t } : null; })()`,
      );
    say(
      `loaded half way: ${half} in a hundred; three years on: ${after}; in its plan: ${JSON.stringify(stands)}`,
    );
    check(after >= 100, `a save made half way didn't finish on (${after})`);
    check(!!stands && stands.fell === null, "a thing raised isn't in its plan after a year's turn");

    // 7. A ruler's word, by touch: their leaders tab, the town's own page, its button.
    if (realmHere) {
      await k(`globalThis.causalis.open(${JSON.stringify(`${realmHere.ref}#leaders`)})`);
      const could = await until(
        "the leaders tab",
        async () => !!(await k<boolean>(`!!document.querySelector(".leader-rule")`)),
        30000,
        false,
      );
      if (could) {
        await frames(4);
        await tapOn(".leader-rule");
        await until(
          "the ruling bar",
          async () => !!(await k<unknown>("globalThis.causalis.reign.state()")),
          120000,
        );
        await frames(10);
        const now = await k<{ ruler: string } | null>("globalThis.causalis.reign.state()");
        await k(`globalThis.causalis.open(${JSON.stringify(s.ref)})`);
        await until("the town's page", async () => (await windowWords()).includes(s.name), 30000);
        await frames(4);
        await shot("7-ruler-town-page");
        const pressed = await k<{ x: number; y: number } | null>(
          `(() => { const b = [...document.querySelectorAll(".page-window:not([hidden]) .scene-act")].find((x) => /Ask/.test(x.textContent || "")); if (!b) return null; b.scrollIntoView({ block: "center" }); const r = b.getBoundingClientRect(); return r.height > 0 ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; })()`,
        );
        check(!!pressed, "no way to ask on a town's page, while ruling");
        if (pressed) {
          await page.touchscreen.tap(pressed.x, pressed.y);
          await until("the sheet, while ruling", async () => (await sheetWords()).length > 20);
          const sw = await sheetWords();
          say(`ruler's sheet: ${line(sw, 500)}`);
          await shot("7b-ruler-sheet");
          const rows = await k<string[]>(
            `[...document.querySelectorAll('.ask-sheet .ask-row')].map((x) => x.dataset.ask)`,
          );
          const pick = rows.find((r) => r.startsWith("raise:")) ?? rows[0];
          check(!!pick, "a ruler's sheet offers nothing");
          if (pick) {
            await tapOn(`.ask-row[data-ask="${pick}"]`);
            await until(
              "the ruler's answer",
              async () => /their answer/i.test(await windowWords()),
              30000,
            );
            const words = await windowWords();
            say(`ruler ${now?.ruler}: ${line(words, 1200)}`);
            await shot("7c-ruler-answer");
            check(
              !!now && words.includes(now.ruler),
              "the answer doesn't name the ruler who asked",
            );
            check(!BAD.test(words), `bad words on a ruler's asking: ${line(words, 300)}`);
            await closeWindow();
            if (pick.startsWith("raise:") && !/their answer: refused/i.test(words)) {
              const t4 = await nowT();
              await k(`globalThis.causalis.client.advance(${Math.round(t4 + 3 * YEAR)})`);
              await frames(12);
              await k(`globalThis.causalis.goTo(${JSON.stringify(s.ref)})`);
              await until(
                "the town, while ruling",
                async () => (await k<string>("globalThis.causalis.scale()")) === "village",
              );
              const had = new Set(stones.map((x) => x.ref));
              const kept = await until(
                "the stone of the ruler's asking",
                async () =>
                  !!(await k<boolean>(
                    `(globalThis.causalis.planNow().memorials ?? []).some((m) => /asking/.test(m.title) && !${JSON.stringify([...had])}.includes(m.ref))`,
                  )),
                30000,
                false,
              );
              check(kept, "the town keeps no stone of its ruler's asking");
              if (kept) {
                const list = await k<{ ref: string; title: string }[]>(
                    "globalThis.causalis.planNow().memorials ?? []",
                  ),
                  theirs = list.find((x) => /asking/.test(x.title) && !had.has(x.ref))!,
                  read = await stoneAndSong(theirs.ref, "7d");
                check(
                  !!now && read.includes(now.ruler),
                  `the stone and song of a ruler's asking don't name them: ${line(read, 300)}`,
                );
              }
            }
          }
        }
      } else say("this realm's leaders tab offers no one to rule");
    } else say("no realm here: no ruler to ask by");
  }
  check(!errors.length, `page errors: ${errors.slice(0, 3).join(" / ")}`);
  await browser.close();
  await server.close();
}
if (problems.length) {
  console.log(`gate 102 FAILED:\n  - ${problems.join("\n  - ")}`);
  process.exit(1);
}
console.log("gate 102 passed");
process.exit(0);
