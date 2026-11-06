// node tools/p70b-gate.ts [--ci] [--soft] [--shots dir] [--early a.save] [--late b.save]: gate 82, worlds filled (galaxy-plan.md "Worlds filled"), at a phone's size. On two far saves of one seed, else (as on CI) a young world given the same world at two shares:
//   1. the 🚀 list offers each world, and it is pressed by touch;
//   2. the world at the earlier year and the later, side by side: its lit ground in the pixels, the later many times the earlier, and the screens unlike;
//   3. a world that can never fill: what its panel says, and its page, pressed by touch;
//   4. a world filled to what it can hold: what happens after, on its page;
//   5. every world on one page; the 👥 list; a filled world's event sends the eye to it. Watching leaves history as it was.
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";
import { preview } from "vite";
import { chromium, type Page } from "playwright";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  type Ref,
  type World,
} from "../src/kernel/index.ts";
import { EARTH, ALIEN } from "../src/host/planet.ts";
import {
  clusterOf,
  filledOf,
  fillGround,
  homePlanet,
  politiesOf,
  worldsOf,
} from "../src/sim/index.ts";
import { fillReading, habitability } from "../src/rules/index.ts";
import type { FillPlan } from "../src/bridge/index.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  shots = arg("--shots"),
  earlyFile = arg("--early"),
  lateFile = arg("--late");
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
console.log("gate 82, worlds filled");

type Forged = {
  readonly bytes: Buffer;
  readonly universe: "earth" | "alien";
  readonly seed: string;
  readonly world: World;
};

const uni = (file?: string): "earth" | "alien" =>
  !file || file.includes("earth--") ? "earth" : "alien";

function pack(world: World, universe: "earth" | "alien"): Forged {
  const u = universe === "earth" ? EARTH : ALIEN,
    bytes = gzipSync(
      JSON.stringify(saveWorld(world, rulesetId(world, u.version), { universe: u.name })),
    );
  return { bytes, universe, seed: world.seed.text, world };
}

/** A far save, a year on: its worlds are read into the store at its first year under this rule. */
function fromFile(file: string): Forged {
  const universe = uni(file),
    u = universe === "earth" ? EARTH : ALIEN,
    doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as Parameters<
      typeof loadWorld
    >[0],
    probe = u.build(seedFromText(doc.seed)),
    world = loadWorld(doc, (s) => u.build(s), rulesetId(probe, u.version), {
      allowRulesetChange: true,
    }).world;
  world.runTo(world.now + YEAR);
  return pack(world, universe);
}

/** A young world given a colony no land holds on a world of another star, at a share; and one sealed world at the top. */
function forgeYoung(share: number): Forged {
  const world = EARTH.build(seedFromText("first light"));
  world.runTo(40 * YEAR);
  const store = filledOf(world)!,
    g = homePlanet(world).generated,
    home = g.system.bodies[0]!,
    realm = politiesOf(world).living()[0]!,
    any = world.events.at(0).id as Ref,
    body = g.life.people?.body ?? null,
    found: { star: string; planet: number; upkeep: number }[] = [];
  for (const s of clusterOf(world)) {
    for (const p of worldsOf(world, s)) {
      const h = habitability(p, body, home.gravity);
      if (h.livable && p.water !== "seas")
        found.push({ star: s.ref, planet: p.index, upkeep: h.upkeep });
    }
    if (found.length >= 2) break;
  }
  const add = (at: (typeof found)[number], key: string, people: (spread: number) => number) => {
    const ground = fillGround(world, {
        key,
        body: -1,
        star: at.star as Ref,
        planet: at.planet,
      })!,
      r = fillReading(ground, body, home.gravity, home.air, 0, { vats: false, towers: false }),
      n = people(r.spread),
      full = n >= r.spread * 0.98;
    store.add({
      key,
      body: -1,
      star: at.star as Ref,
      planet: at.planet,
      cell: null,
      realm: realm.ref,
      name: realm.town,
      from: realm.seat,
      sailed: 5,
      arrives: 8,
      distance: 12,
      drive: "gate",
      lanes: 0,
      comers: 0,
      held: null,
      voyage: any,
      arrived: any,
      people: Math.round(n),
      filled: full ? any : null,
      filledYear: full ? 30 : null,
    });
  };
  add(found[0]!, `${found[0]!.star}/${found[0]!.planet}`, (whole) => whole * share);
  add(found[1]!, `${found[1]!.star}/${found[1]!.planet}`, () => 1e12);
  return pack(world, "earth");
}

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4282, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  });
const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: ci || soft ? 1 : 2,
    hasTouch: true,
    isMobile: true,
  }),
  page: Page = await context.newPage(),
  errors: string[] = [];
page.setDefaultTimeout(slow(60000));
page.on("pageerror", (e) => errors.push(`${e.message}\n${e.stack ?? ""}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;
const until = async (what: string, ok: () => Promise<boolean>, ms = slow(25000)) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await page.waitForTimeout(60);
  }
  problems.push(`${what} did not come`);
  return false;
};
const settle = (ms: number) => page.waitForTimeout(slow(ms));
const ask = <T>(type: string, args: unknown = {}) =>
  k<T>(
    `globalThis.causalis.client.query({ type: ${JSON.stringify(type)}, args: ${JSON.stringify(args)} })`,
  );

async function loadSave(f: Forged) {
  const name = `${f.universe}:gate82`,
    q = `universe=${f.universe}&seed=${encodeURIComponent(f.seed)}`;
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
  const b64 = f.bytes.toString("base64");
  await page.evaluate(
    async ([data, keep]) => {
      const bytes = Uint8Array.from(atob(data as string), (c) => c.charCodeAt(0));
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
      await c.importSave(bytes);
      await c.save(keep as string);
    },
    [b64, name],
  );
  await page.goto(`${base}?${q}&load=${encodeURIComponent(name)}&hold=1`);
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: slow(180000) },
  );
  await k("globalThis.causalis.client.setSpeed(0)");
}

const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};
const b64Shot = async () => (await page.screenshot()).toString("base64");

/** A tap by a finger, on the first thing that matches and shows. */
async function press(selector: string): Promise<boolean> {
  const at = await k<{ x: number; y: number } | null>(`(() => {
    for (const e of document.querySelectorAll(${JSON.stringify(selector)})) {
      e.scrollIntoView({ block: "center" });
      const r = e.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    return null;
  })()`);
  if (!at) {
    problems.push(`nothing to press at ${selector}`);
    return false;
  }
  await page.waitForTimeout(slow(150));
  await page.touchscreen.tap(at.x, at.y);
  await page.waitForTimeout(slow(350));
  say(`pressed ${selector} at ${Math.round(at.x)},${Math.round(at.y)}`);
  return true;
}

/** What a shot holds of a globe's lit and built ground: warm bright pixels, over the globe's own part of the screen. */
async function lightsOf(d: string): Promise<{ warm: number; width: number }> {
  return page.evaluate(async (data) => {
    const bm = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob()),
      c = new OffscreenCanvas(bm.width, bm.height),
      x = c.getContext("2d")!;
    x.drawImage(bm, 0, 0);
    const k = bm.width / innerWidth,
      top = Math.round(170 * k),
      h = Math.round(290 * k),
      w = bm.width,
      px = x.getImageData(0, top, w, h).data,
      far = Math.round(3 * k),
      luma = (i: number) => 0.3 * px[i]! + 0.6 * px[i + 1]! + 0.1 * px[i + 2]!;
    let warm = 0;
    for (let row = far; row < h - far; row++)
      for (let col = far; col < w - far; col++) {
        const i = 4 * (row * w + col);
        if (px[i]! < 225 || px[i + 1]! < 190 || px[i + 2]! > 200) continue;
        const me = luma(i) - 70;
        // (Darker on all four sides, a few pixels off: a point of light, not a sunlit slope or a label.)
        if (
          luma(i - 4 * far) < me &&
          luma(i + 4 * far) < me &&
          luma(i - 4 * far * w) < me &&
          luma(i + 4 * far * w) < me
        )
          warm++;
      }
    return { warm: warm / (k * k), width: bm.width };
  }, d);
}

/** How unlike two shots are, over the globe's part of the screen: the share of pixels that differ plainly. */
async function unlike(a: string, b: string): Promise<number> {
  return page.evaluate(
    async ([a, b]) => {
      const load = async (d: string) => {
          const bm = await createImageBitmap(
              await (await fetch(`data:image/png;base64,${d}`)).blob(),
            ),
            c = new OffscreenCanvas(bm.width, bm.height),
            x = c.getContext("2d")!;
          x.drawImage(bm, 0, 0);
          return { x, w: bm.width, k: bm.width / innerWidth };
        },
        A = await load(a as string),
        B = await load(b as string),
        top = Math.round(70 * A.k),
        h = Math.round(430 * A.k),
        pa = A.x.getImageData(0, top, A.w, h).data,
        pb = B.x.getImageData(0, top, A.w, h).data;
      let n = 0;
      for (let i = 0; i < pa.length; i += 4)
        if (
          Math.abs(pa[i]! - pb[i]!) +
            Math.abs(pa[i + 1]! - pb[i + 1]!) +
            Math.abs(pa[i + 2]! - pb[i + 2]!) >
          60
        )
          n++;
      return n / (pa.length / 4);
    },
    [a, b] as const,
  );
}

/** Press the 🚀 list and a world's own row: out to it, its lights read and drawn. */
async function goToWorld(plan: FillPlan): Promise<void> {
  await until("the 🚀 button", () => page.isVisible(".colonies-button"));
  await press(".colonies-button");
  await until("the 🚀 list", () => k<boolean>(`!document.querySelector(".colony-sheet").hidden`));
  await settle(300);
  await shot(`list-${plan.key.replace(/[^a-z0-9]/gi, "_")}`);
  const sel =
    plan.cell !== null
      ? `.colony-world[data-cell="${plan.cell}"]`
      : `.colony-world[data-key="${plan.key}"]`;
  await until(`the row of ${plan.key}`, () =>
    k<boolean>(`!!document.querySelector(${JSON.stringify(sel)})`),
  );
  await press(sel);
  await until(`${plan.key} drawn`, () =>
    k<boolean>(`globalThis.causalis.fillShown?.()?.key === ${JSON.stringify(plan.key)}`),
  );
  await settle(1200);
}

/** The worlds of one seed at two moments. */
async function pair(early: Forged, late: Forged, tag: string, pick?: (p: FillPlan) => boolean) {
  await loadSave(late);
  await settle(1500);
  const lateList = await ask<FillPlan[]>("filled.list");
  say(`${tag}: ${lateList.length} worlds in the later save`);
  const target =
    lateList.find((p) => !p.sailing && p.share > 0.05 && p.filled === null) ??
    lateList.find(
      (p) => !p.sailing && p.share > 0.05 && (pick ? pick(p) : !p.whole) && p.cell !== null,
    ) ??
    lateList.find((p) => !p.sailing && p.share > 0.05 && (pick ? pick(p) : true));
  check(!!target, `${tag}: no world far along in the later save`);
  if (!target) return;
  await goToWorld(target);
  const headLate = await k<string>(`document.querySelector(".fill-head")?.textContent ?? ""`),
    lateShot = await b64Shot(),
    lateLit = await k<{ lit: number; cells: number; share: number } | null>(
      "globalThis.causalis.fillShown()",
    );
  await shot(`${tag}-late`);
  check(/settled/.test(headLate), `${tag}: the later panel told "${headLate}"`);

  await loadSave(early);
  await settle(1500);
  const earlyPlan = (await ask<FillPlan[]>("filled.list")).find((p) => p.key === target.key);
  check(!!earlyPlan, `${tag}: ${target.key} is not in the earlier save`);
  if (!earlyPlan) return;
  await goToWorld(earlyPlan);
  const headEarly = await k<string>(`document.querySelector(".fill-head")?.textContent ?? ""`),
    earlyShot = await b64Shot(),
    earlyLit = await k<{ lit: number; cells: number; share: number } | null>(
      "globalThis.causalis.fillShown()",
    );
  await shot(`${tag}-early`);
  const a = await lightsOf(earlyShot),
    b = await lightsOf(lateShot),
    apart = await unlike(earlyShot, lateShot);
  say(
    `${tag}, ${target.key}: earlier "${headEarly}" (${earlyLit?.lit} cells of ${earlyLit?.cells}, ${Math.round(a.warm)} warm px); later "${headLate}" (${lateLit?.lit} cells, ${Math.round(b.warm)} warm px); ${(apart * 100).toFixed(1)}% of the globe's part of the screen differs`,
  );
  check(
    b.warm > 40,
    `${tag}: the later world shows ${Math.round(b.warm)} points of light: not lit across its face`,
  );
  check(
    b.warm > a.warm * 3,
    `${tag}: later ${Math.round(b.warm)} points of light against earlier ${Math.round(a.warm)}`,
  );
  check(
    apart > 0.03,
    `${tag}: only ${(apart * 100).toFixed(1)}% of the screen differs between the two`,
  );
  check(/settled/.test(headEarly), `${tag}: the earlier panel told "${headEarly}"`);
}

/** The path nobody watches: a world that can never fill, and one at the top. */
async function ends(f: Forged, tag: string) {
  await loadSave(f);
  await settle(1200);
  const list = await ask<FillPlan[]>("filled.list"),
    never =
      list.find(
        (p) => !p.sailing && p.filled !== null && p.why.some((w) => /never fill/.test(w)),
      ) ??
      list.find((p) => !p.sailing && !p.open && p.top < 1 && p.filled !== null) ??
      null,
    whole = list.find((p) => p.whole) ?? null;
  check(!!never, `${tag}: no world at the top of what it can hold`);
  say(`${tag}: at its top ${never?.key}; filled whole ${whole?.key ?? "none here"}`);
  if (never) {
    await loadSave(f);
    await settle(1200);
    await goToWorld(never);
    await shot(`${tag}-never`);
    await press(".fill-why");
    const text = await until(`${tag}: the page of a world that cannot fill`, () =>
      k<boolean>(`/Too few|never fill|no more|since year/i.test(document.body.innerText)`),
    );
    await settle(600);
    const said = text ? await k<string>(`document.body.innerText`) : "";
    await shot(`${tag}-never-page`);
    check(
      /no more|never fill|at most as yet/i.test(said),
      `${tag}: the page of a world that cannot fill does not say so`,
    );
    check(/roofs|sealed|open sky/.test(said), `${tag}: the page does not say what stops it`);
    check(/since year/.test(said), `${tag}: the page does not say what happened after it was full`);
    await k("globalThis.causalis.closePage?.()");
  }
  if (whole) {
    await loadSave(f);
    await settle(1200);
    await goToWorld(whole);
    await shot(`${tag}-whole`);
    await press(".fill-why");
    await until(`${tag}: the page of a world filled`, () =>
      k<boolean>(`/to its edges|All of it/i.test(document.body.innerText)`),
    );
    const said = await k<string>(`document.body.innerText`);
    await settle(600);
    await shot(`${tag}-whole-page`);
    check(
      /to its edges|All of it/.test(said),
      `${tag}: the page of a world filled does not say so`,
    );
    check(
      /rising|full/.test(said),
      `${tag}: the page does not say what comes after a world is full`,
    );
    await k("globalThis.causalis.closePage?.()");
  }
  // Every world on one page, from the 🚀 list.
  await loadSave(f);
  await settle(1200);
  await press(".colonies-button");
  await until("the 🚀 list", () => k<boolean>(`!document.querySelector(".colony-sheet").hidden`));
  await press(".colony-filled-all");
  await until(`${tag}: the page of every world`, () =>
    k<boolean>(`/People on them/i.test(document.body.innerText)`),
  );
  await settle(500);
  await shot(`${tag}-every`);
  await k("globalThis.causalis.closePage?.()");
}

if (earlyFile && lateFile) {
  const early = fromFile(earlyFile),
    late = fromFile(lateFile);
  await pair(early, late, "far");
  await ends(late, "far");
} else {
  const early = forgeYoung(0.01),
    late = forgeYoung(0.9);
  await pair(early, late, "young");
  await ends(late, "young");
}

if (errors.length) problems.push(`errors on the page:\n${errors.slice(0, 5).join("\n")}`);
await browser.close();
await server.close();
if (problems.length) {
  console.log(`gate 82 FAILED:\n- ${problems.join("\n- ")}`);
  process.exitCode = 1;
} else console.log("gate 82 passed");
process.exit();
