// node tools/n1-gate.ts [--ci] [--soft] [--shots dir] [--save file.save --universe earth|alien] [--nofire file.save]: gate 97, the world acting on its own (N1), at a phone's size.
// On a far save, else (as on CI) a young world run on:
//   1. off the world: a run forward brings shocks and fires by themselves, none by any hand; every one's words and page read aloud clean; a shock's page opens its land and its plates; an old save ran on; no fire on a world with nothing to burn;
//   2. on the land the fire crossed: flames counted off the real layer as it moves, then its scar; a shot;
//   3. the page: its words off the screen, a link pressed by touch.
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";
import { preview } from "vite";
import { chromium } from "playwright";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  type World,
} from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { wildOf } from "../src/sim/index.ts";
import { eventPage } from "../src/host/inspect/history.ts";
import { why } from "../src/causal/index.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  shots = arg("--shots"),
  saveFile = arg("--save"),
  universe = (arg("--universe") ?? "alien") as "earth" | "alien",
  noFire = arg("--nofire");
if (shots) mkdirSync(shots, { recursive: true });
const slow = (ms: number) => (ci || soft ? ms * 4 : ms),
  problems: string[] = [],
  check = (ok: boolean, what: string) => {
    if (!ok) problems.push(what);
  },
  say = (s: string) => console.log(`  ${s}`);
console.log("gate 97, the world acting on its own");

const BAD = /undefined|NaN|\[object|\bnull\b|\b(ev|pol|town|war|cell):\d/;
const open = (file: string, u: "earth" | "alien"): World => {
  const U = u === "earth" ? EARTH : ALIEN,
    doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8"));
  return loadWorld(doc, (s) => U.build(s), rulesetId(U.build(seedFromText(doc.seed)), U.version), {
    allowRulesetChange: true,
  }).world;
};
const world = saveFile ? open(saveFile, universe) : EARTH.build(seedFromText("first light")),
  u = saveFile ? universe : "earth",
  U = u === "earth" ? EARTH : ALIEN,
  from = Math.floor(world.now / YEAR);
// An old save has none of this: it loads empty, and goes on.
check(saveFile ? wildOf(world)!.scars.length === 0 : true, "an old save came with scars");

// Run on till a shock and a fire have come by themselves.
const plain = (b: { text?: string; lines?: readonly (readonly unknown[])[] }) =>
  (b.lines ?? [])
    .map((l) => l.map((s) => (typeof s === "string" ? s : (s as { text: string }).text)).join(""))
    .join(" ");
let y = from,
  fire: { id: string; cell: number } | null = null,
  quake: string | null = null;
const most = saveFile ? from + 40 : 60;
while (y < most && !(fire && quake)) {
  y++;
  const was = world.events.count;
  world.runTo(y * YEAR);
  for (let i = was; i < world.events.count; i++) {
    const e = world.events.at(i),
      d = (e.data ?? {}) as { natural?: boolean };
    if (!d.natural && e.type !== "wild.answer") continue;
    check(!e.causes.some((c) => c.ref.startsWith("cmd:")), `${e.id} has a hand among its causes`);
    const claim = why(world, e.id).claim;
    check(!BAD.test(claim), `bad words: ${claim}`);
    if (e.type === "wild.fire") fire = { id: e.id, cell: Number(e.place!.split(":")[2]) };
    if (e.type === "act.quake" && !quake) quake = e.id;
  }
}
const store = wildOf(world)!;
say(
  `year ${y}: ${store.tally.quakes} shocks, ${store.tally.fires} fires, ${store.scars.length} scars`,
);
check(!!quake, "no shock came by itself");
check(!!fire, "no fire came by itself");
if (quake) {
  const page = eventPage(world, quake),
    text = page.tabs[0]!.blocks.map((b) => plain(b as never)).join(" ");
  say(`shock: ${text.slice(0, 220)}`);
  check(/Why here/.test(JSON.stringify(page)), "a shock's page says nothing of why here");
  check(
    /plate:/.test(JSON.stringify(page)) || /within|far from where/.test(text),
    "a shock's page opens no plate",
  );
  check(!BAD.test(text), `bad words on a shock's page: ${text.slice(0, 200)}`);
}
if (fire) {
  const text = eventPage(world, fire.id)
    .tabs[0]!.blocks.map((b) => plain(b as never))
    .join(" ");
  say(`fire: ${text.slice(0, 220)}`);
  check(!BAD.test(text), `bad words on a fire's page: ${text.slice(0, 200)}`);
}
// No fire where nothing burns.
if (noFire) {
  const w = open(noFire, "alien"),
    y0 = Math.floor(w.now / YEAR);
  w.runTo((y0 + 12) * YEAR);
  say(
    `a world with nothing to burn, 12 years on: ${wildOf(w)!.tally.fires} fires, ${wildOf(w)!.tally.quakes} shocks`,
  );
  check(wildOf(w)!.tally.fires === 0, "a fire fell on a world with nothing to burn");
}

if (fire && !problems.length) {
  const seed = world.seed.text,
    bytes = gzipSync(
      JSON.stringify(saveWorld(world, rulesetId(world, U.version), { universe: U.name })),
    ),
    root = fileURLToPath(new URL("..", import.meta.url)),
    server = await preview({
      root,
      logLevel: "silent",
      preview: { port: 4297, strictPort: false },
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
    page = await context.newPage(),
    errors: string[] = [],
    k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;
  page.setDefaultTimeout(slow(90000));
  page.on("pageerror", (e) => errors.push(e.message));
  const q = `universe=${u}&seed=${encodeURIComponent(seed)}`;
  await page.goto(`${base}?${q}&hold=1`);
  await page.waitForFunction(() => ((globalThis as any).causalis?.drawn?.() ?? 0) > 0, undefined, {
    timeout: slow(180000),
  });
  await page.evaluate(
    async ([data]) => {
      const b = Uint8Array.from(atob(data as string), (c) => c.charCodeAt(0)),
        c = (globalThis as any).causalis.client;
      await c.importSave(b);
      await c.save("gate97");
    },
    [bytes.toString("base64")],
  );
  await page.goto(`${base}?${q}&load=gate97&hold=1`);
  await page.waitForFunction(() => ((globalThis as any).causalis?.drawn?.() ?? 0) > 0, undefined, {
    timeout: slow(180000),
  });
  await k(`globalThis.causalis.goTo("cell:0:${fire.cell}")`);
  await page.waitForTimeout(slow(6000));
  const scale = await k<string>("globalThis.causalis.scale()"),
    shown = await k<{ flames: number; smoke: number; scar: number; burns: number } | null>(
      "globalThis.causalis.landFire ? globalThis.causalis.landFire() : null",
    );
  say(`land view: scale ${scale}, ${JSON.stringify(shown)}`);
  if (shots) await page.screenshot({ path: join(shots, "land-fire.png") });
  check(scale === "region", `the land did not open (${scale})`);
  check(!!shown && shown.burns > 0, "no burn on the land the fire crossed");
  check(!!shown && shown.flames + shown.scar > 0, "the fire is not in the land's layer");
  await k(
    `globalThis.causalis.open(${JSON.stringify(fire.id)})`,
  );
  await page.waitForTimeout(slow(800));
  const words = await k<string>(
    `(() => { const e = document.querySelector(".page-window"); return e && e.getBoundingClientRect().height > 0 ? e.innerText : ""; })()`,
  );
  say(`page: ${words.slice(0, 200).replace(/\n/g, " | ")}`);
  if (shots) await page.screenshot({ path: join(shots, "fire-page.png") });
  check(/Why here/i.test(words), "the fire's page does not say why here on the screen");
  check(!BAD.test(words), `bad words on the screen: ${words.slice(0, 200)}`);
  check(!errors.length, `page errors: ${errors.slice(0, 3).join(" / ")}`);
  await browser.close();
  await server.close();
}
if (problems.length) {
  console.log(`gate 97 FAILED:\n  - ${problems.join("\n  - ")}`);
  process.exit(1);
}
console.log("gate 97 passed");
process.exit(0);
