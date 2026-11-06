// node tools/r1-gate.ts [--ci] [--soft] [--shots dir] [--save file.save --universe earth|alien] [--young year]: gate 101, roads built and travelled (R1), at a phone's size.
// On a far save, else (as on CI) a young world run on:
//   1. off the world: a road's page read aloud clean; a town's ground worn by who walks there, not all alike; what its people keep and ride;
//   2. on the land, from its nearest eye: a gang in the pixels, pressed by touch, its page's words off the screen: who pays, who works, how far, what stopped them; ⌖ Go to brings the eye back;
//   3. in the town of a morning: a car and a line drawn, a car pressed: its owner; a line pressed: its riders, the town's own.
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
import { landPlan } from "../src/host/land.ts";
import { townSite, villagePlan } from "../src/host/village.ts";
import { roadPage } from "../src/host/inspect/road.ts";
import { populationContext } from "../src/sim/index.ts";
import { ridesOf, roadNow, townScene, wornOf } from "../src/view/index.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
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
  BAD = /undefined|NaN|\[object|\bnull\b|\b(ev|pol|town|war|cell):\d/;
console.log("gate 101, roads built and travelled");

const open = (file: string): World => {
  const doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8"));
  return loadWorld(doc, (s) => U.build(s), rulesetId(U.build(seedFromText(doc.seed)), U.version), {
    allowRulesetChange: true,
  }).world;
};
const world = saveFile ? open(saveFile) : U.build(seedFromText(arg("--seed") ?? "first light"));
if (!saveFile) world.runTo(youngYear * YEAR);
const y = world.now / YEAR,
  far = y >= 1200,
  ctx = populationContext(world);
say(`${world.seed.text} at year ${Math.floor(y)}`);

/** The pixels of a shot that pass a test (8-bit, whole RGB or RGBA, not interlaced). */
function pixels(png: Buffer, test: (r: number, g: number, b: number) => boolean): number {
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
    for (let x = 0; x < stride; x += channels)
      if (test(rows[dst + x]!, rows[dst + x + 1]!, rows[dst + x + 2]!)) count++;
  }
  return count;
}

// 1. Off the world: a land with a gang at work, nothing stopping it, a good town at one end.
let site: { cell: number; ref: string; town: string; share: number } | null = null,
  best = -1;
const stoppedRoads: { cell: number; ref: string }[] = [],
  cutRoads: { cell: number; ref: string }[] = [];
const cells = new Set<number>();
for (const s of ctx.settlements.all()) if (s.population > 0) cells.add(s.cell);
for (const [at, cell] of [...cells].slice(0, 700).entries()) {
  if (at >= 200 && stoppedRoads.length && cutRoads.length) break;
  // (A land of fair towns: one whose roads run clear of a great city's sprawl.)
  for (const r of landPlan(world, cell, 60).roads) {
    const n = roadNow(r, y);
    const cutNow = !!r.cut && y >= r.cut.from && y < r.cut.until;
    if (r.ref && n.stopped && !cutNow && stoppedRoads.length < 6)
      stoppedRoads.push({ cell, ref: r.ref });
    if (r.ref && cutNow && cutRoads.length < 6) cutRoads.push({ cell, ref: r.ref });
    if (at >= 200 || !n.works || n.stopped || !r.ref) continue;
    const pop = ctx.settlements.get(r.a as never)?.population ?? 0,
      score =
        Math.min(1, pop / 2000) +
        (n.share > 0.15 && n.share < 0.85 ? 1 : 0) +
        (n.works.again ? 0 : 1);
    if (score > best) {
      best = score;
      site = { cell, ref: r.ref, town: r.a, share: n.share };
    }
  }
}
check(!!site, "no gang is at work on any road of this world");
if (site) {
  const page = roadPage(world, site.ref as never),
    said = (v: unknown): string =>
      typeof v === "string"
        ? v
        : Array.isArray(v)
          ? v.map(said).join("")
          : v && typeof v === "object" && "text" in v
            ? String((v as { text: unknown }).text)
            : "",
    text = [
      page.title,
      said(page.subtitle),
      ...page.stats.map((s) => `${s.label}: ${said(s.value)}`),
      ...page.tabs[0]!.blocks.flatMap((b) => {
        const block = b as { title?: string; lines?: unknown[]; items?: { line: unknown }[] };
        return [
          block.title ?? "",
          ...(block.lines ?? []).map(said),
          ...(block.items ?? []).map((i) => said(i.line)),
        ];
      }),
    ].join(" | ");
  say(`road: ${site.ref}, ${Math.round(site.share * 100)} in a hundred done: ${text}`);
  check(!BAD.test(text), `bad words on a road's page: ${text.slice(0, 300)}`);
}
// A town's ground.
const towns = [...ctx.settlements.all()].filter((s) => s.population > 0),
  townRef = site?.town ?? towns[0]!.ref;
if (townSite(world, townRef as never)) {
  const plan = villagePlan(world, townRef as never, 12, 120);
  if (plan.town) {
    const worn = wornOf(townScene(plan.town, world.now));
    say(
      `worn: ${worn.worn} of ${worn.ways} ways, ${worn.homes} homes, ${worn.pieces.length} pieces`,
    );
    check(worn.pieces.length > 0, "a town's ground reads no wear at all");
    check(
      worn.worn / Math.max(1, worn.ways) < 0.5,
      `a town's ground reads worn all over (${worn.worn} of ${worn.ways})`,
    );
    const bands = new Set(worn.pieces.map((p) => p.band));
    check(bands.size >= 2, "a town's ways are all worn alike");
    const rides = ridesOf(plan);
    say(
      `rides: ${rides.owners.size} cars, ${rides.riders.size} riders, ${rides.lines.length} lines, about ${JSON.stringify(plan.about)}`,
    );
    if (!far) check(rides.owners.size === 0, "cars on a young world");
  }
}

if (site && !problems.length) {
  const root = fileURLToPath(new URL("..", import.meta.url)),
    server = await preview({
      root,
      logLevel: "silent",
      preview: { port: 4301, strictPort: false },
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
    drawn = () =>
      page.waitForFunction(() => ((globalThis as any).causalis?.drawn?.() ?? 0) > 0, undefined, {
        timeout: slow(180000),
      }),
    until = async (what: string, ok: () => Promise<boolean>, ms = 60000) => {
      const end = Date.now() + slow(ms);
      while (Date.now() < end) {
        if (await ok().catch(() => false)) return true;
        await page.waitForTimeout(250);
      }
      problems.push(`${what} did not come`);
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
    closeWindow = async () => {
      await k(`globalThis.causalis.closePage?.()`).catch(() => undefined);
      await page.evaluate(() => {
        const b = document.querySelector(
          ".page-window:not([hidden]) .page-close",
        ) as HTMLElement | null;
        b?.click();
      });
      await page.waitForTimeout(slow(300));
    };
  page.setDefaultTimeout(slow(90000));
  page.on("pageerror", (e) => errors.push(e.message));
  // Into the world, held.
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
      await c.save("gate101");
    },
    [bytes.toString("base64")],
  );
  await page.goto(`${base}?${q}&load=gate101&hold=1`);
  await drawn();

  // 2. The land, from its nearest eye.
  await k(`globalThis.causalis.goTo("cell:0:${site.cell}")`);
  await until(
    "the land",
    async () => (await k<string>("globalThis.causalis.scale()")) === "region",
  );
  await until(
    "the gang on the land",
    async () => (await k<{ gangs: number } | null>("globalThis.causalis.landWorks()"))?.gangs! > 0,
  );
  // (The one drawn: a road wholly under a great city's sprawl has none to see.)
  await k(`globalThis.causalis.faceLand(0, 0, 200)`);
  await page.waitForTimeout(slow(800));
  const drawnGangs = await k<{ ref: string }[]>("globalThis.causalis.landGangs()");
  check(drawnGangs.length > 0, "no gang on the screen from afar");
  if (drawnGangs[0]) site = { ...site, ref: drawnGangs[0].ref };
  const head = await k<{ x: number; z: number } | null>(
    `globalThis.causalis.landRoadHead(${JSON.stringify(site.ref)})`,
  );
  check(!!head, "the road's gang isn't on the land");
  if (head) {
    await k(`globalThis.causalis.faceLand(${head.x}, ${head.z}, 12)`);
    await page.waitForTimeout(slow(1500));
    await k(`globalThis.causalis.client.setSpeed(60)`);
    await page.waitForTimeout(slow(2500));
    await k(`globalThis.causalis.client.setSpeed(0)`);
    await page.waitForTimeout(slow(600));
    const works = await k<{ gangs: number; hands: number; parts: number }>(
        "globalThis.causalis.landWorks()",
      ),
      png = await shot("1-gang"),
      flag = pixels(png, (r, g, b) => r > 200 && g > 90 && g < 170 && b < 70);
    say(`works: ${JSON.stringify(works)}; ${flag} of its flag's pixels from twelve units off`);
    check(flag >= 6, `a gang's flag not in the pixels from the land's nearest eye (${flag})`);
    check(works.hands >= 3, "a gang with no hands");
    const gangs = await k<{ ref: string; x: number; y: number }[]>(
        "globalThis.causalis.landGangs()",
      ),
      mine = gangs.find((g) => g.ref === site!.ref);
    // (From where the eye is: the screen's own.)
    check(!!mine, "the gang isn't on the screen");
    if (mine) {
      const hit = await k<string>(
        `(() => { const e = document.elementFromPoint(${mine.x}, ${mine.y}); return e ? (e.tagName + "." + e.className) : ""; })()`,
      );
      say(`under the finger: ${hit}`);
      await page.touchscreen.tap(mine.x, mine.y);
      await until("the road's page", async () => (await windowWords()).length > 80);
      const words = await windowWords();
      say(`page: ${words.slice(0, 700).replace(/\n/g, " | ")}`);
      await shot("2-road-page");
      check(/workers/i.test(words), "the road's page doesn't say who works");
      check(/Paid for|No one pays/.test(words), "the road's page doesn't say who pays");
      check(/in a hundred/.test(words), "the road's page doesn't say how far");
      check(
        /Nothing has stopped|Stopped/.test(words),
        "the road's page doesn't say what stopped it",
      );
      check(!BAD.test(words), `bad words on the screen: ${words.slice(0, 200)}`);
      // ⌖ Go to, as an envoy has: the eye comes back.
      await k(`globalThis.causalis.faceLand(0, 0, 90)`);
      await page.waitForTimeout(slow(400));
      const go = await k<{ x: number; y: number } | null>(
        `(() => { const b = [...document.querySelectorAll(".page-window:not([hidden]) button")].find((x) => /Go to|⌖/.test(x.textContent || "")); if (!b) return null; const r = b.getBoundingClientRect(); return r.height > 0 ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; })()`,
      );
      check(!!go, "no ⌖ Go to on a road's page");
      if (go) {
        await page.touchscreen.tap(go.x, go.y);
        await page.waitForTimeout(slow(2500));
        const near = await k<number>(
          "globalThis.causalis.rig ? globalThis.causalis.rig.distance : 12",
        );
        say(`after Go to: the eye ${near.toFixed(1)} off`);
        check(near < 30, "⌖ Go to didn't bring the eye to the gang");
        await shot("3-go-to");
      }
    }
  }
  await closeWindow();

  // A road stopped for the fighting and a road cut, seen and pressed where this world has them.
  for (const [what, roads, says] of [
    ["stopped", stoppedRoads, /Stopped/],
    ["cut", cutRoads, /Cut/],
  ] as const) {
    if (!roads.length) say(`no road ${what} among this world's first lands`);
    let shown = false;
    for (const r of roads) {
      if (shown) break;
      await k(`globalThis.causalis.goTo("cell:0:${r.cell}")`);
      await until(
        "the land",
        async () => (await k<string>("globalThis.causalis.scale()")) === "region",
      );
      await page.waitForTimeout(slow(2500));
      const at = await k<{ x: number; z: number } | null>(
        `globalThis.causalis.landRoadHead(${JSON.stringify(r.ref)})`,
      );
      if (!at) continue;
      await k(`globalThis.causalis.faceLand(${at.x}, ${at.z}, 12)`);
      await page.waitForTimeout(slow(1800));
      const list = await k<{ ref: string; x: number; y: number; stopped: boolean; cut: boolean }[]>(
          "globalThis.causalis.landGangs()",
        ),
        mine = list.find((g) => g.ref === r.ref);
      if (!mine) continue;
      shown = true;
      await shot(`5-${what}`);
      await page.touchscreen.tap(mine.x, mine.y);
      await until(`the ${what} road's page`, async () => (await windowWords()).length > 80);
      const words = await windowWords();
      say(`${what}: ${words.slice(0, 600).replace(/\n/g, " | ")}`);
      await shot(`5-${what}-page`);
      check(says.test(words), `a ${what} road's page doesn't say so: ${words.slice(0, 200)}`);
      check(!BAD.test(words), `bad words on a ${what} road's page: ${words.slice(0, 200)}`);
      await closeWindow();
    }
    if (roads.length) check(shown, `no ${what} road could be gone to`);
  }

  // 3. The town, of a morning.
  await k(`globalThis.causalis.goTo(${JSON.stringify(site.town)})`);
  await until(
    "the town",
    async () => (await k<string>("globalThis.causalis.scale()")) === "village",
  );
  await page.waitForTimeout(slow(3000));
  // (The clock let run, as anyone's does, into the morning.)
  const now = await k<number>("globalThis.causalis.client.status?.t ?? 0"),
    day = Math.floor(now / 86400),
    morning = (day + 1) * 86400 + 6.6 * 3600;
  await k(`globalThis.causalis.client.advance(${Math.round(morning)})`);
  await page.waitForTimeout(slow(1500));
  await k(`globalThis.causalis.faceTown(0, 0, 80)`);
  await k(`globalThis.causalis.client.setSpeed(240)`);
  await page.waitForTimeout(slow(3500));
  await k(`globalThis.causalis.client.setSpeed(0)`);
  await page.waitForTimeout(slow(600));
  const rides = await k<{
    cars: number;
    buses: number;
    aboard: number;
    carsAt: { index: number; x: number; y: number; wx: number; wz: number }[];
    busesAt: { n: number; x: number; y: number; aboard: number; wx: number; wz: number }[];
  } | null>("globalThis.causalis.townRides()");
  say(
    `town: ${rides?.cars} cars, ${rides?.buses} lines, ${rides?.aboard} aboard, ${rides?.carsAt.length} cars on the screen`,
  );
  await shot("4-town-morning");
  if (far) {
    const about = await k<{ own: string | null; line: string | null } | null>(
      "globalThis.causalis.planNow()?.about ?? null",
    );
    if (about?.own)
      check((rides?.cars ?? 0) > 0, "no household keeps anything, on a world past engines");
    if (about?.line) check((rides?.buses ?? 0) > 0, "no line runs in a town past engines");
    // Cars pressed by touch, each at its real place on the canvas, with someone standing by it where that happens: each brings its owner.
    if (about?.own) {
      const pressed = { n: 0, right: 0, crowded: 0 };
      for (let tries = 0; tries < 6 && pressed.n < 3; tries++) {
        const now2 = await k<{
            carsAt: { index: number; x: number; y: number; wx: number; wz: number }[];
          }>("globalThis.causalis.townRides()"),
          free = await k<{ index: number; x: number; y: number }[]>(
            `globalThis.causalis.townRides().carsAt.filter((c) => { const e = document.elementFromPoint(c.x, c.y); return e && e.tagName === "CANVAS"; })`,
          ),
          car = free[tries] ?? now2.carsAt[tries];
        if (!car) break;
        if (!free[tries]) {
          const c = now2.carsAt[tries]!;
          await k(`globalThis.causalis.faceTown(${c.wx}, ${c.wz}, 30)`);
          await page.waitForTimeout(slow(1200));
          continue;
        }
        const crowd = await k<number | null>(
          `globalThis.causalis.townPick(${car.x}, ${car.y}, 12)`,
        );
        await k(`globalThis.causalis.closePage()`);
        await page.touchscreen.tap(car.x, car.y);
        await page.waitForTimeout(slow(900));
        const who = await k<number | null>("globalThis.causalis.watched()"),
          name = await k<string>(`globalThis.causalis.planNow().people[${car.index}].name`),
          shown = await k<string>(`document.body.innerText`);
        pressed.n++;
        if (crowd !== null && crowd !== car.index) pressed.crowded++;
        if (who === car.index && shown.includes(name)) pressed.right++;
        say(
          `a car pressed at (${car.x.toFixed(0)}, ${car.y.toFixed(0)}), ${crowd !== null ? `someone standing by it` : "no one by it"}: ${who === car.index ? "its owner" : `someone else (${who})`}, ${name}`,
        );
        if (pressed.n === 1) await shot("6-car-owner");
        await k(`globalThis.causalis.closePage()`);
      }
      say(`cars pressed: ${JSON.stringify(pressed)}`);
      check(pressed.n > 0, "no car on the canvas to press");
      check(
        pressed.right === pressed.n,
        `pressing a car brought its owner ${pressed.right} of ${pressed.n} times`,
      );
    }
    // A line pressed: its riders.
    const fresh = await k<{
        busesAt: { n: number; x: number; y: number; wx: number; wz: number }[];
      }>("globalThis.causalis.townRides()"),
      bus = fresh.busesAt[0];
    if (bus && about?.line) {
      await k(`globalThis.causalis.faceTown(${bus.wx}, ${bus.wz}, 30)`);
      await page.waitForTimeout(slow(1500));
      await shot("7-line");
      const seen = await k<{ busesAt: { n: number; x: number; y: number }[] }>(
          "globalThis.causalis.townRides()",
        ),
        b2 = seen.busesAt.find((b) => b.n === bus.n);
      if (b2) {
        await page.touchscreen.tap(b2.x, b2.y);
        await until("the line's page", async () => /ride/i.test(await windowWords()), 20000);
        const words = await windowWords();
        say(`line: ${words.slice(0, 400).replace(/\n/g, " | ")}`);
        check(/some who ride it/i.test(words), "a line's page names no riders");
        check(!BAD.test(words), `bad words on a line's page: ${words.slice(0, 200)}`);
        await shot("8-line-page");
      } else check(false, "the line went off the screen");
    }
  } else check((rides?.cars ?? 0) === 0, "cars in a young town");

  // Worn ground by day, from as near and as far as a person's eye goes.
  await closeWindow();
  const noon = (day + 2) * 86400 + 12 * 3600;
  await k(`globalThis.causalis.client.advance(${Math.round(noon)})`);
  await page.waitForTimeout(slow(1500));
  for (const d of [60, 140]) {
    await k(
      `globalThis.causalis.rig.flyTo({ target: { x: 0, y: 0, z: 0 }, distance: ${d}, pitch: -48 }, 0.01)`,
    );
    await page.waitForTimeout(slow(900));
    await shot(`9-worn-${d}`);
  }

  // 4. Live their day: one who keeps a car goes to their work in it; one who rides a line goes in its coach.
  if (far) {
    const about = await k<{ own: string | null; line: string | null } | null>(
      "globalThis.causalis.planNow()?.about ?? null",
    );
    await closeWindow();
    const kinds = [...(about?.own ? ["owner"] : []), ...(about?.line ? ["rider"] : [])];
    for (const kind of kinds) {
      await k("globalThis.causalis.life.liveHere()");
      await until("the sheet of lives", () => k<boolean>("globalThis.causalis.life.pickerOpen()"));
      await page.waitForTimeout(slow(1500));
      const today =
          Math.floor((await k<number>("globalThis.causalis.client.status?.t ?? 0")) / 86400) + 1,
        one = await k<{ index: number; agent: number; from: number; to: number } | null>(
          `(() => {
            const c = globalThis.causalis, r = c.townRides(), people = c.planNow().people;
            for (const i of r.${kind === "owner" ? "owners" : "riders"}) {
              const p = people[i], w = c.townWalks(i, ${today});
              if (p && !p.figure && !p.child && String(p.ref).startsWith("agent:") && w.length && w[0].from > 3 * 3600 && w[0].to - w[0].from > 60)
                return { index: i, agent: Number(p.ref.slice(6)), from: w[0].from, to: w[0].to };
            }
            return null;
          })()`,
        );
      check(!!one, `no ${kind} in the town to live as, with the hand on it`);
      if (!one) break;
      say(
        `lived: the ${kind} ${one.index}, agent ${one.agent}, gone from ${(one.from / 3600).toFixed(2)} h to ${(one.to / 3600).toFixed(2)} h`,
      );
      await k(`globalThis.causalis.life.begin(${one.agent})`);
      await until(
        "the strip",
        async () => !!(await k<unknown>("globalThis.causalis.life.state()")),
      );
      await page.waitForTimeout(slow(1500));
      // (The clock stopped with the strip's own button, at the middle of their ride.)
      await page.evaluate(() => {
        const b = [...document.querySelectorAll(".life-strip button")].find((x) =>
          /❚❚/.test(x.textContent || ""),
        ) as HTMLElement | undefined;
        b?.click();
      });
      await page.waitForTimeout(slow(600));
      const mid = Math.round(today * 86400 + (one.from + one.to) / 2);
      await k(`globalThis.causalis.client.advance(${mid})`);
      await page.waitForTimeout(slow(2200));
      const a2 = await k<{ x: number; z: number } | null>("globalThis.causalis.life.where()"),
        riding = await k<boolean>("globalThis.causalis.life.walkingNow()");
      check(riding, `one lived isn't going, in the middle of their ride (the ${kind})`);
      await shot(`10-live-${kind}`);
      await k(`globalThis.causalis.client.advance(${mid + 20})`);
      await page.waitForTimeout(slow(1500));
      const b2 = await k<{ x: number; z: number } | null>("globalThis.causalis.life.where()"),
        moved = a2 && b2 ? Math.hypot(a2.x - b2.x, a2.z - b2.z) : 0,
        now2 = await k<{ carsAt: { index: number; wx: number; wz: number; riding: boolean }[] }>(
          "globalThis.causalis.townRides()",
        ),
        strip = await k<string>(
          `(() => { const e = document.querySelector(".life-strip"); return e ? e.innerText : ""; })()`,
        ),
        hidden = await k<string>(
          `(() => { const w = document.querySelector(".life-doing, .life-now"); return w ? w.innerText : ""; })()`,
        ),
        car = now2.carsAt.find((c) => c.index === one.index);
      await shot(`10-live-${kind}-on`);
      say(
        `riding: the ${kind} went ${moved.toFixed(1)} m in 20 s of the clock; words: ${strip.slice(0, 240).replace(/\n/g, " | ")} ${hidden}`,
      );
      check(moved > 1, `one lived did not go anywhere on their ride (${moved.toFixed(2)} m)`);
      check(!BAD.test(strip), `bad words on the strip: ${strip.slice(0, 200)}`);
      if (kind === "owner") {
        check(!!car?.riding, "their car did not go with them");
        if (car && b2)
          check(
            Math.hypot(car.wx - b2.x, car.wz - b2.z) < 3,
            `their car is ${Math.hypot(car.wx - b2.x, car.wz - b2.z).toFixed(1)} m from them`,
          );
      }
      // Let go: back to the town, for the next.
      await page.evaluate(() =>
        (document.querySelector(".life-letgo") as HTMLElement | null)?.click(),
      );
      const gone = await until(
        "letting go of a life",
        async () => {
          await page.evaluate(() => {
            const w = [
              ...document.querySelectorAll(
                ".page-window:not([hidden]) button, .life-window button",
              ),
            ].find((x) => /let go/i.test(x.textContent || "")) as HTMLElement | undefined;
            w?.click();
          });
          return !(await k<unknown>("globalThis.causalis.life.state()"));
        },
        30000,
      );
      if (!gone) break;
      await page.waitForTimeout(slow(1200));
    }
  }

  check(!errors.length, `page errors: ${errors.slice(0, 3).join(" / ")}`);
  await browser.close();
  await server.close();
}
if (problems.length) {
  console.log(`gate 101 FAILED:\n  - ${problems.join("\n  - ")}`);
  process.exit(1);
}
console.log("gate 101 passed");
process.exit(0);

