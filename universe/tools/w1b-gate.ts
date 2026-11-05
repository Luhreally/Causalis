// node tools/w1b-gate.ts [--ci] [--soft] [--shots dir]: gate 73, a battle by fire (war-reach-plan.md W1b), at a phone's size.
// A battle of the Earth seed's history, fought again with made-up arms, held before a real town at its seconds
// (causalis.holdBattle) and then watched on its close field (causalis.watchBattleNear).
//   1. modern against modern, before a town: the hosts stand apart from first to last, no one by the hand, none fallen
//      to it, streaks and flashes across the gap; the victors come on over the ground once the beaten break;
//   2. spears against guns, before a town: they come on and close, and most fall on the way;
//   3. the same two on the close field, the same order, the words the same;
//   4. a man shot down is told as that; no error in the page.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium } from "playwright";
import type { BattleNear } from "../src/bridge/index.ts";

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
console.log("gate 73, a battle by fire");
const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4273, strictPort: false } }),
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
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};

await page.goto(`${base}?universe=earth&seed=first%20light&year=450&hold=1`);
await page.waitForFunction(
  () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
  undefined,
  { timeout: 1_800_000 },
);
await k("globalThis.causalis.client.setSpeed(0)");
await k(`globalThis.causalis.client.advance(globalThis.causalis.client.status.t + 8 * 3600)`);
const book = await ask<{ realms: { ref: string }[] }>("wealth.book"),
  list = await ask<{ leaders: { town: string | null }[] }>("leaders.of", {
    realm: book.realms[0]!.ref,
  }),
  town = list.leaders[0]!.town!,
  wars = await ask<{ wars: { battles: { event: string; fallen: number }[] }[] }>("wars.map"),
  greatest = wars.wars.flatMap((w) => w.battles).sort((a, b) => b.fallen - a.fallen)[0]!,
  real = await ask<BattleNear>("battle.near", { event: greatest.event });
await k(`globalThis.causalis.goTo(${JSON.stringify(town)})`);
await page.waitForFunction(
  () => (globalThis as { causalis?: { scale?: () => string } }).causalis?.scale?.() === "village",
  undefined,
  { timeout: slow(120000) },
);
await page.waitForTimeout(slow(1500));

const nearOf = (
  event: string,
  a: { arm: string; guard: string; mount: string },
  d: { arm: string; guard: string; mount: string },
  fell: [number, number],
  won: boolean,
): BattleNear =>
  ({
    ...real,
    event,
    // (A made-up fight has no record of its exchanges.)
    combat: undefined,
    hills: false,
    river: false,
    walls: 0,
    town: null,
    won,
    outcome: won ? "field" : "held",
    attacker: {
      ...real.attacker,
      fielded: 6000,
      fallen: fell[0],
      wounded: Math.round(fell[0] * 0.8),
      host: a,
      kit: a.arm,
      risen: 0,
      armed: 1,
      cannon: a.arm !== "spear",
    },
    defender: {
      ...real.defender,
      fielded: 5000,
      fallen: fell[1],
      wounded: Math.round(fell[1] * 0.8),
      host: d,
      kit: d.arm,
      risen: 0,
      armed: 1,
      cannon: d.arm !== "spear",
    },
  }) as BattleNear;
const MODERN = nearOf(
    "ev:gate:modern",
    { arm: "automatic", guard: "helmet", mount: "armoured" },
    { arm: "autoloader", guard: "helmet", mount: "foot" },
    [1400, 1900],
    true,
  ),
  SPEARS = nearOf(
    "ev:gate:spears",
    { arm: "spear", guard: "shield", mount: "foot" },
    { arm: "autoloader", guard: "helmet", mount: "foot" },
    [3200, 300],
    false,
  );

type Held = {
  s: number;
  fire: {
    stands: [boolean, boolean];
    apart: number;
    metres: number;
    line: [number, number];
  } | null;
  words: string;
  flashes: number;
  streaks: number;
  cars: number;
  standing: number[];
  fallen: number[];
  troopers: {
    id: number;
    side: number;
    x: number;
    z: number;
    act: string;
    size: number;
    by: string | null;
    falls: number | null;
  }[];
};
/** The battle held before the town at second `s`, the eye as the town's view brings it; what is drawn. */
const held = async (near: BattleNear, s: number, name: string): Promise<Held> => {
  await k(`globalThis.causalis.holdBattle(${JSON.stringify(near)}, ${s})`);
  await page.waitForTimeout(slow(500));
  await k(`globalThis.causalis.heldBattle(true) && 0`);
  await page.waitForTimeout(slow(500));
  const h = (await k<Held | null>("globalThis.causalis.heldBattle()"))!;
  await shot(name);
  say(`${name}: ${h.words} | ${h.flashes} flashes, ${h.streaks} streaks, fallen ${h.fallen}`);
  return h;
};
/** The two hosts' forward edges among those up (x), and how far apart. */
const gapOf = (h: Held, s: number) => {
  const up = (side: number) =>
      h.troopers.filter(
        (t) => t.side === side && (t.falls === null || t.falls > s) && t.size > 0.5,
      ),
    a = up(0).map((t) => t.x),
    d = up(1).map((t) => t.x);
  return a.length && d.length ? Math.min(...d) - Math.max(...a) : Infinity;
};

// 1. Modern against modern, before the town.
let closest = Infinity;
for (const [s, name] of [
  [4, "town-modern-1-drawn"],
  [24, "town-modern-2-bounds"],
  [44, "town-modern-3-ground"],
  [70, "town-modern-4-fire"],
  [100, "town-modern-5-fire"],
  [113, "town-modern-6-broke"],
  [125, "town-modern-7-come-on"],
] as const) {
  const h = await held(MODERN, s, name);
  check(!!h.fire?.stands[0] && !!h.fire.stands[1], `modern ${s}: not fought by fire`);
  check(!h.troopers.some((t) => t.act === "fight"), `modern ${s}: someone fights by the hand`);
  if (s < 108) {
    const g = gapOf(h, s);
    closest = Math.min(closest, g);
    check(g * 2 > 60, `modern ${s}: the hosts only ${(g * 2).toFixed(0)} m apart`);
    check(h.troopers.filter((t) => t.size > 0.5).length > 100, `modern ${s}: too few up`);
  }
  if (s >= 24 && s < 108) {
    check(h.streaks + h.flashes > 0, `modern ${s}: nothing fired`);
    check(
      h.troopers.some((t) => t.act === "prone"),
      `modern ${s}: no one down`,
    );
  }
  if (s === 24)
    check(
      h.troopers.some((t) => t.act === "run") && h.troopers.some((t) => t.act === "prone"),
      "modern 24: no bounds",
    );
  if (s === 113)
    check(
      h.troopers.some((t) => t.side === 0 && t.act === "run"),
      "modern 113: the victors do not come on",
    );
  if (s === 125) {
    const up = h.troopers.filter((t) => t.side === 0 && (t.falls === null || t.falls > s));
    check(
      Math.max(...up.map((t) => t.x)) > h.fire!.line[1] - 10,
      "modern 125: the victors are not over the ground the beaten held",
    );
  }
  check(h.cars > 0, `modern ${s}: no cars`);
}
say(`modern: closest ${(closest * 2).toFixed(0)} town metres apart`);
{
  const end = await held(MODERN, 149, "town-modern-8-after"),
    dead = end.troopers.filter((t) => t.falls !== null),
    hand = dead.filter((t) => t.by === "blow").length;
  say(`modern: ${hand} of ${dead.length} dead by the hand`);
  check(hand === 0, `modern: ${hand} of ${dead.length} dead by the hand`);
  const shotDead = dead.find((t) => t.by === "arrow")!,
    told = await k<string>(`globalThis.causalis.heldWords(${shotDead.id})`);
  say(`one shot: ${told}`);
  check(/m off/.test(told) && !/press/.test(told), `one shot is told as: ${told}`);
}
await k("globalThis.causalis.holdBattle(null)");
await page.waitForTimeout(slow(300));

// 2. Spears against guns, before the town.
for (const [s, name] of [
  [24, "town-spears-1-come"],
  [44, "town-spears-2-run"],
  [60, "town-spears-3-arrived"],
  [125, "town-spears-4-broke"],
] as const) {
  const h = await held(SPEARS, s, name);
  check(!!h.fire && !h.fire.stands[0] && h.fire.stands[1], `spears ${s}: not closing into fire`);
  if (s === 60)
    check(
      h.troopers.some((t) => t.act === "fight"),
      "spears 60: no one got there",
    );
}
{
  const end = await held(SPEARS, 149, "town-spears-5-after"),
    dead = end.troopers.filter((t) => t.side === 0 && t.falls !== null),
    before = dead.filter((t) => t.falls! < 48).length;
  say(`spears: ${before} of ${dead.length} fell before they arrived`);
  check(before / dead.length > 0.5, `spears: only ${before} of ${dead.length} fell on the way`);
}
await k("globalThis.causalis.holdBattle(null)");

// 3. On the close field.
type Seen = {
  fire: { stands: [boolean, boolean]; apart: number } | null;
  words: string;
  onScreen: { act: string; side: number; x: number }[];
  bolts: number;
  fallen: number[];
};
const field = async (near: BattleNear, label: string, seconds: readonly number[]) => {
  check(
    await k<boolean>(`globalThis.causalis.watchBattleNear(${JSON.stringify(near)})`),
    `${label}: not watched`,
  );
  await page.waitForFunction(
    (event) =>
      (
        globalThis as { causalis?: { battle?: () => { event: string } | null } }
      ).causalis?.battle?.()?.event === event,
    near.event,
    { timeout: slow(60000) },
  );
  for (const s of seconds) {
    await k(`globalThis.causalis.battleAt(${s}, 0)`);
    await page.waitForTimeout(slow(1400));
    const b = (await k<Seen>("globalThis.causalis.battle()"))!;
    await shot(`field-${label}-${String(s).padStart(3, "0")}`);
    say(`field ${label} ${s}: ${b.words} | ${b.bolts} streaks`);
    if (label === "modern") {
      check(!!b.fire?.stands[0] && !!b.fire.stands[1], `field modern ${s}: not by fire`);
      check(!b.onScreen.some((t) => t.act === "fight"), `field modern ${s}: by the hand`);
      if (s < 108) {
        const a = b.onScreen.filter((t) => t.side === 0).map((t) => t.x),
          d = b.onScreen.filter((t) => t.side === 1).map((t) => t.x);
        check(
          Math.min(...d) - Math.max(...a) > 20,
          `field modern ${s}: only ${(Math.min(...d) - Math.max(...a)).toFixed(0)} m apart`,
        );
      }
    }
    if (label === "spears" && s === 60)
      check(
        b.onScreen.some((t) => t.act === "fight"),
        "field spears 60: no one got there",
      );
  }
};
await field(MODERN, "modern", [4, 24, 44, 80, 113, 125]);
await k("globalThis.causalis.leaveBattle?.()");
await page.waitForTimeout(slow(600));
await field(SPEARS, "spears", [24, 44, 60, 125]);

// 4.
check(errors.length === 0, `errors in the page: ${errors.slice(0, 3).join(" | ")}`);
await browser.close();
await server.close();
if (problems.length) {
  console.log(`gate 73 FAILED:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("gate 73 passed");
process.exit(0);
