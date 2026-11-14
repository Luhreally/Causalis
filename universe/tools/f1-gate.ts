// node tools/f1-gate.ts [--ci] [--soft] [--shots dir]: gate 69, F1 (arms by what they do) at a phone's size.
// A small methane world, "wren 455", is run on in node by twenties from 1600 to 2700 until a battle of the
// last twenty years was fought with a gun whose barrel is wound fibre (the gun's side an arm that fires,
// its bore's material wound). That year is searched for, not pinned. Then:
//   1. the world opened at that year, held, its hash as it was run there;
//   2. that battle watched near, down on its field;
//   3. its flashes on the screen: twenty-five moments from 2 to 74 s, each picture's flash-coloured pixels
//      counted through the whole fight; some moment shows 8 or more over the pictures six seconds either side;
//   4. the gun's page, from the ground up: solid acetylene, why not metal, the estimates, true to metres,
//      and no black powder, iron or steel;
//   5. the principles of firearms and set edges: titled in the world's words, asking what its matter gives
//      with a tick, and not shut on this world; bronze still shut, and why;
//   6. read directly, in node: Earth's guns at its air and pull give the table's ranges; vale 471's numbers
//      give acetylene and ice, with no history run;
//   7. the world's hash as it was, and no error in the page.
// (npm run build first; the gate writes its save and manifest into dist/baked. --soft draws in software, as
// CI's browser does; --shots keeps a picture of each step.)
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync, inflateSync } from "node:zlib";
import { preview } from "vite";
import { chromium } from "playwright";
import { YEAR, rulesetId, saveWorld, seedFromText, type World } from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { battleNear } from "../src/host/battle.ts";
import { meansNumbers, meansOfWorld } from "../src/gen/index.ts";
import { FIREARMS, gunHere, keptLife, type MeansWorld } from "../src/rules/index.ts";
import { homePlanet, warsOf } from "../src/sim/index.ts";
import type { BattleNear } from "../src/bridge/index.ts";
import { isGun } from "../src/view/index.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  shotsAt = argv.indexOf("--shots"),
  shots = shotsAt >= 0 ? argv[shotsAt + 1] : undefined;
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

// (Wren 455 as it was made, life kept: of its own chemistry, a methane world, no life quickens now.)
const SEED = keptLife("wren 455"),
  SEARCH_FROM = 1600,
  SEARCH_TO = 2700;

/** A battle with a gun of wound fibre on one side: the side, and the battle near (its words). */
type Found = { near: BattleNear; side: 0 | 1 };

/** The battle of the twenty years up to a year fought with a gun whose barrel is wound (null: none). */
function gunBattle(world: World, to: number): Found | null {
  const recent = warsOf(world)
    .all()
    .flatMap((w) => w.battles)
    .filter((b) => b.year > to - 20 && b.year <= to)
    .sort((a, b) => b.year - a.year);
  for (const b of recent) {
    const near = battleNear(world, b.event);
    if (!near) continue;
    for (const side of [0, 1] as const) {
      const arm = side === 0 ? near.attacker.host?.arm : near.defender.host?.arm;
      // (The material its side bore that day, as the battle recorded it: wound fibre for a gun's barrel.)
      if (isGun(arm) && (b.bore?.[side]?.[1] ?? "").startsWith("wound")) return { near, side };
    }
  }
  return null;
}

/** Paeth's predictor, as PNG's row filter 4 takes it. */
const paeth = (a: number, b: number, c: number) => {
  const p = a + b - c,
    pa = Math.abs(p - a),
    pb = Math.abs(p - b),
    pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** The flash-coloured pixels of a PNG (8-bit RGB or RGBA, not interlaced): inflated, its row filters undone. */
function flashCount(png: Buffer): number {
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
      if (body[8] !== 8 || body[12] !== 0 || (body[9] !== 2 && body[9] !== 6))
        throw new Error("a screenshot that is not an 8-bit, whole RGB or RGBA PNG");
      channels = body[9] === 6 ? 4 : 3;
    } else if (type === "IDAT") idat.push(body);
    else if (type === "IEND") break;
    at += size + 12;
  }
  const raw = inflateSync(Buffer.concat(idat)),
    stride = width * channels,
    rows = Buffer.alloc(stride * height);
  let flashes = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!,
      src = y * (stride + 1) + 1,
      dst = y * stride;
    if (filter > 4) throw new Error(`a PNG row filter ${filter}`);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? rows[dst + x - channels]! : 0,
        b = y > 0 ? rows[dst - stride + x]! : 0,
        c = x >= channels && y > 0 ? rows[dst - stride + x - channels]! : 0,
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
    for (let x = 0; x < stride; x += channels) {
      const r = rows[dst + x]!,
        g = rows[dst + x + 1]!,
        b = rows[dst + x + 2]!;
      if (r > 225 && g > 170 && b < 150) flashes++;
    }
  }
  return flashes;
}

// The year is found in the world's own history, then its save and manifest are written as phase66's are.
const root = fileURLToPath(new URL("..", import.meta.url)),
  baked = join(root, "dist", "baked"),
  started = performance.now(),
  alien = ALIEN.build(seedFromText(SEED)),
  ruleset = rulesetId(alien, ALIEN.version);
let found: Found | null = null,
  AT = 0;
for (let y = SEARCH_FROM; y <= SEARCH_TO && !found; y += 20) {
  alien.runTo(y * YEAR);
  found = gunBattle(alien, y);
  if (found) AT = y;
}
if (!found) throw new Error(`no battle of a gun of wound fibre by year ${SEARCH_TO} on ${SEED}`);
const { near, side } = found;
const direct = alien.domainHashes(),
  bytes = gzipSync(JSON.stringify(saveWorld(alien, ruleset, { universe: ALIEN.name })));
say(`${SEED} run to year ${AT} in ${((performance.now() - started) / 1000).toFixed(0)} s`);
mkdirSync(baked, { recursive: true });
const file = `alien-${AT}.save`;
writeFileSync(join(baked, file), bytes);
writeFileSync(
  join(baked, "manifest.json"),
  JSON.stringify({
    worlds: [{ universe: ALIEN.name, seed: SEED, year: AT, file, bytes: bytes.length, ruleset }],
  }),
);

// 6. The rules read directly (in node, before the browser starts).
// (Earth's air and pull: the air weighs as Earth's at 15 C, and pulls as Earth does.)
const earth: MeansWorld = {
    ...meansNumbers(homePlanet(EARTH.build(seedFromText("first light"))).generated),
    airBar: 1,
    kelvin: 288.15,
    pull: 1,
  },
  ranges = FIREARMS.map((f) => [f.id, gunHere(f, earth)?.range, f.range] as const);
say(
  `Earth's guns, from the rules: ${ranges.map(([id, got, want]) => `${id} ${got} (table ${want})`).join(", ")}`,
);
check(
  ranges.every(([, got, want]) => got === want),
  `Earth's gunHere is not the table's range: ${ranges.map(([id, got, want]) => `${id} ${got} ≠ ${want}`).join(", ")}`,
);
const vale = meansOfWorld(homePlanet(ALIEN.build(seedFromText("vale 471"))).generated);
say(
  `vale 471, with no history run: its gun's charge “${vale.handCharge?.name}”, its edge “${vale.edge?.name}”`,
);
check(
  /acetylene/.test(vale.handCharge?.name ?? ""),
  `vale 471's charge is “${vale.handCharge?.name}”, not acetylene`,
);
check(vale.edge?.id === "ice", `vale 471's edge is “${vale.edge?.name}”, not ice`);

/** The battle as the debug surface holds it at a moment (globalThis.causalis.battle()). */
type BattleNow = { event: string; s: number; words: string; flashes?: number } | null;
/** The battle's picture at a moment: its state, the screen's PNG, and the flash-coloured pixels in it. */
type Scrubbed = { s: number; state: BattleNow; png: Buffer; flashes: number };

const server = await preview({
    root,
    logLevel: "silent",
    preview: { port: 4269, strictPort: false },
  }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  });
const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: ci || soft ? 1 : 3,
    hasTouch: true,
    isMobile: true,
  }),
  page = await context.newPage(),
  errors: string[] = [];
page.setDefaultTimeout(slow(60000));
page.on("pageerror", (e) => errors.push(`${e.message}\n${e.stack ?? ""}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;
const ask = <T>(type: string, args: unknown = {}) =>
  k<T>(
    `globalThis.causalis.client.query({ type: ${JSON.stringify(type)}, args: ${JSON.stringify(args)} })`,
  );
const hashes = () => ask<unknown>("hashes");
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};
const until = async (what: string, ok: () => Promise<boolean>, ms = slow(60000)) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await page.waitForTimeout(60);
  }
  problems.push(`${what} did not come`);
  return false;
};
/** The page window's title and words, read in one evaluate so that they agree. */
const pageNow = () =>
  k<{ title: string; words: string }>(`({
    title: document.querySelector(".page-title")?.textContent ?? "",
    words: document.querySelector(".page-window")?.textContent ?? "",
  })`);
const open = (ref: string) => k(`globalThis.causalis.open(${JSON.stringify(ref)})`);
/** The battle set at a moment, its state read in the same evaluate; then the screen after the frames. */
const scrubTo = async (s: number): Promise<Scrubbed> => {
  const state = await k<BattleNow>(
    `(() => { globalThis.causalis.battleAt(${s}, 0); return globalThis.causalis.battle?.() ?? null; })()`,
  );
  await page.waitForTimeout(slow(300));
  const png = await page.screenshot();
  return { s, state, png, flashes: flashCount(png) };
};

// 1. The world at its year, held; its hash as it was run there.
await page.goto(`${base}?universe=alien&seed=${encodeURIComponent(SEED)}&year=${AT}&hold`);
await until(
  "the first picture",
  () => k<boolean>("(globalThis.causalis?.drawn?.() ?? 0) > 0"),
  slow(180000),
);
const hashed = await hashes();
check(same(hashed, direct), "the world fetched is not the world run there");

// 2. That battle watched near, down on its field.
say(
  `${near.title}: ${near.attacker.kit}, against ${near.defender.kit}; the gun is ${side === 0 ? "the attacker's" : "the defender's"}`,
);
check(
  await k<boolean>(`globalThis.causalis.watchBattleNear(${JSON.stringify(near)})`),
  "the battle not watched",
);
await until(
  "the battle's field",
  async () => (await k<BattleNow>("globalThis.causalis.battle?.() ?? null"))?.event === near.event,
  slow(60000),
);

// 3. Its flashes on the screen. (battle() does not expose drawCalls, so no comparison with a metal
// gun's draws is made here.)
// (Through the whole fight, not a window of it: when a fight's firing comes is the fight's own. On the world the
// peoples' holding makes both sides ride, and fire near 55 s where on foot they fired from 20. And a flash is brief:
// it is read against the pictures six seconds either side of it, not against the first, which the riders leaving
// the screen alone outdid.)
const quiet = await scrubTo(1),
  firing: Scrubbed[] = [];
for (const s of Array.from({ length: 25 }, (_, i) => 2 + 3 * i)) firing.push(await scrubTo(s));
const over = (i: number) =>
  firing[i]!.flashes -
  Math.max(firing[i - 2]?.flashes ?? Infinity, firing[i + 2]?.flashes ?? Infinity);
let best = 2;
for (let i = 2; i < firing.length - 2; i++) if (over(i) > over(best)) best = i;
const top = firing[best]!;
say(
  `flashes on the screen: ${quiet.flashes} at 1 s; ${firing.map((f) => `${f.s.toFixed(0)} s ${f.flashes}`).join(", ")}; the most over the pictures about it, ${over(best)} at ${top.s} s; the debug battle() counts ${top.state?.flashes ?? "none (not shown)"} there`,
);
check(
  over(best) >= 8,
  `no moment of the fight's 2–74 s shows 8 flashes more than the pictures six seconds either side (the most, ${over(best)} at ${top.s} s)`,
);
if (shots) writeFileSync(join(shots, "flashes.png"), top.png);

// 4. The gun's page, from the ground up (the trooper is not read by the page; 0 stands in).
await open(`arm:${near.event}:${side}:0`);
await until("the gun's words", async () => /solid acetylene/.test((await pageNow()).words));
const gun = await pageNow();
say(`the gun's page, “${gun.title}”: ${gun.words.replace(/\s+/g, " ").slice(0, 220)}`);
check(/Why not metal|no furnace/i.test(gun.words), "the gun's page does not say why not metal");
check(/estimate/i.test(gun.words), "the gun's page says nothing of estimates");
check(/true to \d+ m/.test(gun.words), "the gun's page does not say how far it is true");
check(
  // (Its barrel's strength is told against a steel one's: the only steel it may name.)
  !/black powder|iron|steel/.test(gun.words.replace(/where a steel one holds about \d+/g, "")),
  "the gun's page speaks of black powder, iron or steel",
);
await shot("gun");

// 5. The principles. (set-edges asks edge-without-metal, "hold an edge without metal", not make gas
// fast: its own asked row is the one that takes a tick.)
const principle = async (id: string) => {
  await open(`prin:${id}`);
  await until(`the page of ${id}`, async () => (await pageNow()).words.includes("Needs first"));
  return pageNow();
};
const gunPage = await principle("firearms");
check(
  /charged with solid acetylene/.test(gunPage.title),
  `the gun's principle is titled “${gunPage.title}”`,
);
check(
  /✓[^✓✗]{0,12}make gas fast/.test(gunPage.words),
  "the gun's principle shows no tick for making gas fast",
);
check(
  !gunPage.words.includes("On this world"),
  "the gun's principle says it is shut on this world",
);
const edgePage = await principle("set-edges");
check(/ice flakes/.test(edgePage.title), `the edge's principle is titled “${edgePage.title}”`);
check(
  /✓[^✓✗]{0,12}hold an edge without metal/.test(edgePage.words),
  "the edge's principle shows no tick for holding an edge without metal",
);
check(
  !edgePage.words.includes("On this world"),
  "the edge's principle says it is shut on this world",
);
const bronze = await principle("bronze");
check(
  bronze.words.includes("On this world") && /shut:/.test(bronze.words),
  "bronze is not shut on this world",
);
// (Since F3 it says what bronze asks of the world: a hardener within reach, or a furnace.)
check(
  /harden copper|nothing burns/i.test(bronze.words),
  "bronze's page does not say why it is shut",
);
await shot("bronze");

// 7. The world as it was when read first; no error in the page.
check(same(await hashes(), hashed), "the world's hash changed while its battle was watched");
check(errors.length === 0, `errors in the page: ${errors.slice(0, 3).join(" | ")}`);

console.log(
  `F1 gate (69): ${((performance.now() - started) / 1000).toFixed(0)} s, ${problems.length} problems`,
);
for (const p of problems) console.log(`  - ${p}`);
await browser.close();
await server.close();
process.exit(problems.length ? 1 : 0);
