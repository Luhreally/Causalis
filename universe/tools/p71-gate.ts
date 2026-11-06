// node tools/p71-gate.ts [--ci] [--soft] [--shots dir] [--save file.save]: gate 84, trade among the stars (galaxy-plan.md, Phase 71, first slice), at a phone's size.
// On a far save with real runs, else (as on CI) a young world given a colony and runs for the eye to read:
//   1. the numbers: what clears a crossing is one function: a lane opens goods a drive's crossing shuts; a hold spoils on its way;
//   2. the 🚀 list offers a colony's port, pressed by touch: the eye comes to it, its pads and craft in the pixels;
//   3. a busy port beside a quiet one, in the pixels: more lit pads and craft, and the screens unlike;
//   4. its chip pressed by touch: the run's page says what, from where, why, what the crossing costs, who gains and what it did;
//   5. the paths nobody watches: a colony nothing comes to and why; a people with nothing anyone wants; a run a war closed; a raid told as what it is. No error in the page.
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";
import { preview } from "vite";
import { chromium, type Page } from "playwright";
import {
  YEAR,
  loadWorld,
  makeRef,
  rulesetId,
  saveWorld,
  seedFromText,
  type Ref,
  type World,
} from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import {
  G,
  GOODS,
  STAR_DRIVES,
  crossingBy,
  crossingByLanes,
  marginOf,
  survives,
  type LaneRoute,
} from "../src/rules/index.ts";
import {
  RUN,
  folksNear,
  folkStage,
  homePlanet,
  politiesOf,
  populationContext,
  tradeOf,
  type StarRun,
} from "../src/sim/index.ts";
import { settle } from "../src/sim/space/space.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  shots = arg("--shots"),
  saveFile = arg("--save");
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
console.log("gate 84, trade among the stars");

// 1. The numbers: one function, and a lane against a drive.
{
  const way: LaneRoute = {
      hops: 2,
      ly: 10,
      jump: 2.5,
      mouths: 0.08,
      tonnes: 200,
      stars: [0, 1, 2],
      tides: [0.01, 0.01],
      lengths: [5, 5],
    },
    fusion = STAR_DRIVES[0]!,
    drive = crossingBy(fusion, 10),
    lane = crossingByLanes(fusion, way),
    clears = (c: typeof drive, here: number, there: number, g: number) =>
      marginOf(g, here, there, c, 8, 0) > 0;
  say(
    `10 ly: ${Math.round(drive.years)} years, ${Math.round(drive.machines)} machines a tonne on its drive; ${Math.round(lane.years)} years, ${Math.round(lane.machines)} by lanes`,
  );
  check(lane.machines < drive.machines / 4, "a lane does not make the crossing cheap");
  check(
    clears(drive, 8, 72, G.machines),
    "machines at their dearest do not clear a drive's crossing",
  );
  check(!clears(drive, 1, 9, G.pottery), "pots clear a drive's crossing");
  check(clears(lane, 1, 9, G.pottery), "pots do not clear a lane's crossing");
  check(!clears(lane, 0.5, 1.5, G.grain), "grain clears ten light-years even by lanes");
  check(survives(G.meat, 50) < 0.01, "meat survives fifty years under way");
  check(survives(G.machines, 500) === 1, "machines spoil under way");
}

type Forged = {
  readonly bytes: Buffer;
  readonly universe: "earth" | "alien";
  readonly seed: string;
  readonly world: World;
};

function pack(world: World, universe: "earth" | "alien"): Forged {
  const u = universe === "earth" ? EARTH : ALIEN;
  return {
    bytes: gzipSync(
      JSON.stringify(saveWorld(world, rulesetId(world, u.version), { universe: u.name })),
    ),
    universe,
    seed: world.seed.text,
    world,
  };
}

/** A run for the eye, on a land that has people. */
function forgedRun(
  world: World,
  n: number,
  to: number,
  from: number,
  year: number,
  o: Partial<StarRun>,
): StarRun {
  const any = world.events.at(0).id as Ref,
    star = homePlanet(world).generated.star.ref as Ref,
    realm = politiesOf(world).living()[0]!,
    prices = GOODS.map((g) => g.value);
  return {
    ref: makeRef(RUN, 0, n),
    from,
    to,
    civ: null,
    fromStar: star,
    toStar: star,
    planet: -1,
    realm: realm.ref,
    name: realm.town,
    house: { name: "the house of Orvan", cell: from, worth: 3_000_000, rich: null },
    drive: "system",
    ly: 0,
    hops: 0,
    years: 1,
    machinesTonne: 1.3,
    year,
    opened: any,
    first: any,
    firstYear: year,
    landed: GOODS.map((_, g) => (g === G.pottery ? 500_000 : g === G.machines ? 20_000 : 0)),
    lost: GOODS.map(() => 0),
    ships: 40,
    raided: 0,
    lastIn: year,
    lastOut: year,
    lastRaid: null,
    lastRaidYear: 0,
    raider: null,
    risk: 0,
    before: {
      people: 500,
      tools: 1000,
      clothing: 100,
      pottery: 0,
      machines: 0,
      prices: prices.map((p) => p * 3),
      here: prices.map((p) => p / 3),
    },
    under: [],
    closed: null,
    closedYear: null,
    closedWhy: null,
    ...o,
  };
}

/** A young world given three lands away: one a busy port, of two peoples; one whose run a war closed; one nothing comes to. */
function forgeYoung(): Forged {
  const world = EARTH.build(seedFromText("first light"));
  world.runTo(40 * YEAR);
  const ctx = populationContext(world),
    g = ctx.generated as unknown as {
      offworld: { base: number; sites: { body: number }[] };
    },
    realm = politiesOf(world).living()[0]!,
    seat = ctx.provinces.get(realm.seat)!,
    any = world.events.at(0).id as Ref,
    bodies = g.offworld.sites
      .map((s, i) => ({ s, cell: g.offworld.base + i }))
      .filter((x) => x.s.body >= 0)
      .slice(0, 3);
  for (const b of bodies) settle(ctx, realm, seat, b.cell, any, any, 40);
  world.runTo(41 * YEAR);
  const store = tradeOf(world)!,
    [busy, closed] = bodies;
  store.add(forgedRun(world, 0, busy!.cell, realm.seat, 38, {}));
  store.add(
    forgedRun(world, 1, busy!.cell, realm.seat, 38, {
      name: "the Far Carriers",
      civ: "civ:0:1" as Ref,
      house: { name: "the Far Carriers", cell: -1, worth: 1, rich: null },
    }),
  );
  store.add(forgedRun(world, 2, busy!.cell, realm.seat, 39, {}));
  store.add(
    forgedRun(world, 3, closed!.cell, realm.seat, 30, {
      closed: any,
      closedYear: 39,
      closedWhy: "war",
      raided: 2,
      raider: "Those at war with it",
      lastRaid: any,
      lastRaidYear: 38,
      lost: GOODS.map((_, g) => (g === G.machines ? 40_000 : 0)),
    }),
  );
  store.first = any;
  return pack(world, "earth");
}

/** A far save, a year on, one run forged shut by a war and one by its world's going, so those paths can be read. */
function fromFile(file: string): Forged {
  const universe = file.includes("earth--") ? "earth" : "alien",
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

const made = saveFile ? fromFile(saveFile) : forgeYoung();

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4284, strictPort: false } }),
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
    await page.waitForTimeout(80);
  }
  problems.push(`${what} did not come`);
  return false;
};
const settleFor = (ms: number) => page.waitForTimeout(slow(ms));
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};
const ask = <T>(type: string, args: unknown = {}) =>
  k<T>(
    `globalThis.causalis.client.query({ type: ${JSON.stringify(type)}, args: ${JSON.stringify(args)} })`,
  );

async function loadSave(f: Forged) {
  const name = `${f.universe}:gate84`,
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
    [f.bytes.toString("base64"), name],
  );
  await page.goto(`${base}?${q}&load=${encodeURIComponent(name)}&hold=1`);
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: slow(180000) },
  );
  await k("globalThis.causalis.client.setSpeed(0)");
}

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

/** What a shot of a port holds: lit rims and beacons (amber and red, bright), and how many pixels are plainly of the port's stacks. */
async function portPixels(d: string): Promise<{ amber: number; stacks: number; hull: number }> {
  return page.evaluate(async (data) => {
    const bm = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob()),
      c = new OffscreenCanvas(bm.width, bm.height),
      x = c.getContext("2d")!;
    x.drawImage(bm, 0, 0);
    const k = bm.width / innerWidth,
      top = Math.round(120 * k),
      h = Math.round(600 * k),
      w = bm.width,
      px = x.getImageData(0, top, w, h).data;
    let amber = 0,
      stacks = 0,
      hull = 0;
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i]!,
        g = px[i + 1]!,
        b = px[i + 2]!;
      if (r > 230 && g > 150 && g < 215 && b < 90) amber++;
      if ((r > 170 && g > 70 && g < 130 && b < 60) || (b > 130 && r < 90 && g > 80 && g < 150))
        stacks++;
      if (r > 175 && g > 175 && b > 175 && Math.abs(r - b) < 18) hull++;
    }
    return { amber: amber / (k * k), stacks: stacks / (k * k), hull: hull / (k * k) };
  }, d);
}

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
          return { x, w: bm.width, h: bm.height };
        },
        A = await load(a as string),
        B = await load(b as string),
        pa = A.x.getImageData(0, 0, A.w, A.h).data,
        pb = B.x.getImageData(0, 0, A.w, A.h).data;
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

/** Down to a port by touch, from the 🚀 list. */
async function toPort(cell: number, tag: string): Promise<string> {
  await until("the 🚀 button", () => page.isVisible(".colonies-button"));
  await press(".colonies-button");
  await until("the 🚀 list", () => k<boolean>(`!document.querySelector(".colony-sheet").hidden`));
  await settleFor(300);
  await shot(`${tag}-list`);
  const sel = `.colony-port[data-cell="${cell}"]`;
  await until(`the port's row of ${cell}`, () =>
    k<boolean>(`!!document.querySelector(${JSON.stringify(sel)})`),
  );
  await press(sel);
  await until(
    `the port of ${cell} under the eye`,
    () => k<boolean>(`!!globalThis.causalis.portNow?.()?.chip`),
    slow(90000),
  );
  await settleFor(5500);
  await shot(`${tag}-port`);
  return (await page.screenshot()).toString("base64");
}

await loadSave(made);
await settleFor(1500);
type Row = {
  ref: string;
  to: number;
  from: number;
  civ: string | null;
  ships: number;
  raided: number;
  hops: number;
  ly: number;
  closed: string | null;
  event: string | null;
};
const rows = await ask<Row[]>("trade.list"),
  colonies =
    await ask<
      { cell: number; town: string | null; port?: boolean; star: string | null; people: number }[]
    >("colony.list");
say(
  `${rows.length} runs kept, ${rows.filter((r) => !r.closed).length} running, ${rows.filter((r) => r.hops).length} by lanes, ${rows.filter((r) => r.raided).length} raided, ${colonies.filter((c) => c.port).length} ports`,
);
check(rows.length > 0, "no run in this world");

const byPort = new Map<number, Row[]>();
for (const r of rows) byPort.set(r.to, [...(byPort.get(r.to) ?? []), r]);
const ports = colonies
  .filter((c) => c.port && c.town)
  .map((c) => ({ c, open: (byPort.get(c.cell) ?? []).filter((r) => !r.closed).length }));
ports.sort((a, b) => b.open - a.open);
const busiest = ports[0],
  quietest = [...ports].reverse().find((p) => p.c.cell !== busiest?.c.cell);
check(!!busiest && !!quietest, "fewer than two ports to set side by side");
let busyShot = "";
if (busiest) {
  busyShot = await toPort(busiest.c.cell, "busy");
  const now = await k<{
    standing: number;
    flying: number;
    far: number;
    near: number;
    chip: string;
  } | null>("globalThis.causalis.portNow()");
  say(`busy port ${busiest.c.cell}: ${busiest.open} runs; ${JSON.stringify(now)}`);
  check((now?.standing ?? 0) + (now?.flying ?? 0) > 0, "no craft at the busy port");
  check(/call/.test(now?.chip ?? ""), `the chip says "${now?.chip}"`);
  // 4. Its chip, by touch: the run's page.
  await press(".port-chip");
  await until("the run's page", () => k<boolean>(`/Why it runs/i.test(document.body.innerText)`));
  await settleFor(600);
  await shot("run-page");
  // (The chip lies over no word of the page it opened: at phone size it stood on "Why it runs".)
  const chipOver = await k<boolean>(
    `(() => { const c = document.querySelector(".port-chip"); return !!c && !c.hidden && getComputedStyle(c).visibility !== "hidden"; })()`,
  );
  check(!chipOver, "the port's chip lies over the page it opened");
  const said = await k<string>("document.body.innerText");
  for (const [word, what] of [
    [/Carries/i, "what is carried"],
    [/From/i, "from where"],
    [/short there, plenty here/, "why"],
    [/machines to carry/, "what the crossing costs"],
    [/has cleared/, "who gains"],
    [/What it did/i, "what it did"],
    [/when this opened/, "what it did, from its numbers"],
  ] as const)
    check(word.test(said), `the run's page does not say ${what}`);
  await k("globalThis.causalis.closePage?.()");
}
// 3. A busy port beside a quiet one.
if (quietest && busyShot) {
  await loadSave(made);
  await settleFor(1200);
  const quietShot = await toPort(quietest.c.cell, "quiet"),
    a = await portPixels(busyShot),
    b = await portPixels(quietShot),
    apart = await unlike(busyShot, quietShot);
  say(
    `busy ${JSON.stringify(a)}; quiet ${JSON.stringify(b)}; ${(apart * 100).toFixed(1)}% of the screen differs`,
  );
  check(a.amber > 60, `the busy port shows ${Math.round(a.amber)} lit pad pixels`);
  check(
    a.amber > b.amber * 1.4,
    `busy ${Math.round(a.amber)} lit pad pixels against quiet ${Math.round(b.amber)}`,
  );
  check(
    apart > 0.04,
    `only ${(apart * 100).toFixed(1)}% of the screen differs between the two ports`,
  );
}
// A port another people's ships call at, among ours.
{
  const far = rows.find(
    (r) => r.civ && !r.closed && colonies.some((c) => c.cell === r.to && c.town),
  );
  say(far ? `a far people's run: ${far.ref} to ${far.to}` : "no far people's run here");
  if (far) {
    await loadSave(made);
    await settleFor(1200);
    await toPort(far.to, "far-people");
    let seen = 0;
    for (let i = 0; i < 40 && !seen; i++) {
      seen = (await k<{ far: number } | null>("globalThis.causalis.portNow()"))?.far ?? 0;
      if (!seen) await settleFor(1500);
    }
    await shot("far-people-port");
    check(seen > 0, "no far people's craft came to the port they run to");
    await k("globalThis.causalis.closePage?.()");
  }
}
// 5. The paths nobody watches.
{
  const none = colonies.find((c) => !c.port && c.town);
  await k("globalThis.causalis.closePage?.()");
  if (none) {
    await k(`globalThis.causalis.open("cell:0:${none.cell}")`);
    await until("a colony nothing comes to", () =>
      k<boolean>(`/What comes here from other worlds/i.test(document.body.innerText)`),
    );
    // (Its words where the eye can read them: they stand under the land's numbers.)
    await k(
      `[...document.querySelectorAll(".page-body *")].filter((e) => /What comes here from other worlds/i.test(e.textContent ?? "")).pop()?.scrollIntoView({ block: "start" })`,
    );
    await settleFor(500);
    await shot("no-port-page");
    const said = await k<string>("document.body.innerText");
    check(
      /shortest of|no realm is yet in the sky/.test(said),
      "a colony nothing comes to does not say why, from its numbers",
    );
    await k("globalThis.causalis.closePage?.()");
  } else say("every colony here has a port");
  const year = Math.floor(made.world.now / YEAR),
    camps = folksNear(made.world).find((f) => !f.followed && folkStage(f, year) === "camps");
  check(!!camps, "no people in camps to read");
  if (camps) {
    await k(`globalThis.causalis.open(${JSON.stringify(camps.ref)})`);
    await until("a people in camps", () =>
      k<boolean>(`/No one trades with them/.test(document.body.innerText)`),
    );
    await k(
      `[...document.querySelectorAll(".page-body *")].filter((e) => /No one trades with them/.test(e.textContent ?? "")).pop()?.scrollIntoView({ block: "center" })`,
    );
    await settleFor(500);
    await shot("camps-page");
    await k("globalThis.causalis.closePage?.()");
  }
  const shut = rows.find((r) => r.closed === "war") ?? rows.find((r) => r.closed);
  check(!!shut, "no run has ended");
  if (shut) {
    await k(`globalThis.causalis.open(${JSON.stringify(shut.ref)})`);
    await until("a run ended", () =>
      k<boolean>(`/It ended in year/.test(document.body.innerText)`),
    );
    await settleFor(500);
    await shot("ended-page");
    await k("globalThis.causalis.closePage?.()");
  }
  const hit = rows.find((r) => r.raided && r.event);
  check(!!hit, "no hold has been taken");
  if (hit) {
    await k(`globalThis.causalis.open(${JSON.stringify(hit.ref)})`);
    await until("a run raided", () =>
      k<boolean>(`/taken on the way/.test(document.body.innerText)`),
    );
    await settleFor(500);
    await shot("raided-page");
    await k("globalThis.causalis.closePage?.()");
  }
  await k(`globalThis.causalis.open("world:trade")`);
  await until("the page of all of it", () =>
    k<boolean>(`/What crosses, and why/i.test(document.body.innerText)`),
  );
  await settleFor(500);
  await shot("trade-page");
  await k("globalThis.causalis.closePage?.()");
}
if (errors.length) problems.push(`errors on the page:\n${errors.slice(0, 5).join("\n")}`);
await browser.close();
await server.close();
if (problems.length) {
  console.log(`gate 84 FAILED:\n- ${problems.join("\n- ")}`);
  process.exitCode = 1;
} else console.log("gate 84 passed");
process.exit();
